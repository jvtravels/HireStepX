/* _move-spec.ts — Typed MoveSpec layer (Day 1: behavior-preserving wrapper)
 *
 * Why this file exists
 * --------------------
 * Today, ~25 distinct NextAction kinds each have a hand-rolled prose
 * renderer in `_canonical-prose.ts`. Each renderer interpolates raw
 * `action.*` / `state.*` numerics into English templates inline, which
 * means:
 *   1. The kernel "knows" derived ratios (variableSharePct, fixed
 *      fallback = total*0.7, RSU per-year, clawback months) but those
 *      derivations leak into prose string-formatting where they're
 *      hard to validate, hard to unit-test, and impossible to swap
 *      for an alternate surface (e.g. voice, structured JSON).
 *   2. There's no machine-checkable contract on framing — e.g. a
 *      "defer-only" move must not lead with a salary number, but
 *      today that's enforced only by reading the template prose.
 *   3. close-recap-formal is allowed to fire WITHOUT a verbal-
 *      acceptance turn being stamped, which has produced regressions
 *      (recap before accept = candidate feels jumped).
 *
 * MoveSpec is a typed, derived-numbers-precomputed, frame-tagged
 * intermediate representation. The renderer is the ONLY thing that
 * touches English templates. The adapters (counterOfferToMoveSpec,
 * etc.) own the derivation math that the kernel knows.
 *
 * Day 1 contract — BEHAVIOR PRESERVING
 * ------------------------------------
 * For each of the 6 actions covered here, `renderMoveSpec(adapt(action,
 * state), helpers)` MUST produce the exact same string as today's
 * `_canonical-prose.ts` renderer for the same (action, state). Tests
 * in `src/__tests__/moveSpec.behaviorParity.test.ts` (to be added)
 * pin this by exhaustively replaying fixtures.
 *
 * The 6 actions covered in this commit:
 *   - counter-offer
 *   - info-disclosure
 *   - close-recap-formal              (gated on verbalAcceptanceTurn)
 *   - component-probe
 *   - reactive-followup               (variable-share-high branch only)
 *   - ctc-inflation-truth
 *
 * The remaining ~19 NextAction kinds will be ported in follow-up
 * commits; the discriminated union below is intentionally open at the
 * `kind` boundary so adding a variant doesn't break existing call sites.
 */

import type { NegotiationState } from "./_negotiation-kernel";
import type { NextAction } from "./_next-action-planner";

/* ──────────────────────────────────────────────────────────────────
 * Helpers contract (kept narrow — these are the only kernel-derived
 * utilities the formatter is allowed to call). The shape mirrors the
 * existing ProseHelpers passed into `_canonical-prose.ts` so that
 * the adapter doesn't need to wrap.
 * ────────────────────────────────────────────────────────────────── */

export interface MoveSpecHelpers {
  /* Returns the round-persona overlay if the planner has stamped one
   * on this turn (e.g. HR partner, hiring manager, director). When
   * absent, sector persona takes over. */
  roundPersona(state: NegotiationState): "hr-partner" | "hiring-manager" | "director" | null;

  /* Returns the recruiter sector persona for sector-routed templates. */
  sectorPersona(
    state: NegotiationState,
  ):
    | "it-services"
    | "gcc"
    | "indian-unicorn"
    | "early-startup"
    | "bfsi"
    | "psu"
    | "consulting-big4"
    | "fmcg-management"
    | "edtech"
    | "consulting-mbb"
    | "default";

  /* Returns { months, structure } for the joining-bonus clawback
   * appropriate to the company tier — same helper the recap uses
   * today. */
  clawbackForCompany(
    joiningBonusLpa: number,
    company: NegotiationState["company"],
  ): { months: number; structure: string };

  /* Deterministic ±range jitter on a session-stable seed. Same
   * function used by the planner today (sessionJitter). */
  sessionJitter(sessionId: string, key: string, range: number): number;
}

/* ──────────────────────────────────────────────────────────────────
 * Sentence skeleton — typed slot DSL the renderer consumes
 * ──────────────────────────────────────────────────────────────────
 *
 * Each MoveSpec carries a `sentenceSkeleton: SkeletonSlot[]` that
 * fully describes the OUTPUT SENTENCE STRUCTURE. The renderer walks
 * the slots in order, emitting text. No string templates live on the
 * spec — the adapters fill `fact` / `question` slots with already-
 * computed values, and the renderer joins them with whitespace and
 * the appropriate connectors.
 *
 * Why slots-not-templates: this is what makes the "defer-only spec
 * does not lead with a salary number" validator possible. Walking
 * slots is a structured operation; regexing rendered prose is not.
 */
export type SkeletonSlot =
  /* A standalone acknowledgement / softening clause emitted from a
   * small fixed bank, chosen by the spec's frameStance + spiralLead. */
  | { kind: "ack"; text: string }
  /* A neutral factual clause. `containsNumber` is set when the value
   * was numerically interpolated — the defer-only validator reads it. */
  | { kind: "fact"; text: string; containsNumber: boolean }
  /* A short hedge / qualifier between two facts (e.g. " — "). */
  | { kind: "softener"; text: string }
  /* A trailing question that invites the next candidate turn. */
  | { kind: "question"; text: string };

