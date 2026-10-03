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
  /** Blended (in+out) USD per million tokens for calls logged with
   *  is_fallback=false. Since Gemini became primary for big/slow calls,
   *  this bucket mixes Gemini (slow-path primary) and Groq (fast-path
   *  primary) token volume — see the rate derivation note below. */
  llmUsdPerMToken: number;
  /** Blended USD per million tokens for calls logged with is_fallback=true
   *  (mixes Gemini fast-path fallback and Groq slow-path fallback). */
  llmFallbackUsdPerMToken: number;
  /** USD per million characters, TTS — primary provider (Sarvam bulbul:v3). */
  ttsUsdPerMChar: number;
  /** USD per STT session. Estimate: avg session minutes × per-minute rate. */
  sttUsdPerCall: number;
  /** USD → INR. Set to roughly today's spot before trusting the rupee. */
  usdToInr: number;
}

/** Defaults: public list rates as of 2026-10-03. VERIFY before locking price.
 *
 * Both LLM numbers below are volume-weighted blends, not a single model's
 * rate — re-derive the weights from llm_usage/PostHog model-volume mix
 * whenever the provider chain or call-routing (fast vs slow) changes
 * materially, not just when a vendor reprices:
 *  - llmUsdPerMToken (is_fallback=false, last 7d mix ~84% Gemini 3.5
 *    Flash-Lite slow-path-primary @ $0.30 in/$2.50 out ≈ $1.40/M avg,
 *    ~16% Groq GPT-OSS 20B fast-path-primary @ $0.075 in/$0.30 out ≈
 *    $0.1875/M avg) → weighted ≈ $1.20/M.
 *  - llmFallbackUsdPerMToken (is_fallback=true, ~97% Gemini fast-path
 *    fallback ≈ $1.40/M, ~3% Groq GPT-OSS 120B slow-path fallback @
 *    $0.15 in/$0.60 out ≈ $0.375/M avg) → weighted ≈ $1.37/M.
 * The previous constants (0.7 / 0.3) predated Gemini becoming primary for
 * slow calls and modeled Gemini at its input-only price, undercounting its
 * real (output-heavy) blended cost by ~4-5x on the fallback bucket. */
export const DEFAULT_COST_RATES: CostRates = {
  llmUsdPerMToken: 1.2,
  llmFallbackUsdPerMToken: 1.37,
  // Sarvam bulbul:v3 (primary TTS as of Aug 2026 migration): ₹30/10K chars
  // = ₹3000/1M chars ≈ $35.71/1M @ usdToInr below. bulbul:v2 was ₹15/10K
  // (~$16.7/1M, coincidentally close to the old Azure-list-price placeholder
  // this constant used to carry) — update this alongside any future Sarvam
  // model/price change so the credit guardrail (_sarvam-credit-guard.ts)
  // and admin cost dashboard don't quietly under-count real spend.
  ttsUsdPerMChar: 35.71,
  sttUsdPerCall: 0.0077, // ≈ 1.8 min avg × $0.0043/min (Deepgram Nova) — rough
  usdToInr: 84,
};

/** ISO date DEFAULT_COST_RATES was last deliberately checked against a real
 * provider price signal — bump this (alongside the rate itself) whenever a
 * rate changes for a KNOWN reason, e.g. the bulbul:v2→v3 migration above.
 * Read by the admin health-alert staleness check (admin-data.ts) so a quiet
 * vendor repricing or expired volume-discount tier the team never hears
 * about doesn't go unnoticed indefinitely — see RATE_STALENESS_THRESHOLD_DAYS. */
export const RATES_LAST_VERIFIED_AT = "2026-10-03";

/** Days after which an unconfirmed rate card is flagged stale. */
export const RATE_STALENESS_THRESHOLD_DAYS = 45;

export function rateCardAgeDays(now: number = Date.now()): number {
  const verified = new Date(RATES_LAST_VERIFIED_AT).getTime();
  return Math.max(0, Math.floor((now - verified) / 86_400_000));
}

export function isRateCardStale(now: number = Date.now()): boolean {
  return rateCardAgeDays(now) > RATE_STALENESS_THRESHOLD_DAYS;
}

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
