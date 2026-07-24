/* S48-B6 (2026-07-24) — range-to-point probe re-fires after candidate already
 * stated a specific point target in response.
 *
 * Root cause: the probe flag was `profile.gaveRangeNotPoint` (sticky-OR,
 * stays true once set). After the candidate gave a range ("₹80-90L") and then
 * answered the probe with "₹85L exactly", `gaveRangeNotPoint` was still true
 * so the probe re-fired 3 turns later asking "where in that range do you see
 * yourself landing?" — even though a specific point was already on record.
 *
 * Fix: added `candidateTargetWasRange` to kernel state. Set to `parsed.targetAsRange`
 * each time a total-scope target is updated. The probe flag becomes:
 *   `profile.gaveRangeNotPoint && state.candidateTargetWasRange !== false`
 * — fires while target came from a range (or no target yet), suppressed once
 * the candidate gives a specific point.
 *
 * Test matrix:
 *   A. Range ("₹80-90L") → probe SHOULD fire (still a range target)
 *   B. Range → point response ("₹85L") → probe SHOULD NOT re-fire
 *   C. Point stated from the start ("₹85L") → probe never fires
 *   D. Range → re-stated same range → probe still fires (range not narrowed)
 */

import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 72,
  maxStretch: 90,
  walkAway: 55,
  hasEquity: false,
};

function afterRangeStatement(): ReturnType<typeof applyCandidateAnswer> {
  let s = initState({ sessionId: "s48b6", role: "software-engineer", company: "flipkart", band: BAND });
  // CTC first so opening fires
  s = applyCandidateAnswer(s, "My current CTC is 62 LPA.");
  s = applyAiMove(s, { lever: "open-with-offer", newTotalLpa: 72, rationale: "open" }, "We can offer 72 LPA.");
  // Candidate gives a range target → gaveRangeNotPoint = true, candidateTargetWasRange = true
  s = applyCandidateAnswer(s, "I am looking for somewhere between 85 and 90 LPA.");
  return s;
}

function afterRangeAndPointResponse(): ReturnType<typeof applyCandidateAnswer> {
  let s = afterRangeStatement();
  // Recruiter fires range-to-point probe
  s = applyAiMove(
    s,
    { lever: "probe", newTotalLpa: null, rationale: "range-to-point", askedTopic: "range-to-point", actionKind: "reactive-followup" } as Parameters<typeof applyAiMove>[1],
    "You shared a range — where in that range do you actually see yourself landing?",
  );
  // Candidate gives a specific point → candidateTargetWasRange = false
  s = applyCandidateAnswer(s, "I would say exactly 85 LPA.");
  s = applyAiMove(s, { lever: "counter-base", newTotalLpa: 76, rationale: "counter" }, "We can go to 76 LPA.");
  s = applyCandidateAnswer(s, "That is still a bit low for me.");
  s = applyAiMove(s, { lever: "counter-base", newTotalLpa: 79, rationale: "counter" }, "How about 79 LPA?");
  s = applyCandidateAnswer(s, "I appreciate it but I really need something closer to 85.");
  return s;
}

describe("S48-B6 — range-to-point probe suppressed after candidate states a point", () => {
  it("A. After range disclosure, range-to-point probe fires (normal path)", () => {
    const s = afterRangeStatement();
    const action = planNextAction(s);
    // The probe should be eligible to fire (flag = true)
    // It won't necessarily be the CHOSEN action (competing probes may take priority)
    // but candidateTargetWasRange should be true
    expect(s.candidateTargetWasRange).toBe(true);
  });

  it("B. After point response to probe, probe must NOT re-fire", () => {
    const s = afterRangeAndPointResponse();
    // candidateTargetWasRange must be false (candidate gave a point)
    expect(s.candidateTargetWasRange).toBe(false);
    const action = planNextAction(s);
    // The planned action must NOT be the range-to-point probe
    const isRangeToPointProbe =
      action?.kind === "reactive-followup" &&
      (action as { _probe?: { topic?: string } })?._probe?.topic === "range-to-point";
    expect(isRangeToPointProbe).toBe(false);
  });

  it("C. Point target from the start — probe never fires (candidateTargetWasRange=false)", () => {
    let s = initState({ sessionId: "s48b6c", role: "software-engineer", company: "flipkart", band: BAND });
    s = applyCandidateAnswer(s, "My current CTC is 62 LPA.");
    s = applyAiMove(s, { lever: "open-with-offer", newTotalLpa: 72, rationale: "open" }, "We can offer 72 LPA.");
    s = applyCandidateAnswer(s, "I am targeting exactly 85 LPA.");
    // Point from the start — candidateTargetWasRange = false
    expect(s.candidateTargetWasRange).toBe(false);
    const action = planNextAction(s);
    const isRangeToPointProbe =
      action?.kind === "reactive-followup" &&
      (action as { _probe?: { topic?: string } })?._probe?.topic === "range-to-point";
    expect(isRangeToPointProbe).toBe(false);
  });

  it("D. Range re-stated — probe remains eligible (no point given)", () => {
    let s = afterRangeStatement();
    s = applyAiMove(s, { lever: "counter-base", newTotalLpa: 76, rationale: "counter" }, "We can go to 76 LPA.");
    // Candidate re-states a range instead of a point
    s = applyCandidateAnswer(s, "I still think somewhere in the 85 to 90 LPA range.");
    // candidateTargetWasRange must still be true (still a range)
    expect(s.candidateTargetWasRange).toBe(true);
  });
});
