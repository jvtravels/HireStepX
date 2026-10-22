import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync } from "node:fs";

/* Critical-path latency of the two employer read handlers. Every database call
 * costs a fixed virtual LATENCY_MS on a fake clock, so elapsed / LATENCY_MS is
 * the number of sequential round trips a request waits for. Deterministic, no
 * real sleeping. Concurrent calls overlap, sequential ones add up. */

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...a: unknown[]) => withAuthAndRateLimit(...a),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  slog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("../../server-handlers/_requirement-match-llm", () => ({
  llmRerankCandidates: vi.fn(async () => new Map()),
  blendScore: (score: number) => score,
}));
vi.mock("../../server-handlers/_notify", () => ({ notify: vi.fn() }));

const { default: detailHandler } = await import("../../server-handlers/employer-requirement-detail");
const { default: listHandler } = await import("../../server-handlers/employer-requirements");

const LATENCY_MS = 80;
const EMPLOYER = "emp-1";

const reqRow = (id: string) => ({
  id, title: "Frontend Developer", location: "Bengaluru", notice_period_pref: "30 days", description: "Build UIs.",
  status: "ready", stage: "ready_for_review", department: null, archive_reason: null, archive_disposition: null,
  experience_min: 1, experience_max: 4, due_date: null, budget_min: null, budget_max: null, locations: ["Bengaluru"],
  open_positions: 1, work_mode: null, skills: ["React"], responsibilities: null, nice_to_have: null, preferred_industry: null,
  preferred_colleges: null, target_companies: null, perks_and_benefits: null, employment_type: null, salary_type: null,
  duration_weeks: null, hours_per_week: null, preferred_domain: null, work_schedule: null, availability: null,
  relevant_experience: null, portfolio_required: false, custom_skill_sets: null, min_readiness_band: null,
  min_star_completeness: null, matched_pool_size: 0, created_at: "2026-09-01T00:00:00Z", last_matched_at: null,
});

const profile = (id: string, withResume: boolean) => ({
  id, name: `Cand ${id}`, email: `${id}@x.test`, target_role: "Frontend Developer",
  resume_data: withResume ? { _type: "fallback", name: id, skills: ["React"], experience: [], education: [] } : null,
  practice_timestamps: [], portfolio_links: [],
});

interface World { requirements: number; candidates: number; withResume: boolean }
let calls = 0;

function install(w: World) {
  calls = 0;
  const candIds = Array.from({ length: w.candidates }, (_, i) => `cand-${String(i).padStart(4, "0")}`);
  const reqIds = Array.from({ length: w.requirements }, (_, i) => `req-${String(i).padStart(3, "0")}`);
  const json = (body: unknown, headers: Record<string, string> = {}) =>
    ({ ok: true, status: 200, headers: new Headers(headers), json: async () => body, text: async () => "" });
  const idsIn = (url: string, key: string) =>
    decodeURIComponent(url.match(new RegExp(`[?&]${key}=in\\.\\(([^)]*)\\)`))?.[1] || "").split(",").filter(Boolean);

  global.fetch = vi.fn(async (input: string) => {
    calls++;
    await new Promise((r) => setTimeout(r, LATENCY_MS));
    const url = String(input);
    if (url.includes("/rest/v1/employer_requirements?")) {
      const rows = url.includes("id=eq.") ? [reqRow(reqIds[0])] : reqIds.map(reqRow);
      return json(rows, { "content-range": `0-${rows.length - 1}/${rows.length}` });
    }
    if (url.includes("/rest/v1/requirement_matches?")) {
      if (url.includes("id=gt.")) return json([]);
      const wanted = url.includes("requirement_id=in.(") ? idsIn(url, "requirement_id") : [reqIds[0]];
      const rows = wanted.flatMap((rid) => candIds.map((c, i) => ({
        id: `${rid}-m${i}`, requirement_id: rid, candidate_user_id: c, match_score: 90 - (i % 50), roster_score: 90 - (i % 50),
        unlocked: false, unlocked_at: null, candidate_status: "shortlisted", candidate_response: "none", candidate_status_note: null,
        interview_scheduled_at: null, candidate_status_updated_at: null, created_at: "2026-09-01T00:00:00Z",
      })));
      return json(rows);
    }
    if (url.includes("/rest/v1/employer_blocks?")) return json([]);
    if (url.includes("/rest/v1/sessions?")) {
      const ids = idsIn(url, "user_id");
      return json(ids.map((u) => ({ user_id: u, score: 70, created_at: "2026-09-01T00:00:00Z", type: "technical", target_role: "Frontend Developer", report_generated_at: "2026-09-01T00:00:00Z" })));
    }
    if (url.includes("/rest/v1/profiles?")) {
      const ids = idsIn(url, "id");
      if (url.includes("select=id,employer_visibility")) return json(ids.map((id) => ({ id, employer_visibility: "masked", deleted_at: null })));
      if (url.includes("resume_data=not.is.null&select=id")) return json(w.withResume ? ids.map((id) => ({ id })) : []);
      return json(ids.map((id) => profile(id, w.withResume)));
    }
    return json([]);
  }) as unknown as typeof fetch;
}

