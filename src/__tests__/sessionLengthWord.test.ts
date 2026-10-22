import { describe, it, expect } from "vitest";
import { sessionMinutesWord } from "../../data/session-length";

describe("sessionMinutesWord", () => {
  it("promises the real length of the session, not a fixed 25 minutes", () => {
    expect(sessionMinutesWord("Behavioral", false)).toBe("fifteen");
    expect(sessionMinutesWord("Case Study", false)).toBe("twenty-five");
    expect(sessionMinutesWord("Behavioral", true)).toBe("ten");
    expect(sessionMinutesWord("unknown focus", false)).toBe("fifteen");
  });
});
