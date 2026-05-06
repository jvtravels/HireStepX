/**
 * Prompt-structure regression tests.
 *
 * Pins the structural shape of the question-generation prompt so a
 * future refactor can't silently strip a grounding rule. Each test
 * validates a specific anti-hallucination directive is still present
 * by reading the source file directly. Cheap, deterministic, no LLM
 * calls — runs on every CI build.
 *
 * If any of these regress, the deployed prompt is missing a guard
 * that the audit & hallucination eval harness rely on. Don't relax
 * these without an explicit decision.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPT_FILE = join(__dirname, "../../server-handlers/generate-questions.ts");
const RETRIEVAL_FILE = join(__dirname, "../../server-handlers/_question-retrieval.ts");

const promptSource = readFileSync(PROMPT_FILE, "utf8");
const retrievalSource = readFileSync(RETRIEVAL_FILE, "utf8");

describe("grounding directive structure", () => {
  it("GLOBAL GROUNDING RULES block is present in the prompt", () => {
    expect(promptSource).toMatch(/GROUNDING RULES \(mandatory/);
    expect(promptSource).toMatch(/COMPANY FACTS:/);
    expect(promptSource).toMatch(/NUMBERS:/);
    expect(promptSource).toMatch(/PEOPLE:/);
    expect(promptSource).toMatch(/RECENT EVENTS:/);
    expect(promptSource).toMatch(/UNCERTAINTY ACKNOWLEDGEMENT:/);
    expect(promptSource).toMatch(/SALARY NUMBERS:/);
  });

  it("groundingRulesDirective is wired into the prompt template", () => {
    /* The directive must actually appear in the assembled `prompt`
       string-template, not just defined-and-unused. */
    expect(promptSource).toMatch(/\$\{groundingRulesDirective\}/);
  });

  it("KNOWN_FACTS block is wired into the prompt template", () => {
    expect(promptSource).toMatch(/\$\{knownFactsBlock\}/);
    expect(promptSource).toMatch(/getKnownFacts\(/);
    expect(promptSource).toMatch(/formatKnownFactsForPrompt\(/);
  });

  it("self-attestation field (groundingCheck) is requested when company is provided", () => {
    expect(promptSource).toMatch(/groundingCheck/);
    expect(promptSource).toMatch(/GROUNDING-CHECK SELF-ATTESTATION/);
    expect(promptSource).toMatch(/"verified"|verified\|generic\|hypothetical/);
  });
});

describe("retrieval grounding warnings", () => {
  it("formatReferencesForPrompt emits a tier-2 grounding warning", () => {
    expect(retrievalSource).toMatch(/result\.tier === 2/);
    expect(retrievalSource).toMatch(/peer companies/i);
  });

  it("formatReferencesForPrompt emits a tier-3 grounding warning", () => {
    expect(retrievalSource).toMatch(/result\.tier === 3/);
    expect(retrievalSource).toMatch(/different role family/i);
  });

  it("formatReferencesForPrompt emits a tier-4 grounding warning (was empty pre-fix)", () => {
    expect(retrievalSource).toMatch(/no verified reference questions/i);
    expect(retrievalSource).toMatch(/anonymous framings/i);
  });

  it("references include confidence stamping when entries are inferred", () => {
    expect(retrievalSource).toMatch(/confidence: inferred/);
    expect(retrievalSource).toMatch(/CONFIDENCE NOTE/);
  });
});

describe("KNOWN_FACTS coverage", () => {
  it("the highest-traffic companies all have KNOWN_FACTS entries", async () => {
    const { COMPANY_KNOWN_FACTS } = await import("../../data/company-known-facts");
    const required = [
      "razorpay", "phonepe", "flipkart", "swiggy", "zomato",
      "cred", "zerodha", "meesho",
      "google", "amazon", "microsoft", "stripe",
      "tcs", "infosys",
      "mckinsey", "bcg", "bain",
      "goldman", "jane-street",
    ];
    for (const company of required) {
      expect(COMPANY_KNOWN_FACTS).toHaveProperty(company);
    }
  });

  it("every KNOWN_FACTS entry has a description and lastVerified date", async () => {
    const { COMPANY_KNOWN_FACTS } = await import("../../data/company-known-facts");
    for (const [company, facts] of Object.entries(COMPANY_KNOWN_FACTS)) {
      expect(facts.description, `${company} missing description`).toBeTruthy();
      expect(facts.lastVerified, `${company} missing lastVerified`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("getKnownFacts resolves loose company names", async () => {
    const { getKnownFacts } = await import("../../data/company-known-facts");
    expect(getKnownFacts("Razorpay Internet Pvt Ltd")?.description).toBeTruthy();
    expect(getKnownFacts("Google Inc.")?.description).toBeTruthy();
    expect(getKnownFacts("Jane Street")?.description).toBeTruthy();
    expect(getKnownFacts("totally-made-up-co")).toBeNull();
  });

  it("formatKnownFactsForPrompt emits a refuse-when-asked clause", async () => {
    const { getKnownFacts, formatKnownFactsForPrompt } = await import("../../data/company-known-facts");
    const facts = getKnownFacts("Razorpay");
    expect(facts).not.toBeNull();
    const prompt = formatKnownFactsForPrompt(facts, "Razorpay");
    expect(prompt).toMatch(/VERIFIED COMPANY FACTS/);
    expect(prompt).toMatch(/do NOT invent/);
    expect(prompt).toMatch(/last verified/i);
  });
});
