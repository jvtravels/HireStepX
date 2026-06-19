/* Per-session scenario seed — repeat-session freshness (2026-06-20).
 *
 * The deterministic kernel is, by design, deterministic: identical
 * (role, company, candidate inputs) reproduce an identical band, flow,
 * and numbers. That is correct for economic realism — the market band
 * for "Razorpay PM" does not change because the same user practised
 * twice — but it is exactly what makes a RETURNING user feel the bot is
 * "the same every time, not personalised". The user reported precisely
 * this.
 *
 * The fix is structural and input-only: vary the recruiter the user
 * faces ACROSS sessions without touching the kernel's move-selection or
 * band math. `recruiterPersona` (the tone axis — hardline / consultative
 * / founder / agency) was already a first-class `initState` input that
 *   1. sets the LLM's entire voice via PERSONA_HINTS (the FIRST prompt
 *      hint), and
 *   2. modulates band economics through the invariant-clamped
 *      `applyPersonaToBand`.
 * …but `negotiate-turn.ts` never passed it, so every session for every
 * user ran the single hardwired "consultative" tone. Rotating that one
 * axis turns four genuinely different recruiters loose on the same band.
 *
 * This module is the single source of truth for that rotation. It is
 * pure (no IO): the caller reads the user's prior negotiation count from
 * the DB and hands it in. Rotation is keyed on
 * (userId, priorNegotiationCount) so:
 *   - consecutive sessions never draw the same tone (we step the index
 *     by exactly 1 each session — a full cycle before any repeat);
 *   - two different users on their first session don't both get tone[0]
 *     (a stable per-user offset de-syncs them);
 *   - the same (userId, count) is reproducible (frozen into state at
 *     init, so a session never changes recruiter mid-conversation).
 *
 * Tone choices are constrained to what is plausible for the company
 * tier — a PSU recruiter is never a startup "founder", an in-house GCC
 * TA is never an external commission "agency" — so freshness never
 * costs realism.
 */
import type { RecruiterPersona, SessionDifficulty } from "./_negotiation-kernel";
import type { CompanyTierBucket } from "../src/_negotiation-math";

export interface ScenarioSeedInput {
  /** Authenticated user id, or null for anonymous / dev sessions. */
  userId: string | null;
  /** Count of this user's prior salary-negotiation sessions (>= 0). */
  priorNegotiationCount: number;
  /** Company tier bucket, used to constrain plausible recruiter tones. */
  tierBucket: CompanyTierBucket | null;
}

export interface ScenarioSeed {
  /** The recruiter tone axis to run this session. */
  recruiterPersona: RecruiterPersona;
  /** Coarse progression label, escalating with experience. Wired into the
   *  kernel via applyDifficultyToBand (modulates recruiter posture —
   *  maxStretch / walkAway — never the pinned market anchor). */
  difficulty: SessionDifficulty;
  /** The rotation index actually used (for telemetry / debugging). */
  rotationIndex: number;
}

/* Tiny FNV-1a — mirrors `_session-jitter.ts`. Duplicated rather than
 * shared to avoid a dependency edge pointing the wrong way. */
function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* Tones plausible for a given tier, ordered gentlest → hardest so the
 * rotation reads as a coherent spread rather than a random jumble.
 *
 *   - consultative : universal baseline (a transparent hiring manager
 *                    exists in every sector).
 *   - agency       : external commission recruiters — common in
 *                    IT-services staffing and high-volume growth-startup
 *                    hiring; NOT how in-house GCC / BFSI / PSU / FMCG /
 *                    unicorn TA operates.
 *   - founder      : an actual founder/CEO at the table — only credible
 *                    at early / growth startups.
 *   - hardline     : an aggressive in-house TA — credible everywhere,
 *                    and the right "formal & rigid" read for PSU / BFSI.
 *
 * Every tier returns at least two tones, so consecutive sessions always
 * change recruiter. */
export function compatibleTones(tier: CompanyTierBucket | null): RecruiterPersona[] {
  switch (tier) {
    case "early_startup":
      return ["consultative", "founder", "hardline"];
    case "growth_startup":
      return ["consultative", "agency", "founder", "hardline"];
    case "it_services":
      return ["consultative", "agency", "hardline"];
    case "listed_big_tech":
    case "listed_unicorn":
    case "mature_unicorn":
    case "bfsi":
    case "fmcg":
    case "psu":
      return ["consultative", "hardline"];
    case null:
    default:
      return ["consultative", "hardline"];
  }
}

/** Deterministically pick this session's recruiter tone + difficulty
 *  from the user's identity and how many negotiations they've already
 *  practised. Pure. */
export function computeScenarioSeed(input: ScenarioSeedInput): ScenarioSeed {
  const tones = compatibleTones(input.tierBucket);
  const count = Number.isFinite(input.priorNegotiationCount)
    ? Math.max(0, Math.floor(input.priorNegotiationCount))
    : 0;

  /* Stable per-user offset so two users at count=0 don't both land on
   * tones[0]. Anonymous sessions (no userId) start at 0 deterministically. */
  const userOffset = input.userId ? fnv1a(input.userId) % tones.length : 0;
  const rotationIndex = (userOffset + count) % tones.length;
  const recruiterPersona = tones[rotationIndex];

  const difficulty: SessionDifficulty =
    count <= 1 ? "warmup" : count <= 4 ? "standard" : "hardball";

  return { recruiterPersona, difficulty, rotationIndex };
}
