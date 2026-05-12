/* Pure helpers for the canonical negotiation turn endpoint.
 * ─────────────────────────────────────────────────────────────────────
 * Splits the prompt-construction and post-LLM validation logic out of
 * the route handler so they can be unit-tested without HTTP / LLM IO.
 *
 * Design rules carry over from _negotiation-kernel.ts:
 *   - These functions are pure. No clock, no IO, no LLM, no env reads.
 *   - The KERNEL picks the lever + the number. The LLM only writes the
 *     prose around the kernel's decision. Validation here is the second
 *     line of defence (first being the schema-constrained prompt) for
 *     when the LLM tries to invent a different number anyway.
 *
 * Boundary with _negotiation-kernel.ts: the kernel knows about state;
 * this file knows about *generating text for* a kernel-picked move and
 * checking the LLM's output against state. No state transitions here.
 */

import type {
  NegotiationState,
  AiMove,
  NegotiationLever,
} from "./_negotiation-kernel";
import {
  findOutOfBandNumber,
  isVerbatimRepeat,
} from "./_negotiation-kernel";

/* ─── Prompt construction ─────────────────────────────────────────── */

/** Phrase guidance per lever — short, declarative, no fluff. Embedded
 *  in the system prompt so the LLM has a shape to fill. */
const LEVER_GUIDANCE: Record<NegotiationLever, string> = {
  "open-with-offer":
    "Present the offer cleanly. State the total CTC number, mention base + variable composition briefly, and invite the candidate's reaction.",
  "probe":
    "Ask the candidate what they're looking for. Do NOT propose a new number — you want their anchor first.",
  "counter-base":
    "Present the new total CTC. Acknowledge their ask, frame the bump as movement (not capitulation), and invite a response.",
  "joining-bonus":
    "Acknowledge cash base is at its ceiling. Offer a one-time joining bonus as a bridge. State an amount range if asked but do not change the base total.",
  "equity-grant":
    "Add an equity / RSU grant. Note the vesting shape ('25% per year over 4 years' or similar) and frame it as upside.",
  "notice-buyout":
    "Offer to buy out their notice period as a soft non-cash sweetener. Don't quantify unless they push.",
  "benefits-summary":
    "Recap the total non-cash package — health, learning budget, leave, hybrid policy. No new numbers.",
  "hold-firm":
    "State respectfully that this is final. Acknowledge their position. Invite them to think it over.",
  "close-acceptance":
    "Congratulate them. Restate the agreed total CTC. Mention next steps (offer letter, start date discussion).",
  "close-walkaway":
    "Acknowledge respectfully that this isn't going to work. Keep the door open for future roles. Brief, warm.",
  "close-stalemate":
    "Note that you've run out of turns. Suggest they take time and circle back. Brief, neutral.",
};

export interface BuildPromptInput {
  state: NegotiationState;
  move: AiMove;
  /** The candidate's most recent utterance — used as the immediate
   *  conversational target. Empty on the very first turn. */
  candidateAnswer: string;
}

/** Build a system+user prompt for the LLM. We pin facts as JSON so
 *  the LLM has no excuse to fabricate; the lever and the number are
 *  decided by the kernel and ECHOED here as the brief. */
export function buildAiPrompt(input: BuildPromptInput): { system: string; user: string } {
  const { state, move, candidateAnswer } = input;

  /* Static block first — Groq prompt caching keys on the longest
     shared prefix. Per CLAUDE.md, dynamic content goes LAST. */
  const system =
    "You are an experienced HR / hiring manager running a salary " +
    "negotiation with a candidate. Your job is to deliver the next " +
    "turn in the conversation in 1–3 short sentences. " +
    "STRICT RULES:\n" +
    " - You DO NOT invent salary numbers. The kernel has decided the " +
    "lever and (if any) the total CTC for this turn. Use them verbatim.\n" +
    " - Indian context. INR / LPA. Conversational, professional, " +
    "respectful — never sycophantic, never adversarial.\n" +
    " - No headers, no bullet lists, no markdown. Plain speech.\n" +
    " - Do NOT repeat your previous turn verbatim. If the kernel " +
    "picked the same lever twice, vary the wording substantially.\n" +
    " - 1–3 sentences. No filler openers ('Great question…').\n";

  const lever = move.lever;
  const guidance = LEVER_GUIDANCE[lever];

  const brief = {
    lever,
    newTotalLpa: move.newTotalLpa,
    rationale: move.rationale,
    phase: state.phase,
    turnIndex: state.turnIndex,
    band: state.band,
    candidateTarget: state.candidateTarget,
    candidateCurrentCtc: state.candidateCurrentCtc,
    competingOffer: state.competingOffer,
    highestOfferMade: state.highestOfferMade,
    leversUsedSoFar: state.leversUsed,
    lastAiText: state.lastAiText,
  };

  const user =
    `LEVER GUIDANCE:\n${guidance}\n\n` +
    `KERNEL BRIEF (authoritative, do not contradict):\n` +
    `${JSON.stringify(brief, null, 2)}\n\n` +
    (candidateAnswer
      ? `CANDIDATE JUST SAID:\n"${candidateAnswer.trim()}"\n\n`
      : "") +
    `Write your single next turn now. 1–3 sentences. ` +
    (move.newTotalLpa != null
      ? `Include the number ₹${move.newTotalLpa} LPA verbatim.`
      : `Do not introduce any salary number that is not already in the brief.`);

  return { system, user };
}

