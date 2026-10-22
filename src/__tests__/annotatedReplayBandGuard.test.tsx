/**
 * Regression: AnnotatedReplayPanel band-position annotation.
 *
 * The AI-offer annotation renders "(X% of their range)" by mapping the
 * offer onto [walkAway, maxStretch]. When the band is degenerate
 * (maxStretch === walkAway, range 0), the raw division yields Infinity/NaN
 * and the replay showed "Infinity%" / "NaN%". The fix guards the range the
 * same way the two sibling ZOPA calculations do (falls back to 50, clamps
 * to [0,100]). These tests lock that behaviour in.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnnotatedReplayPanel } from "../InterviewNegotiationPanels";

const aiOffer = { speaker: "ai", text: "We can offer ₹25 LPA for this role.", time: "0:10" };

describe("AnnotatedReplayPanel — band-position guard", () => {
  it("falls back to 50% (no NaN/Infinity) when the band range is zero", () => {
    render(
      <AnnotatedReplayPanel
        transcript={[aiOffer]}
        negotiationBand={{ initialOffer: 25, maxStretch: 25, walkAway: 25 }}
      />,
    );
    // Click the HR turn to expand its annotations.
    fireEvent.click(screen.getByText(/We can offer/));
    const note = screen.getByText(/Offered ₹25 LPA/);
    expect(note.textContent).toContain("(50% of their range)");
    expect(note.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("clamps an out-of-band offer to [0,100] rather than emitting a negative %", () => {
    render(
      <AnnotatedReplayPanel
        transcript={[aiOffer]}
        negotiationBand={{ initialOffer: 30, maxStretch: 40, walkAway: 30 }}
      />,
    );
    fireEvent.click(screen.getByText(/We can offer/));
    // offer 25 is below walkAway 30 → raw % would be negative; clamp → 0.
    const note = screen.getByText(/Offered ₹25 LPA/);
    expect(note.textContent).toContain("(0% of their range)");
  });

  it("computes the real percentage for an in-band offer", () => {
    render(
      <AnnotatedReplayPanel
        transcript={[aiOffer]}
        negotiationBand={{ initialOffer: 20, maxStretch: 30, walkAway: 20 }}
      />,
    );
    fireEvent.click(screen.getByText(/We can offer/));
    // (25 - 20) / (30 - 20) = 50%.
    expect(screen.getByText(/Offered ₹25 LPA/).textContent).toContain("(50% of their range)");
  });
});
