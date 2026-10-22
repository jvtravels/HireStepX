/* Chain-level reliability math for the admin LLM panel.
 *
 * llm_usage logs every provider attempt, so a report that succeeded on the
 * second Gemini rung still leaves a timeout row behind. Counting those as
 * outages made a healthy system look broken. A failed attempt is "recovered"
 * when the same user got a successful call on the same endpoint family shortly
 * after; only unrecovered failures were ever user-facing. */

export interface LlmUsageAttempt {
  user_id: string | null;
  endpoint: string;
  status: string;
  latency_ms: number;
  created_at: string;
}

// Longest a report request runs end to end, plus slack for the user's own retry click.
export const RECOVERY_WINDOW_MS = 150_000;

/** evaluate-session-retry / -fast are tiers of the same user request. */
export function endpointFamily(endpoint: string): string {
  return endpoint.replace(/-(retry|fast|core|pq)$/, "");
}

const isFailure = (s: string) => s === "error" || s === "timeout";

/** For each failed attempt, whether a later success exists for the same user + endpoint family within the window. */
export function markRecovered<T extends LlmUsageAttempt>(rows: T[]): Array<T & { recovered: boolean }> {
  const successTimes = new Map<string, number[]>();
  for (const r of rows) {
    if (r.status !== "success") continue;
    const key = `${r.user_id ?? ""}|${endpointFamily(r.endpoint)}`;
    const list = successTimes.get(key);
    const t = Date.parse(r.created_at);
    if (list) list.push(t); else successTimes.set(key, [t]);
  }
  return rows.map((r) => {
    if (!isFailure(r.status)) return { ...r, recovered: false };
    const t = Date.parse(r.created_at);
    const hits = successTimes.get(`${r.user_id ?? ""}|${endpointFamily(r.endpoint)}`) ?? [];
    return { ...r, recovered: hits.some((s) => s >= t && s - t <= RECOVERY_WINDOW_MS) };
  });
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

/** p50/p95 of successful-call latency for one endpoint's rows. */
export function successLatency(rows: Array<{ status: string; latency_ms: number }>): { p50: number; p95: number } {
  const ms = rows.filter((r) => r.status === "success" && r.latency_ms > 0).map((r) => r.latency_ms).sort((a, b) => a - b);
  return { p50: percentile(ms, 50), p95: percentile(ms, 95) };
}
