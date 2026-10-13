/* Pre-emptive provider limits.
 *
 * Free-tier quotas are small and known: Gemini ~20 requests/day per model,
 * Groq 8,000 tokens/minute per model, Cloudflare Workers AI 10,000 neurons/day.
 * Waiting for a 429 costs every unlucky user a wasted round trip, so usage is
 * counted in Redis and a provider that is already spent is skipped up front.
 * Every limit is an env var; 0 disables it (set that once billing is enabled).
 * All reads fail open: no Redis means no information, never a skipped provider. */

declare const process: { env: Record<string, string | undefined> };

export const DEFAULT_GEMINI_DAILY_CALLS = 20;
/** Free-tier requests/day read from AI Studio's Rate Limit page (2026-10-15). Models not listed get the default. */
export const GEMINI_DAILY_CALLS_BY_MODEL: Readonly<Record<string, number>> = {
  "gemini-3.5-flash-lite": 500,
  "gemini-3.1-flash-lite": 500,
};
export const DEFAULT_CLOUDFLARE_DAILY_NEURONS = 10_000;
export const GROQ_TPM_CAP = 8000;
export const GROQ_TPM_SAFETY_MARGIN = 400;

const DAY_MS = 86_400_000;
const GEMINI_RESET_HOUR_UTC = 8;
const NEURONS_PER_TOKEN = 0.056;

export function parseLimit(raw: string | undefined, fallback: number): number {
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/** GEMINI_DAILY_CALL_LIMIT, when set, applies to every model; otherwise the per-model free-tier default. */
export const geminiDailyLimit = (model?: string, raw = process.env.GEMINI_DAILY_CALL_LIMIT): number =>
  parseLimit(raw, (model && GEMINI_DAILY_CALLS_BY_MODEL[model]) || DEFAULT_GEMINI_DAILY_CALLS);
export const cloudflareDailyLimit = (raw = process.env.CLOUDFLARE_DAILY_NEURON_LIMIT): number => parseLimit(raw, DEFAULT_CLOUDFLARE_DAILY_NEURONS);

/** Gemini's free-tier day rolls over at midnight Pacific; 08:00 UTC is used so a
 *  rung is never counted into the wrong day. */
export function geminiDayKey(model: string, now = Date.now()): string {
  const day = Math.floor((now - GEMINI_RESET_HOUR_UTC * 3_600_000) / DAY_MS);
  return `llm_lim:g:${model}:${day}`;
}

export function cloudflareDayKey(now = Date.now()): string {
  return `llm_lim:cf:${Math.floor(now / DAY_MS)}`;
}

export function groqMinuteKey(model: string, now = Date.now()): string {
  return `llm_lim:groq:${model}:${Math.floor(now / 60_000)}`;
}

export const LIMIT_KEY_TTL_SEC = { gemini: 26 * 3600, cloudflare: 26 * 3600, groq: 120 } as const;

/** Completion tokens that still fit under the per-minute cap. The estimator
 *  undercounts dense text, so the margin scales with prompt size. */
export function groqAvailableCompletion(promptTokens: number): number {
  return GROQ_TPM_CAP - GROQ_TPM_SAFETY_MARGIN - Math.ceil(promptTokens * 0.1) - promptTokens;
}

/** Tokens Groq will count for this call: prompt plus the completion allowance.
 *  Null when the prompt leaves no usable completion room (Groq is skipped). */
export function groqReservation(promptTokens: number, requestedMaxTokens: number, minCompletionTokens: number): { maxTokens: number; reserved: number } | null {
  const available = groqAvailableCompletion(promptTokens);
  if (available < minCompletionTokens) return null;
  const maxTokens = Math.min(requestedMaxTokens, available);
  return { maxTokens, reserved: promptTokens + maxTokens };
}

export function groqMinuteWouldExceed(used: number, reserved: number, cap = GROQ_TPM_CAP): boolean {
  return cap > 0 && used + reserved > cap;
}

export function cloudflareNeuronsFor(usage: { neurons?: number; total_tokens?: number } | undefined): number {
  if (typeof usage?.neurons === "number" && usage.neurons >= 0) return Math.ceil(usage.neurons);
  return Math.ceil((usage?.total_tokens ?? 0) * NEURONS_PER_TOKEN);
}

/** Cloudflare is spent once fewer neurons remain than one typical call costs. */
export function cloudflareSpent(used: number, limit = cloudflareDailyLimit()): boolean {
  return limit > 0 && used >= limit - 300;
}

export function geminiSpent(used: number, limit = DEFAULT_GEMINI_DAILY_CALLS): boolean {
  return limit > 0 && used >= limit;
}
