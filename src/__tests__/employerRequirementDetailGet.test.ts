import { describe, it, expect, vi, beforeEach } from "vitest";

/* GET /api/employer-requirement-detail: masking of locked matches, consent
 * filtering, fail-closed behaviour and additive pagination. */

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
const slogError = vi.fn();
vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...a: unknown[]) => withAuthAndRateLimit(...a),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  slog: { error: (...a: unknown[]) => slogError(...a) },
}));
vi.mock("../../server-handlers/employer-requirements", () => ({
  runMatching: vi.fn(),
  logRequirementActivity: vi.fn(),
}));

const { default: handler } = await import("../../server-handlers/employer-requirement-detail");

const EMPLOYER = "emp-1";
const REQ_ROW = {
  id: "req-1", title: "Frontend Developer", location: "Bengaluru", notice_period_pref: "30 days", description: "Build UIs.",
  status: "ready", stage: "ready_for_review", department: null, archive_reason: null, archive_disposition: null,
  experience_min: 1, experience_max: 4, due_date: null, budget_min: null, budget_max: null, locations: ["Bengaluru"],
  open_positions: 1, work_mode: null, skills: ["React"], responsibilities: null, nice_to_have: null, preferred_industry: null,
  preferred_colleges: null, target_companies: null, perks_and_benefits: null, employment_type: null, salary_type: null,
  duration_weeks: null, hours_per_week: null, preferred_domain: null, work_schedule: null, availability: null,
  relevant_experience: null, portfolio_required: false, custom_skill_sets: null, min_readiness_band: null,
  min_star_completeness: null, matched_pool_size: 0, created_at: "2026-09-01T00:00:00Z", last_matched_at: null,
};

interface SimMatch { id: string; candidate_user_id: string; match_score: number; unlocked?: boolean; candidate_status?: string }
interface Sim {
  matches: SimMatch[];
  blocks?: string[];
  optedOut?: string[];
  blocksFail?: boolean;
  noResume?: string[];
}

const NAME = "Priya Sharma";
const EMAIL = "priya.sharma@gmail.com";
const PHONE = "+91 98765 43210";

function profileRow(id: string) {
  return {
    id, name: NAME, email: EMAIL, target_role: "Frontend Developer",
    resume_data: { _type: "fallback", name: NAME, email: EMAIL, phone: PHONE, skills: ["React", "TypeScript"], summary: `Reach me on ${EMAIL} or ${PHONE}` },
    practice_timestamps: [], portfolio_links: [{ label: "GitHub", url: "https://github.com/priya" }],
  };
}

function install(sim: Sim) {
  const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body, text: async () => "" });
  global.fetch = vi.fn(async (input: string) => {
    const url = String(input);
    if (url.includes("/rest/v1/employer_requirements?")) return json([REQ_ROW]);
    if (url.includes("/rest/v1/requirement_matches?")) {
      if (url.includes("id=gt.")) return json([]);
      return json(sim.matches.map((m) => ({
        id: m.id, candidate_user_id: m.candidate_user_id, match_score: m.match_score, roster_score: m.match_score,
        unlocked: !!m.unlocked, unlocked_at: m.unlocked ? "2026-09-02T00:00:00Z" : null,
        candidate_status: m.candidate_status ?? "shortlisted", candidate_status_note: null, interview_scheduled_at: null,
      })));
    }
    if (url.includes("/rest/v1/employer_blocks?")) return sim.blocksFail ? json([], false) : json((sim.blocks ?? []).map((c) => ({ candidate_user_id: c })));
    if (url.includes("/rest/v1/sessions?")) return json([]);
    if (url.includes("/rest/v1/profiles?")) {
      const ids = decodeURIComponent(url.match(/id=in\.\(([^)]*)\)/)?.[1] || "").split(",").filter(Boolean);
      if (url.includes("select=id,employer_visibility")) {
        return json(ids.map((id) => ({ id, employer_visibility: (sim.optedOut ?? []).includes(id) ? "off" : "masked" })));
      }
      if (url.includes("resume_data=not.is.null&select=id")) return json(ids.filter((id) => !(sim.noResume ?? []).includes(id)).map((id) => ({ id })));
      return json(ids.map(profileRow));
    }
    return json([]);
  }) as unknown as typeof fetch;
}

const m = (n: number, extra: Partial<SimMatch> = {}): SimMatch => ({
  id: `match-${String(n).padStart(4, "0")}-xxxxxxxx`,
  candidate_user_id: `cand-${n}`,
  match_score: 100 - n,
  ...extra,
});

