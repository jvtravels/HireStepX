import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "./setup-next-navigation";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...args: unknown[]) => withAuthAndRateLimit(...args),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  slog: { error: vi.fn() },
}));
vi.mock("../../server-handlers/employer-requirements", () => ({
  runMatching: vi.fn(async () => "ready"),
  logRequirementActivity: vi.fn(),
}));

const { default: handler } = await import("../../server-handlers/employer-requirement-detail");
const { RequirementForm } = await import("../employer/RequirementForm");
import type { Requirement } from "../employer/EmployerDataContext";
import type { RequirementFormValues } from "../employer/mockData";
import { roleDetailRows } from "../../app/(employer)/employer/requirements/[id]/_components/requirementFormat";
import { validateDraft, initialDraft } from "../employer/_requirementFormHelpers";

/* What GET /api/employer-requirement-detail returns for a fully filled requirement. */
const STORED = {
  id: "req-1",
  title: "Backend Engineer",
  location: "Pune",
  noticePeriodPref: "Up to 30 days",
  description: "Build and run the services behind our hiring platform.",
  status: "ready",
  stage: "ready_for_review",
  department: "Engineering",
  experienceMin: 2,
  experienceMax: 5,
  dueDate: "2099-12-31",
  budgetMin: 12,
  budgetMax: 18,
  locations: ["Pune"],
  openPositions: 2,
  workMode: "hybrid",
  skills: ["Node.js"],
  customSkillSets: ["Kafka"],
  responsibilities: "Own the API.",
  niceToHave: "Go",
  preferredIndustry: "Fintech",
  preferredDomain: "Payments",
  workSchedule: "Mon to Fri",
  availability: "Immediate",
  relevantExperience: "3+ years",
  portfolioRequired: false,
  preferredColleges: ["IIT Bombay"],
  targetCompanies: ["Razorpay"],
  perksAndBenefits: ["Insurance"],
  employmentType: "contract",
  salaryType: "per-annum",
  durationWeeks: 12,
  hoursPerWeek: 20,
  minReadinessBand: "hire",
  minStarCompleteness: 60,
  createdAt: "2026-01-01",
  candidates: [],
} as unknown as Requirement;

const toRow = (r: Requirement) => ({
  id: r.id, employer_id: "emp-1", title: r.title, location: "Pune", notice_period_pref: r.noticePeriodPref,
  description: r.description, status: "ready", stage: "ready_for_review", department: r.department,
  experience_min: r.experienceMin, experience_max: r.experienceMax, due_date: r.dueDate,
  budget_min: r.budgetMin, budget_max: r.budgetMax, locations: r.locations, open_positions: r.openPositions,
  work_mode: r.workMode, skills: r.skills, custom_skill_sets: r.customSkillSets, responsibilities: r.responsibilities,
  nice_to_have: r.niceToHave, preferred_industry: r.preferredIndustry, preferred_domain: r.preferredDomain,
  work_schedule: r.workSchedule, availability: r.availability, relevant_experience: r.relevantExperience,
  portfolio_required: r.portfolioRequired, preferred_colleges: r.preferredColleges, target_companies: r.targetCompanies,
  perks_and_benefits: r.perksAndBenefits, employment_type: r.employmentType, salary_type: r.salaryType,
  duration_weeks: r.durationWeeks, hours_per_week: r.hoursPerWeek, min_readiness_band: r.minReadinessBand,
  min_star_completeness: r.minStarCompleteness, created_at: "2026-01-01T00:00:00Z",
});

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const label = (re: RegExp | string) => screen.getByLabelText(re) as HTMLInputElement;
const change = (re: RegExp | string, value: string) => fireEvent.change(label(re), { target: { value } });
const addTag = (re: RegExp | string, value: string) => {
  const el = label(re);
  fireEvent.change(el, { target: { value } });
  fireEvent.keyDown(el, { key: "Enter" });
};

async function submitEdit() {
  const onSubmit = vi.fn<(v: RequirementFormValues) => Promise<boolean>>(() => Promise.resolve(true));
  render(<RequirementForm mode="edit" initial={STORED} onSubmit={onSubmit} submitError={null} setSubmitError={vi.fn()} />);
  return onSubmit;
}

