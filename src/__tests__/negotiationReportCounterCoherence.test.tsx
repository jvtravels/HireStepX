import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TLDRHero } from "../sessionReport/panels/TLDRHero";
import { AnchorBracketPanel } from "../sessionReport/panels/AnchorBracketPanel";
import { derivePhases, type NegotiationOutcome } from "../sessionReport/derivations";

/* Cross-surface counter-coherence invariant (2026-06-27, live staging audit).
 *
 * A Flipkart-EM report accepted at ₹51 (opening === closing, delta 0) where
 * the candidate DID counter at ₹65 rendered self-contradicting copy: the
 * TLDRHero verdict said "No counter, no movement" / "no counter named" while
 * the SAME hero showed a "+27% pushback" stat and the stage tracker showed
 * "named a counter ✓ Asked ₹65". Root cause: one surface conflated "the offer
 * didn't move" (an offer-trajectory fact) with "the candidate never countered"
 * (a candidateAsk fact). They are different things — a recruiter can hold firm
 * against a real counter.
 *
 * The single source of truth for "was a counter named" is `candidateAsk`
 * (derivePhases stage 1: reachedCounter = candidateAsk !== null). This test
 * pins EVERY counter-aware report surface to that source so no future panel
 * can re-introduce the conflation: whenever a counter was named, no surface
 * may claim it wasn't; whenever none was named, the surfaces stay honest. */

const NO_COUNTER_CLAIM =
  /no counter named|didn'?t name a counter|no counter,? no movement|no counter-number/i;

function outcome(over: Partial<NegotiationOutcome>): NegotiationOutcome {
  return {
    offers: [],
    finalTotal: null,
    outcome: "no_agreement",
    candidateAsk: null,
    ...over,
  } as NegotiationOutcome;
}

function renderSurfaces(o: NegotiationOutcome): string {
  const { container } = render(
    <>
      {/* `role` is TLDRHero's domain prop (job title), not a DOM ARIA role. */}
      {/* eslint-disable-next-line jsx-a11y/aria-role */}
      <TLDRHero outcome={o} role="Engineering Manager" company="Flipkart" />
      <AnchorBracketPanel outcome={o} />
    </>,
  );
  return container.textContent || "";
}

/* Battery — each row asserts coherence across all rendered surfaces. */
const COUNTERED: Array<{ name: string; o: NegotiationOutcome }> = [
  {
    name: "accepted at a flat offer after countering higher (the live bug)",
    o: outcome({ outcome: "accepted", finalTotal: 51, offers: [{ turn: 1, total: 51, question: "" }], candidateAsk: 65 }),
  },
  {
    name: "accepted after the offer moved up",
    o: outcome({ outcome: "accepted", finalTotal: 58, offers: [{ turn: 1, total: 51, question: "" }, { turn: 3, total: 58, question: "" }], candidateAsk: 65 }),
  },
  {
    name: "walked away after naming a counter",
    o: outcome({ outcome: "walked_away", finalTotal: null, offers: [{ turn: 1, total: 40, question: "" }], candidateAsk: 70 }),
  },
  {
    name: "no agreement but a counter was on the table",
    o: outcome({ outcome: "no_agreement", finalTotal: null, offers: [{ turn: 1, total: 50, question: "" }], candidateAsk: 60 }),
  },
];

const NO_COUNTER: Array<{ name: string; o: NegotiationOutcome }> = [
  {
    name: "accepted the first number, never countered",
    o: outcome({ outcome: "accepted", finalTotal: 51, offers: [{ turn: 1, total: 51, question: "" }], candidateAsk: null }),
  },
  {
    name: "walked away before naming any number",
    o: outcome({ outcome: "walked_away", finalTotal: null, offers: [], candidateAsk: null }),
  },
];

describe("negotiation report — counter-named coherence across surfaces", () => {
  it.each(COUNTERED)("never claims 'no counter' when a counter was named: $name", ({ o }) => {
    // Single source of truth says a counter WAS named.
    expect(derivePhases(o)[0].reached).toBe(true);
    const text = renderSurfaces(o);
    expect(text).not.toMatch(NO_COUNTER_CLAIM);
    // The figure the candidate countered with must be acknowledged somewhere.
    expect(text).toContain(`₹${o.candidateAsk}`);
  });

  it.each(NO_COUNTER)("stays honest that no counter was named: $name", ({ o }) => {
    // Single source of truth says no counter was named.
    expect(derivePhases(o)[0].reached).toBe(false);
    const text = renderSurfaces(o);
    // It is correct (and required) to tell the user they didn't counter.
    expect(text.toLowerCase()).toContain("counter");
  });
});
