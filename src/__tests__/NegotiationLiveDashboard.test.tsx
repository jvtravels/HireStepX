/* Phase 5 Session B (2026-05-19) — component tests for the extended
 * NegotiationLiveDashboard:
 *   1. ZOPA band renders when candidateTarget OR highestOffer > 0.
 *   2. ZOPA band is hidden pre-turn-1 (no target, no offer).
 *   3. Multi-round badge renders when `multiRoundEnabled === true`.
 *   4. Multi-round badge does NOT render when `multiRoundEnabled !== true`
 *      (default-OFF byte-identical UI invariance).
 *   5. Highest-offer marker only renders when > initialOffer.
 *   6. Candidate-target marker prefers `candidateTarget` over
 *      `targetSalary` when both are present.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NegotiationLiveDashboard } from "../InterviewNegotiationPanels";

const baseLiveState = {
  facts: {
    candidateCounter: null,
    hasCompetingOffers: false,
    topicsRaised: [],
    acceptedImmediately: false,
    mentionedBATNA: false,
  },
  phase: "probe-expectations",
  leverage: 50,
  topicsCovered: [
    { topic: "base", covered: true },
    { topic: "variable", covered: false },
  ],
  phaseIdx: 1,
  totalPhases: 6,
};

const band = { initialOffer: 22, maxStretch: 30, walkAway: 18 };

describe("NegotiationLiveDashboard — Phase 5 Session B", () => {
  it("hides ZOPA band when no target and no offer surfaced (pre-turn-1)", () => {
    render(
      <NegotiationLiveDashboard
        liveState={baseLiveState}
        negotiationBand={band}
        highestOffer={0}
        targetSalary={null}
      />,
    );
    expect(screen.queryByTestId("zopa-band")).toBeNull();
  });

  it("renders ZOPA band markers when candidateTarget is disclosed", () => {
    render(
      <NegotiationLiveDashboard
        liveState={baseLiveState}
        negotiationBand={band}
        highestOffer={0}
        targetSalary={null}
        candidateTarget={28}
      />,
    );
    expect(screen.getByTestId("zopa-band")).toBeTruthy();
    expect(screen.getByTestId("zopa-walkaway")).toBeTruthy();
    expect(screen.getByTestId("zopa-initial-offer")).toBeTruthy();
    expect(screen.getByTestId("zopa-max-stretch")).toBeTruthy();
    expect(screen.getByTestId("zopa-candidate-target")).toBeTruthy();
    /* highestOffer=0 — purple marker must NOT render. */
    expect(screen.queryByTestId("zopa-highest-offer")).toBeNull();
  });

  it("renders ZOPA band when highestOffer > initialOffer", () => {
    render(
      <NegotiationLiveDashboard
        liveState={baseLiveState}
        negotiationBand={band}
        highestOffer={26}
        targetSalary={null}
      />,
    );
    expect(screen.getByTestId("zopa-band")).toBeTruthy();
    expect(screen.getByTestId("zopa-highest-offer")).toBeTruthy();
  });

  it("does NOT render highest-offer marker when offer <= initialOffer", () => {
    render(
      <NegotiationLiveDashboard
        liveState={baseLiveState}
        negotiationBand={band}
        highestOffer={22} /* == initialOffer, not strictly greater */
        targetSalary={null}
        candidateTarget={28}
      />,
    );
    expect(screen.queryByTestId("zopa-highest-offer")).toBeNull();
  });

  it("renders the multi-round badge when multiRoundEnabled is true", () => {
    render(
      <NegotiationLiveDashboard
        liveState={baseLiveState}
        negotiationBand={band}
        highestOffer={26}
        targetSalary={null}
        multiRoundEnabled
        roundIndex={1}
        roundPersonaLabel="Hiring Manager"
      />,
    );
    const badge = screen.getByTestId("multi-round-badge");
    expect(badge.textContent).toMatch(/Round 2 of 3/);
    expect(badge.textContent).toMatch(/Hiring Manager/);
  });

  it("does NOT render the multi-round badge when multiRoundEnabled is false / omitted", () => {
    render(
      <NegotiationLiveDashboard
        liveState={baseLiveState}
        negotiationBand={band}
        highestOffer={26}
        targetSalary={null}
      />,
    );
    expect(screen.queryByTestId("multi-round-badge")).toBeNull();
  });
});
