import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type EvidenceBundle, type EvidenceItem, isRecord } from "./agent-contracts.ts";
import { validateEvidenceUrls } from "./content-safety.ts";

export async function retrieveCourseKnowledge(client: SupabaseClient, courseId: string, query: string, limit = 12): Promise<EvidenceBundle> {
  if (!courseId || !query.trim()) throw new Error("knowledge_query_invalid");
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 20));
  const { data, error } = await client.rpc("search_course_knowledge", { p_course_id: courseId, p_query: query.slice(0, 4000), p_limit: safeLimit });
  if (error || !Array.isArray(data)) throw new Error("knowledge_retrieval_failed");
  const chunks = data.flatMap((row) => isRecord(row) && typeof row.chunk_id === "string" && typeof row.document_id === "string" && typeof row.knowledge_point_id === "string" && typeof row.content === "string" ? [{ chunkId: row.chunk_id, sourceId: row.document_id, knowledgePointId: row.knowledge_point_id, excerpt: row.content.slice(0, 4000), relevance: typeof row.rank === "number" ? row.rank : 0 }] : []);
  if (!chunks.length) throw new Error("knowledge_evidence_missing");
  const documentIds = [...new Set(chunks.map((item) => item.sourceId))];
  const documents = await client.from("course_documents").select("id,title,source_url,license").eq("course_id", courseId).in("id", documentIds);
  if (documents.error) throw new Error("knowledge_source_lookup_failed");
  const sources = new Map((documents.data ?? []).map((row: { id: string; title: string; source_url: string; license: string }) => [row.id, row]));
  const items: EvidenceItem[] = [];
  for (const chunk of chunks) { const source = sources.get(chunk.sourceId); if (!source) continue; items.push({ knowledgePointId: chunk.knowledgePointId, chunkId: chunk.chunkId, sourceId: chunk.sourceId, sourceTitle: source.title, sourceUrl: source.source_url, license: source.license, excerpt: chunk.excerpt, relevance: chunk.relevance }); }
  if (!items.length) throw new Error("knowledge_evidence_missing"); const bundle = { courseId, query: query.slice(0, 4000), items }; validateEvidenceUrls(bundle); return bundle;
}
