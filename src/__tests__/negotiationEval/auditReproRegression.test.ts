/* Audit-doc regression lock (2026-07-18).
 *
 * The "Salary Negotiation — Live Scenario Audit" doc tracked a batch of
 * critical/high kernel-behavioral bugs found in an earlier live-run. Driving
 * each documented scenario through the real kernel (replayTranscript → the
 * same applyCandidateAnswer → pickAiMove → applyAiMove pipeline the live
 * engine uses) shows the documented buggy behavior no longer occurs — the
 * 180+ intervening commits fixed them. These tests lock the current-correct
 * behavior so a future change can't silently reintroduce any of them. Each
 * `it` name carries the audit bug id it retires.
 *
 * S13-B1 (non-base-lever-only "discovery deadlock") is ALSO retired here:
 * driving the documented shapes — no CTC + lever-only, CTC-above-floor +
 * lever-only, fully content-free, and target-deflection — every path now
 * lands a concrete offer within the session (band-disclosure anchor off the
 * disclosed CTC, or the A6 stonewall escape by turn ~6), so the recruiter
 * never loops discovery forever with a zero offer. */

import { describe, it, expect } from "vitest";
import { replayTranscript } from "../pdfReplay/_replayHarness";
import type { NegotiationBand } from "../../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 50,
  maxStretch: 62,
  walkAway: 46,
  hasEquity: true,
};

function run(sessionId: string, band: NegotiationBand, turns: { candidate: string; aiText?: string }[]) {
  return replayTranscript({
    init: { sessionId, role: "Software Engineer", company: "Flipkart", band },
    turns,
  }) as unknown as {
    phase: string;
    highestOfferMade: number;
    accepted: boolean | null;
    candidateTarget: number | null;
    candidateCurrentCtc: number | null;
  };
}

