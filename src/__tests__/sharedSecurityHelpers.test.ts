/* Tests for the security helpers in server-handlers/_shared.ts. These
 * underpin every authenticated endpoint — a regression here is silently
 * permissive (origin spoofed, body-size limit ignored, IP detection
 * fooled, OPTIONS preflight broken). Lock them. */

import { vi } from "vitest";
vi.hoisted(() => {
  // Pre-load env so module-level constants in _shared resolve sanely.
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://x.local";
  process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "k";
});

import { describe, it, expect } from "vitest";
import {
  validateOrigin,
  checkBodySize,
  getClientIp,
  handleCorsPreflightOrMethod,
} from "../../server-handlers/_shared";

function makeReq(headers: Record<string, string>, method = "POST", url = "https://hirestepx.com/api/x"): Request {
  return new Request(url, { method, headers });
}

/* ─── validateOrigin ────────────────────────────────────────── */

describe("validateOrigin", () => {
  it("accepts the canonical hirestepx.com origin", () => {
    expect(validateOrigin(makeReq({ origin: "https://hirestepx.com" }))).toBe(true);
  });

  it("accepts subdomains of hirestepx.com", () => {
    expect(validateOrigin(makeReq({ origin: "https://staging.hirestepx.com" }))).toBe(true);
    expect(validateOrigin(makeReq({ origin: "https://www.hirestepx.com" }))).toBe(true);
  });

  it("accepts Vercel preview deployments (*.vercel.app)", () => {
    expect(validateOrigin(makeReq({ origin: "https://hirestepx-abc123.vercel.app" }))).toBe(true);
  });

  it("accepts localhost dev origins", () => {
    expect(validateOrigin(makeReq({ origin: "http://localhost:3000" }))).toBe(true);
    expect(validateOrigin(makeReq({ origin: "http://localhost:5173" }))).toBe(true);
  });

  it("rejects look-alike domains", () => {
    expect(validateOrigin(makeReq({ origin: "https://hirestepx.com.evil.com" }))).toBe(false);
    expect(validateOrigin(makeReq({ origin: "https://evilhirestepx.com" }))).toBe(false);
    expect(validateOrigin(makeReq({ origin: "https://hirestepx.evil.com" }))).toBe(false);
  });

  it("rejects unrelated origins", () => {
    expect(validateOrigin(makeReq({ origin: "https://google.com" }))).toBe(false);
    expect(validateOrigin(makeReq({ origin: "https://attacker.example" }))).toBe(false);
  });

  it("falls back to Referer when Origin is absent (same-origin GET case)", () => {
    expect(validateOrigin(makeReq({ referer: "https://hirestepx.com/dashboard" }))).toBe(true);
    expect(validateOrigin(makeReq({ referer: "https://attacker.com/foo" }))).toBe(false);
  });

  it("rejects when neither Origin nor Referer present", () => {
    expect(validateOrigin(makeReq({}))).toBe(false);
  });
});

/* ─── checkBodySize ─────────────────────────────────────────── */

describe("checkBodySize", () => {
  it("returns false (within limit) when content-length is below max", () => {
    expect(checkBodySize(makeReq({ "content-length": "1000" }), 60_000)).toBe(false);
  });

  it("returns true (over limit) when content-length exceeds max", () => {
    expect(checkBodySize(makeReq({ "content-length": "100000" }), 60_000)).toBe(true);
  });

  it("treats missing content-length as 0 (within limit)", () => {
    expect(checkBodySize(makeReq({}), 60_000)).toBe(false);
  });

  it("respects custom max bytes", () => {
    expect(checkBodySize(makeReq({ "content-length": "5000" }), 4_000)).toBe(true);
    expect(checkBodySize(makeReq({ "content-length": "3000" }), 4_000)).toBe(false);
  });

  it("uses 1 MiB default when maxBytes omitted", () => {
    expect(checkBodySize(makeReq({ "content-length": "500000" }))).toBe(false);
    expect(checkBodySize(makeReq({ "content-length": "2000000" }))).toBe(true);
  });
});

/* ─── getClientIp ──────────────────────────────────────────── */

describe("getClientIp", () => {
  it("prefers x-real-ip over x-forwarded-for (Vercel edge sets x-real-ip)", () => {
    expect(getClientIp(makeReq({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("falls back to first entry of x-forwarded-for", () => {
    expect(getClientIp(makeReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12" }))).toBe("1.2.3.4");
  });

  it("trims whitespace around IPs", () => {
    expect(getClientIp(makeReq({ "x-forwarded-for": "  1.2.3.4  ,  5.6.7.8  " }))).toBe("1.2.3.4");
    expect(getClientIp(makeReq({ "x-real-ip": "  9.9.9.9  " }))).toBe("9.9.9.9");
  });

  it("returns 'unknown' when no IP headers present", () => {
    expect(getClientIp(makeReq({}))).toBe("unknown");
  });
});

/* ─── handleCorsPreflightOrMethod ──────────────────────────── */

describe("handleCorsPreflightOrMethod", () => {
  it("returns 204 for OPTIONS preflight", () => {
    const r = handleCorsPreflightOrMethod(makeReq({ origin: "https://hirestepx.com" }, "OPTIONS"));
    expect(r).not.toBeNull();
    expect(r?.status).toBe(204);
  });

  it("rejects non-POST methods with 405 by default", () => {
    const r = handleCorsPreflightOrMethod(makeReq({}, "GET"));
    expect(r).not.toBeNull();
    expect(r?.status).toBe(405);
  });

  it("rejects PUT/DELETE/PATCH even when allowGet is true", () => {
    expect(handleCorsPreflightOrMethod(makeReq({}, "PUT"), { allowGet: true })?.status).toBe(405);
    expect(handleCorsPreflightOrMethod(makeReq({}, "DELETE"), { allowGet: true })?.status).toBe(405);
    expect(handleCorsPreflightOrMethod(makeReq({}, "PATCH"), { allowGet: true })?.status).toBe(405);
  });

  it("allows GET when allowGet is true (the user-outcome 405 fix)", () => {
    expect(handleCorsPreflightOrMethod(makeReq({}, "GET"), { allowGet: true })).toBeNull();
  });

  it("allows POST regardless of allowGet flag", () => {
    expect(handleCorsPreflightOrMethod(makeReq({}, "POST"))).toBeNull();
    expect(handleCorsPreflightOrMethod(makeReq({}, "POST"), { allowGet: true })).toBeNull();
  });
});
