/* Negotiation kernel: canonical NegotiationState shape and its supporting record types. */

import type { NegotiationBand, NegotiationPhase, NegotiationLever, DiscoveryTopic } from "./_negotiation-vocab";
import type { ComponentBreakdown } from "./_component-breakdown";
import type { RecruiterSectorPersona } from "./_indian-recruiter-personas";
import type { RationaleResult } from "./_hike-rationale";
import type { NoticeJoiningResult } from "./_notice-joining";
import type { EquityVestingResult } from "./_equity-vesting";
import type { LocationModeResult } from "./_location-mode";
import type { CompetingOfferDetail } from "./_competing-offer-detail";
import type { DecisionDeadlineResult } from "./_decision-deadline";
import type { CandidateProfileResult } from "./_candidate-profile";
import type { MiscSignalsResult } from "./_misc-signals";
import type { CandidateStanceResult } from "./_candidate-stance";
import type { SalesOTEResult, ContractRateResult } from "./_comp-structure";
import type { RetentionCounterResult } from "./_retention-counter";
import type { QuestionIntent } from "./_question-intent";
import type { TurnDelta } from "./_negotiation-turn-delta";
import type { ConversationLedger } from "./_conversation-ledger";
import type { NegotiationRoundPersona } from "./_negotiation-rounds";
import type { CandidateComp } from "./_compensation-model";

/* ─── Canonical State ────────────────────────────────────────────── */

/**
 * Information items a candidate can interrogate the recruiter about.
 * Tracked as a set on state so we don't double-credit repeated asks
 * and so the move-picker can reward depth of due diligence.
 *
 * CONVENTION — two tiers of handling (see `_negotiate-turn-helpers.ts`
 * `INFO_ANSWERS` for the long-form note):
 *
 *  - STATIC ONE-LINERS (9): clawback-period, variable-history,
 *    vest-schedule, strike-price, in-hand-monthly, exercise-window,
 *    acceleration, fixed-vs-variable, perks-non-cash. Each maps to a
 *    fixed snippet in the `INFO_ANSWERS` table — no state interpolation.
 *
 *  - STATE-DERIVED BLOCKS (4): benefits-overview, compensation-breakdown,
 *    notice-period-ask, hike-percentage-ask. These have bespoke
 *    `if (state.infoAsked.includes(...))` blocks inside
 *    `buildResponseHints` that interpolate kernel state (state.company,
 *    state.highestOfferMade, state.candidateCurrentCtc, etc.) and
 *    matching lever-routing branches in `pickAiMove` (search for
 *    `wantsBenefits` / `wantsCompStructure` / `wantsNoticePolicy` /
 *    `wantsHikeContext` for the pattern).
 *
 *  - HYBRID: `package-breakdown` is handled by lever-routing in
 *    `pickAiMove` (`wantsBreakdown` → `benefits-summary` lever) and has
 *    no dedicated `INFO_ANSWERS` row — the lever itself drives the
 *    response. `fixed-vs-variable` and `perks-non-cash` appear in BOTH
 *    tiers (one-liner fallback + breakdown lever trigger).
 *
 * When adding a new intent: if it's a state-free policy snippet, add
 * a row to `INFO_ANSWERS`. If it requires kernel state, add a block to
 * `buildResponseHints` AND a routing branch to `pickAiMove`.
 */
export type InfoIntent =
  | "clawback-period"      // joining-bonus clawback duration / pro-rata
  | "variable-history"     // last 2-3yr variable payout %
  | "vest-schedule"        // RSU/ESOP grant + cliff + slope
  | "strike-price"         // ESOP exercise price / last 409A / FMV
  | "in-hand-monthly"      // CTC → net take-home breakdown
  | "exercise-window"      // post-termination ESOP exercise window
  | "acceleration"         // accelerated vesting on acquisition / RIF
  | "fixed-vs-variable"    // CTC split breakdown
  | "perks-non-cash"       // Sodexo / gratuity / NPS lumping
  | "package-breakdown"    // generic "walk me through the package" / "break it down" — added 2026-05 after the Lollypop session where the candidate asked for the structure and the AI responded with a probe ("what range are you targeting?") instead of providing the breakdown. The existing intents were all component-specific; this catches the higher-level "explain the offer" ask.
  | "benefits-overview"    // "what are the benefits?" / "what perks do you offer?" — added 2026-05 (bug report 11 follow-up E). Distinct from `perks-non-cash` (Sodexo / gratuity lump-into-CTC trick) and from `package-breakdown` (offer-component enumeration). This is the candidate asking what's IN the benefits package — health insurance, PF, leaves, learning budget, work mode. Routed to a company-aware disclosure in the helpers layer.
  | "compensation-breakdown" // "explain the variable components" / "ESOP details?" / "what's the bonus structure?" — added 2026-05 (session 12 bug). Distinct from `package-breakdown` (offer-component enumeration of THIS offer) and `fixed-vs-variable` (just the split). This is the candidate asking about the GENERAL compensation STRUCTURE at the company — base/variable/equity ratios, bonus frequency, vesting. Routed to a company-aware compensation disclosure (data/company-compensation-structure.ts) via the response-hint layer.
  | "notice-period-ask"    // Session B (2026-05-14): candidate asking ABOUT notice / start-date / buyout — "notice period?", "when can I join?", "earliest start date?", "buyout?". Distinct from the noticeJoining EXTRACTION (candidate stating THEIR notice). An info-ask the recruiter should answer in-channel.
  | "hike-percentage-ask"; // Session B (2026-05-14): candidate asking what hike% this offer represents — "what hike is this?", "is this a 30% hike?", "% raise?". Distinct from hikeRationale (candidate justifying their ask). Recruiter should respond with the computed delta if currentCtc known.

/* Negotiation tactics from the Voss / interviewing.io canon that the
   parser detects and the move-picker rewards. Tracked so a candidate
   who's clearly negotiating well faces less recruiter stiffening. */
export type VossTactic =
  | "mirror"               // repeats AI's last 1-3 words as a question
  | "label"                // "it sounds like..." framing
  | "calibrated"           // "how can I..." / "what's the best you can..."
  | "sign-today-bundle"    // "if you can do X+Y+Z I'll sign today"
  | "deflect-current-ctc"; // refuses to disclose current CTC

/* Macro market mode — adjusts global concession curves. Soft markets
   (post-layoff 2023-style) reduce concession willingness; hot markets
   (AI/ML 2025-style) increase it. Default neutral. */
export type MarketMode = "soft" | "neutral" | "hot";

/* Phase 21 — Recruiter persona. The same kernel state can be played
 * by four distinct recruiter archetypes; each modulates tactical
 * preferences (concession curve, what they probe for, what they
 * surface unprompted, tone). The kernel uses persona ONLY at the
 * response-hints layer so band math stays persona-agnostic — the
 * candidate's *experience* changes, not the underlying economics.
 *
 *   hardline      — aggressive in-house TA. Anchors at walkAway,
 *                   resists concessions, treats every probe as a
 *                   bargaining tell. Closing-pressure heavy.
 *   consultative  — friendly hiring manager. Transparent about the
 *                   band, willing to swap levers (JB ↔ equity ↔
 *                   review cycle), explains the why.
 *   founder       — early-stage founder/CEO. Mission-heavy, equity-
 *                   heavy, time-pressured ("we need to move fast"),
 *                   conservative on cash but generous on title/scope.
 *   agency        — external agency recruiter on commission. Surface-
 *                   level, deal-making, optimises for closure speed,
 *                   pushes acceptance harder than is warranted by
 *                   the actual band.
 *
 * Default: "consultative" — the existing kernel behaviour mapped
 * cleanly to a transparent hiring-manager persona, so callers that
 * don't specify persona see no change. */
export type RecruiterPersona = "hardline" | "consultative" | "founder" | "agency";

/* Phase 24b (2026-05-13) — persona-conditional band economics.
 * Earlier persona work modulated STYLE (hints, probes). This pure
 * helper modulates the BAND itself so persona affects what's actually
 * negotiable:
 *   - hardline:    +1L walkAway (less willing to chase low), -1L maxStretch
 *                  (less willing to flex high). Tighter band overall.
 *   - founder:     hasEquity forced true (equity is the trade lever),
 *                  +0.5L maxStretch (founder authority to flex on TC).
 *   - agency:      +0.5L maxStretch (commission-motivated to close).
 *   - consultative: no change (baseline).
 *
 * Invariants preserved:
 *   - walkAway < initialOffer < maxStretch (clamped if persona deltas
 *     would invert).
 *   - If a caller pre-applied tighter bounds, we never widen past
 *     {initialOffer ± 0.01} into invalid territory. */
export function applyPersonaToBand(
  base: NegotiationBand,
  persona: RecruiterPersona,
): NegotiationBand {
  const out: NegotiationBand = { ...base };
  switch (persona) {
    case "hardline":
      out.walkAway = base.walkAway + 1;
      out.maxStretch = base.maxStretch - 1;
      break;
    case "founder":
      /* AUDIT-W02 EQUITY-LEAK-FOUNDER-TCS (2026-06-08) — persona must NOT
       * invent comp components. Only carry equity through if the base band
       * already grants it; founder bias = magnitude/lever choice WITHIN
       * the band, never new components (e.g. TCS has hasEquity=false). */
      if (base.hasEquity === true) out.hasEquity = true;
      out.maxStretch = base.maxStretch + 0.5;
      break;
    case "agency":
      out.maxStretch = base.maxStretch + 0.5;
      break;
    case "consultative":
      /* no change */
      break;
  }
  /* Clamp to preserve invariants: walkAway strictly below initialOffer,
   * maxStretch strictly above initialOffer. */
  if (out.walkAway >= base.initialOffer) out.walkAway = base.initialOffer - 0.5;
  if (out.maxStretch <= base.initialOffer) out.maxStretch = base.initialOffer + 0.5;
  /* P35 clamp invariant (session 12 fix — 2026-05-14). Persona never
   * raises initialOffer; this preserves the 35th-percentile opening
   * anchor set at construction time in salary-lookup.ts. Defensive: if
   * future persona logic ever bumped initialOffer above the input base
   * (e.g. a "founder" boost), this clamp would catch it. */
  if (out.initialOffer > base.initialOffer) out.initialOffer = base.initialOffer;
  return out;
}

/** Coarse adaptive-difficulty label for a session. Computed per-user from
 *  prior negotiation count in `_scenario-seed.ts`. */
