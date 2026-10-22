/* Session / LLM cost + abuse caps — launch-blocker hardening (2026-05-14).
 *
 * Purpose: bound the worst-case LLM cost per session and per user so a
 * single anomalous client (runaway loop, abuse, scripted attack) can't
 * burn an unbounded number of tokens. Each cap below is calibrated to
 * the documented Indian-market session length (~12-25 turns) and a
 * working ceiling 2-3× above the 99th percentile.
 *
 * All helpers are PURE — no IO, no clocks, no provider calls. The
 * route handler reads/writes the session + per-user counters from
 * whatever backing store is wired (KV / Redis / Postgres); this module
 * only encodes the policy. */

/** Hard cap on a single candidate-turn input AFTER trimming. India-
 *  mobile STT can emit ~1.2 KB / 200 spoken words; we allow 8 KB which
 *  is well above realistic spoken-answer length but bounds copy-paste /
 *  scripted-abuse worst case. */
export const MAX_INPUT_CHARS = 8000;

/** Hard cap on turns per session. Real negotiations resolve in 12-25
 *  turns; 60 is 2-3× the long-tail. Past this the kernel is almost
 *  certainly looping. */
export const MAX_TURNS_PER_SESSION = 60;

/** Hard cap on turns per user per day. Even a power user re-running
 *  multiple sessions stays well below this; the cap is here as an
 *  abuse-detector backstop. */
export const MAX_TURNS_PER_USER_PER_DAY = 200;

/** Hard cap on LLM output tokens per call. The structured-envelope
 *  prompt asks for 1-3 sentences (≈80-120 tokens for the text plus
 *  ~100 for the JSON keys/role echoes). 800 is a generous ceiling that
 *  still bounds runaway streaming. */
export const MAX_OUTPUT_TOKENS = 800;

/** Truncate input to MAX_INPUT_CHARS, returning a flag so the caller
 *  can log the truncation event. Returns `{ text, truncated: false }`
 *  if the input is null/undefined/empty, normalising downstream
 *  handling. */
export function clampInput(text: string): { text: string; truncated: boolean } {
  if (typeof text !== "string" || text.length === 0) {
    return { text: "", truncated: false };
  }
  if (text.length <= MAX_INPUT_CHARS) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, MAX_INPUT_CHARS), truncated: true };
}

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
}

/** Returns `{ allowed: false }` when the session has hit the per-session
 *  turn ceiling. The handler should return a 429-equivalent error and
 *  stop folding the answer into state. */
export function checkSessionTurnLimit(turnCount: number): LimitCheckResult {
  if (!Number.isFinite(turnCount) || turnCount < 0) {
    /* Defensive — corrupted counters are treated as "block" rather than
     * silently letting traffic through. */
    return { allowed: false, reason: "invalid-turn-count" };
  }
  if (turnCount >= MAX_TURNS_PER_SESSION) {
    return { allowed: false, reason: "session-turn-cap" };
  }
  return { allowed: true };
}

/** Returns `{ allowed: false }` when the user has hit the per-day
 *  turn ceiling. Same shape as checkSessionTurnLimit. */
export function checkUserDailyLimit(turnsToday: number): LimitCheckResult {
  if (!Number.isFinite(turnsToday) || turnsToday < 0) {
    return { allowed: false, reason: "invalid-day-count" };
  }
  if (turnsToday >= MAX_TURNS_PER_USER_PER_DAY) {
    return { allowed: false, reason: "user-daily-cap" };
  }
  return { allowed: true };
}

