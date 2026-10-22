/* S16-B8 regression lock (2026-07-18 audit).
 *
 * The N1 "Negotiation quality" tile renders on a CONCLUDED report. When the
 * kernel ends in a non-terminal phase (candidate abandoned mid-flow) the
 * outcome is "in-progress" — but printing the literal "In progress" on a
 * finished report reads as a live session that never ended. The label map now
 * renders "Ended early" for that case. Pinned here so a future edit can't
 * reintroduce the misleading "In progress" wording. */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { KernelNegotiationQualitySection } from "../sessionReport/panels/sr-KernelNegotiationQualitySection";
import type { InterviewResultData } from "../sessionReport/types";

type KernelMetrics = NonNullable<InterviewResultData["kernelMetrics"]>;

// Minimal metrics for a session the candidate abandoned mid-flow — the only
// field under test is `outcome`; the rest are inert zero/neutral values.
function metrics(over: Partial<KernelMetrics>): KernelMetrics {
  return {
    outcome: "in-progress",
    score: 0,
    lpaGained: 0,
    lpaPerTurn: 0,
    leverDiversity: 0,
    totalTurns: 4,
    anchorTurn: null,
    candidateAskLpa: null,
    bandTraversal: null,
    overBandViolation: false,
    vossTacticsUsed: [],
    infoAsked: [],
    infoAskedInitiated: [],
    walkAwayReturned: false,
    hardBandCap: false,
    marketMode: "neutral",
    ...over,
  } as KernelMetrics;
}

describe("S16-B8: kernel quality outcome label", () => {
  it("renders 'Ended early', never 'In progress', for an abandoned in-progress session", () => {
    const { container } = render(<KernelNegotiationQualitySection m={metrics({ outcome: "in-progress" })} />);
    const text = container.textContent || "";
    expect(text).toContain("Ended early");
    expect(text).not.toContain("In progress");
  });

  it("keeps the terminal labels intact (no regression)", () => {
    const accepted = render(<KernelNegotiationQualitySection m={metrics({ outcome: "accepted" })} />);
    expect(accepted.container.textContent || "").toContain("Accepted");
    const walked = render(<KernelNegotiationQualitySection m={metrics({ outcome: "walked-away" })} />);
    expect(walked.container.textContent || "").toContain("Walked away");
  });
});
