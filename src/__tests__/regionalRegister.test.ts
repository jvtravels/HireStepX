import { describe, it, expect } from "vitest";
import {
  detectRegionFromCity,
  detectRegionFromText,
  hasRegionalSignal,
} from "../_regional-register";

describe("detectRegionFromCity", () => {
  it("detects Bangalore from common spellings", () => {
    expect(detectRegionFromCity("Bangalore").region).toBe("bangalore");
    expect(detectRegionFromCity("Bengaluru").region).toBe("bangalore");
    expect(detectRegionFromCity("Whitefield, BLR").region).toBe("bangalore");
    expect(detectRegionFromCity("Koramangala").region).toBe("bangalore");
  });

  it("detects Delhi NCR from Gurgaon / Noida", () => {
    expect(detectRegionFromCity("Gurgaon").region).toBe("delhi-ncr");
    expect(detectRegionFromCity("Gurugram").region).toBe("delhi-ncr");
    expect(detectRegionFromCity("Noida").region).toBe("delhi-ncr");
    expect(detectRegionFromCity("New Delhi").region).toBe("delhi-ncr");
    expect(detectRegionFromCity("DLF Cyber Hub").region).toBe("delhi-ncr");
  });

  it("detects Mumbai / Pune corridor", () => {
    expect(detectRegionFromCity("Mumbai").region).toBe("mumbai-pune");
    expect(detectRegionFromCity("Pune").region).toBe("mumbai-pune");
    expect(detectRegionFromCity("BKC").region).toBe("mumbai-pune");
    expect(detectRegionFromCity("Hinjewadi").region).toBe("mumbai-pune");
  });

  it("detects Hyderabad", () => {
    expect(detectRegionFromCity("Hyderabad").region).toBe("hyderabad");
    expect(detectRegionFromCity("HITEC City").region).toBe("hyderabad");
    expect(detectRegionFromCity("Gachibowli").region).toBe("hyderabad");
  });

  it("detects Chennai", () => {
    expect(detectRegionFromCity("Chennai").region).toBe("chennai");
    expect(detectRegionFromCity("Madras").region).toBe("chennai");
    expect(detectRegionFromCity("OMR").region).toBe("chennai");
    expect(detectRegionFromCity("Sholinganallur").region).toBe("chennai");
  });

  it("detects Kolkata", () => {
    expect(detectRegionFromCity("Kolkata").region).toBe("kolkata");
    expect(detectRegionFromCity("Salt Lake").region).toBe("kolkata");
  });

  it("returns unknown for unrecognised / empty input", () => {
    expect(detectRegionFromCity("Indore").region).toBe("unknown");
    expect(detectRegionFromCity("").region).toBe("unknown");
    expect(detectRegionFromCity(null).region).toBe("unknown");
    expect(detectRegionFromCity(undefined).region).toBe("unknown");
  });

  it("populates discourse tics + anchors + hinglishDensity for known regions", () => {
    const blr = detectRegionFromCity("Bangalore");
    expect(blr.discourseTics.length).toBeGreaterThan(0);
    expect(blr.operationalAnchors.length).toBeGreaterThan(0);
    expect(blr.hinglishDensity).toBeGreaterThanOrEqual(0);
    expect(blr.hinglishDensity).toBeLessThanOrEqual(3);
    expect(blr.label).toMatch(/bangalore|bengaluru/i);
  });

  it("returns zero hinglishDensity + empty arrays for unknown", () => {
    const u = detectRegionFromCity("Erewhon");
    expect(u.hinglishDensity).toBe(0);
    expect(u.discourseTics).toEqual([]);
    expect(u.operationalAnchors).toEqual([]);
  });
});

describe("detectRegionFromText", () => {
  it("scans free-form text", () => {
    expect(
      detectRegionFromText("We had a deploy go down right at peak-hour ORR traffic.")
        .region,
    ).toBe("bangalore");
    expect(
      detectRegionFromText("The Gurgaon office shut early because of AQI.").region,
    ).toBe("delhi-ncr");
  });
});

describe("hasRegionalSignal", () => {
  it("is true for known regions", () => {
    expect(hasRegionalSignal(detectRegionFromCity("Bangalore"))).toBe(true);
  });
  it("is false for unknown", () => {
    expect(hasRegionalSignal(detectRegionFromCity(""))).toBe(false);
  });
});
