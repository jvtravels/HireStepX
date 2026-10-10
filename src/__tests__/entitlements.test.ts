import { describe, it, expect, vi } from "vitest";
import {
  decideEmployerMatchAccess,
  loadEmployerMatchAccess,
  fetchMatchAccessRow,
  isBlockedByCandidate,
  loadAuthIdentity,
  DENIED_STATUS,
  type MatchAccessRow,
} from "../../server-handlers/_entitlements";

const EMP = "emp-1";

function row(over: Partial<MatchAccessRow> = {}, employer: Record<string, unknown> = {}): MatchAccessRow {
  return {
    id: "match-1",
    requirement_id: "req-1",
    candidate_user_id: "cand-1",
    match_score: 80,
    unlocked: false,
    candidate_status: "new",
    candidate_response: "none",
    employer_requirements: {
      employer_id: EMP,
      status: "open",
      title: "Backend",
      employers: { company_name: "Acme", website: "https://acme.com", suspended_at: null, verification_tier: "basic", ...employer },
    },
    profiles: { name: "Jane", employer_visibility: "masked" },
    ...over,
  };
}

function res(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
}

describe("decideEmployerMatchAccess", () => {
  const opts = { blockedByCandidate: false };

  it("not_found for a missing row", () => {
    expect(decideEmployerMatchAccess(null, EMP, opts)).toEqual({ ok: false, reason: "not_found" });
  });
  it("forbidden when the match belongs to another employer", () => {
    expect(decideEmployerMatchAccess(row(), "someone-else", opts)).toEqual({ ok: false, reason: "forbidden" });
  });
  it("suspended employers are denied", () => {
    const r = row({}, { suspended_at: "2026-10-01T00:00:00Z" });
    expect(decideEmployerMatchAccess(r, EMP, opts)).toEqual({ ok: false, reason: "suspended" });
  });
  it("a blocking candidate is unreachable, even after unlock", () => {
    expect(decideEmployerMatchAccess(row({ unlocked: true }), EMP, { blockedByCandidate: true })).toEqual({ ok: false, reason: "blocked" });
  });
  it("an opted-out candidate is unreachable before unlock but kept after", () => {
    const off = { name: "Jane", employer_visibility: "off" };
    expect(decideEmployerMatchAccess(row({ profiles: off }), EMP, opts)).toEqual({ ok: false, reason: "candidate_opted_out" });
    const paid = decideEmployerMatchAccess(row({ profiles: off, unlocked: true }), EMP, opts);
    expect(paid.ok).toBe(true);
    if (paid.ok) expect(paid.access.candidateWithdrew).toBe(true);
  });
  it("derives the tier from stored tier + confirmed email", () => {
    const d = decideEmployerMatchAccess(row(), EMP, { blockedByCandidate: false, authEmail: "h@acme.com", emailConfirmed: true });
    expect(d.ok && d.access.tier).toBe("verified");
    const d2 = decideEmployerMatchAccess(row(), EMP, { blockedByCandidate: false, authEmail: "h@gmail.com", emailConfirmed: true });
    expect(d2.ok && d2.access.tier).toBe("basic");
  });
  it("reports requirementOpen=false for closed requirements", () => {
    const r = row();
    if (r.employer_requirements) r.employer_requirements.status = "closed";
    const d = decideEmployerMatchAccess(r, EMP, opts);
    expect(d.ok && d.access.requirementOpen).toBe(false);
  });
  it("denial map hides opted-out/blocked behind 404", () => {
    expect(DENIED_STATUS.candidate_opted_out.status).toBe(404);
    expect(DENIED_STATUS.blocked.status).toBe(404);
    expect(DENIED_STATUS.suspended.status).toBe(403);
  });
});

describe("fetchers", () => {
  it("fetchMatchAccessRow returns the row, null, or 'error'", async () => {
    expect(await fetchMatchAccessRow("u", {}, "m", vi.fn().mockResolvedValue(res([row()])))).toMatchObject({ id: "match-1" });
    expect(await fetchMatchAccessRow("u", {}, "m", vi.fn().mockResolvedValue(res([])))).toBeNull();
    expect(await fetchMatchAccessRow("u", {}, "m", vi.fn().mockResolvedValue(res({}, false)))).toBe("error");
  });
  it("isBlockedByCandidate reads employer_blocks", async () => {
    const f = vi.fn().mockResolvedValue(res([{ candidate_user_id: "c" }]));
    expect(await isBlockedByCandidate("u", {}, "c", "e", f)).toBe(true);
    expect(f.mock.calls[0][0]).toContain("employer_blocks");
    expect(await isBlockedByCandidate("u", {}, "c", "e", vi.fn().mockResolvedValue(res([])))).toBe(false);
    expect(await isBlockedByCandidate("u", {}, "c", "e", vi.fn().mockResolvedValue(res({}, false)))).toBe("error");
  });
  it("loadAuthIdentity fails closed", async () => {
    expect(await loadAuthIdentity("u", {}, "x", vi.fn().mockResolvedValue(res({ email: "a@b.com", email_confirmed_at: "2026-01-01" })))).toEqual({ email: "a@b.com", emailConfirmed: true });
    expect(await loadAuthIdentity("u", {}, "x", vi.fn().mockResolvedValue(res({}, false)))).toEqual({ email: null, emailConfirmed: false });
    expect(await loadAuthIdentity("u", {}, "x", vi.fn().mockRejectedValue(new Error("net")))).toEqual({ email: null, emailConfirmed: false });
  });
});

describe("loadEmployerMatchAccess", () => {
  const params = { supabaseUrl: "u", headers: {}, employerId: EMP, matchId: "match-1" };

  it("grants access when the row loads and nobody is blocked", async () => {
    const f = vi.fn().mockResolvedValueOnce(res([row()])).mockResolvedValueOnce(res([]));
    const d = await loadEmployerMatchAccess({ ...params, fetchImpl: f });
    expect(d.ok).toBe(true);
  });
  it("denies when the candidate blocked the employer", async () => {
    const f = vi.fn().mockResolvedValueOnce(res([row()])).mockResolvedValueOnce(res([{ candidate_user_id: "cand-1" }]));
    expect(await loadEmployerMatchAccess({ ...params, fetchImpl: f })).toEqual({ ok: false, reason: "blocked" });
  });
  it("does not query blocks for another employer's match", async () => {
    const f = vi.fn().mockResolvedValueOnce(res([row()]));
    const d = await loadEmployerMatchAccess({ ...params, employerId: "intruder", fetchImpl: f });
    expect(d).toEqual({ ok: false, reason: "forbidden" });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("surfaces lookup failures as 'error' instead of 404", async () => {
    expect(await loadEmployerMatchAccess({ ...params, fetchImpl: vi.fn().mockResolvedValue(res({}, false)) })).toEqual({ ok: false, reason: "error" });
    const f = vi.fn().mockResolvedValueOnce(res([row()])).mockResolvedValueOnce(res({}, false));
    expect(await loadEmployerMatchAccess({ ...params, fetchImpl: f })).toEqual({ ok: false, reason: "error" });
  });
});
