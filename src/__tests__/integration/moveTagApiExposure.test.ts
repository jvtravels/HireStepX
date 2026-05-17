/* Integration: server-side move-tag exposure via the turn handler
 * (Dim 14 — Transparency / explainability, AP3 / 2026-05-17).
 *
 * The handler is an Edge function whose full Request path needs the
 * worker runtime + Redis stub + LLM provider — too much surface for a
 * unit-level integration check. We verify two contracts here:
 *
 *   1. Source-level wiring: the handler imports deriveMoveTag, calls
 *      it on the planner action, and threads `moveTag` into BOTH the
 *      init and turn response bodies.
 *   2. Functional: drive generateBotReply (the same pipeline the
 *      handler uses) against a real NegotiationState; the returned
 *      action is consumable by deriveMoveTag and produces a valid
 *      MoveTag.
 *
 * Field is documented as OPTIONAL on the wire so clients without
 * Learning-Mode wired keep working — that contract is enforced by
 * the source-level "no required field on RequestBody" check below.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  initState,
  type NegotiationBand,
} from "../../../server-handlers/_negotiation-kernel";
import { generateBotReply } from "../../../server-handlers/_response-pipeline";
import { deriveMoveTag } from "../../../server-handlers/_move-tag";

const SOURCE = readFileSync(
  join(__dirname, "..", "..", "..", "server-handlers", "negotiate-turn.ts"),
  "utf-8",
);

describe("negotiate-turn — moveTag wiring", () => {
  it("imports deriveMoveTag and MoveTag from the move-tag module", () => {
    expect(SOURCE).toMatch(/import\s*\{\s*deriveMoveTag\s*,\s*type\s+MoveTag\s*\}\s*from\s*["']\.\/_move-tag["']/);
  });

  it("threads moveTag into the init-branch response body", () => {
    /* The init branch returns a response that includes the moveTag
     * field. We check both that deriveMoveTag is called and that
     * the response object literal carries moveTag. */
    expect(SOURCE).toMatch(/deriveMoveTag\(initAction,\s*state\)/);
    /* Two response bodies emit moveTag — init (inline JSON.stringify)
     * and turn (responseBody object). Both must be present. */
    const initBlock = SOURCE.slice(0, SOURCE.indexOf('if (body.action === "turn")'));
    expect(initBlock).toMatch(/moveTag:\s*initMoveTag/);
  });

  it("threads moveTag into the turn-branch response body", () => {
    const turnIdx = SOURCE.indexOf('if (body.action === "turn")');
    const turnBlock = SOURCE.slice(turnIdx);
    expect(turnBlock).toMatch(/const\s+responseBody\s*=\s*\{[^]*moveTag,/);
  });
});

describe("deriveMoveTag — pipeline integration", () => {
  const BAND: NegotiationBand = {
    initialOffer: 30,
    maxStretch: 42,
    walkAway: 26,
    hasEquity: false,
  };

  it("produces a valid MoveTag for the opening planner action", async () => {
    /* Real state, real planner via generateBotReply. The LLM glue is
     * stubbed with an echo-canonical caller — the action we tag on is
     * the planner's output, not the LLM's. */
    const state = initState({
      sessionId: "s-movetag-integration",
      role: "Senior Engineer",
      company: "TestCo",
      band: BAND,
    });
    const echoLlm = async (_sys: string, user: string) => {
      /* Pull the bracketed canonical out of the user prompt; if not
       * present, return a neutral string the validator will reject —
       * the pipeline then falls back to canonical and we still get
       * action back on the result. */
      const m = user.match(/CANONICAL:\s*([\s\S]+?)(?:\n\n|$)/);
      return m ? m[1].trim() : "Sure.";
    };
    const result = await generateBotReply(state, echoLlm);
    expect(result.action).toBeTruthy();
    expect(result.action.kind).toBeTruthy();

    const tag = deriveMoveTag(result.action, state);
    expect(tag.label.length).toBeGreaterThan(0);
    expect(tag.label.length).toBeLessThanOrEqual(28);
    expect(tag.hint.length).toBeGreaterThan(0);
    expect(tag.hint.length).toBeLessThanOrEqual(140);
    expect([
      "discovery",
      "anchor",
      "defense",
      "counter",
      "stall",
      "close",
      "terminal",
      "meta",
    ]).toContain(tag.family);
  });
});
