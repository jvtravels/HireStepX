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
        "What's the biggest product or feature you've shipped, and " +
        "what metrics did it move?"
      );
    case "engineering":
      return (
        "Walk me through the most complex system you've architected. " +
        "Scale numbers?"
      );
    case "design":
      return (
        "Walk me through the depth of your portfolio — what are the " +
        "two pieces you're proudest of and what was the impact?"
      );
    case "marketing":
      return (
        "What's the biggest campaign or growth lever you've owned, " +
        "and what metrics moved?"
      );
    case "data":
      return (
        "Walk me through the most impactful model or analysis you've " +
        "shipped — what decision did it drive?"
      );
    case "ops":
      return (
        "What's the most material process or system you've owned, " +
        "and what efficiency / cost metrics moved?"
      );
    default:
      return "Walk me through your most impactful work and the metrics it moved.";
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
