import { describe, it, expect, vi, beforeEach } from "vitest";

/* Reliability of the matching passes in employer-requirements.ts: a scan on
 * stale criteria must not write, a model outage must not swing scores or fire
 * alerts, a missing 0048 migration degrades quietly, a legitimately empty
 * requirement is not "failed", a resume save scores one candidate only, and
 * the create event carries counts and nothing else. */

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: vi.fn(),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  slog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
const llmRerankCandidates = vi.fn(async (..._a: unknown[]) => new Map<string, number>());
vi.mock("../../server-handlers/_requirement-match-llm", async () => {
  const real = await vi.importActual<typeof import("../../server-handlers/_requirement-match-helpers")>("../../server-handlers/_requirement-match-helpers");
  return {
    llmRerankCandidates: (...a: unknown[]) => llmRerankCandidates(...a),
    blendScore: (score: number, llm?: number | null) => real.blendDeterministicWithLlm(score, llm),
  };
});
const notify = vi.fn();
vi.mock("../../server-handlers/_notify", () => ({ notify: (...a: unknown[]) => notify(...a) }));
const captureServerEvent = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock("../../server-handlers/_posthog", () => ({ captureServerEvent: (...a: unknown[]) => captureServerEvent(...a) }));

const { runMatching, rematchOpenRequirementsForNewResume, default: requirementsHandler } = await import("../../server-handlers/employer-requirements");
const { withAuthAndRateLimit } = await import("../../server-handlers/_shared");

const OWNER = "owner-1";
const REQ_ID = "req-1";
const REQ = {
  title: "Frontend Developer",
  location: "Bengaluru",
  description: "Build accessible React user interfaces for our product. You will partner with product and design to ship dependable features.",
  skills: ["React", "TypeScript"],
};
const SKILLED = { skills: ["React", "TypeScript"] };
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

interface SimMatch {
  id: string; candidate_user_id: string; match_score: number; unlocked: boolean;
  candidate_status?: string | null; candidate_response?: string | null;
  llm_score?: number | null; llm_scored_at?: string | null; strong_alerted_at?: string | null;
}
interface Sim {
  profiles?: Array<{ id: string; name: string; target_role: string | null; resume_data?: unknown }>;
  matches?: SimMatch[];
  /** Criteria row the guard re-reads; defaults to the unchanged REQ. */
  stored?: Partial<{ title: string; status: string }>;
  /** Reject a requirement_matches write/read that mentions the 0048 columns. */
  llmColumnsMissing?: boolean;
  poolFails?: boolean;
  /** Row for the status / last_matched_at read a failed pass settles on. */
  settle?: { status: string; last_matched_at: string | null };
  backlog?: unknown[];
}

