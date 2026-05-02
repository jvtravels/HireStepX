import { describe, it, expect } from "vitest";
import {
  isDisposableEmailServer,
  validatePasswordServer,
  DISPOSABLE_EMAIL_DOMAINS,
} from "../../server-handlers/_disposable-emails";

describe("isDisposableEmailServer", () => {
  it("rejects mailinator", () => {
    expect(isDisposableEmailServer("test@mailinator.com")).toBe(true);
  });

  it("rejects 10minutemail variants", () => {
    expect(isDisposableEmailServer("a@10minutemail.com")).toBe(true);
    expect(isDisposableEmailServer("a@10minutemail.net")).toBe(true);
    expect(isDisposableEmailServer("a@20minutemail.com")).toBe(true);
  });

  it("rejects guerrillamail and friends", () => {
    expect(isDisposableEmailServer("a@guerrillamail.com")).toBe(true);
    expect(isDisposableEmailServer("a@sharklasers.com")).toBe(true);
    expect(isDisposableEmailServer("a@grr.la")).toBe(true);
  });

  it("rejects yopmail", () => {
    expect(isDisposableEmailServer("a@yopmail.com")).toBe(true);
  });

  it("accepts gmail / outlook / corporate domains", () => {
    expect(isDisposableEmailServer("rahul@gmail.com")).toBe(false);
    expect(isDisposableEmailServer("rahul@outlook.com")).toBe(false);
    expect(isDisposableEmailServer("rahul@hirestepx.com")).toBe(false);
    expect(isDisposableEmailServer("rahul@iitb.ac.in")).toBe(false);
  });

  it("is case-insensitive on the domain", () => {
    expect(isDisposableEmailServer("a@MAILINATOR.COM")).toBe(true);
    expect(isDisposableEmailServer("a@Mailinator.Com")).toBe(true);
  });

  it("trims whitespace defensively", () => {
    expect(isDisposableEmailServer("a@mailinator.com  ")).toBe(true);
    expect(isDisposableEmailServer("a@ mailinator.com ")).toBe(true);
  });

  it("returns false for non-emails / empty", () => {
    expect(isDisposableEmailServer("")).toBe(false);
    expect(isDisposableEmailServer("not-an-email")).toBe(false);
    expect(isDisposableEmailServer("@")).toBe(false);
    expect(isDisposableEmailServer("a@")).toBe(false);
    // @ts-expect-error - testing defensive non-string input
    expect(isDisposableEmailServer(null)).toBe(false);
    // @ts-expect-error
    expect(isDisposableEmailServer(undefined)).toBe(false);
  });

  it("does NOT do substring matching (no false positives)", () => {
    // "gmailinator.com" should NOT be flagged as disposable just
    // because it contains "mailinator" as a substring.
    expect(isDisposableEmailServer("a@gmailinator.com")).toBe(false);
    // Subdomains of disposable providers shouldn't auto-match either —
    // we want exact domain equality to keep the contract crisp.
    expect(isDisposableEmailServer("a@sub.mailinator.com")).toBe(false);
  });

  it("server blocklist matches the documented size", () => {
    // Pin the size so accidental imports / missing entries surface in
    // CI rather than silently shrink the list.
    expect(DISPOSABLE_EMAIL_DOMAINS.size).toBeGreaterThanOrEqual(50);
  });
});

describe("validatePasswordServer", () => {
  it("accepts a password meeting every rule", () => {
    expect(validatePasswordServer("StrongP@ss1")).toEqual({
      ok: true,
      error: null,
    });
  });

  it("rejects short passwords", () => {
    const r = validatePasswordServer("Sh0rt!");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("8 characters");
  });

  it("rejects oversized passwords", () => {
    const r = validatePasswordServer("A1!" + "x".repeat(200));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("128");
  });

  it("rejects passwords missing uppercase", () => {
    const r = validatePasswordServer("alllower1!");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("uppercase");
  });

  it("rejects passwords missing a number", () => {
    const r = validatePasswordServer("NoNumbers!");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("number");
  });

  it("rejects passwords missing a symbol", () => {
    const r = validatePasswordServer("NoSymbols1");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("special");
  });

  it("rejects empty / non-string input", () => {
    expect(validatePasswordServer("").ok).toBe(false);
    // @ts-expect-error
    expect(validatePasswordServer(null).ok).toBe(false);
    // @ts-expect-error
    expect(validatePasswordServer(undefined).ok).toBe(false);
    // @ts-expect-error
    expect(validatePasswordServer(12345).ok).toBe(false);
  });

  it("matches the client validateSignupPassword rule set (parity)", () => {
    // Test the exact thresholds — if any of these flips, the client
    // and server validators have drifted and the form will start
    // rejecting passwords the server would have accepted (or worse,
    // the reverse).
    expect(validatePasswordServer("Aa1!aaaa").ok).toBe(true); // exactly 8 chars
    expect(validatePasswordServer("Aa1!aaa").ok).toBe(false); // 7 chars
  });
});
