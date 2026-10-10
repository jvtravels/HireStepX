import { describe, it, expect, vi, beforeEach } from "vitest";

/* runMatching (employer-requirements.ts) against a small in-memory Supabase
 * simulator. The simulator deliberately IGNORES the server-side filters the
 * code also applies client-side (employer_visibility=neq.off on the pool,
 * report_generated_at=not.is.null on sessions) so these tests prove the code
 * defends itself rather than trusting PostgREST to have filtered. */

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const slogError = vi.fn();
vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: vi.fn(),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  slog: { error: (...a: unknown[]) => slogError(...a), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("../../server-handlers/_requirement-match-llm", () => ({
  llmRerankCandidates: vi.fn(async () => new Map()),
  blendScore: (score: number) => score,
}));
const notify = vi.fn();
vi.mock("../../server-handlers/_notify", () => ({ notify: (...a: unknown[]) => notify(...a) }));

const { runMatching } = await import("../../server-handlers/employer-requirements");

const OWNER = "owner-1";
const REQ_ID = "req-1";
const REQ = {
  title: "Frontend Developer",
  location: "Bengaluru",
  description: "Build accessible React user interfaces for our product.",
  skills: ["React", "TypeScript"],
};

interface SimProfile { id: string; name: string; target_role: string | null; employer_visibility?: string; resume_data?: unknown }
interface SimMatch {
  id: string; candidate_user_id: string; match_score: number; unlocked: boolean;
  candidate_status?: string; candidate_status_note?: string | null; interview_scheduled_at?: string | null;
}
interface Sim {
  suspended?: boolean;
  profiles: SimProfile[];
  blocks?: string[];
  blocksFail?: boolean;
  matches?: SimMatch[];
  sessions?: Array<{ user_id: string; score: number; graded: boolean }>;
  poolFailAfterFirstPage?: boolean;
  poolFailImmediately?: boolean;
}

const chef = (id: string): SimProfile => ({ id, name: "Chef", target_role: "Chef", employer_visibility: "masked" });

function dev(id: string, name = `Dev ${id}`, extra: Partial<SimProfile> = {}): SimProfile {
  return { id, name, target_role: "Frontend Developer", employer_visibility: "masked", ...extra };
}

function makeSim(sim: Sim) {
  const calls = { upserts: [] as Array<Array<{ candidate_user_id: string }>>, deletes: [] as string[], patches: [] as Array<{ url: string; body: Record<string, unknown> }> };
  const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body, text: async () => "" });
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || "GET";
    if (url.includes("/rest/v1/employers?")) return json([{ id: OWNER, suspended_at: sim.suspended ? "2026-01-01T00:00:00Z" : null }]);
    if (url.includes("/rest/v1/employer_blocks?")) return sim.blocksFail ? json([], false) : json((sim.blocks ?? []).map((c) => ({ candidate_user_id: c })));
    if (url.includes("/rest/v1/requirement_matches?")) {
      if (method === "POST") { calls.upserts.push(JSON.parse(String(init?.body))); return json([]); }
      if (method === "DELETE") { calls.deletes.push(url); return json([]); }
      if (url.includes("candidate_status=eq.hired")) return json([]);
      return url.includes("id=gt.") ? json([]) : json(sim.matches ?? []);
    }
    if (url.includes("/rest/v1/profiles?")) {
      if (url.includes("employer_visibility=neq.off")) {
        if (sim.poolFailImmediately) return json([], false);
        if (url.includes("id=gt.")) return sim.poolFailAfterFirstPage ? json([], false) : json([]);
        const lim = Number(url.match(/limit=(\d+)/)?.[1] || 1000);
        return json(sim.profiles.slice(0, lim));
      }
      const ids = decodeURIComponent(url.match(/id=in\.\(([^)]*)\)/)?.[1] || "").split(",");
      return json(sim.profiles.filter((p) => ids.includes(p.id)).map((p) => ({ id: p.id, employer_visibility: p.employer_visibility })));
    }
    if (url.includes("/rest/v1/sessions?")) {
      const ids = decodeURIComponent(url.match(/user_id=in\.\(([^)]*)\)/)?.[1] || "").split(",");
      return json((sim.sessions ?? []).filter((s) => ids.includes(s.user_id)).map((s) => ({
        user_id: s.user_id, score: s.score, created_at: "2026-09-01T00:00:00Z", type: "behavioral", report_generated_at: s.graded ? "2026-09-01T00:05:00Z" : null,
      })));
    }
    if (url.includes("/rest/v1/employer_requirements?")) {
      if (method === "PATCH") { calls.patches.push({ url, body: JSON.parse(String(init?.body)) }); return json(url.includes("stage=eq.ai_matching") ? [{ id: REQ_ID }] : []); }
    }
    return json([]);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return { calls, fetchMock };
}

