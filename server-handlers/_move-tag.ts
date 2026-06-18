/* Server-side in-flow transparency layer (2026-05-17).
 *
 * Dim 14 — Transparency / explainability (audit grade D+).
 *
 * The kernel knows exactly WHY each lever fired; engineer-facing
 * `_move.rationale` strings carry that signal. The candidate, however,
 * only sees the prose. This module produces a USER-FACING one-line
 * tag for each NextAction kind so a future Learning-Mode UI can
 * render a "why this move" indicator under the recruiter's bubble.
 *
 * Decoupled from the client: this commit ships the server foundation
 * only. The client renders nothing unless/until it reads `moveTag`
 * off the turn response.
 *
 * Rules enforced by tests in src/__tests__/moveTag.test.ts:
 *   - Plain-English label (≤ 28 chars) + pedagogical hint (≤ 140 chars).
 *   - NEVER leaks internals: no band lo/hi numbers, no single-fire
 *     stamp names, no counterRound mention, no spiral-multiplier hints,
 *     no walk-away thresholds, no phase literals, no "fired" / "stamp"
 *     vocabulary.
 *   - Pedagogical voice: explain the TACTIC, not the move.
 *   - Discovery / component probes are topic / component aware so
 *     the tag is specific, not generic.
 */

import type { NextAction } from "./_next-action-planner";
import type { NegotiationState } from "./_negotiation-kernel";

export interface MoveTag {
  /** Short user-facing label, ≤ 28 chars, no jargon. */
  label: string;
  /** One-sentence pedagogical hint. ≤ 140 chars. Explains the
   *  tactic in plain English. */
  hint: string;
  /** The lever family for client-side grouping / iconography. */
  family:
    | "discovery"
    | "anchor"
    | "defense"
    | "counter"
    | "stall"
    | "close"
    | "terminal"
    | "meta";
}

/* ─── Topic-aware helpers ─────────────────────────────────────────── */

function discoveryTopicLabel(topic: unknown): { label: string; hint: string } {
  const t = String(Array.isArray(topic) ? topic[0] : topic);
  /* Match by prefix / substring so we collapse {Asked, Answered, Disclosed}
   * variants of the same underlying topic onto one user-facing label. */
  if (/currentCtcBase|^base$/.test(t)) {
    return {
      label: "Probing base pay",
      hint: "Base is the hardest number to move post-offer — recruiters probe it early to set a ceiling.",
    };
  }
  if (/currentCtcVariable|variable-comfort|^variable$/.test(t)) {
    return {
      label: "Probing variable pay",
      hint: "Variable pay is the easiest lever to stretch — they probe it to see if you'll accept fixed-for-variable trades.",
    };
  }
  if (/currentCtcEsop|equity-clarity|^esop$|^equity$/.test(t)) {
    return {
      label: "Probing equity expectations",
      hint: "Equity asks signal long-horizon thinking and let them swap cash for paper — be precise about vest and refresh.",
    };
  }
  if (/^currentCtc|ctc-gentle-push/.test(t)) {
    return {
      label: "Probing your current CTC",
      hint: "Recruiters anchor on what you make today before discussing what you want — it caps how high they need to stretch.",
    };
  }
  if (/^target|range-to-point|range-deflection/.test(t)) {
    return {
      label: "Probing your target",
      hint: "Asking for a number first shifts the anchoring burden to you — give a range, not a single point.",
    };
  }
  if (/notice/i.test(t)) {
    return {
      label: "Probing notice period",
      hint: "Notice length shapes joining-bonus headroom; a long notice gives them leverage to delay.",
    };
  }
  if (/competing/i.test(t)) {
    return {
      label: "Probing competing offers",
      hint: "Recruiters test the strength of your alternatives — vague competing offers get discounted, specific ones move the band.",
    };
  }
  if (/valueProof|value-proof/.test(t)) {
    return {
      label: "Probing value proof",
      hint: "Recruiters ask for concrete outcomes that justify the ask — quantified impact beats general claims here.",
    };
  }
  if (/hike-justification/.test(t)) {
    return {
      label: "Probing hike rationale",
      hint: "Framing your ask as a hike % anchors them to your current CTC — frame it on market and role instead.",
    };
  }
  if (/fixedVariableSplit/.test(t)) {
    return {
      label: "Probing fixed-variable split",
      hint: "The split inside your headline number shapes the offer — recruiters need it to compare like-for-like.",
    };
  }
  if (/credibility/i.test(t)) {
    return {
      label: "Verifying your background",
      hint: "Recruiters cross-check stated affiliations against your resume — keep your story consistent across every channel.",
    };
  }
  return {
    label: "Probing your context",
    hint: "Recruiters gather discovery signal before anchoring — every answer narrows the band they can offer.",
  };
}