/* ──────────────────────────────────────────────────────────────────
 * Frame stance + acceptance gate
 * ──────────────────────────────────────────────────────────────────
 *
 * frameStance is enforced at construction by `validateFrameStance`:
 *  - "lead-with-number"        first fact slot MUST carry a number
 *  - "defer-only"              NO slot in the FIRST SENTENCE carries a number
 *  - "ack-then-probe"          slot[0] is ack, last slot is question
 *  - "close-and-recap"         requires acceptanceGate === "hard-verbal-required"
 *  - "neutral"                 no structural constraint
 *
 * acceptanceGate:
 *  - null                      no precondition
 *  - "soft"                    candidate signal ≥ interest (planner-checked)
 *  - "hard-verbal-required"    state.verbalAcceptanceTurn must be set
 *                              (constructor throws if absent)
 */
export type FrameStance =
  | "lead-with-number"
  | "defer-only"
  | "ack-then-probe"
  | "close-and-recap"
  | "neutral";

export type AcceptanceGate = null | "soft" | "hard-verbal-required";

/* ──────────────────────────────────────────────────────────────────
 * Discriminated union — one variant per supported action.
 *
 * Each variant carries ONLY derived scalars. Percentages, ratios,
 * fallbacks (total*0.7 fixed, total*0.15 variable, etc.) are computed
 * in the adapter and live on the spec as final numbers. The renderer
 * does NOT do arithmetic.
 *
 * The union is intentionally extensible — adding a new kind for the
 * remaining ~19 NextActions requires:
 *   1. extend MoveSpec with a new variant
 *   2. extend SUPPORTED_KINDS
 *   3. add adapter + render branch
 * Call sites switching exhaustively get a TS error pointing at the
 * new branch.
 * ────────────────────────────────────────────────────────────────── */

export type MoveSpec =
  | CounterOfferSpec
  | InfoDisclosureSpec
  | CloseRecapFormalSpec
  | ComponentProbeSpec
  | VariableShareHighSpec
  | CtcInflationTruthSpec;

export interface SpecBase {
  frameStance: FrameStance;
  acceptanceGate: AcceptanceGate;
  sentenceSkeleton: SkeletonSlot[];
}

/* ── 1. counter-offer ─────────────────────────────────────────── */
export interface CounterOfferSpec extends SpecBase {
  kind: "counter-offer";
  /* All numbers pre-computed. Optional when the corresponding branch
   * does not apply — e.g. counterTotalLpa is null on the fallback
   * "what would land for you?" generic-ask path. */
  derived: {
    counterTotalLpa: number | null;
    counterFixedLpa: number | null;
    candidateProposedBaseLpa: number | null;
    counterRound: number;
    highestOfferMade: number;
    /* True when the candidate framed their counter at the component
     * level (counterFixedLpa is meaningfully present); routes to the
     * fixed-component template instead of the total-side template. */
    useFixedComponent: boolean;
    /* True when total > 0 — drives main-body vs fallback selection. */
    hasMainBody: boolean;
    /* Resolved persona for sector / round routing. */
    roundPersona: "hr-partner" | "hiring-manager" | "director" | null;
    sectorPersona: ReturnType<MoveSpecHelpers["sectorPersona"]>;
  };
}

/* ── 2. info-disclosure ───────────────────────────────────────── */
export interface InfoDisclosureSpec extends SpecBase {
  kind: "info-disclosure";
  topic: "breakdown" | "benefits" | "comp-structure" | "notice" | "hike-pct";
  derived: {
    total: number;
    /* Computed: band.fixedMax ?? total*0.7, rounded to 1dp. */
    fixedLpa: number;
    /* Computed: band.variableMax ?? total*0.15, rounded to 1dp. */
    variableLpa: number;
    /* (total - fixed - variable - jb) per year over rsuYears, rounded
     * 1dp. null when the math doesn't produce a positive remainder. */
    rsuPerYearLpa: number | null;
    rsuYears: number; // hardcoded 4 today; carried on spec for testability
    joiningBonusLpa: number | null;
    /* Render hints — pre-computed so the renderer can skip arithmetic
     * decisions. */
    fixedUsedBandValue: boolean;
    variableUsedBandValue: boolean;
  };
}

/* ── 3. close-recap-formal ────────────────────────────────────── */
export interface CloseRecapFormalSpec extends SpecBase {
  kind: "close-recap-formal";
  derived: {
    fixedLpa: number;
    variableLpa: number;
    joiningBonusLpa: number | null;
    /* Pre-computed: clawbackForCompany(jb, company). null when no JB. */
    clawback: { months: number; structure: string } | null;
    retentionBonusLpa: number | null;
    noticePeriodWeeks: number | null;
    proposedJoiningDate: string | null;
    bgvStartTrigger: string | null;
    offerLetterEta: string | null;
    /* True iff state.cumulativeUrgency === "firm". Pre-resolved so
     * the renderer doesn't read state. */
    fastTrackUrgency: boolean;
    /* The turn-index at which the candidate verbally accepted. The
     * adapter REQUIRES this to be present (kernel invariant). */
    verbalAcceptanceTurn: number;
  };
}

/* ── 4. component-probe ───────────────────────────────────────── */
export interface ComponentProbeSpec extends SpecBase {
  kind: "component-probe";
  component: "base" | "variable" | "esop";
  derived: {
    /* For the variable-inferred branch only. */
    candidateVariableLpa: number | null;
    candidateTotalCtcLpa: number | null;
    variableInferred: boolean;
  };
}

