/* ROOT-B ask-binding regression lock (2026-07-18).
 *
 * The suspected ROOT-B family: the kernel's candidateTarget /
 * candidateAskLpa can be mis-captured — a recruiter-STATED number binding
 * as the candidate's ask, or a disclosed CURRENT CTC binding as the
 * TARGET. These tests drive each documented audit scenario through the
 * real kernel (replayTranscript → applyCandidateAnswer → pickAiMove →
 * applyAiMove) and assert the kernel binds the candidate's OWN stated
 * target — never the recruiter's number, never the disclosed current CTC.
 *
 * effectiveTargetCtcLpaLocal (metrics) reads state.candidateTarget, which
 * is written in _negotiation-kernel.ts (~L5030) only for total-scoped
 * targets. So `candidateTarget` and the metrics `candidateAskLpa` are the
 * two authoritative surfaces we assert on.
 *
 * Each `it` name carries the audit bug id it retires. */

import { describe, it, expect } from "vitest";
import { replayTranscript } from "../pdfReplay/_replayHarness";
import { computeNegotiationMetrics } from "../../../server-handlers/_negotiation-metrics";
import type { NegotiationBand, NegotiationState } from "../../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 50,
  maxStretch: 62,
  walkAway: 46,
  hasEquity: true,
};

function run(
  sessionId: string,
  band: NegotiationBand,
  turns: { candidate: string; aiText?: string }[],
): NegotiationState {
  return replayTranscript({
    init: { sessionId, role: "Software Engineer", company: "Flipkart", band },
    turns,
  });
}

/* The metrics ask surface derives from the same final state (moves list is
 * only needed for trajectory/anchor — candidateAskLpa reads finalState). */
function askLpa(state: NegotiationState): number | null {
  return computeNegotiationMetrics({ finalState: state, moves: [] }).candidateAskLpa;
}