const graded = (id: string, score = 80) => ({ user_id: id, score, graded: true });
const upsertedIds = (calls: ReturnType<typeof makeSim>["calls"]) => calls.upserts.flat().map((r) => r.candidate_user_id).sort();
const deletedIds = (calls: ReturnType<typeof makeSim>["calls"]) =>
  calls.deletes.flatMap((u) => decodeURIComponent(u.match(/[?&]id=in\.\(([^)]*)\)/)?.[1] || "").split(",").filter(Boolean)).sort();

beforeEach(() => {
  notify.mockReset();
  notify.mockResolvedValue(undefined);
  slogError.mockReset();
});

describe("runMatching — pool selection", () => {
  it("matches only opted-in, unblocked, non-owner candidates with server-graded sessions", async () => {
    const { calls } = makeSim({
      profiles: [
        dev("good"),
        dev("optout", "Opt Out", { employer_visibility: "off" }),
        dev("blocked"),
        dev("ungraded-only"),
        dev(OWNER, "The Employer"),
      ],
      blocks: ["blocked"],
      sessions: [graded("good"), graded("optout"), graded("blocked"), graded(OWNER), { user_id: "ungraded-only", score: 100, graded: false }],
    });

    const status = await runMatching(REQ_ID, REQ, OWNER);

    expect(status).not.toBe("failed");
    expect(upsertedIds(calls)).toEqual(["good"]);
  });

  it("an ungraded (client-relayed) session is not evidence, even with a perfect score", async () => {
    const { calls } = makeSim({
      profiles: [dev("ungraded-only")],
      sessions: [{ user_id: "ungraded-only", score: 100, graded: false }],
    });
    await runMatching(REQ_ID, REQ, OWNER);
    expect(calls.upserts).toHaveLength(0);
  });

  it("a suspended employer is not matched: no reads of the pool, no writes, no alerts", async () => {
    const { calls, fetchMock } = makeSim({ suspended: true, profiles: [dev("good")], sessions: [graded("good")] });

    const status = await runMatching(REQ_ID, REQ, OWNER);

    expect(status).toBe("suspended");
    expect(calls.upserts).toHaveLength(0);
    expect(calls.deletes).toHaveLength(0);
    expect(calls.patches).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/rest/v1/profiles?"))).toBe(false);
  });

  it("fails closed (status failed, nothing written) when the block list can't be read", async () => {
    const { calls } = makeSim({ blocksFail: true, profiles: [dev("good")], sessions: [graded("good")] });
    const status = await runMatching(REQ_ID, REQ, OWNER);
    expect(status).toBe("failed");
    expect(calls.upserts).toHaveLength(0);
    expect(calls.deletes).toHaveLength(0);
  });

  it("fails (rather than reporting an empty pool) when the pool can't be read at all", async () => {
    const { calls } = makeSim({ poolFailImmediately: true, profiles: [chef("old")], matches: [{ id: "m-old", candidate_user_id: "old", match_score: 60, unlocked: false }] });
    const status = await runMatching(REQ_ID, REQ, OWNER);
    expect(status).toBe("failed");
    expect(calls.deletes).toHaveLength(0);
  });
});