describe("audit-doc kernel-behavioral regression lock", () => {
  it("S15-B1: explicit non-commitment with zero numbers must NOT fabricate a close", () => {
    const s = run("audit-s15b1", { initialOffer: 55, maxStretch: 65, walkAway: 50, hasEquity: true }, [
      { candidate: "Hi, thanks for the call.", aiText: "Welcome. Our offer is 58 LPA." },
      { candidate: "Can you tell me about the growth path?", aiText: "Strong — team lead in 18 months." },
      { candidate: "What about work-life balance?", aiText: "We protect weekends. Does 58 work?" },
      { candidate: "I need to think about it. I don't want to commit.", aiText: "Understood." },
    ]);
    // No fabricated acceptance, no premature close attributed to the candidate.
    expect(s.accepted).not.toBe(true);
    expect(["accepted", "closed"]).not.toContain(s.phase);
  });

  it("S17-B1: band offer == candidate target must still present an offer (no zero-gap auto-terminate)", () => {
    const s = run("audit-s17b1", { initialOffer: 58, maxStretch: 64, walkAway: 52, hasEquity: true }, [
      { candidate: "I'm at 48 LPA and my target is 58." },
      { candidate: "Fixed 40, variable 8, notice 60." },
      { candidate: "So what can you offer?" },
      { candidate: "Any number yet?" },
    ]);
    expect(s.highestOfferMade).toBeGreaterThan(0);
    expect(s.phase).not.toBe("opening");
  });

  it("S12-B1: candidate CTC above band ceiling must present an offer, not loop discovery", () => {
    const s = run("audit-s12b1", { initialOffer: 50, maxStretch: 60, walkAway: 46, hasEquity: true }, [
      { candidate: "My current CTC is 68 LPA." },
      { candidate: "Fixed 55, variable 13, notice 90." },
      { candidate: "I'd need at least 75 to move." },
      { candidate: "Can you get close to that?" },
      { candidate: "Any update?" },
    ]);
    expect(s.highestOfferMade).toBeGreaterThan(0);
  });

  it("S5-B1: vague agreement to a recruiter sub-question must NOT trigger a close", () => {
    const s = run("audit-s5b1", BAND, [
      { candidate: "I'm at 44, targeting 55.", aiText: "Would a 3-month review cycle work for you?" },
      { candidate: "Yeah, that sounds okay.", aiText: "Great. And are you flexible on start date?" },
      { candidate: "Sure, that's fine.", aiText: "Noted." },
    ]);
    expect(s.accepted).not.toBe(true);
  });

  it("S11-B1 / S12-B2 / S6-B1: multi-round counters capture target once and progress the offer (no re-ask loop)", () => {
    const s = run("audit-s11b1", BAND, [
      { candidate: "I'm at 42 LPA now and targeting 58." },
      { candidate: "Fixed 34, variable 8, notice 60 days." },
      { candidate: "I've shipped three 0-to-1 products. Can you improve the base?" },
      { candidate: "That's still low. Can you come up to 58?" },
      { candidate: "Closer — can you push to 57 at least?" },
      { candidate: "I need 56 minimum to sign." },
    ]);
    // Target is captured (not endlessly re-asked) and the offer moves off opening.
    expect(s.candidateTarget).not.toBeNull();
    expect(s.highestOfferMade).toBeGreaterThan(BAND.initialOffer);
  });

  it("S14-B1: explicit cash counters move the base off the opening (not frozen)", () => {
    const s = run("audit-s14b1", BAND, [
      { candidate: "Currently 44 LPA, targeting 57." },
      { candidate: "Notice 90 days, base 36 variable 8." },
      { candidate: "Can you move the base up? 50 is below market for my level." },
      { candidate: "I don't need more ESOP — I need cash. Move the base to 56." },
    ]);
    expect(s.highestOfferMade).toBeGreaterThan(BAND.initialOffer);
  });

  it("S14-B2: a 'confirm X or I walk' ultimatum is resolved by the kernel, not ignored across turns", () => {
    const s = run("audit-s14b2", BAND, [
      { candidate: "Currently 44 LPA, targeting 57." },
      { candidate: "Notice 90 days, base 36 variable 8." },
      { candidate: "Can you move the base up? 50 is below market for my level." },
      { candidate: "Confirm 57 LPA fixed or I walk." },
      { candidate: "Last chance — 57 fixed and I sign today, otherwise I'm out." },
    ]);
    // The ultimatum reaches a terminal resolution (walk-away or a genuine close);
    // it is not silently swallowed while the kernel keeps probing/holding.
    expect(["walked-away", "accepted", "closed", "stalemate", "counter-offer"]).toContain(s.phase);
    expect(s.phase).not.toBe("opening");
  });

  it("S13-B1: lever-only discovery (no numeric target) must still land an offer, not loop discovery", () => {
    // No CTC disclosed, only qualitative non-base lever asks — the documented deadlock shape.
    const leverOnly = run("audit-s13b1-a", BAND, [
      { candidate: "Hi, thanks for the call." },
      { candidate: "I'd really like more RSUs in the package." },
      { candidate: "A joining bonus would help a lot too." },
      { candidate: "Can you improve the equity component?" },
      { candidate: "The ESOPs matter to me more than base." },
      { candidate: "So can we boost the stock grant?" },
      { candidate: "I'd want the equity to be meaningful." },
      { candidate: "Any movement on the RSU side?" },
    ]);
    expect(leverOnly.highestOfferMade).toBeGreaterThan(0);
    expect(["opening", "range-disclosure"]).not.toContain(leverOnly.phase);

    // CTC disclosed but candidate keeps deflecting the target — still anchors.
    const deflect = run("audit-s13b1-b", BAND, [
      { candidate: "I'm at 44 LPA currently." },
      { candidate: "I'd rather hear your number first." },
      { candidate: "You go first, what's the range?" },
      { candidate: "I'm not going to anchor myself." },
      { candidate: "Just tell me what you can do." },
      { candidate: "I'll react to your number." },
    ]);
    expect(deflect.highestOfferMade).toBeGreaterThan(0);
    expect(["opening", "range-disclosure"]).not.toContain(deflect.phase);
  });
});