describe("ROOT-B ask-binding regression lock", () => {
  /* ── recruiter-number-as-ask family (S17-B4/B5/B6) ───────────────── */

  it("S17-B4: a recruiter-STATED number in the AI turn must NOT bind as the candidate's target", () => {
    // Recruiter names 52; candidate's own target is 60. The recruiter number
    // must never become candidateTarget.
    const s = run("askbind-s17b4", { initialOffer: 50, maxStretch: 62, walkAway: 46, hasEquity: true }, [
      { candidate: "I'm at 44 LPA currently, targeting 60.", aiText: "We can start at 52 LPA." },
      { candidate: "52 is short of what I need — I'm looking for 60.", aiText: "Let me see what I can do." },
      { candidate: "60 is my number for this move.", aiText: "Noted." },
    ]);
    expect(s.candidateTarget).toBe(60);
    expect(s.candidateTarget).not.toBe(52);
    expect(askLpa(s)).toBe(60);
  });

  it("S17-B5: recruiter's opening anchor echoed back by candidate does not overwrite the real target", () => {
    const s = run("askbind-s17b5", { initialOffer: 48, maxStretch: 60, walkAway: 44, hasEquity: true }, [
      { candidate: "My target is 58 LPA. Current is 45.", aiText: "Our band opens at 48 LPA." },
      { candidate: "You said 48, but I'm anchoring at 58.", aiText: "Understood." },
      { candidate: "Still 58 for me.", aiText: "Okay." },
    ]);
    expect(s.candidateTarget).toBe(58);
    expect(s.candidateTarget).not.toBe(48);
    expect(askLpa(s)).toBe(58);
  });

  it("S17-B6: candidate reacting to a recruiter figure ('can you do 55?') binds candidate's ask, not a stray recruiter number", () => {
    const s = run("askbind-s17b6", { initialOffer: 50, maxStretch: 62, walkAway: 46, hasEquity: true }, [
      { candidate: "Current 46, I'm looking for 59.", aiText: "The most I can float today is 53 LPA." },
      { candidate: "Can you do 59? That's my ask.", aiText: "Let me check." },
    ]);
    expect(s.candidateTarget).toBe(59);
    expect(s.candidateTarget).not.toBe(53);
    expect(askLpa(s)).toBe(59);
  });

  /* ── report ask-binding cascade (S14-REPORT-B1/B2/B4) ────────────── */

  it("S14-REPORT-B1: current CTC disclosed first must not become the target", () => {
    const s = run("askbind-s14rb1", BAND, [
      { candidate: "Currently 44 LPA.", aiText: "Thanks. What's your expectation?" },
      { candidate: "Targeting 57.", aiText: "Noted." },
    ]);
    expect(s.candidateCurrentCtc).toBe(44);
    expect(s.candidateTarget).toBe(57);
    expect(s.candidateTarget).not.toBe(44);
    expect(askLpa(s)).toBe(57);
  });

  it("S14-REPORT-B2: same-turn current+target must split correctly (target is the ask)", () => {
    const s = run("askbind-s14rb2", BAND, [
      { candidate: "I'm at 44 LPA now and I'm looking for 57 LPA total.", aiText: "Got it." },
      { candidate: "57 is my number.", aiText: "Noted." },
    ]);
    expect(s.candidateCurrentCtc).toBe(44);
    expect(s.candidateTarget).toBe(57);
    expect(askLpa(s)).toBe(57);
  });

  it("S14-REPORT-B4: a fixed-scoped counter must NOT clobber the total-package target", () => {
    const s = run("askbind-s14rb4", BAND, [
      { candidate: "Current 44, target 57 total.", aiText: "Understood." },
      { candidate: "Push the base to 40 fixed.", aiText: "Let me see." },
    ]);
    // The total-package target stays 57; the fixed counter routes to
    // candidateTargetFixed, not candidateTarget.
    expect(s.candidateTarget).toBe(57);
    expect(s.candidateTargetFixed).toBe(40);
    expect(askLpa(s)).toBe(57);
  });

  /* ── current-CTC-as-target (S13-B8) ──────────────────────────────── */

  it("S13-B8: a disclosed current CTC must never bind as the candidate's target", () => {
    const s = run("askbind-s13b8", BAND, [
      { candidate: "My current CTC is 48 LPA.", aiText: "Thanks. And your expectation?" },
      { candidate: "I want 60.", aiText: "Noted." },
    ]);
    expect(s.candidateCurrentCtc).toBe(48);
    expect(s.candidateTarget).toBe(60);
    expect(s.candidateTarget).not.toBe(48);
    expect(askLpa(s)).toBe(60);
  });

  /* ── S15-REPORT-B2 ───────────────────────────────────────────────── */

  it("S15-REPORT-B2: current disclosed alone (no target yet) leaves candidateTarget null, not the current number", () => {
    const s = run("askbind-s15rb2", BAND, [
      { candidate: "I'm currently earning 44 LPA.", aiText: "Thanks for sharing." },
    ]);
    expect(s.candidateCurrentCtc).toBe(44);
    expect(s.candidateTarget).not.toBe(44);
    // Ask is null (never anchored a target) OR the fixed-fold — never 44.
    expect(askLpa(s)).not.toBe(44);
  });
});

/* S13-B9 — kernel-side initiated-vs-elicited info tracking (single source). */
describe("S13-B9 info-ask initiator tracking (kernel)", () => {
  it("recruiter-elicited info question does NOT enter infoAskedInitiated", () => {
    // The recruiter SOLICITS the candidate's questions ("what would you like to
    // know...?"); the candidate then asks about the vesting schedule. The ask
    // lands in infoAsked but NOT in the candidate-INITIATED subset — it was
    // prompted, not volunteered.
    const s = run("s13b9-elicited", BAND, [
      { candidate: "I'm at 44 LPA, looking for 58.", aiText: "We can work with that. What would you like to know about the equity package?" },
      { candidate: "What's the vesting schedule and cliff?", aiText: "Four years, one-year cliff." },
    ]);
    expect(s.infoAsked).toContain("vest-schedule");
    expect(s.infoAskedInitiated).not.toContain("vest-schedule");
  });

  it("candidate-initiated info question DOES enter infoAskedInitiated", () => {
    // The recruiter makes a plain offer (no solicitation); the candidate
    // spontaneously probes the clawback terms — candidate-initiated.
    const s = run("s13b9-initiated", BAND, [
      { candidate: "I'm at 44 LPA, looking for 58.", aiText: "We can offer 52 LPA." },
      { candidate: "What's the clawback period on the joining bonus?", aiText: "Twelve months." },
    ]);
    expect(s.infoAsked).toContain("clawback-period");
    expect(s.infoAskedInitiated).toContain("clawback-period");
  });
});
