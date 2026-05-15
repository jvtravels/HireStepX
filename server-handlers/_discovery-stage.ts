/* Discovery-stage logic (PDF #17 architectural fix, 2026-05-15).
 *
 * Real-user diagnosis: the recruiter behaved like a friendly offer
 * explainer rather than a real HR who discovers first, anchors last,
 * tests commitment. This module implements the discovery-checklist
 * progression and role-aware question library that gates anchor
 * disclosure. Pure / stateless / side-effect-free.
 */

import type { RoleFamily } from "./_company-band-tiers";

export interface DiscoveryChecklist {
  currentCtcAsked: boolean;
  currentCtcAnswered: boolean;
  fixedVariableSplitAsked: boolean;
  fixedVariableSplitAnswered: boolean;
  noticePeriodAsked: boolean;
  noticePeriodAnswered: boolean;
  competingOffersAsked: boolean;
  competingOffersAnswered: boolean;
  /** Role-specific value proof — ARR/book for CSM, quota for sales,
   *  tech depth for engineering, product+metrics for product,
   *  portfolio for design, etc. */
  valueProofAsked: boolean;
  valueProofAnswered: boolean;
  targetAsked: boolean;
  targetAnswered: boolean;
  /** Asked separately when the role's variable component is >20%. */
  variableComfortTested: boolean;
  /** Trial-close asked before terminal. */
  commitmentValidationAsked: boolean;
  /** PDF #18 follow-up (2026-05-15) — split fixed/variable disclosure
   *  by CTC context (current vs expected). Real-HR negotiation
   *  sequence requires BOTH the current and the expected package to
   *  be broken into fixed + variable before any anchor is disclosed.
   *  Optional for back-compat with serialized state from in-flight
   *  sessions; both default to false on missing. Monotone-up. */
  currentCtcFixedVariableSplitDisclosed?: boolean;
  expectedCtcFixedVariableSplitDisclosed?: boolean;
}

export const EMPTY_DISCOVERY_CHECKLIST: DiscoveryChecklist = {
  currentCtcAsked: false,
  currentCtcAnswered: false,
  fixedVariableSplitAsked: false,
  fixedVariableSplitAnswered: false,
  noticePeriodAsked: false,
  noticePeriodAnswered: false,
  competingOffersAsked: false,
  competingOffersAnswered: false,
  valueProofAsked: false,
  valueProofAnswered: false,
  targetAsked: false,
  targetAnswered: false,
  variableComfortTested: false,
  commitmentValidationAsked: false,
  currentCtcFixedVariableSplitDisclosed: false,
  expectedCtcFixedVariableSplitDisclosed: false,
};

/** Backfill helper for deserialized state. Tolerates absence on legacy
 *  in-flight sessions. Pure. */
export function backfillDiscoveryChecklist(
  raw: unknown,
): DiscoveryChecklist {
  const v = (raw ?? {}) as Partial<DiscoveryChecklist>;
  return {
    currentCtcAsked: v.currentCtcAsked ?? false,
    currentCtcAnswered: v.currentCtcAnswered ?? false,
    fixedVariableSplitAsked: v.fixedVariableSplitAsked ?? false,
    fixedVariableSplitAnswered: v.fixedVariableSplitAnswered ?? false,
    noticePeriodAsked: v.noticePeriodAsked ?? false,
    noticePeriodAnswered: v.noticePeriodAnswered ?? false,
    competingOffersAsked: v.competingOffersAsked ?? false,
    competingOffersAnswered: v.competingOffersAnswered ?? false,
    valueProofAsked: v.valueProofAsked ?? false,
    valueProofAnswered: v.valueProofAnswered ?? false,
    targetAsked: v.targetAsked ?? false,
    targetAnswered: v.targetAnswered ?? false,
    variableComfortTested: v.variableComfortTested ?? false,
    commitmentValidationAsked: v.commitmentValidationAsked ?? false,
    currentCtcFixedVariableSplitDisclosed:
      v.currentCtcFixedVariableSplitDisclosed ?? false,
    expectedCtcFixedVariableSplitDisclosed:
      v.expectedCtcFixedVariableSplitDisclosed ?? false,
  };
}

