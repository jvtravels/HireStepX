/* STT fragility corpus — broad sweep follow-up to commit f5289f3.
 *
 * The LPE fix landed in two parsers; this corpus parametrizes realistic
 * Indian-candidate STT outputs across the nine systematic fragility
 * categories the audit identified, and asserts that the
 * `parseCandidateAnswer` kernel entry point binds the expected fact
 * regardless of which transcription artifact slipped through.
 *
 * Each case represents a real failure shape:
 *   parser returns null/[] → kernel sees no disclosure → planner
 *   loops or static-closes → candidate experiences a ghosted session.
 *
 * Fragility categories covered:
 *   1. Unit-suffix typos              LPE / LPI / LPS / lacks / lax / krore
 *   2. Word numbers vs digits         "thirty six lakh"
 *   3. Spelled-out compounds          "three lakh seventy thousand"
 *   4. Hindi numeral code-switch      "tees lakh", "ek crore"
 *   5. Letter-spelled units           "L P A" / "L-P-A"
 *   6. Hyphenation drift              "one year cliff" / "1 yr cliff"
 *   7. Decimal markers                "thirty point five LPA"
 *   8. Lakhs ambiguity                "3.6 L" / "three point six lakh"
 *   9. Range markers                  "30 to 50 LPA"
 *
 * The fix is the normalizer wired at `applyCandidateAnswer` /
 * `parseCandidateAnswer` entry (see `_speech-normalize.ts`).
 */

import { describe, it, expect } from "vitest";
import { parseCandidateAnswer } from "../../../server-handlers/_negotiation-kernel";
import { normalizeForParsing } from "../../../server-handlers/_speech-normalize";

/* Helper: full kernel-side parse with realistic context. */
function parseWithCtcAsk(text: string) {
  return parseCandidateAnswer(text, "what's your current CTC?", "opening", false, 1, null);
}
function parseWithExpectAsk(text: string) {
  return parseCandidateAnswer(text, "what's your expected CTC?", "opening", false, 1, null);
}

describe("STT fragility corpus — category 1: unit-suffix STT typos", () => {
  it("'36 LPE' → currentCtc=36 (regression guard for f5289f3)", () => {
    expect(parseWithCtcAsk("my current CTC is 36 LPE").currentCtc).toBe(36);
  });
  it("'36 LPI' → currentCtc=36", () => {
    expect(parseWithCtcAsk("currently at 36 LPI").currentCtc).toBe(36);
  });
  it("'36 LPS' → currentCtc=36", () => {
    expect(parseWithCtcAsk("my CTC is 36 LPS").currentCtc).toBe(36);
  });
  it("'36 lacks' → currentCtc=36 (lakh STT mishear)", () => {
    expect(parseWithCtcAsk("currently 36 lacks").currentCtc).toBe(36);
  });
  it("'36 lax' → currentCtc=36", () => {
    expect(parseWithCtcAsk("I make 36 lax").currentCtc).toBe(36);
  });
  it("'1 krore' → currentCtc=100 (crore mishear)", () => {
    expect(parseWithCtcAsk("currently at 1 krore").currentCtc).toBe(100);
  });
});

describe("STT fragility corpus — category 2: English number words", () => {
  it("'thirty six LPA' → currentCtc=36", () => {
    expect(parseWithCtcAsk("my current CTC is thirty six LPA").currentCtc).toBe(36);
  });
  it("'thirty-six lakhs' → currentCtc=36", () => {
    expect(parseWithCtcAsk("I am currently making thirty-six lakhs").currentCtc).toBe(36);
  });
  it("'fifty LPA' as target → target=50", () => {
    expect(parseWithExpectAsk("expecting fifty LPA").target).toBe(50);
  });
  it("'eighteen LPA expecting twenty-eight LPA' → current=18, target=28", () => {
    const r = parseCandidateAnswer(
      "current is eighteen LPA, expecting twenty-eight LPA",
      "what's your CTC and target?", "opening", false, 1, null);
    expect(r.currentCtc).toBe(18);
    expect(r.target).toBe(28);
  });
});

describe("STT fragility corpus — category 3: spelled-out crore", () => {
  it("'one crore' → target=100 (after expect-ask)", () => {
    expect(parseWithExpectAsk("expecting one crore").target).toBe(100);
  });
  it("'two lakh joining bonus' → joiningBonusAsk parsed", () => {
    const r = parseCandidateAnswer(
      "joining bonus should be two lakh",
      "any joining bonus ask?", "opening", false, 1, null);
    /* Two lakh => 2 LPA-units; parser stores in joiningBonusAsk
     * (clampInr keeps it). */
    expect(r.noticeJoining.joiningBonusAsk).not.toBeNull();
  });
});

describe("STT fragility corpus — category 4: Hindi numerals / code-switch", () => {
  it("'tees lakh' → currentCtc=30", () => {
    expect(parseWithCtcAsk("current ka CTC tees lakh hai").currentCtc).toBe(30);
  });
  it("'pachaas LPA' → target=50 (expect-ask)", () => {
    expect(parseWithExpectAsk("pachaas LPA chahiye").target).toBe(50);
  });
  it("'ek crore' → target=100", () => {
    expect(parseWithExpectAsk("expecting ek crore").target).toBe(100);
  });
  it("'paanch lakh' joining bonus", () => {
    const r = parseCandidateAnswer(
      "joining bonus paanch lakh",
      "joining bonus?", "opening", false, 1, null);
    expect(r.noticeJoining.joiningBonusAsk).not.toBeNull();
  });
});

