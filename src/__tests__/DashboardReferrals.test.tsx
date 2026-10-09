import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DashboardReferrals from "../DashboardReferrals";

vi.mock("../supabase", () => ({
  authHeaders: vi.fn(() => Promise.resolve({ "Content-Type": "application/json" })),
}));
vi.mock("../AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
  referralSignupUrl: (code?: string | null) => (code ? `https://app.test/signup?ref=${code}` : "https://app.test"),
}));
vi.mock("../posthogClient", () => ({ captureClientEvent: vi.fn() }));

function mockApi(opts: { code?: string | null; stats?: unknown; invites?: unknown[]; refOk?: boolean }) {
  global.fetch = vi.fn((url: string) => {
    if (String(url).includes("referral-invites")) {
      return Promise.resolve({ ok: true, json: async () => ({ invites: opts.invites ?? [] }) });
    }
    return Promise.resolve({
      ok: opts.refOk ?? true,
      json: async () => ({ code: opts.code ?? "HSX-ABC123", stats: opts.stats ?? { total: 0, redeemed: 0, rewarded: 0 } }),
    });
  }) as unknown as typeof fetch;
}

describe("DashboardReferrals", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("shows the attributed link, share channels and empty invites state", async () => {
    mockApi({});
    render(<DashboardReferrals />);
    const input = (await screen.findByLabelText("Your referral link")) as HTMLInputElement;
    expect(input.value).toBe("https://app.test/signup?ref=HSX-ABC123");
    expect(screen.getByRole("button", { name: /copy link/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /whatsapp/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Your impact" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "How it works" })).toBeTruthy();
    expect(screen.getByText(/No one has joined with your link yet/i)).toBeTruthy();
  });

  it("lists invites with status chips and counts earned sessions", async () => {
    mockApi({
      stats: { total: 2, redeemed: 2, rewarded: 1 },
      invites: [
        { id: "a", name: "Asha Rao", email: "asha@example.com", status: "rewarded", createdAt: new Date().toISOString() },
        { id: "b", name: "Ravi", email: "ravi@example.com", status: "redeemed", createdAt: new Date().toISOString() },
      ],
    });
    render(<DashboardReferrals />);
    expect(await screen.findByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText("Free session earned")).toBeTruthy();
    expect(screen.getByText("Joined")).toBeTruthy();
    expect(screen.getByText("Free sessions earned").parentElement?.textContent).toContain("1");
  });

  it("offers a retry when the referral code can't be loaded", async () => {
    mockApi({ refOk: false });
    render(<DashboardReferrals />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });
});