/** The minimum-bar set of "answered" items required for each role family
 *  before the recruiter is allowed to disclose an anchor. */
export type DiscoveryItemKey =
  | "currentCtcAnswered"
  | "fixedVariableSplitAnswered"
  | "noticePeriodAnswered"
  | "competingOffersAnswered"
  | "valueProofAnswered"
  | "targetAnswered";

export function getRequiredDiscoveryItems(
  roleFamily: RoleFamily,
): DiscoveryItemKey[] {
  /* Every family needs the universal four (currentCtc,
   * fixedVariableSplit, noticePeriod, target). Most families also
   * require role-specific valueProof. Engineering treats value-proof as
   * "1-of-N" optional but we still require it because the system-prompt
   * block lists "complex systems shipped" as a probe. */
  const base: DiscoveryItemKey[] = [
    "currentCtcAnswered",
    "fixedVariableSplitAnswered",
    "noticePeriodAnswered",
    "targetAnswered",
  ];
  switch (roleFamily) {
    case "csm-cs":
    case "sales":
    case "product":
    case "design":
    case "engineering":
      return [...base, "valueProofAnswered"];
    case "marketing":
    case "data":
    case "ops":
    default:
      return base;
  }
}

export function isDiscoveryComplete(
  checklist: DiscoveryChecklist,
  roleFamily: RoleFamily,
): boolean {
  const required = getRequiredDiscoveryItems(roleFamily);
  return required.every((k) => checklist[k] === true);
}

/* Negotiation-flow redesign commit 2 (2026-05-15) — sync parsed facts → checklist.
 *
 * Audit D5: parsed-facts → checklist-flag writes were asymmetric across
 * discovery items. `currentCtcFixedVariableSplitDisclosed` was wired
 * cleanly, but `currentCtcAnswered` / `targetAnswered` / `noticePeriodAnswered`
 * / `competingOffersAnswered` / `valueProofAnswered` were ONLY written
 * via the legacy `foldFactsIntoState` whole-transcript path. The kernel-
 * managed checklist and the parsed facts had diverged. Symptom: the
 * bot re-asked notice period after the candidate volunteered "90 days
 * notice" on turn 1.
 *
 * Fix: a single function that maps parsed.* non-null fields → *Answered
 * flags. Called inside applyCandidateAnswer immediately after fact
 * binding, before phase derivation. Pure. Monotone-up — once a flag is
 * true it stays true (never blanks out a prior disclosure). Returns a
 * new checklist; original is not mutated.
 */
export interface SyncFactsInput {
  /** Parsed target value (LPA) — null = not stated this turn. */
  target: number | null;
  /** Parsed current-CTC value (LPA) — null = not stated this turn. */
  currentCtc: number | null;
  /** Parsed competing-offer value (LPA) — null = no numeric competing offer. */
  competing: number | null;
  /** Vague competing-offer signal ("I have other offers but can't share"). */
  signalsCompetingExistsWithoutNumber: boolean;
  /** Parsed competing-offer detail object — non-empty `hasAny` means
   *  the candidate disclosed structural details (company / status /
   *  stage / letter / on-hold). */
  competingOfferDetailHasAny: boolean;
  /** Parsed notice / joining signal — any of notice days, buyout,
   *  early-join, LWD text, joining-bonus-ask. */
  noticeJoiningHasAny: boolean;
  /** Parsed component breakdown carrying BOTH base and variable for
   *  the fixed/variable split flag. */
  fixedVariableSplitHasBoth: boolean;
  /** Role-specific value-proof signal — sales OTE / contract rate /
   *  profile fields (quotaAttainmentClaimed / peopleManagementClaimed /
   *  transferableSkillsClaimed / variableTrackRecord). */
  valueProofSignal: boolean;
}

