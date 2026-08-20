import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "./setup-next-navigation";
import DashboardJobs from "../DashboardJobs";

vi.mock("../supabase", () => ({
  authHeaders: vi.fn(() => Promise.resolve({ "Content-Type": "application/json" })),
}));

describe("DashboardJobs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches the uncapped ?full=1 list", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ discoverable: true, shortlistedCount: 0, unlockedCount: 0, recent: [] }) }),
    ) as unknown as typeof fetch;
    global.fetch = fetchMock;
    render(<DashboardJobs />);
    await waitFor(() => expect(screen.getByText(/No matches yet/)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/candidate-hiring-activity?full=1", expect.anything());
  });

  it("shows the opt-in nudge when not discoverable", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ discoverable: false }) }),
    ) as unknown as typeof fetch;
    render(<DashboardJobs />);
    await waitFor(() => expect(screen.getByText(/Open Settings/)).toBeInTheDocument());
  });

  it("renders full match detail including employer-only fields", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          discoverable: true,
          shortlistedCount: 1,
          unlockedCount: 0,
          recent: [
            {
              roleTitle: "Backend Engineer",
              companyName: "Acme Corp",
              companyLogoPath: null,
              companyWebsite: "https://acme.example",
              location: "Bengaluru",
              workMode: "hybrid",
              budgetMin: 12,
              budgetMax: 18,
              experienceMin: 2,
              experienceMax: 4,
              skills: ["Node.js", "Postgres"],
              noticePeriodPref: "30 days",
              openPositions: 2,
              responsibilities: "Own the payments service.",
              niceToHave: "Kubernetes experience.",
              perksAndBenefits: ["Health insurance", "WFH stipend"],
              preferredIndustry: "Fintech",
              status: "open",
              matchScore: 87,
              unlocked: false,
              matchedAt: new Date().toISOString().slice(0, 10),
              unlockedAt: null,
            },
          ],
        }),
      }),
    ) as unknown as typeof fetch;
    render(<DashboardJobs />);
    await waitFor(() => expect(screen.getByText("Backend Engineer")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Acme Corp" })).toHaveAttribute("href", "https://acme.example");
    expect(screen.getByText("87% MATCH")).toBeInTheDocument();
    expect(screen.getByText("2 openings")).toBeInTheDocument();
    expect(screen.getByText(/Notice: 30 days/)).toBeInTheDocument();
    expect(screen.getByText("Fintech")).toBeInTheDocument();
    expect(screen.getByText("Own the payments service.")).toBeInTheDocument();
    expect(screen.getByText(/Kubernetes experience\./)).toBeInTheDocument();
    expect(screen.getByText("Health insurance")).toBeInTheDocument();
  });

  it("shows a ROLE CLOSED badge for a closed, un-unlocked match", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          discoverable: true,
          shortlistedCount: 1,
          unlockedCount: 0,
          recent: [
            {
              roleTitle: "SDE II",
              companyName: "Beta Inc",
              companyLogoPath: null,
              companyWebsite: null,
              location: "",
              workMode: null,
              budgetMin: null,
              budgetMax: null,
              experienceMin: null,
              experienceMax: null,
              skills: [],
              noticePeriodPref: null,
              openPositions: null,
              responsibilities: null,
              niceToHave: null,
              perksAndBenefits: [],
              preferredIndustry: null,
              status: "closed",
              matchScore: 55,
              unlocked: false,
              matchedAt: new Date().toISOString().slice(0, 10),
              unlockedAt: null,
            },
          ],
        }),
      }),
    ) as unknown as typeof fetch;
    render(<DashboardJobs />);
    await waitFor(() => expect(screen.getByText("ROLE CLOSED")).toBeInTheDocument());
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();
  });

  it("stays on the loading skeleton and then settles on a fetch rejection", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("network down"))) as unknown as typeof fetch;
    render(<DashboardJobs />);
    await waitFor(() => expect(screen.getByText(/Open Settings/)).toBeInTheDocument());
  });
});
