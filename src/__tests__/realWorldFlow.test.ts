/* Real-world Indian scenarios (2026-05-14g) — pins the LLM behaviour
 * for the five highest-ROI scenarios surfaced by the comprehensive
 * landscape audit but not covered by fresher / junior / mid-level:
 *
 *   • recentLayoff — Byju's/Unacademy/startup shutdown era. Empathetic
 *     voice; do NOT anchor down on current-CTC.
 *   • hotDomainPremium — AI/ML/GenAI/Security/Quant. Acknowledge the
 *     2026 specialty premium; ask candidate to show depth.
 *   • pipDisclosed — performance-improvement-plan oversharing. Coach
 *     against further disclosure; do NOT anchor down.
 *   • verbalOnlyOffer — waiting on offer letter. Commit to written-
 *     offer DATE and exact terms.
 *   • culturalJoiningConstraint — muhurat / wedding / Diwali / family
 *     function. Accommodate, do not push back.
 *
 * Each flag is utterance-detected, monotone-up across merge, and
 * surfaces a specific NEGOTIATION_SYSTEM_PROMPT rule. */
import { describe, expect, it } from "vitest";
import { extractCandidateProfile, mergeCandidateProfile } from "../../server-handlers/_candidate-profile";

describe("real-world Indian — recentLayoff detection", () => {
  it("detects 'I was laid off'", () => {
    const r = extractCandidateProfile("I was laid off last month from my edtech startup.");
    expect(r.recentLayoff).toBe(true);
    expect(r.hasAny).toBe(true);
  });
  it("detects 'part of the layoffs'", () => {
    const r = extractCandidateProfile("I was part of the recent layoffs at the company.");
    expect(r.recentLayoff).toBe(true);
  });
  it("detects 'startup shut down'", () => {
    const r = extractCandidateProfile("The startup shut down so I'm looking actively now.");
    expect(r.recentLayoff).toBe(true);
  });
  it("detects 'my role was eliminated'", () => {
    const r = extractCandidateProfile("My role was eliminated in the workforce reduction.");
    expect(r.recentLayoff).toBe(true);
  });
  it("does NOT fire when candidate quit voluntarily", () => {
    const r = extractCandidateProfile("I resigned because I wanted a new challenge.");
    expect(r.recentLayoff).toBe(false);
  });
});

describe("real-world Indian — hotDomainPremium detection", () => {
  it("detects GenAI / LLM specialty", () => {
    const r = extractCandidateProfile("I work on LLM fine-tuning and RAG pipelines.");
    expect(r.hotDomainPremium).toBe(true);
  });
  it("detects applied-ML / ML engineer", () => {
    const r = extractCandidateProfile("I'm an applied ML engineer with production model experience.");
    expect(r.hotDomainPremium).toBe(true);
  });
  it("detects AppSec / security engineer", () => {
    const r = extractCandidateProfile("I'm a security engineer focused on application security.");
    expect(r.hotDomainPremium).toBe(true);
  });
  it("detects quant / HFT", () => {
    const r = extractCandidateProfile("I work as a quant developer in HFT systems.");
    expect(r.hotDomainPremium).toBe(true);
  });
  it("does NOT fire on plain SWE", () => {
    const r = extractCandidateProfile("I'm a backend engineer working on REST APIs.");
    expect(r.hotDomainPremium).toBe(false);
  });
});

describe("real-world Indian — pipDisclosed detection", () => {
  it("detects 'on a PIP'", () => {
    const r = extractCandidateProfile("Honestly, I was put on a PIP last quarter.");
    expect(r.pipDisclosed).toBe(true);
  });
  it("detects 'asked to leave'", () => {
    const r = extractCandidateProfile("I was asked to leave for performance reasons.");
    expect(r.pipDisclosed).toBe(true);
  });
  it("detects 'performance improvement plan'", () => {
    const r = extractCandidateProfile("They placed me on a performance improvement plan.");
    expect(r.pipDisclosed).toBe(true);
  });
  it("detects 'managed out'", () => {
    const r = extractCandidateProfile("Long story short, I was managed out of my last role.");
    expect(r.pipDisclosed).toBe(true);
  });
  it("does NOT fire on generic 'looking for a change'", () => {
    const r = extractCandidateProfile("I'm looking for a better-fit role.");
    expect(r.pipDisclosed).toBe(false);
  });
});

