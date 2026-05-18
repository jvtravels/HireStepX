/* HireStepX — Multi-round negotiation personas (Phase 5 Session A of
 * Salary Negotiation track in SCORE_IMPROVEMENT_PLAN, 2026-05-19).
 *
 * Session A scope: kernel state + planner threading. Session B wires
 * the prose layer + UI + v9 analyzer bump.
 *
 * Architectural decision: multi-round = SIMULATED, in-kernel persona
 * switch. The kernel cycles a single conversation through three
 * sequential "rounds" (HR Partner → Hiring Manager → Director). To the
 * candidate it reads as one continuous interview that hands off mid-
 * session. Default-OFF opt-in flag (`multiRoundEnabled`); when false,
 * the kernel behaves byte-identical to single-round HEAD.
 *
 * Distinct from:
 *   - `_indian-recruiter-personas.ts` (Phase 3) — SECTOR archetype
 *     selected once at init (IT Services / GCC / Unicorn / Startup /
 *     BFSI). Frozen at session start; sector colours the prose
 *     surfaces, not the round.
 *   - `recruiterPersona` (RecruiterPersona) — tone axis (hardline /
 *     consultative / founder / agency) that modulates band economics.
 *
 * This file models WHO is across the table on this round:
 *
 *   1. HR Partner    — opening round. Floor-only on cash; sits inside
 *                      grade fitment, will not stretch. Holds the line
 *                      on policy. Hands off to Hiring Manager once the
 *                      round closes (or candidate walks).
 *   2. Hiring Manager— middle round. Carries the team's headcount
 *                      pressure, willing to stretch ~8% above HR Partner
 *                      floor. Pivots on scope / level / start-date.
 *   3. Director      — terminal round. Full stretch authority; final
 *                      sign-off. After this round closes, no further
 *                      transition — terminal.
 *
 * Constant module — no I/O. Safe to import from server-handlers (Edge
 * runtime). */

export type NegotiationRoundPersona =
  | "hr-partner"
  | "hiring-manager"
  | "director";

export interface NegotiationRoundPersonaConfig {
  id: NegotiationRoundPersona;
  displayName: string;
  /** Multiplier applied to the base band's hike envelope for this
   *  round. HR Partner sits at floor (1.00 = no extra hike beyond what
   *  the band already encodes); Hiring Manager stretches +8%; Director
   *  carries full stretch authority. Read by Session B prose layer to
   *  size the counter-offer envelope. */
  hikeCapMultiplier: number;
  /** Width-of-band multiplier. HR Partner quotes a tight band (1.00);
   *  Hiring Manager opens up (~1.10); Director opens widest (~1.25). */
  bandSpreadMultiplier: number;
  /** Shape of pushback this round persona uses. Session B prose maps
   *  these onto persona-specific phrasings. */
  pushbackStyle:
    | "policy-citation"      // HR Partner: "this is the grade fitment"
    | "scope-trade"          // Hiring Manager: "we can stretch if you take the higher scope"
    | "final-authority";     // Director: "this is the best I can sign off on"
  /** Vocabulary bias for canonical prose. Session B uses these to
   *  colour the per-round dialogue surfaces. Constants only here. */
  idiomBias: ReadonlyArray<string>;
}

const ROUND_PERSONAS: Record<NegotiationRoundPersona, NegotiationRoundPersonaConfig> = {
  "hr-partner": {
    id: "hr-partner",
    displayName: "HR Partner",
    hikeCapMultiplier: 1.00,
    bandSpreadMultiplier: 1.00,
    pushbackStyle: "policy-citation",
    idiomBias: [
      "as per company policy",
      "the grade fitment",
      "I'll have to check with the hiring manager",
    ],
  },
  "hiring-manager": {
    id: "hiring-manager",
    displayName: "Hiring Manager",
    hikeCapMultiplier: 1.08,
    bandSpreadMultiplier: 1.10,
    pushbackStyle: "scope-trade",
    idiomBias: [
      "for the scope we're hiring",
      "I can push for a stretch if",
      "let me take this to the director",
    ],
  },
  "director": {
    id: "director",
    displayName: "Director",
    hikeCapMultiplier: 1.15,
    bandSpreadMultiplier: 1.25,
    pushbackStyle: "final-authority",
    idiomBias: [
      "this is the best I can sign off on",
      "I have final authority on this hire",
      "we need to close this today",
    ],
  },
};

/** Lookup helper — returns the persona config. Throws on unknown id in
 *  dev to surface regressions; in prod widens to the HR Partner default
 *  (the floor) so a corrupted session never escalates to Director
 *  unilaterally. */
export function getNegotiationRoundPersona(
  id: NegotiationRoundPersona,
): NegotiationRoundPersonaConfig {
  const cfg = ROUND_PERSONAS[id];
  if (cfg) return cfg;
  if (process.env.NODE_ENV !== "production") {
    throw new Error(`getNegotiationRoundPersona: unknown round persona '${id}'`);
  }
  return ROUND_PERSONAS["hr-partner"];
}

/** Sequence helper — returns the NEXT persona in the round sequence,
 *  or `null` when the current persona is terminal (Director).
 *
 *  hr-partner → hiring-manager → director → null
 *
 *  Pure. Used by the kernel's `maybeAdvanceRound` helper to decide
 *  whether a round-end (closing-push / closed / accepted phase reached)
 *  should hand off to the next persona or finalise the session. */
export function selectNextRoundPersona(
  current: NegotiationRoundPersona,
): NegotiationRoundPersona | null {
  switch (current) {
    case "hr-partner":
      return "hiring-manager";
    case "hiring-manager":
      return "director";
    case "director":
      return null;
    default: {
      const _exhaustive: never = current;
      void _exhaustive;
      return null;
    }
  }
}

/** Ordered tuple of all round personas — convenience for tests and
 *  for the per-round band defaulter in `initState`. */
export const ROUND_PERSONA_SEQUENCE: ReadonlyArray<NegotiationRoundPersona> = [
  "hr-partner",
  "hiring-manager",
  "director",
];
