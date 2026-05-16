import { describe, it, expect } from "vitest";
import { classifyCollegeTier, cgpaCutoffAdjustment } from "../../server-handlers/_college-tier";

describe("classifyCollegeTier", () => {
  it("classifies IIT mentions as tier-1", () => {
    expect(classifyCollegeTier("I'm from IIT Bombay")).toBe("tier-1");
    expect(classifyCollegeTier("graduated from IIT Madras in 2024")).toBe("tier-1");
    expect(classifyCollegeTier("IIT-D CSE")).toBe("tier-1");
    expect(classifyCollegeTier("Indian Institute of Technology Kanpur")).toBe("tier-1");
  });

  it("classifies NIT mentions as tier-1", () => {
    expect(classifyCollegeTier("NIT Trichy ECE")).toBe("tier-1");
    expect(classifyCollegeTier("I study at NIT Surathkal")).toBe("tier-1");
    expect(classifyCollegeTier("MNIT Jaipur metallurgy")).toBe("tier-1");
  });

  it("classifies BITS, IIIT-H, IISc as tier-1", () => {
    expect(classifyCollegeTier("BITS Pilani CS")).toBe("tier-1");
    expect(classifyCollegeTier("IIIT Hyderabad")).toBe("tier-1");
    expect(classifyCollegeTier("IISc Bangalore M.Tech")).toBe("tier-1");
  });

  it("classifies VIT / Manipal / SRM / DTU / NSIT as tier-2", () => {
    expect(classifyCollegeTier("VIT Vellore final year")).toBe("tier-2");
    expect(classifyCollegeTier("MIT Manipal ECE")).toBe("tier-2");
    expect(classifyCollegeTier("SRM Chennai")).toBe("tier-2");
    expect(classifyCollegeTier("DTU CSE")).toBe("tier-2");
    expect(classifyCollegeTier("Delhi Technological University")).toBe("tier-2");
    expect(classifyCollegeTier("NSIT computer science")).toBe("tier-2");
    expect(classifyCollegeTier("Thapar Institute of Engineering")).toBe("tier-2");
  });

  it("returns unknown for unrecognized colleges", () => {
    expect(classifyCollegeTier("XYZ College of Engineering, Guntur")).toBe("unknown");
    expect(classifyCollegeTier("some random state private college")).toBe("unknown");
    expect(classifyCollegeTier("")).toBe("unknown");
    expect(classifyCollegeTier(null)).toBe("unknown");
    expect(classifyCollegeTier(undefined)).toBe("unknown");
  });

  it("prefers tier-1 over tier-2 when both could match", () => {
    // Some students cross-mention; tier-1 wins.
    expect(classifyCollegeTier("I did my B.Tech at VIT but my M.Tech is at IIT Bombay"))
      .toBe("tier-1");
  });
});

describe("cgpaCutoffAdjustment", () => {
  it("applies -0.5 leniency to tier-1", () => {
    expect(cgpaCutoffAdjustment("tier-1")).toBe(-0.5);
  });

  it("applies no adjustment to tier-2 or unknown", () => {
    expect(cgpaCutoffAdjustment("tier-2")).toBe(0);
    expect(cgpaCutoffAdjustment("unknown")).toBe(0);
  });
});
