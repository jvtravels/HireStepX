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

  it("downcases a wh-interrogative capitalized after a prepended mood tic", () => {
    /* #122 (2026-06-21, live staging) — the frantic-mood humanizer prepended
     * a tic ("Honestly, ") in front of a probe body that opens with a
     * wh-interrogative, shipping a capital after the comma: "Honestly, What
     * fitment were you expecting for this role?" (live Flipkart EM). The
     * wh-words (What/Why/How/Which/Who) are a CLOSED grammatical class and,
     * mid-sentence after a discourse-opener comma, are never proper nouns —
     * so they downcase like any other glued opener. */
    expect(
      tidyRealismArtifacts("Honestly, What fitment were you expecting for this role?"),
    ).toBe("Honestly, what fitment were you expecting for this role?");
    expect(tidyRealismArtifacts("Look, Why is the band capped there?")).toBe(
      "Look, why is the band capped there?",
    );
    expect(tidyRealismArtifacts("Right, Which component are you weighing?")).toBe(
      "Right, which component are you weighing?",
    );
    /* But a wh-word after a PERIOD (real sentence start) stays capitalized. */
    expect(tidyRealismArtifacts("Got it. What were you expecting?")).toBe(
      "Got it. What were you expecting?",
    );
  });

  it("downcases an imperative 'Let's' glued after a context-ref clause comma", () => {
    /* Live-staging (2026-06-19) — the LLM restyle re-glued a sector
     * context-ref clause onto the discovery probe and kept the next word
     * capitalized: "After the down-round corrections, Let's start with your
     * current side — what's the total CTC at present?". The restyle path now
     * runs the same output contract as canonical; "Let's" (a contraction of
     * "let us", never a proper noun) downcases mid-sentence after the comma. */
    expect(
      tidyRealismArtifacts(
        "After the down-round corrections, Let's start with your current side — what's the total CTC at present?",
      ),
    ).toBe(
      "After the down-round corrections, let's start with your current side — what's the total CTC at present?",
    );
    /* But a sentence-initial 'Let' after a PERIOD stays capitalized. */
    expect(
      tidyRealismArtifacts("I can stretch to ₹26L fixed. Let me check with finance."),
    ).toBe("I can stretch to ₹26L fixed. Let me check with finance.");
  });

  it("never downcases a proper noun or vocative after a comma", () => {
    const a = "Look, Sandeep, take your time on this.";
    const b = "Right, Bangalore is the base location.";
    expect(tidyRealismArtifacts(a)).toBe(a);
    expect(tidyRealismArtifacts(b)).toBe(b);
  });

  it("preserves the sentence boundary when collapsing openers across a period", () => {
    /* Adversarial-sweep regression (2026-06-19, PDF#27 T6) — when two
     * stacked openers are separated by a PERIOD ("Right, got it. What…"),
     * collapsing them must keep the content a clean sentence
     * ("Right. What…"), NOT glue a capitalized content word onto a comma
     * ("Right, What…"). The comma-glued form reads as a declarative
     * fragment + question and trips the response-pipeline validator's
     * `declarative-plus-question-mark` reject. Surfaced once tidy began
     * running on default-persona sessions (the humanizer prepends tics
     * unconditionally, independent of sector persona). */
    expect(
      tidyRealismArtifacts("Right, got it. What fitment were you expecting for this role?"),
    ).toBe("Right. What fitment were you expecting for this role?");
    /* Comma-joined openers still collapse with a comma (no false period). */
    expect(tidyRealismArtifacts("Okay, sure, the band is ₹30L.")).toBe(
      "Okay, the band is ₹30L.",
    );
  });
});

describe("tidyRealismArtifacts — frantic-tic stack + subordinator seam (live 2026-06-19)", () => {
  /* Live-staging stonewall probe: the mood layer's frantic pause tic
   * ("Umm,") stacked in front of an opener + a "Before we go further…"
   * probe, and shipped TWO leading fillers with a broken mid-sentence
   * capital: "Umm, so, Before we go further, can you share your current
   * CTC — fixed, variable, and in-hand?". Two root causes: (1) FRANTIC_TICS
   * were missing from the stacked-opener collapse union, so the collapse
   * bailed at "Umm,"; (2) "Before" was not in the mid-sentence downcase
   * whitelist. Both fixed structurally. */
  it("collapses a frantic tic + opener and downcases the subordinator", () => {
    expect(
      tidyRealismArtifacts(
        "Umm, so, Before we go further, can you share your current CTC — fixed, variable, and in-hand?",
      ),
    ).toBe(
      "Umm, before we go further, can you share your current CTC — fixed, variable, and in-hand?",
    );
  });

  it("collapses 'Uh,' frantic tic the same way", () => {
    expect(tidyRealismArtifacts("Uh, look, here is the structure.")).toBe(
      "Uh, here is the structure.",
    );
  });

  it("downcases each whitelisted subordinator after a leading opener comma", () => {
    expect(tidyRealismArtifacts("Right, Before we counter, what's your number?")).toBe(
      "Right, before we counter, what's your number?",
    );
    expect(tidyRealismArtifacts("Look, Since you asked, the band is ₹30L.")).toBe(
      "Look, since you asked, the band is ₹30L.",
    );
    expect(tidyRealismArtifacts("Okay, Once finance signs off, we revert.")).toBe(
      "Okay, once finance signs off, we revert.",
    );
  });

  it("still never downcases a proper noun after the expanded whitelist", () => {
    // Regression guard: extending the whitelist must NOT touch proper nouns.
    expect(tidyRealismArtifacts("Right, Bangalore is the base location.")).toBe(
      "Right, Bangalore is the base location.",
    );
    expect(tidyRealismArtifacts("Look, Sandeep, take your time on this.")).toBe(
      "Look, Sandeep, take your time on this.",
    );
  });
});