export interface TurnUsageRecord {
  sessionId: string;
  userId?: string | null;
  inputChars: number;
  outputTokens?: number | null;
  latencyMs?: number | null;
  /* 2026-05-14 — token / cost telemetry. inputTokens + outputTokens are
   * accepted explicitly when the caller has a real tokenizer reading;
   * otherwise estimateTokens() approximates from char count. costInr
   * is computed from a placeholder per-token rate (Groq pricing is the
   * working assumption). injectionDetected is surfaced so the cost log
   * doubles as an abuse signal. */
  inputTokens?: number | null;
  injectionDetected?: boolean;
  /* Optional raw input/output text — when provided we estimate the
   * token count from `Math.ceil(text.length / 4)` if no real
   * tokenization was performed upstream. Not retained in the log. */
  inputText?: string | null;
  outputText?: string | null;
  /* A/B prompt variant attribution (2026-05-14). Surfaced so the
   * structured-usage log can be joined to PostHog A/B-experiment
   * aggregates. Optional — non-A/B paths leave this null. */
  promptVariant?: "control" | "variant-a" | "variant-b" | null;
}

import { countTokens } from "./_tokenizer";

/** Approximate token count. Back-compat alias — delegates to the
 *  unified `countTokens` helper in _tokenizer.ts which combines a
 *  char-based lower bound (ceil(len/4)) with a whitespace-aware upper
 *  bound (words * 1.3) and takes their max. Pure. */
export function estimateTokens(text: string | null | undefined): number {
  return countTokens(text);
}

/** Placeholder Groq pricing — used purely as a cost-attribution signal
 *  in the log. The dollar/INR conversion + per-model rate live in
 *  product analytics; this constant just keeps the per-turn order of
 *  magnitude visible in stdout. */
export const GROQ_INPUT_RATE_INR_PER_TOKEN = 0.000005;
export const GROQ_OUTPUT_RATE_INR_PER_TOKEN = 0.00001;

export function estimateCostInr(inputTokens: number, outputTokens: number): number {
  const inT = Math.max(0, Number.isFinite(inputTokens) ? inputTokens : 0);
  const outT = Math.max(0, Number.isFinite(outputTokens) ? outputTokens : 0);
  return inT * GROQ_INPUT_RATE_INR_PER_TOKEN + outT * GROQ_OUTPUT_RATE_INR_PER_TOKEN;
}

/** Fire-and-forget structured usage logger. Writes one line to stdout
 *  in JSON form so the platform log pipeline (Vercel / Datadog / etc.)
 *  can ingest it without an extra HTTP hop. Errors are swallowed — a
 *  failed log MUST NOT break the request path.
 *
 *  2026-05-14: also emits a PostHog `turn_usage` event when the
 *  project's _posthog helper is reachable; otherwise the structured
 *  stdout line is the only artefact. Cost + token counts are derived
 *  from the explicit fields, or estimated from inputText/outputText. */
export function logTurnUsage(record: TurnUsageRecord): void {
  try {
    /* Token counts: explicit > derived from text > derived from char
     * count (input only). For OUTPUT we preserve null when no signal
     * exists so callers that only set inputChars don't see a fabricated
     * "0 output tokens" — the existing log shape contract surfaces
     * outputTokens=null in that case. */
    const inputTokens: number =
      record.inputTokens != null
        ? record.inputTokens
        : record.inputText != null
        ? estimateTokens(record.inputText)
        : record.inputChars > 0
        ? Math.ceil(record.inputChars / 4)
        : 0;
    const outputTokens: number | null =
      record.outputTokens != null
        ? record.outputTokens
        : record.outputText != null
        ? estimateTokens(record.outputText)
        : null;
    const costInr = estimateCostInr(inputTokens, outputTokens ?? 0);
    const payload = {
      kind: "kernel_turn_usage",
      ts: Date.now(),
      sessionId: record.sessionId ? `${String(record.sessionId).slice(0, 8)}…` : null,
      userId: record.userId ? `${String(record.userId).slice(0, 8)}…` : null,
      inputChars: record.inputChars,
      inputTokens,
      outputTokens,
      costInr,
      latencyMs: record.latencyMs ?? null,
      injectionDetected: record.injectionDetected === true,
      promptVariant: record.promptVariant ?? null,
    };
    /* eslint-disable-next-line no-console */
    console.log(JSON.stringify(payload));
  } catch {
    /* swallow — logging must never throw */
  }
}
