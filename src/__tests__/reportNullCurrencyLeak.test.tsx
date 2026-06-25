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
      <TLDRHero outcome={outcome} role="EM" company="Flipkart" />,
    );
    // closing falls back to the last offer (30) — present and not a leak.
    expect(container.textContent || "").toContain("₹30");
    expect(container.textContent || "").not.toMatch(NO_CURRENCY_LEAK);
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
