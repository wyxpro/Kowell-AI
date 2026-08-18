import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { assertLearnerBrief, assertResourceDraft, assertResourcePlan, assertReviewResult, type EvidenceBundle, type LearnerBrief, type ResourceDraft, type ResourcePlan, type ResourceType, type ReviewResult } from "../_shared/agent-contracts.ts";
import { ContentSafetyError, assertSafeInput, cleanSummary, validateDraft } from "../_shared/content-safety.ts";
import { generateStructured } from "../_shared/model-provider.ts";
import { retrieveCourseKnowledge } from "../_shared/knowledge-retrieval.ts";
import { assertRunLease, claimRun, completedOutput, getOwnedRun, requestCancellation, requireUser, runStep, serviceClient, setRunStatus, type ClaimedAgentRun } from "../_shared/agent-runtime.ts";

const TYPES: ResourceType[] = ["document", "mindmap", "exercise", "reading", "code", "micro_lesson"];
const headers = { ...corsHeaders, "Content-Type": "application/json" };
Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  let runId: string | undefined;
  let userId: string | undefined;
  let claimedRun: ClaimedAgentRun | undefined;
  try {
    const body = await request.json() as { action?: string; run_id?: string };
    runId = body.run_id;
    const action = body.action ?? "start";
    if (!runId || !["start", "cancel", "retry"].includes(action)) return reply(400, { error: "invalid_request" });
    const client = serviceClient();
    const user = await requireUser(client, request.headers.get("Authorization"));
    userId = user.id;
    const run = await getOwnedRun(client, runId, user.id);
    if (run.run_type !== "resource_generate") return reply(400, { error: "workflow_not_supported" });
    if (action === "cancel") {
      await requestCancellation(client, runId, user.id);
      return status(client, runId, user.id);
    }
    if (run.status === "completed" || run.status === "cancelled") return status(client, runId, user.id);
    if (run.cancel_requested) return reply(409, { error: "run_cancel_requested" });
    if (action === "retry" && run.status !== "failed") return status(client, runId, user.id);
    if (action === "start" && !["queued", "running"].includes(run.status)) return status(client, runId, user.id);
    const expectedStatus = action === "retry" ? "failed" : run.status === "running" ? "running" : "queued";
    claimedRun = await claimRun(client, runId, user.id, expectedStatus);
    if (!claimedRun) {
      const current = await getOwnedRun(client, runId, user.id);
      if (current.status === "running") return reply(409, { error: "run_already_running" });
      return status(client, runId, user.id);
    }
    await execute(client, claimedRun);
    return status(client, runId, user.id);
  } catch (error) {
    const message = cleanSummary(error instanceof Error ? error.message : "orchestration_failed", 500);
    const leaseLost = message === "run_lease_lost" || message === "step_lease_lost";
    if (runId && userId && claimedRun && !leaseLost) {
      try {
        await setRunStatus(serviceClient(), runId, userId, claimedRun.lease_token, message === "run_cancelled" ? "cancelled" : "failed", message);
      } catch {
        /* Keep the response sanitized when the run was fenced by another worker. */
      }
    }
    console.error(JSON.stringify({ event: "agent_orchestrate_failed", run_id: runId ?? null, error: message }));
    const responseStatus = message === "unauthorized" ? 401 : message === "run_cancelled" || leaseLost ? 409 : 500;
    return reply(responseStatus, { error: message });
  }
});
async function execute(client: ReturnType<typeof serviceClient>, run: ClaimedAgentRun): Promise<void> {
  const courseId = run.course_id;
  const request = typeof run.input.request === "string" ? run.input.request : typeof run.input.topic === "string" ? run.input.topic : "";
  const selectedTypes = getSelectedTypes(run.input);
  if (!courseId) throw new Error("run_course_missing");
  assertSafeInput(request, "run_request");
  const brief = await step(client, run, "analyst", { request }, () => analyst(client, run, request), assertLearnerBrief);
  const evidence = await step(client, run, "curator", { brief }, () => retrieveCourseKnowledge(client, courseId, `${brief.request} ${brief.goals.join(" ")}`), value => value as EvidenceBundle);
  const plan = await step(client, run, "designer", { brief, evidence, selectedTypes }, () => design(brief, evidence, selectedTypes), assertResourcePlan);
  const specs = selectedTypes.map((type) => plan.resources.find((item) => item.type === type)).filter((item): item is ResourcePlan["resources"][number] => Boolean(item));
  if (specs.length !== selectedTypes.length) throw new Error("resource_plan_selected_types_missing");
  const drafts = (await Promise.all(specs.map((item) => create(client, run, brief, evidence, item)))).filter((item): item is ResourceDraft => Boolean(item));
  if (drafts.length !== selectedTypes.length) throw new Error("all_selected_creators_failed");
  let review = await step(client, run, "reviewer", { drafts, selectedTypes }, () => reviewDrafts(brief, evidence, drafts, selectedTypes), assertReviewResult);
  let finalDrafts = drafts;
  if (!review.approved) {
    finalDrafts = (await Promise.all(drafts.map((draft) => repair(client, run, brief, evidence, draft, review)))).filter((item): item is ResourceDraft => Boolean(item));
    if (finalDrafts.length !== selectedTypes.length) throw new Error("all_selected_repairs_failed");
    review = await step(client, run, "reviewer_repair", { drafts: finalDrafts, selectedTypes }, () => reviewDrafts(brief, evidence, finalDrafts, selectedTypes), assertReviewResult);
  }
  if (!review.approved) {
    await setRunStatus(client, run.id, run.user_id, run.lease_token, "failed", "review_not_approved");
    return;
  }
  await step(client, run, "publisher_path_planner", { drafts: finalDrafts, selectedTypes }, () => publish(client, run, request, evidence, finalDrafts, review), value => value as { resourceIds: string[] });
  await assertRunLease(client, run.id, run.lease_token);
  await setRunStatus(client, run.id, run.user_id, run.lease_token, "completed");
}
function getSelectedTypes(input: Record<string, unknown>): ResourceType[] { const raw = input.selected_resource_types; if (!Array.isArray(raw) || raw.length < 5) throw new Error("selected_resource_types_invalid"); const selected: ResourceType[] = []; for (const value of raw) { if (typeof value !== "string" || !TYPES.includes(value as ResourceType) || selected.includes(value as ResourceType)) throw new Error("selected_resource_types_invalid"); selected.push(value as ResourceType); } return selected; }
async function step<T>(client: ReturnType<typeof serviceClient>, run: ClaimedAgentRun, key: string, input: unknown, action: () => Promise<T>, validate: (value: unknown) => T): Promise<T> { const result = await runStep(client, run.id, run.lease_token, key, stepSequence(key), input, action); return result === undefined ? completedOutput(client, run.id, key, validate) : result; }
function stepSequence(key: string): number { const fixed: Record<string, number> = { analyst: 10, curator: 20, designer: 30, reviewer: 50, reviewer_repair: 70, publisher_path_planner: 80 }; if (fixed[key] !== undefined) return fixed[key]; const creator = TYPES.indexOf(key.replace("creator_", "") as ResourceType); if (creator >= 0) return 40 + creator; const repair = TYPES.indexOf(key.replace("repair_", "") as ResourceType); if (repair >= 0) return 60 + repair; throw new Error("agent_step_sequence_unknown"); }
async function analyst(client: ReturnType<typeof serviceClient>, run: ClaimedAgentRun, request: string): Promise<LearnerBrief> { const portrait = await client.from("learning_portraits").select("major_direction,knowledge_base,cognitive_style,error_patterns,learning_rhythm,learning_goals,is_complete,version,last_updated_at").eq("user_id", run.user_id).maybeSingle(); if (portrait.error) throw new Error("portrait_lookup_failed"); const portraitData = portrait.data as Record<string, unknown> | null; const safePortrait = portraitData ? { major_direction: portraitData.major_direction ?? {}, knowledge_base: portraitData.knowledge_base ?? {}, cognitive_style: portraitData.cognitive_style ?? {}, error_patterns: portraitData.error_patterns ?? {}, learning_rhythm: portraitData.learning_rhythm ?? {}, learning_goals: portraitData.learning_goals ?? {}, is_complete: portraitData.is_complete === true, version: typeof portraitData.version === "number" ? portraitData.version : null } : {}; return generateStructured([{ role: "system", content: "Return a concise LearnerBrief JSON only. Never include hidden reasoning." }, { role: "user", content: JSON.stringify({ learnerId: "current_learner", courseId: run.course_id, request, portrait: safePortrait }) }], assertLearnerBrief); }
async function design(brief: LearnerBrief, evidence: EvidenceBundle, selectedTypes: ResourceType[]): Promise<ResourcePlan> { return generateStructured([{ role: "system", content: "Return ResourcePlan JSON only. Include exactly one resource for each selected type, and only the selected types. Use only provided evidence IDs. No hidden reasoning." }, { role: "user", content: JSON.stringify({ brief, evidence, selectedTypes }) }], assertResourcePlan); }
async function create(client: ReturnType<typeof serviceClient>, run: ClaimedAgentRun, brief: LearnerBrief, evidence: EvidenceBundle, spec: ResourcePlan["resources"][number]): Promise<ResourceDraft | undefined> { try { return await step(client, run, `creator_${spec.type}`, { brief, evidence, spec }, async () => { const draft = await generateStructured([{ role: "system", content: "Return final learner-facing ResourceDraft JSON only; no hidden reasoning." }, { role: "user", content: JSON.stringify({ brief, evidence, spec }) }], assertResourceDraft); validateDraft(draft, evidence); return draft; }, assertResourceDraft); } catch (error) { const message = error instanceof Error ? error.message : String(error); if (["run_cancelled", "run_lease_lost", "step_lease_lost"].includes(message)) throw error; console.error(JSON.stringify({ event: "creator_failed", run_id: run.id, resource_type: spec.type, error: cleanSummary(error, 120) })); return undefined; } }
async function repair(client: ReturnType<typeof serviceClient>, run: ClaimedAgentRun, brief: LearnerBrief, evidence: EvidenceBundle, draft: ResourceDraft, review: ReviewResult): Promise<ResourceDraft | undefined> { try { return await step(client, run, `repair_${draft.type}`, { draft, review }, async () => { const output = await generateStructured([{ role: "system", content: "Repair exactly once. Return ResourceDraft JSON only; no hidden reasoning." }, { role: "user", content: JSON.stringify({ brief, evidence, draft, review }) }], assertResourceDraft); validateDraft(output, evidence); return output; }, assertResourceDraft); } catch (error) { const message = error instanceof Error ? error.message : String(error); if (["run_cancelled", "run_lease_lost", "step_lease_lost"].includes(message)) throw error; return undefined; } }
async function reviewDrafts(brief: LearnerBrief, evidence: EvidenceBundle, drafts: ResourceDraft[], selectedTypes: ResourceType[]): Promise<ReviewResult> { const issues: ReviewResult["issues"] = []; const expected = new Set(selectedTypes); const actual = drafts.map((draft) => draft.type); if (drafts.length !== selectedTypes.length || actual.some((type) => !expected.has(type)) || selectedTypes.some((type) => actual.filter((candidate) => candidate === type).length !== 1)) issues.push({ code: "schema", message: "selected_resource_types_incomplete" }); for (const draft of drafts) try { validateDraft(draft, evidence); } catch (error) { issues.push({ code: error instanceof ContentSafetyError ? error.kind : "schema", message: "deterministic_validation_failed" }); } if (issues.length) return { approved: false, score: 0, issues, revisionInstructions: ["Correct selected resource types, citations and output structure."], summary: "deterministic_review_failed" }; try { return await generateStructured([{ role: "system", content: "Return strict ReviewResult JSON only; no hidden reasoning." }, { role: "user", content: JSON.stringify({ brief, evidenceIds: evidence.items.map((item) => item.chunkId), selectedTypes, drafts }) }], assertReviewResult); } catch (error) { if (String(error).includes("model_not_configured")) return { approved: true, score: 75, issues: [], revisionInstructions: [], summary: "deterministic_reviewer_model_unavailable" }; throw error; } }
async function publish(client: ReturnType<typeof serviceClient>, run: ClaimedAgentRun, request: string, evidence: EvidenceBundle, drafts: ResourceDraft[], review: ReviewResult): Promise<{ resourceIds: string[] }> { if (!run.course_id) throw new Error("run_course_missing"); const items = drafts.map((draft) => ({ artifact_type: draft.type, publish_key: `resource:${draft.type}`, title: draft.title, content: draft.content, quality_score: review.score, review, knowledge_point_ids: draft.knowledgePointIds, evidence: evidence.items.filter((item) => draft.citations.includes(item.chunkId)).map((item) => ({ document_id: item.sourceId, chunk_id: item.chunkId, claim: draft.summary.slice(0, 500), citation_label: item.sourceTitle, source_url: item.sourceUrl ?? "", evidence_hash: `${item.chunkId}:${draft.type}` })) })); const { data, error } = await client.rpc("publish_agent_resources", { p_run_id: run.id, p_user_id: run.user_id, p_request: request, p_items: items, p_lease_token: run.lease_token }); if (error) { if (error.message === "run_cancelled") throw new Error("run_cancelled"); if (error.message === "run_lease_lost") throw new Error("run_lease_lost"); throw new Error("resource_publish_failed"); } if (!data || typeof data !== "object") throw new Error("resource_publish_failed"); const result = data as Record<string, unknown>; const resourceIds = Array.isArray(result.resourceIds) ? result.resourceIds.filter((value): value is string => typeof value === "string") : []; if (resourceIds.length !== drafts.length) throw new Error("resource_publish_incomplete"); return { resourceIds }; }
async function status(client: ReturnType<typeof serviceClient>, runId: string, userId: string): Promise<Response> { const run = await client.from("agent_runs").select("id,status,error,cancel_requested").eq("id", runId).eq("user_id", userId).maybeSingle(); if (run.error) return reply(500, { error: "run_status_lookup_failed" }); if (!run.data) return reply(404, { error: "run_not_found" }); const [steps, artifacts] = await Promise.all([client.from("agent_steps").select("id,run_id,step_key,sequence,status,error,started_at,completed_at,created_at,updated_at").eq("run_id", runId).order("sequence"), client.from("agent_artifacts").select("id,run_id,step_id,artifact_type,status,title,error,created_at,updated_at").eq("run_id", runId)]); if (steps.error || artifacts.error) return reply(500, { error: "run_status_lookup_failed" }); return reply(200, { run_id: runId, status: run.data.status, steps: steps.data ?? [], artifacts: artifacts.data ?? [], error: run.data.error ?? null }); }
function reply(status: number, value: unknown): Response { return new Response(JSON.stringify(value), { status, headers }); }
