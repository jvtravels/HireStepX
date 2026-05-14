import { describe, it, expect, afterEach, vi } from "vitest";
import {
  selectPromptVariant,
  getSystemPrompt,
  type PromptVariant,
} from "../../server-handlers/_prompt-variants";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("selectPromptVariant", () => {
  it("returns 'control' for null / undefined / empty sessionId", () => {
    expect(selectPromptVariant(null)).toBe("control");
    expect(selectPromptVariant(undefined)).toBe("control");
    expect(selectPromptVariant("")).toBe("control");
  });

  it("returns the same variant for the same sessionId (deterministic)", () => {
    const a = selectPromptVariant("session-deadbeef-1234");
    const b = selectPromptVariant("session-deadbeef-1234");
    expect(a).toBe(b);
  });

  it("produces an approximately 33/33/33 split across many session IDs", () => {
    const counts: Record<PromptVariant, number> = {
      "control": 0, "variant-a": 0, "variant-b": 0,
    };
    for (let i = 0; i < 3000; i++) {
      counts[selectPromptVariant(`sess-${i}-${i * 31}`)]++;
    }
    /* Each bucket should be within ±10% of expected 1000 — generous for
     * a 3-way mod of a hash, deterministic across runs. */
    for (const v of ["control", "variant-a", "variant-b"] as PromptVariant[]) {
      expect(counts[v]).toBeGreaterThan(800);
      expect(counts[v]).toBeLessThan(1200);
    }
  });

  it("HSX_FORCE_PROMPT_VARIANT env override pins the bucket", () => {
    vi.stubEnv("HSX_FORCE_PROMPT_VARIANT", "variant-b");
    expect(selectPromptVariant("any-id-1")).toBe("variant-b");
    expect(selectPromptVariant("any-id-2")).toBe("variant-b");
  });

  it("invalid HSX_FORCE_PROMPT_VARIANT value falls back to hash-based selection", () => {
    vi.stubEnv("HSX_FORCE_PROMPT_VARIANT", "nonsense");
    const v = selectPromptVariant("any-id-1");
    expect(["control", "variant-a", "variant-b"]).toContain(v);
  });
});

describe("getSystemPrompt", () => {
  it("control passes through unchanged", () => {
    const base = "You are a recruiter.";
    expect(getSystemPrompt("control", base)).toBe(base);
  });

  it("variant-a prepends concise/verbatim instruction", () => {
    const out = getSystemPrompt("variant-a", "BASE");
    expect(out).toMatch(/concise/i);
    expect(out).toMatch(/verbatim/i);
    expect(out.endsWith("BASE")).toBe(true);
  });

  it("variant-b prepends warmer-tone instruction", () => {
    const out = getSystemPrompt("variant-b", "BASE");
    expect(out).toMatch(/warmer/i);
    expect(out).toMatch(/mentor/i);
    expect(out.endsWith("BASE")).toBe(true);
  });
});