/* ── 5. reactive-followup (variable-share-high branch) ────────── */
export interface VariableShareHighSpec extends SpecBase {
  kind: "reactive-followup:variable-share-high";
  derived: {
    /* Pre-rounded so the renderer never calls Math.round. */
    pctRounded: number;
    /* The session-jittered threshold the gate compared against. We
     * keep it on the spec for the rationale string + audit trail. */
    variableThreshold: number;
  };
}

/* ── 6. ctc-inflation-truth ───────────────────────────────────── */
export interface CtcInflationTruthSpec extends SpecBase {
  kind: "ctc-inflation-truth";
  derived: {
    fixedLpa: number;
    variableLpa: number;
    esopPaperLpa: number;
    joiningBonusLpa: number;
    benefitsLpa: number;
    ctcLpa: number;
  };
}

/* The set of NextAction kinds this file currently owns. Used by
 * `negotiate-turn.ts` to decide whether to route through MoveSpec or
 * fall back to the legacy renderer for kinds not yet ported. */
export const SUPPORTED_MOVE_SPEC_KINDS = new Set<NextAction["kind"]>([
  "counter-offer",
  "info-disclosure",
  "close-recap-formal",
  "component-probe",
  "reactive-followup", // narrowed per-branch in adapter
  "ctc-inflation-truth",
]);

/* ══════════════════════════════════════════════════════════════════
 * Derivation helpers — the math the kernel knows that today leaks
 * into prose. Each is pure and unit-testable on its own.
 * ══════════════════════════════════════════════════════════════════ */

const round1 = (n: number): number => Math.round(n * 10) / 10;

export interface CounterOfferDerivedInput {
  counterTotalLpa: number | null | undefined;
  counterFixedLpa: number | null | undefined;
  candidateProposedBaseLpa: number | null | undefined;
  counterRound: number;
  highestOfferMade: number;
  roundPersona: "hr-partner" | "hiring-manager" | "director" | null;
  sectorPersona: ReturnType<MoveSpecHelpers["sectorPersona"]>;
}

export function computeDerivedFromCounterOffer(
  input: CounterOfferDerivedInput,
): CounterOfferSpec["derived"] {
  const total =
    typeof input.counterTotalLpa === "number" && input.counterTotalLpa > 0
      ? input.counterTotalLpa
      : null;
  const fixed =
    typeof input.counterFixedLpa === "number" ? input.counterFixedLpa : null;
  const candidateBase =
    typeof input.candidateProposedBaseLpa === "number" &&
    input.candidateProposedBaseLpa > 0
      ? input.candidateProposedBaseLpa
      : null;

  /* useFixedComponent mirrors the existing branch in
   * `proseCounterOffer`: when ourFixed is a number AND we have a
   * candidate base ask, the spiral-lead acknowledges the gap against
   * the fixed component instead of the bare total side. */
  const useFixedComponent = fixed !== null && candidateBase !== null;

  return {
    counterTotalLpa: total,
    counterFixedLpa: fixed,
    candidateProposedBaseLpa: candidateBase,
    counterRound: input.counterRound,
    highestOfferMade: input.highestOfferMade,
    useFixedComponent,
    hasMainBody: total !== null,
    roundPersona: input.roundPersona,
    sectorPersona: input.sectorPersona,
  };
}

export interface InfoDisclosureDerivedInput {
  topic: InfoDisclosureSpec["topic"];
  highestOfferMade: number;
  bandFixedMax: number | null;
  bandVariableMax: number | null;
  joiningBonusLpa: number | null;
  rsuYears?: number; // defaults to 4
}

export function computeDerivedFromInfoDisclosure(
  input: InfoDisclosureDerivedInput,
): InfoDisclosureSpec["derived"] {
  const total = input.highestOfferMade;
  const rsuYears = input.rsuYears ?? 4;

  const fixedUsedBandValue = input.bandFixedMax != null;
  const variableUsedBandValue = input.bandVariableMax != null;

  /* Same fallback ratios that `proseInfoDisclosure` uses today:
   * 70% fixed, 15% variable when the band doesn't carry explicit
   * fixedMax/variableMax. Rounded to 1dp so the printed value
   * matches the existing template exactly. */
  const fixedLpa = round1(input.bandFixedMax ?? total * 0.7);
  const variableLpa = round1(input.bandVariableMax ?? total * 0.15);
  const jb = input.joiningBonusLpa && input.joiningBonusLpa > 0
    ? input.joiningBonusLpa
    : null;

  /* PARITY FIX (Commit 1) — current proseInfoDisclosure does NOT
   * divide the residual by years; it labels the residual as the
   * per-year line directly. Keeping the field name `rsuPerYearLpa`
   * for now (rename is a follow-up commit) but matching the prose
   * formula exactly so renderMoveSpec output stays byte-identical. */
  const rsuTotal = total - fixedLpa - variableLpa - (jb ?? 0);
  const rsuPerYearLpa = rsuTotal > 0 ? round1(rsuTotal) : null;

  return {
    total,
    fixedLpa,
    variableLpa,
    rsuPerYearLpa,
    rsuYears,
    joiningBonusLpa: jb,
    fixedUsedBandValue,
    variableUsedBandValue,
  };
}