function componentProbeLabel(component: "base" | "variable" | "esop"): { label: string; hint: string } {
  switch (component) {
    case "base":
      return {
        label: "Probing base pay",
        hint: "Base is the hardest number to move post-offer — recruiters probe it early to set a ceiling.",
      };
    case "variable":
      return {
        label: "Probing variable pay",
        hint: "Variable pay is easy to stretch but rarely paid in full — separate target from realised when you discuss it.",
      };
    case "esop":
      return {
        label: "Probing equity stake",
        hint: "Equity lets them swap cash for paper — be explicit about vest schedule, refresh policy, and grant valuation.",
      };
  }
}

function infoDisclosureLabel(topic: "breakdown" | "benefits" | "comp-structure" | "notice" | "hike-pct"): {
  label: string;
  hint: string;
} {
  switch (topic) {
    case "breakdown":
      return {
        label: "Sharing offer breakdown",
        hint: "Real recruiters walk fixed / variable / equity / one-time on request — opacity here is a yellow flag.",
      };
    case "benefits":
      return {
        label: "Sharing benefits detail",
        hint: "Benefits are easy concessions that rarely change total comp — useful info, weak leverage.",
      };
    case "comp-structure":
      return {
        label: "Sharing comp structure",
        hint: "Structure (fixed vs variable mix, vesting, refresh) shapes effective comp more than the headline number.",
      };
    case "notice":
      return {
        label: "Sharing notice norms",
        hint: "Notice and joining-date norms set the operational frame for the offer — pay attention to what they treat as fixed.",
      };
    case "hike-pct":
      return {
        label: "Sharing hike framing",
        hint: "Hike-% framing keeps the anchor on your current CTC; reframe on market and role instead.",
      };
  }
}

/* ─── Main derive ─────────────────────────────────────────────────── */

