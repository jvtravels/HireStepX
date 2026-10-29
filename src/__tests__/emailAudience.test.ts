import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getEmployerAccountIds,
  filterEmployerOnlyAccounts,
  type PreferenceDeps,
} from "../../server-handlers/_unsubscribe";

const CAND = "11111111-1111-4111-8111-111111111111";
const EMP = "22222222-2222-4222-8222-222222222222";
const DUAL = "33333333-3333-4333-8333-333333333333";

function json(status: number, body: unknown = []): Response {
  return new Response(JSON.stringify(body), { status });
}
const deps = (fetchImpl: typeof fetch): PreferenceDeps => ({ supabaseUrl: "https://db.test", serviceKey: "svc", fetchImpl });
const practised = (r: { practice_timestamps?: string[] }) => (r.practice_timestamps?.length ?? 0) > 0;

beforeEach(() => { vi.spyOn(console, "warn").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe("getEmployerAccountIds", () => {
  it("returns ids that own an employers row", async () => {
    const f = vi.fn(async () => json(200, [{ id: EMP }])) as unknown as typeof fetch;
    const out = await getEmployerAccountIds(deps(f), [CAND, EMP]);
    expect([...out]).toEqual([EMP]);
    expect(String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain("/rest/v1/employers?id=in.(");
  });

  it("fails closed: a failed lookup marks the whole batch as employer accounts", async () => {
    const f = vi.fn(async () => json(500)) as unknown as typeof fetch;
    const out = await getEmployerAccountIds(deps(f), [CAND, EMP]);
    expect(out.has(CAND)).toBe(true);
    expect(out.has(EMP)).toBe(true);
  });

  it("fails closed when the request throws", async () => {
    const f = vi.fn(async () => { throw new Error("network"); }) as unknown as typeof fetch;
    expect((await getEmployerAccountIds(deps(f), [CAND])).has(CAND)).toBe(true);
  });

  it("ignores non-uuid ids and skips the query for an empty list", async () => {
    const f = vi.fn(async () => json(200, [])) as unknown as typeof fetch;
    expect((await getEmployerAccountIds(deps(f), ["nope"])).size).toBe(0);
    expect(f).not.toHaveBeenCalled();
  });

  it("chunks 100 ids per query", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    const f = vi.fn(async () => json(200, [])) as unknown as typeof fetch;
    await getEmployerAccountIds(deps(f), ids);
    expect(f).toHaveBeenCalledTimes(3);
  });
});

describe("filterEmployerOnlyAccounts", () => {
  const rows = [
    { id: CAND, practice_timestamps: [] as string[] },
    { id: EMP, practice_timestamps: [] as string[] },
    { id: DUAL, practice_timestamps: ["2026-10-01T00:00:00Z"] },
  ];

  it("drops employers who never practised, keeps candidates and dual-role users, preserves order", async () => {
    const f = vi.fn(async () => json(200, [{ id: EMP }, { id: DUAL }])) as unknown as typeof fetch;
    const out = await filterEmployerOnlyAccounts(deps(f), rows, practised);
    expect(out.map((r) => r.id)).toEqual([CAND, DUAL]);
  });

  it("drops dual-role users too when the predicate says never", async () => {
    const f = vi.fn(async () => json(200, [{ id: EMP }, { id: DUAL }])) as unknown as typeof fetch;
    const out = await filterEmployerOnlyAccounts(deps(f), rows, () => false);
    expect(out.map((r) => r.id)).toEqual([CAND]);
  });

  it("sends nothing to anyone if the lookup fails (fail closed)", async () => {
    const f = vi.fn(async () => json(503)) as unknown as typeof fetch;
    const out = await filterEmployerOnlyAccounts(deps(f), rows.slice(0, 2), () => false);
    expect(out).toEqual([]);
  });
});