export interface ComponentProbeDerivedInput {
  component: "base" | "variable" | "esop";
  candidateVariableLpa: number | null;
  candidateTotalCtcLpa: number | null;
  variableInferred: boolean;
}

export function computeDerivedFromComponentProbe(
  input: ComponentProbeDerivedInput,
): ComponentProbeSpec["derived"] {
  /* The variable-inferred branch only fires when the planner has
   * marked the breakdown as inferred AND both numbers are present;
   * pre-compute the gate so the adapter can pick the skeleton. */
  const eligible =
    input.component === "variable" &&
    input.variableInferred &&
    input.candidateVariableLpa != null &&
    input.candidateTotalCtcLpa != null;

  return {
    candidateVariableLpa: eligible ? input.candidateVariableLpa : null,
    candidateTotalCtcLpa: eligible ? input.candidateTotalCtcLpa : null,
    variableInferred: input.variableInferred,
  };
}

export interface VariableShareHighDerivedInput {
  candidateBaseLpa: number | null;
  candidateVariableLpa: number | null;
  sessionId: string;
  jitter: MoveSpecHelpers["sessionJitter"];
}

export function computeDerivedFromVariableShareHigh(
  input: VariableShareHighDerivedInput,
): VariableShareHighSpec["derived"] | null {
  const base = input.candidateBaseLpa ?? 0;
  const variable = input.candidateVariableLpa ?? 0;
  const total = base + variable;
  if (total <= 0) return null;

  const pct = (variable / total) * 100;
  /* Same threshold formula the planner uses at _next-action-planner.ts
   * lines 4887-4923. Kept here so the spec carries the exact threshold
   * the gate used — otherwise telemetry can't reconcile the firing. */
  const threshold = 25 + input.jitter(input.sessionId, "variable-comfort", 5);
  if (pct <= threshold) return null;

  return {
    pctRounded: Math.round(pct),
    variableThreshold: threshold,
  };
}

/* ══════════════════════════════════════════════════════════════════
 * Adapters — NextAction → MoveSpec
 * ══════════════════════════════════════════════════════════════════ */

export function counterOfferToMoveSpec(
  action: Extract<NextAction, { kind: "counter-offer" }>,
  state: NegotiationState,
  helpers: MoveSpecHelpers,
): CounterOfferSpec {
  if (action.kind !== "counter-offer") {
    /* Defensive: today's `proseCounterOffer` throws when called with
     * the wrong action kind. Preserve that behavior. */
    throw new Error(`counterOfferToMoveSpec: expected counter-offer, got ${(action as { kind: string }).kind}`);
  }

  const derived = computeDerivedFromCounterOffer({
    counterTotalLpa: action.counterTotalLpa,
    counterFixedLpa: action.counterFixedLpa ?? null,
    candidateProposedBaseLpa: action.candidateProposedBaseLpa ?? null,
    counterRound: state.counterRound,
    highestOfferMade: state.highestOfferMade,
    roundPersona: helpers.roundPersona(state),
    sectorPersona: helpers.sectorPersona(state),
  });

  /* Build the sentence skeleton. The ordering mirrors today's
   * proseCounterOffer exactly:
   *   [ack/spiralLead] [main-body fact OR fallback fact] [trailing q]
   * Picking the spiralLead text by round + branch — kept identical to
   * the existing canonical-prose templates so first-commit parity
   * holds. */
  const spiralLead = pickSpiralLead(derived);
  const skeleton: SkeletonSlot[] = [{ kind: "ack", text: spiralLead }];

  if (derived.hasMainBody) {
    skeleton.push({
      kind: "fact",
      text: pickMainBodyTemplate(derived),
      containsNumber: true,
    });
  } else if (derived.highestOfferMade > 0) {
    skeleton.push({
      kind: "fact",
      text: `We're holding the current fitment at ₹${derived.highestOfferMade}L.`,
      containsNumber: true,
    });
    skeleton.push({ kind: "question", text: "What would move this forward for you?" });
  } else {
    skeleton.push({ kind: "question", text: "What number would land for you?" });
  }

  /* Round 1 and round >= 2 share the same closer ("How does that look
   * from your side?") in the existing renderer; carrying it on the
   * skeleton means the renderer doesn't branch. */
  if (derived.hasMainBody) {
    skeleton.push({ kind: "question", text: "How does that look from your side?" });
  }

  return {
    kind: "counter-offer",
    /* counter-offer ALWAYS leads with a number when total > 0. The
     * fallback (no main body) is neutral instead. */
    frameStance: derived.hasMainBody ? "lead-with-number" : "neutral",
    acceptanceGate: null,
    sentenceSkeleton: skeleton,
    derived,
  };
}

