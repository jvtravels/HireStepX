/* LN1 / Audit Pass 4 (PDF#27, 2026-05-17) — universal probe-opener
 * rotation.
 *
 * When the FL2 ACK-bridge doesn't fire (no non-trivial prior candidate
 * utterance) but we're past turn 0, the canonical layer prepends a
 * decorative opener from NON_ACK_PROBE_OPENERS rotated by turnIndex.
 * This gives consecutive probes variety so the bot doesn't sound rote.
 *
 * Contract:
 *   - turn 0 → no opener (the open-with-offer body carries its own).
 *   - non-trivial prior utterance → FL2 bridge fires; opener suppressed.
 *   - trivial / absent prior utterance + probe kind + turn > 0 →
 *     opener rotates through NON_ACK_PROBE_OPENERS deterministically.
 *   - non-probe kinds → no opener.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import {
  pickProbeOpener,
  renderCanonicalProse,
} from "../../server-handlers/_canonical-prose";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: false,
};

function mkState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return Object.assign(
    initState({ sessionId: "ln1", role: "swe", company: "acme", band: BAND }),
    overrides,
  );
}

describe("LN1 — pickProbeOpener helper contract", () => {
  it("turn 0 → empty opener (no rotation at session start)", () => {
    const s = mkState({ turnIndex: 0 });
    expect(pickProbeOpener(s, "discovery-probe")).toBe("");
  });

  it("non-probe kind (counter-offer) → empty opener", () => {
    const s = mkState({ turnIndex: 3 });
    expect(pickProbeOpener(s, "counter-offer")).toBe("");
  });

  it("probe kind + turn > 0 + trivial prior utterance → non-empty opener (decorative)", () => {
    const s = mkState({
      turnIndex: 1,
      conversationLog: [
        { speaker: "ai", text: "What's your current CTC?" },
        { speaker: "candidate", text: "Sure." },
      ],
    });
    /* Trivial single-word reply → FL2 bridge suppressed, LN1 opener
     * applies. Rotation index 1 in NON_ACK_PROBE_OPENERS = "Quick one —". */
    const opener = pickProbeOpener(s, "discovery-probe");
    expect(opener).toBe("Quick one —");
  });

  it("probe kind + turn > 0 + NON-trivial prior utterance → empty opener (FL2 bridge owns it)", () => {
    const s = mkState({
      turnIndex: 1,
      conversationLog: [
        { speaker: "ai", text: "What's your current CTC?" },
        { speaker: "candidate", text: "I'd rather not share that yet, frankly." },
      ],
    });
    /* Non-trivial reply → FL2 bridge fires, LN1 returns empty so the
     * two layers don't double-up. */
    expect(pickProbeOpener(s, "discovery-probe")).toBe("");
  });

  it("rotation is deterministic across turn indices", () => {
    /* NON_ACK_PROBE_OPENERS = ["So,", "Quick one —", ""].
     * S2/S4 fix (2026-06-19): "Coming to" was dropped — it is a clause
     * lead-in that demands an object noun, so gluing it onto a fresh
     * capitalized sentence produced mangled prose ("Coming to Let's start
     * with…"). Rotation is now modulo 3. */
    const expected = ["So,", "Quick one —", ""];
    for (let t = 1; t <= 8; t++) {
      const s = mkState({
        turnIndex: t,
        conversationLog: [
          { speaker: "ai", text: "ack?" },
          { speaker: "candidate", text: "ok" },
        ],
      });
      const idx = t % 3;
      expect(pickProbeOpener(s, "discovery-probe")).toBe(expected[idx]);
    }
  });
});

describe("LN1 — renderCanonicalProse applies opener rotation on probe kinds", () => {
  it("trivial prior utterance + discovery-probe → canonical leads with rotation opener", () => {
    const s = mkState({
      turnIndex: 1, // idx 1 → "Quick one —"
      conversationLog: [
        { speaker: "ai", text: "What's your current CTC?" },
        { speaker: "candidate", text: "Sure." },
      ],
    });
    const action: NextAction = {
      kind: "discovery-probe",
      item: "currentCtc",
      ask: "",
    } as NextAction;
    const line = renderCanonicalProse(action, s);
    expect(line.startsWith("Quick one — ")).toBe(true);
  });

  it("non-trivial prior utterance → FL2 bridge wins; no LN1 opener", () => {
    const s = mkState({
      turnIndex: 1,
      conversationLog: [
        { speaker: "ai", text: "What's your current CTC?" },
        { speaker: "candidate", text: "I'd rather not share that yet." },
      ],
    });
    const action: NextAction = {
      kind: "discovery-probe",
      item: "currentCtc",
      ask: "",
    } as NextAction;
    const line = renderCanonicalProse(action, s);
    /* FL2 bridge fires — line starts with one of "Got it." / "Noted." /
     * "Okay.", NOT the LN1 rotation opener. */
    expect(/^(?:Got it\.|Noted\.|Okay\.)/.test(line)).toBe(true);
    expect(line.startsWith("Quick one —")).toBe(false);
    expect(line.startsWith("So,")).toBe(false);
  });
});