export function syncChecklistFromParsedFacts(
  checklist: DiscoveryChecklist,
  facts: SyncFactsInput,
): DiscoveryChecklist {
  /* Monotone-up: only flip false → true; once true, stays true.
   * Identity-preserving when nothing changes (returns the same object
   * reference) so applyCandidateAnswer can skip a needless assignment. */
  let changed = false;
  const next: DiscoveryChecklist = { ...checklist };

  /* currentCtcAnswered ← parsed.currentCtc != null */
  if (facts.currentCtc != null && !next.currentCtcAnswered) {
    next.currentCtcAnswered = true;
    changed = true;
  }
  /* targetAnswered ← parsed.target != null */
  if (facts.target != null && !next.targetAnswered) {
    next.targetAnswered = true;
    changed = true;
  }
  /* noticePeriodAnswered ← any notice / joining signal */
  if (facts.noticeJoiningHasAny && !next.noticePeriodAnswered) {
    next.noticePeriodAnswered = true;
    changed = true;
  }
  /* competingOffersAnswered ← numeric competing OR vague-exists OR
   * structural competing-offer detail. The audit calls out that vague
   * signals ("I have other offers") legitimately satisfy the discovery
   * item — the recruiter has the leverage information they need; further
   * probing comes through the *follow-up* path, not the checklist gate. */
  if (
    (facts.competing != null ||
      facts.signalsCompetingExistsWithoutNumber ||
      facts.competingOfferDetailHasAny) &&
    !next.competingOffersAnswered
  ) {
    next.competingOffersAnswered = true;
    changed = true;
  }
  /* fixedVariableSplitAnswered ← parsed breakdown carries both base+variable */
  if (facts.fixedVariableSplitHasBoth && !next.fixedVariableSplitAnswered) {
    next.fixedVariableSplitAnswered = true;
    changed = true;
  }
  /* valueProofAnswered ← role-specific signal fired this turn. */
  if (facts.valueProofSignal && !next.valueProofAnswered) {
    next.valueProofAnswered = true;
    changed = true;
  }

  return changed ? next : checklist;
}

export interface DiscoveryQuestion {
  item: keyof DiscoveryChecklist;
  prompt: string;
}

/** Return the next un-asked discovery question. Asks in a stable
 *  priority order: currentCtc → fixedVariableSplit → noticePeriod →
 *  competingOffers → valueProof → target. Returns null when discovery
 *  is complete (all required items asked + answered). Pure. */
export function getNextDiscoveryQuestion(
  checklist: DiscoveryChecklist,
  roleFamily: RoleFamily,
): DiscoveryQuestion | null {
  if (!checklist.currentCtcAsked) {
    return {
      item: "currentCtcAsked",
      prompt:
        "Before we go further, can you share your current CTC — fixed, variable, and in-hand?",
    };
  }
  if (!checklist.fixedVariableSplitAsked) {
    return {
      item: "fixedVariableSplitAsked",
      prompt:
        "How is your current package split between fixed and variable?",
    };
  }
  if (!checklist.noticePeriodAsked) {
    return {
      item: "noticePeriodAsked",
      prompt:
        "What's your current notice period and earliest joining date?",
    };
  }
  if (!checklist.competingOffersAsked) {
    return {
      item: "competingOffersAsked",
      prompt:
        "Are you in process with other companies, or do you have any active offers?",
    };
  }
  if (!checklist.valueProofAsked) {
    return {
      item: "valueProofAsked",
      prompt: getValueProofPrompt(roleFamily),
    };
  }
  if (!checklist.targetAsked) {
    return {
      item: "targetAsked",
      prompt: "What's your target CTC for this move?",
    };
  }
  return null;
}