describe("edit form shows every stored value", () => {
  it("pre-fills all inputs from the saved requirement", async () => {
    await submitEdit();
    expect(label(/job title/i)).toHaveValue("Backend Engineer");
    expect(label(/department/i)).toHaveValue("Engineering");
    expect(screen.getByRole("button", { name: "Contract" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Hybrid" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Pune")).toBeInTheDocument();
    expect(label(/open positions/i)).toHaveValue("2");
    expect(label(/application deadline/i)).toHaveValue("2099-12-31");
    expect(label(/duration \(weeks\)/i)).toHaveValue("12");
    expect(label(/hours per week/i)).toHaveValue("20");
    expect(label(/from \(years\)/i)).toHaveValue("2");
    expect(label(/to \(years\)/i)).toHaveValue("5");
    expect(label(/^minimum \(/i)).toHaveValue("12");
    expect(label(/^maximum \(/i)).toHaveValue("18");
    expect(screen.getByText("Node.js")).toBeInTheDocument();
    expect(label(/^description/i)).toHaveValue(STORED.description);
    expect(label(/responsibilities/i)).toHaveValue("Own the API.");
    expect(label(/nice to have/i)).toHaveValue("Go");
    expect(screen.getByText("IIT Bombay")).toBeInTheDocument();
    expect(screen.getByText("Razorpay")).toBeInTheDocument();
    expect(label(/notice period/i)).toHaveValue("Up to 30 days");
    expect(screen.getByText("Insurance")).toBeInTheDocument();
    expect(label(/preferred industry/i)).toHaveValue("Fintech");
    expect(label(/preferred domain/i)).toHaveValue("Payments");
    expect(screen.getByText("Kafka")).toBeInTheDocument();
    expect(label(/work schedule/i)).toHaveValue("Mon to Fri");
    expect(label(/availability/i)).toHaveValue("Immediate");
    expect(label(/relevant experience/i)).toHaveValue("3+ years");
    expect(screen.getByRole("checkbox", { name: /portfolio required/i })).toHaveAttribute("aria-checked", "false");
    expect(label(/minimum readiness/i)).toHaveValue("hire");
    expect(label(/minimum star/i)).toHaveValue("60");
  });
});

describe("edit form → PATCH handler → stored columns", () => {
  it("every changed input reaches the database write", async () => {
    const onSubmit = await submitEdit();

    change(/job title/i, "Staff Backend Engineer");
    change(/department/i, "Platform");
    fireEvent.click(screen.getByRole("button", { name: "Part-time" }));
    fireEvent.click(screen.getByRole("button", { name: "Onsite" }));
    addTag(/^location/i, "Mumbai");
    change(/open positions/i, "4");
    change(/application deadline/i, "2099-06-30");
    change(/duration \(weeks\)/i, "24");
    change(/hours per week/i, "30");
    change(/from \(years\)/i, "4");
    change(/to \(years\)/i, "9");
    change(/^minimum \(/i, "20");
    change(/^maximum \(/i, "30");
    addTag(/required skills/i, "Go");
    change(/^description/i, "Design and operate the payment services for our platform.");
    change(/responsibilities/i, "Own reliability.");
    change(/nice to have/i, "Rust");
    addTag(/preferred colleges/i, "NIT Trichy");
    addTag(/target companies/i, "Zerodha");
    change(/notice period/i, "Up to 60 days");
    addTag(/perks and benefits/i, "ESOPs");
    change(/preferred industry/i, "SaaS");
    change(/preferred domain/i, "Growth");
    addTag(/other skills/i, "gRPC");
    change(/work schedule/i, "Flexible");
    change(/availability/i, "2 weeks");
    change(/relevant experience/i, "5+ years");
    fireEvent.click(screen.getByRole("checkbox", { name: /portfolio required/i }));
    change(/minimum readiness/i, "strongHire");
    change(/minimum star/i, "75");

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];

    // Run the exact payload through the real PATCH handler and capture the DB write.
    withAuthAndRateLimit.mockResolvedValue({ headers: {}, auth: { userId: "emp-1" } });
    let written: Record<string, unknown> | null = null;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/auth/v1/admin/users/")) return { ok: true, json: async () => ({ email: "boss@gmail.com", email_confirmed_at: "2026-01-01" }) };
      if (u.includes("/employer_requirement_activity")) return { ok: true, headers: { get: (h: string) => (h === "content-range" ? "0-0/0" : null) }, json: async () => [] };
      if (u.includes("status=neq.closed")) return { ok: true, headers: { get: (h: string) => (h === "content-range" ? "0-0/0" : null) }, json: async () => [] };
      if (init?.method === "PATCH") {
        written = JSON.parse(String(init.body));
        return { ok: true, json: async () => [{ ...toRow(STORED), ...written }] };
      }
      return { ok: true, json: async () => [toRow(STORED)] };
    }));
    const res = await handler(new Request("https://x.test/api/employer-requirement-detail?id=req-1", { method: "PATCH", body: JSON.stringify(payload) }));
    expect(res.status).toBe(200);

    expect(written).toMatchObject({
      title: "Staff Backend Engineer",
      department: "Platform",
      employment_type: "part-time",
      work_mode: "onsite",
      locations: ["Pune", "Mumbai"],
      location: "Pune, Mumbai",
      open_positions: 4,
      due_date: "2099-06-30",
      duration_weeks: 24,
      hours_per_week: 30,
      experience_min: 4,
      experience_max: 9,
      budget_min: 20,
      budget_max: 30,
      salary_type: "per-annum",
      skills: ["Node.js", "Go"],
      description: "Design and operate the payment services for our platform.",
      responsibilities: "Own reliability.",
      nice_to_have: "Rust",
      preferred_colleges: ["IIT Bombay", "NIT Trichy"],
      target_companies: ["Razorpay", "Zerodha"],
      notice_period_pref: "Up to 60 days",
      perks_and_benefits: ["Insurance", "ESOPs"],
      preferred_industry: "SaaS",
      preferred_domain: "Growth",
      custom_skill_sets: ["Kafka", "gRPC"],
      work_schedule: "Flexible",
      availability: "2 weeks",
      relevant_experience: "5+ years",
      portfolio_required: true,
      min_readiness_band: "strongHire",
      min_star_completeness: 75,
    });
  });
});

describe("detail page shows every saved field", () => {
  it("surfaces the fields the summary header omits", () => {
    const labels = roleDetailRows(STORED).map((r) => r.label);
    expect(labels).toEqual([
      "Department", "Open positions", "Notice period", "Work schedule", "Relevant experience",
      "Minimum readiness", "Minimum STAR completeness", "Responsibilities", "Nice to have",
      "Other skills", "Preferred colleges", "Target companies", "Perks and benefits",
    ]);
    const byLabel = Object.fromEntries(roleDetailRows(STORED).map((r) => [r.label, r]));
    expect(byLabel["Minimum readiness"].text).toBe("Hire or better");
    expect(byLabel["Minimum STAR completeness"].text).toBe("60%");
    expect(byLabel["Perks and benefits"].tags).toEqual(["Insurance"]);
  });

  it("skips empty fields", () => {
    const sparse = { ...STORED, department: null, openPositions: null, noticePeriodPref: "Any", workSchedule: "", relevantExperience: "", minReadinessBand: null, minStarCompleteness: null, responsibilities: "", niceToHave: "", customSkillSets: [], preferredColleges: [], targetCompanies: [], perksAndBenefits: [] } as Requirement;
    expect(roleDetailRows(sparse)).toEqual([]);
  });
});

describe("expired deadline", () => {
  const expired = { ...STORED, dueDate: "2020-01-01" } as Requirement;

  it("does not block saving when the deadline is left as it was", () => {
    expect(validateDraft(initialDraft(expired), "2026-10-10", expired.dueDate).dueDate).toBeUndefined();
  });

  it("still rejects a newly chosen past date", () => {
    const draft = { ...initialDraft(expired), dueDate: "2021-05-05" };
    expect(validateDraft(draft, "2026-10-10", expired.dueDate).dueDate).toMatch(/past/);
  });

  it("server accepts an unchanged expired deadline but rejects a changed past one", async () => {
    withAuthAndRateLimit.mockResolvedValue({ headers: {}, auth: { userId: "emp-1" } });
    const row = { ...toRow(STORED), due_date: "2020-01-01" };
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/auth/v1/admin/users/")) return { ok: true, json: async () => ({ email: "boss@gmail.com", email_confirmed_at: "2026-01-01" }) };
      if (u.includes("/employer_requirement_activity") || u.includes("status=neq.closed")) return { ok: true, headers: { get: (h: string) => (h === "content-range" ? "0-0/0" : null) }, json: async () => [] };
      if (init?.method === "PATCH") return { ok: true, json: async () => [{ ...row, ...JSON.parse(String(init.body)) }] };
      return { ok: true, json: async () => [row] };
    }));
    const send = (body: object) => handler(new Request("https://x.test/api/employer-requirement-detail?id=req-1", { method: "PATCH", body: JSON.stringify(body) }));
    expect((await send({ title: "Renamed backend engineer" })).status).toBe(200);
    expect((await send({ dueDate: "2020-01-01", title: "Renamed backend engineer" })).status).toBe(200);
    expect((await send({ dueDate: "2021-05-05" })).status).toBe(400);
  });
});
