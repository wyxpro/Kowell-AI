/*
 * Run with: npx tsx scripts/import-ai-fundamentals.ts --dry-run
 * Required for writes: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 * The service key is never printed. Uses Supabase PostgREST with idempotent code/hash upserts.
 */
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type Json = Record<string, unknown>;
type Module = { code: string; title: string; knowledge_points: string[] };
type Course = { code: string; name: string; major: string; description: string; modules: Module[] };
type Exercise = { code: string; question_type: "single" | "multiple" | "subjective"; question: string; options: string[]; answer: string | string[]; explanation: string; difficulty: string; knowledge_point_codes: string[] };

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "data", "ai-fundamentals");
const dryRun = process.argv.includes("--dry-run");
const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const canonical = (value: unknown) => JSON.stringify(value);
const parseJson = <T>(value: string) => JSON.parse(value.replace(/^\uFEFF/, "")) as T;

function assertWriteConfig() {
  if (!dryRun && (!url || !serviceKey)) throw new Error("SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required unless --dry-run is used.");
}

async function request(table: string, method: string, body?: unknown, query = "") {
  if (dryRun) return [] as Json[];
  const response = await fetch(`${url}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} ${table} failed: ${response.status} ${await response.text()}`);
  return (await response.json()) as Json[];
}

async function one(table: string, query: string) {
  const rows = await request(table, "GET", undefined, `${query}${query.includes("?") ? "&" : "?"}limit=1`);
  return rows[0];
}

function splitMarkdown(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const chunks: { heading: string; content: string }[] = [];
  let heading = "导言";
  let buffer: string[] = [];
  const flush = () => {
    const content = buffer.join("\n").trim();
    if (content) chunks.push({ heading, content });
    buffer = [];
  };
  for (const line of lines) {
    if (line.startsWith("## ")) { flush(); heading = line.slice(3).trim(); } else buffer.push(line);
  }
  flush();
  return chunks;
}

