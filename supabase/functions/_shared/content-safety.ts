import { type EvidenceBundle, type ResourceDraft, isRecord } from "./agent-contracts.ts";

export type SafetyFailureKind = "safety" | "schema" | "citation";
export class ContentSafetyError extends Error { constructor(public readonly kind: SafetyFailureKind, message: string) { super(message); } }
const MAX_INPUT = 24_000;
const DANGEROUS = /(?:ignore (?:all )?previous instructions|system prompt|api[_ -]?key|service[_ -]?role|<script\b|javascript:)/i;
const HIDDEN = /<think\b[\s\S]*?<\/think>|<think\b[\s\S]*$/gi;

export function stripHiddenReasoning(text: string): string { return text.replace(HIDDEN, "").replace(/\n{3,}/g, "\n\n").trim(); }
export function assertSafeInput(value: string, field = "input"): void {
  if (!value.trim() || value.length > MAX_INPUT) throw new ContentSafetyError("safety", `${field}_length_invalid`);
  if (DANGEROUS.test(value)) throw new ContentSafetyError("safety", `${field}_unsafe`);
}
export function cleanSummary(value: unknown, maxLength = 1000): string {
  const text = stripHiddenReasoning(typeof value === "string" ? value : JSON.stringify(value ?? {}));
  if (/<think\b|chain[ -]?of[ -]?thought|hidden reasoning/i.test(text)) throw new ContentSafetyError("safety", "hidden_reasoning_rejected");
  return text.slice(0, maxLength);
}
export function validateDraft(draft: ResourceDraft, evidence: EvidenceBundle): void {
  if (!draft.title.trim() || !draft.summary.trim() || !isRecord(draft.content)) throw new ContentSafetyError("schema", "draft_content_invalid");
  const allowed = new Set(evidence.items.map((item) => item.chunkId));
  if (!draft.citations.length || draft.citations.some((id) => typeof id !== "string" || !allowed.has(id))) throw new ContentSafetyError("citation", "draft_citations_unverified");
  const text = JSON.stringify(draft);
  if (/<think\b|chain[ -]?of[ -]?thought|hidden reasoning/i.test(text)) throw new ContentSafetyError("safety", "hidden_reasoning_rejected");
}
export function validateEvidenceUrls(evidence: EvidenceBundle): void {
  for (const item of evidence.items) {
    if (!item.sourceId || !item.chunkId || !item.knowledgePointId || !item.sourceTitle) throw new ContentSafetyError("citation", "evidence_identifier_missing");
    if (item.sourceUrl) { try { const url = new URL(item.sourceUrl); if (!/^https?:$/.test(url.protocol)) throw new Error(); } catch { throw new ContentSafetyError("citation", "evidence_url_invalid"); } }
    if (item.license !== undefined && !item.license.trim()) throw new ContentSafetyError("citation", "evidence_license_invalid");
  }
}
