// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SessionReportSkeleton } from "../sessionReport/SessionReportSkeleton";
import { SessionReportEvaluating } from "../sessionReport/SessionReportEvaluating";
import ReportProgress from "../sessionReport/ReportProgress";
import { evalStageMessage } from "../_eval-progress";

describe("session report loading screens", () => {
  it("skeleton announces itself as a busy status inside the report frame", () => {
    render(<SessionReportSkeleton />);
    const status = screen.getByText("Loading session report").closest("[role=status]");
    expect(status?.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("heading", { name: "Session report" })).toBeTruthy();
  });

  it("evaluating screen shows the server stage message and a working back button", () => {
    const onBack = vi.fn();
    render(<SessionReportEvaluating stage="generating" onBack={onBack} backLabel="Sessions" />);
    expect(screen.getByRole("heading", { name: "Coaching your report" })).toBeTruthy();
    expect(screen.getByText(evalStageMessage("generating"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Sessions/ }));
    expect(onBack).toHaveBeenCalled();
  });

  it("evaluating screen falls back to a waiting message and no step list before a stage arrives", () => {
    render(<SessionReportEvaluating stage={null} onBack={() => {}} backLabel="Sessions" />);
    expect(screen.queryByLabelText("Report progress")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("progress marks exactly one step current", () => {
    render(<ReportProgress stage="generating" />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items.filter((li) => li.getAttribute("aria-current") === "step")).toHaveLength(1);
  });
});
