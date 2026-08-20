import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "./setup-next-navigation";
import HiringActivityCard from "../HiringActivityCard";

vi.mock("../supabase", () => ({
  authHeaders: vi.fn(() => Promise.resolve({ "Content-Type": "application/json" })),
}));

describe("HiringActivityCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing before the fetch resolves", () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    const { container } = render(<HiringActivityCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the opt-in nudge when not discoverable", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ discoverable: false }) }),
    ) as unknown as typeof fetch;
    render(<HiringActivityCard />);
    await waitFor(() => expect(screen.getByText(/Open Settings/)).toBeInTheDocument());
  });

  it("shows a zero-match state when discoverable with no matches", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ discoverable: true, shortlistedCount: 0, unlockedCount: 0, recent: [] }),
      }),
    ) as unknown as typeof fetch;
    render(<HiringActivityCard />);
    await waitFor(() => expect(screen.getByText(/No matches yet/)).toBeInTheDocument());
  });

  it("renders match cards with comp, experience, skills, and unlocked state", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          discoverable: true,
          shortlistedCount: 2,
          unlockedCount: 1,
          recent: [
            {
              roleTitle: "Backend Engineer",
              companyName: "Acme Corp",
              location: "Bengaluru",
              workMode: "hybrid",
              budgetMin: 12,
              budgetMax: 18,
              experienceMin: 2,
              experienceMax: 4,
              skills: ["Node.js", "Postgres"],
              matchScore: 87,
              unlocked: true,
              matchedAt: new Date().toISOString().slice(0, 10),
              unlockedAt: new Date().toISOString().slice(0, 10),
            },
            {
              roleTitle: "SDE II",
              companyName: "Beta Inc",
              location: "",
              workMode: null,
              budgetMin: null,
              budgetMax: 20,
              experienceMin: null,
              experienceMax: null,
              skills: [],
              matchScore: 60,
              unlocked: false,
              matchedAt: new Date().toISOString().slice(0, 10),
              unlockedAt: null,
            },
          ],
        }),
      }),
    ) as unknown as typeof fetch;
    render(<HiringActivityCard />);
    await waitFor(() => expect(screen.getByText("Backend Engineer")).toBeInTheDocument());
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
    expect(screen.getByText("CONTACTED")).toBeInTheDocument();
    expect(screen.getByText("60% MATCH")).toBeInTheDocument();
    expect(screen.getByText("Node.js")).toBeInTheDocument();
    expect(screen.getByText(/₹12–18L/)).toBeInTheDocument();
    expect(screen.getByText(/₹20L/)).toBeInTheDocument();
  });

  it("stays quiet on a fetch rejection", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("network down"))) as unknown as typeof fetch;
    const { container } = render(<HiringActivityCard />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });
});