function getValueProofPrompt(roleFamily: RoleFamily): string {
  switch (roleFamily) {
    case "csm-cs":
      return (
        "How big a book of business do you currently manage — ARR, " +
        "account count, and what's your gross-retention or " +
        "net-retention number?"
      );
    case "sales":
      return (
        "What's your current quota and last-FY attainment? Average " +
        "deal size?"
      );
    case "product":
      return (
        "Tell me about one project from your current role you're most " +
        "proud of — something with metrics concrete enough to bring up " +
        "in a comp discussion."
      );
    case "engineering":
      return (
        "Tell me about one project from your current role you're most " +
        "proud of — something where your impact is concrete enough to " +
        "bring up in a comp discussion."
      );
    case "design":
      return (
        "Tell me about one piece of work from your current role you're " +
        "most proud of — something where the impact is concrete enough " +
        "to bring up in a comp discussion."
      );
    case "marketing":
      return (
        "Tell me about one campaign or growth initiative from your " +
        "current role you're most proud of — something with impact " +
        "concrete enough to bring up in a comp discussion."
      );
    case "data":
      return (
        "Tell me about one piece of work from your current role you're " +
        "most proud of — something where the business impact is " +
        "concrete enough to bring up in a comp discussion."
      );
    case "ops":
      return (
        "Tell me about one initiative from your current role you're " +
        "most proud of — something with efficiency or cost impact " +
        "concrete enough to bring up in a comp discussion."
      );
    default:
      return (
        "Tell me about one thing from your current role you're most " +
        "proud of — something with impact concrete enough to bring up " +
        "in a comp discussion."
      );
  }
}

/* ─── Hike logic (target/current ratio probing) ────────────────────── */

export interface HikeRatioProbe {
  ratio: number | null;
  /** "high" → target > 1.5x current; "low" → target < 1.15x current.
   *  Null when neither current nor target is known. */
  signal: "high" | "low" | "normal" | null;
}

export function computeHikeRatio(
  currentCtc: number | null,
  target: number | null,
): HikeRatioProbe {
  if (
    currentCtc == null ||
    target == null ||
    currentCtc <= 0 ||
    target <= 0
  ) {
    return { ratio: null, signal: null };
  }
  const ratio = target / currentCtc;
  if (ratio > 1.5) return { ratio, signal: "high" };
  if (ratio < 1.15) return { ratio, signal: "low" };
  return { ratio, signal: "normal" };
}

/* ─── Stage machine ────────────────────────────────────────────────── */

export type DiscoveryStage =
  | "probe-mismatch"
  | "discovery"
  | "anchor"
  | "negotiation"
  | "commitment-test"
  | "closing"
  | "terminal";

export const ALL_DISCOVERY_STAGES: readonly DiscoveryStage[] = [
  "probe-mismatch",
  "discovery",
  "anchor",
  "negotiation",
  "commitment-test",
  "closing",
  "terminal",
] as const;

export function isValidDiscoveryStage(s: unknown): s is DiscoveryStage {
  return (
    typeof s === "string" &&
    (ALL_DISCOVERY_STAGES as readonly string[]).includes(s)
  );
}

/* ─── PDF #18 follow-up (2026-05-15) — strict ordered discovery sequence
 *
 * User-facing diagnosis: the existing `getNextDiscoveryQuestion` returns
 * the first un-ASKED item in a priority cascade. That allowed the bot to
 * jump (e.g. competing-offers before notice-period in some flows) when
 * an upstream item had already been recorded as "asked" but the order
 * desired by a real HR is currentCtc → CURRENT-fix/var → expected →
 * EXPECTED-fix/var → notice → competing → valueProof.
 *
 * This module adds an ORDERED-by-ANSWERED variant that gates strictly
 * on the *answered* flag: until item N is answered the bot MUST ask
 * for it, regardless of how many later items have been "asked". The
 * old helper is preserved unchanged for back-compat — the new helper
 * is opt-in by the move-picker / brief layer. */

export type DiscoverySequenceItem =
  | "currentCtcAnswered"
  | "currentCtcFixedVariableSplitDisclosed"
  | "targetAnswered"
  | "expectedCtcFixedVariableSplitDisclosed"
  | "noticePeriodAnswered"
  | "competingOffersAnswered"
  | "valueProofAnswered";

