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
    // The close (stage 5) is reached on any accept — so "one short of the
    // close" must never appear on a closed deal, regardless of phase count.
    if (o.outcome === "accepted") {
      expect(text.toLowerCase()).not.toContain("one short of the close");
    }
  });

  it.each(NO_COUNTER)("stays honest that no counter was named: $name", ({ o }) => {
    // Single source of truth says no counter was named.
    expect(derivePhases(o)[0].reached).toBe(false);
    const text = renderSurfaces(o);
    // It is correct (and required) to tell the user they didn't counter.
    expect(text.toLowerCase()).toContain("counter");
  });
});

/* Defect B (2026-07-11, live staging — Senior Product Designer @ Flipkart,
 * session 734493c9): a NO-AGREEMENT run with a flat offer (opening === closing,
 * delta 0) rendered "Money you left on the table — you countered at ₹50 but
 * ACCEPTED THEIR OPENING; the recruiter didn't move" beside the same report's
 * Outcome "In progress · No deal closed · ₹0 gained". "Accepted" is only ever
 * true when outcome === "accepted"; on no_agreement / walked_away it is
 * categorically false. Pin every non-accepted outcome to never claim an
 * acceptance, across flat and moved offers, countered and not. */
const NON_ACCEPTED: Array<{ name: string; o: NegotiationOutcome }> = [
  {
    name: "no_agreement, flat offer, countered (the live bug)",
    o: outcome({ outcome: "no_agreement", finalTotal: 30.4, offers: [{ turn: 1, total: 30.4, question: "" }], candidateAsk: 50 }),
  },
  {
    name: "no_agreement, flat offer, no counter",
    o: outcome({ outcome: "no_agreement", finalTotal: 40, offers: [{ turn: 1, total: 40, question: "" }], candidateAsk: null }),
  },
  {
    name: "walked_away, flat offer, countered",
    o: outcome({ outcome: "walked_away", finalTotal: 42, offers: [{ turn: 1, total: 42, question: "" }], candidateAsk: 55 }),
  },
];

const ACCEPT_CLAIM = /accepted their opening|you accepted|you took it/i;

describe("negotiation report — never claims an acceptance on a non-accepted outcome", () => {
  it.each(NON_ACCEPTED)("no false-accept copy: $name", ({ o }) => {
    expect(o.outcome).not.toBe("accepted");
    const text = renderSurfaces(o);
    expect(text).not.toMatch(ACCEPT_CLAIM);
  });

  it("still credits a genuine flat-offer acceptance with 'accepted their opening'", () => {
    // The accept phrasing is correct — and must survive — when the deal closed.
    const o = outcome({ outcome: "accepted", finalTotal: 51, offers: [{ turn: 1, total: 51, question: "" }], candidateAsk: 65 });
    const text = renderSurfaces(o);
    expect(text.toLowerCase()).toContain("accepted their opening");
  });
});