export type SessionDifficulty = "warmup" | "standard" | "hardball";

/* Adaptive session difficulty (2026-06-20) — repeat-session progression.
 *
 * `_scenario-seed.ts` computes a coarse difficulty from the user's prior
 * negotiation count (warmup for the first sessions, ramping to hardball),
 * but until now it only rode telemetry — the kernel never read it, so a
 * 1st-session user and a 20th-session user faced byte-identical recruiter
 * economics. A returning user therefore never felt the bot "get harder".
 * This wires the dead seam.
 *
 * Difficulty modulates the recruiter's NEGOTIATING POSTURE, never the
 * market truth:
 *   - initialOffer (the P35 market anchor) is PINNED — the opening number
 *     reflects the real market band and must not drift with practice
 *     count. The deterministic-correctness guarantee stays intact.
 *   - maxStretch (how far the recruiter will go) and walkAway (how soon
 *     they walk) ARE the recruiter's strategy, and legitimately vary with
 *     how tough this particular recruiter plays:
 *       warmup   — concedes more, walks later  → more room to extract
 *       standard — identity (baseline)
 *       hardball — concedes less, walks sooner → tighter, less forgiving
 *
 * Deltas are proportional (so they scale sanely from a ₹7L IT-services
 * band to a ₹60L GCC band) and small (≤5%), then clamped to preserve the
 * invariant walkAway < initialOffer < maxStretch with a ≥0.5L spread each
 * side. Applied AFTER applyPersonaToBand at init; "standard"/undefined is
 * a pure identity transform, so every existing caller and test (none pass
 * difficulty today) is byte-for-byte unchanged. */
export function applyDifficultyToBand(
  base: NegotiationBand,
  difficulty: SessionDifficulty,
): NegotiationBand {
  if (difficulty === "standard") return base;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const out: NegotiationBand = { ...base };
  if (difficulty === "warmup") {
    out.maxStretch = round1(base.maxStretch * 1.05);
    out.walkAway = round1(base.walkAway * 0.96);
  } else {
    /* hardball */
    out.maxStretch = round1(base.maxStretch * 0.95);
    out.walkAway = round1(base.walkAway * 1.04);
  }
  /* Preserve invariants — initialOffer pinned; ≥0.5L spread on each side. */
  if (out.walkAway >= base.initialOffer) out.walkAway = round1(base.initialOffer - 0.5);
  if (out.maxStretch <= base.initialOffer) out.maxStretch = round1(base.initialOffer + 0.5);
  return out;
}

/* RC-1 minimum concession-spread floor (2026-07-12).
 *
 * The recruiter's cash number "barely moving" was the top realism defect in
 * the holistic audit: the salary-lookup band math (P35 opener → P85 ceiling)
 * plus the resolver's one-way down-clamps (clampBandToTargetRoleMarket,
 * clampBandToTierP50) and the posture transforms above (hardline persona
 * `maxStretch − 1`, hardball difficulty `maxStretch × 0.95`) can independently
 * compress (maxStretch − initialOffer) down to a fraction of an LPA. A band
 * with no room to move forces a turn-2 close and reads as fake. No stage of
 * the pipeline enforced a LOWER bound on the spread — only the degeneracy
 * guards above (≥0.5L), which is far too tight to feel like a real negotiation.
 *
 * Enforce a realistic minimum: the recruiter always keeps at least 12% of the
 * opening as concession headroom, with a 1.5L absolute floor so low-market
 * bands don't over-widen (12% of a ₹6L PSU opener is only 0.72L; 1.5L matches
 * the joining-bonus spread floor at _next-action-planner.ts:6508). Widen the
 * ceiling UP only — initialOffer and walkAway are untouched, so the frozen
 * invariant walkAway < initialOffer < maxStretch is strengthened, never broken.
 *
 * Applied as the OUTERMOST init transform (after persona + difficulty) so it is
 * the authoritative final word on the frozen session band. Single source of
 * truth — no other stage owns the spread floor. */
export function enforceMinimumSpread(base: NegotiationBand): NegotiationBand {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const minSpread = Math.max(1.5, round1(base.initialOffer * 0.12));
  if (base.maxStretch - base.initialOffer >= minSpread) return base;
  return { ...base, maxStretch: round1(base.initialOffer + minSpread) };
}

export interface NegotiationState {
  /* Identity */
  readonly sessionId: string;
  readonly role: string;
  readonly company: string;

  /* Band — frozen at session start. Server is authoritative; the
     engine cannot mutate this after init. */
  readonly band: NegotiationBand;

  /* Phase + turn budget */
  phase: NegotiationPhase;
  turnIndex: number;    // number of AI turns produced; incremented in applyAiMove
  maxTurns: number;     // hard cap before stalemate (default 20)

  /* Candidate-stated facts. Folded in via applyCandidateAnswer or
     foldFactsIntoState — set ONCE per turn, never re-derived from
     transcript. Null = not stated. */
  candidateTarget: number | null;        // their TOTAL-package ask (LPA, last-stated-wins)
  /** Audit Fix (2026-05-19) — Fixed-component target. Separate from
   *  candidateTarget so a fixed-only restatement ("target is ₹26 LPA
   *  fixed at minimum") does NOT overwrite a previously stated total
   *  target ("expecting ₹32 LPA total"). The number-role classifier
   *  routes a target here when its adjacency window names "fixed" /
   *  "base" / "basic" without a "total"/"ctc"/"overall" override.
   *  Optional in serialized form AND in fixture construction for
   *  back-compat — absence ≡ null. All consumers must coalesce
   *  `state.candidateTargetFixed ?? null` (or `?? state.candidateTarget`
   *  where the field is used as a fallback target). */
  candidateTargetFixed?: number | null;
  /** Bug-report 12 (2026-05-14) — the numeric counter the candidate
   *  parsed THIS turn (LPA). Distinct from `candidateTarget` which is
   *  sticky from intake / earliest anchor; this field is the per-turn
   *  fresh-counter signal. Set in applyCandidateAnswer when parsed.target
   *  is non-null AND differs from the prior sticky candidateTarget (so
   *  re-asserting the same number doesn't count as a "fresh" counter).
   *  Cleared by applyAiMove so it never bleeds into the next AI turn.
   *  Used by the auto-accept gate so a stale intake target can NEVER
   *  close the AI below highestOfferMade without an in-turn counter. */
  lastCandidateCounterLpa: number | null;
  /** Deflect-loop fix (2026-06-15) — scope of the most recent
   *  lastCandidateCounterLpa stamp. A `"fixed"` counter ("₹26 LPA fixed
   *  at minimum") is a raise-the-base ask, NOT an acceptance of the
   *  total; a `"total"` counter is a whole-package figure. The auto-accept
   *  gate reads this so a fixed-scoped counter (e.g. 26) is never
   *  mis-compared against a TOTAL offer (e.g. 28) and false-accepted —
   *  which previously closed the candidate while they were still pushing
   *  for more base. Null when no counter has landed yet. Cleared with
   *  lastCandidateCounterLpa by applyAiMove. */
  lastCounterComponent?: "fixed" | "total" | null;
  /** Phase 25a (2026-05-13) — the FIRST number the candidate ever
   *  anchored. Frozen on first non-null assignment; never updated
   *  after. Lets the red-flag layer detect upward drift ("Earlier
   *  you mentioned ₹18L; now you're at ₹24L"). */
  firstAnchoredTarget: number | null;
  /* S42-B8 / S43-B7 (2026-07-23) — candidate's FIRST counter stated
   * AFTER an offer is already on the table (highestOfferMade > 0).
   * Distinct from firstAnchoredTarget, which captures any first target
   * mention including discovery-phase disclosures. A candidate who states
   * "I want ₹55L" in opening discovery and later accepts the ₹48L offer
   * without pushing back should show candidateAsk=null in the report —
   * they never countered vs the offer. firstCounterVsOffer is null for
   * that session. First-wins, monotone-null-to-set (never clears).
   * Metrics layer uses this over firstAnchoredTarget when offers exist. */
  firstCounterVsOffer?: number | null;
  /* S43-B8 — last-wins complement to firstCounterVsOffer. Records the MOST
   * RECENT counter the candidate stated against a live offer (highestOfferMade>0).
   * Unlike firstCounterVsOffer (which freezes on first write), this overwrites
   * every time the candidate re-counters, so the report tile "YOUR ASK" shows
   * the final explicit ask rather than an early discovery-target that happened
   * to land after an offer appeared. Null when no counter vs offer has been
   * stated. Never clears once set (cleared only alongside firstCounterVsOffer
   * would defeat the purpose). */
  lastCounterVsOffer?: number | null;
  candidateCurrentCtc: number | null;    // current package (NOT target)
  /* PDF #28 (2026-06-07) — candidate's CURRENT employer name.
   *
   * Distinct from state.company (the TARGET company we're hiring for).
   * Captured when the candidate discloses where they currently work
   * ("I'm at Razorpay", "currently with Walmart", "my role at Swiggy").
   *
   * Used by the restyle prompt to prevent the LLM from pasting the
   * TARGET company name into deflection prose about the candidate's
   * CURRENT role. The PDF #28 transcript shipped "your current role at
   * Flipkart" — Flipkart was the target, the candidate worked elsewhere.
   *
   * Stays null when not disclosed. Restyle prompt then instructs the
   * LLM to omit any employer name when referring to the candidate's
   * current role ("your current role" not "your current role at X").
   *
   * Optional (undefined treated as null) so pre-PDF#28 state literals
   * in tests / persisted sessions remain valid. */
  candidateCurrentCompany?: string | null;
  competingOffer: number | null;         // BATNA in hand (NOT target)

  /* Component-level breakdown the candidate has stated about their
   * ask or current — base / variable / equity in LPA. Phase 10A
   * (2026-05-13). Carries cross-turn (last-stated-wins via
   * mergeBreakdown). The LLM prompt surfaces these so the AI doesn't
   * propose a counter that satisfies the candidate's total while
   * violating their base-floor constraint. Detection-only at the
   * kernel level: enforcement in the move-picker is deferred until
   * the band schema also carries components. */
  candidateComponentBreakdown: ComponentBreakdown;

