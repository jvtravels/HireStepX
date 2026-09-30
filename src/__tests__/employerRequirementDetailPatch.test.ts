import { describe, it, expect, vi, beforeEach } from "vitest";

/* PATCH /api/employer-requirement-detail is used both by the full edit form
 * (which sends every field) and the lightweight "extend deadline" modal
 * (which only sends dueDate plus the required title/locations/description
 * trio). It previously treated the body as a full replace: any field the
 * caller didn't send — department, salaryType, preferredDomain, etc. — was
 * silently reset to null/a hardcoded default on every PATCH (C8). These
 * tests lock in the fix: an omitted field falls back to the existing DB
 * value, not a default. */

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
const slogError = vi.fn();

vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...args: unknown[]) => withAuthAndRateLimit(...args),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  slog: { error: (...args: unknown[]) => slogError(...args) },
}));

const runMatching = vi.fn();
const logRequirementActivity = vi.fn();

vi.mock("../../server-handlers/employer-requirements", () => ({
  runMatching: (...args: unknown[]) => runMatching(...args),
  logRequirementActivity: (...args: unknown[]) => logRequirementActivity(...args),
}));

const { default: handler } = await import("../../server-handlers/employer-requirement-detail");

const EXISTING_ROW = {
  id: "req-1",
  employer_id: "emp-1",
  title: "UI/UX Designer",
  location: "Bengaluru",
  notice_period_pref: "30 days",
  description: "Design end-to-end product experiences for our marketplace app.",
  status: "ready",
  stage: "ready_for_review",
  department: "Product",
  archive_reason: null,
  archive_disposition: null,
  experience_min: 2,
  experience_max: 5,
  due_date: "2026-11-01",
  budget_min: 12,
  budget_max: 20,
  locations: ["Bengaluru"],
  open_positions: 2,
  work_mode: "hybrid",
  skills: ["Figma"],
  responsibilities: "Own the design system.",
  nice_to_have: "Motion design",
  preferred_industry: "E-commerce",
  preferred_colleges: ["IIT Bombay"],
  target_companies: ["Meesho"],
  perks_and_benefits: ["ESOPs"],
  employment_type: "full-time",
  salary_type: "per-annum",
  preferred_domain: "Consumer tech",
  work_schedule: "IST hours",
  availability: "Immediate",
  relevant_experience: "3+ years in B2C",
  portfolio_required: true,
  custom_skill_sets: ["Design systems"],
  duration_weeks: null,
  hours_per_week: null,
  created_at: "2026-01-01T00:00:00Z",
};

function patchReq(body: Record<string, unknown>) {
  return new Request("https://x.test/api/employer-requirement-detail?id=req-1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "emp-1" }, headers: {} });
  runMatching.mockResolvedValue("ready");
  logRequirementActivity.mockResolvedValue(undefined);
});

describe("employer-requirement-detail PATCH — partial update preserves omitted fields", () => {
  it("keeps department, salaryType, and other optional fields when only extending the due date", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [EXISTING_ROW] }) // existing-row lookup
      .mockResolvedValueOnce({ ok: true, json: async () => [{ ...EXISTING_ROW, due_date: "2026-12-01" }] }); // patch response
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(
      patchReq({
        title: EXISTING_ROW.title,
        locations: EXISTING_ROW.locations,
        description: EXISTING_ROW.description,
        dueDate: "2026-12-01",
      }),
    );

    expect(res.status).toBe(200);
    const patchCall = fetchMock.mock.calls[1];
    const sentBody = JSON.parse((patchCall[1] as RequestInit).body as string);
    expect(sentBody.department).toBe("Product");
    expect(sentBody.salary_type).toBe("per-annum");
    expect(sentBody.preferred_domain).toBe("Consumer tech");
    expect(sentBody.work_schedule).toBe("IST hours");
    expect(sentBody.availability).toBe("Immediate");
    expect(sentBody.relevant_experience).toBe("3+ years in B2C");
    expect(sentBody.portfolio_required).toBe(true);
    expect(sentBody.custom_skill_sets).toEqual(["Design systems"]);
    expect(sentBody.budget_min).toBe(12);
    expect(sentBody.budget_max).toBe(20);
    expect(sentBody.due_date).toBe("2026-12-01");
  });

  it("still applies an explicitly sent field that clears a value", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [EXISTING_ROW] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ ...EXISTING_ROW, department: null }] });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(
      patchReq({
        title: EXISTING_ROW.title,
        locations: EXISTING_ROW.locations,
        description: EXISTING_ROW.description,
        dueDate: EXISTING_ROW.due_date,
        department: "",
      }),
    );

    expect(res.status).toBe(200);
    const sentBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(sentBody.department).toBeNull();
  });
});
