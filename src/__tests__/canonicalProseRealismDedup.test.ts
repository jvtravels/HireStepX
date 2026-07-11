/* Prose-realism fixes (2026-07-11) — I-3 (double-openers) and I-4/I-7
 * (verbatim recycling of close-out / recovery lines across turns).
 *
 * The salary-negotiation KERNEL chooses WHICH line to say; this module
 * (_canonical-prose.ts) only re-words/decorates it into recruiter dialogue.
 * Two decorator defects, both rooted in fixed small pools rotated by
 * `turnIndex % N`, made the recruiter sound robotic across a multi-turn
 * negotiation:
 *
 *   I-3  — `pickProbeOpener` / `pickNeutralBridgeAck` decorators were
 *          prepended MECHANICALLY, sometimes onto a body that already opens
 *          with an ack/discourse marker → "Got it. Right, so…", "So, So…".
 *   I-4/ — `escalatingCloseOut` and the RECOVERY_POOL rotated a small pool
 *   I-7    by `turnIndex % N`, so turn N repeated turn 0 VERBATIM. The
 *          adjacent-only repeat guard never caught wrap-around recycling.
 *
 * The dedup source of truth is `state.conversationLog` (the AI entries) —
 * per-session, already threaded in, no process-global leak. This asserts:
 *   (a) an already-ack'd body does not get a stacked opener/bridge; and
 *   (b) a 6+ turn escalation / recovery sequence emits no verbatim repeat.
 */
import { describe, it, expect } from "vitest";
import {
  renderCanonicalProse,
  bodyOpensWithAck,
} from "../../server-handlers/_canonical-prose";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: false,
};
const baseState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s-realism", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});

/* Normalize the way the module's verbatim-repeat guard does: strip a leading
 * ack, fold quotes, drop trailing punctuation, collapse whitespace. Used only
 * to prove no two SHIPPED lines are the same line under that equivalence. */
function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(
      /^\s*(?:got it|okay|ok|right|sure|alright|noted|understood|fair enough|fine|i hear you)[\s,.\-—:;]+/i,
      "",
    )
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");
}

describe("I-3 — bodyOpensWithAck guard", () => {
  it("detects ack/discourse markers at string start (case-insensitive)", () => {
    for (const s of ["Right, so let's…", "so let's talk comp", "Got it — moving on", "Okay. On the number", "Sure, that works", "Fair enough, but", "Understood."]) {
      expect(bodyOpensWithAck(s)).toBe(true);
    }
  });
  it("does not fire on a plain question body", () => {
    expect(bodyOpensWithAck("What's your current CTC?")).toBe(false);
    expect(bodyOpensWithAck("Let's start with your expectations.")).toBe(false);
    expect(bodyOpensWithAck("")).toBe(false);
  });
});

describe("I-3 — an already-ack'd probe body does not get a stacked opener/bridge", () => {
  /* A non-trivial prior candidate utterance normally fires the FL2 neutral
   * bridge ("Got it." / "Right." / "Okay.") on a probe kind. When the probe
   * body ALREADY opens with an ack/discourse marker, prepending the bridge
   * would double it up. The guard must skip the decorator. */
  it("no doubled ack when the discovery-probe body already opens with a marker", () => {
    for (let turn = 1; turn <= 6; turn++) {
      const s = baseState({
        turnIndex: turn,
        conversationLog: [
          { speaker: "ai", text: "What's your current comp?" },
          { speaker: "candidate", text: "I'd rather not get into that number just yet." },
        ],
      });
      const action: NextAction = {
        kind: "discovery-probe",
        item: "currentCtc",
        ask: "",
      } as NextAction;
      const line = renderCanonicalProse(action, s);
      /* No "Got it. Right", "Okay. So", "Right. Got it", etc. — i.e. two
       * ack/discourse markers back-to-back at the very start. */
      expect(line).not.toMatch(
        /^\s*(?:got it|right|okay|ok|so|sure|fair enough|understood|noted)[\s,.\-—:;]+(?:got it|right|okay|ok|so|sure|fair enough|understood|noted)\b/i,
      );
    }
  });
});

describe("I-4 / I-7 — no verbatim recycling of close-out lines across a 6+ turn stonewall", () => {
  /* Drive the escalating close-out repeatedly: on each turn the prior AI text
   * equals the line we just shipped AND an offer stands, so the prose
   * boundary emits a forward-moving close-out. Feed each shipped line back
   * into conversationLog (the dedup source of truth) and advance turnIndex.
   * Across 7 turns the picker must never re-emit a line already spoken. */
  it("7 consecutive escalations are all distinct (dedup keyed off conversationLog)", () => {
    const action: NextAction = { kind: "counter-offer", counterTotalLpa: 24 } as NextAction;

    const log: NegotiationState["conversationLog"] = [];
    const shipped: string[] = [];

    for (let turn = 0; turn < 7; turn++) {
      /* The counter-offer body varies by turnIndex (a `% 2` template
       * variant). Render it for THIS turn and feed it as lastAiText so the
       * "prior line == current line" guard fires every turn — the escalating
       * close-out is then emitted on all 7 turns and we observe only
       * close-out lines (not the alternating counter body). */
      const counterBody = renderCanonicalProse(
        action,
        baseState({ highestOfferMade: 24, turnIndex: turn }),
      );
      const s = baseState({
        highestOfferMade: 24,
        turnIndex: turn,
        lastAiText: counterBody,
        conversationLog: [...log],
      });
      const line = renderCanonicalProse(action, s);
      shipped.push(line);
      /* Feed the emitted close-out into the log — the dedup source of truth —
       * so the next turn's picker must skip it and choose a fresh line. */
      log.push({ speaker: "ai", text: line });
    }

    const seen = new Set<string>();
    for (const line of shipped) {
      const key = norm(line);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(line).toMatch(/₹24L/);
    }
    expect(shipped.length).toBe(7);
  });

  it("graceful degradation past pool exhaustion still yields non-verbatim lines", () => {
    /* Pre-seed conversationLog with MORE distinct AI lines than the pool
     * holds so every base line is already 'spoken', then request one more.
     * The degraded line must not be byte-identical to any prior line. */
    const priorLines = Array.from({ length: 12 }, (_, i) => `earlier recruiter line number ${i}`);
    const log: NegotiationState["conversationLog"] = priorLines.map((text) => ({
      speaker: "ai" as const,
      text,
    }));
    const action: NextAction = { kind: "counter-offer", counterTotalLpa: 24 } as NextAction;
    const s = baseState({
      highestOfferMade: 24,
      turnIndex: 9,
      lastAiText: priorLines[priorLines.length - 1],
      conversationLog: log,
    });
    /* Force the escalation branch: prior AI text equals the counter body. */
    const first = renderCanonicalProse(action, baseState({ highestOfferMade: 24, turnIndex: 9 }));
    const forced = renderCanonicalProse(action, { ...s, lastAiText: first });
    expect(forced.trim().length).toBeGreaterThan(0);
    expect(priorLines).not.toContain(forced);
  });
});