  /* Range ask: candidate stated "30-35 LPA" instead of a single number.
     Research (Idaho / Harvard PON) shows range asks earn meaningfully
     more than single-point asks. We reward this in the counter-offer
     split. */
  candidateAskedAsRange: boolean;
  /** S48-B6 (2026-07-24) — true when the most recently stated total target
   *  was a range upper-bound (not a specific point); cleared to false when
   *  the candidate subsequently narrows to a point. Used by the planner's
   *  range-to-point probe guard: suppress re-probing once a point is given. */
  candidateTargetWasRange?: boolean;

  /* AI moves made */
  highestOfferMade: number;              // best number AI has put on table (LPA)
  /** PDF#48 (2026-05-26) — turn index on which the kernel first put a
   *  specific number on the table (the moment `highestOfferMade`
   *  transitioned from 0 to > 0). Lets the premature-close guard ask
   *  "how many candidate turns have elapsed since the offer landed?" —
   *  the structural invariant the auto-close bug violated was that
   *  acceptance could lock in on the SAME turn the offer was first
   *  spoken, before the candidate had any chance to counter. Set once
   *  in applyAiMove at the same site that bumps highestOfferMade.
   *  Optional / nullable for backward-compat with sessions started
   *  before this field existed; absent ≡ never anchored. */
  firstOfferAtTurn?: number | null;
  leversUsed: NegotiationLever[];        // ordered history
  lastAiText: string;                    // for verbatim-repeat detection

  /** Phase 28 (2026-05-13) — last kernel-computed joining-bonus amount
   *  the AI has put on the table this session (LPA, one-time). Null
   *  until a joining-bonus move fires. Carries across turns so
   *  close-acceptance can include it in the recap — without this the
   *  JB silently disappeared from the close summary (May 2026 session).
   *  Sticky (never reset to null after being set). */
  lastJoiningBonusOffered: number | null;

  /** S20-B2 (2026-07-22) — ESOP grant amount the recruiter has put on the
   *  table for this session (total 4-year vesting value, LPA-equivalent).
   *  Null until an equity-grant lever fires; frozen once set (sticky).
   *  Derived from band.maxStretch at lever-fire time so the LLM has a
   *  concrete number to cite when the candidate asks "how many units /
   *  what ₹ value?" — without this the recruiter could only describe
   *  structure (vest, cliff, strike) but never state a size. Optional for
   *  back-compat with sessions serialized before this field. */
  equityGrantAmountLpa?: number | null;

  /* Rolling conversation log — capped at the last CONVERSATION_LOG_CAP
   * entries (= 4, i.e. last 2 exchanges). Phase 5 of the rebuild: the
   * compact brief carried derived facts only (target, current, highest
   * offer, etc.); the per-turn user prompt had `lastAiText` and the
   * candidate's CURRENT answer but no thread before that. The Lollypop
   * session (May 2026) showed the bot dropping context across turns
   * (re-asking what the candidate had said two turns earlier). Carrying
   * the last 2 exchanges into the prompt lets the LLM thread responses
   * without re-deriving state from the full transcript.
   *
   * Capped on purpose. A growing log inflates the per-turn prompt and
   * trips Groq's prefix cache (dynamic content drifts farther through
   * the prompt with each turn). 4 entries = ~600 tokens of dialogue,
   * which is enough thread for natural references and small enough that
   * the cache prefix still hits. */
  conversationLog: Array<{ speaker: "ai" | "candidate"; text: string }>;

  /* Recruiter-side tactic counters. `finalOfferAssertedCount` tracks
     how many times the AI (or upstream LLM) has claimed "best and
     final" — used by the move-picker to decay credibility after the
     AI then moves anyway. */
  finalOfferAssertedCount: number;

  /* Candidate-side tactic & intent counters. */
  vossTacticsUsed: VossTactic[];
  infoAsked: InfoIntent[];
  /* S13-B9 — the subset of `infoAsked` the candidate raised on their OWN
     initiative, i.e. the recruiter did NOT solicit that disclosure on the
     immediately-prior turn. This is the single source of truth for
     "candidate-INITIATED justification": the report's stage-2 credit ("You
     justified your number") must key on this, not on `infoAsked`, so a
     recruiter-ELICITED disclosure ("what's your current breakdown?" → the
     candidate answers) is not miscredited as candidate-initiated justification.
     Sticky, never cleared, subset of infoAsked by construction. */
  infoAskedInitiated: InfoIntent[];

  /* Verbal-acceptance lock: the candidate said "yes" but then tried to
     re-open the conversation. Distinct from terminal `accepted` — when
     this fires, the move-picker stiffens dramatically and a small
     rescission risk applies on the next turn. */
  verbalAcceptanceTurn: number | null;

  /* Phase 25d (2026-05-13) — rescission escalation. Counts candidate
   * turns AFTER verbalAcceptanceTurn on which the candidate is still
   * asking for more (target/info/tactic firing without acceptance).
   * 2+ = the offer is being rescinded; move-picker routes directly to
   * close-walkaway and the red-flag layer surfaces "rescission-risk"
   * as a blocker. */
  postVerbalRenegotiationCount: number;

  /* perfect 1 (2026-05-16) — multi-turn negotiation spiral. Counts the
   * number of counter-offer moves the AI has shipped this session.
   * Incremented in applyAiMove when move.lever === "counter-base".
   * Read by the planner's counter-offer construction path to apply a
   * diminishing-concessions multiplier (60% / 40% / 20% of the gap
   * for rounds 0/1/2; round 3+ pivots to hold-firm lever-loop). Also
   * read by canonical prose to emit a "we've already moved once"
   * acknowledgement on rounds >= 1.
   *
   * Distinct from counterCount derived from leversUsed (which the
   * existing splitSchedule already uses): counterRound is the canonical
   * authoritative counter for the spiral cadence and prose tells, kept
   * separate so we don't accidentally double-count rotation-counter and
   * spiral-counter against each other. */
  counterRound: number;

  /* Phase 21b (2026-05-13) — recovery actualization. True on the AI
   * turn that immediately follows a candidate utterance carrying a
   * recovery signal (desperate / salary-only / avoids-anchor /
   * personal-expense / offer-shopping recovered). Read by
   * pickAiMove to un-stiffen the counter split for one turn. Reset
   * to false in applyAiMove so it never bleeds into the next AI
   * turn. */
  recentRecoveryActive: boolean;

  /* Walk-away-and-return: candidate hit `walked-away` and then re-
     engaged. Comes with a penalty (loss of joining bonus, lower base
     ceiling on return). */
  walkAwayReturned: boolean;

  /* PDF#29 Bug 7 (2026-05-18) — candidate frustration signal. Set in
   * applyCandidateAnswer when the last user utterance matches
   * USER_FRUSTRATION_RE ("I already told you", "you keep asking",
   * "we covered this", "asked and answered"). Consumed by the planner
   * to promote `acknowledge-and-recover` as the highest-priority lever,
   * and cleared in applyAiMove after the recover turn fires so it
   * doesn't repeat. */
  lastUserFrustrated?: boolean;

  /* Hard-vs-soft band cap. When true, `maxStretch` is genuinely
     unreachable on base — the AI redirects to JB/equity/level instead
     of conceding on base. Modeled after services-co fitment caps. */
  hardBandCap: boolean;

  /* Macro market mode — adjusts concession curve globally. */
  marketMode: MarketMode;

  /* Phase 21 — Recruiter persona archetype. Influences response-hint
   * tone and tactical preferences but NOT band math. Frozen at session
   * start. Default "consultative" preserves legacy behaviour. */
  recruiterPersona: RecruiterPersona;

  /* Cross-session bad-faith-tactic rotation cursor (2026-06-20). Seeded
   * once at init from _scenario-seed.ts (`fnv1a(userId|"tactic") + count`)
   * and frozen; the planner mods it per tactic family to pick the
   * deadline / line / topic VARIANT so a returning user doesn't replay the
   * identical bad-faith tactic each session. Optional for back-compat:
   * hand-built test fixtures and pre-2026-06-20 serialized sessions omit
   * it, and the planner falls back to the legacy session-local
   * `tacticHash(sessionId, …)` seeding when it's undefined. */
  tacticRotation?: number;

  /* Phase 3 of Salary-Negotiation SCORE_IMPROVEMENT_PLAN (2026-05-18) —
   * Indian recruiter SECTOR archetype (IT Services / GCC / Indian
   * Unicorn / Early Startup / BFSI / default). Frozen at session start
   * from tierBucket + band shape via selectRecruiterSectorPersona.
   * Distinct from `recruiterPersona` above (which is a tone axis:
   * hardline / consultative / founder / agency, and modulates band
   * economics). This persona only colours prose surfaces — pushback
   * shape, counter-offer phrasing, band-disclosure-deflect. Never
   * mutates after init. Optional on the interface for back-compat with
   * hand-constructed partial-state test fixtures and with in-flight
   * sessions serialised before Phase 3 shipped — consumers treat
   * undefined as "default". `initState` always sets it; deserializeState
   * backfills to "default" on load. */
  recruiterSectorPersona?: RecruiterSectorPersona;

  /* 2026-05-29 mood-pass — recruiter personality mood. Three buckets
   * (warm / brusque / frantic) seeded once at session start from a
   * hash of sessionId so it's deterministic per session and varies
   * across sessions. Affects tone only — the planner, move-picker,
   * and band math are mood-blind. Optional on the interface for
   * back-compat with hand-constructed test fixtures and with in-flight
   * sessions serialised before this field shipped; consumers treat
   * undefined as "warm" (current behaviour). */
  recruiterMood?: import("./_recruiter-prose-realism").RecruiterMood;

  /* 2026-05-30 time-context — derived once at session init from the
   * caller-provided `callTimeIso`. Optional / back-compat: undefined or
   * absent on serialized state defaults to "midweek-standard" (behavioral
   * no-op). Affects concession headroom and mood-cool probability;
   * never mutated after initState. */
  timeContext?: import("./_recruiter-time-context").TimeContext;