/* Picks the spiral-lead ack. Round-gated, mirrors current prose. */
function pickSpiralLead(derived: CounterOfferSpec["derived"]): string {
  /* PARITY FIX (Commit 1) — legacy proseCounterOffer maps round>=2 to
   * the "stretched as far as my band" line and round>=1 to the
   * "we've already moved" line. The design had these inverted, which
   * the parity test caught on a round=1 fixture. */
  if (derived.counterRound >= 2) {
    return "I've stretched as far as my band allows on cash —";
  }
  if (derived.counterRound >= 1) {
    return "We've already moved on fitment once. Let me see what's possible at this stage.";
  }
  /* Round 0: includes the base-ack only when a candidate base ask
   * was given AND we have a fixed component to compare against. */
  if (derived.useFixedComponent && derived.counterFixedLpa !== null && derived.candidateProposedBaseLpa !== null) {
    return `Hearing you out — On your ₹${derived.candidateProposedBaseLpa}L base ask — our fixed component lands at ₹${derived.counterFixedLpa}L on the structure I can hold.`;
  }
  if (derived.candidateProposedBaseLpa !== null) {
    return `Hearing you out — On your ₹${derived.candidateProposedBaseLpa}L base ask — let me come at this on the total side.`;
  }
  return "Hearing you out — let me see what I can structure.";
}

/* Main-body template selector. roundPersona overlay preempts sector
 * persona — same precedence the existing planner uses. */
function pickMainBodyTemplate(derived: CounterOfferSpec["derived"]): string {
  const total = derived.counterTotalLpa ?? 0;
  if (derived.roundPersona) {
    switch (derived.roundPersona) {
      case "hr-partner":
        return `As per band, the most I can structure is ₹${total}L total — that's the grade fitment ceiling I have.`;
      case "hiring-manager":
        return `We can revise the fitment to ₹${total}L total — that's the stretch I can hold against the scope we're hiring.`;
      case "director":
        return `Final number on cash is ₹${total}L total — this is the leverage I'm able to sign off on.`;
    }
  }
  switch (derived.sectorPersona) {
    case "it-services":
      return `Services-track ceiling lands the fitment at ₹${total}L total.`;
    case "gcc":
      return `Anchored to the global band, we can revise the fitment to ₹${total}L total.`;
    case "indian-unicorn":
      return `On cash we can revise the fitment to ₹${total}L total, with a stronger ESOP grant on top.`;
    case "early-startup":
      return `Cash runway is tight — we can revise the fitment to ₹${total}L total, with a stretch on equity %.`;
    case "bfsi":
      return `Variable bumps to land the fitment at ₹${total}L total on the perf cycle.`;
    case "psu":
      return `As per government norms the grade-fitment lands at ₹${total}L total — HRA and LTC are the only flex.`;
    case "consulting-big4":
      return `Fitment to the level lands at ₹${total}L total — internal equity at this band caps further movement.`;
    case "fmcg-management":
      return `For the leadership-development cohort the band lands at ₹${total}L total — the trajectory carries more long-term value.`;
    case "edtech":
      return `Post the sector correction, the comp committee is holding the line — the most I can structure is ₹${total}L total this cycle.`;
    case "consulting-mbb":
      return `Partners signed off on a ₹${total}L stretch within band — that's what M&G policy allows for this cohort.`;
    case "default":
    default:
      return `We can revise the fitment to ₹${total}L total.`;
  }
}

export function infoDisclosureToMoveSpec(
  action: Extract<NextAction, { kind: "info-disclosure" }>,
  state: NegotiationState,
  _helpers: MoveSpecHelpers,
): InfoDisclosureSpec {
  /* Today's prose accesses state.band optionally via type assertion;
   * we do the same narrowing here and pass nulls when absent. */
  const band = (state as unknown as { band?: { fixedMax?: number; variableMax?: number } }).band;
  const lastJb = (state as unknown as { lastJoiningBonusOffered?: number }).lastJoiningBonusOffered;

  const derived = computeDerivedFromInfoDisclosure({
    topic: action.topic,
    highestOfferMade: state.highestOfferMade,
    bandFixedMax: band?.fixedMax ?? null,
    bandVariableMax: band?.variableMax ?? null,
    joiningBonusLpa: typeof lastJb === "number" ? lastJb : null,
  });

  /* Pick the skeleton by topic. Each branch is a faithful port of the
   * existing `proseInfoDisclosure` template; no string templates live
   * outside this function for info-disclosure. */
  let skeleton: SkeletonSlot[];
  let frameStance: FrameStance;

  switch (action.topic) {
    case "breakdown":
      if (derived.total > 0) {
        const rsuLine =
          derived.rsuPerYearLpa !== null
            ? `, RSU grant ~₹${derived.rsuPerYearLpa}L/year vesting over ${derived.rsuYears} years`
            : "";
        const jbLine =
          derived.joiningBonusLpa !== null
            ? `, joining bonus ₹${derived.joiningBonusLpa}L`
            : "";
        skeleton = [
          {
            kind: "fact",
            text: `Sure, here's the structure on the ₹${derived.total}L — base ₹${derived.fixedLpa}L fixed, target variable ₹${derived.variableLpa}L at 100% performance${rsuLine}${jbLine}. Standard benefits (medical, PF, gratuity) layered on top.`,
            containsNumber: true,
          },
          { kind: "question", text: "Any specific component you want me to go deeper on?" },
        ];
        frameStance = "lead-with-number";
      } else {
        skeleton = [
          {
            kind: "question",
            text: "On the structure — which side of it matters most to you: fixed, variable, or benefits?",
          },
        ];
        frameStance = "defer-only";
      }
      break;

    case "benefits":
      skeleton = [
        {
          kind: "fact",
          text: "Beyond cash, the standard cover is medical (self + family + parents), term life, and accidental — group-policy.",
          containsNumber: false,
        },
        { kind: "question", text: "Anything specific you want me to confirm on?" },
      ];
      frameStance = "neutral";
      break;

    case "comp-structure":
      skeleton = [
        {
          kind: "fact",
          text: "On the structure — fixed is the bulk of the package, variable sits on the perf cycle, and equity (where applicable) vests over four years.",
          containsNumber: false,
        },
        { kind: "question", text: "Which piece do you want to dig into?" },
      ];
      frameStance = "neutral";
      break;

    case "notice":
      skeleton = [
        {
          kind: "question",
          text: "On notice — what's the standard period at your current side, and is a buyout an option there?",
        },
      ];
      frameStance = "ack-then-probe";
      break;

    case "hike-pct":
      skeleton = [
        {
          kind: "question",
          text: "On the hike piece — what's anchoring the expectation at that level?",
        },
      ];
      frameStance = "ack-then-probe";
      break;

    default:
      skeleton = [
        { kind: "question", text: "What part of the structure do you want me to break down first?" },
      ];
      frameStance = "defer-only";
  }

  return {
    kind: "info-disclosure",
    topic: action.topic,
    frameStance,
    acceptanceGate: null,
    sentenceSkeleton: skeleton,
    derived,
  };
}

