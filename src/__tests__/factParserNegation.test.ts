/* Family A / OA-B14 — unary-negation guard for the salary fact parser.
 *
 * The number-capture regexes start at the first digit, so a leading minus
 * ("-5 lakhs") was never captured — the sign got silently stripped and the
 * parser stored +5 at HIGH confidence, poisoning every downstream
 * hike/band/score computation. A negative salary is *implausible*, so the
 * fact must be dropped (design: implausible → no fact, never a confident
 * wrong value), not coerced to its positive twin. Guards below confirm the
 * fix is high-precision: legitimate hyphens (ranges, compound words) still
 * parse. */
import { describe, it, expect } from "vitest";
import { parseSalaryFacts } from "../../server-handlers/_fact-parser";

describe("_fact-parser — OA-B14 unary-negation guard", () => {
  it("'-5 lakhs' produces NO fact (was silently stored as +5 @ high)", () => {
    expect(parseSalaryFacts("-5 lakhs")).toHaveLength(0);
  });

  it.each([
    "-5 lakhs",
    "-12 LPA",
    "a pay cut: -3L",
    "the delta is -8 lakh",
    "−22 LPA", // U+2212 minus
    "–15 lakhs", // en-dash used as a sign
  ])("drops negated salary %j", (t) => {
    expect(parseSalaryFacts(t)).toHaveLength(0);
  });

  it("only the negated number is dropped; a sibling positive fact survives", () => {
    const f = parseSalaryFacts("they offered -5 lakhs but I want 40 LPA");
    expect(f).toHaveLength(1);
    expect(f[0].value).toBe(40);
  });

  /* Guards — legitimate hyphens must NOT be swallowed by the negation guard. */
  it("range '22-24 LPA' still produces both bounds (hyphen is a separator)", () => {
    const f = parseSalaryFacts("expecting 22-24 LPA");
    expect(f).toHaveLength(2);
    expect(f.map((x) => x.value)).toEqual([22, 24]);
  });

  it("en-dash range '30–35 LPA' still parses both bounds", () => {
    expect(parseSalaryFacts("30–35 LPA")).toHaveLength(2);
  });

  it("plain positive '5 lakhs' is unaffected", () => {
    const f = parseSalaryFacts("5 lakhs");
    expect(f).toHaveLength(1);
    expect(f[0].value).toBe(5);
  });

  it("a hyphen abutting a word (not a unary sign) does not falsely drop", () => {
    /* "mid-40 LPA" — the hyphen joins "mid" to the number; it is not a
     * unary minus preceded by whitespace, so the fact is retained. */
    const f = parseSalaryFacts("looking mid-40 LPA");
    expect(f).toHaveLength(1);
    expect(f[0].value).toBe(40);
  });
});

/* S29-B1 — Indian comma-format numbers with non-money-cue verb forms
 * (targeting, expecting, wanting). Before the fix, VAGUE_DECADE_MONEY_CUE_RE
 * did not include "targeting"/"expecting" so "I am targeting around 28,00,000"
 * returned [] — the gate guard in substituteAbsoluteRupees rejected the text
 * and the comma-grouped amount was silently dropped. */
describe("_fact-parser — S29-B1 Indian comma-format with target/expect verbs", () => {
  it("'I am currently at 18,50,000' parses to 18.5 LPA (baseline — cue 'currently')", () => {
    const f = parseSalaryFacts("I am currently at 18,50,000 per annum");
    expect(f).toHaveLength(1);
    expect(f[0].value).toBeCloseTo(18.5, 1);
    expect(f[0].confidence).toBe("high");
  });

  it("'I am targeting around 28,00,000' parses to 28 LPA (cue 'targeting')", () => {
    const f = parseSalaryFacts("I am targeting around 28,00,000");
    expect(f).toHaveLength(1);
    expect(f[0].value).toBeCloseTo(28, 1);
  });

  it("'I am expecting 42,00,000' parses to 42 LPA (cue 'expecting')", () => {
    const f = parseSalaryFacts("I am expecting 42,00,000");
    expect(f).toHaveLength(1);
    expect(f[0].value).toBeCloseTo(42, 1);
  });

  it("'looking for 35,00,000 CTC' parses to 35 LPA (cue 'looking for')", () => {
    const f = parseSalaryFacts("looking for 35,00,000 CTC");
    expect(f).toHaveLength(1);
    expect(f[0].value).toBeCloseTo(35, 1);
  });

  it("non-salary sentence with comma-grouped number is left alone", () => {
    /* "he has 1,20,000 followers" has no salary cue — must NOT bind */
    const f = parseSalaryFacts("he has 1,20,000 followers");
    expect(f).toHaveLength(0);
  });
});
