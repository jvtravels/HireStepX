import { describe, it, expect, vi, afterEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const { getUsers } = await import("../../server-handlers/_admin-activity");

const EMP_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const EMP_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2";
const USER = "uuuuuuuu-uuuu-4uuu-8uuu-uuuuuuuuuuu1";

function stub(employerIds: string[], profileRows: Array<{ id: string }>) {
  const urls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = decodeURIComponent(String(input));
    urls.push(url);
    if (url.includes("/employers?")) return new Response(JSON.stringify(employerIds.map((id) => ({ id }))), { status: 200 });
    if (url.includes("/profiles?") && url.includes("limit=0")) {
      return new Response("[]", { status: 200, headers: { "content-range": "*/1" } });
    }
    if (url.includes("/profiles?")) {
      return new Response(JSON.stringify(profileRows.map((p) => ({
        ...p, name: "n", email: "e@x.in", subscription_tier: "free", created_at: "2026-01-01",
        practice_timestamps: null, has_completed_onboarding: true, subscription_end: null,
      }))), { status: 200 });
    }
    return new Response("[]", { status: 200 });
  }));
  return urls;
}

describe("getUsers excludes employer accounts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("filters employer ids out of both the list and the count queries", async () => {
    const urls = stub([EMP_A, EMP_B], [{ id: USER }]);
    const out = await getUsers();
    expect(out.users.map((u) => u.id)).toEqual([USER]);
    const profileQueries = urls.filter((u) => u.includes("/profiles?"));
    expect(profileQueries).toHaveLength(2);
    for (const q of profileQueries) expect(q).toContain(`id=not.in.(${EMP_A},${EMP_B})`);
  });

  it("combines the exclusion with a search term", async () => {
    const urls = stub([EMP_A], [{ id: USER }]);
    await getUsers("asha");
    const q = urls.find((u) => u.includes("/profiles?") && !u.includes("limit=0"))!;
    expect(q).toContain(`id=not.in.(${EMP_A})`);
    expect(q).toContain("name.ilike.*asha*");
  });

  it("adds no exclusion filter when there are no employers", async () => {
    const urls = stub([], [{ id: USER }]);
    await getUsers();
    expect(urls.filter((u) => u.includes("/profiles?")).every((u) => !u.includes("not.in"))).toBe(true);
  });

  it("drops overflow employers (beyond the URL cap) from the returned page", async () => {
    const many = Array.from({ length: 201 }, (_, i) => `eeeeeeee-eeee-4eee-8eee-${String(i).padStart(12, "0")}`);
    const overflow = many[200];
    stub(many, [{ id: USER }, { id: overflow }]);
    const out = await getUsers();
    expect(out.users.map((u) => u.id)).toEqual([USER]);
  });
});
