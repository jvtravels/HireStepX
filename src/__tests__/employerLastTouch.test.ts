import { describe, it, expect, vi } from "vitest";
import { loadLastTouch } from "../../server-handlers/_employer-last-touch";

const base = { supabaseUrl: "https://x.supabase.co", headers: {}, employerId: "emp-1", viewerId: "u-me" };

function fakeFetch(roster: unknown, log: unknown, ok = true) {
  return vi.fn(async (url: string) => {
    const body = String(url).includes("employer_members") ? roster : log;
    return { ok, json: async () => body } as Response;
  }) as unknown as typeof fetch;
}

describe("loadLastTouch", () => {
  it("returns an empty map without any request when there are no matches", async () => {
    const f = fakeFetch([], []);
    expect((await loadLastTouch({ ...base, matchIds: [], fetchImpl: f })).size).toBe(0);
    expect(f).not.toHaveBeenCalled();
  });

  it("keeps the newest touch per match and flags the viewer", async () => {
    const f = fakeFetch(
      [{ user_id: "u-me", name: "Asha", email: "a@acme.com" }, { user_id: "u-2", name: null, email: "ravi@acme.com" }],
      [
        { entity_id: "m1", actor_user_id: "u-2", created_at: "2026-10-27T10:00:00Z" },
        { entity_id: "m1", actor_user_id: "u-me", created_at: "2026-10-26T10:00:00Z" },
        { entity_id: "m2", actor_user_id: "u-me", created_at: "2026-10-25T10:00:00Z" },
      ],
    );
    const out = await loadLastTouch({ ...base, matchIds: ["m1", "m2"], fetchImpl: f });
    expect(out.get("m1")).toEqual({ name: "ravi@acme.com", isYou: false, at: "2026-10-27T10:00:00Z" });
    expect(out.get("m2")).toMatchObject({ name: "Asha", isYou: true });
  });

  it("falls back to a former member when the actor left the team", async () => {
    const f = fakeFetch([], [{ entity_id: "m1", actor_user_id: "gone", created_at: "2026-10-27T10:00:00Z" }]);
    const out = await loadLastTouch({ ...base, matchIds: ["m1"], fetchImpl: f });
    expect(out.get("m1")?.name).toBe("A former member");
  });

  it("ignores rows with no actor (system or webhook writes)", async () => {
    const f = fakeFetch([], [{ entity_id: "m1", actor_user_id: null, created_at: "2026-10-27T10:00:00Z" }]);
    expect((await loadLastTouch({ ...base, matchIds: ["m1"], fetchImpl: f })).size).toBe(0);
  });

  it("batches large match lists", async () => {
    const f = fakeFetch([], []);
    await loadLastTouch({ ...base, matchIds: Array.from({ length: 120 }, (_, i) => `m${i}`), fetchImpl: f });
    // 1 roster + 3 audit batches of at most 50 ids
    expect(vi.mocked(f)).toHaveBeenCalledTimes(4);
  });

  it("returns an empty map when a request fails or throws", async () => {
    expect((await loadLastTouch({ ...base, matchIds: ["m1"], fetchImpl: fakeFetch([], [], false) })).size).toBe(0);
    const boom = vi.fn(async () => { throw new Error("network"); }) as unknown as typeof fetch;
    expect((await loadLastTouch({ ...base, matchIds: ["m1"], fetchImpl: boom })).size).toBe(0);
  });
});
