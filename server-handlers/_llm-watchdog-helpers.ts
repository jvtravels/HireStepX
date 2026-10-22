/* Pure helpers for the daily LLM model watchdog (see llm-model-watchdog.ts). */

/** Model ids with a published retirement/deprecation. Flagged if ever configured. */
export const KNOWN_RETIRING: Record<string, string> = {
  "gemini-3.1-flash-lite": "shuts down 2027-05-07",
  "gemini-3.5-flash": "deprecated, routes to gemini-3.6-flash",
  "llama-3.1-8b-instant": "shut down 2026-08-16",
  "llama-3.3-70b-versatile": "shut down 2026-08-16",
};

export type ModelStatus = "ok" | "busy" | "missing" | "retiring" | "error";

export interface ModelReport {
  provider: "gemini" | "groq" | "cloudflare";
  model: string;
  status: ModelStatus;
  detail?: string;
}

export function normalizeModelId(id: string): string {
  return id.replace(/^models\//, "");
}

/** Missing from the vendor's own model list is the strongest retirement signal. */
export function isListed(model: string, listed: Iterable<string>): boolean {
  const want = normalizeModelId(model);
  for (const id of listed) if (normalizeModelId(id) === want) return true;
  return false;
}

/** Probe outcome → status. 404 = gone; 429/5xx/timeouts = capacity, not retirement. */
export function classifyProbe(httpStatus: number | null): ModelStatus {
  if (httpStatus === null) return "busy";
  if (httpStatus >= 200 && httpStatus < 300) return "ok";
  if (httpStatus === 404) return "missing";
  if (httpStatus === 429 || httpStatus >= 500) return "busy";
  return "error";
}

export function buildReport(
  provider: ModelReport["provider"],
  model: string,
  listed: Set<string> | null,
  probeStatus: number | null | undefined,
): ModelReport {
  const retiring = KNOWN_RETIRING[normalizeModelId(model)];
  if (retiring) return { provider, model, status: "retiring", detail: retiring };
  if (listed && !isListed(model, listed)) return { provider, model, status: "missing", detail: "not in the vendor model list" };
  if (probeStatus === undefined) return { provider, model, status: "ok" };
  const status = classifyProbe(probeStatus);
  return { provider, model, status, detail: probeStatus === null ? "probe timed out" : `probe HTTP ${probeStatus}` };
}

/** Anything that needs a human: retirement, removal, or a rejected request. */
export const needsAction = (r: ModelReport): boolean => r.status === "missing" || r.status === "retiring" || r.status === "error";

/** The chain has no safety margin when fewer than two Gemini models answer. */
export function ladderIsThin(reports: ModelReport[]): boolean {
  return reports.filter((r) => r.provider === "gemini" && r.status === "ok").length < 2;
}