  /* 2026-05-29 mood-shift-pass — DYNAMIC mood overlay. The baseline
   * `recruiterMood` is seeded once at init and never changes (the
   * recruiter's personality). `recruiterMoodDynamic` shifts during
   * the call in response to candidate behaviour:
   *
   *   baseline  — use seeded mood (back-compat, default)
   *   cooled    — recruiter pushed back, behaves brusque-like for
   *               up to MOOD_COOLED_TTL turns or until a rewarm
   *               trigger fires
   *   rewarmed  — candidate conceded after cooling; behaves warm-like
   *
   * Trigger plumbing:
   *   - `recruiterMoodDynamicEnteredAtTurn`: turn the current dynamic
   *     state was entered. Used to TTL `cooled` back to `baseline`.
   *   - `consecutiveOverBandAsks`: streak counter for one of the cool
   *     triggers (3+ in a row).
   *   - `recruiterMoodColdLineFiredAtTurn` / `RewarmLineFiredAtTurn`:
   *     once-per-session gates so the cold line / rewarm prefix
   *     don't spam every turn the recruiter is in the cooled state.
   *
   * All optional for back-compat with serialised in-flight state. */
  recruiterMoodDynamic?: import("./_recruiter-prose-realism").RecruiterMoodDynamic;
  recruiterMoodDynamicEnteredAtTurn?: number | null;
  consecutiveOverBandAsks?: number;
  recruiterMoodColdLineFiredAtTurn?: number | null;
  recruiterMoodRewarmLineFiredAtTurn?: number | null;
  /* Highest candidate target seen so far this session — used to detect
   * concession (drop of ≥10% from prior ask). Pure-derived; updated in
   * applyMoodShift. */
  recruiterMoodPeakCandidateAskLpa?: number | null;

  /* Realism-Audit Fix 3 (2026-05-22) — manager-consult stall state.
   *
   * Models the multi-turn "let me check with my manager and revert"
   * leverage tactic. Three coupled fields:
   *
   * `stallTurnsRemaining` — when > 0, the recruiter is in the middle
   *   of a stall and the next AI turn must ship a stall-return outcome
   *   (small concession OR hold). Decremented to 0 after the return
   *   fires.
   *
   * `stallsFiredCount` — session-wide count of stalls opened. Capped
   *   at 3 in the planner gate so the same persona doesn't loop into
   *   "let me check with my manager" forever.
   *
   * `lastStallContext` — the stalled-ask number carried across the
   *   open turn → return turn boundary so the return prose can recap
   *   it verbatim. Cleared after the return fires.
   *
   * All three optional for back-compat with serialized state from
   * before this fix (in-flight sessions deserialize to 0 / null). */
  stallTurnsRemaining?: number;
  stallsFiredCount?: number;
  lastStallContext?: {
    /** Candidate's stalled ask (LPA, total package). */
    stalledAskLpa: number | null;
    /** Turn index when the stall opened. */
    openedAtTurn: number;
  } | null;

  /* Terminal signals (turn index where the transition fired) */
  acceptedAtTurn: number | null;
  walkedAwayAtTurn: number | null;
  /* Phase 3 missing-lever set (2026-05-17) — single-fire turn markers for
   * the three new Indian-HR levers that complement the existing
   * comparative-anchoring / internal-equity-defense / probe-justification
   * triad. Null on init; stamped by applyAiMove the turn the lever fires;
   * planner reads them as the single-fire gate. Optional for back-compat
   * with in-flight sessions and test fixtures serialised before the
   * fields shipped — deserializeState backfills to null. */
  panelApprovalStallFiredAtTurn?: number | null;
  politeWalkawayFiredAtTurn?: number | null;
  hikeStrongDefenseFiredAtTurn?: number | null;
  /* fake-leverage-challenge (2026-05-17) — single-fire turn marker for
   * the soft offer-proof probe. Null on init; stamped by applyAiMove
   * the turn the lever fires. Defensive single-fire layered on top of
   * the proofRequestedAtTurn gate on competingOfferDetail. */
  fakeLeverageChallengeFiredAtTurn?: number | null;
  /* S23-B1 (2026-07-21) — hold-phase single-fire turn marker. Null on
   * init; stamped by applyAiMove the turn the recruiter grants thinking
   * time ("Of course — take until Thursday. Let me know."). Planner
   * gates the hold-grant branch on this being null so it fires at most
   * once per session (the candidate can ask repeatedly but the recruiter
   * grants time once and the normal negotiation resumes). */
  holdGrantedAtTurn?: number | null;
  /* PDF#42 BUG-A (2026-05-21) — competitor-match single-fire marker.
   * Null on init; stamped by applyAiMove when actionKind ===
   * "competitor-match". Planner reads it as the single-fire gate so
   * the panel-match commitment doesn't ship repeatedly. */
  competitorMatchFiredAtTurn?: number | null;
  /* Audit fix 2026-05-21 — CTC-inflation cascade. Stamped by applyAiMove
   * when actionKind === "ctc-inflation-anchor" with the headline CTC at
   * fire time (typically state.candidateTarget). The truth follow-up
   * reads this back so the breakdown reuses the EXACT same numbers as
   * the inflated quote — the lie was the framing, not the values. Null
   * on init; null after a walk-away-return reset. */
  ctcInflationAnchorCtcLpa?: number | null;
  /* Symmetric ledger entry for stalemate. Stamped once when derivePhase
   * first returns "stalemate"; cleared symmetrically with the others
   * when a walk-away-return reopens the session. Lets downstream
   * planners read state directly instead of proxying through
   * leversUsed.includes("close-stalemate"). */
  stalemateAtTurn?: number | null;

  /* Phase 11 (2026-05-13) — hike % + candidate-stated rationale.
   * Computed sticky: hikePercent regenerates each turn from
   * (target, currentCtc); rationale is last-stated-wins. */
  hikePercent: number | null;
  rationale: RationaleResult | null;

  /* Phase 13 (2026-05-13) — notice period + joining bonus + buyout
   * signals. Sticky: notice days and joining-bonus ask persist
   * across turns; buyoutRequested / earlyJoinPreferred booleans are
   * monotone-up. */
  noticeJoining: NoticeJoiningResult;

  /* Phase 14 (2026-05-13) — equity vesting preferences + literacy.
   * Captures vesting years, cliff months, cash/equity preference,
   * and candidate's prior equity experience. */
  equityVesting: EquityVestingResult;

  /* Phase 15 (2026-05-13) — work mode (remote/hybrid/office) +
   * candidate location + relocation signals. */
  locationMode: LocationModeResult;

  /* Phase 16 (2026-05-13) — structured competing-offer detail.
   * Complements the existing `competingOffer: number` magnitude with
   * company + status + stage + letter-share signals. */
  competingOfferDetail: CompetingOfferDetail;

  /* Phase 17A (2026-05-13) — decision deadline + conditional accept.
   * deadlineDays sets the AI's closing-pressure pacing; conditional
   * acceptance downgrades the legacy signalsAcceptance to a "trade
   * proposal" the move-picker should counter on. */
  decisionDeadline: DecisionDeadlineResult;

  /* Phase 17B (2026-05-13) — candidate background. Career gap, tenure
   * cadence, and over/under-qualified self-statement. Materially
   * affects the AI's framing of joining bonus, level fit, and
   * retention. */
  candidateProfile: CandidateProfileResult;

  /* Phase 17F (2026-05-13) — scalar candidate signals: floor, salary-
   * review cycle, proof-of-CTC shareability, internal-counter risk. */
  miscSignals: MiscSignalsResult;

  /* Phase 18 (2026-05-13) — candidate stance / posture (rigidity,
   * market-reference, salary-only-factor, badmouth, confidential
   * overshare, desperation, equity-as-cash). Drives the follow-up
   * router and red-flag detector — both pure derived views recomputed
   * each turn. */
  candidateStance: CandidateStanceResult;

  /* Phase 24c (2026-05-13) — promoted sales / contract comp-structure
   * detectors. Previously utterance-grade only (Phase 22). Now sticky
   * across turns: numeric facts (OTE, base, attainment, day rate,
   * utilization) are last-stated-wins; red-flag booleans are
   * monotone-up. Lets the recruiter side reason across turns ("you
   * quoted ₹40L OTE 3 turns ago; what was the base?"). */
  salesOTE: SalesOTEResult;
  contractRate: ContractRateResult;

  /* Phase 27 — retention-counter from current employer. Materially
   * affects the new-employer's leverage: they now have to beat TWO
   * numbers, and the candidate's "exit story" gets noisier. */
  retentionCounter: RetentionCounterResult;

  /* Phase 29 (2026-05-14) — Role-applicable YOE. Distinguishes the
   * candidate's TOTAL career YOE from the YOE that maps to the TARGET
   * role's domain. A Senior Product Designer with 6 years applying for
   * a Java Developer role has totalYoe=6 but applicableYoe≈0; the
   * kernel must use applicableYoe (not totalYoe) when sizing the band,
   * the hike%, and the recruiter framing for a domain pivot. All three
   * are session-immutable once initialised (computed from resumeProfile
   * + targetRole at init); null = unknown signal. */
  candidateTotalYoe: number | null;
  candidateApplicableYoe: number | null;
  candidatePrimaryDomain: string | null;

  /* Bug-report 11 (2026-05-14) — mid-session fresh-grad disclosure. The
   * candidate told us mid-conversation that they're pre-graduate / a
   * fresh grad / still in college. When true, candidateApplicableYoe is
   * forced to 0 AND the band rebases to entry-tier via resolveServerBand
   * (Phase 30, 2026-05-14) — clamped so the new ceiling is never below
   * highestOfferMade, preserving the close-floor invariant. Sticky once set. */
  freshGradDisclosed: boolean;

  /* S39 (2026-07-23) — candidate mentioned WFH/remote/hybrid flexibility
   * before any salary facts were established. Sticky once set. Surfaced in
   * compactTurnBrief so the LLM acknowledges it and doesn't jump to a
   * salary number on the same turn. Also appears in the discovery-complete
   * summary so it's not silently dropped (S39-B3). */
  wfhFlexibilityMentioned?: boolean;

  /* Bug 7 (2026-05-14) — anti-repetition of recruiter benefits. Tracks
   * the set of RecruiterFactToken values that the bot has already
   * surfaced in this session. Fed back into compactTurnBrief so the
   * LLM knows not to restate them verbatim. */
  recruiterFactsAlreadySaid: string[];

