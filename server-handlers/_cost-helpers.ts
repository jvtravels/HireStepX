/* Marginal-cost + virality math for the admin dashboard.
 *
 * Pure functions only — no I/O — so the rupee-per-session number the pricing
 * decision hinges on is unit-tested rather than hand-waved. The caller
 * (admin-data.ts getOverview) fetches the aggregates from `llm_usage` +
 * `service_usage` and feeds them in.
 *
 * RATES ARE LIST ESTIMATES. They are the best public rate-card figures, not
 * billed amounts — reconcile against real Groq/Azure/Deepgram invoices before
 * betting price on the absolute number. The *shape* (LLM cheap, voice dominant)
 * is robust; the exact rupee is not. STT is the weakest input: we log only
 * token-issuance calls, not minutes, so its cost is calls × an assumed average
 * session length. See `stt_listening_seconds` (client telemetry) for the real
 * per-turn seconds once analytics ingestion is live. */

export interface CostRates {
  /** Blended (in+out) USD per million tokens, primary LLM (Groq Llama-class). */
  llmUsdPerMToken: number;
  /** Blended USD per million tokens, fallback LLM (Gemini Flash). */
  llmFallbackUsdPerMToken: number;
  /** USD per million characters, TTS (Azure/Cartesia/Sarvam ~ same order). */
  ttsUsdPerMChar: number;
  /** USD per STT session. Estimate: avg session minutes × per-minute rate. */
  sttUsdPerCall: number;
  /** USD → INR. Set to roughly today's spot before trusting the rupee. */
  usdToInr: number;
}

/** Defaults: public list rates as of mid-2026. VERIFY before locking price. */
export const DEFAULT_COST_RATES: CostRates = {
  llmUsdPerMToken: 0.7, // Groq Llama 3.3 70B, blended ~$0.59 in / $0.79 out
  llmFallbackUsdPerMToken: 0.3, // Gemini 2.x Flash, blended
  ttsUsdPerMChar: 16, // Azure Standard $16 / 1M chars (Cartesia/Sarvam comparable)
  sttUsdPerCall: 0.0077, // ≈ 1.8 min avg × $0.0043/min (Deepgram Nova) — rough
  usdToInr: 84,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function llmInr(tokens: number, fallback: boolean, rates: CostRates = DEFAULT_COST_RATES): number {
  const usdPerM = fallback ? rates.llmFallbackUsdPerMToken : rates.llmUsdPerMToken;
  return (Math.max(0, tokens) / 1_000_000) * usdPerM * rates.usdToInr;
}

export function ttsInr(chars: number, rates: CostRates = DEFAULT_COST_RATES): number {
  return (Math.max(0, chars) / 1_000_000) * rates.ttsUsdPerMChar * rates.usdToInr;
}

export function sttInr(calls: number, rates: CostRates = DEFAULT_COST_RATES): number {
  return Math.max(0, calls) * rates.sttUsdPerCall * rates.usdToInr;
}

export interface CostInputs {
  /** Total `llm_usage.total_tokens` over the window from the primary provider. */
  llmTokensPrimary: number;
  /** Total tokens from the fallback (is_fallback = true) provider. */
  llmTokensFallback: number;
  /** Sum of `service_usage.request_chars` for TTS services over the window. */
  ttsChars: number;
  /** Count of STT token-issuance calls over the window. */
  sttCalls: number;
  /** Completed `sessions` rows over the same window (the divisor). */
  sessions: number;
}

export interface CostBreakdown {
  llmInr: number;
  ttsInr: number;
  sttInr: number;
  totalInr: number;
  /** totalInr / sessions, or 0 when no sessions in window. */
  perSessionInr: number;
  sessions: number;
}

/** Roll a window's raw usage into a rupee breakdown + the headline per-session. */
export function costBreakdown(input: CostInputs, rates: CostRates = DEFAULT_COST_RATES): CostBreakdown {
  const llm = llmInr(input.llmTokensPrimary, false, rates) + llmInr(input.llmTokensFallback, true, rates);
  const tts = ttsInr(input.ttsChars, rates);
  const stt = sttInr(input.sttCalls, rates);
  const total = llm + tts + stt;
  const sessions = Math.max(0, Math.floor(input.sessions));
  return {
    llmInr: round2(llm),
    ttsInr: round2(tts),
    sttInr: round2(stt),
    totalInr: round2(total),
    perSessionInr: sessions > 0 ? round2(total / sessions) : 0,
    sessions,
  };
}

/**
 * Viral coefficient: referred signups produced per active user over a window.
 * K > 1 = self-sustaining growth; the doc targets > 0.3 as a healthy loop.
 * Returns 0 when there are no active users (undefined ratio, not Infinity).
 */
export function kFactor(referredSignups: number, activeUsers: number): number {
  if (activeUsers <= 0) return 0;
  return Math.round((Math.max(0, referredSignups) / activeUsers) * 1000) / 1000;
}
