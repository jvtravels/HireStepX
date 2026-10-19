import { describe, it, expect } from "vitest";
import { maskLockedPostingText } from "../../server-handlers/_candidate-request-helpers";

const acme = { company_name: "Acme Robotics", website: "https://www.acmerobotics.com/careers" };

describe("maskLockedPostingText", () => {
  it("masks the company name and website host, case-insensitively", () => {
    const out = maskLockedPostingText("Join ACME robotics. Visit acmerobotics.com today.", acme) ?? "";
    expect(out).not.toMatch(/acme/i);
    expect(out).toContain("the company");
  });

  it("masks contact details in the posting", () => {
    const out = maskLockedPostingText("Send your CV to hr@somewhere.in or call 9876543210", acme) ?? "";
    expect(out).not.toContain("hr@somewhere.in");
    expect(out).not.toContain("9876543210");
  });

  it("leaves ordinary text alone and passes through empty values", () => {
    expect(maskLockedPostingText("Build APIs in Node and Postgres", acme)).toBe("Build APIs in Node and Postgres");
    expect(maskLockedPostingText("", acme)).toBe("");
    expect(maskLockedPostingText(null, acme)).toBeNull();
    expect(maskLockedPostingText("Hello", null)).toBe("Hello");
  });

  it("does not treat a very short company name as a needle", () => {
    expect(maskLockedPostingText("We use AI daily", { company_name: "AI" })).toBe("We use AI daily");
  });

  it("escapes regex metacharacters in the name", () => {
    expect(maskLockedPostingText("Work at C++ (Labs) Inc.", { company_name: "C++ (Labs) Inc." })).toBe("Work at the company");
  });
});