  /* Audit follow-up (2026-05-21) — cross-turn answer coherence ledger.
   *
   * The off-script answer-from-factPack path (response-pipeline.ts
   * generateAnswerToCandidate) rebuilds the factPack fresh per turn.
   * Without a memory of what the bot has already answered for a given
   * intent, the LLM could land on inconsistent factual answers across
   * turns ("vesting is 25/25/25/25" turn 4, "vesting is 1-year cliff
   * then quarterly" turn 9). The ledger records the *intent* (coarse
   * bucket from detectCandidateAskedQuestion) → the canonical answer
   * the bot shipped + the turn it was shipped on. On a repeat ask of
   * the same intent, the pipeline short-circuits the LLM and ships a
   * deterministic "Just to reconfirm — <prior answer>" so the factual
   * thread stays coherent.
   *
   * Optional for back-compat with in-flight sessions serialized before
   * this field shipped; deserializeState backfills to {}. */
  /* AUDIT-W02 D4 (2026-06-08) — `phase` is tagged on write so consumers
   * can skip a reconfirm if the prior answer was given in a pre-anchor
   * phase but the current phase is post-anchor (the answer is stale). */
  answeredQuestionLedger?: Partial<Record<QuestionIntent, { answerText: string; turn: number; phase?: NegotiationPhase }>>;

  /* Fix 3 (2026-05-15) — Promise-keeping enforcement. Open promises the
   * bot has made but not yet delivered ("we can discuss X", "let me share
   * Y"). Subjects are short normalised strings; promises that get
   * fulfilled on a turn are removed. compactTurnBrief surfaces these so
   * the LLM is forced to deliver on outstanding promises. */
  pendingPromises?: string[];

  /* Fix 4 (2026-05-15) — Full-message-repetition detector. The verbatim
   * AI text the bot produced on the most recent successful turn. Word-
   * shingle Jaccard against this drives the reroll path in negotiate-
   * turn.ts. Null on init; set in applyAiMove. */
  lastBotReply?: string | null;

  /* Fix 7 (2026-05-15) — Anchor recomputation suppression. In a real
   * session the initial anchor jumped from ₹34L on turn 1 to ₹24L on
   * turn 2 with no candidate action — band.initialOffer was being
   * re-derived per turn. Once the recruiter discloses the opening
   * anchor, this flag locks band.initialOffer for the remainder of
   * the session: subsequent rebases may move maxStretch / walkAway
   * but never reset initialOffer downward. Default false; toggled to
   * true on the first turn that reveals a comp number. */
  anchorLocked?: boolean;
  /** Fix 7 (2026-05-15) — the locked anchor value (LPA) for this
   *  session. Set when anchorLocked transitions false → true. */
  lockedAnchorLpa?: number | null;

  /* Fix 3 (PDF #17 follow-up, 2026-05-15) — premature-close guard.
   * Real session ended after ~6 turns with "View Result" button, no
   * resolution. Block ANY transition to a terminal phase before this
   * turn count unless the candidate explicitly declined OR
   * MAX_TURNS_PER_SESSION is hit. Default 8. */
  minTurnsBeforeClose?: number;

  /* PDF #17 architectural fix (2026-05-15) — discovery-first state
   * machine. The recruiter MUST collect a minimum bar of discovery
   * items (current CTC, fixed/variable split, notice period,
   * competing offers, role-specific value proof, target CTC) BEFORE
   * disclosing an anchor band. The checklist tracks ask/answer pairs
   * per item. Optional for back-compat with in-flight sessions;
   * deserializeState backfills via backfillDiscoveryChecklist. */
  discoveryChecklist?: import("./_discovery-stage").DiscoveryChecklist;

  /* PDF #17 architectural fix (2026-05-15) — explicit discovery-first
   * stage machine layered on top of the existing phase machine. The
   * legacy `phase` field remains the authoritative kernel state; this
   * `discoveryStage` runs in parallel as an informational signal for
   * compactTurnBrief and the move-picker. Optional for back-compat. */
  discoveryStage?: import("./_discovery-stage").DiscoveryStage;

  /* Tier-2 ship (2026-05-15) — non-salary constraints. Hard, non-comp asks
   * that materially change the recruiter's playbook (WFH days, parent-care
   * location lock, specific office). Captured as a single optional object
   * to avoid the 9-site fanout pattern: new constraint fields land as keys
   * here, not as new top-level state fields. */
  nonSalaryConstraints?: import("./_non-salary-constraints").NonSalaryConstraints;

  /* Tier-? ship (2026-05-15) — post-acceptance onboarding message. Built
   * once when the kernel transitions to `accepted` (or soft-accept), so
   * the response layer can concatenate it onto the close turn rather than
   * have the LLM improvise onboarding language. Pure derived; sticky once
   * set so a follow-up terminal restate still surfaces it. Optional for
   * back-compat. */
  postAcceptanceMessage?: string;

  /* PDF#48 follow-up (2026-05-26) — structured chunks of the same
   * post-acceptance content, one logical beat per entry (congrats,
   * doc checklist, BGV, counter-offer heads-up, joining-date). The
   * joined-string `postAcceptanceMessage` above is a back-compat view
   * of these chunks (joined with paragraph breaks); the chunks array
   * is the forward-compatible source of truth for a future engine
   * fan-out that renders one bubble per beat instead of one wall-of-
   * text bubble. Populated alongside `postAcceptanceMessage` whenever
   * `attachPostAcceptanceMessage` fires; readers that don't fan out
   * yet can ignore this field. Optional for back-compat. */
  postAcceptanceFollowups?: string[];

  /* Sprint A.4 (2026-05-15) — current employer (free-form, normalized
   * downstream). Detected from utterances; threaded into the
   * counter-offer-risk detector so the well-funded-employer signal can
   * fire. Optional for back-compat. */
  currentEmployer?: string;

  /* Sprint B.2 (2026-05-15) — refusal-count tracker for the number
   * discipline gate. Increments when the candidate dodges a probe for
   * their expectation. Optional. */
  probeRefusalCount?: number;

  /* PDF#18 follow-up (2026-05-15) — range-disclosure phase enum.
   * Records the turnIndex at which the bot first emitted a salary
   * RANGE (e.g. "₹18-22L band"). Set in applyAiMove when
   * detectRangeDisclosure fires on the bot text. derivePhase uses this
   * to transition out of the new "range-disclosure" phase once the
   * candidate has reacted (one turn later). Optional for back-compat. */
  rangeDisclosedAtTurn?: number | null;

  /* PDF#18 follow-up (2026-05-15) — current-vs-expected split
   * disambiguation. Records the subject of the LAST discovery question
   * the bot asked, so when the candidate then provides a "fixed +
   * variable" split utterance, the detector knows whether to flag it
   * against currentCtcFixedVariableSplitDisclosed (subject='current')
   * or expectedCtcFixedVariableSplitDisclosed (subject='expected').
   * Set in applyAiMove from move.rationale (which carries the next
   * ordered-discovery item key). Optional. */
  lastDisclosureSubject?: "current" | "expected" | null;

  /* P4 (2026-05-15) — per-item refusal tracking for the refusal-fallback
   * path in getNextOrderedDiscoveryItem. When the candidate refuses an
   * item ≥2 times, the kernel skips it and moves to the next ordered
   * item. Keys are DiscoverySequenceItem values; values true once the
   * item has been refused enough times. Optional. */
  discoveryRefusedItems?: Record<string, boolean>;

  /* P4 (2026-05-15) — the discovery sequence item the bot just asked
   * about (set in applyAiMove from move.rationale). Used by
   * applyCandidateAnswer to attribute refusals to the correct item. */
  lastDiscoveryItemAsked?: string | null;

  /* Sprint B.3 (2026-05-15) — in-hand vs CTC anchor disambiguation. When
   * true, candidateTarget is in-hand (not CTC). The CTC-equivalent is
   * stored separately so downstream consumers can switch frames.
   *
   * Schema-stability fix (2026-06-15): both fields are initialized in
   * initState and set/CLEARED on every total-target restatement, so they
   * are part of the frozen kernel schema rather than conditionally added
   * keys. The cleared sentinel is `null` (the kernel-wide convention for
   * "absent"), NOT `undefined` — `undefined` survives in-memory key parity
   * but JSON.stringify drops it, which would break serialize round-trip
   * schema parity.
   *
   * Typed optional (`?`) to match the kernel's backfilled-field convention
   * (candidateAskedAsRange, stalemateAtTurn, …): the runtime presence
   * guarantee comes from initState seeding them + applyCandidateAnswer
   * always set-or-clearing them + deserializeState backfilling them, not
   * from the type. Hand-built test fixtures may omit them. */
  candidateTargetIsInHand?: boolean;
  candidateTargetCtcEquivalentLpa?: number | null;

  /* PDF #18 root-cause (2026-05-15) — candidate-disclosure acks. Tracks
   * candidate-disclosed facts (notice period, current CTC, competing
   * offer, joining date) the bot has NOT yet acknowledged. Pushed in
   * applyCandidateAnswer when a disclosure is detected; pruned in
   * applyAiMove when the bot reply addresses it. Surfaced via the
   * brief as [CANDIDATE DISCLOSED — ACKNOWLEDGE THIS TURN: ...]. */
  pendingCandidateAcks?: import("./_candidate-disclosure-tracker").CandidateDisclosureEntry[];

  /* Architectural bug-prevention (2026-05-15) — decision log. Append-only
   * record of every move the kernel picked, with rationale, phase at pick
   * time, and the bracket tags injected into the brief this turn. Lets us
   * reconstruct *why* the kernel moved as it did from final state alone,
   * which is the prerequisite for the replay harness. Optional for
   * back-compat. */
  decisionLog?: Array<{
    turn: number;
    picker: string;        // e.g. "probe-mismatch", "discovery-next", "range-disclosure", "anchor", "concession"
    rationale: string;     // short human-readable reason
    phase: NegotiationPhase;
    briefTags?: string[];  // which bracketed tags were injected this turn
    /* M2 PR-3 (2026-06-07) — capture the actionKind + family that the
     * move-picker landed on this turn. Optional and additive (existing
     * entries without these fields remain valid). Powers the
     * family-level guardrails: lookback at decisionLog[n-1].family is
     * how the pressure-leverage rate limit checks "was the previous
     * move already a coercive move?" without a separate state field. */
    actionKind?: string;
    family?: import("./_action-families").ActionFamily | "unmapped";
    /* M2 PR-3 — guardrail violations triggered on this turn. Each entry
     * is a short string like "pressure-repeat" naming the rule that
     * flagged. Observability-only this PR: the move is NOT substituted;
     * future PRs can flip selected rules to enforce once the telemetry
     * confirms the substitution path is safe. */
    guardrailFlags?: string[];
  }>;

