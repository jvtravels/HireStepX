import { describe, expect, it } from "vitest";
import { band } from "../sessionReport/panels/sr-ProgressTrendPanel";

describe("band", () => {
  it("matches the shared score bands", () => {
    expect(band(85).label).toBe("Strong");
    expect(band(75).label).toBe("Good");
    expect(band(74).label).toBe("Needs work");
    expect(band(74).weak).toBe(true);
    expect(band(75).weak).toBe(false);
  });
});
