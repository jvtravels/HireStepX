import { describe, it, expect } from "vitest";
import { detectContactInfoFlag, redactContactInfo, CONTACT_REDACTION_MARK } from "../../server-handlers/_messages-helpers";

describe("contact redaction bypasses", () => {
  const cases: Array<[string, string]> = [
    ["underscore separators", "call 9_8_7_6_5_4_3_2_1_0"],
    ["slash separators", "9/8/7/6/5/4/3/2/1/0 is me"],
    ["Devanagari digits", "मेरा नंबर ९८७६५४३२१०"],
    ["zero-width characters", "98765​43210"],
    ["fullwidth digits", "９８７６５４３２１０"],
    ["Hindi digit words", "nau aath saat chhe paanch char teen do ek shunya"],
    ["double words", "nine eight double seven six five four three"],
    ["bare at with a real dot", "mail john at gmail.com please"],
    ["mixed obfuscated email", "john (at) gmail dot com"],
  ];
  for (const [name, text] of cases) {
    it(`detects and redacts: ${name}`, () => {
      expect(detectContactInfoFlag(text)).not.toBeNull();
      const out = redactContactInfo(text);
      expect(out.redacted).toBe(true);
      expect(out.text).toContain(CONTACT_REDACTION_MARK);
      expect(detectContactInfoFlag(out.text)).toBeNull();
    });
  }

  it("leaves ordinary text and lakh-formatted salaries alone", () => {
    for (const t of ["I can join in 30 days", "CTC is 9,00,000 per year", "Let's talk at 5 pm, one or two rounds", "see you @ 5. Thanks"]) {
      expect(redactContactInfo(t).redacted).toBe(false);
    }
  });
});
