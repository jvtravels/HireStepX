import { describe, expect, it } from "vitest";
import { asContactRequestFields, joinFieldLabels } from "../../server-handlers/_employer-contact-request-helpers";

describe("asContactRequestFields", () => {
  it("accepts known fields and dedupes", () => {
    expect(asContactRequestFields(["phone", "email", "phone"])).toEqual(["phone", "email"]);
  });
  it.each([[undefined], ["phone"], [[]], [["phone", "ssn"]], [[1]]])("rejects %j", (v) => {
    expect(asContactRequestFields(v)).toBeNull();
  });
});

describe("hiring fields", () => {
  it("are accepted alongside contact fields", () => {
    expect(asContactRequestFields(["notice_period", "phone", "expected_ctc"])).toEqual(["notice_period", "phone", "expected_ctc"]);
  });
  it("read naturally in the candidate-facing wording", () => {
    expect(joinFieldLabels(["expected_ctc", "notice_period", "current_ctc"])).toBe("notice period, current CTC and expected CTC");
  });
});

describe("joinFieldLabels", () => {
  it("joins in canonical order regardless of input order", () => {
    expect(joinFieldLabels(["portfolio", "phone"])).toBe("phone number and portfolio or GitHub link");
  });
  it("uses commas then 'and' for three or more", () => {
    expect(joinFieldLabels(["phone", "email", "linkedin"])).toBe("phone number, email address and LinkedIn profile");
  });
  it("returns a single label unchanged", () => {
    expect(joinFieldLabels(["email"])).toBe("email address");
  });
});
