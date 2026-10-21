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
const focusRoundsMock = vi.hoisted(() => ({ rounds: [] as unknown[] }));
vi.mock("../DashboardContext", () => ({ useFocusRounds: () => focusRoundsMock.rounds }));
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

  it("suggests a focus for the role and opens setup with it preselected", async () => {
    mockFetch([baseMatch]);
    render(<TooltipProvider><JobDetailPage /></TooltipProvider>);
    const section = (await screen.findByRole("heading", { name: "Prepare for this role" })).closest("section")!;
    expect(within(section).getByText("Behavioral")).toBeInTheDocument();
    fireEvent.click(within(section).getByRole("button", { name: "Practise Behavioral" }));
    const href = push.mock.calls.at(-1)![0] as string;
    expect(href).toContain("focus=behavioral");
    expect(href).toContain("invite=match-1");
    expect(href).toContain("company=Acme+Corp");
  });

  it("shows where the candidate stands in each round and steers past a cleared one", async () => {
    const r = (key: string, label: string, status: string, best: number | null, qualifying: number) => ({ key, label, status, attempts: best ? 2 : 0, best, qualifying, clearedAt: null });
    focusRoundsMock.rounds = [
      r("behavioral", "Behavioral", "cleared", 88, 2),
      r("hr-round", "HR Round", "practising", 64, 0),
      r("campus-placement", "Campus Placement", "not_started", null, 0),
      r("salary-negotiation", "Salary Negotiation", "not_started", null, 0),
    ];
    mockFetch([baseMatch]);
    render(<TooltipProvider><JobDetailPage /></TooltipProvider>);
    const list = await screen.findByRole("list", { name: "Your practice rounds" });
    expect(within(list).getByText("Cleared")).toBeInTheDocument();
    expect(within(list).getByText("Practising")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Practise HR Round" })).toBeInTheDocument();
    focusRoundsMock.rounds = [];
  });

  it("hides the prepare block on an interview invite and on a closed role", async () => {
    mockFetch([{ ...baseMatch, candidateStatus: "interview_invited" }]);
    const { unmount } = render(<TooltipProvider><JobDetailPage /></TooltipProvider>);
    await screen.findByText("You're invited to interview");
    expect(screen.queryByRole("heading", { name: "Prepare for this role" })).not.toBeInTheDocument();
    unmount();
    mockFetch([{ ...baseMatch, status: "closed" }]);
    render(<TooltipProvider><JobDetailPage /></TooltipProvider>);
    await screen.findByText("This role is closed");
    expect(screen.queryByRole("heading", { name: "Prepare for this role" })).not.toBeInTheDocument();
  });

  it("keeps the company out of the practice link for a locked role", async () => {
    mockFetch([{ ...baseMatch, unlocked: false, unlockedAt: null, companyName: "Confidential company" }]);
    render(<TooltipProvider><JobDetailPage /></TooltipProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Practise Behavioral" }));
    expect(push.mock.calls.at(-1)![0] as string).not.toContain("company=");
    expect(screen.getByText("Strengthen your match")).toBeInTheDocument();
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