/* ─── Validation ──────────────────────────────────────────────────── */

export type ValidationFailure =
  | { kind: "out-of-band"; number: number }
  | { kind: "verbatim-repeat" }
  | { kind: "missing-required-number"; required: number }
  | { kind: "empty" };

export interface ValidationResult {
  ok: boolean;
  failures: ValidationFailure[];
}

/** Validate the LLM-generated text against the kernel-chosen move and
 *  the band. Returns all failures (not just the first) so the caller
 *  can decide whether to retry or hard-fall back. Pure. */
export function validateAiText(
  text: string,
  state: NegotiationState,
  move: AiMove,
): ValidationResult {
  const failures: ValidationFailure[] = [];
  const t = (text || "").trim();

  if (!t) {
    failures.push({ kind: "empty" });
    return { ok: false, failures };
  }

  /* Out-of-band number check — guards against the LLM inventing a
     counter the kernel didn't authorise. */
  const oob = findOutOfBandNumber(t, state.band);
  if (oob != null) failures.push({ kind: "out-of-band", number: oob });

  /* Verbatim-repeat — content-prefix fingerprint match against the
     previous AI turn (e.g. "Could you tell me about a time when…"
     fired twice in a row in the Bombay Design Centre session). */
  if (isVerbatimRepeat(t, state)) failures.push({ kind: "verbatim-repeat" });

  /* If the kernel said "use this number", the LLM must include it.
     We accept "₹X" / "X LPA" / "X lakhs" forms. */
  if (move.newTotalLpa != null) {
    const n = move.newTotalLpa;
    const numStr = String(n);
    const hasNumber = new RegExp(`\\b${numStr.replace(".", "\\.")}\\b`).test(t);
    if (!hasNumber) {
      failures.push({ kind: "missing-required-number", required: n });
    }
  }

  return { ok: failures.length === 0, failures };
}

/* ─── Last-resort fallback text ───────────────────────────────────── */

/** If the LLM fails repeatedly (validation, timeout, or no key set),
 *  produce a deterministic line that satisfies the move. Boring but
 *  shippable — better than a stuck UI. Pure. */
export function deterministicFallbackText(state: NegotiationState, move: AiMove): string {
  const n = move.newTotalLpa;
  switch (move.lever) {
    case "open-with-offer":
      return `Our offer for this role is ₹${n} LPA total CTC. What's your reaction?`;
    case "probe":
      return `Before we go further — what range were you expecting for this role?`;
    case "counter-base":
      return `We can stretch the base to ₹${n} LPA total. Does that work for you?`;
    case "joining-bonus":
      return `We're at the ceiling on base, but we can add a joining bonus on top. Would that bridge the gap?`;
    case "equity-grant":
      return `We can add an equity grant vesting over four years on top of the ₹${state.highestOfferMade} LPA base. Interested?`;
    case "notice-buyout":
      return `We can also buy out your notice period if that helps. Would that change things?`;
    case "benefits-summary":
      return `Beyond cash, the package includes health cover, learning budget, and flexible hybrid. Worth factoring in.`;
    case "hold-firm":
      return `₹${state.highestOfferMade} LPA is what we can do for this role. Take your time and let us know.`;
    case "close-acceptance":
      return `Wonderful — we'll send the offer letter for ₹${state.highestOfferMade} LPA shortly. Welcome aboard.`;
    case "close-walkaway":
      return `I understand. Thanks for the conversation — we'd love to stay in touch for future roles.`;
    case "close-stalemate":
      return `We've covered a lot. Take some time and let us know how you'd like to proceed.`;
  }
}