  /* Architectural bug-prevention (2026-05-15) — last-turn brief tags. Set
   * by compactTurnBrief, read by the move-picker so the decision log can
   * record which bracket-tagged directives were in front of the LLM on
   * the turn the move was chosen. One-shot per turn; cleared in applyAiMove. */
  lastBriefTags?: string[];

  /* Negotiation-flow redesign commit 1 (2026-05-15) — TurnDelta.
   * Captures WHAT CHANGED on the most recent candidate turn (folded by
   * applyCandidateAnswer) so downstream consumers can route reactively
   * ("candidate just disclosed competing offer — probe credibility")
   * instead of from accumulated state ("competing offer is set, but who
   * knows when it was set"). Cleared (null) by applyAiMove. Optional for
   * back-compat — older serialized sessions deserialize without it and
   * any consumer must null-check. */
  lastTurnDelta?: TurnDelta | null;

  /* Negotiation-flow redesign commit 3 (2026-05-15) — cached NextAction.
   * planNextAction is stamped onto state at the END of applyCandidateAnswer
   * (after phase derivation) and cleared (null) by applyAiMove. Both the
   * move-picker and compactTurnBrief read from this single field, so the
   * brief's [NEXT REQUIRED ACTION] line and the rationale on move.lever
   * cannot diverge — they're produced by the SAME planner call. Optional
   * + nullable for back-compat with sessions serialized before commit 3:
   * pickAiMoveCore replays planNextAction when the field is absent. The
   * declared type is `unknown` so this module doesn't take a runtime
   * dependency on _next-action-planner.ts (which depends on this module
   * for state types); consumers cast to NextAction. */
  plannedNextAction?: unknown | null;

  /* AR2 telemetry wire-in (2026-05-25) — the action that was SHIPPED on
   * the previous AI turn (i.e. state.plannedNextAction at the moment
   * applyAiMove ran). Used by the response-pipeline's
   * validateTurnCoherence call to compare prevAi vs nextAi without the
   * kernel having to reverse-import _next-action-planner. Stored as
   * `unknown` for the same back-compat / no-cycle reasons as
   * plannedNextAction. Cleared explicitly only by initState; consumers
   * cast to NextAction. */
  lastShippedAction?: unknown | null;

  /* Negotiation-flow redesign commit 4 (2026-05-15) — reactive-followup
   * de-dupe ledger. Each reactive trigger (variable-comfort,
   * competing-credibility, notice-buyout, hike-justification,
   * answer-direct, refused-advance, fresh-grad-rebase) pushes its topic
   * here when the planner emits a reactive-followup action. Consulted
   * by the planner before re-emitting so the same probe doesn't fire
   * twice in the same session. Optional + nullable for back-compat
   * with sessions serialized before commit 4. */
  reactiveFollowupsFired?: DiscoveryTopic[];

  /* Bad-faith tactic injection ledger (2026-05-29). The planner pushes
   * a tactic kind here when it emits a tactic action so the same tactic
   * cannot fire twice in the same session. Optional + nullable for
   * back-compat with sessions serialized before this field. */
  tacticsUsed?: string[];

  /* Bad-faith tactic detection by the user (2026-05-29). When the
   * candidate names/calls out a tactic the recruiter used this session,
   * detectUserCaughtTactic() pushes the tactic kind here so the report
   * layer can surface it as a positive coaching signal in NPS / quality
   * scoring. Optional + nullable for back-compat. */
  userCaughtTactics?: string[];

  /* 2026-05-29 realism-pass — strict in-session variant rotation.
   *
   * The 14-topic curated bank has 2-5 paraphrase variants per entry.
   * The renderer hashes (sessionId, turnIndex) to pick an index, so
   * within a session, re-asks of the same topic on different turns
   * land on DIFFERENT seeds — but with 3 variants there's a 1/3
   * collision probability that the second ask gets the same variant
   * as the first.
   *
   * This ledger tracks per-topic serve count (number of times the
   * planner emitted an answer-direct for that curated topic in this
   * session). The renderer adds the count to the hash index, giving
   * strict non-repetition: ask #1 → variant 0, ask #2 → variant 1,
   * ask #3 → variant 2, ask #4 wraps to variant 0 (or whatever the
   * shifted hash lands on). Real recruiters never re-phrase identically
   * within a single call.
   *
   * Keyed by the candidate-question topic string (e.g. "variable-comfort",
   * "esop-structure"). Optional + nullable for back-compat with
   * sessions serialized before this field. */
  candidateQuestionServeCount?: Partial<Record<string, number>>;

  /* 2026-05-29 realism-pass — candidate register classifier output.
   *
   * Inferred register of the candidate ("formal" | "casual" | "direct" |
   * "neutral") based on their last-N utterances. Recomputed by
   * applyCandidateAnswer on every candidate turn via
   * classifyFromLog(state.conversationLog). Consumed downstream by
   * humanizeRecruiterProse to bias persona-tic selection so the
   * recruiter mirrors the candidate's register instead of speaking past
   * it.
   *
   * Defaults to "neutral" until enough signal accumulates (≥2 hits in
   * one bucket within a 5-utterance window). Optional + nullable for
   * back-compat with sessions serialized before this field. */
  candidateRegister?: "formal" | "casual" | "direct" | "neutral";

  /* Polish 2 (2026-05-16) — per-topic fire-history (turn indices at
   * which each topic was fired). The legacy `reactiveFollowupsFired`
   * is single-fire dedup; this parallel ledger lets refireable topics
   * (tax-implication, notice-buyout, range-to-point) revisit 2-3
   * times across a session subject to a per-topic max-count + minimum
   * turn-gap, more accurately modelling how Indian candidates revisit
   * sticky topics. Consulted by canRefire() in _next-action-planner.
   * Optional + nullable for back-compat with pre-Polish-2 serialized
   * sessions. */
  reactiveFollowupsFireLog?: Partial<Record<DiscoveryTopic, number[]>>;

  /* Fix 1 (2026-05-16) — leversFired ledger for Indian-context structural
   * levers (grade upgrade, retention bonus, RSU refresh, relocation,
   * perf-bonus cadence, joining-bonus explainer, band-anchor with
   * rationale). The planner consults this set during lever rotation
   * to ensure each lever fires at most once per session. Optional for
   * back-compat with sessions serialized before Fix 1. */
  leversFired?: string[];

  /* F7 (PDF#20 2026-05-15) — askedTopics repetition guard.
   * Ordered history of discovery topics the bot has asked, with the
   * turnIndex at which each ask was emitted. applyAiMove pushes here
   * whenever a move carries an askedTopic marker. planNextAction
   * consults this ledger: if the same topic appears within the last 3
   * turns, the planner skips it and advances to the next checklist item.
   * Optional for back-compat with pre-F7 serialized sessions. */
  askedTopics?: { topic: DiscoveryTopic; atTurn: number }[];

  /* PDF #28 follow-up (Month 1 PR-1, 2026-06-07) — Conversation Ledger.
   *
   * Append-only log of every fact captured, topic asked, action
   * emitted, and candidate non-answer. Single source of truth that
   * replaces (over PR-2..PR-6) the five fact-tracking surfaces:
   *   1. state.candidateCurrentCtc / candidateCurrentCompany / etc.
   *   2. state.pendingCandidateAcks[]
   *   3. state.askedTopics[]
   *   4. state.conversationLog[]
   *   5. state.userClaims{}
   *
   * In PR-1 (this PR): field is added, initialized empty, but NO
   * caller reads from or writes to it. The kernel state slots remain
   * authoritative. This is pure infrastructure — zero behavior change.
   *
   * PR-2 dual-writes from existing fact writers. PR-3 migrates dedup
   * readers. PR-4 migrates fact readers. PR-5 adds replay-the-PDF
   * regression scenarios. PR-6 locks direct slot writes behind a
   * syncFromLedger barrier with an ESLint enforcement rule.
   *
   * Optional for back-compat with pre-ledger serialized sessions. */
  ledger?: ConversationLedger;

  /* ITEM 3 (2026-05-15) — Trial-close signaling.
   *
   * candidateSignaledClose: set true by applyCandidateAnswer when the
   *   bot's PREVIOUS turn contained a trial-close ask (detectTrialCloseAsked)
   *   and the candidate replied on this turn. Sticky once true. Triggers
   *   the close-confirmation reactive rule in planNextAction.
   *
   * closeFired: set true by applyAiMove when a close-acceptance or
   *   close-walkaway move is applied. Guards the reactive rule so it
   *   only fires once.
   *
   * Optional for back-compat with sessions serialized before ITEM 3. */
  candidateSignaledClose?: boolean;
  closeFired?: boolean;

  /* Kernel-first cleanup (2026-05-16) — first-class role facts. Previously
   * read via loose extension shape in _fact-pack.ts and _canonical-prose.ts.
   * Threaded through InitStateInput and copied to state at init (defaults
   * null). All optional / nullable — absent → fact pack omits them and the
   * LLM is instructed to defer. */
  workMode?: "remote" | "hybrid" | "office" | null;
  teamSize?: number | null;
  reportingTo?: string | null;
  joiningWindow?: string | null;
  /** Additional first-class role facts surfaced alongside workMode et al.
   *  perfCycle: text describing the perf-review cadence (e.g. "annual").
   *  equityStructure: text describing equity grant shape (RSU / ESOP / none). */
  perfCycle?: string | null;
  equityStructure?: string | null;
  /** Kernel-first cleanup (2026-05-16) — candidate first name. Threaded
   *  from intake so _canonical-prose.ts doesn't have to scan the
   *  conversation log to greet by name. Log-scan stays as a fallback for
   *  legacy sessions or self-introductions mid-flow. */
  candidateName?: string | null;

  /** Perfect 3 (2026-05-16) — sticky session-wide urgency level. Promoted
   *  from per-turn TurnDelta.urgencySignal via a monotone upgrade rule
   *  (firm > soft > none, never downgrades). Read by the planner — gated
   *  on discovery-complete — to bias closing-push toward close-recap-formal
   *  when the candidate has surfaced a firm deadline. Default "none". */
  cumulativeUrgency?: "none" | "soft" | "firm";

