import { describe, it, expect } from "vitest";
import { buildBehavioralIntro } from "../_behavioral-intro";

/* Tests pin the structural shape: name appears, rapport hook appears,
   and the intro stays short enough to fit the existing ~6-second TTS
   budget (roughly 35 words at conversational pace). Drift here would
   either make the intro feel like a TED talk or strip the name back
   out — both kill the rapport gain we're after. */

describe("buildBehavioralIntro", () => {
  it("uses the interviewer's first name (not full name) in the spoken intro", () => {
    const out = buildBehavioralIntro({ interviewerName: "Priya Sharma" });
    expect(out).toContain("I'm Priya");
    // Full name reads stiff in TTS — should NOT appear inline.
    expect(out).not.toContain("Priya Sharma");
  });

  it("uses candidate first name in greeting when provided", () => {
    const out = buildBehavioralIntro({ interviewerName: "Arjun Mehta", candidateName: "Rohit Kumar" });
    expect(out.startsWith("Hi Rohit")).toBe(true);
  });

  it("falls back to a neutral greeting when candidate name is absent", () => {
    const out = buildBehavioralIntro({ interviewerName: "Arjun Mehta" });
    expect(out.startsWith("Hi, thanks")).toBe(true);
  });

  it("includes a rapport hook (where are you joining from / what brings you here)", () => {
    const out = buildBehavioralIntro({ interviewerName: "Aisha Rahman" });
    expect(out.toLowerCase()).toMatch(/where are you joining|what brings|drawing you to/);
  });

  it("anchors rapport hook on role + company when both known", () => {
    const out = buildBehavioralIntro({
      interviewerName: "Vikram Desai",
      role: "Senior Product Manager",
      company: "Razorpay",
    });
    expect(out).toContain("Senior Product Manager");
    expect(out).toContain("Razorpay");
  });

  it("anchors on role alone when company is missing", () => {
    const out = buildBehavioralIntro({ interviewerName: "Neha Gupta", role: "SDE-2" });
    expect(out).toContain("SDE-2");
    expect(out).not.toContain("at undefined");
  });

  it("stays under the TTS budget (≤ ~45 words)", () => {
    const out = buildBehavioralIntro({
      interviewerName: "Karthik Nair",
      candidateName: "Anjali Verma",
      role: "Engineering Manager",
      company: "Flipkart",
    });
    const words = out.trim().split(/\s+/).length;
    expect(words).toBeLessThanOrEqual(45);
  });

  it("never leaks TTS prosody markup or template tokens to the candidate", () => {
    const out = buildBehavioralIntro({ interviewerName: "Meera Reddy" });
    expect(out).not.toMatch(/\[pause/);
    expect(out).not.toMatch(/\{[^}]+\}/); // no unfilled template placeholders
    expect(out).not.toMatch(/undefined|null/i);
  });

  it("handles empty interviewerName defensively (falls back to neutral phrase)", () => {
    const out = buildBehavioralIntro({ interviewerName: "" });
    // Should not leak "I'm ," or similar broken output.
    expect(out).not.toMatch(/I'm ,/);
    expect(out).toContain("your interviewer");
  });

  it("never produces 'at undefined' or 'to undefined' when only one of role/company is set", () => {
    const out1 = buildBehavioralIntro({ interviewerName: "Priya Sharma", role: "PM" });
    const out2 = buildBehavioralIntro({ interviewerName: "Priya Sharma", company: "Flipkart" });
    expect(out1).not.toMatch(/undefined/);
    expect(out2).not.toMatch(/undefined/);
  });
});