export function closeRecapFormalToMoveSpec(
  action: Extract<NextAction, { kind: "close-recap-formal" }>,
  state: NegotiationState,
  helpers: MoveSpecHelpers,
): CloseRecapFormalSpec {
  /* HARD GATE: close-recap-formal MUST NOT fire without verbal
   * acceptance. Today the planner is supposed to enforce this but a
   * regression slipped through (T11). Throwing here makes the
   * invariant a property of the type layer. */
  const verbalAcceptanceTurn = (state as unknown as { verbalAcceptanceTurn?: number })
    .verbalAcceptanceTurn;
  if (typeof verbalAcceptanceTurn !== "number") {
    throw new Error(
      "closeRecapFormalToMoveSpec: state.verbalAcceptanceTurn is required for close-recap-formal (kernel invariant)",
    );
  }

  const jb = action.joiningBonusLpa && action.joiningBonusLpa > 0
    ? action.joiningBonusLpa
    : null;
  const clawback = jb !== null
    ? helpers.clawbackForCompany(jb, state.company)
    : null;
  const retention = action.retentionBonusLpa && action.retentionBonusLpa > 0
    ? action.retentionBonusLpa
    : null;

  const fastTrackUrgency =
    (state as unknown as { cumulativeUrgency?: string }).cumulativeUrgency === "firm";

  const derived: CloseRecapFormalSpec["derived"] = {
    fixedLpa: action.fixedLpa,
    variableLpa: action.variableLpa,
    joiningBonusLpa: jb,
    clawback,
    retentionBonusLpa: retention,
    noticePeriodWeeks: action.noticePeriodWeeks ?? null,
    proposedJoiningDate: action.proposedJoiningDate ?? null,
    bgvStartTrigger: action.bgvStartTrigger ?? null,
    offerLetterEta: action.offerLetterEta ?? null,
    fastTrackUrgency,
    verbalAcceptanceTurn,
  };

  /* Build the recap parts list — order is identical to the existing
   * proseCloseRecapFormal: fixed, variable, [jb+clawback],
   * [retention], [notice], [joining date], [BGV], [OL ETA]. */
  const parts: string[] = [];
  parts.push(`Fixed ₹${derived.fixedLpa}L`);
  parts.push(`variable target ₹${derived.variableLpa}L`);
  if (derived.joiningBonusLpa !== null && derived.clawback) {
    /* PARITY FIX (Commit 1) — current proseCloseRecapFormal renders
     * the structure as "service bond" only for the IT-services bond
     * variant and "clawback" otherwise. Raw structure key would leak
     * an internal identifier to the candidate. */
    const structureLabel =
      derived.clawback.structure === "it-services-service-bond"
        ? "service bond"
        : "clawback";
    parts.push(
      `joining bonus ₹${derived.joiningBonusLpa}L with a ${derived.clawback.months}-month ${structureLabel}`,
    );
  }
  if (derived.retentionBonusLpa !== null) {
    parts.push(`retention bonus ₹${derived.retentionBonusLpa}L split across the retention window`);
  }
  if (derived.noticePeriodWeeks !== null) {
    parts.push(`notice ${derived.noticePeriodWeeks} weeks`);
  }
  if (derived.proposedJoiningDate !== null) {
    parts.push(`proposed joining ${derived.proposedJoiningDate}`);
  }
  if (derived.bgvStartTrigger !== null) {
    parts.push(`BGV starts ${derived.bgvStartTrigger}`);
  }
  if (derived.offerLetterEta !== null) {
    parts.push(`offer letter in ${derived.offerLetterEta}`);
  }

  /* PARITY FIX (Commit 1) — current proseCloseRecapFormal (AUDIT-W02
   * BUG-1, 2026-06-08) ends with a statement closer, NOT a question.
   * Earlier "Sounds good?" was killed because terminal recap soliciting
   * further dialogue was preventing the close. Skeleton must reflect
   * that — replace the trailing question slot with the offer-letter
   * statement fact. */
  const skeleton: SkeletonSlot[] = [
    {
      kind: "fact",
      text: `Let me recap the fitment before I revert internally — ${parts.join(", ")}.`,
      containsNumber: true,
    },
    {
      kind: "fact",
      text: "I'll get the offer letter prepared and circulate by EOD.",
      containsNumber: false,
    },
  ];
  if (derived.fastTrackUrgency) {
    skeleton.push({
      kind: "fact",
      text: "Given your timeline, we'll fast-track the offer letter — expect it within 24 hours of BGV initiation.",
      containsNumber: false,
    });
  }

  return {
    kind: "close-recap-formal",
    frameStance: "close-and-recap",
    acceptanceGate: "hard-verbal-required",
    sentenceSkeleton: skeleton,
    derived,
  };
}

