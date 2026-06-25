import { describe, it, expect } from "vitest";
import { sanitizeVoice, sanitizeVoiceValue } from "../../server-handlers/_voice-sanitizer";

/* This is the DETERMINISTIC enforcement layer behind the VOICE_DICTION
 * directive. The 8b "fast" scorer ignores the prompt directive roughly every
 * other generation, leaking "Delve deeper", "Additionally,", "seamless
 * transition" into candidate-facing copy (observed live on staging). These
 * tests lock the guarantee the prompt can't make. */

describe("sanitizeVoice — the delve family (the canonical AI tell)", () => {
  it("rewrites 'Delve deeper into technical details' (the verbatim live leak)", () => {
    expect(sanitizeVoice("Delve deeper into technical details and provide more context."))
      .toBe("Dig deeper into technical details and provide more context.");
  });

  it("handles every delve inflection", () => {
    expect(sanitizeVoice("delve")).toBe("dig");
    expect(sanitizeVoice("delves")).toBe("digs");
    expect(sanitizeVoice("delving")).toBe("digging");
    expect(sanitizeVoice("delved")).toBe("dug");
  });

  it("rewrites 'delving deeper' inside a sentence", () => {
    expect(sanitizeVoice("they could work on delving deeper into the data"))
      .toBe("they could work on digging deeper into the data");
  });
});

describe("sanitizeVoice — preserves capitalization", () => {
  it("uppercases the replacement when the tell was capitalized", () => {
    expect(sanitizeVoice("Utilize the data")).toBe("Use the data");
    expect(sanitizeVoice("Additionally, you should")).toBe("Also, you should");
  });
  it("keeps lowercase when the tell was lowercase", () => {
    expect(sanitizeVoice("you should utilize the data")).toBe("you should use the data");
  });
});

describe("sanitizeVoice — other unambiguous tells", () => {
  it("rewrites the utilize family", () => {
    expect(sanitizeVoice("utilizing")).toBe("using");
    expect(sanitizeVoice("utilized")).toBe("used");
    expect(sanitizeVoice("utilizes")).toBe("uses");
  });
  it("rewrites seamless / seamlessly", () => {
    expect(sanitizeVoice("a seamless transition")).toBe("a smooth transition");
    expect(sanitizeVoice("worked seamlessly")).toBe("worked smoothly");
  });
  it("rewrites deep-dive / dive deep into → dig into", () => {
    expect(sanitizeVoice("deep dive into the metrics")).toBe("dig into the metrics");
    expect(sanitizeVoice("deep-dive into the metrics")).toBe("dig into the metrics");
    expect(sanitizeVoice("dive deep into the metrics")).toBe("dig into the metrics");
  });
  it("rewrites standalone deep-dive → dig deeper", () => {
    expect(sanitizeVoice("you should deep dive")).toBe("you should dig deeper");
  });
  it("rewrites connective openers to 'also'", () => {
    expect(sanitizeVoice("Additionally")).toBe("Also");
    expect(sanitizeVoice("Furthermore")).toBe("Also");
    expect(sanitizeVoice("Moreover")).toBe("Also");
  });
  it("rewrites ideate / facilitate / circle back / world-class", () => {
    expect(sanitizeVoice("ideate")).toBe("brainstorm");
    expect(sanitizeVoice("facilitate")).toBe("help");
    expect(sanitizeVoice("let's circle back")).toBe("let's follow up");
    expect(sanitizeVoice("a world-class team")).toBe("a top team");
  });
});

describe("sanitizeVoice — deliberately conservative (domain words untouched)", () => {
  it("leaves 'leverage' alone (a salary-negotiation competency)", () => {
    const s = "Use your competing offer as leverage when you anchor.";
    expect(sanitizeVoice(s)).toBe(s);
  });
  it("leaves 'robust' / 'scalable' / 'navigate' alone (legit technical vocab)", () => {
    expect(sanitizeVoice("robust testing")).toBe("robust testing");
    expect(sanitizeVoice("a scalable design")).toBe("a scalable design");
    expect(sanitizeVoice("navigate the tradeoffs")).toBe("navigate the tradeoffs");
  });
  it("does not touch substrings of unrelated words", () => {
    // 'also' inside other words, word-boundary safety
    expect(sanitizeVoice("delivered the project")).toBe("delivered the project"); // not 'delve'
    expect(sanitizeVoice("the user")).toBe("the user"); // 'use' boundary safety
  });
  it("returns non-strings unchanged", () => {
    // @ts-expect-error — deliberately exercising the runtime guard
    expect(sanitizeVoice(null)).toBe(null);
    // @ts-expect-error — deliberately exercising the runtime guard
    expect(sanitizeVoice(undefined)).toBe(undefined);
    expect(sanitizeVoice("")).toBe("");
  });
});

describe("sanitizeVoice — em/en dashes become HR-register punctuation", () => {
  it("turns a clause-separator em dash into a comma", () => {
    expect(sanitizeVoice("You anchored well — then conceded too fast.")).toBe(
      "You anchored well, then conceded too fast.",
    );
  });
  it("keeps a number range as a hyphen, not a comma", () => {
    expect(sanitizeVoice("The band was 53–58 LPA for this grade.")).toBe(
      "The band was 53-58 LPA for this grade.",
    );
  });
  it("composes with a word swap on the same string", () => {
    expect(sanitizeVoice("Delve deeper — utilize the data.")).toBe("Dig deeper, use the data.");
  });
});

describe("sanitizeVoiceValue — deep walk over evaluation/report shapes", () => {
  it("sanitizes strings at any depth, preserving structure and non-strings", () => {
    const report = {
      overallScore: 85,
      verdict: "Delve deeper into the numbers.",
      strengths: ["You utilize examples well.", "Confident delivery."],
      idealAnswers: [{ ideal: "We ensured a seamless transition.", rating: "strong", starBreakdown: { situation: "present" } }],
      starPresence: { S: true, R: false },
    };
    const cleaned = sanitizeVoiceValue(report) as typeof report;
    expect(cleaned.overallScore).toBe(85);
    expect(cleaned.verdict).toBe("Dig deeper into the numbers.");
    expect(cleaned.strengths[0]).toBe("You use examples well.");
    expect(cleaned.idealAnswers[0].ideal).toBe("We ensured a smooth transition.");
    expect(cleaned.idealAnswers[0].rating).toBe("strong");
    expect(cleaned.idealAnswers[0].starBreakdown.situation).toBe("present");
    expect(cleaned.starPresence).toEqual({ S: true, R: false });
  });

  it("does not mutate the input object", () => {
    const input = { verdict: "Delve in." };
    sanitizeVoiceValue(input);
    expect(input.verdict).toBe("Delve in.");
  });
});
