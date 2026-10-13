import { describe, it, expect } from "vitest";
import { displaySessionCount, MIN_PUBLIC_SESSION_COUNT } from "../../server-handlers/_platform-stats-helpers";

describe("displaySessionCount", () => {
  it("hides small real counts instead of flooring them up", () => {
    expect(displaySessionCount(0)).toBeNull();
    expect(displaySessionCount(3)).toBeNull();
    expect(displaySessionCount(MIN_PUBLIC_SESSION_COUNT - 1)).toBeNull();
  });
  it("floors to the nearest 10 once past the threshold", () => {
    expect(displaySessionCount(100)).toBe(100);
    expect(displaySessionCount(1234)).toBe(1230);
  });
  it("rejects non-finite input", () => {
    expect(displaySessionCount(NaN)).toBeNull();
  });
});
