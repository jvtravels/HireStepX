/* Kernel-first canonical prose (2026-05-16).
 *
 * ARCHITECTURAL INVERSION: previously the LLM authored bot prose and a
 * cascade of validators reacted to whatever it produced. That left an
 * open seam — every bug we shipped (HDFC RM ₹20 LPA anchor, repeated
 * probe questions, hallucinated facts) was a new LLM-author path that
 * bypassed the planner. The fix is to invert: the KERNEL authors the
 * prose, the LLM merely restyles it under strict constraint, and a
 * restyle-validator decides whether to ship the restyle or fall back
 * to the canonical line verbatim.
 *
 * This module exposes `renderCanonicalProse(action, state)` — a pure
 * exhaustive switch over every NextAction.kind that returns the
 * kernel's "what to say next" canonical line. The line:
 *   - NEVER contains a specific salary number unless the action's
 *     semantics REQUIRE one (anchor-budget, counter-offer recap,
 *     close-confirmation with prior offer);
 *   - NEVER fabricates candidate facts (it can only mention what the
 *     planner has already established);
 *   - NEVER drifts off-topic from the planned action.
 *
 * Predecessor: a thinner `renderActionFallbackProse` once lived in
 * _next-action-planner.ts behind the legacy validator-fallback path.
 * Deleted in the kernel-first cleanup (2026-05-16); this module is
 * now the sole deterministic-fallback surface.
 *
 * Pure. No clock, no IO, no LLM.
 */

import type { NegotiationState } from "./_negotiation-kernel";
import type { NextAction } from "./_next-action-planner";

/** Best-effort first-name extraction. Prefers the typed
 *  `state.candidateName` field (threaded from intake) and falls back
 *  to scanning the conversation log for an "I'm X" / "my name is X"
 *  signature when no name was passed in. Returns null when neither
 *  source yields a name — caller substitutes a generic fallback. */