function makeSim(sim: Sim) {
  const calls = {
    upserts: [] as Array<Array<Record<string, unknown>>>,
    singleUpserts: [] as Array<Record<string, unknown>>,
    patches: [] as Array<{ url: string; body: Record<string, unknown> }>,
    urls: [] as string[],
  };
  const json = (body: unknown, ok = true, status = ok ? 200 : 500) => ({ ok, status, json: async () => body, text: async () => "", headers: { get: () => null } });
  global.fetch = vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || "GET";
    calls.urls.push(`${method} ${url}`);
    if (url.includes("/rest/v1/employers?")) return json([{ id: OWNER, suspended_at: null }]);
    if (url.includes("/rest/v1/employer_blocks?")) return json([]);
    if (url.includes("/rest/v1/requirement_matches?")) {
      if (method === "POST") {
        const body = JSON.parse(String(init?.body));
        if (sim.llmColumnsMissing && JSON.stringify(body).includes("llm_score")) return json({}, false, 400);
        if (Array.isArray(body)) calls.upserts.push(body); else calls.singleUpserts.push(body);
        return json([]);
      }
      if (method === "DELETE") return json([]);
      if (url.includes("candidate_status=eq.hired")) return json([]);
      if (sim.llmColumnsMissing && url.includes("llm_score")) return json({}, false, 400);
      if (url.includes("id=gt.")) return json([]);
      if (url.includes("select=match_score")) return json((sim.matches ?? []).map((m) => ({ match_score: m.match_score, candidate_status: m.candidate_status ?? null, candidate_response: m.candidate_response ?? null })));
      if (url.includes("candidate_user_id=eq.")) {
        const id = decodeURIComponent(url.match(/candidate_user_id=eq\.([^&]*)/)?.[1] || "");
        return json((sim.matches ?? []).filter((m) => m.candidate_user_id === id));
      }
      return json(sim.matches ?? []);
    }
    if (url.includes("/rest/v1/profiles?")) {
      if (url.includes("employer_visibility=neq.off")) {
        if (sim.poolFails) return json([], false);
        return url.includes("id=gt.") ? json([]) : json(sim.profiles ?? []);
      }
      const one = decodeURIComponent(url.match(/profiles\?id=eq\.([^&]*)/)?.[1] || "");
      if (one) return json((sim.profiles ?? []).filter((p) => p.id === one).map((p) => ({ ...p, employer_visibility: "masked" })));
      return json((sim.profiles ?? []).map((p) => ({ id: p.id, employer_visibility: "masked" })));
    }
    if (url.includes("/rest/v1/sessions?")) return json([]);
    if (url.includes("/rest/v1/employer_requirements?")) {
      if (method === "PATCH") {
        calls.patches.push({ url, body: JSON.parse(String(init?.body)) });
        return json(url.includes("stage=eq.ai_matching") ? [{ id: REQ_ID }] : []);
      }
      if (url.includes("select=id,status,title")) {
        return json([{
          id: REQ_ID, status: "generating", title: REQ.title, location: REQ.location, description: REQ.description,
          skills: REQ.skills, custom_skill_sets: [], work_mode: null, experience_min: null, experience_max: null,
          min_readiness_band: null, min_star_completeness: null, employment_type: null, duration_weeks: null, hours_per_week: null,
          ...sim.stored,
        }]);
      }
      if (url.includes("select=status,last_matched_at")) return json(sim.settle ? [sim.settle] : []);
      if (url.includes("select=status")) return json([{ status: "generating" }]);
      if (url.includes("select=matched_pool_size")) return json([{ matched_pool_size: 3 }]);
      if (url.includes("stage=in.(ai_matching")) return json(sim.backlog ?? []);
    }
    return json([]);
  }) as unknown as typeof fetch;
  return calls;
}

const dev = (id: string, resume: unknown = SKILLED) => ({ id, name: `Dev ${id}`, target_role: "Frontend Developer", resume_data: resume });
const rowOf = (calls: ReturnType<typeof makeSim>, id: string) => calls.upserts.flat().find((r) => r.candidate_user_id === id);

beforeEach(() => {
  notify.mockReset();
  notify.mockResolvedValue(undefined);
  captureServerEvent.mockClear();
  llmRerankCandidates.mockReset();
  llmRerankCandidates.mockResolvedValue(new Map());
});

describe("stale criteria guard", () => {
  it("writes the shortlist when the stored criteria still match the scan", async () => {
    const calls = makeSim({ profiles: [dev("a")] });
    await runMatching(REQ_ID, REQ, OWNER);
    expect(rowOf(calls, "a")).toBeTruthy();
  });

  it("aborts without writing when the employer edited the requirement mid-scan, and tells the caller", async () => {
    const calls = makeSim({ profiles: [dev("a")], stored: { title: "Backend Developer" } });
    const onStale = vi.fn();
    const status = await runMatching(REQ_ID, REQ, OWNER, { onStale });
    expect(calls.upserts).toEqual([]);
    expect(onStale).toHaveBeenCalledOnce();
    // Reports what the row holds (the edit's own run settles it), not "failed".
    expect(status).toBe("generating");
    expect(notify).not.toHaveBeenCalled();
  });

  it("aborts when the requirement was archived mid-scan", async () => {
    const calls = makeSim({ profiles: [dev("a")], stored: { status: "closed" } });
    await runMatching(REQ_ID, REQ, OWNER);
    expect(calls.upserts).toEqual([]);
  });
});

