import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LoadingScreen from "../_LoadingScreen";

describe("LoadingScreen", () => {
  it("full-screen shows the wordmark and a status announcing the message", () => {
    const { container } = render(<LoadingScreen message="Loading your workspace…" />);
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector('img[src="/wordmark.png"]')).not.toBeNull();
    expect(screen.getAllByText("Loading your workspace…").length).toBeGreaterThan(0);
  });

  it("embedded variant drops the wordmark but keeps the ring and status", () => {
    const { container } = render(<LoadingScreen fullScreen={false} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("Loading...")).toBeTruthy();
  });
});
