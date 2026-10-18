import { describe, it, expect } from "vitest";
import { casAppendStart, casFilterFor, buildNextStartState } from "../../server-handlers/_record-session-start-helpers";

/* Minimal in-memory PostgREST stand-in: GET returns the row, PATCH applies
   only when the practice_timestamps filter matches the current value. */
function fakeDb(initial: Record<string, unknown>, opts: { beforePatch?: (db: Record<string, unknown>, n: number) => void; missingCols?: boolean } = {}) {
  const db = { ...initial };
  let patches = 0;
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!init?.method || init.method === "GET") {
      return new Response(JSON.stringify([db]), { status: 200 });
    }
    patches++;
    opts.beforePatch?.(db, patches);
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    if (opts.missingCols && "started_session_ids" in body) {
      return new Response('{"message":"column started_session_ids does not exist"}', { status: 400 });
    }
    const filter = url.split("&").find(p => p.startsWith("practice_timestamps="))!;
    const matches = filter === casFilterFor(db.practice_timestamps);
    if (!matches) return new Response("[]", { status: 200 });
    Object.assign(db, body);
    return new Response(JSON.stringify([db]), { status: 200 });
  }) as typeof fetch;
  return { db, impl, patchCount: () => patches };
}

const base = { baseUrl: "https://x.supabase.co", serviceKey: "k", userId: "u1", nowIso: "2026-10-18T10:00:00.000Z" };

describe("casFilterFor", () => {
  it("pins to the JSON value that was read", () => {
    expect(casFilterFor(["a"])).toBe(`practice_timestamps=eq.${encodeURIComponent('["a"]')}`);
  });
  it("uses is.null when the column is NULL", () => {
    expect(casFilterFor(null)).toBe("practice_timestamps=is.null");
  });
});

describe("buildNextStartState", () => {
  it("appends and keeps the id/ts arrays index-aligned at the 50 cap", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `s${i}`);
    const ts = ids.map((_, i) => `t${i}`);
    const next = buildNextStartState({ practice_timestamps: [], started_session_ids: ids, started_session_ts: ts }, "new", "now");
    expect(next.started_session_ids).toHaveLength(50);
    expect(next.started_session_ids.at(-1)).toBe("new");
    expect(next.started_session_ts.at(-1)).toBe("now");
    expect(next.started_session_ids[0]).toBe("s1");
    expect(next.started_session_ts[0]).toBe("t1");
  });
  it("tolerates null columns", () => {
    const next = buildNextStartState({}, "a", "n");
    expect(next).toEqual({ practice_timestamps: ["n"], started_session_ids: ["a"], started_session_ts: ["n"] });
  });
});

describe("casAppendStart", () => {
  it("records on an uncontended first attempt", async () => {
    const row = { practice_timestamps: ["t0"], started_session_ids: ["s0"], started_session_ts: ["t0"] };
    const { db, impl } = fakeDb(row);
    const r = await casAppendStart({ ...base, sessionId: "s1", initialRow: row, fetchImpl: impl });
    expect(r).toEqual({ outcome: "recorded", attempts: 1 });
    expect(db.started_session_ids).toEqual(["s0", "s1"]);
  });

  it("two tabs racing: the loser re-reads and keeps both starts", async () => {
    const row = { practice_timestamps: ["t0"], started_session_ids: ["s0"], started_session_ts: ["t0"] };
    // Tab B's write lands between tab A's read and PATCH.
    const { db, impl } = fakeDb(row, {
      beforePatch: (d, n) => {
        if (n === 1) Object.assign(d, { practice_timestamps: ["t0", "tB"], started_session_ids: ["s0", "sB"], started_session_ts: ["t0", "tB"] });
      },
    });
    const r = await casAppendStart({ ...base, sessionId: "sA", initialRow: row, fetchImpl: impl });
    expect(r).toEqual({ outcome: "recorded", attempts: 2 });
    expect(db.started_session_ids).toEqual(["s0", "sB", "sA"]);
    expect(db.practice_timestamps).toEqual(["t0", "tB", base.nowIso]);
  });

  it("same-id sibling winning the race is reported as already counted", async () => {
    const row = { practice_timestamps: [], started_session_ids: [], started_session_ts: [] };
    const { db, impl } = fakeDb(row, {
      beforePatch: (d, n) => {
        if (n === 1) Object.assign(d, { practice_timestamps: ["tX"], started_session_ids: ["sA"], started_session_ts: ["tX"] });
      },
    });
    const r = await casAppendStart({ ...base, sessionId: "sA", initialRow: row, fetchImpl: impl });
    expect(r).toEqual({ outcome: "already_counted" });
    expect(db.practice_timestamps).toEqual(["tX"]);
  });

  it("gives up as contended after maxAttempts of constant interference", async () => {
    const row = { practice_timestamps: [], started_session_ids: [], started_session_ts: [] };
    const { impl, patchCount } = fakeDb(row, {
      beforePatch: (d, n) => { d.practice_timestamps = Array.from({ length: n }, (_, i) => `x${i}`); },
    });
    const r = await casAppendStart({ ...base, sessionId: "sA", initialRow: row, fetchImpl: impl, maxAttempts: 3 });
    expect(r).toEqual({ outcome: "contended" });
    expect(patchCount()).toBe(3);
  });

  it("falls back to practice_timestamps only when started_session_* columns are missing", async () => {
    const row = { practice_timestamps: ["t0"] };
    const { db, impl } = fakeDb(row, { missingCols: true });
    const r = await casAppendStart({ ...base, sessionId: "s1", initialRow: row, fetchImpl: impl });
    expect(r).toEqual({ outcome: "schema_pending", ok: true });
    expect(db.practice_timestamps).toEqual(["t0", base.nowIso]);
  });

  it("surfaces non-schema PATCH failures", async () => {
    const impl = (async () => new Response("boom", { status: 500 })) as typeof fetch;
    const r = await casAppendStart({ ...base, sessionId: "s1", initialRow: {}, fetchImpl: impl });
    expect(r).toEqual({ outcome: "error", status: 500, body: "boom" });
  });
});
