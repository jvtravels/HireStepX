/* TTS provider-usage telemetry.
 *
 * Audit finding: the 4-tier TTS chain (Sarvam → Cartesia WS → Cartesia REST
 * → Azure → Browser) has no per-session cost emission. Cartesia/Azure cost
 * 5–10× Sarvam; if Sarvam quota is hit mid-interview every question silently
 * falls through to the expensive path with no signal in PostHog.
 *
 * This helper exposes a tiny attempt-tracker the orchestrator (speak() /
 * speakAs() in tts.ts) wraps around each fallback tier so we can emit one
 * `tts_provider_used` event per spoken utterance containing:
 *   - winner: the provider that ultimately served audio
 *   - attempted: ordered list of tiers tried before the winner
 *   - latencyMs: time from speak() entry to first audio (onAudioStarted)
 *   - textLength: char count of the spoken text (cost proxy)
 *   - voiceId / gender for downstream voice-quality analysis
 *
 * Pure, side-effect-free except for the PostHog capture, which is itself
 * never-throw. Unit-tested via `_ttsTelemetry.test.ts`.
 */

import { captureClientEvent } from "./posthogClient";

export type TtsTier = "sarvam" | "cartesia-ws" | "cartesia-rest" | "azure" | "browser";

export interface TtsAttempt {
  startedAt: number;
  textLength: number;
  voiceId?: string;
  gender?: "male" | "female";
  attempted: TtsTier[];
  winner: TtsTier | null;
  firstAudioAt: number | null;
  finalized: boolean;
}

export function startTtsAttempt(opts: {
  text: string;
  voiceId?: string;
  gender?: "male" | "female";
}): TtsAttempt {
  return {
    startedAt: Date.now(),
    textLength: (opts.text || "").length,
    voiceId: opts.voiceId,
    gender: opts.gender,
    attempted: [],
    winner: null,
    firstAudioAt: null,
    finalized: false,
  };
}

/** Record that we're about to try this tier (in order). Idempotent per tier. */
export function recordTtsAttempt(attempt: TtsAttempt, tier: TtsTier): void {
  if (attempt.attempted[attempt.attempted.length - 1] === tier) return;
  attempt.attempted.push(tier);
}

/** Record the tier whose audio the user actually heard. First-call wins —
 *  later calls are no-ops so the winner can't be overwritten by a stale
 *  fallback firing after success. */
export function recordTtsAudioStarted(attempt: TtsAttempt, tier: TtsTier): void {
  if (attempt.winner !== null) return;
  attempt.winner = tier;
  attempt.firstAudioAt = Date.now();
  recordTtsAttempt(attempt, tier);
}

/** Finalize and emit. Safe to call multiple times — first call wins. */
export function finalizeTtsAttempt(
  attempt: TtsAttempt,
  outcome: "ok" | "error" | "cancelled",
): void {
  if (attempt.finalized) return;
  attempt.finalized = true;

  const now = Date.now();
  const latencyMs = attempt.firstAudioAt !== null ? attempt.firstAudioAt - attempt.startedAt : null;
  const totalMs = now - attempt.startedAt;

  captureClientEvent("tts_provider_used", {
    outcome,
    winner: attempt.winner ?? "none",
    attempted: attempt.attempted.join(">"),
    fallbackHops: Math.max(0, attempt.attempted.length - 1),
    latencyMs: latencyMs ?? -1,
    totalMs,
    textLength: attempt.textLength,
    voiceId: attempt.voiceId ?? "default",
    gender: attempt.gender ?? "unspecified",
  });
}