describe("real-world Indian — verbalOnlyOffer detection", () => {
  it("detects 'verbal offer'", () => {
    const r = extractCandidateProfile("I only have a verbal offer so far, nothing in writing.");
    expect(r.verbalOnlyOffer).toBe(true);
  });
  it("detects 'waiting on offer letter'", () => {
    const r = extractCandidateProfile("Still waiting for the offer letter from them.");
    expect(r.verbalOnlyOffer).toBe(true);
  });
  it("detects 'offered verbally'", () => {
    const r = extractCandidateProfile("They offered verbally but haven't sent anything yet.");
    expect(r.verbalOnlyOffer).toBe(true);
  });
  it("detects 'need it in writing'", () => {
    const r = extractCandidateProfile("I need the offer in writing before I resign here.");
    expect(r.verbalOnlyOffer).toBe(true);
  });
});

describe("real-world Indian — culturalJoiningConstraint detection", () => {
  it("detects muhurat", () => {
    const r = extractCandidateProfile("I need to join on an auspicious muhurat date.");
    expect(r.culturalJoiningConstraint).toBe(true);
  });
  it("detects sister's wedding", () => {
    const r = extractCandidateProfile("My sister's wedding is in December so I'd join after.");
    expect(r.culturalJoiningConstraint).toBe(true);
  });
  it("detects post-Diwali joining", () => {
    const r = extractCandidateProfile("Can I join post Diwali? I have family commitments.");
    expect(r.culturalJoiningConstraint).toBe(true);
  });
  it("detects gruhapravesham", () => {
    const r = extractCandidateProfile("We have a gruhapravesham at home so a slight delay.");
    expect(r.culturalJoiningConstraint).toBe(true);
  });
  it("does NOT fire on generic 'I need 2 weeks'", () => {
    const r = extractCandidateProfile("I need 2 weeks to wrap up my current responsibilities.");
    expect(r.culturalJoiningConstraint).toBe(false);
  });
});

describe("real-world Indian — monotone-up across merge", () => {
  it("preserves all 5 flags across turns", () => {
    const prior = extractCandidateProfile("I was laid off from my GenAI startup; I'm an LLM engineer.");
    expect(prior.recentLayoff).toBe(true);
    expect(prior.hotDomainPremium).toBe(true);
    const next = extractCandidateProfile("What are next steps?");
    const merged = mergeCandidateProfile(prior, next);
    expect(merged.recentLayoff).toBe(true);
    expect(merged.hotDomainPremium).toBe(true);
  });
});

describe("real-world Indian — system prompt carries the 5 scenario rules", () => {
  it("NEGOTIATION_SYSTEM_PROMPT references each rule", async () => {
    const mod = await import("../../server-handlers/_negotiate-turn-helpers");
    const sys = mod.NEGOTIATION_SYSTEM_PROMPT;
    /* layoff — empathy + don't anchor down */
    expect(sys).toMatch(/layoff/i);
    expect(sys).toMatch(/EMPATHY/);
    /* hot-domain premium — 30-50% above standard SWE */
    expect(sys).toMatch(/hotDom/);
    expect(sys).toMatch(/30-50%/);
    /* PIP — coach against oversharing */
    expect(sys).toMatch(/pip/i);
    expect(sys).toMatch(/oversharing|overshare/i);
    /* verbal-only offer — commit to written-offer DATE */
    expect(sys).toMatch(/verbal/i);
    expect(sys).toMatch(/written[-\s]offer/i);
    /* cultural joining — accommodate */
    expect(sys).toMatch(/muhurat|cultural/i);
    expect(sys).toMatch(/accommodate/i);
  });
});