  /** PDF#27 Fix 2 (2026-05-17) — turn-index at which the candidate
   *  expressed a repetition complaint ("you're repeating", "I already
   *  answered that"). Set by applyCandidateAnswer when it detects the
   *  pattern; read by planNextAction so the next probe force-advances
   *  past the topic the candidate is complaining about. Null when no
   *  complaint registered. Sticky to the turn it landed at — the
   *  planner consumes-and-clears via the askedTopics ledger. */
  repetitionComplaintAtTurn?: number | null;

  /** PDF#27 Fix 5 (2026-05-17) — turn-index at which the candidate
   *  asked for the company's offer ("what's the offer?", "share the
   *  offer", "what are you offering?"). Set by applyCandidateAnswer;
   *  read by the anchor-with-band lever so the band-disclosure fires
   *  on the very next turn rather than after the discovery cascade. */
  offerAskedAtTurn?: number | null;

  /** Phase 2 Indian-HR redesign (2026-05-17) — turn-index at which the
   *  post-acceptance documentation request lever fired (Congrats + BGV
   *  paperwork checklist). Stamped by applyAiMove when
   *  move.actionKind === "post-acceptance-document-request". Single-fire
   *  per session — read by the planner so the lever doesn't re-emit. */
  postAcceptanceDocsRequestedAtTurn?: number | null;

  /** FL5 / Audit Pass 4 (PDF#27, 2026-05-17) — turn-index at which the
   *  candidate's reply was hedged ("not sure", "around 30", "I think",
   *  "approximately", "don't remember"). Set by applyCandidateAnswer;
   *  read by the planner so the next move offers a range / escape
   *  hatch on the same topic instead of grinding on an exact value. */
  lastAnswerUncertainAt?: number | null;

  /** PDF#32 BUG H (2026-05-18) — turn-index at which the candidate's
   *  reply was an unparseable noise artifact (empty after trim, or
   *  stage-direction text like "audible" / "[noise]" / "[unclear]"
   *  surfaced by the STT layer). Set by applyCandidateAnswer; the same
   *  pass also rewinds the askedTopics tail so the planner re-fires
   *  the prior probe instead of advancing past a topic the candidate
   *  never addressed. Mostly diagnostic — downstream analyzers can
   *  count noise turns to flag transcription degradation. */
  lastAnswerNoiseAtTurn?: number | null;

  /** PDF#34 Fix 3 (2026-05-18) — turn-index at which the candidate
   *  asked a CLARIFICATION about a term the bot just used ("what is
   *  that?", "what's vesting?", "huh?", "I don't understand", "?"
   *  alone). Distinct from off-topic (the candidate IS on-topic — they
   *  just don't know the term) and from uncertainty (which is about
   *  the candidate's own value, not the bot's question).
   *
   *  Set by applyCandidateAnswer; read by the planner to emit a
   *  `clarify-prior-question` action that defines the term inline
   *  before re-asking. Without this gate, real Indian-PD candidates
   *  who don't know vesting jargon get the off-topic deflection
   *  ("this conversation is about…") and bounce. */
  lastAnswerClarificationAtTurn?: number | null;

  /** PDF#35 Move 1 (2026-05-18) — turn-index at which the candidate
   *  asked the bot to RECAP / REPEAT / SUMMARISE the standing offer
   *  AFTER the anchor had already been put on the table. Distinct from
   *  `offerAskedAtTurn` (which fires BEFORE the anchor — "what's the
   *  offer?" pre-anchor → triggers anchor-with-offer). This stamp
   *  fires ONLY when highestOfferMade > 0 already and the candidate
   *  is asking to be reminded ("what was the offer again?", "can you
   *  restate the CTC?", "summarise where we landed").
   *
   *  Read by the planner to route to `offer-recap` instead of looping
   *  through `band-disclosure-deflect`. */
  lastAnswerOfferRecapAtTurn?: number | null;

  /** AR3 / Audit Pass 4 (PDF#27, 2026-05-17) — turn-index at which the
   *  current state.phase was entered. Stamped by derivePhase whenever
   *  the phase changes. Read by the per-phase maxTurns cap so a phase
   *  that overstays its budget force-advances instead of looping. */
  phaseEnteredAtTurn?: number | null;

  /** ResumeFactPack track (2026-05-16) — structured resume-derived facts
   *  built once at session-init and stored frozen on state. Replaces the
   *  earlier path that reduced the parsed resume to ~6 scalars and threw
   *  away the rest. Read by the credibility-probe lever, the counter-math
   *  prior-CTC floor, and the fact-pack restyle layer. Optional for
   *  back-compat with sessions serialized before this field shipped.
   *  Frozen at init — never mutated mid-session. */
  resumeFactPack?: import("./_resume-fact-pack").ResumeFactPack | null;

  /** Resume-derived implied prior CTC (LPA). Derived once at init from
   *  resumeFactPack.latestRole.companyTier × role-family median band.
   *  When candidate withholds current CTC, the counter-offer split math
   *  uses this as a floor (logged, never silent). Null when the latest
   *  role can't be resolved to a tier band. */
  impliedPriorCtcFromResume?: number | null;

  /** ResumeFactPack track (2026-05-16) — most-recent candidate-stated
   *  current-company affiliation, parsed from "I'm at X" / "I work
   *  at X" / "currently at X" patterns in candidate utterances. Sticky
   *  last-stated-wins. Read by the credibility-probe lever to compare
   *  against resumeFactPack.latestRole / priorCompanies. Null when the
   *  candidate has not stated a current company. */
  candidateStatedCurrentCompany?: string | null;

  /** ResumeFactPack track (2026-05-16) — credibility-probe ledger.
   *  True once the credibility-probe has fired this session (single-fire);
   *  prevents re-asking the same alignment question. */
  credibilityProbeFired?: boolean;

  /** ResumeFactPack track (2026-05-16) — turn index at which we
   *  deliberately AVOIDED the credibility-probe because the resume
   *  confirmed the stated company. Null when not yet evaluated. Read
   *  by the decision log for visibility — "we saw the affiliation
   *  match and chose not to probe". Avoids polluting leversUsed
   *  (which is a real-lever ledger). */
  credibilityProbeAvoidedAt?: number | null;

  /** Parallel provenance map for candidateProfile flags. Key = flag
   *  name (CandidateProfileResult field). Value = "resume" when the
   *  flag was seeded from ResumeFactPack at init, "stated" when set
   *  later by a candidate utterance. Candidate utterances confirm
   *  resume facts via the monotone-up merge in mergeCandidateProfile —
   *  they never downgrade them. Read by the planner / restyle layer
   *  when it needs to know "did the candidate actually say this or
   *  did we infer it from the CV". Optional for back-compat. */
  flagProvenance?: Record<string, "resume" | "stated">;

  /** Prompt-injection defense telemetry (2026-05-17). One record per
   *  candidate turn on which `detectAndSanitizeInjection` flagged the
   *  raw utterance and span-redacted it. Silent — the AI's response is
   *  unchanged in shape; this ledger lets us see attack rate / which
   *  patterns hit in prod without telegraphing the defense to the
   *  candidate. Empty array at session start; never cleared. */
  promptInjectionAttempts: Array<{
    atTurn: number;
    patterns: string[];
    originalLength: number;
    sanitizedLength: number;
  }>;

  /* Phase 5 Session A (2026-05-19) — multi-round simulated persona switch.
   *
   * The kernel can cycle a single conversation through three sequential
   * "rounds" (HR Partner → Hiring Manager → Director). To the candidate
   * it reads as one continuous interview that hands off mid-session.
   * Default-OFF opt-in: when `multiRoundEnabled` is false (the HEAD
   * default), the kernel behaves byte-identical to single-round — none
   * of the round fields ever mutate.
   *
   * When enabled:
   *   - `roundPersona` starts at "hr-partner" and advances via
   *     `selectNextRoundPersona` as the kernel detects round-end signals
   *     (closing-push reached, or accepted / walked-away phase) for
   *     rounds 0..1; round 2 (Director) is terminal.
   *   - `roundIndex` 0 → 1 → 2, monotone-up. Stays at 2 once Director.
   *   - `roundTransitions` accumulates the per-handoff ledger so
   *     downstream consumers (analyzer in Session B, UI dashboard) can
   *     reconstruct the round trajectory from state alone.
   *   - `perRoundBand` lets callers pre-resolve per-round band overrides
   *     (HR Partner = floor only; HM = floor + 8% stretch; Director =
   *     full stretch). `initState` derives defaults from the base band
   *     when caller omits.
   *
   * All five fields are optional / nullable so existing serialised
   * sessions deserialise unchanged.
   *
   * ── Default-OFF byte-identical invariant ───────────────────────────
   * When `multiRoundEnabled !== true` (the HEAD default), every code
   * path that reads these fields short-circuits to the pre-Phase-5
   * behaviour:
   *   - `maybeAdvanceRound` returns the state untouched
   *     (no roundTransitions append).
   *   - `_canonical-prose.ts:activeRoundPersona` returns null
   *     (sector-only prose branch — pre-Phase-5 byte-identical).
   *   - `_next-action-planner.ts` round-transition pre-emption is
   *     gated on `multiRoundEnabled === true && roundTransitions.length > 0`.
   *   - The Session B analyzer block on `meta.salaryNegotiation` is
   *     additive only — never mutates existing fields.
   * The integration test fixtures in
   * `src/__tests__/integration/phase5RoundPersonaProse.test.ts`
   * exercise the OFF path explicitly and assert byte-identity against
   * the v8 sector-default surfaces. */
  roundPersona?: NegotiationRoundPersona;
  /* Optional on the interface so legacy partial-state test fixtures and
   * pre-Phase-5A serialised sessions deserialise without TS errors. The
   * kernel always treats `undefined` as 0 / [] / false respectively —
   * see `maybeAdvanceRound` and the planner's pre-emption guard. */
  roundIndex?: 0 | 1 | 2;
  roundTransitions?: Array<{
    atTurn: number;
    from: NegotiationRoundPersona;
    to: NegotiationRoundPersona;
  }>;
  multiRoundEnabled?: boolean;
  perRoundBand?: Record<NegotiationRoundPersona, NegotiationBand>;

  /** Memory feature (2026-05-29) — recorded user claims with the turn at
   *  which each was FIRST seen. The kernel writes the claim on first
   *  mention; subsequent mentions are compared against the recorded value
   *  to detect contradictions (±10% tolerance on numeric claims). Optional
   *  for back-compat. */
  userClaims?: UserClaims;

