import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TLDRHero } from "../sessionReport/panels/TLDRHero";
import { AnchorBracketPanel } from "../sessionReport/panels/AnchorBracketPanel";
import { derivePhases, type NegotiationOutcome } from "../sessionReport/derivations";
import { filterNegotiationStrengths } from "../sessionReport/adapter";

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
  /no counter named|didn'?t name a counter|no counter,? no movement|no counter-number|no counter on the table|never naming a number|didn'?t name a counter-number/i;

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
  {
    /* 2026-07-11, live staging — Senior Product Designer @ Flipkart, session
     * f289b580: the recruiter never verbalized a cash offer, so `offers` was
     * empty (opening === null) even though the candidate named ₹50. The verdict
     * keyed `counterNamed` on `opening !== null && candidateAsk > opening`, so
     * an empty opening flipped it false and the hero printed "no counter on the
     * table — you explored 0 offer points… never naming a number" beside the
     * report's own "named a counter ✓ Asked ₹50", "1 of 5 stages — you named a
     * counter", and "Numbers stated 100%". A named counter is `candidateAsk`,
     * independent of whether an opening was ever tabled. */
    name: "countered into silence — recruiter never tabled an offer (the live bug)",
    o: outcome({ outcome: "no_agreement", finalTotal: null, offers: [], candidateAsk: 50 }),
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

/* R-1 residual (2026-07-13, live staging — report 03bbe2b9, Flipkart EM). An
 * ACCEPTED deal whose offer numbers weren't captured (legacy row, no persisted
 * trajectory, offer-regex missed the transcript → offers empty, finalTotal null
 * → delta null) matched neither the `delta > 0` nor the `delta === 0` accept
 * branch and fell through to the no-agreement `else`, printing "No deal closed …
 * ₹0 gained … walking away" beside this same component's stage tracker ("you
 * closed the deal") and N1's "Outcome: Accepted". The close is authoritative
 * from outcome.outcome; the no-deal narrative must be unreachable on an accept,
 * whether or not offer numbers survived. */
const NO_DEAL_CLAIM = /no deal closed|nothing locked in|walking away with ₹0|ended with ₹0|₹0 gained/i;

const ACCEPTED_UNQUANTIFIED: Array<{ name: string; o: NegotiationOutcome }> = [
  {
    name: "accepted, no offer numbers, counter named (the live bug)",
    o: outcome({ outcome: "accepted", finalTotal: null, offers: [], candidateAsk: 65 }),
  },
  {
    name: "accepted, no offer numbers, no counter named",
    o: outcome({ outcome: "accepted", finalTotal: null, offers: [], candidateAsk: null }),
  },
];

describe("negotiation report — an accepted deal never reads as no-deal, even without offer numbers", () => {
  it.each(ACCEPTED_UNQUANTIFIED)("verdict states the accept and never the no-deal narrative: $name", ({ o }) => {
    const text = renderSurfaces(o);
    // The 30-second read must not print the no-agreement narrative on a close.
    expect(text).not.toMatch(NO_DEAL_CLAIM);
    // And it must affirmatively state the accept, coherent with N1 / stage tracker.
    expect(text.toLowerCase()).toContain("you accepted");
    // The stage tracker's own "you closed the deal" hint must still agree.
    expect(text.toLowerCase()).toContain("you closed the deal");
  });
});

/* REPORT-4 (2026-07-12, live staging — session 686b5699). TOP STRENGTHS must
 * never praise an anchor/counter the kernel says was never named. `wins` is
 * the one counter-aware surface previously not pinned to candidateAsk; this
 * gate closes it. Same single source (candidateAsk !== null → counterNamed). */
describe("negotiation strengths — never claim an anchor the kernel says wasn't named", () => {
  const ANCHOR_CLAIMS = [
    "Anchored with a clear target salary",
    "You anchored high and held firm",
    "Named a counter above the offer",
    "Countered their opening confidently",
    "Stated your number early",
    "Asked for a higher base",
    "Set a strong target salary",
  ];
  const NON_ANCHOR_STRENGTHS = [
    "Stayed composed under pressure",
    "Kept a professional, warm tone",
    "Researched the market range beforehand",
    "Asked thoughtful clarifying questions",
    "Avoided leaking your current CTC",
  ];

  it("drops every anchor-claiming win when no counter was named", () => {
    const kept = filterNegotiationStrengths(ANCHOR_CLAIMS, false);
    // All anchor claims removed → falls back to the single honest, claim-free line.
    expect(kept).toEqual(["You practised the opening of the conversation."]);
  });

  it("keeps genuine non-anchor strengths on a no-counter session", () => {
    const kept = filterNegotiationStrengths(NON_ANCHOR_STRENGTHS, false);
    expect(kept).toEqual(NON_ANCHOR_STRENGTHS);
  });

  it("drops only the anchor claim from a mixed list, keeps the rest", () => {
    const mixed = ["Anchored with a clear target salary", "Stayed composed under pressure"];
    expect(filterNegotiationStrengths(mixed, false)).toEqual(["Stayed composed under pressure"]);
  });

  it("passes strengths through verbatim once a counter WAS named", () => {
    // counterNamed === true → the kernel corroborates the anchor; nothing to gate.
    expect(filterNegotiationStrengths(ANCHOR_CLAIMS, true)).toEqual(ANCHOR_CLAIMS);
  });

  it("does not over-match negotiation words inside non-claim strengths", () => {
    // 'counterproductive' / 'asked' (without a figure) must survive.
    const safe = ["You avoided being counterproductive", "You asked about the team"];
    expect(filterNegotiationStrengths(safe, false)).toEqual(safe);
  });
});
