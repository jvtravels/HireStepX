import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { DashboardSession } from "../dashboardTypes";

const invalidateSessions = vi.fn();
let state: { recentSessions: DashboardSession[]; sessionsLoading: boolean; sessionsLoadFailed: boolean };

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../DashboardContext", () => ({
  useDashboardSessions: () => ({ ...state, invalidateSessions }),
}));
vi.mock("../posthogClient", () => ({ captureClientEvent: vi.fn() }));

import SessionsV2Screen from "../SessionsV2";

describe("SessionsV2 load states", () => {
  it("shows a retry state, not the first-session empty state, when the load failed", () => {
    state = { recentSessions: [], sessionsLoading: false, sessionsLoadFailed: true };
    render(<SessionsV2Screen />);
    expect(screen.getByText("Couldn't load your sessions")).toBeInTheDocument();
    expect(screen.queryByText("No sessions yet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(invalidateSessions).toHaveBeenCalledTimes(1);
  });

  it("shows the first-session empty state when the load succeeded with no sessions", () => {
    state = { recentSessions: [], sessionsLoading: false, sessionsLoadFailed: false };
    render(<SessionsV2Screen />);
    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
  });
});
