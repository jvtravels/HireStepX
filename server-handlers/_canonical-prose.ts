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

/** Single source of truth for Indian-recruiter vocabulary policy.
 *  Defect 2 + ArchRec 1 (2026-05-16) — previously the BANNED / PREFERRED
 *  lists were duplicated as ad-hoc strings across `_canonical-prose.ts`,
 *  `_negotiate-turn-helpers.ts`, and `follow-up.ts`, and several of
 *  those duplicates contradicted each other (`_negotiate-turn-helpers`
 *  recommended "circle back" / "on board" / "touch base" / "I'll get
 *  back to you" — directly in the BANNED list at the restyle prompt).
 *  Importers MUST consume these constants rather than re-typing
 *  phrases inline. */
export const BANNED_RECRUITER_IDIOM = [
  "circle back",
  "touch base",
  "synergy",
  "on board",
  "reach out",
] as const;

export const PREFERRED_RECRUITER_IDIOM = [
  "fitment",
  "revert",
  "broadly aligned",
  "as per band",
  "let me check with leadership",
  "as per the band for this grade",
] as const;

/** Case-insensitive word-boundary regex union of the banned idioms,
 *  for validator use. Allowed surface forms include contractions /
 *  spacing variants (e.g. "circle back", "circle-back"). */
export const BANNED_RECRUITER_IDIOM_RE = new RegExp(
  "\\b(" +
    BANNED_RECRUITER_IDIOM
      .map((p) => p.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"))
      .join("|") +
    ")\\b",
  "i",
);

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

/** perfect 5 (2026-05-16) — grade label for band-anchor framing.
 *
 *  NegotiationState does not (yet) carry a typed `level` field. Real
 *  Indian recruiters say "L4 band" / "M2 band" when they have a level;
 *  in its absence they say "this grade". Defensive fallback keeps the
 *  prose natural even when no level is threaded through. If/when a
 *  state.level field lands, swap the lookup here without touching the
 *  call sites. */
function gradeLabel(_state: NegotiationState): string {
  return "this grade";
}

/** Polish 1 (2026-05-16) — multi-anchor escalation hierarchy.
 *
 * Real Indian recruiters route hedges through different escalation
 * points depending on what's being asked: finance owns fitment numbers
 * and bonus splits, HR ops owns grade/title mapping, the hiring manager
 * owns notice waivers and joining-date negotiation, the comp team owns
 * equity grants. Previously every kernel hedge bottomed out at "let me
 * run this past leadership", which flattened a real org chart. This
 * helper picks the correct anchor per NextAction kind so the bot's
 * hedge sounds like a real recruiter coordinating across functions
 * instead of a single voice deferring to one nebulous "leadership". */
export function selectEscalationAnchor(
  action: NextAction,
  _state: NegotiationState,
): string {
  switch (action.kind) {
    /* Number / fitment hedge — finance signs off on cash totals,
     * retention split sizes, joining-bonus amounts, and the final
     * close fitment. */
    case "counter-offer":
    case "lever-retention-bonus":
    case "lever-joining-bonus-explained":
    case "auto-accept":
      return "finance for fitment approval";
    case "close":
      return action.mode === "accept" ? "finance for fitment approval" : "leadership";

    /* Grade / title hedge — HR ops owns the grade-to-band mapping
     * and the level rubric. */
    case "lever-grade-upgrade":
      return "HR ops on the grade mapping";

    /* Notice waiver / joining date / relocation timing — the hiring
     * manager owns the start-date side because their team capacity
     * is the binding constraint, not HR's. */
    case "lever-relocation":
      return "the hiring manager";
    case "info-disclosure":
      return action.topic === "notice" ? "the hiring manager" : "leadership";

    /* Equity grant — the comp team owns the refresh cadence and the
     * vesting schedule, not generic leadership. */
    case "lever-rsu-refresh":
      return "the comp team";

    default:
      return "leadership";
  }
}

/** Perfect 2 (2026-05-16) — emotional acknowledgement prefix.
 *
 *  Indian-recruiter idiom (NOT therapist-speak): a single one-liner the
 *  recruiter would naturally drop in before getting back to substance.
 *  Only fires for frustrated / excited / hesitant — decisive needs no
 *  emotional softening (the candidate is already direct, mirror that),
 *  and neutral needs no acknowledgement at all. Returns null when no
 *  prefix should be emitted; caller does NOT prepend anything.
 *
 *  Banned: "I understand how you feel", "I hear that this must be
 *  difficult", "let's circle back" — all US-recruiter / coach-speak. */
export function renderSentimentPrefix(
  sentiment: import("./_negotiation-kernel").TurnDelta["candidateSentiment"] | undefined | null,
): string | null {
  if (sentiment == null) return null;
  switch (sentiment) {
    case "frustrated":
      return "I hear you — and I want to be straight with you here.";
    case "excited":
      return "Glad we're broadly aligned —";
    case "hesitant":
      return "Take your time on this —";
    case "decisive":
    case "neutral":
      return null;
    default:
      return null;
  }
}

/** BUG-2 fix (PDF#24, 2026-05-16) — discovery-probe acknowledgement
 *  prefix. The planner advances through DISCOVERY_SEQUENCE one item at a
 *  time; when the candidate's prior utterance volunteered something
 *  factual (current CTC, expected CTC, notice, competing-offer existence,
 *  fixed/variable split), the next probe should acknowledge it before
 *  asking the next question. Without this, the bot reads as transactional
 *  ("candidate gives expected CTC → bot probes fitment-split with no
 *  recognition of the number on the table"). Indian-recruiter idiom:
 *  "Got it" / "Noted" / "Understood".
 *
 *  The acknowledgement is suppressed for the SAME-topic case so we don't
 *  emit "Noted on X — now on X, …" (e.g. candidate just disclosed
 *  expected, bot's next probe is also expected — acknowledgement is
 *  redundant).
 *
 *  Returns null when no fresh disclosure was made on the prior turn (e.g.
 *  turn 0 opener) or when the disclosure subject IS the topic the probe
 *  is about to ask. */
export function buildDiscoveryAck(
  delta: import("./_negotiation-kernel").TurnDelta | null | undefined,
  probeItem: string,
): string | null {
  if (delta == null) return null;
  /* expected-CTC disclosed → ack before asking anything other than
   * expected-CTC itself. */
  if (delta.disclosedExpectedCtc && probeItem !== "expectedCtc" && probeItem !== "target") {
    return "Noted on the expected fitment —";
  }
  if (delta.disclosedCurrentCtc && probeItem !== "currentCtc") {
    return "Got it on the current side —";
  }
  if (
    delta.disclosedFixedVariableSplit &&
    probeItem !== "fixedVariableSplit" &&
    probeItem !== "currentCtcFixedVariableSplit" &&
    probeItem !== "expectedCtcFixedVariableSplit"
  ) {
    return "Understood on the fixed/variable structure —";
  }
  if (delta.disclosedNoticePeriod && probeItem !== "noticePeriod") {
    return "Noted on the notice side —";
  }
  if (delta.disclosedCompetingOffer && probeItem !== "competingOffers") {
    return "Got it on the other process —";
  }
  if (delta.disclosedValueProof && probeItem !== "valueProof") {
    return "Appreciate the colour on that —";
  }
  return null;
}

/** Action kinds where the sentiment prefix is suppressed regardless of
 *  the detected sentiment. Openings carry their own greeting cadence;
 *  formal close recaps and walk-aways have their own tone register and
 *  an emotional prefix would feel out of place. */
const SENTIMENT_PREFIX_SUPPRESSED_KINDS = new Set<string>([
  "open-with-offer",
  "close-recap-formal",
  /* walk-away surfaces as either `close` with mode "walkaway" or
   * `live-walk-away` with mode "walk" — both handled below at the
   * call site so we can inspect the mode field. */
]);

/** Canonical kernel-authored prose for every NextAction kind. The
 *  returned string is the EXACT line the bot would ship if the LLM
 *  restyle is unavailable or rejected. */
export function renderCanonicalProse(
  action: NextAction,
  state: NegotiationState,
): string {
  /* Perfect 2 (2026-05-16) — sentiment-aware acknowledgement prefix.
   * Computed once and prepended to the action-specific body for the
   * three softening sentiments. Decisive / neutral fall through. Some
   * action kinds (opening, formal close recap, walk-away) suppress the
   * prefix even when sentiment qualifies, because those flows carry
   * their own tone register. */
  const sentiment = state.lastTurnDelta?.candidateSentiment ?? null;
  let sentimentPrefix: string | null = renderSentimentPrefix(sentiment);
  if (sentimentPrefix != null) {
    if (SENTIMENT_PREFIX_SUPPRESSED_KINDS.has(action.kind)) {
      sentimentPrefix = null;
    } else if (action.kind === "close" && action.mode === "walkaway") {
      sentimentPrefix = null;
    } else if (action.kind === "live-walk-away" && action.mode === "walk") {
      sentimentPrefix = null;
    }
  }
  const body = renderCanonicalProseBody(action, state);
  return sentimentPrefix ? `${sentimentPrefix} ${body}` : body;
}

/** Action-specific body, unprefixed. Split out from renderCanonicalProse
 *  so the sentiment-prefix wrapper can compute once and prepend once
 *  rather than wrap every return arm in the switch. */
function renderCanonicalProseBody(
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
        const anchor = selectEscalationAnchor(action, state);
        return `Broadly aligned, then. Let me run this fitment past ${anchor} once and revert with the formal offer letter.`;
      }
      if (action.mode === "walkaway") {
        return "Looking at where your expectations sit versus our band for this grade, I don't think we'll be able to bridge the gap on this one. Appreciate your time.";
      }
      return "Let's pause the discussion here. Take your time on it and revert when you're ready.";

    case "auto-accept": {
      const anchor = selectEscalationAnchor(action, state);
      return `Broadly aligned, then. Let me run this fitment past ${anchor} once and revert with the formal offer letter.`;
    }

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
       * DiscoveryItemKey from _discovery-stage) OR the `*Disclosed`
       * suffix for items in DISCOVERY_SEQUENCE that gate on a separate
       * disclosure flag (e.g. `currentCtcFixedVariableSplitDisclosed`).
       * Strip BOTH suffixes once so the switch arms accept either form.
       *
       * Defect 4 (2026-05-16): pre-fix only stripped `Answered`, so
       * `currentCtcFixedVariableSplitDisclosed` slipped through without
       * normalisation; the un-stripped key never matched the probeItem
       * comparator in buildDiscoveryAck and the ack fired self-
       * referentially on same-topic probes ("Understood on the
       * fixed/variable structure — and how is your current package
       * structured between fixed and variable?"). */
      const rawItem = action.item;
      const item = rawItem.replace(/(?:Answered|Disclosed)$/, "");
      let probe: string;
      if (item === "currentCtc") {
        probe = "Let's start with your current side — what's the total CTC at present?";
      } else if (item === "fixedVariableSplit" || item === "currentCtcFixedVariableSplit") {
        probe = "And how is your current package structured between fixed and variable?";
      } else if (item === "expectedCtc" || item === "target") {
        probe = "What's the fitment you were looking at for this move — broadly, what range are you anchoring on?";
      } else if (item === "expectedCtcFixedVariableSplit") {
        probe = "On the expected side — how would you want the split between fixed and variable to land?";
      } else if (item === "noticePeriod") {
        probe = "What's the notice period at your current company? Any scope for buyout there?";
      } else if (item === "competingOffers") {
        probe = "Are you actively in process with other companies right now?";
      } else if (item === "valueProof") {
        probe = "Walk me through one project from your current role that you'd anchor on in a fitment discussion — something where the impact is concrete.";
      } else {
        /* Discovery-probe for any other checklist item — defer to the
         * planner-supplied prompt (already kernel-authored, never an LLM
         * string). */
        probe = action.ask || "Can you tell me a little more about what you're looking at?";
      }
      /* BUG-2 ROOT CAUSE FIX (PDF#24, 2026-05-16): preface every
       * discovery probe with a one-line acknowledgement of the
       * disclosure the candidate volunteered on the prior turn. Without
       * it, the bot sounded transactional — candidate said "I'm looking
       * at ₹12L" and the next bot turn jumped straight to fitment-split
       * with no recognition of the number that was just put on the
       * table. Indian-recruiter idiom: "Got it" / "Noted" / "Understood".
       *
       * The prefix is suppressed when the prior turn yielded no fresh
       * disclosure (delta empty) — so the OPENING probe doesn't get an
       * incongruous "Got it on the X" prepended to it. */
      const delta = state.lastTurnDelta;
      const ack = buildDiscoveryAck(delta, item);
      return ack ? `${ack} ${probe}` : probe;
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
       * number so the restyle validator can verify it survives.
       *
       * perfect 1 (2026-05-16) — spiral prose tells. counterRound is
       * the number of counter-base moves ALREADY shipped this session
       * (this turn's counter has not yet been recorded in state — the
       * applyAiMove that increments it runs after planNextAction).
       * round >= 1 = at least one prior movement, surface that fact;
       * round >= 2 = stretching the band, signal we're near the cap. */
      const total = action.counterTotalLpa;
      const round = state.counterRound;
      let spiralLead = "Hearing you out — let me see what I can structure.";
      if (round >= 2) {
        spiralLead = "I've stretched as far as my band allows on cash —";
      } else if (round >= 1) {
        spiralLead = "We've already moved on fitment once — let me see what's possible at this stage:";
      }
      if (total != null && total > 0) {
        return `${spiralLead} We can revise the fitment to ₹${total}L total. How does that look from your side?`;
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

    case "lever-grade-upgrade": {
      const anchor = selectEscalationAnchor(action, state);
      return `On the structure side — let me check with ${anchor} if there's scope to position you a grade higher. That moves the band and the fitment in one shot.`;
    }

    case "lever-retention-bonus": {
      const anchor = selectEscalationAnchor(action, state);
      return `Looking at the structure — we can layer a retention bonus split across the first 12-18 months over and above the fitment. Let me run the exact split past ${anchor} and revert.`;
    }

    case "lever-rsu-refresh":
      return "On the RSU side — there's an annual refresh grant that lands at the appraisal cycle in addition to the initial vest. Let me walk you through how the refresh cadence works for this grade.";

    case "lever-relocation": {
      const anchor = selectEscalationAnchor(action, state);
      return `On the relocation side — we have a standard relocation allowance plus temporary accommodation support for the first few weeks. Let me confirm the exact amount with ${anchor} and revert.`;
    }

    case "lever-perf-bonus-cadence":
      return "Looking at the structure — the performance bonus cadence is anchored to the March appraisal cycle, with a mid-year correction window for top performers. Let me walk you through how that plays out at this grade.";

    case "lever-joining-bonus-explained": {
      const jb = state.lastJoiningBonusOffered;
      const jbPart = jb != null && jb > 0 ? `₹${jb}L ` : "";
      return `On the joining bonus — the ${jbPart}is one-time, paid with the first month's payroll, and carries the standard 12-month clawback (prorated thereafter). Let me know if you want the exact wording before I revert internally.`;
    }

    case "internal-equity-defense": {
      const median = action.peerBandMedianLpa;
      const top = action.peerBandTopLpa;
      return `Here's something I have to be upfront about — your peers at ${gradeLabel(state)} in our team are sitting between ₹${median} and ₹${top} LPA fixed. Moving you above that creates an internal-equity issue I'd have to get signed off by Comp, and frankly the bar for that is a documented critical-skill premium. The band we're discussing is already at the upper end of where I can land you without that escalation.`;
    }

    case "comparative-anchoring": {
      const target = state.candidateTarget;
      const targetStr = target != null && target > 0 ? `₹${target} LPA` : "where you're anchoring";
      if (action.quartile === "top") {
        return `Just to frame this — at ${targetStr}, you'd be sitting at the top quartile of the ${gradeLabel(state)} band. That's not unreasonable for the profile, but it does set the bar for performance in the first review.`;
      }
      return `At ${targetStr}, you'd be landing at the median of the ${gradeLabel(state)} band — comfortable spot, headroom for the appraisal cycle.`;
    }

    case "band-anchor-with-rationale": {
      const lo = state.band.initialOffer;
      const hi = state.band.maxStretch;
      return `Just to anchor the discussion — as per our band for this grade, the fitment range is ₹${lo}-${hi} LPA. That's set against the role's scope and our internal parity for the level, not on a single benchmark.`;
    }

    case "close-recap-formal": {
      /* Fix 4 (2026-05-16) — formal close recap. Enumerates Fixed |
       * Variable target | JB (optional) | Retention (optional) | Notice |
       * Proposed joining (optional) | BGV start trigger | OL ETA, then
       * asks "Sounds good?" so the candidate explicitly reconfirms the
       * full structured fitment before the offer letter is cut. */
      const parts: string[] = [];
      parts.push(`Fixed ₹${action.fixedLpa}L`);
      parts.push(`variable target ₹${action.variableLpa}L`);
      if (action.joiningBonusLpa != null && action.joiningBonusLpa > 0) {
        parts.push(`joining bonus ₹${action.joiningBonusLpa}L with the standard 12-month clawback`);
      }
      if (action.retentionBonusLpa != null && action.retentionBonusLpa > 0) {
        parts.push(`retention bonus ₹${action.retentionBonusLpa}L split across the retention window`);
      }
      parts.push(`notice ${action.noticePeriodWeeks} weeks`);
      if (action.proposedJoiningDate) {
        parts.push(`proposed joining ${action.proposedJoiningDate}`);
      }
      parts.push(`BGV starts ${action.bgvStartTrigger}`);
      parts.push(`offer letter in ${action.offerLetterEta}`);
      /* Perfect 3 (2026-05-16) — when sticky cumulativeUrgency is firm
       * (candidate has surfaced an explicit deadline / in-hand offer),
       * append a fast-track line on the formal recap so the candidate
       * hears that the OL pipeline is being shortened to match their
       * timeline. Suppressed on soft / none — informational only. */
      const urgencyTail =
        state.cumulativeUrgency === "firm"
          ? " Given your timeline, we'll fast-track the offer letter — expect it within 24 hours of BGV initiation."
          : "";
      return `Let me recap the fitment before I revert internally — ${parts.join(", ")}. Sounds good?${urgencyTail}`;
    }

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
    `- BANNED phrases (do NOT use, ever): ${BANNED_RECRUITER_IDIOM.map((p) => `"${p}"`).join(", ")}, "rounding out the package", "we're aligned", "package" (as a comp noun).\n` +
    `- PREFERRED phrasing (Indian recruiter cadence): ${PREFERRED_RECRUITER_IDIOM.map((p) => `"${p}"`).join(", ")}, "looking at the structure" (not "rounding out the package").\n` +
    `- You MAY change word order, contractions, opening phrases.\n` +
    `- If the canonical line opens with an acknowledgement of the candidate's prior turn ("Noted on …", "Got it on …", "Understood on …", "Appreciate the colour …"), KEEP an acknowledgement gesture in your restyle — you may rephrase it (e.g. "Right, on the X side —", "Thanks for that, on X —", "Fair enough on X —") but do not strip it.\n` +
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
    `- If a fact is missing, output the deterministic defer line provided by the pipeline. Do NOT invent a hedge or callback promise; do NOT use any phrase in the BANNED list (${BANNED_RECRUITER_IDIOM.join(", ")}).\n` +
    `- Do NOT invent numbers, policies, perks, dates, or commitments.\n` +
    `- Keep it conversational, 1-3 sentences.\n\n` +
    `OUTPUT: just your answer, no preamble.`;
  const user =
    `CANDIDATE ASKED: "${candidateQuestion}"\n\n` +
    `FACT PACK (the only context you may use):\n${factPackJson}\n\n` +
    `FOLLOW-UP LINE (use if a fact is missing): "${canonicalFollowup}"`;
  return { system, user };
}
