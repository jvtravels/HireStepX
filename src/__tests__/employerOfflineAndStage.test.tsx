// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const pathname = vi.hoisted(() => ({ value: "/employer" }));
const connection = vi.hoisted(() => ({ status: "offline" as "online" | "degraded" | "offline" }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("@/connectionMonitor", () => ({ useConnectionState: () => ({ status: connection.status }) }));

import { OfflineBanner } from "../../app/OfflineBanner";
import { StageCell } from "../employer/_atoms";

describe("OfflineBanner", () => {
  beforeEach(() => { connection.status = "offline"; });

  it("tells employers changes are not saved, without interview wording", () => {
    pathname.value = "/employer/jobs";
    render(<OfflineBanner />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Changes won’t be saved");
    expect(alert.textContent).not.toMatch(/sync your work/i);
  });

  it("keeps the sync wording for candidates", () => {
    pathname.value = "/dashboard";
    render(<OfflineBanner />);
    expect(screen.getByRole("alert").textContent).toContain("sync your work");
  });
});

describe("StageCell", () => {
  it("shows Closed instead of a stale stage for a closed posting", () => {
    render(<StageCell stage="ready_for_review" hasEvaluatedCandidates onChange={() => {}} frozen closed />);
    expect(screen.getByText("Closed")).toBeTruthy();
    expect(screen.queryByText("Ready for Review")).toBeNull();
  });

  it("stops claiming AI is matching once matching finished with zero results", () => {
    render(<StageCell stage="ai_matching" hasEvaluatedCandidates={false} onChange={() => {}} matchedOnce />);
    expect(screen.getByText("No matches yet")).toBeTruthy();
    expect(screen.queryByText("AI Matching")).toBeNull();
  });

  it("still shows AI Matching while matching is in progress", () => {
    render(<StageCell stage="ai_matching" hasEvaluatedCandidates={false} onChange={() => {}} />);
    expect(screen.getByText("AI Matching")).toBeTruthy();
  });

  it("does not call a zero-match posting Ready for Review when its stored stage is stale", () => {
    render(<StageCell stage="ready_for_review" hasEvaluatedCandidates={false} onChange={() => {}} matchedOnce />);
    expect(screen.getByText("No matches yet")).toBeTruthy();
    expect(screen.queryByText("Ready for Review")).toBeNull();
  });
});
