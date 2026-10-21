import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CounterOfferLetterPanel } from "../sessionReport/panels/CounterOfferLetterPanel";
import { NegotiationFullReport } from "../sessionReport/NegotiationFullReport";
import type { NegotiationOutcome } from "../sessionReport/derivations";

function outcome(over: Partial<NegotiationOutcome>): NegotiationOutcome {
  return {
    offers: [],
    finalTotal: null,
    outcome: "no_agreement",
    candidateAsk: null,
    ...over,
  } as NegotiationOutcome;
}

describe("negotiation report layout", () => {
  it("renders a restart email even when no offer was ever tabled", () => {
    const { container } = render(
      // eslint-disable-next-line jsx-a11y/aria-role
      <CounterOfferLetterPanel outcome={outcome({})} role="Product Manager" company="Swiggy" />,
    );
    expect(screen.getByText("Your counter-offer email, ready to send")).toBeTruthy();
    expect(container.textContent).toContain("Product Manager");
    expect(container.textContent).not.toMatch(/₹\s*(null|undefined)/);
  });

  it("names the candidate's number in the restart email when an ask exists but no offer landed", () => {
    const { container } = render(
      // eslint-disable-next-line jsx-a11y/aria-role
      <CounterOfferLetterPanel outcome={outcome({ candidateAsk: 40 })} role="PM" company="" />,
    );
    expect(container.textContent).toContain("₹40 LPA");
  });

  it("has no numbered 'Part N' bands and promises no section it can't fill", () => {
    const { container } = render(
      // eslint-disable-next-line jsx-a11y/aria-role
      <NegotiationFullReport outcome={outcome({})} role="PM" company="Swiggy" questions={[]} />,
    );
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/Part \d( of \d)?/);
    expect(screen.getByRole("heading", { name: "What to do next" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "What it's worth" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Your pattern" })).toBeNull();
  });

  it("links the closing call to action to the practice setup", () => {
    render(
      // eslint-disable-next-line jsx-a11y/aria-role
      <NegotiationFullReport outcome={outcome({})} role="PM" company="Swiggy" questions={[]} practiceHref="/session/new?type=salary" />,
    );
    const link = screen.getAllByRole("link").find((a) => a.getAttribute("href") === "/session/new?type=salary");
    expect(link).toBeTruthy();
  });
});
