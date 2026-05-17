/* Unit tests for the shared resume-period parser.
 *
 * Both campus-placement and hr-round analyzers feed real resume
 * `period` strings into parseResumePeriod / parsePeriodMonths to
 * cross-check what the candidate said in the interview against what
 * the resume claims. A regex regression here silently breaks BGV-risk
 * detection in BOTH analyzers — exactly the kind of fragility the
 * ground-truth fixtures don't isolate.
 *
 * Coverage targets the edge cases that show up in real Indian fresher
 * resumes: en-dashes from PDF→text extraction, "Present", apostrophe-
 * year shorthand ("Jan'23"), and the spoken NUM_WORDS map used by the
 * internship-duration cross-check.
 */

import { describe, it, expect } from "vitest";
import {
  parseResumePeriod,
  parsePeriodMonths,
  NUM_WORDS,
  SPOKEN_DURATION_REGEX,
  MONTHS,
} from "../../server-handlers/_resume-period";

describe("parseResumePeriod", () => {
  it("parses standard month-year hyphen range", () => {
    const r = parseResumePeriod("Jan 2022 - Jun 2024");
    expect(r).not.toBeNull();
    expect(r!.start.getFullYear()).toBe(2022);
    expect(r!.start.getMonth()).toBe(0);
    expect(r!.end.getFullYear()).toBe(2024);
    expect(r!.end.getMonth()).toBe(5);
  });

  it("normalizes en-dash and em-dash to hyphen (PDF extraction artifact)", () => {
    expect(parseResumePeriod("Mar 2022 – Dec 2023")).not.toBeNull();
    expect(parseResumePeriod("Mar 2022 — Dec 2023")).not.toBeNull();
  });

  it("accepts ' to ' as a range separator", () => {
    const r = parseResumePeriod("Apr 2023 to Sep 2023");
    expect(r).not.toBeNull();
    expect(r!.start.getMonth()).toBe(3);
    expect(r!.end.getMonth()).toBe(8);
  });

  it("expands apostrophe-2-digit years (Jan'23 → Jan 2023)", () => {
    const r = parseResumePeriod("Jan'23 - Mar'24");
    expect(r).not.toBeNull();
    expect(r!.start.getFullYear()).toBe(2023);
    expect(r!.end.getFullYear()).toBe(2024);
  });

  it("uses 50-cutoff for two-digit years (≥50 → 19xx)", () => {
    const r = parseResumePeriod("Jan'95 - Mar'99");
    expect(r).not.toBeNull();
    expect(r!.start.getFullYear()).toBe(1995);
    expect(r!.end.getFullYear()).toBe(1999);
  });

  it("treats present/current/ongoing as today", () => {
    const today = Date.now();
    for (const word of ["present", "current", "now", "ongoing", "till date"]) {
      const r = parseResumePeriod(`Jan 2024 - ${word}`);
      expect(r, `failed on "${word}"`).not.toBeNull();
      // End within a few seconds of now
      expect(Math.abs(r!.end.getTime() - today)).toBeLessThan(5_000);
    }
  });

  it("returns null on null/undefined/empty/single-token input", () => {
    expect(parseResumePeriod(null)).toBeNull();
    expect(parseResumePeriod(undefined)).toBeNull();
    expect(parseResumePeriod("")).toBeNull();
    expect(parseResumePeriod("2022")).toBeNull();
    expect(parseResumePeriod("Jan 2022")).toBeNull();
  });

  it("returns null when end is before start (corrupted input)", () => {
    expect(parseResumePeriod("Jan 2024 - Jan 2023")).toBeNull();
  });

  it("rejects pre-1990 / post-2100 years (safety cutoff)", () => {
    expect(parseResumePeriod("Jan 1980 - Mar 1985")).toBeNull();
    expect(parseResumePeriod("Jan 2200 - Mar 2210")).toBeNull();
  });

  it("accepts bare-year range (defaults to Jan / Dec)", () => {
    const r = parseResumePeriod("2022 - 2024");
    expect(r).not.toBeNull();
    expect(r!.start.getMonth()).toBe(0);
    expect(r!.end.getMonth()).toBe(11);
  });

  it("accepts long month spellings (september, february)", () => {
    const r = parseResumePeriod("september 2022 - february 2023");
    expect(r).not.toBeNull();
    expect(r!.start.getMonth()).toBe(8);
    expect(r!.end.getMonth()).toBe(1);
  });
});

describe("parsePeriodMonths", () => {
  it("returns months elapsed (rounded, min 1)", () => {
    const m = parsePeriodMonths("Jan 2023 - Jun 2023");
    expect(m).toBeGreaterThanOrEqual(5);
    expect(m).toBeLessThanOrEqual(6);
  });

  it("returns 1 for a single-month period (rounding floor)", () => {
    const m = parsePeriodMonths("Jan 2023 - Jan 2023");
    expect(m).toBe(1);
  });

  it("returns null when underlying parse fails", () => {
    expect(parsePeriodMonths("not a period")).toBeNull();
    expect(parsePeriodMonths(null)).toBeNull();
  });

  it("handles year-spanning periods", () => {
    const m = parsePeriodMonths("Jan 2022 - Jan 2024");
    expect(m).toBeGreaterThanOrEqual(23);
    expect(m).toBeLessThanOrEqual(25);
  });
});

describe("NUM_WORDS + SPOKEN_DURATION_REGEX", () => {
  it("NUM_WORDS covers one through twelve", () => {
    expect(NUM_WORDS.one).toBe(1);
    expect(NUM_WORDS.six).toBe(6);
    expect(NUM_WORDS.twelve).toBe(12);
  });

  it("regex captures digit + unit (8 months)", () => {
    SPOKEN_DURATION_REGEX.lastIndex = 0;
    const m = SPOKEN_DURATION_REGEX.exec("I worked there for 8 months last year");
    expect(m).not.toBeNull();
    expect(m![1]).toBe("8");
    expect(m![2]).toBe("months");
  });

  it("regex captures spelled-out word + unit (six months)", () => {
    SPOKEN_DURATION_REGEX.lastIndex = 0;
    const m = SPOKEN_DURATION_REGEX.exec("internship for six months at razorpay");
    expect(m).not.toBeNull();
    expect(m![1].toLowerCase()).toBe("six");
    expect(m![2]).toBe("months");
  });

  it("regex captures years unit (two years)", () => {
    SPOKEN_DURATION_REGEX.lastIndex = 0;
    const m = SPOKEN_DURATION_REGEX.exec("I worked there for two years");
    expect(m).not.toBeNull();
    expect(m![1].toLowerCase()).toBe("two");
    expect(m![2]).toBe("years");
  });

  it("regex tolerates filler words (about, around, roughly)", () => {
    for (const filler of ["about", "around", "roughly", "nearly"]) {
      SPOKEN_DURATION_REGEX.lastIndex = 0;
      const m = SPOKEN_DURATION_REGEX.exec(`worked there ${filler} 5 months`);
      expect(m, `failed on "${filler}"`).not.toBeNull();
    }
  });
});

describe("MONTHS map", () => {
  it("covers 3-char + full + sept variants", () => {
    expect(MONTHS.jan).toBe(0);
    expect(MONTHS.january).toBe(0);
    expect(MONTHS.sept).toBe(8);
    expect(MONTHS.september).toBe(8);
    expect(MONTHS.dec).toBe(11);
  });
});
