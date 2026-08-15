import { describe, it, expect, vi, afterEach } from "vitest";
import {
  validateEmail,
  validatePassword,
  checkPasswordBreached,
  sanitizeEmail,
  isDisposableEmail,
  normalizeEmailForDedup,
  passwordHasEdgeWhitespace,
  validateName,
  validateSignupPassword,
} from "../auth/_validation";

describe("validateEmail", () => {
  it("treats empty input as not-yet-invalid", () => {
    expect(validateEmail("")).toEqual({ valid: false, message: null });
    expect(validateEmail("   ")).toEqual({ valid: false, message: null });
  });

  it("accepts a well-formed email", () => {
    expect(validateEmail("rahul@example.com")).toEqual({ valid: true, message: null });
  });

  it("rejects an email with no @", () => {
    expect(validateEmail("rahulexample.com").valid).toBe(false);
  });

  it("rejects an email with multiple @s", () => {
    expect(validateEmail("rahul@ex@ample.com").valid).toBe(false);
  });

  it("rejects consecutive dots", () => {
    expect(validateEmail("rahul@example..com").valid).toBe(false);
  });

  it("rejects a leading dot", () => {
    expect(validateEmail(".rahul@example.com").valid).toBe(false);
  });

  it("rejects a missing top-level domain", () => {
    expect(validateEmail("rahul@example").valid).toBe(false);
  });
});

describe("validatePassword", () => {
  it("treats empty input as not-yet-invalid", () => {
    expect(validatePassword("")).toEqual({ valid: false, message: null });
  });

  it("rejects a password under 8 characters", () => {
    expect(validatePassword("short1").valid).toBe(false);
  });

  it("accepts an 8+ character password", () => {
    expect(validatePassword("longenough")).toEqual({ valid: true, message: null });
  });
});

describe("checkPasswordBreached", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips the network call for trivially-short passwords", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await checkPasswordBreached("short");
    expect(result).toEqual({ breached: false, count: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports unknown when the HIBP API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await checkPasswordBreached("goodpassword1");
    expect(result.unknown).toBe(true);
    expect(result.breached).toBe(false);
  });

  it("reports unknown when the HIBP API responds non-ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await checkPasswordBreached("goodpassword1");
    expect(result).toEqual({ breached: false, count: 0, unknown: true });
  });

  it("reports not-breached when the suffix isn't in the range response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "AAAA0000000000000000000000000000000:3" }));
    const result = await checkPasswordBreached("goodpassword1");
    expect(result.breached).toBe(false);
  });
});

describe("sanitizeEmail", () => {
  it("trims whitespace and lowercases only the domain", () => {
    expect(sanitizeEmail("  Rahul@EXAMPLE.com  ")).toBe("Rahul@example.com");
  });

  it("returns the trimmed value unchanged when there's no @", () => {
    expect(sanitizeEmail(" notanemail ")).toBe("notanemail");
  });
});

describe("isDisposableEmail", () => {
  it("flags a known disposable domain", () => {
    expect(isDisposableEmail("someone@mailinator.com")).toBe(true);
  });

  it("is case-insensitive on the domain", () => {
    expect(isDisposableEmail("someone@MAILINATOR.COM")).toBe(true);
  });

  it("allows a normal domain", () => {
    expect(isDisposableEmail("rahul@gmail.com")).toBe(false);
  });

  it("returns false when there's no @", () => {
    expect(isDisposableEmail("notanemail")).toBe(false);
  });
});

describe("normalizeEmailForDedup", () => {
  it("strips the +suffix and dots on Gmail", () => {
    expect(normalizeEmailForDedup("Rahul.Kumar+jobs@gmail.com")).toBe("rahulkumar@gmail.com");
  });

  it("strips only the +suffix on non-Gmail plus-alias providers", () => {
    expect(normalizeEmailForDedup("rahul+jobs@outlook.com")).toBe("rahul+jobs@outlook.com".replace("+jobs", ""));
  });

  it("leaves unknown-domain emails as lowercased-domain only", () => {
    expect(normalizeEmailForDedup("Rahul+x@example.co.in")).toBe("rahul+x@example.co.in");
  });

  it("returns the trimmed/lowercased value unchanged when there's no @", () => {
    expect(normalizeEmailForDedup(" NotAnEmail ")).toBe("notanemail");
  });
});

describe("passwordHasEdgeWhitespace", () => {
  it("detects leading whitespace", () => {
    expect(passwordHasEdgeWhitespace(" password")).toBe(true);
  });

  it("detects trailing whitespace", () => {
    expect(passwordHasEdgeWhitespace("password ")).toBe(true);
  });

  it("is false for a clean password", () => {
    expect(passwordHasEdgeWhitespace("password")).toBe(false);
  });

  it("is false for an empty string", () => {
    expect(passwordHasEdgeWhitespace("")).toBe(false);
  });
});

describe("validateName", () => {
  it("treats empty input as not-yet-invalid", () => {
    expect(validateName("")).toEqual({ valid: false, message: null });
  });

  it("rejects a single-character name", () => {
    expect(validateName("A").valid).toBe(false);
  });

  it("rejects a name over 40 characters", () => {
    expect(validateName("A".repeat(41)).valid).toBe(false);
  });

  it("accepts a normal name", () => {
    expect(validateName("Rahul Kumar")).toEqual({ valid: true, message: null });
  });

  it("accepts a name with an apostrophe", () => {
    expect(validateName("O'Brien").valid).toBe(true);
  });
});

describe("validateSignupPassword", () => {
  it("scores empty input as 0 with no message", () => {
    const r = validateSignupPassword("");
    expect(r).toEqual({ valid: false, message: null, score: 0, label: "", checks: r.checks });
  });

  it("flags a too-short password", () => {
    const r = validateSignupPassword("Ab1!");
    expect(r.valid).toBe(false);
    expect(r.label).toBe("Too short");
    expect(r.checks.length).toBe(false);
  });

  it("flags a long password missing required variety as weak", () => {
    const r = validateSignupPassword("alllowercase");
    expect(r.valid).toBe(false);
    expect(r.label).toBe("Weak");
  });

  it("accepts a password meeting all required criteria", () => {
    const r = validateSignupPassword("Password1!");
    expect(r.valid).toBe(true);
    expect(r.checks.uppercase).toBe(true);
    expect(r.checks.number).toBe(true);
    expect(r.checks.symbol).toBe(true);
  });

  it("labels a long, highly varied password as Strong", () => {
    const r = validateSignupPassword("Str0ng&SecurePass!");
    expect(r.valid).toBe(true);
    expect(r.label).toBe("Strong");
    expect(r.score).toBe(4);
  });
});
