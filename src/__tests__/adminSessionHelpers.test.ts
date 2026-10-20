import { describe, it, expect } from "vitest";
import {
  ADMIN_SESSION_MAX_MS, describeAdminAction, evaluateSession, isMfaRequired, parseAdminClaims,
  parseRevocationResults, readCookie, tokenExpiry, toWebHeaders, type AdminClaims,
} from "../../server-handlers/_admin-session-helpers";

const H = 60 * 60 * 1000;
const NOW = 1_700_000_000_000;
const claims = (over: Partial<AdminClaims> = {}): AdminClaims => ({
  iat: NOW, exp: NOW + 4 * H, ast: NOW, sid: "sess-1234-abcd", mfa: false, ...over,
});
const ctx = { now: NOW + H, requireMfa: false, sidRevoked: false, revokedBeforeMs: null };

describe("parseAdminClaims", () => {
  it("parses a full payload", () => {
    expect(parseAdminClaims({ iat: 1, exp: 2, ast: 1, sid: "abcdefgh-1234", mfa: true }))
      .toEqual({ iat: 1, exp: 2, ast: 1, sid: "abcdefgh-1234", mfa: true });
  });
  it("treats a legacy payload as sid-less, sign-in = iat, no mfa", () => {
    expect(parseAdminClaims({ iat: 5, exp: 9 })).toEqual({ iat: 5, exp: 9, ast: 5, sid: null, mfa: false });
  });
  it("rejects non-objects and non-numeric iat/exp, and drops malformed sids", () => {
    expect(parseAdminClaims(null)).toBeNull();
    expect(parseAdminClaims({ iat: "1", exp: 2 })).toBeNull();
    expect(parseAdminClaims({ iat: 1, exp: NaN })).toBeNull();
    expect(parseAdminClaims({ iat: 1, exp: 2, sid: "has spaces!" })?.sid).toBeNull();
  });
});

describe("tokenExpiry", () => {
  it("slides by the idle window while under the cap", () => {
    expect(tokenExpiry(NOW + H, NOW, 4 * H)).toBe(NOW + 5 * H);
  });
  it("never exceeds sign-in + 8h", () => {
    expect(tokenExpiry(NOW + 7 * H, NOW, 4 * H)).toBe(NOW + ADMIN_SESSION_MAX_MS);
  });
});

describe("evaluateSession", () => {
  it("accepts a live, unrevoked session", () => {
    expect(evaluateSession(claims(), ctx)).toEqual({ ok: true });
  });
  it("returns session_expired past exp, past the 8h cap, and for sid-less tokens", () => {
    for (const [c, now] of [
      [claims(), NOW + 5 * H],
      [claims({ exp: NOW + 20 * H }), NOW + 9 * H],
      [claims({ sid: null }), NOW + H],
    ] as const) {
      expect(evaluateSession(c, { ...ctx, now })).toMatchObject({ ok: false, status: 401, code: "session_expired" });
    }
  });
  it("returns session_revoked for a revoked sid or a cutoff at/after sign-in, but not before", () => {
    expect(evaluateSession(claims(), { ...ctx, sidRevoked: true })).toMatchObject({ code: "session_revoked" });
    expect(evaluateSession(claims(), { ...ctx, revokedBeforeMs: NOW })).toMatchObject({ code: "session_revoked" });
    expect(evaluateSession(claims(), { ...ctx, revokedBeforeMs: NOW - 1 })).toEqual({ ok: true });
  });
  it("requires the mfa claim only when requireMfa is on (403)", () => {
    expect(evaluateSession(claims(), ctx)).toEqual({ ok: true });
    expect(evaluateSession(claims(), { ...ctx, requireMfa: true })).toMatchObject({ ok: false, status: 403, code: "mfa_required" });
    expect(evaluateSession(claims({ mfa: true }), { ...ctx, requireMfa: true })).toEqual({ ok: true });
  });
  it("reports expiry before revocation before mfa", () => {
    const c = claims();
    expect(evaluateSession(c, { ...ctx, now: NOW + 5 * H, sidRevoked: true, requireMfa: true })).toMatchObject({ code: "session_expired" });
    expect(evaluateSession(c, { ...ctx, sidRevoked: true, requireMfa: true })).toMatchObject({ code: "session_revoked" });
  });
});

describe("isMfaRequired", () => {
  it("is on only for the exact value 1", () => {
    expect(isMfaRequired("1")).toBe(true);
    expect(isMfaRequired(" 1 ")).toBe(true);
    for (const v of [undefined, "", "0", "true", "yes"]) expect(isMfaRequired(v)).toBe(false);
  });
});

describe("parseRevocationResults", () => {
  it("reads the sid flag and cutoff from the pipeline results", () => {
    expect(parseRevocationResults(["1", "1700000000000"])).toEqual({ sidRevoked: true, revokedBeforeMs: 1_700_000_000_000 });
    expect(parseRevocationResults([null, null])).toEqual({ sidRevoked: false, revokedBeforeMs: null });
    expect(parseRevocationResults([null, "not-a-number"]).revokedBeforeMs).toBeNull();
    expect(parseRevocationResults(undefined)).toEqual({ sidRevoked: false, revokedBeforeMs: null });
  });
});

describe("readCookie / toWebHeaders", () => {
  it("finds a named cookie among several", () => {
    expect(readCookie("a=1; admin_token=xyz.abc; b=2", "admin_token")).toBe("xyz.abc");
    expect(readCookie("a=1", "admin_token")).toBeUndefined();
  });
  it("converts node header bags so getClientIp can read them", () => {
    const h = toWebHeaders({ "x-real-ip": "9.9.9.9", "x-forwarded-for": ["1.1.1.1", "2.2.2.2"], skip: undefined });
    expect(h.get("x-real-ip")).toBe("9.9.9.9");
    expect(h.get("x-forwarded-for")).toBe("1.1.1.1, 2.2.2.2");
    expect(h.has("skip")).toBe(false);
  });
});

describe("describeAdminAction", () => {
  it("keeps ids and allow-listed scalars, never free text", () => {
    const d = describeAdminAction("send-email", { userId: "u1", subject: "Hi jane@x.com", htmlBody: "<p>secret</p>", note: "n", reason: "r", search: "q", tier: "starter", days: 30, matchIds: ["a", "b"] });
    expect(d).toEqual({
      action: "send-email", resource_type: "user", resource_id: "u1",
      meta: { tier: "starter", days: 30, matchCount: 2, hasSearch: true },
    });
  });
  it("sanitises a client-supplied section name and handles an empty body", () => {
    expect(describeAdminAction("../x y;drop", undefined)).toMatchObject({ action: "xydrop", resource_type: null, resource_id: null, meta: {} });
  });
});