function getCandidateFirstName(state: NegotiationState): string | null {
  /* Preferred: typed init field from intake. Kernel-first cleanup
   * (2026-05-16). */
  if (state.candidateName && state.candidateName.trim().length > 0) {
    const first = state.candidateName.trim().split(/\s+/)[0];
    if (first && first.length <= 20) return first;
  }
  /* Fallback: scan conversation log. Some sessions deserialize without a
   * candidateName (legacy state) or the candidate introduces themselves
   * mid-flow. */
  const log = state.conversationLog ?? [];
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (e && e.speaker === "candidate") {
      const m = e.text?.match(/\b(?:I['’]?m|my name is|this is)\s+([A-Z][a-z]+)\b/);
      if (m && m[1].length <= 20) return m[1];
    }
  }
  return null;
}

/** Canonical kernel-authored prose for every NextAction kind. The
 *  returned string is the EXACT line the bot would ship if the LLM
 *  restyle is unavailable or rejected. */
export function renderCanonicalProse(
  action: NextAction,
  state: NegotiationState,
): string {
  const firstName = getCandidateFirstName(state);
  const greet = firstName ?? "there";

  switch (action.kind) {
    case "terminal-restate":
      return state.highestOfferMade > 0
        ? `The offer stands at ₹${state.highestOfferMade}L. Take your time and let me know.`
        : "We've covered the relevant ground here.";

    case "close":
      if (action.mode === "accept") {
        return "Sounds like we're aligned. Let me confirm the final terms with you before we send the formal letter.";
      }
      if (action.mode === "walkaway") {
        return "Honestly, given the gap on expectations, I don't think we're going to be able to find common ground on this one. I appreciate your time.";
      }
      return "Let's pause here. Take some time and come back to me when you're ready.";

    case "auto-accept":
      return "Sounds like we're aligned. Let me confirm the final terms with you before we send the formal letter.";

    case "reactive-followup": {
      const topic = action.topic;
      if (topic === "variable-comfort") {
        return action.ask
          || "I noticed your variable share is quite high — how comfortable are you with that structure continuing?";
      }
      if (topic === "competing-credibility") {
        return "When you mention another opportunity — is that a written offer or still in discussion?";
      }
      if (topic === "value-proof") {
        return "It sounds like the role's trajectory matters as much as the number — what would make this opportunity feel genuinely worth the move?";
      }
      if (topic === "hike-justification") {
        return action.ask
          || "That's a meaningful jump from your current — what's driving the expectation at that level?";
      }
      if (topic === "equity-clarity") {
        return "On the equity piece — let me clarify the structure. Want me to walk through the vesting?";
      }
      if (topic === "number-clarification") {
        const n = state.candidateCurrentCtc ?? state.candidateTarget ?? null;
        return n != null
          ? `Just to make sure I heard right — that's ₹${n} lakh you mentioned, correct?`
          : "Just to make sure I heard right — could you confirm the number you mentioned?";
      }
      if (topic === "competing-leverage-ack") {
        return "Got it. Given the competing opportunity, let me make sure we're aligned on what matters most to you here.";
      }
      /* answer-direct, ctc-gentle-push, notice-buyout, etc. all carry a
       * planner-supplied ask string — use it verbatim. */
      return action.ask || "Could you say a little more about that?";
    }

    case "probe-mismatch":
      return "Before we dig into comp, can you walk me through how your current work maps to this role?";

    case "live-walk-away":
      if (action.mode === "walk") {
        return "It sounds like this may not be the right fit — I appreciate the conversation.";
      }
      if (action.mode === "hold-firm") {
        return state.highestOfferMade > 0
          ? `We're going to hold at ₹${state.highestOfferMade}L for now.`
          : "We're going to hold here for now.";
      }
      return "Let me probe a little further before we move forward.";

    case "range-disclosure": {
      const lo = state.band.initialOffer;
      const hi = state.band.maxStretch;
      return `Based on the role and your experience, we're working with a band of ₹${lo}–₹${hi} LPA total CTC for this position. Where do you see yourself landing within that?`;
    }

    case "discovery-probe": {
      const item = action.item;
      if (item === "currentCtc") {
        return "Let's start with where you are today — what's your current total CTC?";
      }
      if (item === "currentCtcFixedVariableSplit") {
        return "And how does that break down between fixed and variable?";
      }
      if (item === "expectedCtc") {
        return "What were you expecting for this move — in numbers, what range are you targeting?";
      }
      if (item === "expectedCtcFixedVariableSplit") {
        return "And on the structure side — are you flexible on fixed vs variable, or do you have a preference?";
      }
      if (item === "noticePeriod") {
        return "What's your notice period at your current company? Any flexibility there?";
      }
      if (item === "competingOffers") {
        return "Are you actively in process with any other companies?";
      }
      if (item === "valueProof") {
        return "Walk me through one thing in your current role you're genuinely proud of — something that shows the impact you can bring here.";
      }
      /* Discovery-probe for any other checklist item — defer to the
       * planner-supplied prompt (already kernel-authored, never an LLM
       * string). */
      return action.ask || "Could you tell me a bit more about what you're looking for?";
    }

    case "open-with-offer":
      /* OPENING-greeting variant: the kernel previously routed this to an
       * anchor with a specific number. In the kernel-first world the
       * opener is a discovery probe; if we still reach this case (planner
       * decided to anchor BECAUSE discovery is complete), the canonical
       * line names the band, not a single number, so the LLM cannot
       * sneak an anchor in via restyle.
       *
       * If discovery WAS incomplete and somehow this branch fires
       * anyway, we emit a greeting + discovery probe rather than any
       * number — structurally impossible-to-anchor opening. */
      if (state.turnIndex === 0) {
        return `Thanks for taking the time today${firstName ? ", " + firstName : ""}. Let's get into it — to start, can you walk me through your current compensation structure?`;
      }
      return "Before we name a number — what range were you targeting?";

    case "lever-loop-guard":
      return "Take a moment to think it over and let me know where you land.";

    case "info-disclosure": {
      const topic = action.topic;
      if (topic === "breakdown") {
        return state.highestOfferMade > 0
          ? `On the ₹${state.highestOfferMade}L package — let me walk you through the fixed, variable, and benefits split.`
          : "Let me walk you through the package breakdown.";
      }
      if (topic === "benefits") {
        return "On the benefits side — let me walk you through what's included beyond the cash.";
      }
      if (topic === "comp-structure") {
        return "On the compensation structure — let me walk you through how fixed, variable, and equity work for this role.";
      }
      if (topic === "notice") {
        return "On the joining side — let me walk you through how we handle notice periods and buyout.";
      }
      if (topic === "hike-pct") {
        return "On the hike piece — let me put the offer in context against where you are today.";
      }
      return "Let me come back to you with the structured breakdown in a moment.";
    }

    case "probe-expectations":
      return "What range were you targeting for this role?";

    case "probe-justification":
      return "Help me understand the rationale behind that number — what's it anchored on?";

    case "counter-offer": {
      /* The planner pre-computes the counter total + optional fixed /
       * variable split on the typed action (kernel-first cleanup
       * 2026-05-16). Canonical prose for a counter ALWAYS includes the
       * number so the restyle validator can verify it survives. */
      const total = action.counterTotalLpa;
      if (total != null && total > 0) {
        return `Hearing you out — let me see what I can put together. We can move to ₹${total}L total. What would that look like on your side?`;
      }
      return state.highestOfferMade > 0
        ? `We're holding on the current offer of ₹${state.highestOfferMade}L. What would move this forward for you?`
        : "What number would land for you?";
    }

    case "lever-explore":
      return "Let me see what else we can put together on the package side.";

    case "hold-firm":
      return state.highestOfferMade > 0
        ? `We're going to hold at ₹${state.highestOfferMade}L. Take some time to think it over.`
        : "We're going to hold here. Take some time to think it over.";

    case "rescission":
      return "Given how this has gone, we're going to step back from the offer.";

    default: {
      /* TypeScript exhaustiveness check. If a new NextAction.kind is
       * added without canonical coverage, the type system flags this
       * line. We still return a defensive default at runtime so the
       * pipeline never crashes — tests should catch the gap first. */
      const _exhaustive: never = action;
      void _exhaustive;
      /* Try to read action.ask if the new kind happens to carry one. */
      const carried = action as { ask?: string };
      if (carried && typeof carried.ask === "string" && carried.ask) {
        return carried.ask;
      }
      return "Let me come back to you in a moment.";
    }
  }

  /* Reserved for future use — greet variable referenced above. */
  void greet;
}

/** Restyle prompt builder. TIGHT instruction — the LLM may rephrase but
 *  MUST NOT add numbers, facts, or change meaning. Kept short so the
 *  prompt cache stays warm across turns. */
export function buildRestylePrompt(
  canonical: string,
  state: NegotiationState,
): { system: string; user: string } {
  const system =
    `You are restyling a recruiter's next line in an Indian salary negotiation.\n\n` +
    `ROLE: Indian HR recruiter for ${state.role || "this role"} at ${state.company || "this company"}\n` +
    `PHASE: ${state.phase}\n\n` +
    `INSTRUCTIONS (strict):\n` +
    `- Restyle the canonical line below in a natural, conversational Indian-recruiter tone.\n` +
    `- You MAY change word order, contractions, opening phrases.\n` +
    `- You MUST NOT add any specific numbers not in the canonical line.\n` +
    `- You MUST NOT add any facts (company policy, team size, perks, benefits) not in the canonical line.\n` +
    `- You MUST NOT change the meaning or the question being asked.\n` +
    `- Keep it to one short paragraph.\n` +
    `- Do not add closing pleasantries like "looking forward to your answer".\n\n` +
    `OUTPUT: just the restyled line, no preamble.`;
  const user = `CANONICAL LINE (what to say):\n"${canonical}"`;
  return { system, user };
}

/** Restyle-prompt builder for off-script candidate questions. The LLM
 *  may answer ONLY from the supplied factPack; if a fact is missing,
 *  it must defer and pivot to the canonical follow-up line. */
export function buildAnswerCandidatePrompt(
  candidateQuestion: string,
  factPackJson: string,
  canonicalFollowup: string,
  state: NegotiationState,
): { system: string; user: string } {
  const system =
    `You are an Indian HR recruiter answering a candidate's question during a salary negotiation.\n\n` +
    `ROLE: ${state.role || "this role"} at ${state.company || "this company"}\n` +
    `PHASE: ${state.phase}\n\n` +
    `INSTRUCTIONS (strict):\n` +
    `- Answer the candidate's question using ONLY the facts in the factPack below.\n` +
    `- If a fact you need is not present, say "Let me confirm that with the team and get back to you", then redirect with the follow-up line below.\n` +
    `- Do NOT invent numbers, policies, perks, dates, or commitments.\n` +
    `- Keep it conversational, 1-3 sentences.\n\n` +
    `OUTPUT: just your answer, no preamble.`;
  const user =
    `CANDIDATE ASKED: "${candidateQuestion}"\n\n` +
    `FACT PACK (the only context you may use):\n${factPackJson}\n\n` +
    `FOLLOW-UP LINE (use if a fact is missing): "${canonicalFollowup}"`;
  return { system, user };
}
