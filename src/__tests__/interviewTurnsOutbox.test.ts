import { describe, it, expect, vi, beforeEach } from "vitest";

const apiFetch = vi.fn();
vi.mock("../apiClient", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

const { saveInterviewTurn, flushPendingTurns, createMemoryStore, __setTurnStoreForTests } = await import("../interviewTurns");
const { __resetConnectionMonitorForTests } = await import("../connectionMonitor");

const turn = (n: number) => ({
  id: `id-${n}`, session_id: "s1", user_id: "u1", turn_index: n,
  turn_type: "answer" as const, speaker: "user" as const, content: `a${n}`, metadata: null,
});

let store: ReturnType<typeof createMemoryStore>;
beforeEach(() => {
  apiFetch.mockReset();
  __resetConnectionMonitorForTests();
  store = createMemoryStore();
  __setTurnStoreForTests(store);
  localStorage.clear();
});

describe("turn outbox", () => {
  it("writes ahead locally before any network", async () => {
    apiFetch.mockReturnValue(new Promise(() => {})); // network never answers
    const r = await saveInterviewTurn(turn(1));
    expect(r.ok).toBe(true);
    expect((await store.getAll()).map((x) => x.turn.id)).toEqual(["id-1"]);
  });

  it("removes saved and dropped turns, keeps retry turns with a bumped attempt", async () => {
    for (const n of [1, 2, 3]) await store.put({ turn: turn(n), queuedAt: Date.now() + n, attempts: 0 });
    apiFetch.mockResolvedValue({ ok: true, status: 200, data: { ok: true, saved: ["id-1"], retry: ["id-2"], dropped: ["id-3"] } });
    const res = await flushPendingTurns({ force: true });
    expect(res.flushed).toBe(1);
    const left = await store.getAll();
    expect(left.map((x) => x.turn.id)).toEqual(["id-2"]);
    expect(left[0].attempts).toBe(1);
  });

  it("keeps everything on a network failure and backs off", async () => {
    await store.put({ turn: turn(1), queuedAt: Date.now(), attempts: 0 });
    apiFetch.mockResolvedValue({ ok: false, status: 0, data: null, error: "Network error" });
    vi.useFakeTimers();
    const res = await flushPendingTurns({ force: true });
    expect(res).toEqual({ flushed: 0, failed: 1 });
    expect(await store.getAll()).toHaveLength(1);
    // Non-forced flush during backoff does nothing
    apiFetch.mockClear();
    await flushPendingTurns();
    expect(apiFetch).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("discards turns the server permanently rejects (4xx) instead of looping", async () => {
    await store.put({ turn: turn(1), queuedAt: Date.now(), attempts: 0 });
    apiFetch.mockResolvedValue({ ok: false, status: 400, data: null, error: "bad" });
    await flushPendingTurns({ force: true });
    expect(await store.getAll()).toHaveLength(0);
  });

  it("keeps turns on 401/429 (transient) rather than discarding", async () => {
    await store.put({ turn: turn(1), queuedAt: Date.now(), attempts: 0 });
    apiFetch.mockResolvedValue({ ok: false, status: 401, data: null, error: "x" });
    vi.useFakeTimers();
    await flushPendingTurns({ force: true });
    expect(await store.getAll()).toHaveLength(1);
    vi.useRealTimers();
  });

  it("is single-flight", async () => {
    await store.put({ turn: turn(1), queuedAt: Date.now(), attempts: 0 });
    apiFetch.mockResolvedValue({ ok: true, status: 200, data: { ok: true, saved: ["id-1"], retry: [], dropped: [] } });
    await Promise.all([flushPendingTurns({ force: true }), flushPendingTurns({ force: true })]);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("migrates the legacy localStorage queue", async () => {
    localStorage.setItem("hirestepx_pending_turns", JSON.stringify([turn(9)]));
    apiFetch.mockResolvedValue({ ok: true, status: 200, data: { ok: true, saved: ["id-9"], retry: [], dropped: [] } });
    const res = await flushPendingTurns({ force: true });
    expect(res.flushed).toBe(1);
    expect(localStorage.getItem("hirestepx_pending_turns")).toBeNull();
  });

  it("batches at 100 turns per request", async () => {
    for (let n = 0; n < 250; n++) await store.put({ turn: turn(n), queuedAt: Date.now() + n, attempts: 0 });
    apiFetch.mockImplementation(async (_p: string, body: { turns: Array<{ id: string }> }) => ({
      ok: true, status: 200, data: { ok: true, saved: body.turns.map((x) => x.id), retry: [], dropped: [] },
    }));
    const res = await flushPendingTurns({ force: true });
    expect(res.flushed).toBe(250);
    expect(apiFetch).toHaveBeenCalledTimes(3);
  });
});
