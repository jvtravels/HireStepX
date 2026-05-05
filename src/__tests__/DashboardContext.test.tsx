import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "./setup-next-navigation";
import { DashboardProvider, useDashboard } from "../DashboardContext";

// Mock auth
const mockUser: {
  id: string; name: string; email: string; targetRole: string;
  subscriptionTier: "free"; resumeFileName: string | null;
  hasCompletedOnboarding: boolean; practiceTimestamps: string[];
} = {
  id: "u1", name: "Test User", email: "test@test.com",
  targetRole: "EM", subscriptionTier: "free",
  resumeFileName: null, hasCompletedOnboarding: true,
  practiceTimestamps: [],
};

vi.mock("../AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    logout: vi.fn(),
    updateUser: vi.fn(),
  }),
}));

// Mock supabase
vi.mock("../supabase", () => ({
  supabaseConfigured: false,
  getUserSessions: vi.fn(() => Promise.resolve([])),
  getCalendarEvents: vi.fn(() => Promise.resolve([])),
  getProfile: vi.fn(() => Promise.resolve(null)),
  authHeaders: vi.fn(() => Promise.resolve({ "Content-Type": "application/json" })),
  getGoogleProviderToken: vi.fn(() => null),
}));

// Mock dashboard helpers
vi.mock("../dashboardHelpers", () => ({
  loadEvents: () => [],
}));

function TestConsumer() {
  const ctx = useDashboard();
  return (
    <div>
      <span data-testid="isFree">{String(ctx.isFree)}</span>
      <span data-testid="isStarter">{String(ctx.isStarter)}</span>
      <span data-testid="isPro">{String(ctx.isPro)}</span>
      <span data-testid="displayName">{ctx.displayName}</span>
      <span data-testid="sessionsRemaining">{ctx.sessionsRemaining}</span>
      <span data-testid="dataLoading">{String(ctx.dataLoading)}</span>
      <span data-testid="showUpgrade">{String(ctx.showUpgradeModal)}</span>
      <button data-testid="startSession" onClick={ctx.handleStartSession}>Start</button>
      <button data-testid="openUpgrade" onClick={() => ctx.setShowUpgradeModal(true)}>Upgrade</button>
    </div>
  );
}

function renderWithProviders() {
  return render(
    
      <DashboardProvider><TestConsumer /></DashboardProvider>
    ,
  );
}

describe("DashboardContext", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("throws when used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow("must be used within DashboardProvider");
    spy.mockRestore();
  });

  it("provides subscription state for free user", async () => {
    await act(async () => { renderWithProviders(); });

    expect(screen.getByTestId("isFree").textContent).toBe("true");
    expect(screen.getByTestId("isStarter").textContent).toBe("false");
    expect(screen.getByTestId("isPro").textContent).toBe("false");
  });

  it("provides display name from user", async () => {
    await act(async () => { renderWithProviders(); });
    expect(screen.getByTestId("displayName").textContent).toBe("Test User");
  });

  it("shows 3 sessions remaining for free tier with 0 sessions", async () => {
    await act(async () => { renderWithProviders(); });
    expect(screen.getByTestId("sessionsRemaining").textContent).toBe("3");
  });

  // ─── Regression: started-but-not-completed sessions count toward limit ───
  // Previously, sessionsUsed was derived from `recentSessions.length`
  // (rows in the sessions table — only set on completion). A user
  // who started 2 interviews and abandoned both still saw "3 of 3
  // remaining" because the rows never got written. Practice timestamps
  // are bumped on /api/record-session-start (interview start) so
  // they're the right signal — completed OR abandoned both count.
  it("counts STARTED sessions, not just completed (uses practiceTimestamps)", async () => {
    mockUser.practiceTimestamps = [
      "2026-05-04T10:00:00Z",
      "2026-05-04T11:00:00Z",
    ];
    await act(async () => { renderWithProviders(); });
    expect(screen.getByTestId("sessionsRemaining").textContent).toBe("1");
    mockUser.practiceTimestamps = []; // reset for other tests
  });

  it("clamps to 0 remaining when practiceTimestamps exceeds the cap", async () => {
    mockUser.practiceTimestamps = [
      "2026-05-04T10:00:00Z",
      "2026-05-04T11:00:00Z",
      "2026-05-04T12:00:00Z",
      "2026-05-04T13:00:00Z", // 4 — over the 3-session cap
    ];
    await act(async () => { renderWithProviders(); });
    expect(screen.getByTestId("sessionsRemaining").textContent).toBe("0");
    mockUser.practiceTimestamps = [];
  });

  it("can toggle upgrade modal", async () => {
    await act(async () => { renderWithProviders(); });
    expect(screen.getByTestId("showUpgrade").textContent).toBe("false");

    await act(async () => { screen.getByTestId("openUpgrade").click(); });
    expect(screen.getByTestId("showUpgrade").textContent).toBe("true");
  });
});