export function deriveMoveTag(action: NextAction, _state: NegotiationState): MoveTag {
  switch (action.kind) {
    /* ── Terminal / structural ─────────────────────────────────── */
    case "terminal-restate":
      return {
        label: "Restating the outcome",
        family: "terminal",
        hint: "The conversation has reached its endpoint; the recruiter summarises where things landed.",
      };
    case "close": {
      const family: MoveTag["family"] = "close";
      if (action.mode === "accept") {
        return {
          label: "Closing on acceptance",
          family,
          hint: "When both sides converge, the recruiter moves to confirm and exit negotiation — pressure-test before saying yes.",
        };
      }
      if (action.mode === "walkaway") {
        return {
          label: "Closing as walk-away",
          family,
          hint: "When numbers don't meet, recruiters close politely to preserve relationships and keep options open later.",
        };
      }
      return {
        label: "Closing on stalemate",
        family,
        hint: "When neither side moves further, the recruiter ends the round without conceding — momentum favours whoever resumes first.",
      };
    }
    case "auto-accept":
      return {
        label: "Confirming acceptance",
        family: "close",
        hint: "The recruiter confirms agreement on terms — make sure every component is explicit before you confirm back.",
      };
    case "close-recap-formal":
      return {
        label: "Recapping the full offer",
        family: "close",
        hint: "Before the offer letter, recruiters recap fixed, variable, equity, dates and notice — this is your last natural moment to correct anything.",
      };
    case "post-acceptance-document-request":
      return {
        label: "Requesting documents",
        family: "close",
        hint: "After verbal acceptance, recruiters ask for relieving letters and BGV inputs — clarify what's mandatory vs nice-to-have.",
      };
    case "rescission":
      return {
        label: "Pulling the offer",
        family: "terminal",
        hint: "Recruiters withdraw when negotiation crosses a hard line — a signal you've over-leveraged or breached a stated final.",
      };

    /* ── Discovery / probe family ──────────────────────────────── */
    case "discovery-probe": {
      const { label, hint } = discoveryTopicLabel(action.satisfiesTopic);
      return { label, hint, family: "discovery" };
    }
    case "component-probe": {
      const { label, hint } = componentProbeLabel(action.component);
      return { label, hint, family: "discovery" };
    }
    case "probe-expectations":
      return {
        label: "Asking for your number",
        family: "discovery",
        hint: "Recruiters who ask you to name a number first are shifting the anchoring burden — answer in a range, with reasoning.",
      };
    case "probe-justification":
      return {
        label: "Probing your justification",
        family: "discovery",
        hint: "Recruiters test the basis for your ask — market data, role scope, and comparable offers travel further than personal need.",
      };
    /* PDF#51 (2026-05-28) — deterministic answer-direct. The recruiter
     * is shipping curated response-bank prose; the transparency layer
     * should mark it as a substantive answer, not a probe. */
    case "answer-direct":
      return {
        label: "Answering directly",
        family: "meta",
        hint: "When a candidate asks a substantive question, recruiters answer first — the planner shipped curated prose for this topic instead of routing through the LLM.",
      };
    case "reactive-followup":
      return {
        label: "Reacting to your last point",
        family: "discovery",
        hint: "Recruiters reorder their checklist around what you just disclosed — useful disclosures get more probes, not fewer.",
      };
    case "probe-mismatch":
      return {
        label: "Surfacing a mismatch",
        family: "discovery",
        hint: "Recruiters surface gaps between what you said and what the role requires — this is a credibility check, not a hostile move.",
      };
    case "credibility-probe":
      return {
        label: "Verifying background",
        family: "discovery",
        hint: "Recruiters cross-check stated affiliations against your resume — keep your story consistent across every channel.",
      };

    /* ── Disclosure / info ─────────────────────────────────────── */
    case "info-disclosure": {
      const { label, hint } = infoDisclosureLabel(action.topic);
      return { label, hint, family: "discovery" };
    }
    case "band-disclosure-deflect":
      return {
        label: "Deflecting band question",
        family: "stall",
        hint: "Indian HR rarely shares the internal band — they redirect to your expectation so you anchor first.",
      };

    /* ── Anchor family ─────────────────────────────────────────── */
    case "anchor-with-offer":
      return {
        label: "Anchoring you to a number",
        family: "anchor",
        hint: "Real Indian HR opens with a single offer number, not a range — treat it as a floor, not the ceiling.",
      };
    case "open-with-offer":
      return {
        label: "Opening with an offer",
        family: "anchor",
        hint: "Leading with a number sets the anchor; the rest of the conversation pulls toward it unless you reframe.",
      };
    case "band-anchor-with-rationale":
      return {
        label: "Anchoring with rationale",
        family: "anchor",
        hint: "Recruiters pair the anchor with peer / market reasoning so it feels objective — test the reasoning, not just the number.",
      };

    /* ── Defense family ────────────────────────────────────────── */
    case "comparative-anchoring":
      return {
        label: "Comparing you to peers",
        family: "defense",
        hint: "Recruiters place you within the peer band to justify their offer — ask which peer set and what scope assumptions they used.",
      };
    case "internal-equity-defense":
      return {
        label: "Citing internal equity",
        family: "defense",
        hint: "'We can't disturb internal equity' is a defensive frame that converts a budget choice into a policy one — push for specifics.",
      };
    case "anchor-defense-hike-strong":
      return {
        label: "Defending hike size",
        family: "defense",
        hint: "Recruiters rebut 'that's only X%' by reframing on absolute pay and market position — they own the math when you complain in percentages.",
      };
    case "fake-leverage-challenge":
      return {
        label: "Testing your competing offer",
        family: "defense",
        hint: "Recruiters ask for proof of competing offers — vague leverage gets discounted; specific, verifiable leverage moves the number.",
      };
    case "competitor-match":
      return {
        label: "Taking your competing offer to the panel",
        family: "counter",
        hint: "When you substantiate a higher competing offer, recruiters commit to a panel re-check — that's the signal to clarify your acceptance criteria, not to add new asks.",
      };

    /* ── Counter family ────────────────────────────────────────── */
    case "counter-offer":
      return {
        label: "Counter-offering",
        family: "counter",
        hint: "When recruiters counter, the size of the move signals how much room is left — don't anchor to the new number, anchor to your target.",
      };

    /* ── Stall family ──────────────────────────────────────────── */
    case "panel-approval-stall":
      return {
        label: "Stalling for panel approval",
        family: "stall",
        hint: "Recruiters use 'let me check with leadership' to manufacture friction and test your patience — set a clear timeline back.",
      };
    case "hold-firm":
      return {
        label: "Holding the line",
        family: "stall",
        hint: "Recruiters hold firm to test whether you have room to move — silence often does more than another argument here.",
      };
    case "lever-loop-guard":
      return {
        label: "Pausing the loop",
        family: "stall",
        hint: "When the conversation cycles through the same levers, the recruiter pauses to break the loop — bring new information to restart it.",
      };
    case "polite-walkaway":
      return {
        label: "Politely walking away",
        family: "terminal",
        hint: "Recruiters walk politely when leverage signals are weak — re-engagement is possible if you bring new, credible leverage later.",
      };
    case "live-walk-away":
      return {
        label: "Threatening to walk",
        family: "stall",
        hint: "A live walk-away signal is a leverage test — measured probing tends to read as real, ultimatums tend to read as bluffs.",
      };

    /* ── Lever family (concession alternatives) ────────────────── */
    case "lever-explore":
      return {
        label: "Exploring other levers",
        family: "counter",
        hint: "When cash is tight, recruiters pivot to structural levers — equity, joining bonus, grade, retention — these vary in real value.",
      };
    case "lever-grade-upgrade":
      return {
        label: "Offering grade upgrade",
        family: "counter",
        hint: "A grade bump shifts your future band more than the headline offer — but verify scope, title, and review-cycle implications.",
      };
    case "lever-retention-bonus":
      return {
        label: "Offering retention bonus",
        family: "counter",
        hint: "Retention bonuses are clawback-able and time-locked — useful cash, but worth less than equivalent base.",
      };
    case "lever-rsu-refresh":
      return {
        label: "Offering RSU refresh",
        family: "counter",
        hint: "Refresh grants matter more than initial grants over a 4-year horizon — ask about typical refresh size and cadence.",
      };
    case "lever-relocation":
      return {
        label: "Offering relocation",
        family: "counter",
        hint: "Relocation is a one-time, often tax-grossed-up perk — pleasant, but rarely material against total comp.",
      };
    case "lever-perf-bonus-cadence":
      return {
        label: "Offering bonus cadence",
        family: "counter",
        hint: "Recruiters tweak bonus timing to sweeten short-term cash — useful if you trust the payout history, weak if you don't.",
      };
    case "lever-work-mode":
      return {
        label: "Offering work flexibility",
        family: "counter",
        hint: "Hybrid / WFH days are real quality-of-life value but cost the company nothing — get it into the offer letter, not left verbal.",
      };
    case "lever-growth-path":
      return {
        label: "Offering growth path",
        family: "counter",
        hint: "A defined promotion timeline and scope are worth chasing — but only if the review milestones go into the offer in writing, not just spoken.",
      };
    case "lever-joining-bonus-explained":
      return {
        label: "Offering joining bonus",
        family: "counter",
        hint: "Joining bonuses are clawback-tied to tenure — treat them as advance pay you'd repay if you leave, not as part of your base.",
      };
    /* ── Meta — frustration recovery (Commit E follow-up 2026-05-18) ── */
    case "acknowledge-and-recover":
      return {
        label: "Acknowledging the loop",
        family: "meta",
        hint: "The recruiter heard you repeat yourself and is course-correcting — a healthy signal, but watch that the next move actually advances the topic.",
      };
    /* ── Meta — contradiction callout (Memory feature 2026-05-29) ── */
    case "contradiction-callout":
      return {
        label: "Calling out a contradiction",
        family: "meta",
        hint: "The recruiter remembered your earlier number and is flagging the gap — pick the real number and stick with it.",
      };
    /* PDF#35 Move 1 — post-anchor offer-recap (2026-05-18) */
    case "offer-recap":
      return {
        label: "Recapping the offer",
        family: "anchor",
        hint: "The recruiter is restating the standing offer at your request — use the pause to think structure, not to renegotiate the number.",
      };
    /* PDF#34 Fix 3 — clarification inline-define (2026-05-18) */
    case "clarify-prior-question":
      return {
        label: "Clarifying the prior question",
        family: "meta",
        hint: "The recruiter heard you ask for clarification on a term they just used and is defining it inline — a strong signal that you can ask for plain English without losing ground.",
      };
    /* Phase 5 Session A — multi-round persona handoff (2026-05-19) */
    case "round-transition":
      return {
        label: "Round handoff",
        family: "meta",
        hint: "Multi-round persona switch",
      };
    /* Audit fix 2026-05-21 — CTC-inflation anchor + truth follow-up. */
    case "ctc-inflation-anchor":
      return {
        label: "CTC-inflation anchor",
        family: "anchor",
        hint:
          "The recruiter is quoting a headline TOTAL PACKAGE that bundles fixed, variable, ESOP paper-value, joining bonus, and benefits. " +
          "Only the fixed component is guaranteed cash. Always ask for the in-hand breakdown before reacting to the headline number.",
      };
    case "ctc-inflation-truth":
      return {
        label: "Honest in-hand breakdown",
        family: "meta",
        hint:
          "The recruiter answered honestly after you asked for the breakdown. Same numbers, different framing — this is what you should always anchor on.",
      };
    /* Realism-Audit Fix 3 (2026-05-22) — manager-consult stall is a
     * leverage move, not a tactical lever. The coaching hint differs by
     * mode: open turns flag "the recruiter is stalling"; return turns
     * confirm the outcome. */
    case "manager-consult-stall":
      if (action.mode === "open") {
        return {
          label: "Recruiter stall (manager consult)",
          family: "meta",
          hint:
            "The recruiter has deferred to a manager / comp committee. This is the #1 Indian-recruiter leverage tactic — expect a small concession or a hold on the return turn. Don't restate your ask while the stall is in flight; let them come back.",
        };
      }
      return {
        label:
          action.mode === "return-move"
            ? "Stall return — small concession"
            : "Stall return — band held",
        family: "meta",
        hint:
          action.mode === "return-move"
            ? "The recruiter came back with a small concession after the stall. This is real movement; weigh it against your walk-away."
            : "The recruiter held the band after the stall. The leverage tactic was a hold, not a setup for movement.",
      };
    /* Bad-faith tactic injections (2026-05-29). */
    case "exploding-offer-pressure":
      return {
        label: "Artificial deadline pressure",
        family: "meta",
        hint:
          "The recruiter is manufacturing urgency to compress your evaluation window. Call it out and ask for a genuine reason the deadline exists; real approval windows survive a short extension.",
      };
    case "fake-competing-candidate":
      return {
        label: "Fake competing candidate",
        family: "meta",
        hint:
          "The recruiter is hinting at another candidate to pressure you. Ask for specifics — when real, recruiters don't volunteer it; when fake, they retreat under questioning.",
      };
    case "vague-promise":
      return {
        label: "Vague non-binding promise",
        family: "meta",
        hint:
          "The recruiter is dangling a soft commitment (WFH, joining bonus, title) without putting it in writing. Ask for it on the offer letter — if it can't be documented, it isn't real.",
      };
    /* Prior-context / memory-callback / warm-ack families (2026-05-29). */
    case "acknowledge-existing-offer":
    case "acknowledge-retention-offer":
    case "competing-offer-warm-ack":
      return {
        label: "Acknowledging your prior context",
        family: "meta",
        hint:
          "The recruiter is acknowledging context you brought into the room. This is rapport, not a concession — don't soften your ask in response.",
      };
    case "match-existing-offer-prose":
      return {
        label: "Reaction to existing offer",
        family: "anchor",
        hint:
          "The recruiter is reacting to a competing offer you've already disclosed. Watch whether they match, stretch on a different lever, or politely decline — each signals different room.",
      };
    case "retention-trump-warning":
      return {
        label: "Retention-match needs sign-off",
        family: "meta",
        hint:
          "The recruiter is flagging that matching your retention requires escalation. This usually means real movement is possible but slower — don't restate your ask while the stall is live.",
      };
    case "callback-prior-context":
      return {
        label: "Memory callback",
        family: "meta",
        hint:
          "The recruiter is referencing a fact you stated earlier. This is a credibility / rapport play — confirm the fact or correct it crisply, don't re-anchor.",
      };
    case "paraphrase-recap":
      return {
        label: "Paraphrase recap",
        family: "meta",
        hint:
          "The recruiter is compressing the deal so far and asking you to confirm. Reply with a clean yes/no — if anything's off, correct it crisply now.",
      };
    case "calibrated-surprise-lowball":
      return {
        label: "Calibrated surprise (lowball)",
        family: "anchor",
        hint:
          "The recruiter is probing because your anchor landed well below band floor. Revise up with confidence — this is a signal that you're undervaluing yourself.",
      };
    case "accept-lowball-quiet":
      return {
        label: "Quiet accept of lowball",
        family: "anchor",
        hint:
          "The recruiter probed your lowball anchor and you held — they're now packaging at that number. You left money on the table; remember this for the next round.",
      };
    /* Proactive-sweetener feature (2026-05-30). The recruiter is
     * volunteering a non-cash sweetener UNPROMPTED because they've
     * sensed the candidate cooling and they're capped on cash. The
     * coaching hint frames this as a signal that real cash room is
     * gone — the candidate should evaluate the sweetener on its own
     * merits, not as a path back to a higher base. */
    case "proactive-sweetener":
      return {
        label: "Proactive sweetener",
        family: "counter",
        hint:
          "The recruiter has surfaced a non-cash sweetener unprompted — typically a signal cash is capped. Evaluate the sweetener on its own merits; the base isn't going to move further here.",
      };
  }
  /* Exhaustiveness fallback — TS's stricter Vercel build flags this
   * function as "lacks ending return" without an explicit out-of-switch
   * return, even though every NextAction kind has a case. The fallback
   * also future-proofs against new NextAction kinds shipped without a
   * corresponding move-tag entry. */
  const _exhaustive: never = action;
  void _exhaustive;
  return {
    label: "Continuing the conversation",
    family: "meta",
    hint: "The recruiter is moving the conversation forward — stay focused on the next concrete decision.",
  };
}
