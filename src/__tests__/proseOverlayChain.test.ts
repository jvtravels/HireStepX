/* 2026-05-30 conversational-realism — prose overlay chain integration.
 *
 * Verifies the three overlays (context-ref, persona-tic, fallibility)
 * chain in the documented order around the existing humanizer, each is
 * idempotent under re-application, and that the baseline (no sector,
 * no callTimeIso, baseline mood) path stays byte-identical.
 */
import { describe, it, expect } from "vitest";
import {
  applyFallibilityOverlay,
  applyPersonaTicSignature,
  applyContextRefOverlay,
} from "../../server-handlers/_recruiter-prose-realism";
import {
  chainProseOverlays,
} from "../../server-handlers/_canonical-prose";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: true,
};

const mk = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "po-chain", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});

describe("prose overlay chain — ordering", () => {
  it("context-ref prepends BEFORE persona-tic", () => {
    // Force a session/persona where ctxRef can fire.
    let found: string | null = null;
    for (let i = 0; i < 60 && found === null; i++) {
      const sid = `po-order-${i}`;
      const seed = "Base prose here without any tic phrase.";
      const afterRef = applyContextRefOverlay(seed, "edtech", sid);
      if (afterRef !== seed) {
        // After ref, persona-tic should not also fire (tic-signature only
        // fires when no existing sector-tic phrase is present in text;
        // many context-refs include candidate-irrelevant phrases that
        // don't shadow the tic detection). Verify ordering is honored.
        const afterTic = applyPersonaTicSignature(afterRef, sid, "edtech");
        // afterTic must start with the same context-ref prefix substring
        // (either by being unchanged or by having the tic stacked AHEAD).
        // The required ordering is: ctxRef is applied first, then tic.
        // So the ref must still be present somewhere in afterTic.
        expect(afterTic.includes("BYJU correction") || afterTic.includes("edtech reset") || afterTic.includes("funding winter")).toBe(true);
        found = sid;
      }
    }
    expect(found).not.toBeNull();
  });

  it("fallibility runs LAST — its sentinel skip honors prior overlays", () => {
    // Construct text that already has a fallibility sentinel ("wait")
    // in the leading 60 chars; fallibility must not fire.
    const text = "Wait — let me clarify the number, the offer is \u20B922L all-in.";
    const out = applyFallibilityOverlay(text, {
      mood: "cooled",
      turnIndex: 10,
      packageComplexity: 5,
      sessionId: "po-fall-1",
    });
    expect(out).toBe(text);
  });
});

describe("prose overlay chain — idempotency", () => {
  it("applyContextRefOverlay is idempotent when re-applied", () => {
    const sid = "po-ctx-idem";
    const persona = "edtech" as const;
    const text = "Some base prose without any anchor phrase.";
    const out1 = applyContextRefOverlay(text, persona, sid);
    const out2 = applyContextRefOverlay(out1, persona, sid);
    expect(out2).toBe(out1);
  });

  it("applyPersonaTicSignature is idempotent when re-applied", () => {
    const sid = "po-tic-idem";
    const persona = "bfsi" as const;
    // Find a session where tic actually fires
    let fired: { sid: string; text: string; out: string } | null = null;
    for (let i = 0; i < 80 && fired === null; i++) {
      const s = `${sid}-${i}`;
      const text = `Base prose variant ${i}.`;
      const out = applyPersonaTicSignature(text, s, persona);
      if (out !== text) {
        fired = { sid: s, text, out };
      }
    }
    expect(fired).not.toBeNull();
    if (fired) {
      const out2 = applyPersonaTicSignature(fired.out, fired.sid, persona);
      expect(out2).toBe(fired.out);
    }
  });

  it("applyFallibilityOverlay is idempotent when re-applied", () => {
    // After fallibility fires, the output contains a sentinel ("wait" /
    // "hold on" / "sorry") in the first 60 chars → second application is
    // a no-op.
    let fired: { ctx: Parameters<typeof applyFallibilityOverlay>[1]; out: string } | null = null;
    for (let i = 0; i < 200 && fired === null; i++) {
      const text = `\u20B922L total, with sweeteners.`;
      const ctx = {
        mood: "cooled" as const,
        turnIndex: 10,
        packageComplexity: 5,
        sessionId: `po-fall-idem-${i}`,
      };
      const out = applyFallibilityOverlay(text, ctx);
      if (out !== text) {
        fired = { ctx, out };
      }
    }
    expect(fired).not.toBeNull();
    if (fired) {
      const out2 = applyFallibilityOverlay(fired.out, fired.ctx);
      expect(out2).toBe(fired.out);
    }
  });
});

describe("prose overlay chain — baseline byte-identity", () => {
  it("chainProseOverlays is byte-identical to body when persona is 'default' (no sector)", () => {
    // Null sessionId → humanizer dice always misses; overlay gate also
    // skips since sessionId is empty. Snapshot/contract-test path.
    const s = mk({
      sessionId: null as unknown as string,
      recruiterSectorPersona: "default",
    });
    const body = "Could you walk me through your current package?";
    const out = chainProseOverlays(body, s);
    // With default sector + null candidateRegister + baseline mood +
    // midweek-standard timeContext, every overlay layer must be a no-op.
    expect(out).toBe(body);
  });

  it("chainProseOverlays leaves a frozen baseline string unchanged", () => {
    const s = mk({
      sessionId: null as unknown as string,
      recruiterSectorPersona: "default",
    });
    const frozen = "What are the joining timelines you're working with?";
    expect(chainProseOverlays(frozen, s)).toBe(frozen);
  });
});

describe("prose overlay chain — fallibility gate composition", () => {
  it("fallibility does not fire without a rupee figure", () => {
    const text = "Let me think about that one — no specific number yet.";
    const out = applyFallibilityOverlay(text, {
      mood: "cooled",
      turnIndex: 10,
      packageComplexity: 5,
      sessionId: "po-fall-no-rupee",
    });
    expect(out).toBe(text);
  });

  it("fallibility does not fire with rupee figure but no triggers (cooled/late/complex)", () => {
    const text = "The offer is \u20B922L all-in.";
    const out = applyFallibilityOverlay(text, {
      mood: "warm",
      turnIndex: 2,
      packageComplexity: 1,
      sessionId: "po-fall-no-trigger",
    });
    expect(out).toBe(text);
  });

  it("fallibility CAN fire with rupee figure + cooled mood + late turn + complex package (FNV gate)", () => {
    // Search a few session ids until the FNV gate fires.
    let fired = false;
    for (let i = 0; i < 100 && !fired; i++) {
      const text = `The offer is \u20B922L all-in.`;
      const out = applyFallibilityOverlay(text, {
        mood: "cooled",
        turnIndex: 10,
        packageComplexity: 5,
        sessionId: `po-fall-fire-${i}`,
      });
      if (out !== text) fired = true;
    }
    expect(fired).toBe(true);
  });
});
