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

const { default: handler } = await import("../../server-handlers/candidate-hiring-activity");

function req() {
  return new Request("https://x.test/api/candidate-hiring-activity", { method: "GET" });
}

beforeEach(() => {
  vi.restoreAllMocks();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "u1" }, headers: {} });
});

describe("candidate-hiring-activity handler", () => {
  it("returns 401 when unauthenticated", async () => {
    withAuthAndRateLimit.mockResolvedValue({ auth: { userId: null }, headers: {} });
    const res = await handler(req());
    expect(res.status).toBe(401);
  });

  it("returns shortlisted/unlocked counts and recent matches, excluding closed non-unlocked ones", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ target_role: null, resume_data: null }] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: "m1",
            unlocked: true,
            unlocked_at: "2026-08-01T00:00:00Z",
            match_score: 90,
            created_at: "2026-07-01T00:00:00Z",
            employer_requirements: {
              title: "Backend Engineer",
              location: "Bengaluru",
              status: "closed",
              work_mode: "hybrid",
              budget_min: 12,
              budget_max: 18,
              experience_min: 2,
              experience_max: 4,
              skills: ["Node.js"],
              employers: { company_name: "Acme" },
            },
          },
          {
            id: "m2",
            unlocked: false,
            unlocked_at: null,
            match_score: 70,
            created_at: "2026-07-02T00:00:00Z",
            employer_requirements: {
              title: "SDE II",
              location: "Remote",
              status: "closed",
              work_mode: "remote",
              budget_min: null,
              budget_max: null,
              experience_min: null,
              experience_max: null,
              skills: null,
              employers: null,
            },
          },
          {
            id: "m3",
            unlocked: false,
            unlocked_at: null,
            match_score: 55,
            created_at: "2026-07-03T00:00:00Z",
            employer_requirements: {
              title: "Frontend Engineer",
              location: "Pune",
              status: "ready",
              work_mode: null,
              budget_min: null,
              budget_max: null,
              experience_min: null,
              experience_max: null,
              skills: [],
              employers: { company_name: "Beta" },
            },
          },
        ],
      });
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(req());
    const body = await res.json();

    // m1 (unlocked, closed) counts; m2 (not unlocked, closed) is dropped; m3 (ready) counts.
    expect(body.shortlistedCount).toBe(2);
    expect(body.unlockedCount).toBe(1);
    expect(body.recent.map((r: { roleTitle: string }) => r.roleTitle)).toEqual([
      "Backend Engineer",
      "Frontend Engineer",
    ]);
    expect(body.recent[0].companyName).toBe("Acme");
    expect(body.recent[0].unlockedAt).toBe("2026-08-01T00:00:00Z");
    // m3 is only matched (not unlocked): the employer's identity must not leave the server.
    expect(body.recent[1].companyName).toBe("Confidential company");
    expect(body.recent[1].companyLogoPath).toBeNull();
    expect(body.recent[1].companyWebsite).toBeNull();
  });

  it("returns pipeline status, response and interview time for each match", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ target_role: null, resume_data: null }] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          id: "m9", requirement_id: "r9", unlocked: true, unlocked_at: null, match_score: 80, created_at: "2026-07-01T00:00:00Z",
          candidate_status: "interview_invited", candidate_response: "interested", interview_scheduled_at: "2026-11-02T09:30:00Z",
          employer_requirements: { title: "SDE", location: "Pune", status: "open", skills: [], employers: { company_name: "Acme" } },
        }],
      })
      .mockResolvedValue({ ok: true, json: async () => [] }));
    const res = await handler(new Request("https://x.test/api/candidate-hiring-activity?full=1"));
    const body = await res.json();
    expect(body.recent[0]).toMatchObject({
      requirementId: "r9", candidateStatus: "interview_invited", candidateResponse: "interested", interviewScheduledAt: "2026-11-02T09:30:00Z",
    });
  });

  it("returns 500 and logs when the profile read fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    const res = await handler(req());
    expect(res.status).toBe(500);
    expect(slogError).toHaveBeenCalled();
  });

  it("drops matches whose employer is suspended or pending deletion, even when unlocked", async () => {
    const mk = (id: string, unlocked: boolean, employers: Record<string, unknown>) => ({
      id, unlocked, unlocked_at: unlocked ? "2026-08-01T00:00:00Z" : null, match_score: 80, created_at: "2026-07-01T00:00:00Z",
      employer_requirements: { title: `Role ${id}`, location: "Pune", status: "ready", skills: [], employers },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ target_role: null, resume_data: null }] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          mk("live", true, { company_name: "Live Co", suspended_at: null }),
          mk("gone-unlocked", true, { company_name: "Gone Co", suspended_at: "2026-09-01T00:00:00Z" }),
          mk("gone-matched", false, { company_name: "Gone Co 2", suspended_at: "2026-09-01T00:00:00Z" }),
        ],
      });
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    global.fetch = fetchMock as unknown as typeof fetch;

    const body = await (await handler(req())).json();
    expect(body.shortlistedCount).toBe(1);
    expect(body.unlockedCount).toBe(1);
    expect(body.recent.map((r: { id: string }) => r.id)).toEqual(["live"]);
    expect(JSON.stringify(body)).not.toMatch(/Gone Co/);
    const matchesUrl = String(fetchMock.mock.calls[1][0]);
    expect(matchesUrl).toContain("suspended_at");
  });
  it("returns a closed, locked match only when asked for by id, and exposes the extra posting fields", async () => {
    const ID = "925b9862-2837-4a1f-bf2d-b80a2304b5b1";
    const mk = (id: string, status: string) => ({
      id, unlocked: false, unlocked_at: null, match_score: 80, created_at: "2026-07-01T00:00:00Z",
      employer_requirements: {
        title: "Intern", location: "Pune", status, skills: [], department: "Design at Acme", duration_weeks: 12, hours_per_week: 20,
        availability: "Immediate", preferred_domain: "Fintech", portfolio_required: true, created_at: "2026-06-01T00:00:00Z",
        employers: { company_name: "Acme" },
      },
    });
    const run = async (qs: string) => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => [{ target_role: null, resume_data: null }] })
        .mockResolvedValueOnce({ ok: true, json: async () => [mk(ID, "closed"), mk("live", "ready")] });
      fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
      global.fetch = fetchMock as unknown as typeof fetch;
      return (await handler(new Request(`https://x.test/api/candidate-hiring-activity?full=1${qs}`))).json();
    };

    const plain = await run("");
    expect(plain.recent.map((r: { id: string }) => r.id)).toEqual(["live"]);

    const asked = await run(`&match=${ID}`);
    expect(asked.shortlistedCount).toBe(1);
    expect(asked.recent.map((r: { id: string }) => r.id)).toEqual(["live", ID]);
    expect(asked.recent[1]).toMatchObject({
      status: "closed", durationWeeks: 12, hoursPerWeek: 20, availability: "Immediate", preferredDomain: "Fintech",
      portfolioPreferred: true, postedAt: "2026-06-01T00:00:00Z",
    });
    expect(asked.recent[1].department).not.toMatch(/Acme/);

    const bogus = await run("&match=not-a-uuid");
    expect(bogus.recent.map((r: { id: string }) => r.id)).toEqual(["live"]);
  });
});
