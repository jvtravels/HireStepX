import { describe, it, expect } from "vitest";
import { normalizeGender, normalizeVoices } from "../../server-handlers/_voices-helpers";

describe("normalizeGender", () => {
  it("maps Cartesia's masculine to male", () => {
    expect(normalizeGender("masculine")).toBe("male");
  });

  it("maps Cartesia's feminine to female", () => {
    expect(normalizeGender("feminine")).toBe("female");
  });

  it("passes through an already-normalized value unchanged", () => {
    expect(normalizeGender("male")).toBe("male");
    expect(normalizeGender("female")).toBe("female");
  });

  it("passes through an unrecognized-but-present value unchanged", () => {
    expect(normalizeGender("nonbinary")).toBe("nonbinary");
  });

  it("falls back to unknown for undefined", () => {
    expect(normalizeGender(undefined)).toBe("unknown");
  });

  it("falls back to unknown for an empty string", () => {
    expect(normalizeGender("")).toBe("unknown");
  });
});

describe("normalizeVoices", () => {
  it("normalizes gender on every voice in a batch, matching the live Cartesia response shape", () => {
    const raw = [
      { id: "1", name: "Aarav", description: "Warm adult male voice", gender: "masculine", language: "en" },
      { id: "2", name: "Priya", description: "Authoritative, adult female", gender: "feminine", language: "en" },
    ];
    const out = normalizeVoices(raw, "en_IN");
    expect(out).toEqual([
      { id: "1", name: "Aarav", desc: "Warm adult male voice", gender: "male", language: "en" },
      { id: "2", name: "Priya", desc: "Authoritative, adult female", gender: "female", language: "en" },
    ]);
  });

  it("falls back to the requested language when a voice omits its own", () => {
    const out = normalizeVoices([{ id: "1", name: "X", gender: "masculine" }], "en_IN");
    expect(out[0].language).toBe("en_IN");
  });

  it("defaults id/name/desc to empty strings when Cartesia omits them", () => {
    const out = normalizeVoices([{ gender: "feminine" }], "en");
    expect(out[0]).toEqual({ id: "", name: "", desc: "", gender: "female", language: "en" });
  });

  it("returns an empty array for an empty input", () => {
    expect(normalizeVoices([], "en")).toEqual([]);
  });
});
