import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReadinessHeadline } from "../sessionReport/panels/sr-HeroMetrics";

const base = { role: "Product Designer", level: "Senior", company: "" };

describe("ReadinessHeadline", () => {
  it("calls one strong session a strong result, not readiness", () => {
    render(<ReadinessHeadline {...base} readiness={{ pct: 86, etaWeeks: 1 }} />);
    expect(screen.getByText("Strong result")).toBeInTheDocument();
    expect(screen.queryByText("Interview-ready")).toBeNull();
  });

  it("says interview-ready once the previous session backs it up", () => {
    render(<ReadinessHeadline {...base} readiness={{ pct: 86, etaWeeks: 1, confirmed: true }} />);
    expect(screen.getByText("Interview-ready")).toBeInTheDocument();
  });

  it("keeps the lower bands unchanged", () => {
    render(<ReadinessHeadline {...base} readiness={{ pct: 64, etaWeeks: 2 }} />);
    expect(screen.getByText("Getting close")).toBeInTheDocument();
  });
});
