/* MVP launch audit battery (2026-06-18).
 *
 * Drives the REAL kernel + planner + canonical-prose path (the
 * deterministic LLM-off worst case) through an adversarial scenario
 * matrix and asserts the north-star invariants the salary-negotiation
 * bot must never violate: no content-free deflection, no degenerate
 * empty lines, no verbatim loop, no Indian-HR register/fluency breaks,
 * and — for happy paths — a real close.
 *
 * Born from the MVP-readiness audit. The BLOCKER-class assertions are a
 * permanent regression lock; softer findings are surfaced via the
 * written report at /tmp/negotiation_mvp_audit.out for triage.
 */
import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import {
  runConversation,
  fillerHit,
  registerViolations,
  fluencyViolations,
  normLine,
  type SimTurn,
} from "./_negotiationSim";
import type { NegotiationBand } from "../../server-handlers/_negotiation-kernel";

interface Scenario {
  name: string;
  band: NegotiationBand;
  turns: string[];
  expectClose?: "accepted" | "any-terminal";
}

const B = (
  initialOffer: number,
  maxStretch: number,
  walkAway: number,
  hasEquity = true,
): NegotiationBand => ({ initialOffer, maxStretch, walkAway, hasEquity });

const SCENARIOS: Scenario[] = [
  {
    name: "happy-path-accept",
    band: B(28, 40, 24),
    turns: [
      "My current CTC is 24 LPA fixed.",
      "I'm targeting around 32 LPA.",
      "Can you do better on the base?",
      "That works. I accept the offer as is.",
      "Yes, please go ahead and send the offer letter.",
    ],
    expectClose: "accepted",
  },
  {
    name: "aggressive-pusher-reaches-ceiling",
    band: B(26, 38, 22),
    turns: [
      "Current CTC 28 LPA, I want 42 LPA.",
      "That's too low, I have other offers.",
      "Push it higher, I won't settle below 40 LPA.",
      "What else can you add?",
      "Add a joining bonus and I'll think about it.",
      "Fine, if that's the max, I accept.",
      "Yes send the letter.",
    ],
    expectClose: "any-terminal",
  },
  {
    name: "lever-explorer-non-cash",
    band: B(28, 44, 24),
    turns: [
      "Current 26 LPA fixed.",
      "Targeting 36 LPA.",
      "Can you raise the base more?",
      "What about equity?",
      "What about relocation and joining bonus?",
      "Okay, can I do hybrid too?",
      "And what's the designation?",
      "Alright, that's acceptable. I accept.",
      "Yes, please send it.",
    ],
    expectClose: "any-terminal",
  },
  {
    name: "unrealistic-target-walkaway",
    band: B(20, 28, 16),
    turns: [
      "Current CTC is 18 LPA.",
      "I want 55 LPA, non-negotiable.",
      "No, 55 LPA or nothing.",
      "Then I walk.",
    ],
    expectClose: "any-terminal",
  },
  {
    name: "info-seeker-vesting-benefits",
    band: B(30, 42, 26),
    turns: [
      "Current 28 LPA fixed plus some RSUs.",
      "What's the vesting schedule and cliff?",
      "What about PF, gratuity, insurance?",
      "And the variable payout history?",
      "Targeting 34 LPA.",
      "Okay that's fair, I accept.",
      "Yes go ahead.",
    ],
    expectClose: "any-terminal",
  },
  {
    name: "growth-and-title-seeker",
    band: B(28, 40, 24),
    turns: [
      "Current 26 LPA fixed.",
      "Targeting 33 LPA.",
      "What's the growth path here?",
      "And the exact designation?",
      "Okay, I accept.",
      "Yes, send the letter.",
    ],
    expectClose: "any-terminal",
  },
  /* MVP-audit finding #2 regression lock (2026-06-18). Terse / unit-less /
   * compound discovery answers used to fail to bind currentCtc, looping the
   * CTC probe to a stalemate with zero offer ever made (hollow accept).
   * Fix B (context-gated bare-integer span emission in
   * _number-role-classifier.ts) must keep these reaching a real close. */
  {
    name: "terse-bare-numbers-discovery",
    band: B(28, 40, 24),
    turns: [
      "24.",
      "32.",
      "Can you do better on the base?",
      "Okay that works, I accept the offer.",
      "Yes, please send the offer letter.",
    ],
    expectClose: "accepted",
  },
  {
    name: "compound-fixed-and-total",
    band: B(28, 40, 24),
    turns: [
      "I'm at 22 fixed, targeting 34 total.",
      "Push the base please.",
      "Okay that revised number works, I accept.",
      "Yes, please send the offer letter.",
    ],
    expectClose: "accepted",
  },
  {
    name: "current-cue-no-unit",
    band: B(30, 42, 26),
    turns: [
      "Current 26 fixed.",
      "Want 36.",
      "Raise the base please.",
      "That revised number is acceptable, I accept it.",
      "Yes, send the offer letter please.",
    ],
    expectClose: "accepted",
  },
];

