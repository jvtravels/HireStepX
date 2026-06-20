/* Bug (2026-06-20, live staging) — FIXED-scoped target left the planner
 * stuck in current-CTC component discovery.
 *
 * Repro on staging (Infosys senior SWE, 8 YoE, deterministic fallback path):
 *   T1  candidate: "I'm at 14 LPA fixed, 8 yrs"     → probe variable
 *   T2  candidate: "looking for 18-20 LPA fixed"    → state the band (range)
 *   T3  candidate: "that works — confirm 17 fixed,    → PROBE ESOP (!!)
 *                   I'll sign today"
 * The recruiter asked "does your CURRENT package include ESOPs?" AFTER the
 * candidate said "I'll sign today". Root cause: the candidate stated their
 * target in FIXED terms ("18-20 fixed"), which the kernel routes to
 * candidateTargetFixed and deliberately leaves candidateTarget null (the
 * total-vs-fixed scope split, kernel L4861). The senior component-probe
 * cascade keyed on `candidateTarget == null` ALONE, so a fixed-scoped
 * target read as "target pending" forever and the bot kept walking the
 * base → variable → esop probe ladder.
 *
 * The cascade now also bails when candidateTargetFixed is set — a fixed
 * target IS a stated expectation. Mirrors the anchor-readiness gates that
 * already accept candidateTargetFixed (planner L862 / L3792 / L4101). Once
 * either a total OR a fixed target is on the table, the planner stops
 * probing current-CTC components and advances to anchor / counter / close.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import {
  planNextAction,
  type NextAction,
} from "../../server-handlers/_next-action-planner";

const CURRENT_CTC_COMPONENT_TOPICS = new Set([
  "currentCtcBase",
  "currentCtcVariable",
  "currentCtcEsop",
]);

/** Post-anchor senior pre-anchor state: current CTC disclosed, band already
 *  stated once (band-anchor-with-rationale in askedTopics), variable probed,
 *  ESOP not yet asked. `fixedTarget` toggles whether the candidate has stated
 *  a fixed-scoped target. */
function seniorPreAnchorState(fixedTarget: number | null): NegotiationState {
  const st = initState({
    sessionId: "g",
    role: "Software Engineer",
    company: "infosys",
    band: { initialOffer: 15.4, maxStretch: 17.7, walkAway: 12.1, hasEquity: false },
    experienceLevel: "senior",
    totalYoe: 8,
    applicableYoe: 8,
    maxTurns: 8,
  } as Parameters<typeof initState>[0]);
  const m = st as unknown as Record<string, unknown>;
  m.phase = "probe-expectations";
  m.candidateCurrentCtc = 14;
  m.candidateTarget = null;
  m.candidateTargetFixed = fixedTarget;
  m.candidateApplicableYoe = 8;
  m.candidateComponentBreakdown = null;
  m.highestOfferMade = 0;
  m.turnIndex = 3;
  m.askedTopics = [
    { topic: "currentCtcAnswered", atTurn: 1 },
    { topic: "currentCtcVariable", atTurn: 2 },
    { topic: "band-anchor-with-rationale", atTurn: 3 },
  ];
  if (st.discoveryChecklist != null) {
    const dc = st.discoveryChecklist as unknown as Record<string, boolean>;
    dc.currentCtcAnswered = true;
    // Mirror real parse-driven flow: parsed.target (non-null even for a fixed
    // ask) sets targetAnswered=true via syncChecklistFromParsedFacts.
    if (fixedTarget != null) dc.targetAnswered = true;
  }
  return st;
}

function isCurrentCtcComponentProbe(a: NextAction): boolean {
  const topic =
    (a as { satisfiesTopic?: string }).satisfiesTopic ??
    (a as { _move?: { askedTopic?: string } })._move?.askedTopic ??
    "";
  return (
    a.kind === "component-probe" || CURRENT_CTC_COMPONENT_TOPICS.has(topic)
  );
}

describe("fixed-scoped target stops the current-CTC component probe", () => {
  it("WITHOUT a target, the senior component cascade still probes (control)", () => {
    const a = planNextAction(seniorPreAnchorState(null));
    // Sanity: the no-target state DOES reproduce the component probe, proving
    // the fixed-target guard below is what changes the behavior.
    expect(isCurrentCtcComponentProbe(a)).toBe(true);
  });

  it("WITH a fixed-scoped target, the planner does NOT re-probe current-CTC components", () => {
    const a = planNextAction(seniorPreAnchorState(17));
    expect(isCurrentCtcComponentProbe(a)).toBe(false);
    // And it must not be asking the candidate's current ESOP/variable/base.
    const topic =
      (a as { satisfiesTopic?: string }).satisfiesTopic ??
      (a as { _move?: { askedTopic?: string } })._move?.askedTopic ??
      "";
    expect(CURRENT_CTC_COMPONENT_TOPICS.has(topic)).toBe(false);
  });
});