/** Strict ordered discovery sequence (PDF #18 follow-up).
 *
 *   1. currentCtcAnswered                  — candidate's current CTC
 *   2. currentCtcFixedVariableSplit...     — current package fixed/variable
 *   3. targetAnswered                      — candidate's expected CTC
 *   4. expectedCtcFixedVariableSplit...    — expected package fixed/variable
 *   5. noticePeriodAnswered                — joining timeline
 *   6. competingOffersAnswered             — other interview / offer pipeline
 *   7. valueProofAnswered                  — role-specific impact proof
 *
 * Step 7 is role-family conditional (see `getRequiredDiscoveryItems`).
 * Steps 2 and 4 are conditional on the respective CTC being known —
 * we never ask for "the split" of a CTC the candidate hasn't disclosed
 * yet. */
export const DISCOVERY_SEQUENCE: readonly DiscoverySequenceItem[] = [
  "currentCtcAnswered",
  "currentCtcFixedVariableSplitDisclosed",
  "targetAnswered",
  "expectedCtcFixedVariableSplitDisclosed",
  "noticePeriodAnswered",
  "competingOffersAnswered",
  "valueProofAnswered",
] as const;

function isSequenceItemSatisfied(
  c: DiscoveryChecklist,
  item: DiscoverySequenceItem,
): boolean {
  switch (item) {
    case "currentCtcAnswered":
      return c.currentCtcAnswered === true;
    case "currentCtcFixedVariableSplitDisclosed":
      /* Gated on currentCtcAnswered — if we don't know the current CTC
       * yet, we can't ask for its split. The umbrella `fixedVariableSplit
       * Answered` flag (legacy, context-free) also satisfies this slot
       * so existing sessions that already cleared the legacy split flag
       * don't get re-prompted. */
      if (!c.currentCtcAnswered) return true;
      return (
        c.currentCtcFixedVariableSplitDisclosed === true ||
        c.fixedVariableSplitAnswered === true
      );
    case "targetAnswered":
      return c.targetAnswered === true;
    case "expectedCtcFixedVariableSplitDisclosed":
      if (!c.targetAnswered) return true;
      return (
        c.expectedCtcFixedVariableSplitDisclosed === true ||
        c.fixedVariableSplitAnswered === true
      );
    case "noticePeriodAnswered":
      return c.noticePeriodAnswered === true;
    case "competingOffersAnswered":
      return c.competingOffersAnswered === true;
    case "valueProofAnswered":
      return c.valueProofAnswered === true;
  }
}

/** Return the first item in DISCOVERY_SEQUENCE that is NOT yet
 *  satisfied for the given checklist + role family. Role-family
 *  conditional items (currently only `valueProofAnswered`) are skipped
 *  for families that don't require them. Returns null when all
 *  required items in the sequence are satisfied. Pure.
 *
 *  P4 (2026-05-15) — refusal-fallback. Optional `refused` set carries
 *  per-item refusal flags; items in this set are skipped (treated as
 *  satisfied for ordering purposes) so the bot moves to the next
 *  incomplete item rather than re-asking what the candidate already
 *  declined to share. The refusal-detector in applyCandidateAnswer
 *  populates this map after the candidate's probeRefusalCount crosses
 *  2 for the currently-asked item. */
export function getNextOrderedDiscoveryItem(
  c: DiscoveryChecklist,
  roleFamily: RoleFamily,
  refused?: Record<string, boolean> | null,
): DiscoverySequenceItem | null {
  const requiresValueProof = getRequiredDiscoveryItems(roleFamily).includes(
    "valueProofAnswered",
  );
  for (const item of DISCOVERY_SEQUENCE) {
    if (item === "valueProofAnswered" && !requiresValueProof) continue;
    if (refused && refused[item] === true) continue;
    if (!isSequenceItemSatisfied(c, item)) return item;
  }
  return null;
}