describe("runMatching — re-match cleanup", () => {
  it("deletes stale locked rows for opted-out / blocked candidates but never an unlocked row", async () => {
    const { calls } = makeSim({
      profiles: [dev("good"), dev("optout", "Opt Out", { employer_visibility: "off" }), dev("paid-optout", "Paid", { employer_visibility: "off" })],
      blocks: ["blocked"],
      sessions: [graded("good"), graded("optout"), graded("paid-optout"), graded("blocked")],
      matches: [
        { id: "m-optout", candidate_user_id: "optout", match_score: 60, unlocked: false },
        { id: "m-blocked", candidate_user_id: "blocked", match_score: 60, unlocked: false },
        { id: "m-paid-optout", candidate_user_id: "paid-optout", match_score: 60, unlocked: true },
        { id: "m-paid-blocked", candidate_user_id: "blocked", match_score: 60, unlocked: true },
      ],
    });
    // blocked has two rows in this contrived fixture; give them distinct candidates for the unique constraint
    await runMatching(REQ_ID, REQ, OWNER);

    const ids = deletedIds(calls);
    expect(ids).toContain("m-optout");
    expect(ids).toContain("m-blocked");
    expect(ids).not.toContain("m-paid-optout");
    expect(ids).not.toContain("m-paid-blocked");
    // belt and braces: every DELETE is scoped to locked rows
    expect(calls.deletes.every((u) => u.includes("unlocked=eq.false"))).toBe(true);
  });

  it("removes a stale locked row whose candidate fell out of the pool, sparing unlocked and pipeline-touched rows", async () => {
    const { calls } = makeSim({
      profiles: [dev("good"), chef("gone-1"), chef("gone-2"), chef("gone-3"), chef("gone-4")],
      sessions: [graded("good")],
      matches: [
        { id: "m-stale", candidate_user_id: "gone-1", match_score: 50, unlocked: false },
        { id: "m-paid", candidate_user_id: "gone-2", match_score: 50, unlocked: true },
        { id: "m-interviewing", candidate_user_id: "gone-3", match_score: 50, unlocked: false, candidate_status: "interviewing" },
        { id: "m-noted", candidate_user_id: "gone-4", match_score: 50, unlocked: false, candidate_status_note: "great call" },
      ],
    });
    // the gone-* candidates exist as visible profiles so only the stale rule (not consent) applies
    await runMatching(REQ_ID, REQ, OWNER);

    expect(deletedIds(calls)).toContain("m-stale");
    expect(deletedIds(calls)).not.toContain("m-paid");
    expect(deletedIds(calls)).not.toContain("m-interviewing");
    expect(deletedIds(calls)).not.toContain("m-noted");
  });

  it("upserts new rows BEFORE removing stale ones, so a mid-pass failure never empties the shortlist", async () => {
    const order: string[] = [];
    const { fetchMock } = makeSim({
      profiles: [dev("good"), chef("gone-1")],
      sessions: [graded("good")],
      matches: [{ id: "m-stale", candidate_user_id: "gone-1", match_score: 50, unlocked: false }],
    });
    const inner = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (u: string, i?: RequestInit) => {
      if (i?.method === "POST" && String(u).includes("requirement_matches")) order.push("upsert");
      if (i?.method === "DELETE") order.push("delete");
      return inner(u, i);
    });

    await runMatching(REQ_ID, REQ, OWNER);

    expect(order.indexOf("upsert")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("delete")).toBeGreaterThan(order.indexOf("upsert"));
  });

  it("does not remove stale rows when the pool scan was cut short (can't prove they fell out)", async () => {
    const filler = Array.from({ length: 500 }, (_, i) => ({ id: `chef-${i}`, name: "Chef", target_role: "Chef", employer_visibility: "masked" }));
    const { calls } = makeSim({
      profiles: [...filler, chef("gone-1")],
      poolFailAfterFirstPage: true,
      matches: [{ id: "m-stale", candidate_user_id: "gone-1", match_score: 50, unlocked: false }],
    });

    await runMatching(REQ_ID, REQ, OWNER);

    expect(deletedIds(calls)).not.toContain("m-stale");
  });
});

describe("runMatching — notifications", () => {
  it("sends ONE awaited, count-only strong-match alert to the employer and never notifies candidates", async () => {
    const ids = ["a", "b", "c"];
    const { calls } = makeSim({ profiles: ids.map((i) => dev(i, `Secret Name ${i}`)), sessions: ids.map((i) => graded(i, 90)) });

    await runMatching(REQ_ID, REQ, OWNER);

    expect(upsertedIds(calls)).toEqual(ids);
    const strong = notify.mock.calls.map((c) => c[0] as { userId: string; type: string; body?: string }).filter((n) => n.type === "strong_match_found");
    expect(strong).toHaveLength(1);
    expect(strong[0].userId).toBe(OWNER);
    expect(strong[0].body).not.toMatch(/Secret Name|Candidate #/);
    for (const [n] of notify.mock.calls) expect((n as { userId: string }).userId).toBe(OWNER);
  });

  it("does not re-alert for a candidate who was already a strong match", async () => {
    makeSim({
      profiles: [dev("a")],
      sessions: [graded("a", 90)],
      matches: [{ id: "m-a", candidate_user_id: "a", match_score: 70, unlocked: false }],
    });
    await runMatching(REQ_ID, REQ, OWNER);
    expect(notify.mock.calls.some((c) => (c[0] as { type: string }).type === "strong_match_found")).toBe(false);
  });

  it("caps new-strong-match alerting to a single notification however many candidates arrive", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `c${i}`);
    makeSim({ profiles: ids.map((i) => dev(i)), sessions: ids.map((i) => graded(i, 90)) });
    await runMatching(REQ_ID, REQ, OWNER);
    expect(notify.mock.calls.filter((c) => (c[0] as { type: string }).type === "strong_match_found")).toHaveLength(1);
  });

  it("a rejecting notify never fails the pass", async () => {
    notify.mockRejectedValue(new Error("db down"));
    makeSim({ profiles: [dev("a")], sessions: [graded("a", 90)] });
    await expect(runMatching(REQ_ID, REQ, OWNER)).resolves.not.toBe("failed");
  });
});
