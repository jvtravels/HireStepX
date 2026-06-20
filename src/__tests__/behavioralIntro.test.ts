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

  it("stays under the TTS budget (≤ ~47 words)", () => {
    const out = buildBehavioralIntro({
      interviewerName: "Karthik Nair",
      candidateName: "Anjali Verma",
      role: "Engineering Manager",
      company: "Flipkart",
    });
    const words = out.trim().split(/\s+/).length;
    expect(words).toBeLessThanOrEqual(47);
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

  /* Services-track pedigree opener — TCS / Infosys / Wipro etc. open with
     an academic-background walkthrough, even for laterals. The variant
     swaps the rapport hook to mirror that ritual. */
  it("swaps to pedigree opener for Indian services-track companies (TCS, Infosys, Wipro, etc.)", () => {
    const tcs = buildBehavioralIntro({ interviewerName: "Suresh Iyer", role: "Senior Engineer", company: "TCS" });
    expect(tcs.toLowerCase()).toContain("take me through your background");
    expect(tcs.toLowerCase()).toContain("academics");

    const infy = buildBehavioralIntro({ interviewerName: "Suresh Iyer", role: "Senior Engineer", company: "Infosys" });
    expect(infy.toLowerCase()).toContain("take me through your background");

    const wipro = buildBehavioralIntro({ interviewerName: "Suresh Iyer", role: "Senior Engineer", company: "Wipro" });
    expect(wipro.toLowerCase()).toContain("take me through your background");
  });

  it("swaps to pedigree opener for tier-2 Indian services firms (Mindtree, Sonata, Hexaware, Coforge, KPIT)", () => {
    const mindtree = buildBehavioralIntro({ interviewerName: "Suresh Iyer", role: "Senior Engineer", company: "Mindtree" });
    expect(mindtree.toLowerCase()).toContain("take me through your background");

    const coforge = buildBehavioralIntro({ interviewerName: "Suresh Iyer", role: "Senior Engineer", company: "Coforge" });
    expect(coforge.toLowerCase()).toContain("take me through your background");

    const kpit = buildBehavioralIntro({ interviewerName: "Suresh Iyer", role: "Senior Engineer", company: "KPIT" });
    expect(kpit.toLowerCase()).toContain("take me through your background");
  });

  it("does NOT swap to pedigree opener for product / MNC-India companies", () => {
    const razorpay = buildBehavioralIntro({ interviewerName: "Suresh Iyer", role: "PM", company: "Razorpay" });
    expect(razorpay.toLowerCase()).not.toContain("take me through your background");

    const googleIN = buildBehavioralIntro({ interviewerName: "Suresh Iyer", role: "SWE", company: "Google India" });
    expect(googleIN.toLowerCase()).not.toContain("take me through your background");
  });

  it("services-track intro stays within an extended TTS budget (≤ ~70 words)", () => {
    const out = buildBehavioralIntro({
      interviewerName: "Suresh Iyer",
      candidateName: "Anjali Verma",
      role: "Senior Engineer",
      company: "Infosys",
    });
    const words = out.trim().split(/\s+/).length;
    expect(words).toBeLessThanOrEqual(70);
  });

  it("references the first resume project when topProjects is supplied (product-co path)", () => {
    const out = buildBehavioralIntro({
      interviewerName: "Suresh Iyer",
      candidateName: "Anjali Verma",
      role: "Senior PM",
      company: "Razorpay",
      topProjects: ["UPI reconciliation rebuild", "merchant onboarding revamp"],
    });
    expect(out).toContain("UPI reconciliation rebuild");
    // Only the FIRST project is surfaced — second one would be a recap, not rapport.
    expect(out).not.toContain("merchant onboarding revamp");
    // Resume-grounded variant explicitly says "I saw on your resume…"
    expect(out.toLowerCase()).toContain("i saw on your resume");
  });

  it("services-track pedigree opener wins over project grounding", () => {
    // At TCS / Infosys the academic walkthrough is a real ritual — resume
    // projects must NOT override the pedigree opener.
    const out = buildBehavioralIntro({
      interviewerName: "Suresh Iyer",
      role: "Senior Engineer",
      company: "Infosys",
      topProjects: ["UPI reconciliation rebuild"],
    });
    expect(out.toLowerCase()).toContain("take me through your background");
    expect(out).not.toContain("UPI reconciliation rebuild");
  });

  it("skips project grounding when topProjects is empty / blank", () => {
    const out = buildBehavioralIntro({
      interviewerName: "Suresh Iyer",
      role: "Senior PM",
      company: "Razorpay",
      topProjects: ["", "   "],
    });
    expect(out.toLowerCase()).not.toContain("i saw on your resume");
  });

  it("truncates absurdly long project names instead of dumping them into TTS", () => {
    const long = "An exceptionally verbose project title that nobody would ever actually fit on a resume line and which absolutely must be trimmed before the TTS layer ever sees it";
    const out = buildBehavioralIntro({
      interviewerName: "Suresh Iyer",
      role: "Senior PM",
      topProjects: [long],
    });
    expect(out).toContain("…");
    expect(out).not.toContain(long);
  });

  /* Register guard — the spoken intro must obey the same Indian-register
     ban list the LLM question layer enforces (generate-questions.ts
     BEHAVIOURAL_INDIAN_REGISTER_RULE). These phrases read as scripted
     American-recruiter filler; banning them in the static intro keeps the
     persona consistent across the intro and the LLM-generated questions. */
  it("never emits banned American-recruiter register across any variant", () => {
    const banned = [
      "dive into", "deep dive", "circle back", "reach out",
      "take the time", "taking the time", "what's drawing you to",
      "walk me through", "moving forward", "touch base",
    ];
    const variants = [
      buildBehavioralIntro({ interviewerName: "Neha Gupta" }),
      buildBehavioralIntro({ interviewerName: "Neha Gupta", candidateName: "Jay Vyas" }),
      buildBehavioralIntro({ interviewerName: "Neha Gupta", role: "Senior Product Designer" }),
      buildBehavioralIntro({ interviewerName: "Neha Gupta", role: "Senior Product Designer", company: "Flipkart" }),
      buildBehavioralIntro({ interviewerName: "Neha Gupta", company: "Flipkart" }),
      buildBehavioralIntro({ interviewerName: "Neha Gupta", role: "PM", company: "Razorpay", topProjects: ["UPI reconciliation rebuild"] }),
      buildBehavioralIntro({ interviewerName: "Neha Gupta", role: "PM", topProjects: ["UPI reconciliation rebuild"] }),
      buildBehavioralIntro({ interviewerName: "Neha Gupta", topProjects: ["UPI reconciliation rebuild"] }),
      // Services-track pedigree variant.
      buildBehavioralIntro({ interviewerName: "Suresh Iyer", role: "Senior Engineer", company: "Infosys" }),
      buildBehavioralIntro({ interviewerName: "Suresh Iyer", company: "TCS" }),
    ];
    for (const out of variants) {
      const lc = out.toLowerCase();
      for (const phrase of banned) {
        expect(lc, `variant leaked "${phrase}": ${out}`).not.toContain(phrase);
      }
    }
  });
});