/** Strict-sequence variant of `getNextDiscoveryQuestion`. Returns the
 *  prompt for the first un-satisfied item in DISCOVERY_SEQUENCE.
 *
 *  P4 (2026-05-15) — propagates the optional refused-items map so the
 *  caller (move-picker) can skip items the candidate has refused. */
export function getNextOrderedDiscoveryQuestion(
  c: DiscoveryChecklist,
  roleFamily: RoleFamily,
  refused?: Record<string, boolean> | null,
): DiscoveryQuestion | null {
  const item = getNextOrderedDiscoveryItem(c, roleFamily, refused);
  if (item == null) return null;
  switch (item) {
    case "currentCtcAnswered":
      return {
        item: "currentCtcAsked",
        prompt:
          "Before we go further, can you share your current CTC — fixed, variable, and in-hand?",
      };
    case "currentCtcFixedVariableSplitDisclosed":
      return {
        item: "fixedVariableSplitAsked",
        prompt:
          "Got it on the current CTC — how is THAT package split between fixed and variable?",
      };
    case "targetAnswered":
      return {
        item: "targetAsked",
        prompt: "What's your target / expected CTC for this move?",
      };
    case "expectedCtcFixedVariableSplitDisclosed":
      return {
        item: "fixedVariableSplitAsked",
        prompt:
          "And on the target — how would you want THAT split between fixed and variable?",
      };
    case "noticePeriodAnswered":
      return {
        item: "noticePeriodAsked",
        prompt: "What's your current notice period and earliest joining date?",
      };
    case "competingOffersAnswered":
      return {
        item: "competingOffersAsked",
        prompt:
          "Are you in process with other companies, or do you have any active offers?",
      };
    case "valueProofAnswered":
      return {
        item: "valueProofAsked",
        prompt: getOrderedValueProofPrompt(roleFamily),
      };
  }
}

function getOrderedValueProofPrompt(roleFamily: RoleFamily): string {
  /* Mirror of the priority-cascade helper, kept local so changing one
   * doesn't silently shift the other. */
  switch (roleFamily) {
    case "csm-cs":
      return (
        "How big a book of business do you currently manage — ARR, " +
        "account count, and what's your gross-retention or " +
        "net-retention number?"
      );
    case "sales":
      return (
        "What's your current quota and last-FY attainment? Average " +
        "deal size?"
      );
    case "product":
      return (
        "Tell me about one project from your current role you're most " +
        "proud of — something with metrics concrete enough to bring up " +
        "in a comp discussion."
      );
    case "engineering":
      return (
        "Tell me about one project from your current role you're most " +
        "proud of — something where your impact is concrete enough to " +
        "bring up in a comp discussion."
      );
    case "design":
      return (
        "Tell me about one piece of work from your current role you're " +
        "most proud of — something where the impact is concrete enough " +
        "to bring up in a comp discussion."
      );
    case "marketing":
      return (
        "Tell me about one campaign or growth initiative from your " +
        "current role you're most proud of — something with impact " +
        "concrete enough to bring up in a comp discussion."
      );
    case "data":
      return (
        "Tell me about one piece of work from your current role you're " +
        "most proud of — something where the business impact is " +
        "concrete enough to bring up in a comp discussion."
      );
    case "ops":
      return (
        "Tell me about one initiative from your current role you're " +
        "most proud of — something with efficiency or cost impact " +
        "concrete enough to bring up in a comp discussion."
      );
    default:
      return (
        "Tell me about one thing from your current role you're most " +
        "proud of — something with impact concrete enough to bring up " +
        "in a comp discussion."
      );
  }
}

/** Strict-sequence variant of `isDiscoveryComplete`. All items in
 *  DISCOVERY_SEQUENCE that apply to the given role family must be
 *  satisfied. Pure. */
export function isOrderedDiscoveryComplete(
  c: DiscoveryChecklist,
  roleFamily: RoleFamily,
): boolean {
  return getNextOrderedDiscoveryItem(c, roleFamily) == null;
}
