import { describe, it, expect, vi } from "vitest";
import { logEmployerMessage, MESSAGE_AUDIT_WINDOW_MS } from "../../server-handlers/_employer-message-audit";

const base = {
  supabaseUrl: "https://db.test",
  headers: { apikey: "svc" },
  employerId: "co-1",
  actorUserId: "u-1",
  actorEmail: "priya@acme.com",
  matchId: "m-1",
  candidateName: "Rahul S.",
  jobTitle: "SDE",
  hasAttachment: false,
  now: Date.UTC(2026, 9, 10, 12, 0, 0),
};

function fakeDb(recent: unknown[] | "fail") {
  const calls: Array<{ url: string; method: string; body: Record<string, unknown> | null }> = [];
  const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (method === "GET") return recent === "fail" ? new Response("{}", { status: 500 }) : new Response(JSON.stringify(recent));
    return new Response(null, { status: 201 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl, writes: () => calls.filter((c) => c.method === "POST") };
}

describe("logEmployerMessage", () => {
  it("records who messaged which candidate about which job, never the text", async () => {
    const db = fakeDb([]);
    expect(await logEmployerMessage({ ...base, fetchImpl: db.fetchImpl })).toBe(true);
    expect(db.writes()).toHaveLength(1);
    expect(db.writes()[0].body).toMatchObject({
      employer_id: "co-1", actor_user_id: "u-1", actor_email: "priya@acme.com",
      action: "candidate.messaged", entity_type: "match", entity_id: "m-1",
      meta: { candidateName: "Rahul S.", jobTitle: "SDE", hasAttachment: false },
    });
    expect(JSON.stringify(db.writes()[0].body)).not.toContain("body");
  });

  it("looks back one window for the same teammate and candidate", async () => {
    const db = fakeDb([]);
    await logEmployerMessage({ ...base, fetchImpl: db.fetchImpl });
    const lookup = db.calls[0].url;
    expect(lookup).toContain("actor_user_id=eq.u-1");
    expect(lookup).toContain("entity_id=eq.m-1");
    expect(lookup).toContain(encodeURIComponent(new Date(base.now - MESSAGE_AUDIT_WINDOW_MS).toISOString()));
  });

  it("stays quiet during a back-and-forth by the same teammate", async () => {
    const db = fakeDb([{ id: "x" }]);
    expect(await logEmployerMessage({ ...base, fetchImpl: db.fetchImpl })).toBe(false);
    expect(db.writes()).toHaveLength(0);
  });

  it("logs anyway if the lookup fails, because a duplicate beats a silent gap", async () => {
    const db = fakeDb("fail");
    expect(await logEmployerMessage({ ...base, fetchImpl: db.fetchImpl })).toBe(true);
    expect(db.writes()).toHaveLength(1);
  });
});