interface Finding {
  scenario: string;
  severity: "BLOCKER" | "HIGH" | "MED";
  issue: string;
  evidence: string;
}

function auditTranscript(name: string, transcript: SimTurn[], expectClose?: string): Finding[] {
  const findings: Finding[] = [];
  for (const t of transcript) {
    const f = fillerHit(t.aiText);
    if (f) findings.push({ scenario: name, severity: "BLOCKER", issue: "content-free filler/deflection", evidence: f });
    for (const v of registerViolations(t.aiText)) {
      findings.push({ scenario: name, severity: "HIGH", issue: `register:${v.rule}`, evidence: v.evidence });
    }
    for (const v of fluencyViolations(t.aiText)) {
      findings.push({ scenario: name, severity: "HIGH", issue: `fluency:${v.rule}`, evidence: v.evidence });
    }
    if (!t.aiText || t.aiText.trim().length < 12) {
      findings.push({ scenario: name, severity: "BLOCKER", issue: "empty/degenerate AI line", evidence: JSON.stringify(t.aiText) });
    }
  }
  for (let i = 1; i < transcript.length; i++) {
    const a = normLine(transcript[i - 1].aiText);
    const b = normLine(transcript[i].aiText);
    if (a && a === b) {
      findings.push({ scenario: name, severity: "BLOCKER", issue: "verbatim loop (consecutive identical line)", evidence: a.slice(0, 60) });
    }
  }
  const last = transcript[transcript.length - 1];
  if (expectClose === "accepted" && last.phase !== "accepted") {
    findings.push({ scenario: name, severity: "HIGH", issue: "expected accepted close, did not reach", evidence: last.phase });
  }
  if (expectClose === "any-terminal" && !last.terminal) {
    findings.push({ scenario: name, severity: "MED", issue: "no terminal close within scripted turns", evidence: last.phase });
  }
  return findings;
}

describe("MVP audit — salary negotiation adversarial battery", () => {
  const all: Finding[] = [];
  const summary: string[] = [];

  for (const sc of SCENARIOS) {
    it(`scenario: ${sc.name} — no crash, no BLOCKER, no register/fluency break`, () => {
      const { transcript } = runConversation({
        role: "Software Engineer",
        company: "Acme",
        band: sc.band,
        turns: sc.turns,
        stopOnTerminal: true,
      });
      const findings = auditTranscript(sc.name, transcript, sc.expectClose);
      all.push(...findings);
      const last = transcript[transcript.length - 1];
      summary.push(
        `${sc.name}: ${transcript.length} turns → phase=${last.phase} terminal=${last.terminal} highestOffer=${last.highestOfferMade} findings=${findings.length}`,
      );
      expect(transcript.length).toBeGreaterThan(0);
      const blockers = findings.filter((f) => f.severity === "BLOCKER");
      const regFluency = findings.filter((f) => f.issue.startsWith("register:") || f.issue.startsWith("fluency:"));
      expect(blockers, JSON.stringify(blockers, null, 2)).toHaveLength(0);
      expect(regFluency, JSON.stringify(regFluency, null, 2)).toHaveLength(0);
    });
  }

  it("ZZ writes audit report and asserts zero BLOCKERs overall", () => {
    const blockers = all.filter((f) => f.severity === "BLOCKER");
    const high = all.filter((f) => f.severity === "HIGH");
    const med = all.filter((f) => f.severity === "MED");
    const report =
      "=== MVP AUDIT: salary negotiation ===\n\n" +
      summary.join("\n") +
      `\n\n--- FINDINGS (${all.length}) BLOCKER=${blockers.length} HIGH=${high.length} MED=${med.length} ---\n` +
      all.map((f) => `[${f.severity}] ${f.scenario}: ${f.issue} :: ${f.evidence}`).join("\n");
    writeFileSync("/tmp/negotiation_mvp_audit.out", report);
    expect(blockers, JSON.stringify(blockers, null, 2)).toHaveLength(0);
  });
});