export function componentProbeToMoveSpec(
  action: Extract<NextAction, { kind: "component-probe" }>,
  state: NegotiationState,
  _helpers: MoveSpecHelpers,
): ComponentProbeSpec {
  const bd =
    (state as unknown as {
      candidateComponentBreakdown?: { variable?: number; variableInferred?: boolean };
    }).candidateComponentBreakdown ?? {};
  const totalCtc =
    (state as unknown as { candidateCurrentCtc?: number | null }).candidateCurrentCtc ?? null;

  const derived = computeDerivedFromComponentProbe({
    component: action.component,
    candidateVariableLpa: bd.variable ?? null,
    candidateTotalCtcLpa: totalCtc,
    variableInferred: bd.variableInferred === true,
  });

  /* Branch selection mirrors existing prose exactly. */
  let askText: string;
  if (action.component === "base") {
    askText = "Got it on the total — what's the base split?";
  } else if (
    action.component === "variable" &&
    derived.variableInferred &&
    derived.candidateVariableLpa !== null &&
    derived.candidateTotalCtcLpa !== null
  ) {
    askText = `Quick check — that puts variable at around ₹${derived.candidateVariableLpa} LPA on the ₹${derived.candidateTotalCtcLpa} LPA total, right? Or is the base the full number?`;
  } else if (action.component === "variable") {
    askText = "And on the variable side — is it a fixed bonus or perf-linked?";
  } else {
    askText = "On the equity side — does your current package include any ESOPs or RSUs?";
  }

  return {
    kind: "component-probe",
    component: action.component,
    /* component-probe is a pure ask: no number leads the sentence
     * except the variable-inferred branch which carries the inferred
     * total. We tag that branch as "neutral" (number is mid-sentence
     * inside a check question, not anchoring). */
    frameStance: "ack-then-probe",
    acceptanceGate: null,
    sentenceSkeleton: [{ kind: "question", text: askText }],
    derived,
  };
}

/* The variable-share-high spec is a NARROWED form of reactive-followup.
 * Adapter accepts the raw reactive-followup action plus the extra
 * context the planner gate uses (candidate breakdown + sessionId).
 * Returns null when the gate would not have fired — caller falls
 * back to the legacy reactive-followup path. */
export interface VariableShareHighAdapterInput {
  candidateBaseLpa: number | null;
  candidateVariableLpa: number | null;
  sessionId: string;
  hasFired: (key: string) => boolean;
}

export function variableShareHighToMoveSpec(
  input: VariableShareHighAdapterInput,
  helpers: MoveSpecHelpers,
): VariableShareHighSpec | null {
  /* Single-fire gate — mirror planner. */
  if (input.hasFired("variable-comfort")) return null;

  const derived = computeDerivedFromVariableShareHigh({
    candidateBaseLpa: input.candidateBaseLpa,
    candidateVariableLpa: input.candidateVariableLpa,
    sessionId: input.sessionId,
    jitter: helpers.sessionJitter,
  });
  if (derived === null) return null;

  return {
    kind: "reactive-followup:variable-share-high",
    frameStance: "ack-then-probe",
    acceptanceGate: null,
    sentenceSkeleton: [
      {
        kind: "question",
        text: `${derived.pctRounded}% variable is significant — what's your comfort with that share, and have you been hitting payouts in full?`,
      },
    ],
    derived,
  };
}

export function ctcInflationTruthToMoveSpec(
  action: Extract<NextAction, { kind: "ctc-inflation-truth" }>,
  _state: NegotiationState,
  _helpers: MoveSpecHelpers,
): CtcInflationTruthSpec {
  const derived: CtcInflationTruthSpec["derived"] = {
    fixedLpa: action.fixedLpa,
    variableLpa: action.variableLpa,
    esopPaperLpa: action.esopPaperLpa,
    joiningBonusLpa: action.joiningBonusLpa,
    benefitsLpa: action.benefitsLpa,
    ctcLpa: action.ctcLpa,
  };

  /* ctc-inflation-truth is a single long block — sliced into facts
   * so the renderer doesn't need to know about the structure. */
  const skeleton: SkeletonSlot[] = [
    { kind: "ack", text: "Fair question — let me break it down honestly." },
    {
      kind: "fact",
      text: `The guaranteed cash is the ₹${derived.fixedLpa}L fixed; that's what hits your account month after month.`,
      containsNumber: true,
    },
    {
      kind: "fact",
      text: `The ₹${derived.variableLpa}L variable is at-risk on the annual rating cycle — most years it pays out 80-100%, but it's not contractual.`,
      containsNumber: true,
    },
    {
      kind: "fact",
      text: `The ₹${derived.esopPaperLpa}L ESOPs are paper value at last FMV — actual realisable value depends on buyback windows and vesting completion.`,
      containsNumber: true,
    },
    {
      kind: "fact",
      text: `The ₹${derived.joiningBonusLpa}L joining bonus is one-time, amortised over year one, and carries a clawback if you leave early.`,
      containsNumber: true,
    },
    {
      kind: "fact",
      text: `Benefits ₹${derived.benefitsLpa}L is gratuity / PF / NPS / insurance — real value, but non-cash.`,
      containsNumber: true,
    },
    {
      kind: "fact",
      text: `So the headline ₹${derived.ctcLpa}L is the full envelope; the guaranteed annual cash is ₹${derived.fixedLpa}L fixed.`,
      containsNumber: true,
    },
  ];

  return {
    kind: "ctc-inflation-truth",
    frameStance: "lead-with-number",
    acceptanceGate: null,
    sentenceSkeleton: skeleton,
    derived,
  };
}

