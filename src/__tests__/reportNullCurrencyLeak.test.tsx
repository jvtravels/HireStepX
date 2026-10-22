import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TLDRHero } from "../sessionReport/panels/TLDRHero";
import { InHandMonthlyCard } from "../sessionReport/panels/InHandMonthlyCard";
import type { NegotiationOutcome } from "../sessionReport/derivations";

/* Pre-launch audit (2026-06-25) — user-visible "₹null" / "₹undefined"
 * currency leaks in the salary-negotiation report.
 *
 * A customer reading a results card with "₹null LPA" or "₹ LPA" reads the
 * whole product as broken — it's the single highest-yield UX defect found
 * in the pre-launch audit. Two seams leaked:
 *
 *   1. TLDRHero — the walked_away verdict interpolated `₹${closing}` where
 *      `closing` is null when the candidate walked before any firm number
 *      landed → "You walked away from a ₹null LPA offer…".
 *   2. InHandMonthlyCard — the eyebrow used `closingTotalLpa?.toFixed(1)`,
 *      so a null/undefined closing total rendered "Take-home on closing
 *      offer · ₹ LPA" (optional chaining yields undefined, interpolated raw).
 *
 * Invariant pinned here: no report surface ever renders the literal strings
 * "₹null", "₹undefined", or a bare "₹ " followed by a unit. */

const NO_CURRENCY_LEAK = /₹\s*(null|undefined)|₹\s+(?:LPA|L\b)/i;

function baseOutcome(over: Partial<NegotiationOutcome>): NegotiationOutcome {
  return {
    offers: [],
    finalTotal: null,
    outcome: "no_agreement",
    candidateAsk: null,
    ...over,
  } as NegotiationOutcome;
}

