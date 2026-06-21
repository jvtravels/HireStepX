/* #PRI-51 — deterministic salary-negotiation report fallback.
 *
 * When every LLM tier (70b → gemini → cerebras → 8b) is down/quota'd,
 * evaluate-session synthesizes the `parsed` slice from the transcript instead
 * of 503-ing a 25-minute interview. These tests pin the heuristic: real
 * negotiation signals must score higher than silence, every axis stays in a
 * believable band, and the shape is exactly what the report assembly consumes.
 */
import { describe, it, expect } from "vitest";
import {
  buildDeterministicNegotiationReport,
  NEG_AXES,
  type NegReportTurn,
} from "../../server-handlers/_deterministic-neg-report";
import { NEGOTIATION_SKILL_AXES } from "../../server-handlers/_evaluate-session-helpers";

function t(role: string, text: string): NegReportTurn {
  return { role, text };
}

const STRONG: NegReportTurn[] = [
  t("interviewer", "We're thinking around 38 LPA fixed for this role."),
  t("candidate", "Thanks, I appreciate the offer. Based on my market research I'm targeting 65 LPA total."),
  t("interviewer", "That's above our band. We can do 45."),
  t("candidate", "I understand the constraint. Could we bridge the gap with ESOP and a joining bonus? If cash is capped at 45 fixed, I'd want the variable and equity to make up the difference."),
  t("interviewer", "Let me see what I can do on equity."),
  t("candidate", "I do have a competing offer at 58, so I can't go below my floor of 52 fixed. Happy to close if we get there."),
  t("interviewer", "Okay, 52 fixed plus ESOP. Deal?"),
  t("candidate", "That works for me. Let's do it."),
];

const SILENT: NegReportTurn[] = [
  t("interviewer", "We're thinking around 38 LPA fixed."),
  t("candidate", "Okay."),
  t("interviewer", "So 38 it is?"),
  t("candidate", "Sure, fine."),
];

describe("buildDeterministicNegotiationReport (#PRI-51)", () => {
  it("emits exactly the six negotiation axes, in order", () => {
    const r = buildDeterministicNegotiationReport(STRONG);
    expect(r.skills.map((s) => s.name)).toEqual([...NEG_AXES]);
  });

  it("NEG_AXES stays identical to NEGOTIATION_SKILL_AXES (drift guard)", () => {
    expect([...NEG_AXES]).toEqual([...NEGOTIATION_SKILL_AXES]);
  });

  it("passes the assembly's usability bar (non-empty skills array)", () => {
    const r = buildDeterministicNegotiationReport(STRONG);
    expect(Array.isArray(r.skills)).toBe(true);
    expect(r.skills.length).toBe(6);
  });

  it("keeps every axis score in the believable 35-90 band", () => {
    for (const tr of [STRONG, SILENT]) {
      const r = buildDeterministicNegotiationReport(tr);
      for (const s of r.skills) {
        expect(s.score).toBeGreaterThanOrEqual(35);
        expect(s.score).toBeLessThanOrEqual(90);
      }
      expect(r.overallScore).toBeGreaterThanOrEqual(35);
      expect(r.overallScore).toBeLessThanOrEqual(90);
    }
  });

  it("scores a real negotiation higher than a passive one", () => {
    const strong = buildDeterministicNegotiationReport(STRONG);
    const silent = buildDeterministicNegotiationReport(SILENT);
    expect(strong.overallScore).toBeGreaterThan(silent.overallScore);
  });

  it("credits anchoring and trade-offs as distinct strengths", () => {
    const r = buildDeterministicNegotiationReport(STRONG);
    const anchor = r.skills.find((s) => s.name === "Anchor strength")!;
    const tradeoff = r.skills.find((s) => s.name === "Trade-off awareness")!;
    const walkaway = r.skills.find((s) => s.name === "Walk-away discipline")!;
    expect(anchor.score).toBeGreaterThan(60);
    expect(tradeoff.score).toBeGreaterThan(55);
    expect(walkaway.score).toBeGreaterThan(60);
  });

  it("flags low confidence and a ≤200-char verdict", () => {
    const r = buildDeterministicNegotiationReport(STRONG);
    expect(r.scoreConfidence).toBeLessThanOrEqual(0.5);
    expect(r.verdict.length).toBeGreaterThan(0);
    expect(r.verdict.length).toBeLessThanOrEqual(200);
  });

  it("produces cross-cutting wins/fixes (questionIdx -1) that survive grounding", () => {
    const r = buildDeterministicNegotiationReport(STRONG);
    for (const item of [...r.wins, ...r.fixes]) {
      expect(item.questionIdx).toBe(-1);
      expect(item.text.trim().length).toBeGreaterThan(0);
    }
    // A passive transcript should still yield actionable fixes.
    const silent = buildDeterministicNegotiationReport(SILENT);
    expect(silent.fixes.length).toBeGreaterThan(0);
  });

  it("does not crash on an empty transcript", () => {
    const r = buildDeterministicNegotiationReport([]);
    expect(r.skills.length).toBe(6);
    expect(r.overallScore).toBeGreaterThanOrEqual(35);
  });
});
