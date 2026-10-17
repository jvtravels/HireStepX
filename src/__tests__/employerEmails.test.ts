import { describe, it, expect, vi } from "vitest";
import {
  buildEmployerWelcomeEmail, buildNudgeEmail, selectNudges, nudgeDedupeKey, sendEmployerEmail,
  type NudgeRequirement, type MatchStat,
} from "../../server-handlers/_employer-emails";

const NOW = Date.UTC(2026, 10, 1, 6, 0, 0);
const DAY = 86_400_000;
const req = (id: string, ageDays: number, extra: Partial<NudgeRequirement> = {}): NudgeRequirement => ({
  id, employer_id: `emp-${id}`, title: "Backend Engineer", created_at: new Date(NOW - ageDays * DAY).toISOString(), status: "ready", ...extra,
});
const stats = (o: Record<string, MatchStat>) => o;

describe("welcome email", () => {
  it("escapes the company name in the body but keeps the subject plain text", () => {
    const m = buildEmployerWelcomeEmail("Fish & <Chips> Ltd");
    expect(m.subject).toBe("Welcome to HireStepX, Fish & <Chips> Ltd");
    expect(m.html).toContain("Fish &amp; &lt;Chips&gt; Ltd");
    expect(m.html).not.toContain("<Chips>");
    expect(m.html).toContain("/employer/requirements/new");
  });

  it("is transactional: no unsubscribe link", () => {
    expect(buildEmployerWelcomeEmail("Acme").html).not.toContain("Unsubscribe");
  });
});

describe("selectNudges", () => {
  it("nudges a 4-day-old job with matches and no unlocks", () => {
    const out = selectNudges([req("a", 4)], stats({ a: { total: 6, unlocked: 0 } }), NOW);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "matches_waiting", matchCount: 6 });
  });

  it("skips jobs that are too young, have no matches, or already had an unlock", () => {
    const out = selectNudges(
      [req("young", 1), req("nomatch", 5), req("unlocked", 5)],
      stats({ young: { total: 3, unlocked: 0 }, nomatch: { total: 0, unlocked: 0 }, unlocked: { total: 3, unlocked: 1 } }),
      NOW,
    );
    expect(out).toEqual([]);
  });

  it("sends the stale-job nudge for 14-45 day jobs with no unlocks, including zero-match jobs", () => {
    const out = selectNudges([req("old", 20), req("zero", 20, { status: "zero" }), req("ancient", 60)], stats({ old: { total: 2, unlocked: 0 } }), NOW);
    expect(out.map((c) => [c.requirement.id, c.kind])).toEqual([["old", "stale_job"], ["zero", "stale_job"]]);
  });

  it("ignores closed, generating and failed jobs", () => {
    const out = selectNudges(
      ["closed", "generating", "failed"].map((s) => req(s, 5, { status: s })),
      stats({ closed: { total: 4, unlocked: 0 }, generating: { total: 4, unlocked: 0 }, failed: { total: 4, unlocked: 0 } }),
      NOW,
    );
    expect(out).toEqual([]);
  });

  it("sends at most one nudge per employer per run, preferring matches-waiting", () => {
    const out = selectNudges(
      [req("stale", 20, { employer_id: "same" }), req("fresh", 4, { employer_id: "same" })],
      stats({ fresh: { total: 3, unlocked: 0 } }),
      NOW,
    );
    expect(out).toHaveLength(1);
    expect(out[0].requirement.id).toBe("fresh");
  });

  it("keys dedupe per kind and requirement", () => {
    const [c] = selectNudges([req("a", 4)], stats({ a: { total: 1, unlocked: 0 } }), NOW);
    expect(nudgeDedupeKey(c)).toBe("employer_nudge:matches_waiting:a");
  });
});

describe("nudge email copy", () => {
  it("pluralises, escapes the job title and carries the unsubscribe footer", () => {
    const [c] = selectNudges([req("a", 4, { title: "<b>Dev</b>" })], stats({ a: { total: 1, unlocked: 0 } }), NOW);
    const m = buildNudgeEmail(c, { marketing: true, unsubUrl: "https://x.test/u?t=1", manageUrl: "https://x.test/settings" });
    expect(m.subject).toContain("1 candidate is waiting");
    expect(m.html).toContain("&lt;b&gt;Dev&lt;/b&gt;");
    expect(m.html).toContain("https://x.test/u?t=1");
    expect(m.html).toContain("/employer/requirements/a");
  });
});

describe("sendEmployerEmail", () => {
  const input = { to: "a@acme.com", subject: "s", html: "<p>h</p>", idempotencyKey: "k1", extra: { reply_to: "r@x.com" } };
  const deps = (f: unknown) => ({ fetchImpl: f as typeof fetch, apiKey: "re_key", from: "H <n@h.com>", sleep: async () => {} });

  it("sends once with the idempotency key and merged extras", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    expect(await sendEmployerEmail(input, deps(f))).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    const init = f.mock.calls[0][1] as { headers: Record<string, string>; body: string };
    expect(init.headers["Idempotency-Key"]).toBe("k1");
    expect(JSON.parse(init.body)).toMatchObject({ from: "H <n@h.com>", to: ["a@acme.com"], reply_to: "r@x.com" });
  });

  it("retries exactly once after a 5xx or a network error", async () => {
    const f = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce({ ok: true, status: 200 });
    expect(await sendEmployerEmail(input, deps(f))).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);

    const g = vi.fn().mockRejectedValue(new Error("net"));
    expect(await sendEmployerEmail(input, deps(g))).toBe(false);
    expect(g).toHaveBeenCalledTimes(2);
  });

  it("does not retry a permanent 4xx", async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 422 });
    expect(await sendEmployerEmail(input, deps(f))).toBe(false);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("returns false without calling Resend when there is no API key or recipient", async () => {
    const f = vi.fn();
    expect(await sendEmployerEmail(input, { fetchImpl: f as unknown as typeof fetch, apiKey: "" , sleep: async () => {} })).toBe(false);
    expect(await sendEmployerEmail({ ...input, to: "" }, deps(f))).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});
