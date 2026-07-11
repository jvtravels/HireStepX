import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "./setup-next-navigation";
import { DashboardProvider, useDashboard } from "../DashboardContext";
import { getCreditBalance } from "../supabase";

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
  getLatestSessionInsightFlags: vi.fn(() => Promise.resolve([])),
  getCreditBalance: vi.fn(() => Promise.resolve(0)),
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
      <span data-testid="creditBalance">{String(ctx.creditBalance)}</span>
      <span data-testid="creditsLoaded">{String(ctx.creditsLoaded)}</span>
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
  beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); });

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

  it("shows 2 sessions remaining for free tier with 0 sessions", async () => {
    // FREE_SESSION_LIMIT = 2
    await act(async () => { renderWithProviders(); });
    expect(screen.getByTestId("sessionsRemaining").textContent).toBe("2");
  });

  // ─── Regression: started-but-not-completed sessions count toward limit ───
  // Previously, sessionsUsed was derived from `recentSessions.length`
  // (rows in the sessions table — only set on completion). A user
  // who started 2 interviews and abandoned both still saw "2 of 2
  // remaining" because the rows never got written. Practice timestamps
  // are bumped on /api/record-session-start (interview start) so
  // they're the right signal — completed OR abandoned both count.
  it("counts STARTED sessions, not just completed (uses practiceTimestamps)", async () => {
    mockUser.practiceTimestamps = [
      "2026-05-04T10:00:00Z",
    ];
    await act(async () => { renderWithProviders(); });
    // 1 started, FREE_SESSION_LIMIT=2 → 1 remaining
    expect(screen.getByTestId("sessionsRemaining").textContent).toBe("1");
    mockUser.practiceTimestamps = []; // reset for other tests
  });

  it("clamps to 0 remaining when practiceTimestamps exceeds the cap", async () => {
    mockUser.practiceTimestamps = [
      "2026-05-04T10:00:00Z",
      "2026-05-04T11:00:00Z",
      "2026-05-04T12:00:00Z", // 3 — over the 2-session cap
    ];
    await act(async () => { renderWithProviders(); });
    expect(screen.getByTestId("sessionsRemaining").textContent).toBe("0");
    mockUser.practiceTimestamps = [];
  });

  // ─── I-2 regression: sessionStorage is a write-through cache of DB-CONFIRMED
  // balances only — never the transient initial 0. Before the creditsLoaded gate,
  // the persist effect fired on first mount while creditBalance was still its
  // initial 0 and clobbered the cache to "0"; a cross-route /session/new read (or
  // a fast remount) then briefly saw 0 and the sidebar flip-flopped 0→real. ───
  it("never persists the transient 0 balance before the DB confirms (I-2)", async () => {
    vi.mocked(getCreditBalance).mockResolvedValueOnce(5);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    try {
      await act(async () => { renderWithProviders(); });
      const creditWrites = setItem.mock.calls.filter(([k]) => k === "hsx_credit_u1");
      // The only value ever written for the credit key is the DB-confirmed 5 —
      // the initial 0 must never reach sessionStorage.
      expect(creditWrites.every(([, v]) => v === "5")).toBe(true);
      expect(creditWrites.some(([, v]) => v === "0")).toBe(false);
      expect(screen.getByTestId("creditBalance").textContent).toBe("5");
      expect(screen.getByTestId("creditsLoaded").textContent).toBe("true");
    } finally {
      setItem.mockRestore();
      sessionStorage.clear();
    }
  });

  it("can toggle upgrade modal", async () => {
    await act(async () => { renderWithProviders(); });
    expect(screen.getByTestId("showUpgrade").textContent).toBe("false");

    await act(async () => { screen.getByTestId("openUpgrade").click(); });
    expect(screen.getByTestId("showUpgrade").textContent).toBe("true");
  });
});
