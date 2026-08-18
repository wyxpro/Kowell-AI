import { cleanSummary } from "./content-safety.ts";

export class ModelProviderError extends Error { constructor(public readonly code: string, message: string) { super(message); } }
export interface ModelMessage { role: "system" | "user" | "assistant"; content: string; }
function config() {
  const key = Deno.env.get("STEP_API_KEY") ?? Deno.env.get("INTEGRATIONS_API_KEY");
  const url = Deno.env.get("STEPFUN_API_URL") ?? Deno.env.get("STEP_API_URL");
  const model = Deno.env.get("STEPFUN_MODEL") ?? "step-3.5-flash";
  if (!key || !url) throw new ModelProviderError("model_not_configured", "model_not_configured");
  return { key, url: url.replace(/\/$/, ""), model };
}
function endpoint(url: string): string { return /\/chat\/completions$/.test(url) ? url : `${url}/chat/completions`; }
async function request(messages: ModelMessage[], signal?: AbortSignal, jsonMode = false): Promise<string> {
  const { key, url, model } = config();
  const timeout = AbortSignal.timeout(55_000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response;
  try { response = await fetch(endpoint(url), { method: "POST", signal: combined, headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` }, body: JSON.stringify({ model, messages, stream: false, temperature: 0.2, response_format: jsonMode ? { type: "json_object" } : undefined, thinking: { type: "disabled" } }) }); }
  catch (error) { throw new ModelProviderError("model_network_error", error instanceof Error && error.name === "TimeoutError" ? "model_timeout" : "model_request_failed"); }
  if (!response.ok) throw new ModelProviderError("model_upstream_error", `model_upstream_${response.status}`);
  let body: unknown; try { body = await response.json(); } catch { throw new ModelProviderError("model_protocol_error", "model_response_not_json"); }
  const content = (body as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new ModelProviderError("model_protocol_error", "model_content_missing");
  return cleanSummary(content, 80_000);
}
export async function generateText(messages: ModelMessage[], signal?: AbortSignal): Promise<string> { return request(messages, signal, false); }
export async function generateStructured<T>(messages: ModelMessage[], validate: (value: unknown) => T, signal?: AbortSignal): Promise<T> {
  const content = await request(messages, signal, true);
  let parsed: unknown; try { parsed = JSON.parse(content); } catch { const match = content.match(/\{[\s\S]*\}/); try { parsed = JSON.parse(match?.[0] ?? ""); } catch { throw new ModelProviderError("model_json_invalid", "model_structured_parse_failed"); } }
  try { return validate(parsed); } catch { throw new ModelProviderError("model_schema_invalid", "model_structured_schema_failed"); }
}
export async function review(messages: ModelMessage[], signal?: AbortSignal): Promise<string> { return request(messages, signal, true); }
