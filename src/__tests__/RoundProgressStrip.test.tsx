import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoundProgressStrip } from "../sessionReport/panels/sr-RoundProgressStrip";
import { buildRoundProgress } from "../sessionReport/roundProgress";

const progress = buildRoundProgress({ id: "b", type: "behavioral", focus: "behavioral" }, [
  { id: "a", score: 80 },
  { id: "b", score: 55 },
]);

describe("RoundProgressStrip", () => {
  it("shows round progress and the fix-first item with a practice link", () => {
    render(<RoundProgressStrip progress={progress} fixFirst={{ name: "Quantify results", tip: "Add a number to each outcome" }} practiceHref="/session/new?type=behavioral" />);
    expect(screen.getByText("1 more session at 70+ to clear Behavioral")).toBeTruthy();
    expect(screen.getByText(/Quantify results\./)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Practice again" }).getAttribute("href")).toBe("/session/new?type=behavioral");
  });

  it("still renders fix-first when round progress is unavailable", () => {
    render(<RoundProgressStrip progress={null} fixFirst={{ name: "Pacing", tip: "Slow down" }} />);
    expect(screen.getByText("Pacing.", { exact: false })).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders nothing without progress or a weakest skill", () => {
    const { container } = render(<RoundProgressStrip progress={null} fixFirst={{ name: " ", tip: "" }} />);
    expect(container.firstChild).toBeNull();
  });
});
