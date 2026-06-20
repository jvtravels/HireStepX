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
import type { CompanyTier } from "../data/company-tiers";

export interface ScenarioSeedInput {
  /** Authenticated user id, or null for anonymous / dev sessions. */
  userId: string | null;
  /** Count of this user's prior salary-negotiation sessions (>= 0). */
  priorNegotiationCount: number;
  /** Company tier bucket, used to constrain plausible recruiter tones. */
  tierBucket: CompanyTierBucket | null;
  /** The recruiter tones this user has ALREADY faced, oldest → newest
   *  (the actual cross-session ledger, reconstructed from their prior
   *  sessions — see `reconstructSeenPersonas`). When supplied, persona
   *  selection prefers the least-recently-seen compatible tone, so a
   *  returning user is *guaranteed* never to draw the persona from their
   *  immediately-prior session and cycles the full compatible set before
   *  any repeat — true cross-session anti-repetition rather than the
   *  count-modulo approximation. Omitted / empty ⇒ the original
   *  deterministic `(userOffset + count) % len` rotation, unchanged. */
  seenPersonas?: RecruiterPersona[];
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
  /** Cross-session bad-faith-tactic rotation cursor (2026-06-20). A
   *  per-user-stable offset stepped by exactly 1 each session
   *  (`fnv1a(userId|"tactic") + priorNegotiationCount`). The planner mods
   *  this per tactic family to pick the deadline / line / topic VARIANT,
   *  so a returning user does NOT see the identical exploding-offer
   *  deadline, fake-competing line, or vague-promise topic every session:
   *  because the cursor advances by 1, consecutive sessions land on
   *  different variants and a full cycle elapses before any repeat. Unlike
   *  the legacy `tacticHash(sessionId, …)` seeding (random per session, no
   *  anti-repetition, not reconstructable), this is deterministic in
   *  (userId, count) — both known at init — so no ledger replay is needed.
   *  Frozen into kernel state at init. */
  tacticRotation: number;
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

/* Map the data-layer `CompanyTier` (company-tiers.ts) to the kernel's
 * `CompanyTierBucket`. SINGLE SOURCE OF TRUTH for this projection — the
 * negotiate-turn init path and the cross-session persona reconstruction
 * MUST agree on a company's bucket, or the reconstructed ledger wouldn't
 * line up with the tones actually served. Pure. */
export function tierBucketForCompanyTier(
  tier: CompanyTier | null,
): CompanyTierBucket | null {
  switch (tier) {
    case "faang": case "big-tech": case "gcc":      return "listed_big_tech";
    case "indian-unicorn": case "saas-product":     return "mature_unicorn";
    case "edtech": case "startup-growth":           return "growth_startup";
    case "startup-early":                           return "early_startup";
    case "it-services":                             return "it_services";
    case "bfsi-global": case "bfsi-domestic":       return "bfsi";
    case "fmcg-mnc":                                return "fmcg";
    case "government-psu":                          return "psu";
    default:                                        return null;
  }
}

/** Pick the least-recently-seen compatible tone. `seen` is oldest →
 *  newest. A never-seen tone scores -1 (maximally stale) so it is always
 *  preferred; among ties we start scanning from `startIndex` (the
 *  original deterministic rotation index) and keep the FIRST best with a
 *  strict `<`, so an empty `seen` reproduces the legacy
 *  `tones[startIndex]` pick exactly. The most-recently-seen tone carries
 *  the highest score and is therefore never chosen while any alternative
 *  exists (≥2 tones always exist), guaranteeing no back-to-back repeat. */
function selectLeastRecentTone(
  tones: RecruiterPersona[],
  seen: readonly RecruiterPersona[],
  startIndex: number,
): { tone: RecruiterPersona; index: number } {
  const lastSeenAt = new Map<RecruiterPersona, number>();
  seen.forEach((p, i) => lastSeenAt.set(p, i));
  let bestTone = tones[startIndex];
  let bestIndex = startIndex;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let k = 0; k < tones.length; k++) {
    const idx = (startIndex + k) % tones.length;
    const tone = tones[idx];
    const score = lastSeenAt.has(tone) ? (lastSeenAt.get(tone) as number) : -1;
    if (score < bestScore) {
      bestScore = score;
      bestTone = tone;
      bestIndex = idx;
    }
  }
  return { tone: bestTone, index: bestIndex };
}

/** Deterministically pick this session's recruiter tone + difficulty
 *  from the user's identity, how many negotiations they've already
 *  practised, and — when supplied — the actual ledger of tones they've
 *  faced (`seenPersonas`, oldest → newest). Pure. */
export function computeScenarioSeed(input: ScenarioSeedInput): ScenarioSeed {
  const tones = compatibleTones(input.tierBucket);
  const count = Number.isFinite(input.priorNegotiationCount)
    ? Math.max(0, Math.floor(input.priorNegotiationCount))
    : 0;

  /* Stable per-user offset so two users at count=0 don't both land on
   * tones[0]. Anonymous sessions (no userId) start at 0 deterministically. */
  const userOffset = input.userId ? fnv1a(input.userId) % tones.length : 0;
  const startIndex = (userOffset + count) % tones.length;

  /* Without a seen-ledger this collapses to the legacy
   * `tones[startIndex]` rotation; with one it prefers the stalest tone,
   * upgrading the count-modulo APPROXIMATION of "don't repeat" into a
   * GUARANTEE keyed on what the user actually faced (correct even when
   * sessions span multiple tiers with differently-sized tone sets). */
  const { tone: recruiterPersona, index: rotationIndex } = selectLeastRecentTone(
    tones,
    input.seenPersonas ?? [],
    startIndex,
  );

  const difficulty: SessionDifficulty =
    count <= 1 ? "warmup" : count <= 4 ? "standard" : "hardball";

  /* Bad-faith-tactic rotation cursor — a stable per-user offset (distinct
   * salt from the persona offset so tactic variants don't move in lockstep
   * with tone) stepped by the session count. The planner mods this per
   * tactic family; stepping by 1 each session guarantees no consecutive
   * variant repeat and a full cycle before any repeat. Anonymous sessions
   * (no userId) get a stable offset of 0 + count, still non-repeating. */
  const tacticOffset = input.userId ? fnv1a(`${input.userId}|tactic`) : 0;
  const tacticRotation = (tacticOffset + count) >>> 0;

  return { recruiterPersona, difficulty, rotationIndex, tacticRotation };
}

/** Reconstruct, purely from a user's prior negotiation companies (the
 *  already-persisted `target_company` column, in chronological order),
 *  the recruiter tones they were actually served. This is the
 *  "reuse existing sessions" ledger: no new table, no write path — we
 *  replay the same deterministic seed logic over the historical tiers,
 *  folding each pick into the seen-list so the reconstruction is
 *  self-consistent with how the NEXT session will select. Returns the
 *  tones oldest → newest, ready to hand back into `computeScenarioSeed`
 *  as `seenPersonas`. Pure. */
export function reconstructSeenPersonas(
  userId: string | null,
  priorTiers: readonly (CompanyTierBucket | null)[],
): RecruiterPersona[] {
  const seen: RecruiterPersona[] = [];
  priorTiers.forEach((tier, i) => {
    const { recruiterPersona } = computeScenarioSeed({
      userId,
      priorNegotiationCount: i,
      tierBucket: tier,
      seenPersonas: seen,
    });
    seen.push(recruiterPersona);
  });
  return seen;
}
