import { describe, it, expect, vi, beforeEach } from "vitest";

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

const { default: handler } = await import("../../server-handlers/employer-dashboard");

const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
const req = (qs = "") => new Request(`https://x.test/api/employer-dashboard${qs}`, { method: "GET" });

function mockTables(tables: Record<string, unknown[]>, failTable?: string) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const table = Object.keys(tables).find((t) => url.includes(`/rest/v1/${t}?`));
    if (!table || table === failTable) return { ok: false, status: 500, json: async () => [] } as Response;
    return { ok: true, status: 200, json: async () => tables[table] } as Response;
  }) as typeof fetch;
}

beforeEach(() => {
  vi.restoreAllMocks();
  slogError.mockReset();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "emp-1" }, headers: {} });
});

describe("employer-dashboard handler", () => {
  it("returns 401 when unauthenticated and 405 for non-GET", async () => {
    withAuthAndRateLimit.mockResolvedValue({ auth: { userId: null }, headers: {} });
    expect((await handler(req())).status).toBe(401);
    withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "emp-1" }, headers: {} });
    expect((await handler(new Request("https://x.test/api/employer-dashboard", { method: "POST" }))).status).toBe(405);
  });

  it("aggregates pipeline counts, interviews, recommendations and activity", async () => {
    mockTables({
      employer_requirements: [{ id: "r1", title: "Backend Engineer", created_at: iso(-3) }],
      match_status_events: [
        { match_id: "m1aaaaaa", requirement_id: "r1", to_status: "interviewing", actor: "employer", note: null, created_at: iso(-1) },
      ],
      employer_requirement_activity: [{ requirement_id: "r1", created_at: iso(-2) }],
      requirement_matches: [
        { id: "m1aaaaaa", requirement_id: "r1", candidate_status: "interviewing", interview_scheduled_at: iso(2), candidate_status_updated_at: iso(-1), created_at: iso(-5), unlocked: false, unlocked_candidate_name: null, match_score: 80, profile_viewed_at: null },
        { id: "m2bbbbbb", requirement_id: "r1", candidate_status: "shortlisted", interview_scheduled_at: null, candidate_status_updated_at: null, created_at: iso(-1), unlocked: false, unlocked_candidate_name: null, match_score: 75, profile_viewed_at: null },
        { id: "m3cccccc", requirement_id: "r1", candidate_status: "hired", interview_scheduled_at: null, candidate_status_updated_at: iso(-4), created_at: iso(-9), unlocked: true, unlocked_candidate_name: "Riya Shah", match_score: 90, profile_viewed_at: iso(-8) },
      ],
    });

    const res = await handler(req("?range=30"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.range).toBe(30);
    expect(body.jobs).toEqual([{ requirementId: "r1", interviewing: 1, hired: 1, lastUpdatedAt: expect.any(String) }]);
    expect(body.totals).toEqual({ interviewsScheduled: 1, hired: 1, unviewedRecommended: 1 });
    expect(body.trends.interviews.current).toBe(1);
    expect(body.trends.jobs.current).toBe(1);
    expect(body.upcomingInterviews[0]).toMatchObject({ matchId: "m1aaaaaa", candidateName: "Candidate #m1aaaa", roleTitle: "Backend Engineer" });
    expect(body.recommended.map((r: { matchId: string }) => r.matchId)).toEqual(["m2bbbbbb"]);
    expect(body.activity[0].text).toBe("You moved Candidate #m1aaaa to Interviewing");
  });

  it("works for an employer with no jobs, and falls back to a 30-day range", async () => {
    mockTables({ employer_requirements: [], match_status_events: [], employer_requirement_activity: [], requirement_matches: [] });
    const body = await (await handler(req("?range=11"))).json();
    expect(body.range).toBe(30);
    expect(body.jobs).toEqual([]);
    expect(body.totals.interviewsScheduled).toBe(0);
  });

  it("returns 500 and logs when a read fails", async () => {
    mockTables({ employer_requirements: [], match_status_events: [], employer_requirement_activity: [] }, "match_status_events");
    const res = await handler(req());
    expect(res.status).toBe(500);
    expect(slogError).toHaveBeenCalled();
  });
});
