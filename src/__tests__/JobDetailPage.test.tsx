import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import JobDetailPage from "../JobDetailPage";

let routeId = "match-1";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/jobs/match-1",
  useParams: () => ({ id: routeId }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => React.createElement("a", { href, ...props }, children),
}));
vi.mock("../supabase", () => ({
  authHeaders: vi.fn(() => Promise.resolve({ "Content-Type": "application/json" })),
}));
vi.mock("../AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

const baseMatch = {
  id: "match-1",
  roleTitle: "Backend Engineer",
  companyName: "Acme Corp",
  companyLogoPath: null,
  companyWebsite: "https://acme.example",
  location: "Bengaluru",
  workMode: "hybrid",
  salaryType: "per-annum",
  budgetMin: 12,
  budgetMax: 18,
  experienceMin: 2,
  experienceMax: 4,
  skills: ["Node.js", "Postgres"],
  noticePeriodPref: "30 days",
  openPositions: 2,
  description: "We're growing the payments platform team.",
  responsibilities: "Own the payments service.",
  niceToHave: "Kubernetes experience.",
  perksAndBenefits: ["Health insurance"],
  preferredIndustry: "Fintech",
  dueDate: "2026-09-30",
  status: "open",
  employmentType: "full-time",
  matchScore: 87,
  matchReason: "Your practice history lines up with this role.",
  unlocked: true,
  matchedAt: new Date().toISOString().slice(0, 10),
  unlockedAt: new Date().toISOString().slice(0, 10),
};

function mockFetch(recent: unknown[]) {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: async () => ({ shortlistedCount: recent.length, unlockedCount: 0, recent }) }),
  ) as unknown as typeof fetch;
}

describe("JobDetailPage", () => {
  beforeEach(() => {
    localStorage.clear();
    routeId = "match-1";
  });

  it("renders the full role details and company card for a contacted match", async () => {
    mockFetch([baseMatch]);
    render(<JobDetailPage />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Backend Engineer" })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Back to Jobs/ })).toHaveAttribute("href", "/jobs");
    const company = screen.getByRole("complementary", { name: "Company profile" });
    expect(within(company).getByText("Acme Corp")).toBeInTheDocument();
    expect(within(company).getByRole("link", { name: /acme\.example/ })).toHaveAttribute("href", "https://acme.example");
    expect(screen.getByText("2 openings")).toBeInTheDocument();
    expect(screen.getByText(/Notice: 30 days/)).toBeInTheDocument();
    expect(screen.getByText(/Own the payments service\./)).toBeInTheDocument();
    expect(screen.getByText(/Hiring by 2026-09-30/)).toBeInTheDocument();
  });

  it("hides company details and shows placeholders for a matched-only, sparse role", async () => {
    mockFetch([{
      ...baseMatch, companyName: "Confidential company", companyWebsite: null, unlocked: false, unlockedAt: null,
      location: "", workMode: null, budgetMin: null, budgetMax: null, experienceMin: null, experienceMax: null,
      skills: [], noticePeriodPref: null, openPositions: null, description: null, responsibilities: null,
      niceToHave: null, perksAndBenefits: [], dueDate: null, status: "closed",
    }]);
    render(<JobDetailPage />);
    await waitFor(() => expect(screen.getByText("Role closed")).toBeInTheDocument());
    expect(screen.getByText(/Company details are shared once this employer contacts you/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /acme\.example/ })).not.toBeInTheDocument();
    expect(screen.getByText("Compensation not disclosed")).toBeInTheDocument();
    expect(screen.getByText("No specific skills listed for this role.")).toBeInTheDocument();
    expect(screen.getByText("This employer hasn't added a role description yet.")).toBeInTheDocument();
    expect(screen.getByText("No perks or benefits listed.")).toBeInTheDocument();
  });

  it("shows a not-found screen when the id is not in the list", async () => {
    routeId = "missing";
    mockFetch([baseMatch]);
    render(<JobDetailPage />);
    await waitFor(() => expect(screen.getByText("Job not found")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Back to Jobs" })).toBeInTheDocument();
  });
});
