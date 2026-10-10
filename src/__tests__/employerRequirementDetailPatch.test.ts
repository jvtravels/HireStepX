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


interface RouteOpts {
  /** Row returned by the requirement lookup (may carry an `employers` embed). */
  existing: Record<string, unknown>;
  /** Row returned by the PATCH on employer_requirements. */
  patched?: Record<string, unknown>;
  /** employer_requirement_activity count in the last hour (rematch limit). */
  recentRematches?: number | null;
  /** Open (non-closed) requirement count. */
  openRequirements?: number | null;
  /** Auth identity for tier derivation; default is a free-mail (basic) user. */
  identity?: { email: string; email_confirmed_at: string | null };
}

/** URL-routed fetch mock: the handler now makes identity + count reads in
 *  addition to the lookup/patch, so call order is no longer a safe contract. */
function routedFetch(o: RouteOpts) {
  const count = (n: number | null) =>
    n === null
      ? { ok: false, status: 500, headers: { get: () => null }, json: async () => [] }
      : { ok: true, headers: { get: (h: string) => (h === "content-range" ? `0-0/${n}` : null) }, json: async () => [] };
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/auth/v1/admin/users/")) {
      return { ok: true, json: async () => o.identity ?? { email: "boss@gmail.com", email_confirmed_at: "2026-01-01" } };
    }
    if (u.includes("/employer_requirement_activity")) return count(o.recentRematches === undefined ? 0 : o.recentRematches);
    if (u.includes("/employer_requirements") && u.includes("status=neq.closed") && u.includes("employer_id=eq.")) {
      return count(o.openRequirements === undefined ? 0 : o.openRequirements);
    }
    if (init?.method === "PATCH") return { ok: true, json: async () => [o.patched ?? o.existing] };
    return { ok: true, json: async () => [o.existing] };
  });
}

function patchCall(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "PATCH");
}

beforeEach(() => {
  vi.restoreAllMocks();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "emp-1" }, headers: {} });
  runMatching.mockReset();
  runMatching.mockResolvedValue("ready");
  logRequirementActivity.mockResolvedValue(undefined);
});

describe("employer-requirement-detail PATCH — partial update preserves omitted fields", () => {
  it("keeps department, salaryType, and other optional fields when only extending the due date", async () => {
    const fetchMock = routedFetch({ existing: EXISTING_ROW, patched: { ...EXISTING_ROW, due_date: "2026-12-01" } }); // patch response
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
    const sentBody = JSON.parse((patchCall(fetchMock)![1] as RequestInit).body as string);
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
    const fetchMock = routedFetch({ existing: EXISTING_ROW, patched: { ...EXISTING_ROW, department: null } });
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
    const sentBody = JSON.parse((patchCall(fetchMock)![1] as RequestInit).body as string);
    expect(sentBody.department).toBeNull();
  });

  it("clears budgetMin/budgetMax when salaryType changes without resubmitting them", async () => {
    // budget_min/budget_max are unit-dependent on salary_type (whole lakhs for
    // per-annum, raw rupees for per-month/fixed). A requirement priced ₹70,000/mo
    // whose salaryType flips to per-annum without new budget figures must not
    // carry the raw-rupee 70000 forward tagged as lakhs.
    const perMonthRow = { ...EXISTING_ROW, salary_type: "per-month", budget_min: 70000, budget_max: 90000 };
    const fetchMock = routedFetch({ existing: perMonthRow, patched: { ...perMonthRow, salary_type: "per-annum", budget_min: null, budget_max: null } });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(
      patchReq({
        title: EXISTING_ROW.title,
        locations: EXISTING_ROW.locations,
        description: EXISTING_ROW.description,
        dueDate: EXISTING_ROW.due_date,
        salaryType: "per-annum",
      }),
    );

    expect(res.status).toBe(200);
    const sentBody = JSON.parse((patchCall(fetchMock)![1] as RequestInit).body as string);
    expect(sentBody.salary_type).toBe("per-annum");
    expect(sentBody.budget_min).toBeNull();
    expect(sentBody.budget_max).toBeNull();
  });

  it("keeps budgetMin/budgetMax when salaryType is unchanged", async () => {
    const fetchMock = routedFetch({ existing: EXISTING_ROW, patched: EXISTING_ROW });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(
      patchReq({
        title: EXISTING_ROW.title,
        locations: EXISTING_ROW.locations,
        description: EXISTING_ROW.description,
        dueDate: EXISTING_ROW.due_date,
        salaryType: EXISTING_ROW.salary_type,
      }),
    );

    expect(res.status).toBe(200);
    const sentBody = JSON.parse((patchCall(fetchMock)![1] as RequestInit).body as string);
    expect(sentBody.budget_min).toBe(12);
    expect(sentBody.budget_max).toBe(20);
  });
});

