import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import React from "react";
import JobDetailPage from "../JobDetailPage";
import { TooltipProvider } from "@/components/ui/tooltip";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
let routeId = "match-1";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/jobs/match-1",
  useParams: () => ({ id: routeId }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => React.createElement("a", { href, ...props }, children),
}));
vi.mock("../supabase", () => ({
  authHeaders: vi.fn(() => Promise.resolve({ "Content-Type": "application/json" })),
}));
vi.mock("../apiClient", () => ({ apiFetch: vi.fn(() => Promise.resolve({ ok: true, status: 200, data: {} })) }));
vi.mock("../Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
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
    push.mockClear();
    routeId = "match-1";
  });

  it("renders the full role details and company card for a contacted match", async () => {
    mockFetch([baseMatch]);
    render(<TooltipProvider><JobDetailPage /></TooltipProvider>);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Backend Engineer" })).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /Back to Jobs/ })).not.toBeInTheDocument();
    const company = screen.getByRole("group", { name: "Company" });
    expect(within(company).getByText("Acme Corp")).toBeInTheDocument();
    expect(within(company).getByRole("link", { name: /acme\.example/ })).toHaveAttribute("href", "https://acme.example");
    expect(screen.getByText("2 openings")).toBeInTheDocument();
    expect(screen.getByText("Notice period")).toBeInTheDocument();
    expect(screen.getByText("30 days")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Responsibilities" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Message employer/ })).toBeInTheDocument();
    expect(screen.queryByText("Industry")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Role details" })).toBeInTheDocument();
    expect(screen.getByText(/Own the payments service\./)).toBeInTheDocument();
    expect(screen.getByText("Hiring by")).toBeInTheDocument();
    expect(screen.getByText("2026-09-30")).toBeInTheDocument();
  });

  it("renders responsibilities as a bulleted list and keeps one message action", async () => {
    mockFetch([{
      ...baseMatch,
      responsibilities: "- Own the payments service\n- Review pull requests",
      candidateStatus: "interview_invited", candidateResponse: "none",
      matchFactors: {
        factors: [{ key: "role", label: "Role", level: "strong", detail: "Matches your target role" }],
        matchedSkills: ["Node.js"], missingSkills: ["Postgres"],
      },
    }]);
    render(<TooltipProvider><JobDetailPage /></TooltipProvider>);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Backend Engineer" })).toBeInTheDocument());
    const resp = screen.getByRole("heading", { name: "Responsibilities" }).closest("section")!;
    expect(within(resp).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Own the payments service", "Review pull requests"]);
    expect(screen.getByRole("heading", { name: "You're invited to interview" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Message employer/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Why you matched" })).getByText("Strong")).toBeInTheDocument();
  });

  it("hides company details and shows placeholders for a matched-only, sparse role", async () => {
    mockFetch([{
      ...baseMatch, companyName: "Confidential company", companyWebsite: null, unlocked: false, unlockedAt: null,
      location: "", workMode: null, budgetMin: null, budgetMax: null, experienceMin: null, experienceMax: null,
      skills: [], noticePeriodPref: null, openPositions: null, description: null, responsibilities: null,
      niceToHave: null, perksAndBenefits: [], dueDate: null, status: "closed",
    }]);
    render(<TooltipProvider><JobDetailPage /></TooltipProvider>);
    await waitFor(() => expect(screen.getByText("Role closed")).toBeInTheDocument());
    expect(screen.getByText("Company hidden")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /acme\.example/ })).not.toBeInTheDocument();
    expect(screen.getByText("Compensation not disclosed")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Skills" })).not.toBeInTheDocument();
    expect(screen.getByText("This employer hasn't added a role description yet.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Perks and benefits" })).not.toBeInTheDocument();
  });

  it("explains the dashed chips in plain sight and offers a resume update when skills are missing", async () => {
    mockFetch([{
      ...baseMatch,
      matchFactors: {
        factors: [{ key: "skills", label: "Skills", level: "gap", detail: "You list 1 of 2 skills" }],
        matchedSkills: ["Node.js"], missingSkills: ["Postgres"],
      },
    }]);
    render(<TooltipProvider><JobDetailPage /></TooltipProvider>);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Backend Engineer" })).toBeInTheDocument());
    expect(screen.getByText(/Ticked skills are on your resume\. Dashed ones aren't yet\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update your resume" }));
    expect(push).toHaveBeenCalledWith("/resume");
    expect(screen.queryByText("What this employer sees")).not.toBeInTheDocument();
  });

  it("keeps the interested answer in the actions menu, not the header", async () => {
    mockFetch([baseMatch]);
    render(<TooltipProvider><JobDetailPage /></TooltipProvider>);
    expect(await screen.findByRole("button", { name: "Message employer" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Your response" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Interested" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Not interested" })).not.toBeInTheDocument();
  });

  it("shows a not-found screen when the id is not in the list", async () => {
    routeId = "missing";
    mockFetch([baseMatch]);
    render(<TooltipProvider><JobDetailPage /></TooltipProvider>);
    await waitFor(() => expect(screen.getByText("Job not found")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Back to Jobs" })).toBeInTheDocument();
  });
});
