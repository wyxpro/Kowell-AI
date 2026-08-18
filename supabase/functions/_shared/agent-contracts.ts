export const RUN_STATUSES = ["queued", "running", "completed", "failed", "cancelled"] as const;
export const ARTIFACT_STATUSES = ["pending", "queued", "running", "completed", "failed", "cancelled"] as const;
export const RESOURCE_TYPES = ["document", "mindmap", "exercise", "reading", "code", "micro_lesson"] as const;
export type RunStatus = typeof RUN_STATUSES[number];
export type StepStatus = RunStatus;
export type ArtifactStatus = typeof ARTIFACT_STATUSES[number];
export type WorkflowType = "resource_generate" | "learning_adapt";
export type ResourceType = typeof RESOURCE_TYPES[number];
export type JsonRecord = Record<string, unknown>;

export interface LearnerBrief { learnerId: string; courseId: string; request: string; goals: string[]; weakKnowledgePointIds: string[]; preferredStyle: string; difficulty: "beginner" | "intermediate" | "advanced"; summary: string; }
export interface EvidenceItem { knowledgePointId: string; chunkId: string; sourceId: string; sourceTitle: string; sourceUrl?: string; license?: string; excerpt: string; relevance: number; }
export interface EvidenceBundle { courseId: string; query: string; items: EvidenceItem[]; }
export interface ResourcePlanItem { type: ResourceType; title: string; objective: string; knowledgePointIds: string[]; evidenceIds: string[]; format: JsonRecord; }
export interface ResourcePlan { courseId: string; topic: string; learningObjectives: string[]; sequence: string[]; resources: ResourcePlanItem[]; }
export interface ResourceDraft { type: ResourceType; title: string; content: JsonRecord; citations: string[]; knowledgePointIds: string[]; summary: string; }
export interface ReviewResult { approved: boolean; score: number; issues: Array<{ code: "safety" | "schema" | "citation" | "quality"; message: string }>; revisionInstructions: string[]; summary: string; }

export function isRecord(value: unknown): value is JsonRecord { return typeof value === "object" && value !== null && !Array.isArray(value); }
export function isResourceType(value: unknown): value is ResourceType { return typeof value === "string" && (RESOURCE_TYPES as readonly string[]).includes(value); }
export function assertNoHiddenReasoning(value: unknown): void {
  const text = JSON.stringify(value);
  if (/<think\b|<\/think>|chain[ -]?of[ -]?thought|hidden reasoning/i.test(text)) throw new Error("hidden_reasoning_rejected");
}
export function assertLearnerBrief(value: unknown): LearnerBrief {
  if (!isRecord(value) || typeof value.learnerId !== "string" || typeof value.courseId !== "string" || typeof value.request !== "string" || !Array.isArray(value.goals) || !Array.isArray(value.weakKnowledgePointIds) || typeof value.preferredStyle !== "string" || !["beginner", "intermediate", "advanced"].includes(String(value.difficulty)) || typeof value.summary !== "string") throw new Error("invalid_learner_brief");
  assertNoHiddenReasoning(value); return value as LearnerBrief;
}
export function assertResourcePlan(value: unknown): ResourcePlan {
  if (!isRecord(value) || typeof value.courseId !== "string" || typeof value.topic !== "string" || !Array.isArray(value.learningObjectives) || !Array.isArray(value.sequence) || !Array.isArray(value.resources) || value.resources.length < 5) throw new Error("invalid_resource_plan");
  for (const item of value.resources) if (!isRecord(item) || !isResourceType(item.type) || typeof item.title !== "string" || typeof item.objective !== "string" || !Array.isArray(item.knowledgePointIds) || !Array.isArray(item.evidenceIds) || !isRecord(item.format)) throw new Error("invalid_resource_plan_item");
  assertNoHiddenReasoning(value); return value as ResourcePlan;
}
export function assertResourceDraft(value: unknown): ResourceDraft {
  if (!isRecord(value) || !isResourceType(value.type) || typeof value.title !== "string" || !isRecord(value.content) || !Array.isArray(value.citations) || !Array.isArray(value.knowledgePointIds) || typeof value.summary !== "string") throw new Error("invalid_resource_draft");
  assertNoHiddenReasoning(value); return value as ResourceDraft;
}
export function assertReviewResult(value: unknown): ReviewResult {
  if (!isRecord(value) || typeof value.approved !== "boolean" || typeof value.score !== "number" || !Array.isArray(value.issues) || !Array.isArray(value.revisionInstructions) || typeof value.summary !== "string") throw new Error("invalid_review_result");
  assertNoHiddenReasoning(value); return value as ReviewResult;
}
