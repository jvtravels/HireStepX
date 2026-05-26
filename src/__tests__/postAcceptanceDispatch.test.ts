/* F2 (2026-05-15) — post-acceptance dispatch wiring.
 *
 * The kernel attaches a `postAcceptanceMessage` to state at the moment
 * the phase transitions to `accepted`. The negotiate-turn handler must
 * then ensure that message is delivered to the candidate as part of the
 * close turn reply (so the recruiter is forced to surface the document
 * checklist + BGV + counter-offer-heads-up + joining-date lock instead
 * of leaving the LLM to improvise onboarding language).
 *
 * Coverage:
 *  - The kernel sets state.postAcceptanceMessage on every terminal-accept
 *    path (strict-accept, soft-accept, explicit-acceptance) — these are
 *    exercised in postAcceptanceOnboarding.test.ts.
 *  - This file asserts:
 *      (a) The dispatch wiring exists in negotiate-turn.ts (source).
 *      (b) Simulating the dispatch (kernel-built message + LLM stub text)
 *          produces a final reply containing the four required tokens.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyCandidateAnswer,
  initState,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";

const SOURCE = readFileSync(
  join(__dirname, "..", "..", "server-handlers", "negotiate-turn.ts"),
  "utf-8",
);

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: false };

function stateOnVergeOfAccept() {
  let s = initState({ sessionId: "s", role: "swe", company: "Acme", band: BAND });
  /* Walk the state through enough turns to clear minTurnsBeforeClose=8,
   * and seat a live offer. */
  s = { ...s, turnIndex: 9, highestOfferMade: 26, phase: "counter-offer" };
  return s;
}