  /** Prior-context feature (2026-05-29) — caller-declared context the
   *  user announces UP FRONT at session init (NOT parsed from
   *  utterances). Lets the kernel + planner adjust strategy from turn
   *  zero when the candidate already holds a competing written offer or
   *  a retention package from their current employer. SET ONCE at
   *  initState via NegotiationKernelInput.priorContext; the planner
   *  reads it on every turn but never mutates it. Optional / fully
   *  back-compat — when absent the planner behaves byte-identically to
   *  the pre-feature cascade. */
  priorContext?: PriorContext;

  /** Memory feature (2026-05-29) — one-shot contradiction signal stamped
   *  by applyCandidateAnswer when the current turn's parsed claim
   *  disagrees with the recorded value (outside ±10% on numbers). The
   *  planner consumes this to fire contradiction-callout; applyAiMove
   *  clears it so a single contradiction doesn't re-fire forever. */
  lastContradiction?: ContradictionSignal | null;

  /** Scope-typed compensation model (architecture upgrade, 2026-06-17) —
   *  the candidate's stated current pay decomposed onto distinct axes
   *  (total / fixed / variable / equity). Replaces the flat-scalar
   *  currentCtc contradiction check: a base/variable figure lands on its
   *  own axis and can never be mistaken for the headline total, so a
   *  consistent breakdown ("36 base + 12 variable = 48 total") no longer
   *  fires a spurious contradiction-callout. See _compensation-model.ts.
   *  Optional / back-compat — absence ≡ EMPTY_COMP. */
  candidateComp?: CandidateComp;

  /** Affinity-dynamic feature (2026-05-29) — recruiter's per-call affinity
   *  toward the candidate. Clamped to [-3, +3]. Starts at 0. Updated each
   *  candidate turn by applyAffinitySignals based on rapport markers.
   *  Affects mood cool/rewarm probability, concession headroom, and prose
   *  warmth/cool overlay. Optional for back-compat. */
  recruiterAffinity?: number;
  affinityLedger?: AffinityLedgerEntry[];

  /** Paraphrase-loop feature (2026-05-29) — single-fire marker for the
   *  paraphrase-recap action. Set to true by applyAiMove the first turn
   *  the planner emits `paraphrase-recap`; never reset. Optional for
   *  back-compat with sessions serialized before the feature shipped. */
  paraphraseFired?: boolean;
  /** Calibrated-surprise lowball feature (2026-05-29) — single-fire
   *  marker for the `calibrated-surprise-lowball` action. Set true by
   *  applyAiMove the first turn the planner emits the probe. Never reset
   *  so the probe doesn't refire in the same session even if a fresh
   *  lowball anchor is later detected. */
  calibratedSurpriseFired?: boolean;
  /** Calibrated-surprise lowball feature — context carried from the
   *  probe-fire turn so the next applyCandidateAnswer can classify the
   *  candidate's reply (double-down vs revise-up vs ask-why) against the
   *  same numbers the probe used. Cleared once the reply lands. */
  calibratedSurpriseContext?: {
    firedAtTurn: number;
    candidateAnchor: number;
    bandFloor: number;
  } | null;
  /** Calibrated-surprise lowball feature — sticky marker set when the
   *  candidate doubled down on the lowball anchor after the probe (Branch
   *  A). The report layer surfaces this as a coaching moment ("you left
   *  money on the table"). Never reset. */
  acceptedLowball?: boolean;
  /** Calibrated-surprise lowball feature — turn the recruiter's quiet
   *  accept (`accept-lowball-quiet`) was shipped. Used by the planner to
   *  avoid re-firing the accept across subsequent turns (the close
   *  transition handles terminal stickiness from there). Null when the
   *  Branch-A accept hasn't fired this session. */
  acceptLowballQuietFiredAtTurn?: number | null;
  /** Paraphrase-loop feature (2026-05-29) — confirmation-gate ledger.
   *  When the candidate replies to a paraphrase with a correction
   *  ("no, my notice is actually 90 days"), the kernel stamps the topic
   *  + raw correction text here so subsequent turns can reference it.
   *  Sticky once set; never cleared. */
  paraphraseCorrections?: Array<{
    turn: number;
    topic: string;
    correction: string;
  }>;

  /** Proactive-sweetener feature (2026-05-30) — single-fire marker for
   *  the `proactive-sweetener` action. Set to true by applyAiMove the
   *  first turn the planner emits the sweetener. Never reset, so the
   *  recruiter never volunteers a second non-cash sweetener in the same
   *  session even if cooling signals recur. Real recruiters get ONE
   *  chance to dangle relocation / signing bonus / equity refresh /
   *  joining flex / notice-buyout-help before the conversation either
   *  closes or breaks down — the single-fire models that finite social
   *  permission. Optional for back-compat with sessions serialized
   *  before the feature shipped. */
  proactiveSweetenerFired?: boolean;
  /** Proactive-sweetener feature (2026-05-30) — which sweetener kind
   *  the planner picked based on `recruiterSectorPersona`. Read by the
   *  prose layer to render the sector + sweetener-specific verbal
   *  offer. Copied from the action payload on the firing turn. Sticky
   *  once set so coaching / report layers can attribute it post-hoc. */
  proactiveSweetenerKind?:
    | "signing-bonus"
    | "relocation"
    | "equity-refresh"
    | "joining-flexibility"
    | "notice-buyout-help";
  /** Recruiter-power-dynamics feature (2026-05-29) — scalar derived from
   *  `powerSignals` at init via `computeRecruiterPower`. Clamped to
   *  [-3, +3]. Default 0. May be recomputed mid-session ONLY when a new
   *  signal is detected (e.g. competing-process disclosure). Optional
   *  for back-compat. */
  recruiterPower?: number;
  /** Recruiter-power-dynamics feature (2026-05-29) — caller-declared
   *  signal bundle, plus mid-session detections. Optional for back-compat;
   *  default `{}`. */
  powerSignals?: PowerSignals;
}

/** Affinity-dynamic feature (2026-05-29). */
export type AffinityReason =
  | "rapport-signal"
  | "respect-marker"
  | "abrasive-tone"
  | "value-prop-signal"
  | "wasted-time"
  | "transparency"
  | "evasion";

export interface AffinityLedgerEntry {
  turn: number;
  delta: number;
  reason: AffinityReason;
}

/** Memory feature (2026-05-29) — per-claim record with first-seen turn. */
export interface UserClaimRecord<T> {
  value: T;
  firstSeenTurn: number;
}

export interface UserClaims {
  currentCtc?: UserClaimRecord<number>;
  expectedCtc?: UserClaimRecord<number>;
  competingOffer?: UserClaimRecord<{ company: string; amount: number }>;
  noticePeriod?: UserClaimRecord<number>;
  currentRole?: UserClaimRecord<string>;
}

/** Prior-context feature (2026-05-29) — user-declared upfront context
 *  at session start. Distinguished from in-utterance signals
 *  (`competingOffer`, `userClaims.competingOffer`, `competingOfferDetail`)
 *  by SOURCE: the user declared these BEFORE the simulation began, so
 *  the planner can shape opening moves around them without waiting for
 *  the discovery cascade to surface them. SET ONCE at init; never
 *  mutated. */
export interface PriorContext {
  /** Existing competing offer the candidate already holds in hand.
   *  `signed` distinguishes a written/letter-stage offer from a verbal
   *  one (verbal: recruiter probes for credibility; signed: recruiter
   *  acknowledges immediately and engages with the number). */
  existingCompetingOffer?: {
    company: string;
    amountLpa: number;
    deadline?: string;
    signed: boolean;
  };
  /** Retention package the candidate's CURRENT employer has offered to
   *  keep them. Tenure indicates payout horizon: immediate (one-shot
   *  bonus now), midYear (next review), cycleEnd (full appraisal). */
  retentionOffer?: {
    fromCurrentEmployer: true;
    amountLpa: number;
    tenure: "immediate" | "midYear" | "cycleEnd";
  };
}

/** Recruiter-power-dynamics feature (2026-05-29) — caller-declared
 *  signals about the recruiter's external pressure. Folded once at
 *  init via `computeRecruiterPower` into a scalar `recruiterPower` on
 *  state. Default `{}` → power 0 → identity behavior. */
export interface PowerSignals {
  /** Months the requisition has been open. >=6 strongly hungry; >=3 mildly. */
  openReqMonths?: number;
  /** How many other late-stage candidates the recruiter has lined up. */
  pipelineDepth?: number;
  /** Hiring-cycle timing. */
  quarterTiming?: "fresh-quarter" | "mid-quarter" | "quarter-end" | "annual-sprint";
  /** True when the candidate has stated a competing live process. May be
   *  caller-declared OR auto-flipped by `applyCandidateAnswer` when the
   *  utterance discloses one mid-session. */
  candidateHasCompetingProcess?: boolean;
}

/** Pure: fold signal bundle into a scalar in [-3, +3]. Positive = recruiter
 *  has leverage (open-req young, deep pipeline, fresh quarter); negative =
 *  recruiter is hungry (req aged, no pipeline, EOQ pressure, candidate has
 *  competing process). */
export function computeRecruiterPower(signals: PowerSignals): number {
  let p = 0;
  const m = signals.openReqMonths;
  if (typeof m === "number" && Number.isFinite(m)) {
    if (m >= 6) p += -2;
    else if (m >= 3) p += -1;
    /* m <= 1 → 0, else 0 (no bump in the "fresh" range either) */
  }
  const d = signals.pipelineDepth;
  if (typeof d === "number" && Number.isFinite(d)) {
    if (d >= 4) p += 2;
    else if (d >= 2) p += 1;
    else if (d === 0) p += -1;
  }
  switch (signals.quarterTiming) {
    case "quarter-end": p += -1; break;
    case "annual-sprint": p += -2; break;
    case "fresh-quarter": p += 1; break;
    default: break;
  }
  if (signals.candidateHasCompetingProcess === true) p += -1;
  if (p > 3) p = 3;
  if (p < -3) p = -3;
  return p;
}

export type ContradictionTopic =
  | "currentCtc"
  | "expectedCtc"
  | "competingOffer"
  | "noticePeriod"
  | "currentRole";

export interface ContradictionSignal {
  topic: ContradictionTopic;
  oldValue: number | string;
  newValue: number | string;
  firstSeenTurn: number;
  /** Company name for competingOffer; unused for numeric topics. */
  oldLabel?: string;
  newLabel?: string;
}