async function timed(run: () => Promise<Response>): Promise<{ trips: number; calls: number; status: number }> {
  const start = Date.now();
  let settled: Response | null = null;
  const p = run().then((r) => { settled = r; });
  for (let i = 0; i < 200 && !settled; i++) await vi.advanceTimersByTimeAsync(LATENCY_MS);
  await p;
  return { trips: Math.round((Date.now() - start) / LATENCY_MS), calls, status: (settled as unknown as Response).status };
}

const results: Array<{ scenario: string; trips: number; calls: number }> = [];
const record = (scenario: string, r: { trips: number; calls: number }) => results.push({ scenario, trips: r.trips, calls: r.calls });

beforeEach(() => {
  vi.useFakeTimers();
  withAuthAndRateLimit.mockReset();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: EMPLOYER }, headers: {} });
});
afterEach(() => { vi.useRealTimers(); });

describe("employer read latency (virtual clock, 80 ms per database call)", () => {
  it("detail GET, 300 matches with resumes", async () => {
    install({ requirements: 1, candidates: 300, withResume: true });
    const r = await timed(() => detailHandler(new Request("https://x.test/api/employer-requirement-detail?id=req-000")));
    expect(r.status).toBe(200);
    expect(r.trips).toBeLessThanOrEqual(3);
    record("detail GET, 300 matches, resumes on file", r);
  });

  it("detail GET, 300 matches without resumes (graded sessions are the evidence)", async () => {
    install({ requirements: 1, candidates: 300, withResume: false });
    const r = await timed(() => detailHandler(new Request("https://x.test/api/employer-requirement-detail?id=req-000")));
    expect(r.status).toBe(200);
    expect(r.trips).toBeLessThanOrEqual(4);
    record("detail GET, 300 matches, no resumes", r);
  });

  it("requirements list GET, 45 requirements x 120 candidates", async () => {
    install({ requirements: 45, candidates: 120, withResume: true });
    const r = await timed(() => listHandler(new Request("https://x.test/api/employer-requirements")));
    expect(r.status).toBe(200);
    expect(r.trips).toBeLessThanOrEqual(4);
    record("list GET, 45 requirements, 120 candidates", r);
  });

  it("requirements list GET, 45 requirements x 300 candidates", async () => {
    install({ requirements: 45, candidates: 300, withResume: true });
    const r = await timed(() => listHandler(new Request("https://x.test/api/employer-requirements")));
    expect(r.status).toBe(200);
    expect(r.trips).toBeLessThanOrEqual(4);
    record("list GET, 45 requirements, 300 candidates", r);
  });

  it("both GET handlers append handler;dur to the preamble's Server-Timing header", async () => {
    withAuthAndRateLimit.mockResolvedValue({ auth: { userId: EMPLOYER }, headers: { "Server-Timing": "pre;dur=5" } });
    install({ requirements: 2, candidates: 5, withResume: true });
    const settle = async (run: () => Promise<Response>) => {
      let res: Response | null = null;
      const p = run().then((r) => { res = r; });
      for (let i = 0; i < 200 && !res; i++) await vi.advanceTimersByTimeAsync(LATENCY_MS);
      await p;
      return res as unknown as Response;
    };
    const detail = await settle(() => detailHandler(new Request("https://x.test/api/employer-requirement-detail?id=req-000")));
    const list = await settle(() => listHandler(new Request("https://x.test/api/employer-requirements")));
    for (const res of [detail, list]) {
      expect(res.status).toBe(200);
      expect(res.headers.get("Server-Timing")).toMatch(/^pre;dur=5, handler;dur=\d+$/);
    }
  });

  it("prints the table", () => {
    const out = process.env.LATENCY_REPORT;
    if (out) writeFileSync(out, results.map((x) => `${x.scenario} | ${x.trips} | ${x.calls} | ${x.trips * LATENCY_MS} ms`).join("\n") + "\n");
    expect(results.length).toBeGreaterThan(0);
  });
});