describe("report currency leaks (pre-launch audit)", () => {
  it("TLDRHero does not render ₹null when the candidate walked with no offer", () => {
    const outcome = baseOutcome({ outcome: "walked_away", finalTotal: null });
    const { container } = render(
      // `role` here is TLDRHero's domain prop (the job title), not a DOM ARIA
      // role — jsx-a11y can't tell them apart on a custom component.
      // eslint-disable-next-line jsx-a11y/aria-role
      <TLDRHero outcome={outcome} role="Engineering Manager" company="Flipkart" />,
    );
    expect(container.textContent || "").not.toMatch(NO_CURRENCY_LEAK);
    // It should still name the walk-away, just without a fake number.
    expect((container.textContent || "").toLowerCase()).toContain("walked away");
  });

  it("TLDRHero still names the figure when a walk-away offer number exists", () => {
    const outcome = baseOutcome({
      outcome: "walked_away",
      finalTotal: null,
      offers: [{ turn: 1, total: 30, question: "" }],
    });
    const { container } = render(
      // `role` is TLDRHero's domain prop (the job title), not a DOM ARIA role.
      // eslint-disable-next-line jsx-a11y/aria-role
      <TLDRHero outcome={outcome} role="EM" company="Flipkart" />,
    );
    // closing falls back to the last offer (30) — present and not a leak.
    expect(container.textContent || "").toContain("₹30");
    expect(container.textContent || "").not.toMatch(NO_CURRENCY_LEAK);
  });

  /* Coherence (2026-06-27, live staging audit) — a Flipkart-EM report
   * accepted at ₹51 (opening = closing, delta 0) where the candidate DID
   * counter at ₹65 was printing self-contradictory copy: the verdict said
   * "No counter, no movement" and a stat hinted "no counter named", while
   * the SAME hero showed "+27% pushback" and the stage tracker showed
   * "named a counter ✓ Asked ₹65". Root cause: the delta===0 branch
   * conflated "the offer didn't move" with "the candidate never countered".
   * Pinned: when candidateAsk > opening, the hero must NOT claim no counter. */
  it("TLDRHero does not claim 'no counter' on a flat-offer accept where the candidate countered", () => {
    const outcome = baseOutcome({
      outcome: "accepted",
      finalTotal: 51,
      offers: [{ turn: 1, total: 51, question: "" }],
      candidateAsk: 65,
    });
    const { container } = render(
      // `role` is TLDRHero's domain prop (the job title), not a DOM ARIA role.
      // eslint-disable-next-line jsx-a11y/aria-role
      <TLDRHero outcome={outcome} role="Engineering Manager" company="Flipkart" />,
    );
    const text = (container.textContent || "").toLowerCase();
    // The contradiction strings must be gone.
    expect(text).not.toContain("no counter, no movement");
    expect(text).not.toContain("no counter named");
    // It must acknowledge the counter that was actually named.
    expect(container.textContent || "").toContain("₹65");
    expect(text).toContain("countered");
  });

  /* Coherence (2026-06-27) — "How far you got" must not say "one short of the
   * close" when the deal actually closed. The close (stage 5) is reached on any
   * accept; a sub-5 count means a MIDDLE stage was skipped, not the close. The
   * live Flipkart-EM report showed "4 of 5 stages — one short of the close"
   * while the stage tracker showed the close stage REACHED. */
  it("TLDRHero does not say 'one short of the close' on a closed deal that skipped a middle stage", () => {
    const outcome = baseOutcome({
      outcome: "accepted",
      finalTotal: 51,
      offers: [{ turn: 1, total: 51, question: "" }],
      candidateAsk: 65,
      // 4 of 5 stages: counter (1) + justification (2) + levers (4) + close (5)
      // reached; pushback (3) skipped.
      tacticsUsed: [],
      leverDiversity: 3,
      infoAsked: ["comp structure"],
      anchorBracket: { type: "range_with_justification", quote: "", verdict: "" },
    });
    const { container } = render(
      // `role` is TLDRHero's domain prop (the job title), not a DOM ARIA role.
      // eslint-disable-next-line jsx-a11y/aria-role
      <TLDRHero outcome={outcome} role="Engineering Manager" company="Flipkart" />,
    );
    const text = (container.textContent || "").toLowerCase();
    expect(text).not.toContain("one short of the close");
    expect(text).toContain("closed the deal");
  });

  /* PRI-63 (2026-07-06, live staging) — a walk-away that traversed all five
   * stages hit phaseCount === TOTAL_PHASES and printed "you closed the deal —
   * every stage reached" in the "How far you got" hint, directly above an
   * outcome record that read "You walked away". Reaching the close STAGE is
   * not closing the DEAL. Pinned: on any walk-away the hero must NOT claim the
   * deal closed, and must name the walk-away + point to the next-round play. */
  it("TLDRHero does not say 'closed the deal' on a walk-away that reached all five stages", () => {
    const outcome = baseOutcome({
      outcome: "walked_away",
      finalTotal: null,
      offers: [{ turn: 1, total: 42, question: "" }],
      candidateAsk: 52, // > opening (42): counter named (stage 1)
      anchorBracket: { type: "range_with_justification", quote: "", verdict: "" }, // stage 2
      tacticsUsed: ["calibrated-question"], // stage 3
      infoAsked: ["vest-schedule"], // stage 4 — expert lever intent (S16-B5, S19-B6)
      // stage 5 = walked_away → all five reached
    });
    const { container } = render(
      // `role` is TLDRHero's domain prop (the job title), not a DOM ARIA role.
      // eslint-disable-next-line jsx-a11y/aria-role
      <TLDRHero outcome={outcome} role="Engineering Manager" company="Flipkart" />,
    );
    const text = (container.textContent || "").toLowerCase();
    expect(text).toContain("5 of 5 stages");
    expect(text).not.toContain("closed the deal");
    expect(text).toContain("walked away");
    expect(text).toContain("next-round play");
  });

  /* S16-B9 / S17-B3 (2026-07-18 audit) — a no-agreement session where NO offer
   * ever landed and the candidate named NO number was printing offer-centric
   * copy: the verdict said "email draft to reopen offer" (there was nothing to
   * reopen) and "How far you got" said "you didn't push past the first offer"
   * (no first offer existed). Both strings are gated on offers.length now.
   * Pinned: with offers === [] the surfaces must talk about RESTARTING the
   * conversation, never reopening/pushing past a non-existent offer. */
  it("TLDRHero talks about restarting, not reopening, when no offer ever landed (S16-B9 / S17-B3)", () => {
    const outcome = baseOutcome({
      outcome: "no_agreement",
      finalTotal: null,
      offers: [],
      candidateAsk: null,
    });
    const { container } = render(
      // `role` is TLDRHero's domain prop (the job title), not a DOM ARIA role.
      // eslint-disable-next-line jsx-a11y/aria-role
      <TLDRHero outcome={outcome} role="Engineering Manager" company="Flipkart" />,
    );
    const text = (container.textContent || "").toLowerCase();
    // S16-B9: no offer to reopen — must say restart, not reopen.
    expect(text).toContain("restart the conversation");
    expect(text).not.toContain("reopen");
    // S17-B3: no first offer to push past — must name it honestly.
    expect(text).not.toContain("push past the first offer");
    expect(text).toContain("ended before any offer landed");
  });

  it("TLDRHero keeps the 'no counter' framing on a flat-offer accept with no candidate ask", () => {
    const outcome = baseOutcome({
      outcome: "accepted",
      finalTotal: 51,
      offers: [{ turn: 1, total: 51, question: "" }],
      candidateAsk: null,
    });
    const { container } = render(
      // `role` is TLDRHero's domain prop (the job title), not a DOM ARIA role.
      // eslint-disable-next-line jsx-a11y/aria-role
      <TLDRHero outcome={outcome} role="Engineering Manager" company="Flipkart" />,
    );
    const text = (container.textContent || "").toLowerCase();
    // No counter was named here, so the original framing is correct.
    expect(text).toContain("no counter");
  });

  it("InHandMonthlyCard does not render '₹ LPA' when closingTotalLpa is null", () => {
    const { container } = render(
      <InHandMonthlyCard
        salaryMeta={{
          closingTotalLpa: null,
          monthlyTakeHomeNewRegimeInr: null,
          monthlyTakeHomeOldRegimeInr: null,
        }}
      />,
    );
    expect(container.textContent || "").not.toMatch(NO_CURRENCY_LEAK);
    expect(container.textContent || "").toContain("Take-home on closing offer");
  });

  it("InHandMonthlyCard shows the figure when closingTotalLpa is present", () => {
    const { container } = render(
      <InHandMonthlyCard
        salaryMeta={{
          closingTotalLpa: 42.5,
          monthlyTakeHomeNewRegimeInr: 250000,
          monthlyTakeHomeOldRegimeInr: 240000,
        }}
      />,
    );
    expect(container.textContent || "").toContain("₹42.5 LPA");
    expect(container.textContent || "").not.toMatch(NO_CURRENCY_LEAK);
  });
});
