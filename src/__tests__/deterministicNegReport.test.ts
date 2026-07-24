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
  type NegOutcome,
} from "../../server-handlers/_deterministic-neg-report";
import { isWalkAway } from "../../server-handlers/_walkaway-detection";
import {
  NEGOTIATION_SKILL_AXES,
  isUsableEvalReport,
  validateReportShape,
} from "../../server-handlers/_evaluate-session-helpers";

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

  /* LOAD-BEARING: evaluate-session assigns parsed = buildDeterministic…() and
     then re-runs the SAME 503 gate (isUsableEvalReport). If the synthesized
     slice failed that gate, the handler would still 503 — defeating the whole
     fix. This pins the contract so the fallback can never silently regress into
     a dead-end. (#PRI-51) */
  it("passes the exact isUsableEvalReport gate the handler re-checks (never 503)", () => {
    for (const tr of [STRONG, SILENT, []]) {
      const synth = buildDeterministicNegotiationReport(tr);
      expect(isUsableEvalReport(synth, "salary-negotiation")).toBe(true);
    }
  });

  /* S12-B5 — the structural-levers WIN must require a candidate-INITIATED
     trade, not a bare lever mention or a discovery question. A false "you
     brought structural levers" is a hallucinated strength. */
  const STRUCTURAL_WIN = "You brought structural levers — equity, variable, and joining bonus — into the conversation.";

  it("does NOT emit the structural-levers win on a bare info question about a lever", () => {
    const infoOnly: NegReportTurn[] = [
      t("interviewer", "We're at 40 LPA fixed."),
      t("candidate", "Understood. Quick question — what's the notice period here?"),
      t("interviewer", "It's 60 days."),
      t("candidate", "Got it, thanks."),
    ];
    const r = buildDeterministicNegotiationReport(infoOnly);
    expect(r.wins.map((w) => w.text)).not.toContain(STRUCTURAL_WIN);
  });

  it("does NOT emit the structural-levers win on a bare acknowledgement of a lever", () => {
    const ackOnly: NegReportTurn[] = [
      t("interviewer", "The package has a fixed base plus variable pay."),
      t("candidate", "Right, you offer variable pay, that makes sense."),
      t("interviewer", "Correct."),
      t("candidate", "Okay, understood."),
    ];
    const r = buildDeterministicNegotiationReport(ackOnly);
    expect(r.wins.map((w) => w.text)).not.toContain(STRUCTURAL_WIN);
  });

  it("DOES emit the structural-levers win on a candidate-initiated trade", () => {
    const traded: NegReportTurn[] = [
      t("interviewer", "We can't go above 45 fixed."),
      t("candidate", "If the base is capped, can we trade that for more equity?"),
      t("interviewer", "Possibly."),
      t("candidate", "Great."),
    ];
    const r = buildDeterministicNegotiationReport(traded);
    expect(r.wins.map((w) => w.text)).toContain(STRUCTURAL_WIN);
    // STRONG (rich trade framing) keeps emitting it too.
    const strong = buildDeterministicNegotiationReport(STRONG);
    expect(strong.wins.map((w) => w.text)).toContain(STRUCTURAL_WIN);
  });

  /* S13-B10 — the walk-away-floor FIX must be suppressed on a no-agreement /
     stalemate deadlock (the impasse is the problem, not a missing floor), but
     may still surface on a settled session where no floor was set. */
  const WALKAWAY_FIX = "State a walk-away floor — or a competing option, to give your counter real leverage.";

  it("does NOT emit the walk-away-floor fix on a no_agreement/stalemate deadlock", () => {
    const deadlocked: NegReportTurn[] = [
      t("interviewer", "We're firm at 40 LPA."),
      t("candidate", "I was hoping for closer to 55. Can we come up?"),
      t("interviewer", "No, 40 is the ceiling."),
      t("candidate", "I don't think that works for me. Let's leave it here for now."),
    ];
    const r = buildDeterministicNegotiationReport(deadlocked, "stalemate");
    expect(r.fixes.map((f) => f.text)).not.toContain(WALKAWAY_FIX);
    // walked-away is also a no-agreement terminal — floor advice is misapplied.
    const walked = buildDeterministicNegotiationReport(deadlocked, "walked-away");
    expect(walked.fixes.map((f) => f.text)).not.toContain(WALKAWAY_FIX);
  });

  /* S13-B10 caller-threading — evaluate-session reconstructs the transcript-
     honest `walked-away` outcome from the candidate turns via isWalkAway (the
     kernel's OWN single source of truth for walk-away) and threads it into the
     deadlock gate. This mirrors the exact inline expression at the real call
     site (evaluate-session.ts) end-to-end: an explicit candidate exit must
     suppress the walk-away-floor coaching, a non-exit must not. */
  it("caller-threading: an explicit candidate walk-away transcript suppresses the walk-away-floor fix", () => {
    const walkedTranscript: NegReportTurn[] = [
      t("interviewer", "We're firm at 40 LPA, that's the ceiling."),
      t("candidate", "I was targeting 55. Can we come up at all?"),
      t("interviewer", "No, 40 is final."),
      t("candidate", "Then I'll have to walk away from this. I'll pass."),
    ];
    // Reconstruct the outcome exactly as evaluate-session does at the call site.
    const negOutcome: NegOutcome | undefined = walkedTranscript.some(
      (tt) => tt.role === "candidate" && isWalkAway(tt.text),
    )
      ? "walked-away"
      : undefined;
    expect(negOutcome).toBe("walked-away");
    const r = buildDeterministicNegotiationReport(walkedTranscript, negOutcome);
    expect(r.fixes.map((f) => f.text)).not.toContain(WALKAWAY_FIX);
  });

  it("caller-threading: a non-walk-away transcript leaves the outcome undefined (fix behaviour unchanged)", () => {
    const noWalk: NegReportTurn[] = [
      t("interviewer", "We can offer 48 LPA."),
      t("candidate", "Could we push to 52? I was hoping for a bit more."),
      t("interviewer", "We can do 50."),
      t("candidate", "That works for me. Happy to accept 50."),
    ];
    const negOutcome: NegOutcome | undefined = noWalk.some(
      (tt) => tt.role === "candidate" && isWalkAway(tt.text),
    )
      ? "walked-away"
      : undefined;
    expect(negOutcome).toBeUndefined();
    // With no deadlock outcome threaded, the fix still surfaces (no floor set).
    const r = buildDeterministicNegotiationReport(noWalk, negOutcome);
    expect(r.fixes.map((f) => f.text)).toContain(WALKAWAY_FIX);
  });

  it("still emits the walk-away-floor fix on an accepted session with no floor set", () => {
    const acceptedNoFloor: NegReportTurn[] = [
      t("interviewer", "We can offer 48 LPA."),
      t("candidate", "Could we push to 52? I was hoping for a bit more."),
      t("interviewer", "We can do 50."),
      t("candidate", "That works for me. Happy to accept 50."),
    ];
    const r = buildDeterministicNegotiationReport(acceptedNoFloor, "accepted");
    expect(r.fixes.map((f) => f.text)).toContain(WALKAWAY_FIX);
    // And with no outcome threaded (undefined), behaviour is unchanged (emits).
    const noOutcome = buildDeterministicNegotiationReport(acceptedNoFloor);
    expect(noOutcome.fixes.map((f) => f.text)).toContain(WALKAWAY_FIX);
  });

  it("yields a report shape the assembly's validateReportShape accepts", () => {
    const synth = buildDeterministicNegotiationReport(STRONG);
    // Mirror the minimal report the handler assembles from the synth slice:
    // overallScore + a perQuestion array (the assembly defaults it to []).
    const reportLike = {
      overallScore: synth.overallScore,
      perQuestion: [] as unknown[],
    };
    const transcript = STRONG.map((t) => ({ role: t.role, text: t.text }));
    expect(validateReportShape(reportLike, transcript as never)).toBe(true);
  });

  /* S6-B7 — walk-away-floor fix must NOT fire when the candidate already stated
     an explicit floor using phrasing the original pattern set missed. The bug:
     candidate said "I won't sign for anything less than ₹200 LPA" but the report
     still coached them to "State a walk-away floor" — a direct contradiction. */
  it("S6-B7: does NOT emit walk-away-floor fix when candidate stated floor via 'won't sign for anything less than'", () => {
    const floorStated: NegReportTurn[] = [
      t("interviewer", "We can offer 35 LPA for this role."),
      t("candidate", "I appreciate the offer but I won't sign for anything less than 200 LPA."),
      t("interviewer", "That's above our band, we can't match that."),
      t("candidate", "Then I'm afraid we can't proceed. I won't settle for less."),
    ];
    const r = buildDeterministicNegotiationReport(floorStated);
    expect(r.fixes.map((f) => f.text)).not.toContain(WALKAWAY_FIX);
  });

  it("S6-B7: does NOT emit walk-away-floor fix on 'won't go below' phrasing", () => {
    const floor2: NegReportTurn[] = [
      t("interviewer", "We're offering 40 LPA."),
      t("candidate", "I won't go below 48. That's my minimum."),
    ];
    const r = buildDeterministicNegotiationReport(floor2);
    expect(r.fixes.map((f) => f.text)).not.toContain(WALKAWAY_FIX);
  });

  it("S6-B7: does NOT emit walk-away-floor fix on 'bottom line' / 'minimum is' phrasing", () => {
    const floor3: NegReportTurn[] = [
      t("interviewer", "The offer is 45 LPA."),
      t("candidate", "My bottom line is 50. Anything less than that is a non-starter."),
    ];
    const r = buildDeterministicNegotiationReport(floor3);
    expect(r.fixes.map((f) => f.text)).not.toContain(WALKAWAY_FIX);
  });
});