describe("model score budget and reuse", () => {
  it("skips the model when too little of the run is left", async () => {
    makeSim({ profiles: [dev("a")] });
    await runMatching(REQ_ID, REQ, OWNER, { timeoutMs: 4_000 });
    expect(llmRerankCandidates).toHaveBeenCalledOnce();
    expect(llmRerankCandidates.mock.calls[0][2]).toMatchObject({ budgetMs: 0 });
  });

  it("gives the model a positive, capped budget on a normal run", async () => {
    makeSim({ profiles: [dev("a")] });
    await runMatching(REQ_ID, REQ, OWNER);
    const budget = (llmRerankCandidates.mock.calls[0][2] as { budgetMs: number }).budgetMs;
    expect(budget).toBeGreaterThan(0);
    expect(budget).toBeLessThanOrEqual(12_000);
  });

  it("carries a recent stored model score forward when the model is unavailable, and persists it", async () => {
    const withoutLlm = makeSim({ profiles: [dev("a")] });
    await runMatching(REQ_ID, REQ, OWNER);
    const det = rowOf(withoutLlm, "a")!.match_score as number;

    const stamp = daysAgo(1);
    const calls = makeSim({
      profiles: [dev("a")],
      matches: [{ id: "m1", candidate_user_id: "a", match_score: det, unlocked: false, llm_score: 100, llm_scored_at: stamp }],
    });
    await runMatching(REQ_ID, REQ, OWNER);
    const row = rowOf(calls, "a")!;
    expect(row.llm_score).toBe(100);
    expect(row.llm_scored_at).toBe(stamp);
    expect(row.match_score).toBe(Math.round(det * 0.65 + 100 * 0.35));
  });

  it("drops a stored model score older than the max age", async () => {
    const calls = makeSim({
      profiles: [dev("a")],
      matches: [{ id: "m1", candidate_user_id: "a", match_score: 50, unlocked: false, llm_score: 100, llm_scored_at: daysAgo(40) }],
    });
    await runMatching(REQ_ID, REQ, OWNER);
    expect(rowOf(calls, "a")!.llm_score).toBeNull();
  });

  describe("strong alert on a model-score flip", () => {
    // Covers the listed skills (so the strong cap does not hide the
    // effect) with a loosely matching role: deterministic score under the strong bar.
    const partial = { ...dev("a", SKILLED), target_role: "Developer" };
    const strongAlerts = () => notify.mock.calls.filter(([n]) => (n as { type: string }).type === "strong_match_found");

    async function detScore() {
      const base = makeSim({ profiles: [partial] });
      await runMatching(REQ_ID, REQ, OWNER);
      const det = rowOf(base, "a")?.match_score as number | undefined;
      expect(det, "fixture must clear the floor and sit under the strong bar").toBeGreaterThanOrEqual(25);
      expect(det).toBeLessThan(40);
      notify.mockClear();
      llmRerankCandidates.mockResolvedValue(new Map([["a", 100]]));
      return det!;
    }

    it("does not announce a candidate who crossed the bar only because the model score appeared", async () => {
      const det = await detScore();
      makeSim({ profiles: [partial], matches: [{ id: "m1", candidate_user_id: "a", match_score: det, unlocked: false, llm_score: null, llm_scored_at: null }] });
      await runMatching(REQ_ID, REQ, OWNER);
      expect(strongAlerts()).toEqual([]);
    });

    it("control: the same crossing is announced when the model had already scored them", async () => {
      const det = await detScore();
      makeSim({ profiles: [partial], matches: [{ id: "m1", candidate_user_id: "a", match_score: det, unlocked: false, llm_score: 30, llm_scored_at: daysAgo(1) }] });
      await runMatching(REQ_ID, REQ, OWNER);
      expect(strongAlerts()).toHaveLength(1);
    });
  });
});

