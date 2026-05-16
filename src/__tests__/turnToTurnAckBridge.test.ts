/* FL2 / Audit Pass 4 (PDF#27, 2026-05-17) — turn-to-turn ACK bridge.
 *
 * When the candidate's prior utterance was non-trivial (>=3 words OR a
 * number) and the canonical body for a probe-kind doesn't already lead
 * with a disclosure-ACK, the kernel must prepend a neutral bridge so
 * the bot doesn't read as transactional. The validator rejects
 * restyles that strip the bridge entirely (reason: `no-turn-bridge`).
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";
import { validateRestyle } from "../../server-handlers/_response-pipeline";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: false,
};

function mkState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return Object.assign(
    initState({ sessionId: "fl2", role: "swe", company: "acme", band: BAND }),
    overrides,
  );
}

const PROBE: NextAction = {
  kind: "discovery-probe",
  item: "currentCtc",
  ask: "",
} as NextAction;

describe("FL2 — canonical layer prepends neutral bridge for probes after non-trivial candidate utterance", () => {
  it("turn>0, non-trivial candidate reply, no disclosure → canonical leads with neutral ACK", () => {
    const s = mkState({
      turnIndex: 2,
      conversationLog: [
        { speaker: "ai", text: "Thanks for making the time. What's your current CTC?" },
        { speaker: "candidate", text: "I'd rather not share that yet, frankly." },
      ],
    });
    const line = renderCanonicalProse(PROBE, s);
    expect(/^(?:Got it\.|Right\.|Okay\.)/.test(line)).toBe(true);
  });

  it("turn>0 with a numeric reply (1-word w/ digits) still triggers the bridge", () => {
    const s = mkState({
      turnIndex: 1,
      conversationLog: [
        { speaker: "ai", text: "What's your current CTC?" },
        { speaker: "candidate", text: "18" },
      ],
    });
    const line = renderCanonicalProse(PROBE, s);
    expect(/^(?:Got it\.|Right\.|Okay\.)/.test(line)).toBe(true);
  });

  it("trivial single-word reply ('okay'/'yes') → no bridge prepended", () => {
    const s = mkState({
      turnIndex: 1,
      conversationLog: [
        { speaker: "ai", text: "What's your current CTC?" },
        { speaker: "candidate", text: "Sure." },
      ],
    });
    const line = renderCanonicalProse(PROBE, s);
    expect(/^(?:Got it\.|Right\.|Okay\.)/.test(line)).toBe(false);
  });

  it("turn 0 (no candidate utterance yet) → no bridge", () => {
    const s = mkState({ turnIndex: 0 });
    const line = renderCanonicalProse(PROBE, s);
    expect(/^(?:Got it\.|Right\.|Okay\.)/.test(line)).toBe(false);
  });

  it("non-probe kind (counter-offer) → no bridge even after non-trivial utterance", () => {
    const s = mkState({
      turnIndex: 3,
      candidateCurrentCtc: 18,
      counterRound: 0,
      conversationLog: [
        { speaker: "candidate", text: "I'd be looking at thirty-five LPA total." },
      ],
    });
    const action: NextAction = {
      kind: "counter-offer",
      counterTotalLpa: 26,
    } as NextAction;
    const line = renderCanonicalProse(action, s);
    expect(/^(?:Got it\.|Right\.|Okay\.)\s/.test(line)).toBe(false);
  });

  it("disclosure-ACK on probe (kernel buildDiscoveryAck) suppresses neutral bridge", () => {
    /* When state.candidateCurrentCtc is set AND lastTurnDelta marks the
     * disclosure, the kernel's existing disclosure-ACK fires; the FL2
     * bridge MUST NOT layer on top ("Got it. Got it on the current side
     * — …"). */
    const s = mkState({
      turnIndex: 2,
      candidateCurrentCtc: 18,
      conversationLog: [
        { speaker: "candidate", text: "My current CTC is 18 LPA total." },
      ],
      lastTurnDelta: { disclosedCurrentCtc: true } as never,
    });
    /* Probe item != currentCtc so the disclosure-ACK can fire. */
    const action: NextAction = {
      kind: "discovery-probe",
      item: "noticePeriod",
      ask: "",
    } as NextAction;
    const line = renderCanonicalProse(action, s);
    expect(line).toMatch(/^Got it on the current side/);
    /* Bridge ACK regex would prefix-match if duplicated. */
    expect(line).not.toMatch(/^Got it\.\s+Got it on/);
  });
});

describe("FL2 — validator rejects restyles that strip the bridge entirely", () => {
  it("canonical has bridge, restyle strips it → no-turn-bridge", () => {
    const canonical = "Got it. Let's start with your current side — what's the total CTC at present?";
    const restyle = "Let's start with your current side — what's the total CTC at present?";
    const action: NextAction = {
      kind: "discovery-probe",
      item: "currentCtc",
      ask: "",
    } as NextAction;
    const r = validateRestyle(canonical, restyle, mkState(), action);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("no-turn-bridge");
  });

  it("canonical has bridge, restyle keeps a different ACK token → valid", () => {
    const canonical = "Got it. Let's start with your current side — what's the total CTC at present?";
    const restyle = "Noted — what's the total CTC at present on your current side?";
    const action: NextAction = {
      kind: "discovery-probe",
      item: "currentCtc",
      ask: "",
    } as NextAction;
    const r = validateRestyle(canonical, restyle, mkState(), action);
    expect(r.valid).toBe(true);
  });

  it("non-probe ACK strip still reports legacy ack-prefix-stripped (not no-turn-bridge)", () => {
    /* Use a non-probe canonical with an ack token (e.g. close-recap
     * style starting with "Noted") — kind: "counter-offer" stub. */
    const canonical = "Noted on your push. We can revise the fitment to ₹26L total. How does that look from your side?";
    const restyle = "We can revise the fitment to ₹26L total. How does that look from your side?";
    const action: NextAction = {
      kind: "counter-offer",
      counterTotalLpa: 26,
    } as NextAction;
    const r = validateRestyle(canonical, restyle, mkState(), action);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("ack-prefix-stripped");
  });
});