describe("STT fragility corpus — category 5: letter-spelled units", () => {
  it("'36 L P A' → currentCtc=36", () => {
    expect(parseWithCtcAsk("my CTC is 36 L P A").currentCtc).toBe(36);
  });
  it("'36 L-P-A' → currentCtc=36", () => {
    expect(parseWithCtcAsk("36 L-P-A current").currentCtc).toBe(36);
  });
  it("'thirty six el pee ay' → currentCtc=36", () => {
    expect(parseWithCtcAsk("currently thirty six el pee ay").currentCtc).toBe(36);
  });
});

describe("STT fragility corpus — category 6: hyphenation drift (cliff/notice/years)", () => {
  it("'one year cliff' parses as cliffMonths=12", () => {
    const r = parseCandidateAnswer(
      "RSU vesting has one year cliff",
      "what's the equity preference?", "opening", false, 1, null);
    expect(r.equityVesting.cliffMonths).toBe(12);
  });
  it("'1 yr cliff' parses as cliffMonths=12", () => {
    const r = parseCandidateAnswer(
      "vesting is 1 yr cliff",
      "what's the equity preference?", "opening", false, 1, null);
    expect(r.equityVesting.cliffMonths).toBe(12);
  });
  it("'two months notice' parses to noticePeriodDays=60", () => {
    const r = parseCandidateAnswer(
      "I have two months notice",
      "what's your notice?", "opening", false, 1, null);
    expect(r.noticeJoining.noticePeriodDays).toBe(60);
  });
  it("'60 days notice' parses to noticePeriodDays=60", () => {
    const r = parseCandidateAnswer(
      "60 days notice period",
      "what's your notice?", "opening", false, 1, null);
    expect(r.noticeJoining.noticePeriodDays).toBe(60);
  });
});

describe("STT fragility corpus — category 7: decimal markers", () => {
  it("'thirty point five LPA' → currentCtc=30.5", () => {
    expect(parseWithCtcAsk("currently thirty point five LPA").currentCtc).toBe(30.5);
  });
  it("'30 point 5 LPA' → currentCtc=30.5", () => {
    expect(parseWithCtcAsk("my CTC is 30 point 5 LPA").currentCtc).toBe(30.5);
  });
  it("'30.5 LPA' → currentCtc=30.5 (digit baseline)", () => {
    expect(parseWithCtcAsk("currently at 30.5 LPA").currentCtc).toBe(30.5);
  });
});

describe("STT fragility corpus — category 8: lakhs ambiguity (decimal + lakh unit)", () => {
  it("'3.6 L' joining bonus → parsed", () => {
    const r = parseCandidateAnswer(
      "joining bonus is 3.6 L",
      "joining bonus?", "opening", false, 1, null);
    expect(r.noticeJoining.joiningBonusAsk).not.toBeNull();
  });
  it("'three point six lakh' joining bonus → parsed", () => {
    const r = parseCandidateAnswer(
      "joining bonus three point six lakh",
      "joining bonus?", "opening", false, 1, null);
    expect(r.noticeJoining.joiningBonusAsk).not.toBeNull();
  });
});

describe("STT fragility corpus — category 9: range markers", () => {
  it("'30 to 50 LPA' as range → targetAsRange=true, target=50 (upper)", () => {
    const r = parseWithExpectAsk("expecting 30 to 50 LPA range");
    expect(r.target).toBe(50);
    expect(r.targetAsRange).toBe(true);
  });
  it("'thirty to fifty LPA' as range → targetAsRange=true, target=50", () => {
    const r = parseWithExpectAsk("expecting thirty to fifty LPA");
    expect(r.target).toBe(50);
    expect(r.targetAsRange).toBe(true);
  });
  it("'30-50 LPA' as range → target=50", () => {
    const r = parseWithExpectAsk("looking for 30-50 LPA");
    expect(r.target).toBe(50);
    expect(r.targetAsRange).toBe(true);
  });
});

describe("STT fragility — normalizer is idempotent (safety)", () => {
  it("runs twice == runs once", () => {
    const inputs = [
      "my current CTC is thirty six LPE",
      "tees lakh chahiye",
      "thirty point five LPA",
      "expecting ek crore",
      "36 L P A current",
      "joining bonus paanch lakh",
    ];
    for (const i of inputs) {
      const once = normalizeForParsing(i);
      const twice = normalizeForParsing(once);
      expect(twice).toBe(once);
    }
  });
});

describe("STT fragility — normalizer is conservative (no spurious rewrites)", () => {
  it("'I have a point to make' is unchanged", () => {
    /* "point" must not fold unless surrounded by digits. */
    expect(normalizeForParsing("I have a point to make")).toBe("I have a point to make");
  });
  it("non-numeric 'lax' / 'lacks' without digit context is unchanged", () => {
    /* "the project lacks polish" must not become "the project lakh polish". */
    expect(normalizeForParsing("the project lacks polish")).toBe("the project lacks polish");
  });
  it("'point taken' alone is unchanged", () => {
    expect(normalizeForParsing("good point taken")).toBe("good point taken");
  });
});
