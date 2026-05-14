/* A/B system-prompt variant harness (2026-05-14).
 * ─────────────────────────────────────────────────────────────────────
 * Routes each negotiation session into one of three buckets and
 * transforms the system prompt accordingly. Bucket selection is a
 * deterministic hash of `sessionId` so the same session always sees the
 * same variant — critical for telemetry attribution and for the
 * idempotency cache replay to return byte-identical responses.
 *
 * Variants:
 *   control   — pass-through.
 *   variant-a — concise + verbatim-quote rule.
 *   variant-b — warmer / mentoring tone.
 *
 * Env override: HSX_FORCE_PROMPT_VARIANT=control|variant-a|variant-b
 * pins all traffic to one bucket. QA / incident-response uses this to
 * disable a misbehaving variant without redeploying. */

declare const process: { env: Record<string, string | undefined> };

export type PromptVariant = "control" | "variant-a" | "variant-b";

const ALL_VARIANTS: ReadonlyArray<PromptVariant> = ["control", "variant-a", "variant-b"];

function isPromptVariant(v: string | undefined): v is PromptVariant {
  return v === "control" || v === "variant-a" || v === "variant-b";
}

/** djb2-style 32-bit hash. We only need 2 bits of usable entropy
 *  (mod-3) so a simple non-cryptographic mixer is plenty. Pure. */
function hashSessionId(sessionId: string): number {
  let h = 5381;
  for (let i = 0; i < sessionId.length; i++) {
    h = (((h << 5) + h) ^ sessionId.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Deterministic 33/33/33 split over sessionId. Env override wins. */
export function selectPromptVariant(sessionId: string | null | undefined): PromptVariant {
  const forced = process?.env?.HSX_FORCE_PROMPT_VARIANT;
  if (isPromptVariant(forced)) return forced;
  if (!sessionId || typeof sessionId !== "string") return "control";
  const idx = hashSessionId(sessionId) % 3;
  return ALL_VARIANTS[idx];
}

const VARIANT_A_PREFIX =
  "Be more concise. Quote the candidate verbatim at least once per turn.\n\n";
const VARIANT_B_PREFIX =
  "Use a warmer, mentoring tone. Avoid jargon and speak like a senior peer.\n\n";

/** Apply the variant-specific transformation to a base system prompt. */
export function getSystemPrompt(variant: PromptVariant, basePrompt: string): string {
  if (variant === "variant-a") return VARIANT_A_PREFIX + basePrompt;
  if (variant === "variant-b") return VARIANT_B_PREFIX + basePrompt;
  return basePrompt;
}