async function main() {
  assertWriteConfig();
  const course = parseJson<Course>(await readFile(join(root, "course.json"), "utf8"));
  const sources = parseJson<Json[]>(await readFile(join(root, "sources.json"), "utf8"));
  const exerciseFiles = (await readdir(join(root, "exercises"))).filter((name) => name.endsWith(".json")).sort();
  const moduleTexts = new Map<string, string>();
  for (const module of course.modules) moduleTexts.set(module.code, await readFile(join(root, "modules", `${module.code}.md`), "utf8"));
  const exerciseSets = new Map<string, Exercise[]>();
  for (const file of exerciseFiles) exerciseSets.set(file.replace(/\.json$/, ""), parseJson<Exercise[]>(await readFile(join(root, "exercises", file), "utf8")));

  const chunks = [...moduleTexts.values()].flatMap(splitMarkdown);
  const exerciseCount = [...exerciseSets.values()].reduce((count, items) => count + items.length, 0);
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, course: course.code, modules: course.modules.length, knowledgePoints: course.modules.reduce((n, m) => n + m.knowledge_points.length, 0), documents: course.modules.length + sources.length, chunks: chunks.length, exercises: exerciseCount }, null, 2));
    return;
  }

  const courseRows = await request("courses?on_conflict=code", "POST", [{ code: course.code, name: course.name, major: course.major, description: course.description, chapters: course.modules.map((m, index) => ({ code: m.code, title: m.title, position: index + 1 })) }]);
  let courseRow = courseRows[0];
  if (!courseRow) courseRow = await one("courses", `?code=eq.${encodeURIComponent(course.code)}&select=id`);
  if (!courseRow?.id) throw new Error("Course upsert did not return an id.");
  const courseId = String(courseRow.id);

  const moduleIds = new Map<string, string>();
  for (let index = 0; index < course.modules.length; index++) {
    const module = course.modules[index];
    const text = moduleTexts.get(module.code)!;
    const rows = await request("course_modules?on_conflict=course_id,code", "POST", [{ course_id: courseId, code: module.code, title: module.title, summary: splitMarkdown(text)[0]?.content ?? "", position: index + 1, objectives: [], content_hash: hash(text) }]);
    const row = rows[0] ?? await one("course_modules", `?course_id=eq.${courseId}&code=eq.${encodeURIComponent(module.code)}&select=id`);
    if (!row?.id) throw new Error(`Module ${module.code} did not return an id.`);
    moduleIds.set(module.code, String(row.id));
  }

  const pointIds = new Map<string, string>();
  for (const module of course.modules) for (let index = 0; index < module.knowledge_points.length; index++) {
    const code = module.knowledge_points[index];
    const rows = await request("knowledge_points?on_conflict=course_id,code", "POST", [{ course_id: courseId, module_id: moduleIds.get(module.code), code, title: code, description: `课程 ${module.code} 的知识点 ${code}`, position: index + 1, content_hash: hash(`${module.code}:${code}`) }]);
    const row = rows[0] ?? await one("knowledge_points", `?course_id=eq.${courseId}&code=eq.${encodeURIComponent(code)}&select=id`);
    if (!row?.id) throw new Error(`Knowledge point ${code} did not return an id.`);
    pointIds.set(code, String(row.id));
  }

  for (const module of course.modules) {
    const text = moduleTexts.get(module.code)!;
    const sourceKey = `course-${module.code.toLowerCase()}`;
    const rows = await request("course_documents?on_conflict=course_id,source_key", "POST", [{ course_id: courseId, module_id: moduleIds.get(module.code), source_key: sourceKey, title: `${module.code} ${module.title} 原创讲义`, source_url: `https://eplay.local/course-materials/ai-fundamentals/modules/${module.code}.md`, license: "CC BY 4.0", accessed_at: "2026-08-10", content: text, content_hash: hash(text), metadata: { asset_type: "original_course_note" } }]);
    const doc = rows[0] ?? await one("course_documents", `?course_id=eq.${courseId}&source_key=eq.${sourceKey}&select=id`);
    if (!doc?.id) throw new Error(`Document ${module.code} did not return an id.`);
    const modulePointCodes = module.knowledge_points;
    for (const [chunkIndex, chunk] of splitMarkdown(text).entries()) {
      const matchedCode = modulePointCodes.find((code) => chunk.content.includes(code) || chunk.heading.includes(code));
      const knowledgePointCode = matchedCode ?? modulePointCodes[chunkIndex % modulePointCodes.length];
      const knowledgePointId = pointIds.get(knowledgePointCode);
      if (!knowledgePointId) throw new Error(`Chunk ${module.code}:${chunkIndex} has no knowledge point mapping.`);
      await request("course_document_chunks?on_conflict=document_id,chunk_index", "POST", [{ course_id: courseId, document_id: doc.id, module_id: moduleIds.get(module.code), knowledge_point_id: knowledgePointId, chunk_index: chunkIndex, heading: chunk.heading, content: chunk.content, content_hash: hash(`${chunk.heading}\n${chunk.content}`), metadata: { module_code: module.code, knowledge_point_code: knowledgePointCode } }]);
    }
  }

  for (const source of sources) {
    const key = String(source.key);
    await request("course_documents?on_conflict=course_id,source_key", "POST", [{ course_id: courseId, source_key: key, title: source.title, source_url: source.url, license: source.license, accessed_at: source.accessed_at, content: "", content_hash: hash(canonical(source)), metadata: { asset_type: "source_metadata", use: source.use } }]);
  }

  for (const [moduleCode, items] of exerciseSets) {
    for (const item of items) {
      const exerciseHash = hash(canonical(item));
      const exerciseRows = await request("exercises?on_conflict=code", "POST", [{ code: `${course.code}:${item.code}`, content_hash: exerciseHash, resource_id: null, question: `[${course.code}:${item.code}] ${item.question}`, options: item.options, answer: typeof item.answer === "string" ? item.answer : JSON.stringify(item.answer), explanation: item.explanation, difficulty: item.difficulty, question_type: item.question_type, category: course.code, tags: [moduleCode, item.code], ai_generated: false }]);
      const exercise = exerciseRows[0] ?? await one("exercises", `?code=eq.${encodeURIComponent(`${course.code}:${item.code}`)}&select=id`);
      if (!exercise?.id) throw new Error(`Exercise ${item.code} did not return an id.`);
      for (const pointCode of item.knowledge_point_codes) await request("exercise_knowledge_points?on_conflict=exercise_id,knowledge_point_id", "POST", [{ exercise_id: exercise.id, course_id: courseId, knowledge_point_id: pointIds.get(pointCode), weight: 1 }]);
    }
  }
  console.log(JSON.stringify({ imported: true, course: course.code, modules: course.modules.length, chunks: chunks.length, exercises: exerciseCount }, null, 2));
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