describe("tidyRealismArtifacts — persona-tic-signature bank stack (live dice sweep 2026-06-19)", () => {
  /* The humanizer runs a SECOND, independent tic layer
   * (`applyPersonaTicSignature`) whose bank includes "see", "actually",
   * "right, right" and the Hinglish "ya so" / "ek minute". Those tokens
   * were absent from the stacked-opener collapse union, so a signature tic
   * stacked in front of a humanizer opener shipped TWO/THREE leading
   * fillers ("See, okay. So for this grade…", "Honestly, see, noted…").
   * Wiring the bank into the union closes the gap — same closed-class
   * rationale as the frantic tics. */
  it("collapses a 'See,' signature tic stacked on an opener (period seam)", () => {
    expect(
      tidyRealismArtifacts(
        "See, okay. So for this grade, the fitment we're able to offer is ₹40 LPA.",
      ),
    ).toBe("See. So for this grade, the fitment we're able to offer is ₹40 LPA.");
  });

  it("collapses a 'See,' tic stacked on an opener (comma seam)", () => {
    expect(
      tidyRealismArtifacts("See, so, before we go further, can you share your current CTC?"),
    ).toBe("See, before we go further, can you share your current CTC?");
  });

  it("collapses a mid-stack 'see' signature tic to the first opener", () => {
    expect(
      tidyRealismArtifacts("Honestly, see, noted on the expected fitment — let's continue."),
    ).toBe("Honestly, noted on the expected fitment — let's continue.");
  });

  it("collapses the doubled-word 'right, right' tic to a single opener", () => {
    // "right, right" is a stutter tic in CASUAL_TICS, but the ≤1-filler
    // contract neutralizes it: the bare "right" opener matches twice and
    // collapses to a single "Right,". (The MVP fluency battery flags
    // "Right, right." as a stacked-opener violation, so it must NOT survive
    // — registering "right, right" as one union phrase is explicitly
    // avoided to preserve this collapse.)
    expect(
      tidyRealismArtifacts(
        "Right, right, let's start with your current side — what's the total CTC at present?",
      ),
    ).toBe("Right, let's start with your current side — what's the total CTC at present?");
  });
});

describe("tidyRealismArtifacts — clausal-opener fragment re-join (live 2026-06-19)", () => {
  /* Live-staging close run: the LLM restyle terminated a leading sector
   * context-ref clause with a PERIOD, orphaning it as a fragment —
   * "After the down-round corrections. Let's start with your current side…".
   * A subordinate/adverbial lead-in demands continuation, so it re-joins to
   * the following clause with a comma + downcased resumed word. The short
   * interjection acks ("Right." / "Okay.") are NOT clausal and must keep the
   * deliberate period form. */
  it("re-joins a sector context-ref clause fragment to the following clause", () => {
    expect(
      tidyRealismArtifacts(
        "After the down-round corrections. Let's start with your current side — what's the total CTC at present?",
      ),
    ).toBe(
      "After the down-round corrections, let's start with your current side — what's the total CTC at present?",
    );
  });

  it("re-joins an 'In this … era' context-ref fragment and downcases the resumed word", () => {
    expect(
      tidyRealismArtifacts("In this profitability-first era. What justifies the bump?"),
    ).toBe("In this profitability-first era, what justifies the bump?");
  });

  it("re-joins a 'To be fair' adverbial fragment", () => {
    expect(
      tidyRealismArtifacts("To be fair. 60 days is a long runway — any flexibility on that?"),
    ).toBe("To be fair, 60 days is a long runway — any flexibility on that?");
  });

  it("keeps 'I' capitalized when the resumed clause is first-person", () => {
    expect(
      tidyRealismArtifacts("With the H1B uncertainty. I'll have a firmer number once the panel signs off."),
    ).toBe("With the H1B uncertainty, I'll have a firmer number once the panel signs off.");
  });

  it("does NOT touch the deliberate period form of short interjection acks", () => {
    // These are complete utterances, not fragments — the period stays.
    expect(tidyRealismArtifacts("Right. What fitment were you expecting for this role?")).toBe(
      "Right. What fitment were you expecting for this role?",
    );
    expect(tidyRealismArtifacts("Okay. 60 days is a long runway.")).toBe(
      "Okay. 60 days is a long runway.",
    );
  });

  it("is a no-op when the context-ref clause is already comma-joined", () => {
    const ok = "After the down-round corrections, let's start with your current side.";
    expect(tidyRealismArtifacts(ok)).toBe(ok);
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