async function get(query = "") {
  const res = await handler(new Request(`https://x.test/api/employer-requirement-detail?id=req-1${query}`));
  return { status: res.status, body: await res.json() as Record<string, unknown> & { candidates: Array<Record<string, unknown>> } };
}

beforeEach(() => {
  slogError.mockReset();
  withAuthAndRateLimit.mockReset();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: EMPLOYER }, headers: {} });
});

describe("GET employer-requirement-detail — masking", () => {
  it("never returns identity or contact details for a locked match", async () => {
    install({ matches: [m(1)] });
    const { status, body } = await get();
    expect(status).toBe(200);
    const c = body.candidates[0];
    expect(c.name).toBe("Candidate #match-");
    expect(c.unlocked).toBe(false);
    expect(c.contact).toBeUndefined();
    expect(c.portfolioLinks).toEqual([]);
    expect(Array.isArray(c.maskedFields) && (c.maskedFields as string[]).length).toBeGreaterThan(0);
    const raw = JSON.stringify(c);
    expect(raw).not.toContain(EMAIL);
    expect(raw).not.toContain("98765");
    expect(raw).not.toContain("github.com/priya");
  });

  it("returns real name and contact only for an unlocked match", async () => {
    install({ matches: [m(1, { unlocked: true })] });
    const { body } = await get();
    const c = body.candidates[0];
    expect(c.name).toBe(NAME);
    expect(c.contact).toMatchObject({ email: EMAIL });
    expect(c.maskedFields).toEqual([]);
    expect(c.candidateWithdrew).toBe(false);
  });
});

describe("GET employer-requirement-detail — consent", () => {
  it("hides blocked candidates entirely, paid or not", async () => {
    install({ matches: [m(1), m(2, { unlocked: true }), m(3)], blocks: ["cand-1", "cand-2"] });
    const { body } = await get();
    expect(body.candidates.map((c) => c.id)).toEqual([m(3).id]);
    expect(body.total).toBe(1);
  });

  it("hides a locked opted-out candidate but keeps a paid one, flagged candidateWithdrew", async () => {
    install({ matches: [m(1), m(2, { unlocked: true })], optedOut: ["cand-1", "cand-2"] });
    const { body } = await get();
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0].id).toBe(m(2).id);
    expect(body.candidates[0].candidateWithdrew).toBe(true);
  });

  it("drops a stale locked row with no evidence (no resume, no graded session)", async () => {
    install({ matches: [m(1), m(2)], noResume: ["cand-1"] });
    const { body } = await get();
    expect(body.candidates.map((c) => c.id)).toEqual([m(2).id]);
  });

  it("fails closed with a 500 (no candidates) when the block list cannot be read", async () => {
    install({ matches: [m(1)], blocksFail: true });
    const { status, body } = await get();
    expect(status).toBe(500);
    expect(body.candidates).toBeUndefined();
    expect(slogError).toHaveBeenCalled();
  });
});

describe("GET employer-requirement-detail — pagination", () => {
  const many = Array.from({ length: 60 }, (_, i) => m(i + 1));

  it("defaults to 25 per page, best score first, with total and nextPage", async () => {
    install({ matches: many });
    const { body } = await get();
    expect(body.candidates).toHaveLength(25);
    expect(body.candidates[0].id).toBe(m(1).id);
    expect(body).toMatchObject({ page: 1, limit: 25, total: 60, nextPage: 2 });
    expect(body.pagination).toEqual({ page: 1, limit: 25, total: 60, nextPage: 2 });
  });

  it("serves later pages and ends with nextPage null", async () => {
    install({ matches: many });
    const { body } = await get("&page=3&limit=25");
    expect(body.candidates).toHaveLength(10);
    expect(body.candidates[0].id).toBe(m(51).id);
    expect(body.nextPage).toBeNull();
  });

  it("clamps limit to 100 and treats junk params as defaults", async () => {
    install({ matches: many });
    const big = await get("&limit=9999");
    expect(big.body.limit).toBe(100);
    expect(big.body.candidates).toHaveLength(60);
    const junk = await get("&page=abc&limit=-5");
    expect(junk.body.page).toBe(1);
    expect(junk.body.limit).toBe(25);
  });

  it("totalMatched is at least the visible total", async () => {
    install({ matches: many });
    const { body } = await get();
    expect(body.totalMatched).toBeGreaterThanOrEqual(60);
  });
});
