import { describe, it, expect, vi, afterEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const { getUsers, getOverview } = await import("../../server-handlers/_admin-activity");
const { fetchEmployerIds, fetchCandidateCount } = await import("../../server-handlers/_admin-shared");

interface Profile { id: string; name: string; email: string; created_at: string }

const uid = (kind: string, i: number) => `${kind}-${String(i).padStart(5, "0")}`;

/** In-memory Supabase: profiles ordered newest-first, employers a subset of them. */
function fakeSupabase(opts: { candidates: number; employers: number; employerEvery?: number }) {
  const profiles: Profile[] = [];
  const employers = new Set<string>();
  const total = opts.candidates + opts.employers;
  const every = opts.employerEvery ?? Math.max(1, Math.floor(total / Math.max(1, opts.employers)));
  let employersLeft = opts.employers;
  let c = 0;
  let e = 0;
  for (let i = 0; i < total; i++) {
    const makeEmployer = employersLeft > 0 && (i % every === 0 || total - i <= employersLeft);
    const id = makeEmployer ? uid("emp", e++) : uid("cand", c++);
    if (makeEmployer) { employers.add(id); employersLeft--; }
    profiles.push({ id, name: `N ${id}`, email: `${id}@x.in`, created_at: new Date(2026, 0, 1, 0, 0, total - i).toISOString() });
  }
  const urls: string[] = [];

  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const raw = String(input);
    urls.push(raw);
    const u = new URL(raw);
    const table = u.pathname.split("/").pop()!;
    const q = u.searchParams;
    const offset = Number(q.get("offset") ?? 0);
    const limit = q.get("limit") === null ? Infinity : Number(q.get("limit"));

    if (table === "employers") {
      const ids = [...employers].sort().slice(offset, offset + limit).map((id) => ({ id }));
      return new Response(JSON.stringify(ids), { status: 200 });
    }
    if (table === "profiles") {
      let rows = profiles;
      const idIn = q.get("id");
      if (idIn?.startsWith("in.(")) {
        const set = new Set(idIn.slice(4, -1).split(","));
        rows = rows.filter((p) => set.has(p.id));
      }
      const or = q.get("or");
      if (or) {
        const term = /ilike\.\*(.+?)\*/.exec(or)![1].toLowerCase();
        rows = rows.filter((p) => p.name.toLowerCase().includes(term) || p.email.toLowerCase().includes(term));
      }
      if (q.get("order")?.startsWith("created_at.desc")) rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
      const count = rows.length;
      const page = rows.slice(offset, offset + (limit === Infinity ? rows.length : limit));
      const select = (q.get("select") ?? "id").split(",");
      const body = limit === 0 ? [] : page.map((p) => Object.fromEntries(select.map((k) => [k, (p as unknown as Record<string, unknown>)[k] ?? null])));
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-range": `0-0/${count}` } });
    }
    return new Response("[]", { status: 200 });
  }));
  return { profiles, employers, urls };
}

afterEach(() => vi.unstubAllGlobals());

describe("getUsers returns candidates only", () => {
  it("never includes employers and reports a candidate-only total", async () => {
    const { employers } = fakeSupabase({ candidates: 20, employers: 5 });
    const out = await getUsers(undefined, 0, 50);
    expect(out.users).toHaveLength(20);
    expect(out.users.every((u) => !employers.has(u.id))).toBe(true);
    expect(out.total).toBe(20);
  });

  it("paginates exactly over candidates (no short or duplicated pages)", async () => {
    const { employers } = fakeSupabase({ candidates: 30, employers: 10 });
    const p1 = await getUsers(undefined, 0, 12);
    const p2 = await getUsers(undefined, 12, 12);
    const p3 = await getUsers(undefined, 24, 12);
    expect([p1.users.length, p2.users.length, p3.users.length]).toEqual([12, 12, 6]);
    const ids = [...p1.users, ...p2.users, ...p3.users].map((u) => u.id);
    expect(new Set(ids).size).toBe(30);
    expect(ids.every((id) => !employers.has(id))).toBe(true);
    expect(p1.total).toBe(30);
  });

  it("keeps signup order newest first", async () => {
    fakeSupabase({ candidates: 10, employers: 3 });
    const out = await getUsers(undefined, 0, 50);
    const joined = out.users.map((u) => u.joined);
    expect([...joined].sort().reverse()).toEqual(joined);
  });

  it("applies search to candidates only", async () => {
    const { employers } = fakeSupabase({ candidates: 10, employers: 10 });
    const out = await getUsers("00003", 0, 50);
    expect(out.users.length).toBeGreaterThan(0);
    expect(out.users.every((u) => !employers.has(u.id) && u.name.includes("00003"))).toBe(true);
    expect(out.total).toBe(out.users.length);
  });

  it("is exact with many more employers than a URL could hold", async () => {
    const { employers, urls } = fakeSupabase({ candidates: 40, employers: 600 });
    const out = await getUsers(undefined, 0, 50);
    expect(out.users).toHaveLength(40);
    expect(out.users.every((u) => !employers.has(u.id))).toBe(true);
    expect(out.total).toBe(40);
    expect(Math.max(...urls.map((u) => u.length))).toBeLessThan(8000);
  });

  it("scans past the first id page when employers crowd the head of the list", async () => {
    const { employers } = fakeSupabase({ candidates: 30, employers: 1100, employerEvery: 1 });
    const out = await getUsers(undefined, 0, 25);
    expect(out.users).toHaveLength(25);
    expect(out.users.every((u) => !employers.has(u.id))).toBe(true);
    expect(out.total).toBe(30);
  });

  it("returns an empty page past the end", async () => {
    fakeSupabase({ candidates: 5, employers: 2 });
    const out = await getUsers(undefined, 50, 50);
    expect(out.users).toEqual([]);
    expect(out.total).toBe(5);
  });
});

describe("shared employer helpers", () => {
  it("fetchEmployerIds pages through every employer", async () => {
    fakeSupabase({ candidates: 3, employers: 2300 });
    const ids = await fetchEmployerIds();
    expect(ids.size).toBe(2300);
  });

  it("fetchCandidateCount subtracts employer profiles, honouring the filter", async () => {
    const { employers } = fakeSupabase({ candidates: 12, employers: 7 });
    expect(await fetchCandidateCount(employers)).toBe(12);
    expect(await fetchCandidateCount(new Set())).toBe(19);
  });
});

describe("getOverview counts candidates only", () => {
  it("excludes employers from totals, tier breakdown, signups and conversion", async () => {
    const { employers, profiles } = fakeSupabase({ candidates: 8, employers: 4 });
    const out = await getOverview();
    expect(out.users.total).toBe(8);
    expect(out.users.tierBreakdown.free).toBe(8);
    expect(profiles.length).toBe(12);
    expect(employers.size).toBe(4);
  });
});
