/* F7 + F3 (Audit Pass 2, PDF#25, 2026-05-16) — ACK-template ↔ state
 * invariant + session#25 regression.
 *
 * F7: every ACK template requires its state field to be non-null.
 *     buildDiscoveryAck drops the prefix when the field is empty;
 *     validateRestyle rejects ack-without-disclosure when a restyle
 *     names an ACK keyword the state cannot back.
 * F3: regression — the exact "Fair enough on your current compensation"
 *     line that surfaced when candidateCurrentCtc was null is rejected. */
import { describe, it, expect } from "vitest";
import { validateRestyle } from "../../server-handlers/_response-pipeline";
import {
  ACK_TEMPLATES,
  buildDiscoveryAck,
  getAckTemplate,
} from "../../server-handlers/_canonical-prose";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 22, maxStretch: 30, walkAway: 18, hasEquity: false };
const mkState = (overrides: Partial<NegotiationState> = {}): NegotiationState => {
  const s = initState({ sessionId: "s-ack-invariant", role: "swe", company: "acme", band: BAND });
  return Object.assign(s, overrides);
};

describe("F7 — AckTemplate ↔ state invariant", () => {
  it("every ACK_TEMPLATES entry has all four required fields populated", () => {
    for (const t of ACK_TEMPLATES) {
      expect(t.kind).toBeTruthy();
      expect(t.canonical).toBeTruthy();
      expect(typeof t.requires).toBe("function");
      expect(t.restyleKeywordRe instanceof RegExp).toBe(true);
    }
    expect(ACK_TEMPLATES.length).toBe(6);
  });

  it("getAckTemplate returns the entry for each known kind", () => {
    for (const kind of ["expectedCtc", "currentCtc", "fixedVariableSplit", "noticePeriod", "competingOffer", "valueProof"] as const) {
      const t = getAckTemplate(kind);
      expect(t.kind).toBe(kind);
    }
  });

  it("buildDiscoveryAck DROPS expected-CTC prefix when state.candidateTarget is null", () => {
    const s = mkState({ candidateTarget: null });
    const ack = buildDiscoveryAck({ disclosedExpectedCtc: true } as never, "currentCtc", s);
    expect(ack).toBeNull();
  });

  it("buildDiscoveryAck EMITS expected-CTC prefix when state.candidateTarget is set", () => {
    const s = mkState({ candidateTarget: 32 });
    const ack = buildDiscoveryAck({ disclosedExpectedCtc: true } as never, "currentCtc", s);
    expect(ack).toBe("Noted on the expected fitment —");
  });

  it("buildDiscoveryAck DROPS current-CTC prefix when state.candidateCurrentCtc is null", () => {
    const s = mkState({ candidateCurrentCtc: null });
    const ack = buildDiscoveryAck({ disclosedCurrentCtc: true } as never, "noticePeriod", s);
    expect(ack).toBeNull();
  });

  it("validateRestyle PASSES ack referencing the current side when candidateCurrentCtc is set", () => {
    const canonical = "Got it on the current side — what's your expected fitment?";
    const restyle = "Got it on the current side. What's your expected fitment?";
    const r = validateRestyle(canonical, restyle, mkState({ candidateCurrentCtc: 18, candidateTarget: 30 }));
    expect(r.valid).toBe(true);
  });

  it("validateRestyle REJECTS 'Noted on the expected side' when candidateTarget is null", () => {
    const canonical = "What's your current compensation?";
    const restyle = "Noted on the expected side. What's your current compensation?";
    const r = validateRestyle(canonical, restyle, mkState({ candidateTarget: null, candidateCurrentCtc: null }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("ack-without-disclosure");
  });
});

describe("F3 — Session #25 regression", () => {
  /* PDF#25 Audit Pass 2 — bot opened T1 with "Fair enough on your current
   * compensation" before the candidate had disclosed any current-CTC
   * number. State.candidateCurrentCtc was null. The F7 invariant must
   * reject this restyle so the canonical (non-ack discovery probe) ships
   * verbatim. */
  it("rejects the exact session#25 line 'Fair enough on your current compensation ...'", () => {
    const canonical = "Let's start with your current side — what's the total CTC at present?";
    const session25Line =
      "Fair enough on your current compensation. What's the total CTC at present?";
    const s = mkState({ candidateCurrentCtc: null, candidateTarget: null });
    const r = validateRestyle(canonical, session25Line, s);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("ack-without-disclosure");
  });
});
