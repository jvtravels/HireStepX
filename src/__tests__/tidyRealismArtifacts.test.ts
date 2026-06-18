/* D5 (2026-06-18) — Indian-HR register / fluency output contract.
 *
 * The realism chain stacks up to five independent overlay layers, each
 * prepending a discourse filler with its own dice. On unlucky rolls they
 * pile 2-3 deep into utterances no real recruiter would say, and break
 * capitalization after a sentence-final period. `tidyRealismArtifacts`
 * enforces the structural output contract at the single composition
 * point — phrasing-independent of which layer fired:
 *   (1) ≤ 1 leading discourse filler before the first content word.
 *   (2) every sentence starts with a capital letter.
 * These lock the two garble classes reproduced via the offline simulator.
 */
import { describe, it, expect } from "vitest";
import { tidyRealismArtifacts } from "../../server-handlers/_recruiter-prose-realism";

describe("tidyRealismArtifacts — ≤1 leading discourse filler", () => {
  it("collapses a stacked context-ref + hedge + ack to the first opener", () => {
    const garble =
      "In this profitability-first era, honestly, okay, what justifies the bump?";
    const out = tidyRealismArtifacts(garble);
    // Only the richest (first) opener survives; the hedge + ack are gone.
    expect(out).toBe(
      "In this profitability-first era, what justifies the bump?",
    );
    expect(out.toLowerCase()).not.toContain("honestly,");
  });

  it("collapses a triple casual stack to a single opener", () => {
    const out = tidyRealismArtifacts("To be fair, I mean, look, here is the structure.");
    expect(out).toBe("To be fair, here is the structure.");
  });

  it("leaves a single legitimate opener untouched", () => {
    const single = "Right, so for this grade the band sits at ₹28-32L.";
    expect(tidyRealismArtifacts(single)).toBe(single);
  });

  it("does not strip an opener-looking word that is real content", () => {
    // "Look at the band" / "Right to the point" — no comma/period after
    // the word, so it's content, not a discourse opener.
    const a = "Look at the band before you counter.";
    const b = "Frankly speaking, the band is fixed.";
    expect(tidyRealismArtifacts(a)).toBe(a);
    // "Frankly speaking," is one opener clause → untouched.
    expect(tidyRealismArtifacts(b)).toBe(b);
  });
});

describe("tidyRealismArtifacts — sentence capitalization", () => {
  it("capitalizes the first letter after a sentence-final period", () => {
    expect(tidyRealismArtifacts("okay. what justifies it")).toBe(
      "Okay. What justifies it",
    );
  });

  it("capitalizes after ? and !", () => {
    expect(tidyRealismArtifacts("Is that fair? we can revisit base.")).toBe(
      "Is that fair? We can revisit base.",
    );
  });

  it("capitalizes the very first letter of the utterance", () => {
    expect(tidyRealismArtifacts("structure. actually, let's reset")).toBe(
      "Structure. Actually, let's reset",
    );
  });

  it("does not touch decimals or rupee figures (no space after the dot)", () => {
    const s = "Fixed ₹27L, variable target ₹4.8L on the table.";
    expect(tidyRealismArtifacts(s)).toBe(s);
  });

  it("downcases a discourse word capitalized after a prepended opener comma", () => {
    // Overlay prepended "Right, " in front of base "So for this grade…".
    expect(tidyRealismArtifacts("Right, So for this grade the band is ₹30L.")).toBe(
      "Right, so for this grade the band is ₹30L.",
    );
    expect(tidyRealismArtifacts("To be fair, And how is the split?")).toBe(
      "To be fair, and how is the split?",
    );
  });

  it("never downcases a proper noun or vocative after a comma", () => {
    const a = "Look, Sandeep, take your time on this.";
    const b = "Right, Bangalore is the base location.";
    expect(tidyRealismArtifacts(a)).toBe(a);
    expect(tidyRealismArtifacts(b)).toBe(b);
  });
});

describe("tidyRealismArtifacts — invariants", () => {
  it("is idempotent", () => {
    const garble =
      "In this profitability-first era, honestly, okay. what justifies it";
    const once = tidyRealismArtifacts(garble);
    expect(tidyRealismArtifacts(once)).toBe(once);
  });

  it("is a no-op on empty input", () => {
    expect(tidyRealismArtifacts("")).toBe("");
  });
});