const EDIT_BODY = {
  title: EXISTING_ROW.title,
  locations: EXISTING_ROW.locations,
  description: EXISTING_ROW.description,
  dueDate: EXISTING_ROW.due_date,
};

describe("employer-requirement-detail PATCH — suspension and tier limits", () => {
  it("refuses an edit from a suspended employer with 403 and writes nothing", async () => {
    const existing = { ...EXISTING_ROW, employers: { suspended_at: "2026-05-01T00:00:00Z", verification_tier: "verified", website: null } };
    const fetchMock = routedFetch({ existing });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(patchReq(EDIT_BODY));

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("suspended");
    expect(patchCall(fetchMock)).toBeUndefined();
    expect(runMatching).not.toHaveBeenCalled();
  });

  it("also refuses a no-rematch edit (interviewing stage) when suspended", async () => {
    const existing = { ...EXISTING_ROW, stage: "interviewing", employers: { suspended_at: "2026-05-01T00:00:00Z" } };
    const fetchMock = routedFetch({ existing });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(patchReq(EDIT_BODY));

    expect(res.status).toBe(403);
    expect(patchCall(fetchMock)).toBeUndefined();
  });

  it("returns 429 with tier/limit and Retry-After once the hourly rematch limit is hit, before any write", async () => {
    const fetchMock = routedFetch({ existing: EXISTING_ROW, recentRematches: 5 }); // basic tier = 5/hour
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(patchReq(EDIT_BODY));

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({ code: "rematch_limit", tier: "basic", limit: 5 });
    expect(res.headers.get("Retry-After")).toBe("3600");
    expect(patchCall(fetchMock)).toBeUndefined();
    expect(runMatching).not.toHaveBeenCalled();
  });

  it("does not fail open when the rematch count can't be read (503)", async () => {
    const fetchMock = routedFetch({ existing: EXISTING_ROW, recentRematches: null });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(patchReq(EDIT_BODY));

    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("limit_check_unavailable");
    expect(patchCall(fetchMock)).toBeUndefined();
  });

  it("a higher verified tier gets a higher rematch allowance", async () => {
    const existing = { ...EXISTING_ROW, employers: { suspended_at: null, verification_tier: "verified", website: null } };
    const fetchMock = routedFetch({ existing, recentRematches: 6 }); // would block basic (5), fine for verified (40)
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(patchReq(EDIT_BODY));

    expect(res.status).toBe(200);
    expect(runMatching).toHaveBeenCalledTimes(1);
  });

  it("an edit that skips re-matching (interviewing stage) isn't charged against the rematch limit", async () => {
    const existing = { ...EXISTING_ROW, stage: "interviewing" };
    const fetchMock = routedFetch({ existing, recentRematches: 99 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(patchReq(EDIT_BODY));

    expect(res.status).toBe(200);
    expect(runMatching).not.toHaveBeenCalled();
  });

  it("reopen is refused at the open-requirement limit (403 requirement_limit) before the status flips", async () => {
    const closed = { ...EXISTING_ROW, status: "closed" };
    const fetchMock = routedFetch({ existing: closed, openRequirements: 3 }); // basic tier = 3 open
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(patchReq({ action: "reopen" }));

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "requirement_limit", tier: "basic", limit: 3 });
    expect(patchCall(fetchMock)).toBeUndefined();
  });

  it("archive still works for a suspended employer", async () => {
    const existing = { ...EXISTING_ROW, employers: { suspended_at: "2026-05-01T00:00:00Z" } };
    const fetchMock = routedFetch({ existing, patched: { id: "req-1", status: "closed" } });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(patchReq({ action: "archive" }));

    expect(res.status).toBe(200);
    expect(patchCall(fetchMock)).toBeDefined();
  });

  it("set_stage is refused for a suspended employer", async () => {
    const existing = { id: "req-1", stage: "ready_for_review", status: "ready", employers: { suspended_at: "2026-05-01T00:00:00Z" } };
    const fetchMock = routedFetch({ existing });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(patchReq({ action: "set_stage", stage: "interviewing" }));

    expect(res.status).toBe(403);
    expect(patchCall(fetchMock)).toBeUndefined();
  });
});