describe("F2 — post-acceptance dispatch wiring", () => {
  it("negotiate-turn.ts appends state.postAcceptanceMessage to the close-turn reply", () => {
    /* The dispatch must run after the FINAL applyAiMove (so state.phase
     * is the terminal value) and before the response is serialized. */
    expect(SOURCE).toMatch(/state\.phase\s*===\s*["']accepted["']\s*&&\s*state\.postAcceptanceMessage/);
  });

  it("dispatch only fires for accepted phase, not walked-away", () => {
    /* Guard: walking-away path must not surface onboarding language. */
    const f2Start = SOURCE.indexOf("F2 (2026-05-15)");
    const dispatchBlock = SOURCE.slice(f2Start, f2Start + 1200);
    expect(dispatchBlock).toContain('state.phase === "accepted"');
    expect(dispatchBlock).not.toMatch(/state\.phase\s*===\s*["']walked-away["']/);
  });

  it("strict-accept flow attaches a message containing Aadhaar, PAN, BGV, and relieving-letter tokens", () => {
    /* PDF#45 follow-up (2026-05-25) — doc checklist trimmed to identity
     * docs (Aadhaar + PAN). The BGV partner section still mentions
     * relieving-letter chain as part of the async hand-off blurb. */
    const s = stateOnVergeOfAccept();
    const next = applyCandidateAnswer(s, "Yes, please send me the offer letter — I accept.");
    expect(next.phase).toBe("accepted");
    expect(next.postAcceptanceMessage).toBeDefined();
    const msg = next.postAcceptanceMessage!;
    expect(msg).toMatch(/Aadhaar/);
    expect(msg).toMatch(/PAN/);
    expect(msg).toMatch(/BGV/);
    expect(msg).toMatch(/[Rr]elieving-letter/);
  });

  it("dispatch concatenation preserves the LLM prose AND the kernel scaffold", () => {
    const s = stateOnVergeOfAccept();
    const next = applyCandidateAnswer(s, "Yes, please send me the offer letter — I accept.");
    const llmText = "Welcome aboard.";
    const final = next.postAcceptanceMessage && !llmText.includes(next.postAcceptanceMessage)
      ? llmText.trim() + "\n\n" + next.postAcceptanceMessage
      : llmText;
    expect(final).toContain("Welcome aboard.");
    expect(final).toContain("Aadhaar");
  });

  it("dispatch is idempotent — applying the same scaffold twice produces no duplication", () => {
    const s = stateOnVergeOfAccept();
    const next = applyCandidateAnswer(s, "Yes, please send me the offer letter — I accept.");
    const msg = next.postAcceptanceMessage!;
    const firstPass = "Welcome.\n\n" + msg;
    const secondPass = firstPass.includes(msg) ? firstPass : firstPass + "\n\n" + msg;
    const occurrences = secondPass.split("Aadhaar card").length - 1;
    expect(occurrences).toBe(1);
  });

  it("scaffold mentions all four core onboarding asks: docs, BGV, counter-offer, joining-date", () => {
    const s = stateOnVergeOfAccept();
    const next = applyCandidateAnswer(s, "Yes, please send me the offer letter — I accept.");
    const msg = next.postAcceptanceMessage!;
    expect(msg).toMatch(/Documents we'll need/);
    expect(msg).toMatch(/BGV/);
    expect(msg).toMatch(/retention counter/);
    expect(msg).toMatch(/joining date|joining-date/i);
  });

  /* PDF#48 follow-up (2026-05-26) — chunks shape.
   *
   * The kernel must populate `postAcceptanceFollowups` alongside the
   * joined `postAcceptanceMessage` so future engine work can fan out
   * one bubble per beat instead of dumping the entire onboarding
   * scaffold as a wall of text. Until the engine fans out, the
   * joined string remains canonical, so this test pins both the
   * chunks SHAPE and the joined-string EQUIVALENCE. */
  it("postAcceptanceFollowups is populated alongside postAcceptanceMessage", () => {
    const s = stateOnVergeOfAccept();
    const next = applyCandidateAnswer(s, "Yes, please send me the offer letter — I accept.");
    expect(next.postAcceptanceFollowups).toBeDefined();
    const chunks = next.postAcceptanceFollowups!;
    expect(Array.isArray(chunks)).toBe(true);
    /* Exactly 5 beats by default (congrats, docs, BGV, counter-offer
     * heads-up, joining-date lock). Both BGV + counter-offer are on
     * by default; the optional flags can drop them. */
    expect(chunks.length).toBe(5);
    /* Beat 1 is the headline — congrats + close lock. */
    expect(chunks[0]).toMatch(/Congratulations/);
    expect(chunks[0]).toMatch(/Locking the close/);
    /* Docs heading + items travel as a single beat so the future
     * fan-out doesn't render the heading and each item as separate
     * bubbles. */
    expect(chunks[1]).toMatch(/Documents we'll need/);
    expect(chunks[1]).toMatch(/Aadhaar/);
    expect(chunks[1]).toMatch(/PAN/);
    /* BGV alignment lives on its own beat. */
    expect(chunks[2]).toMatch(/BGV/);
    /* Counter-offer warning lives on its own beat — this is the
     * piece of news a candidate most needs to hear distinctly, not
     * buried mid-paragraph. */
    expect(chunks[3]).toMatch(/retention counter/);
    /* Joining-date lock closes. */
    expect(chunks[4]).toMatch(/joining date|joining-date/i);
  });

  it("joined postAcceptanceMessage uses paragraph breaks, not single newlines (readability)", () => {
    /* The prior single-newline join produced a wall-of-text on the
     * single-bubble consumer. Paragraph breaks ("\n\n") give the
     * candidate visible section spacing within the same bubble while
     * the engine fan-out is being designed. */
    const s = stateOnVergeOfAccept();
    const next = applyCandidateAnswer(s, "Yes, please send me the offer letter — I accept.");
    const msg = next.postAcceptanceMessage!;
    expect(msg).toContain("\n\n");
    /* Sanity: the joined string equals the chunks joined with \n\n. */
    expect(msg).toBe(next.postAcceptanceFollowups!.join("\n\n"));
  });
});