describe("0048 not applied", () => {
  it("retries the read and the upsert without the model columns and still writes the shortlist", async () => {
    vi.resetModules();
    const fresh = await import("../../server-handlers/employer-requirements");
    const calls = makeSim({ profiles: [dev("a")], llmColumnsMissing: true, matches: [] });
    const status = await fresh.runMatching(REQ_ID, REQ, OWNER);
    expect(status).not.toBe("failed");
    const row = calls.upserts.flat().find((r) => r.candidate_user_id === "a")!;
    expect(row).toBeTruthy();
    expect(row).not.toHaveProperty("llm_score");
  });
});

describe("failed passes and live-only counts", () => {
  it("keeps a legitimate zero as zero when a transient error hits the pass", async () => {
    const calls = makeSim({ poolFails: true, matches: [], settle: { status: "zero", last_matched_at: daysAgo(1) } });
    const status = await runMatching(REQ_ID, REQ, OWNER);
    expect(status).toBe("zero");
    expect(calls.patches.find((p) => p.body.status === "failed")).toBeUndefined();
  });

  it("settles a requirement stuck generating after a completed run as zero, not failed", async () => {
    const calls = makeSim({ poolFails: true, matches: [], settle: { status: "generating", last_matched_at: daysAgo(1) } });
    expect(await runMatching(REQ_ID, REQ, OWNER)).toBe("zero");
    expect(calls.patches.find((p) => p.body.status === "failed")).toBeUndefined();
  });

  it("still fails a requirement whose first pass never finished", async () => {
    makeSim({ poolFails: true, matches: [], settle: { status: "generating", last_matched_at: null } });
    expect(await runMatching(REQ_ID, REQ, OWNER)).toBe("failed");
  });

  it("does not count rejected or declined rows toward status or matched pool size", async () => {
    const calls = makeSim({
      profiles: [],
      matches: [
        { id: "m1", candidate_user_id: "x", match_score: 90, unlocked: true, candidate_status: "rejected" },
        { id: "m2", candidate_user_id: "y", match_score: 80, unlocked: true, candidate_response: "declined" },
        { id: "m3", candidate_user_id: "z", match_score: 70, unlocked: true, candidate_status: "not_a_fit" },
      ],
    });
    const status = await runMatching(REQ_ID, REQ, OWNER);
    expect(status).toBe("zero");
    const final = calls.patches.find((p) => "matched_pool_size" in p.body)!;
    expect(final.body).toMatchObject({ status: "zero", matched_pool_size: 0 });
  });

  it("counts a live preserved row", async () => {
    const calls = makeSim({
      profiles: [],
      matches: [{ id: "m1", candidate_user_id: "x", match_score: 60, unlocked: true, candidate_status: "interviewing" }],
    });
    expect(await runMatching(REQ_ID, REQ, OWNER)).toBe("partial");
    expect(calls.patches.find((p) => "matched_pool_size" in p.body)!.body).toMatchObject({ matched_pool_size: 1 });
  });
});

