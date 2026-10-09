import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "./setup-next-navigation";
import HiringActivityCard from "../HiringActivityCard";
import { resetHiringActivityInFlight } from "../useHiringActivity";

vi.mock("../supabase", () => ({
  authHeaders: vi.fn(() => Promise.resolve({ "Content-Type": "application/json" })),
}));

vi.mock("../AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

describe("HiringActivityCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    resetHiringActivityInFlight();
  });

  it("renders nothing before the fetch resolves", () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    const { container } = render(<HiringActivityCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there are no shortlisted matches", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ shortlistedCount: 0, unlockedCount: 0, recent: [] }),
      }),
    ) as unknown as typeof fetch;
    const { container } = render(<HiringActivityCard />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the invites pill and match cards with company, role, and employment type", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          shortlistedCount: 2,
          unlockedCount: 1,
          recent: [
            {
              roleTitle: "Backend Engineer",
              companyName: "Acme Corp",
              employmentType: "full-time",
              matchedAt: new Date().toISOString(),
            },
            {
              roleTitle: "SDE II",
              companyName: "Beta Inc",
              employmentType: null,
              matchedAt: new Date().toISOString(),
            },
          ],
        }),
      }),
    ) as unknown as typeof fetch;
    render(<HiringActivityCard />);
    await waitFor(() => expect(screen.getByText("Backend Engineer")).toBeInTheDocument());
    expect(screen.getByText("2 Invites")).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
    expect(screen.getByText(/Full-time/)).toBeInTheDocument();
    expect(screen.getByText("SDE II")).toBeInTheDocument();
  });

  it("shows singular '1 Invite' and caps the teaser grid at 4 cards", async () => {
    const recent = Array.from({ length: 5 }, (_, i) => ({
      roleTitle: `Role ${i}`,
      companyName: `Company ${i}`,
      employmentType: "contract",
      matchedAt: new Date().toISOString(),
    }));
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ shortlistedCount: 1, unlockedCount: 0, recent }),
      }),
    ) as unknown as typeof fetch;
    render(<HiringActivityCard />);
    await waitFor(() => expect(screen.getByText("1 Invite")).toBeInTheDocument());
    expect(screen.getByText("Role 0")).toBeInTheDocument();
    expect(screen.getByText("Role 3")).toBeInTheDocument();
    expect(screen.queryByText("Role 4")).not.toBeInTheDocument();
  });

  it("stays quiet on a fetch rejection", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("network down"))) as unknown as typeof fetch;
    const { container } = render(<HiringActivityCard />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });
});