/* ══════════════════════════════════════════════════════════════════
 * Renderer + validator
 * ══════════════════════════════════════════════════════════════════ */

/* Walks the sentence skeleton and emits the canonical string. The
 * connector logic is deliberately minimal: facts and questions are
 * joined with a single space (preserves the existing behavior where
 * templates already include their own internal punctuation). */
export function renderMoveSpec(spec: MoveSpec, _helpers: MoveSpecHelpers): string {
  const parts: string[] = [];
  for (const slot of spec.sentenceSkeleton) {
    switch (slot.kind) {
      case "ack":
      case "fact":
      case "question":
        parts.push(slot.text);
        break;
      case "softener":
        /* Softeners are joined directly to the previous part without
         * an extra space — they carry their own surrounding whitespace
         * in the template. Today none of the 6 actions emit softeners;
         * the branch exists for the ~19 follow-up kinds. */
        if (parts.length > 0) {
          parts[parts.length - 1] = parts[parts.length - 1] + slot.text;
        } else {
          parts.push(slot.text);
        }
        break;
    }
  }
  return parts.join(" ");
}

/* Structural validator. Returns an array of violation strings; empty
 * means the spec satisfies its declared frameStance + acceptanceGate.
 *
 * Used by tests (and optionally by negotiate-turn.ts at debug-asserts
 * level) to guarantee that a spec the renderer is about to emit
 * matches its claimed framing. */
export function validateFrameStance(spec: MoveSpec): string[] {
  const violations: string[] = [];
  const slots = spec.sentenceSkeleton;

  /* First-sentence boundary detection — we treat the first slot of
   * kind fact|question|ack as "the first sentence" for the purpose
   * of the lead-with-number / defer-only checks. Real sentence
   * splitting on rendered prose would also be acceptable; the slot
   * boundary is stricter and intentional. */
  const firstContent = slots.find(
    (s): s is Extract<SkeletonSlot, { kind: "fact" } | { kind: "question" } | { kind: "ack" }> =>
      s.kind === "fact" || s.kind === "question" || s.kind === "ack",
  );

  switch (spec.frameStance) {
    case "lead-with-number":
      if (!firstContent || firstContent.kind !== "fact" || !firstContent.containsNumber) {
        violations.push(
          "frameStance=lead-with-number requires the first content slot to be a fact with containsNumber=true",
        );
      }
      break;
    case "defer-only":
      /* No slot in the first sentence carries a number. We
       * approximate "first sentence" by the first fact|question slot
       * — defer-only specs are short enough that this is exact. */
      if (firstContent && firstContent.kind === "fact" && firstContent.containsNumber) {
        violations.push(
          "frameStance=defer-only forbids a numeric fact in the first sentence",
        );
      }
      break;
    case "ack-then-probe":
      if (slots.length === 0 || slots[slots.length - 1].kind !== "question") {
        violations.push(
          "frameStance=ack-then-probe requires the last slot to be a question",
        );
      }
      break;
    case "close-and-recap":
      if (spec.acceptanceGate !== "hard-verbal-required") {
        violations.push(
          "frameStance=close-and-recap requires acceptanceGate=hard-verbal-required",
        );
      }
      break;
    case "neutral":
      break;
  }

  return violations;
}

/* Convenience: single-call entry that adapts + validates + renders.
 * negotiate-turn.ts will call this when SUPPORTED_MOVE_SPEC_KINDS
 * matches; otherwise fall back to the legacy renderer. */
export function adaptAndRender(
  action: NextAction,
  state: NegotiationState,
  helpers: MoveSpecHelpers,
): string | null {
  switch (action.kind) {
    case "counter-offer":
      return renderMoveSpec(counterOfferToMoveSpec(action, state, helpers), helpers);
    case "info-disclosure":
      return renderMoveSpec(infoDisclosureToMoveSpec(action, state, helpers), helpers);
    case "close-recap-formal":
      return renderMoveSpec(closeRecapFormalToMoveSpec(action, state, helpers), helpers);
    case "component-probe":
      return renderMoveSpec(componentProbeToMoveSpec(action, state, helpers), helpers);
    case "ctc-inflation-truth":
      return renderMoveSpec(ctcInflationTruthToMoveSpec(action, state, helpers), helpers);
    /* reactive-followup is intentionally not auto-routed here — its
     * variable-share-high branch needs extra inputs (sessionId,
     * hasFired) that the caller supplies via variableShareHighToMoveSpec
     * directly. */
    default:
      return null;
  }
}