describe("single-candidate resume rematch", () => {
  const backlogRow = {
    id: REQ_ID, employer_id: "emp-9", title: REQ.title, location: REQ.location, description: REQ.description,
    skills: REQ.skills, stage: "ai_matching", status: "generating", last_matched_at: null, due_date: null,
    experience_min: null, experience_max: null, min_readiness_band: null, min_star_completeness: null,
    employment_type: null, duration_weeks: null, hours_per_week: null, custom_skill_sets: [], work_mode: null,
    employers: { suspended_at: null },
  };

  it("scores only that candidate and never scans the pool", async () => {
    const calls = makeSim({ profiles: [dev("a"), dev("b")], backlog: [backlogRow] });
    await rematchOpenRequirementsForNewResume("a");
    expect(calls.singleUpserts).toHaveLength(1);
    expect(calls.singleUpserts[0]).toMatchObject({ requirement_id: REQ_ID, candidate_user_id: "a" });
    expect(calls.urls.some((u) => u.includes("employer_visibility=neq.off"))).toBe(false);
    expect(calls.upserts).toEqual([]);
  });

  it("leaves a row the employer already acted on alone", async () => {
    const calls = makeSim({
      profiles: [dev("a")], backlog: [backlogRow],
      matches: [{ id: "m1", candidate_user_id: "a", match_score: 55, unlocked: false, candidate_status: "interviewing" }],
    });
    await rematchOpenRequirementsForNewResume("a");
    expect(calls.singleUpserts).toEqual([]);
  });

  it("skips a candidate the employer blocked", async () => {
    const calls = makeSim({ profiles: [dev("a")], backlog: [backlogRow] });
    const base = global.fetch as unknown as (u: string, i?: RequestInit) => Promise<unknown>;
    global.fetch = vi.fn(async (u: string, i?: RequestInit) => (String(u).includes("employer_blocks")
      ? { ok: true, status: 200, json: async () => [{ candidate_user_id: "a" }], text: async () => "", headers: { get: () => null } }
      : base(u, i))) as unknown as typeof fetch;
    await rematchOpenRequirementsForNewResume("a");
    expect(calls.singleUpserts).toEqual([]);
  });

  it("does not run for an opted-out candidate", async () => {
    const calls = makeSim({ profiles: [], backlog: [backlogRow] });
    await rematchOpenRequirementsForNewResume("a");
    expect(calls.singleUpserts).toEqual([]);
  });
});

describe("employer_requirement_created event", () => {
  const res = (body: unknown, contentRange: string | null = null) => ({
    ok: true, status: 200, json: async () => body, text: async () => "",
    headers: { get: (n: string) => (n.toLowerCase() === "content-range" ? contentRange : null) },
  });

  it("sends counts and enums only, never the text the employer typed", async () => {
    vi.mocked(withAuthAndRateLimit).mockResolvedValue({ auth: { userId: OWNER }, headers: {} } as never);
    global.fetch = vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";
      if (url.includes("/rest/v1/employers?")) return res([{ id: OWNER, website: null, suspended_at: null, verification_tier: "basic" }]);
      if (url.includes("/auth/v1/admin/users/")) return res({ email: "x@gmail.com", email_confirmed_at: "2026-01-01" });
      if (url.includes("employer_requirement_activity")) return res([], "0-0/0");
      if (url.includes("/rest/v1/employer_requirements") && method === "POST") return res([{ id: "new-1", title: REQ.title, location: REQ.location, created_at: "2026-10-01T00:00:00Z" }]);
      if (url.includes("/rest/v1/employer_requirements?") && method === "GET") {
        return url.includes("select=matched_pool_size") ? res([{ matched_pool_size: 3 }]) : res([], "0-0/0");
      }
      return res([]);
    }) as unknown as typeof fetch;

    const out = await requirementsHandler(new Request("https://x.test/api/employer-requirements", {
      method: "POST",
      body: JSON.stringify({ title: REQ.title, locations: ["Pune"], description: REQ.description, skills: REQ.skills, workMode: "hybrid" }),
    }));
    expect(out.status).toBe(200);
    expect(captureServerEvent).toHaveBeenCalledOnce();
    expect(captureServerEvent).toHaveBeenCalledWith("employer_requirement_created", OWNER, {
      skillsCount: 2, hasDescription: true, workMode: "hybrid", matchedCount: 3,
    });
    const payload = JSON.stringify(captureServerEvent.mock.calls[0]);
    expect(payload).not.toContain(REQ.title);
    expect(payload).not.toContain("Pune");
  });
});
