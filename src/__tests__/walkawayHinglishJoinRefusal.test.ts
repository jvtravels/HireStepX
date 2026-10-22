/* Family H / EXT-B6 — Hinglish join-refusal walk-aways.
 *
 * This product serves Indian candidates and the STT layer delivers
 * romanized Hinglish. Natural walk-away forms "main nahi jaaunga" (I won't
 * go), "join nahi karunga" (I won't join), and "yeh offer nahi lunga" (I
 * won't take this) were NOT in WALKAWAY_PATTERN — the kernel read them as
 * non-walk-away and kept negotiating against a candidate who had already
 * refused. Folded into the single-source detector alongside the existing
 * `nahi chalega` / `nahi chahiye` forms. Asserted in ASR form (lowercase,
 * no punctuation) — exactly how the voice STT layer delivers them. */
import { describe, it, expect } from "vitest";
import { isWalkAway } from "../../server-handlers/_walkaway-detection";

describe("_walkaway-detection — EXT-B6 Hinglish join-refusal", () => {
  it.each([
    "main nahi jaaunga",
    "nahi jaunga is offer pe",
    "main join nahi karunga",
    "sorry main join nahi karungi",
    "yeh offer main nahi lunga",
    "itne kam mein nahi jaungi",
  ])("detects walk-away: %j", (t) => {
    expect(isWalkAway(t)).toBe(true);
  });

  it("still detects the pre-existing Hinglish forms (no regression)", () => {
    expect(isWalkAway("nahi chalega")).toBe(true);
    expect(isWalkAway("mujhe nahi chahiye")).toBe(true);
  });

  /* Guards — cooperative/neutral Hinglish must NOT trip the walk-away arm. */
  it.each([
    "haan main jaaunga", // "yes I'll go" — the opposite
    "theek hai offer accept karunga", // "ok I'll accept the offer"
    "main sochunga is baare mein", // "I'll think about it" — a stall, not a walk-away
  ])("does NOT falsely fire on cooperative Hinglish: %j", (t) => {
    expect(isWalkAway(t)).toBe(false);
  });
});
