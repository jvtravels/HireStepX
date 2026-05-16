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
        ? `The fitment stands at ₹${state.highestOfferMade}L as per our band for this grade. Take your time and revert.`
        : "We've broadly covered the relevant points here. Take your time and revert.";

    case "close":
      if (action.mode === "accept") {
        return "Broadly aligned, then. Let me run this fitment past leadership once and revert with the formal offer letter.";
      }
      if (action.mode === "walkaway") {
        return "Looking at where your expectations sit versus our band for this grade, I don't think we'll be able to bridge the gap on this one. Appreciate your time.";
      }
      return "Let's pause the discussion here. Take your time on it and revert when you're ready.";

    case "auto-accept":
      return "Broadly aligned, then. Let me run this fitment past leadership once and revert with the formal offer letter.";

    case "reactive-followup": {
      const topic = action.topic;
      if (topic === "variable-comfort") {
        return action.ask
          || "Your variable component is on the higher side — what has been your payout history, and are you comfortable with that structure continuing?";
      }
      if (topic === "competing-credibility") {
        return "On the other opportunity you mentioned — is the offer letter in hand, or is the discussion still in process?";
      }
      if (topic === "value-proof") {
        return "Sounds like the trajectory of the role matters as much as the fitment — what would make this opportunity feel worth the move for you?";
      }
      if (topic === "hike-justification") {
        return action.ask
          || "That's a meaningful jump on your current fitment — help me understand what's anchoring the expectation at that level.";
      }
      if (topic === "equity-clarity") {
        return "On the equity piece — let me walk you through how the vesting and cliff are structured for this grade.";
      }
      if (topic === "number-clarification") {
        const n = state.candidateCurrentCtc ?? state.candidateTarget ?? null;
        return n != null
          ? `Just to be sure I noted it correctly — that's ₹${n} lakh you mentioned, na?`
          : "Just to be sure I noted it correctly — can you confirm the number you mentioned?";
      }
      if (topic === "competing-leverage-ack") {
        return "Noted on the competing opportunity. Let me make sure we're broadly aligned on what matters most to you on this role before I revert internally.";
      }
      /* answer-direct, ctc-gentle-push, notice-buyout, etc. all carry a
       * planner-supplied ask string — use it verbatim. */
      return action.ask || "Can you elaborate on that a little?";
    }

    case "probe-mismatch":
      return "Before we get into the fitment side, can you walk me through how your current work maps to this role?";

    case "live-walk-away":
      if (action.mode === "walk") {
        return "Looks like this may not be the right fit at this point — appreciate the conversation.";
      }
      if (action.mode === "hold-firm") {
        return state.highestOfferMade > 0
          ? `We'll hold the fitment at ₹${state.highestOfferMade}L for now as per our band for this grade.`
          : "We'll hold here for now as per our band for this grade.";
      }
      return "Let me probe a little further before we move ahead.";

    case "range-disclosure": {
      const lo = state.band.initialOffer;
      const hi = state.band.maxStretch;
      return `As per our band for this grade, the fitment sits in the ₹${lo}–₹${hi} LPA total CTC range. Where do you see yourself landing within that?`;
    }

    case "discovery-probe": {
      /* Planner emits item keys with the `*Answered` suffix (mirroring
       * DiscoveryItemKey from _discovery-stage). Strip the suffix once
       * so the switch arms accept either form — previously every key
       * fell through to `action.ask`, which is the engineering "complex
       * system" tech-interview prompt etc. (Fix 3, 2026-05-16). */
      const rawItem = action.item;
      const item = rawItem.endsWith("Answered")
        ? rawItem.slice(0, -"Answered".length)
        : rawItem;
      if (item === "currentCtc") {
        return "Let's start with your current side — what's the total CTC at present?";
      }
      if (item === "fixedVariableSplit" || item === "currentCtcFixedVariableSplit") {
        return "And how is that structured between fixed and variable?";
      }
      if (item === "expectedCtc" || item === "target") {
        return "What's the fitment you were looking at for this move — broadly, what range are you anchoring on?";
      }
      if (item === "expectedCtcFixedVariableSplit") {
        return "On the structure side — are you open on the fixed-variable split, or do you have a preference?";
      }
      if (item === "noticePeriod") {
        return "What's the notice period at your current company? Any scope for buyout there?";
      }
      if (item === "competingOffers") {
        return "Are you actively in process with other companies right now?";
      }
      if (item === "valueProof") {
        return "Walk me through one project from your current role that you'd anchor on in a fitment discussion — something where the impact is concrete.";
      }
      /* Discovery-probe for any other checklist item — defer to the
       * planner-supplied prompt (already kernel-authored, never an LLM
       * string). */
      return action.ask || "Can you tell me a little more about what you're looking at?";
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
        return `Thanks for making the time${firstName ? ", " + firstName : ""}. Let's get straight into it — walk me through your current compensation structure first.`;
      }
      return "Before I put a number out — what fitment were you anchoring on?";

    case "lever-loop-guard":
      return "Take some time to think it through and revert with where you'd like to land.";

    case "info-disclosure": {
      const topic = action.topic;
      if (topic === "breakdown") {
        return state.highestOfferMade > 0
          ? `On the ₹${state.highestOfferMade}L fitment — let me walk you through the fixed, variable, and benefits side.`
          : "Let me walk you through the fitment structure.";
      }
      if (topic === "benefits") {
        return "On the benefits side — let me run you through what's covered beyond the cash component.";
      }
      if (topic === "comp-structure") {
        return "On the compensation structure — let me walk you through how fixed, variable, and equity sit for this grade.";
      }
      if (topic === "notice") {
        return "On the joining side — let me walk you through how we handle notice and buyout for this role.";
      }
      if (topic === "hike-pct") {
        return "On the hike piece — let me put the fitment in context against your current side.";
      }
      return "Let me revert with the structured breakdown in a moment.";
    }

    case "probe-expectations":
      return "What fitment were you anchoring on for this role?";

    case "probe-justification":
      return "Help me understand what's anchoring that number — where is the expectation coming from?";

    case "counter-offer": {
      /* The planner pre-computes the counter total + optional fixed /
       * variable split on the typed action (kernel-first cleanup
       * 2026-05-16). Canonical prose for a counter ALWAYS includes the
       * number so the restyle validator can verify it survives. */
      const total = action.counterTotalLpa;
      if (total != null && total > 0) {
        return `Hearing you out — let me see what I can structure. We can revise the fitment to ₹${total}L total. How does that look from your side?`;
      }
      return state.highestOfferMade > 0
        ? `We're holding the current fitment at ₹${state.highestOfferMade}L. What would move this forward for you?`
        : "What number would land for you?";
    }

    case "lever-explore":
      return "Let me see what else we can structure on the fitment side.";

    case "hold-firm":
      return state.highestOfferMade > 0
        ? `We'll hold the fitment at ₹${state.highestOfferMade}L as per our band for this grade. Take some time on it and revert.`
        : "We'll hold here as per our band for this grade. Take some time on it and revert.";

    case "rescission":
      return "Given how this discussion has gone, we'll have to step back from the offer.";

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
    `You are restyling an Indian HR recruiter's next line in a salary negotiation.\n\n` +
    `ROLE: Indian HR recruiter for ${state.role || "this role"} at ${state.company || "this company"}\n` +
    `PHASE: ${state.phase}\n\n` +
    `INSTRUCTIONS (strict):\n` +
    `- Use Indian English cadence. Avoid US-tech-recruiter idiom.\n` +
    `- BANNED phrases (do not use): "circle back", "on board", "reach out", "touch base", "synergy", "rounding out the package", "we're aligned", "package" (as a comp noun).\n` +
    `- PREFERRED phrasing (Indian recruiter cadence): "let me check with leadership", "let me run this past leadership and revert", "fitment" (not "package"), "revert" (instead of "circle back" / "get back"), "as per our band" / "as per our band for this grade", "broadly aligned" (not "we're aligned"), "looking at the structure" (not "rounding out the package").\n` +
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
