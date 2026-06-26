/* Acceptance classifier — single source of truth for "did the
 * candidate accept the offer". Two detectors were running in parallel
 * before this module landed:
 *   - `signalsAcceptance` inside parseCandidateAnswer (kernel path,
 *     per-turn regex on the candidate's reply)
 *   - `acceptedImmediately` inside extractNegotiationFacts (legacy
 *     facts path, regex on every userAnswer in the transcript)
 * They drifted: the kernel got a soft-acceptance batch (MakeMyTrip,
 * 2026-05-12), then explicit "would like to accept" forms (Lollypop,
 * 2026-05-13), then a weak-affirmative veto (Accenture, 2026-05-13).
 * The legacy detector got none of those. Every fix had to land twice
 * or risk asymmetric behavior depending on which path the UI consumed.
 *
 * This module collapses both detectors into one classifier. The
 * kernel and the legacy facts extractor both call `classifyAcceptance`
 * — any future bug-fix lands once, both paths get it.
 *
 * The classifier is also the place where structural phase gates live.
 * Pattern matching alone can never get this right: "Sounds good" is
 * acceptance after an offer is on the table, and conversational
 * filler before any number has been quoted. Callers pass context
 * (phase + offerOnTable) when known; the gate fires only when the
 * context is provided AND structurally inconsistent with acceptance.
 * When context is omitted (back-compat for the whole-transcript
 * extractor), the gate is skipped — keeping the legacy behavior
 * intact for any caller that hasn't been migrated.
 *
 * Tier rules (in order, highest first):
 *   1. Veto wins. Walk-away / hard-conditional / negotiating-but /
 *      negation / weak-affirmative-only / phase-gate → never accept.
 *   2. Performative verb wins. "I accept / I agree / I'll take it /
 *      done deal / signing today" alone is strong enough to accept
 *      even without an offer reference (the candidate's intent is
 *      unambiguous; if there's no offer on the table that's the
 *      caller's bug, not ours — but we still return confidence=
 *      "strong" so the caller can decide).
 *   3. Commitment idiom + offer reference. "Sounds good, your offer
 *      works" — medium confidence acceptance.
 *   4. Soft alignment — "I like your offer / aligned with the offer"
 *      — already names the offer, medium confidence acceptance.
 *   5. Otherwise no acceptance. */

export interface AcceptanceContext {
  /** Current kernel phase, if known. Pass undefined from legacy
   *  whole-transcript callers — the phase gate is skipped. */
  phase?: string;
  /** Whether the bot has quoted a salary number yet (i.e. an offer
   *  exists to accept). Pass undefined when unknown — phase gate
   *  is skipped. The kernel passes `state.highestOfferMade > 0`. */
  offerOnTable?: boolean;
}

export type AcceptanceConfidence = "strong" | "medium" | "none";

export interface AcceptanceResult {
  accepted: boolean;
  confidence: AcceptanceConfidence;
  /** Human-readable breadcrumbs for telemetry / debugging.
   *  Useful when a session is misclassified and we need to trace which
   *  rule fired. Each string is a rule id, e.g. "performative-verb",
   *  "weak-affirmative-only-veto", "phase-gate-no-offer". */
  reasons: string[];
  /** Split-clause detection (Session 12 regression, 2026-05-14):
   *  candidate accepts AND asks a follow-up info question in the same
   *  utterance, e.g. "I'll join. Can you let me know the benefits?".
   *  When true, orchestrator should both transition to `accepted` AND
   *  also disclose the requested info in the same response. Optional —
   *  callers that don't read it still get correct `accepted` semantics. */
  hasFollowUpQuestion?: boolean;
}

/* ─── Pattern bank ─────────────────────────────────────────────── */

/** Performative acceptance verbs — these alone are strong enough
 *  to count as acceptance regardless of whether an offer reference
 *  is present. The verb itself names the speech act. */
const STRONG_PERFORMATIVE_PATTERNS: RegExp[] = [
  /\bi(?:'d)?\s+accept(?:\s+(?:this|the|your)\s+offer|\s+it)?\b/i,
  /\bi\s*(?:'m|am)\s+accept(?:ing|ed)?\b/i,
  /\bi\s*(?:'?ll|will)\s+accept(?:\s+(?:this|the|your)\s+offer|\s+it)?\b/i,
  /\bi\s+would\s+(?:like\s+to|love\s+to)\s+accept\b/i,
  /\bi'?d\s+(?:like\s+to|love\s+to)\s+accept\b/i,
  /\bi\s+want\s+to\s+accept\b/i,
  /* Bug-report 15 (2026-05-14) — voice transcription routinely drops
   * the leading "I" ("Would like to accept this offer.", "Want to
   * accept the package."). Anchor on the verb phrase itself so the
   * subject is optional but the speech act is unambiguous. Anchored
   * to the start of a sentence (^ or after .?!) to avoid matching
   * "if you'd ever want to accept" type embedded phrases. */
  /(?:^|[.!?]\s*)(?:would|want)\s+to\s+accept\b/i,
  /(?:^|[.!?]\s*)(?:would\s+)?like\s+to\s+accept\b/i,
  /\bi\s*(?:'ve|have)\s+(?:already\s+)?accepted\b/i,
  /\bi(?:\s+have)?\s+already\s+accepted\b/i,
  /\baccept(?:ing|ed)\s+(?:this|the|your)\s+offer\b/i,
  /\bi\s+(?:fully\s+|totally\s+|completely\s+)?agree\b/i,
  /\b(?:fully|totally|completely)\s+agree\b/i,
  /\bi.?ll\s+take\s+(?:it|the\s+offer)\b/i,
  /\bhappy\s+to\s+accept\b/i,
  /\bi.?m\s+signing\s+(?:today|now|tonight)\b/i,
  /\bsign\s+(?:today|right\s+now|tonight)\b/i,
  /* Session B (2026-05-14) — bare "I'll sign" / "let me sign" commit
   * verb (no time qualifier needed; the verb itself is the speech act). */
  /\bi.?ll\s+sign\b/i,
  /\blet\s+me\s+sign\b/i,
  /* "I'll join" — commit-to-join verb, structurally as strong as
     "I accept". Added 2026-05-14 (Session 12). */
  /\bi.?ll\s+join(?:\s+(?:the\s+)?(?:company|team|firm|role|offer))?\b/i,
  /\bi.?ll\s+go\s+with\s+(?:this|the\s+offer|that)\b/i,
  /\bworks\s+for\s+me[,\s]+i.?ll\s+sign\b/i,
  /* Hinglish performative accept (live-staging, 2026-06-18). Indian
   * candidates close with "accept karta/karti hoon" (I accept), "accept
   * kar raha/rahi hoon" (I'm accepting), "accept karunga/karungi" /
   * "accept kar lunga" (I'll accept), "accept kar liya" (accepted). The
   * verb "accept" + Hindi conjugation is as unambiguous a speech act as
   * "I accept" — strong enough to bypass the offer-reference phase gate,
   * exactly like the English performatives above. Without it, a Hinglish
   * acceptance with no surrounding English ("accept karta hoon") fell
   * through to no-match and the candidate's close was lost. */
  /\baccept\s+kar(?:ta|ti|unga|ungi|\s+rah[ai]|\s+l(?:u|oo)nga|\s+li(?:ya)?)\b/i,
  /* Adversarial-sim S7 (2026-06-19) — bare performative accept verb with
   * no subject and no object: "alright, accepted", "accepted.", "accept."
   * Voice candidates routinely close with a single committal word. None
   * of the subject-led / object-led arms above match it, so the close was
   * silently lost (bot kept negotiating against an accepted offer). Anchor
   * the verb to a clause boundary (^ or after . ! ? ,) AND require it to
   * END a clause (terminal punctuation or string end) so embedded uses
   * like "accepting your feedback gracefully" or "then accept the role
   * later" do NOT match. Negation / hard-conditional / negotiating-but
   * vetoes run BEFORE this arm in classifyAcceptance, so "I won't accept"
   * and "I'd accept if you can…" are already excluded.
   *
   * Adversarial sweep (2026-06-19) — terse candidates prefix the bare verb
   * with an affirmative and no punctuation ("yes accept", "ok accept",
   * "yeah accept") or append a bare object ("accept it", "yep accept it").
   * The clause-boundary anchor above only fired for "accept."/"accepted."/
   * "yes, accept" (comma), so "yes accept" fell through to no-match and the
   * close was lost — a NO-CLOSE on an unambiguous acceptance. Allow an
   * OPTIONAL leading affirmative and OPTIONAL trailing object; the verb +
   * clause-end requirement is unchanged, so embedded uses ("accepting your
   * feedback", "then accept the role later") still do not match, and the
   * negation / conditional / negotiating-but vetoes still run first. */
  /(?:^|[.!?,]\s*)(?:(?:yes|yeah|yep|yup|ok|okay|sure|alright|fine)[,\s]+)?accept(?:ed|ing|s)?\b(?:\s+(?:it|this|the\s+offer))?\s*(?:[.!?,]|$)/i,
];

/* PRI-56 (2026-06-22, offline hostile sweep S2/S4) — unambiguous close-consent
 * idioms the bank missed, each producing a NO-CLOSE on an unambiguous
 * acceptance (bot kept countering / piling levers over an accepted offer).
 *
 * SINGLE SOURCE OF TRUTH. These forms are referenced in TWO places:
 *   1. COMMITMENT_IDIOM_PATTERNS (below) — so classifyAcceptance returns
 *      signalsAcceptance=true and the offer-on-table phase gate (step 5)
 *      still vetoes them before any number is quoted (medium confidence).
 *   2. STRICT_ACCEPTANCE_PATTERNS (detectExplicitAcceptance) — so the kernel
 *      routes them through closeReason="accept" (terminal, ungated by
 *      minTurnsBeforeClose) instead of the soft-accept path, whose
 *      trailing-non-counter gate dropped the close on a genuine acceptance.
 *      HEDGE_VETO_PATTERNS still runs first in the strict gate, and both
 *      kernel call sites consult it ONLY post-offer (strictBoost gated on
 *      highestOfferMade>0; the other sits inside the signalsAcceptance
 *      branch), so these cannot fire pre-offer.
 *
 * They are unambiguous same-turn consent over a standing offer — structurally
 * identical to the existing "let's move forward with this offer" / "send the
 * offer letter" strict forms, just the terser spoken variants. */
const CLOSE_CONSENT_IDIOM_PATTERNS: RegExp[] = [
  /* 1. "deal" at a clause boundary — "ok, deal", "deal, 40 works", "alright
   *    deal". The bare-token arm required the WHOLE utterance to be "deal", so
   *    "ok, deal" / "deal, 40 works" fell through. Anchored to a clause start
   *    and excludes the rejection sense "deal[- ]breaker"; the walk-away veto
   *    already owns "no deal".
   *    PRI-60 (2026-06-22, offline precision sweep) — the clause anchor matches
   *    after ANY punctuation, so a leading rejection "No, deal's off." parsed the
   *    "deal" after the comma as a CLOSE (FALSE-CLOSE — bot finalizes a deal the
   *    candidate is walking away from). Two negative lookaheads exclude the
   *    "deal('s)/(is) off|dead|over|done|cancelled|gone" walk-away continuations;
   *    "ok, deal." / "deal, 40 works" / "deal is sealed" are untouched. */
  /(?:^|[,.!?]\s*)(?:ok(?:ay)?|alright|yes|yeah|yep|fine|sure)?[,\s]*deal\b(?!\s*[-\s]?breaker)(?!'?s?\s+(?:off|dead|over\b|done\s+for|cancell?ed|gone))(?!\s+(?:is|was)\s+(?:off|dead|over|done|cancell?ed|gone))/i,
  /* 2. Defer-to-your-offer accept — "whatever you just said works", "whatever
   *    you offered is fine", "whatever works for me". The "whatever" head
   *    disambiguates from the bare "<n> works" COUNTER the bank deliberately
   *    excludes. */
  /\bwhatever\s+you\s+(?:just\s+)?(?:said|offered|quoted|proposed|mentioned)\s+(?:works|is\s+(?:fine|good|ok(?:ay)?)|sounds\s+good)\b/i,
  /\bwhatever\s+works\b/i,
  /* 3. "send it" family — a finalize-the-offer instruction over a standing
   *    offer ("yes send it", "send it over", "send across the letter"). The
   *    strict gate already owns "send the offer letter"; these are the terser
   *    spoken forms. Negation ("don't send it") is vetoed at step 1.
   *    PRI-60 (2026-06-22, offline precision sweep) — the bare "send it" + ANY
   *    tail matched the hostile redirect/defer forms "send it back (with a
   *    revised base)", "send it to my email and I'll think about it", which are
   *    NOT consent (FALSE-CLOSE). Require the verb phrase to END the clause,
   *    optionally after an approving adverb (over/across/through/already/now/
   *    please/right away). "send it." / "yes, send it over." still close; "send
   *    it back" / "send it to X" / "send it later" no longer match (the latter is
   *    also caught by the conditional-deferral veto). */
  /\bsend\s+it\b(?:\s+(?:over|across|through|already|now|please|right\s+away))*\s*(?:[.!?,]|$)/i,
  /\bsend\s+(?:me\s+|it\s+|them\s+)?(?:(?:over|across)\s+)?(?:the\s+)?(?:offer\s+)?(?:letter|paperwork|paper\s*work|docs?|contract)\b/i,
  /* 4. "confirmed" / "yes confirmed" / "confirming" — a bare confirmation
   *    token closing the deal. Anchored to a clause boundary AND required to
   *    END the clause so the info-probe "can you confirm the split" (confirm
   *    + object) does NOT match. */
  /(?:^|[,.!?]\s*)(?:yes,?\s+|ok(?:ay)?,?\s+)?confirm(?:ed|ing)?\s*(?:[.!?,]|$)/i,
  /* 5. Hindi "send the offer letter" — "bhej do offer letter", "offer letter
   *    bhej dijiye", "letter bhej do". The Hindi analogue of the English
   *    send-the-paperwork arm above (#3); unambiguous deal-close consent in
   *    either word order. The paperwork noun is REQUIRED, so the bare medium
   *    idiom "bhej do" (in HINDI_MIX_PATTERNS) stays phase-gated while the
   *    explicit "send the letter" closes terminally. Negated "nahi bhej…" is
   *    not a natural Hindi accept form and is covered by the walk-away veto. */
  /\bbhej\s+d(?:o|ijiye|ijye|ena)\s+(?:mujhe\s+|the\s+)?(?:offer\s+)?(?:letter|paperwork|paper\s*work|contract|docs?|kaagaz)\b/i,
  /\b(?:offer\s+)?(?:letter|paperwork|paper\s*work|contract|docs?|kaagaz)\s+bhej\s+d(?:o|ijiye|ijye|ena)\b/i,
  /* PRI-58 (2026-06-22, offline hostile sweep — next accept/close batch) — more
   * unambiguous same-turn close-consent idioms the bank missed, each a NO-CLOSE
   * on a real acceptance. All are deferral-guarded: CONDITIONAL_DEFERRAL_PATTERN
   * runs first in BOTH the medium gate (classifyAcceptance) and the strict gate
   * (HEDGE_VETO_PATTERNS), so "where do I sign once we sort the base" / "count me
   * in if you can do 40" stay rejected. */
  /* 6. "where do I sign (up)" — asking to sign IS consent to sign. */
  /\bwhere\s+do\s+i\s+sign(?:\s+up)?\b/i,
  /* 7. "count me in" — unambiguous opt-in commit. */
  /\bcount\s+me\s+in\b/i,
  /* 8. "you've / we've got a deal" — the deal-struck idiom. Excludes the
   *    rejection sense "deal[- ]breaker" (the bare-"deal" arm #1 owns the
   *    walk-away). */
  /\b(?:you'?ve|you|we'?ve|we)\s+(?:got|have)\s+(?:yourself\s+|ourselves\s+)?(?:a\s+)?deal\b(?!\s*[-\s]?breaker)/i,
  /* 9. "(let's) make it official" — finalize-the-deal commit. */
  /\bmake\s+it\s+official\b/i,
  /* 10. Start-the-paperwork instruction — "let's get the paperwork going",
   *     "get started with the paperwork/formalities". A finalize instruction
   *     over a standing offer, like the "send the offer letter" arm above. */
  /\bget\s+(?:the\s+)?(?:paperwork|paper\s*work|formalities|documentation)\s+(?:going|started|moving|rolling)\b/i,
  /\bget\s+started\s+(?:with|on)\s+(?:the\s+)?(?:paperwork|paper\s*work|formalities|documentation|offer\s+letter)\b/i,
  /* 11. Bare "agreed" closing the clause — "agreed.", "great, agreed". Clause-
   *     anchored AND clause-terminal so the negotiation phrase "agreed terms"
   *     / "we agreed earlier" / "agreed on a higher number" does NOT match. */
  /(?:^|[,.!?]\s*)agreed\s*(?:[.!?,]|$)/i,
  /* PRI-60 (2026-06-22, offline recall sweep) — "I'm on board" / "happy to
   * proceed", unambiguous same-turn consent over a standing offer the bank
   * missed (NO-CLOSE on a real accept). In CLOSE_CONSENT so BOTH the medium
   * gate AND the strict close gate fire — medium-only would leave them in the
   * soft-accept path whose trailing-non-counter gate drops the close (the PRI-56
   * lesson). Anchored to a TERMINAL clause end (. ! ? or string end — NOT a
   * comma) so a hedged comma-tail ("I'm on board, but let me think") does not
   * match in the medium gate, which has no think-it-over veto; the strict gate's
   * HEDGE_VETO owns the hedged tails regardless. The deferral veto owns "happy
   * to proceed once you fix X". */
  /\bi.?m\s+(?:fully\s+|totally\s+|completely\s+|absolutely\s+)?on\s+board\b\s*(?:[.!?]|$)/i,
  /\bhappy\s+to\s+proceed\b\s*(?:[.!?]|$)/i,
  /* PRI-63 (2026-06-22, offline recall sweep) — "consider it accepted/done/a
   * deal" and "sign me up", unambiguous same-turn consent over a standing offer
   * the bank missed (NO-CLOSE on a real accept). In CLOSE_CONSENT so BOTH gates
   * fire. "consider it" REQUIRES a settle-noun object so the hedge "I'll consider
   * it" (think-it-over, owned by HEDGE_VETO) cannot match here. "sign me up" is
   * the imperative analogue of the existing "where do I sign"; deferral-gated
   * ("sign me up once you fix base") by CONDITIONAL_DEFERRAL_PATTERN in both
   * gates. */
  /\bconsider\s+it\s+(?:accepted|done|a\s+deal|sealed|settled|signed|closed|final)\b/i,
  /\bsign\s+me\s+up\b/i,
  /* PRI-63c (2026-06-22, offline recall sweep) — three more unambiguous
   * same-turn consent idioms the bank missed (NO-CLOSE on a real accept). In
   * CLOSE_CONSENT so BOTH gates fire (the PRI-56 lesson: medium-only leaves them
   * in the soft-accept path whose trailing-non-counter gate drops the close).
   *
   * 12. "<n> it is" — the resign-to-a-figure idiom ("45 it is.", "30 it is").
   *     Clause-TERMINAL so "45? it is what it is" (resigned shrug, not consent)
   *     and "is 45 the final number" do NOT match. The planner's tier-B close
   *     resolver binds the same figure, identical to the "<n> done" accept arm. */
  /\b\d+(?:\.\d+)?\s*(?:lpa|lakhs?|l)?\s+it\s+is\b\s*(?:[.!?,]|$)/i,
  /* 13. "that's a yes (from me)" — a plain affirmative commit. The question
   *     "is that a yes" has no apostrophe-s so `that.?s` cannot match it; the
   *     conditional/NEGOTIATING_BUT vetoes (run first in both gates) own
   *     "that's a yes only if base hits 40" / "that's a yes but I want more". */
  /\bthat.?s\s+a\s+yes\b/i,
  /* 14. "lock this/that in" — pronoun generalisation of the existing "lock it
   *     in" commit. "lock in" is an unambiguous finalize verb. */
  /\block\s+(?:it|this|that)\s+in\b/i,
  /* 15. "(let's) finalize it/this/the deal/the offer" — finalize-the-deal
   *     commit, sibling of arm 9 (make it official) and arm 14 (lock it in).
   *     The object is REQUIRED and scoped to a deal-referent (it/this/that/the
   *     deal/offer) so "let's finalize the base/numbers/split/details" — still
   *     negotiating the breakdown, NOT consent — does NOT false-close.
   *     CONDITIONAL_DEFERRAL_PATTERN already owns "finalize" as a settle-verb,
   *     so "let's finalize it once you confirm base" stays vetoed in both gates.
   *     Offline hostile sweep (2026-06-23). */
  /\b(?:let'?s\s+|let\s+us\s+|we\s+can\s+|happy\s+to\s+)?finali[sz]e\s+(?:it|this|that|the\s+(?:deal|offer))\b/i,
];

/** Commitment idioms — informal acceptance markers. Weaker than
 *  performative verbs. Caller must combine with offer reference or
 *  accept on medium confidence with no other vetoes. */
const COMMITMENT_IDIOM_PATTERNS: RegExp[] = [
  /\bi.?m\s+in\b/i,
  /\b(?:your|the)\s+offer\s+(?:works|sounds\s+good|is\s+fine|is\s+great)\b/i,
  /\bsounds\s+good\b/i,
  /\bthat\s+works\b/i,
  /\bit.?s\s+a\s+deal\b/i,
  /\bdone\s+deal\b/i,
  /\blet.?s\s+(?:go\s+ahead|do\s+it|lock\s+it\s+in|proceed)\b/i,
  /* Deal-close idioms (live-staging 2026-06-19). "let's close it" /
   * "let's close the deal" / "close the deal" / "let's close this out" are
   * unambiguous finalize-the-deal commits in a negotiation — the candidate
   * is accepting, not asking to end the call (which terminal-intent owns,
   * and which requires an explicit conversational noun). Gated as a
   * commitment idiom so the offer-on-table phase gate still applies: you
   * cannot "close the deal" before one exists. */
  /\blet.?s\s+close\s+(?:it|this\s+out|the\s+deal|this\s+deal)\b/i,
  /\bclose\s+(?:the|this)\s+deal\b/i,
  /\bi.?m\s+happy\s+with\s+(?:that|the\s+offer)\b/i,
  /\bfine\s+with\s+me\b/i,
  /* Session B (2026-05-14) — bare commitment tokens. Each must be the
   * whole utterance or terminated cleanly — "deal" as a single word,
   * "sold", "done" (not "let me think about it, done"). Capturing them
   * as commitment idioms (not performative) keeps the phase gate active:
   * "deal" before any number is on the table is filler. */
  /^\s*deal\s*[.!?]?\s*$/i,
  /^\s*sold\s*[.!?]?\s*$/i,
  /^\s*done\s*[.!?]?\s*$/i,
  /^\s*let'?s\s+go\s*[.!?]?\s*$/i,
  /^\s*works\s+for\s+me\s*[.!?]?\s*$/i,
  /* PRI-58 (2026-06-22) — "I'm sold" as a settle commit. Clause-anchored to the
   * end so the hedge "I'm sold on the role but the comp is light" (sold + "on …")
   * does NOT match — only a terminal "I'm sold" / "I'm sold." commits. The bare
   * "sold" token already lives above; this is the subject-led spoken form. */
  /\bi.?m\s+sold\b\s*(?:[.!?,]|$)/i,
  /* #127 (2026-06-21, live-staging) — terse accept-WITH-number. An Indian
   * candidate closing a haggle routinely answers a counter with the settle
   * figure welded to a commit token: "fine 22 done", "22 done", "ok 22 deal",
   * "done at 22", "52 works". The bare-token commits above require the WHOLE
   * utterance to be "done"/"deal", so the embedded figure dropped these to
   * no-match and the acceptance was lost — the turn read as a stray counter
   * and fired an anchor instead of closing. The adjacent figure both names the
   * settle number AND satisfies OFFER_REFERENCE_PATTERN, so this is a safe
   * commitment idiom; the offer-on-table phase gate at step 5 still applies
   * (you cannot "22 done" before a number exists). The close-number resolver
   * (`acceptanceUtteranceFigure` tier-B in the planner) binds the same figure
   * so the close lands AT it, not on the bare standing offer.
   *
   * Token discipline: only UNAMBIGUOUS settle tokens (done/deal/sold) qualify,
   * and the token must sit at a clause boundary. "works" and "final" are
   * deliberately excluded here — "36 works" / "26 final" are COUNTERS, not
   * accepts ("Can you stretch to 38? Otherwise 36 works."), and this classifier
   * runs on every turn with no close-context gate. The clause-boundary anchor
   * also rejects "26 deal breaker" (rejection) while keeping "22 done."/"ok 22
   * deal,". The planner's tier-B close resolver, which only fires once the
   * candidate is already closing, keeps the looser "works" form safely. */
  /* PRI-63b (2026-06-22) — allow an optional comma between the figure and the
   * settle token: "ok 45, done" / "45, deal" are the same accept-with-number as
   * "45 done", just spoken with a beat. Clause-terminal guard unchanged, so
   * "45, done deliberating" still does NOT match. */
  /\b\d+(?:\.\d+)?\s*(?:lpa|lakhs?|l)?\s*,?\s*(?:done|deal|sold)\s*(?:[.!?,]|$)/i,
  /\b(?:done|deal|sold|settled?|finalized?)\s+(?:at|for|on)\s+\d+(?:\.\d+)?\b/i,
  /* PRI-56 close-consent idioms — single source of truth (also strict). */
  ...CLOSE_CONSENT_IDIOM_PATTERNS,
];

/** Soft-alignment forms — language that affirms the offer
 *  specifically, surfaced by MakeMyTrip UX session (2026-05-12).
 *  Each pattern already references the offer object, so the offer-
 *  reference gate is implicitly satisfied. */
const SOFT_ALIGNMENT_PATTERNS: RegExp[] = [
  /\bi\s+(?:really\s+|truly\s+)?like\s+(?:the|this|your)\s+(?:initial\s+)?offer\b/i,
  /\b(?:i'?m|i\s+am|we'?re|we\s+are)\s+aligned\s+(?:with|on)\s+(?:the|this|your)\s+(?:initial\s+)?offer\b/i,
  /* Contraction-tolerant: "we've"/"I've" carry no space between the
   * pronoun and "'ve", so the old \s+ form only matched the rarer
   * "we have aligned" and silently dropped the common spoken "we've
   * aligned" (10/10-plan A1, 2026-06-23). \s* + optional apostrophe
   * accepts we've / I've / we have / I have. */
  /\b(?:we|i)\s*(?:'?ve|\s+have)\s+(?:already\s+)?aligned\s+(?:on|with)\s+(?:the|this|your)\s+(?:initial\s+)?offer\b/i,
  /\b(?:the|this|your)\s+(?:initial\s+)?offer\s+aligns?\s+with\b/i,
  /\bi'?m\s+fine\s+with\s+(?:the|this|your)\s+offer\b/i,
  /\bi'?m\s+good\s+with\s+(?:the|this|your)\s+offer\b/i,
];

/** Hindi-mix acceptance idioms — bare "haan ok / theek hai / done
 *  deal" style. Treated as commitment idioms (medium confidence). */
const HINDI_MIX_PATTERNS: RegExp[] = [
  /\btheek\s+hai\b/i,
  /\btheek\s+he\b/i,
  /\bho\s+ja(?:y|e)ega\b/i,
  /\bkar\s+(?:di(?:ya|jiye)|do|dijiye)\b/i,
  /\bmanzoor(?:\s+hai)?\b/i,
  /\bhaan\s+(?:thik|theek|ok|okay|done)\b/i,
  /* STT fragility audit (2026-05-22) — bare Hindi affirmatives.
   * Indian candidates routinely answer "are you good with this offer?"
   * with bare "haan" / "ji" / "ji haan" / "ha ji" / "hanji" / "bilkul".
   * Previously HINDI_MIX_PATTERNS required "haan + thik/ok/done"; bare
   * Hindi yes fell through to no-match and the candidate's acceptance
   * was lost. The structural phase gate at step 5 still vetoes these
   * when no offer is on the table (you can't accept what hasn't been
   * offered) — so this is safe to fire as a commitment idiom. */
  /^\s*(?:haan|hanji|han\s*ji|ha\s*ji|ji\s+haan|ji|bilkul)\s*[,.!]?\s*$/i,
  /^\s*(?:haan|hanji|han\s*ji|ha\s*ji|ji\s+haan|ji|bilkul)[,\s]+/i,
  /* Offline hostile sweep S1 (2026-06-22) — common Hindi accept idioms the
   * bank missed. "chalega" / "chal jayega" (it'll work / acceptable),
   * "kar lo" / "kar lijiye" (go ahead, do it), "de do" / "de dijiye" (give
   * it), and the terse "bhej do" / "bhej dijiye" (send it). Medium-confidence
   * commitment idioms — the offer-on-table phase gate (step 5) still vetoes
   * them before any number is on the table, so a pre-offer "chalega" can't
   * force a close. The deal-close sense "bhej do offer letter" is ALSO routed
   * through the strict gate via CLOSE_CONSENT_IDIOM_PATTERNS. Negated forms
   * ("nahi chalega", "yeh nahi chalega") are owned by WALK_AWAY_PATTERN, which
   * vetoes first in classifyAcceptance. */
  /\bchal(?:ega|\s+jaa?yega|\s+jaega|\s+jayegi)\b/i,
  /\bkar\s+l(?:o|ijiye|ijye|ena)\b/i,
  /\bde\s+d(?:o|ijiye|ijye|ena)\b/i,
  /\bbhej\s+d(?:o|ijiye|ijye|ena)\b/i,
  /* PRI-58 (2026-06-22) — "aage badho / aage badhte hai" (let's move ahead /
   * proceed), the Hindi analogue of "let's go ahead". Medium commitment idiom;
   * the offer-on-table phase gate still applies pre-offer. */
  /\baage\s+badh(?:o|te|ate|ao|na|enge|aao|iye|na\s+hai|na\s+chahiye)\b/i,
];

/** Offer reference — the candidate's text mentions the offer object
 *  or a specific number. Required to upgrade a commitment idiom
 *  from "ambiguous filler" to "acceptance". */
const OFFER_REFERENCE_PATTERN =
  /\b(?:offer|deal|salary|ctc|package|lpa|lp[a-z]|lakhs?|lacs?|lacks|lax|₹|rs\.?|inr|\$\s*\d|\d+\s*(?:lpa|lp[a-z]|lakhs?|lacs?|lacks|lax|l\b|cr|crore|k\b))\b/i;

/** Veto: walk-away or rejection. */
const WALK_AWAY_PATTERN =
  /\b(walk away|walking away|i.?m out|not interested|i.?ll pass|no deal|no chance|not a chance|withdraw|decline|won.?t work|isn.?t going to work|have to pass|that won.?t work|move on|nahi\s+(?:chahiye|karna|banega|hoga|chalega|chal\s+payega|jamega|kar\s+sakta)|nahin\s+(?:chahiye|karna|chalega)|mujhe\s+nahi(?:n)?\s+chahiye)\b/i;

/** Veto: deferred-condition framing — "once we sort the base", "after you
 *  confirm the split". A close-consent idiom ("where do I sign", "count me
 *  in") gated on a future event is NOT a same-turn commitment. Scoped to a
 *  follow-on settlement/adjust verb so the temporal "once" ("I worked there
 *  once") and benign "after the call" don't false-veto. Shared by BOTH the
 *  medium gate (classifyAcceptance, via HARD_CONDITIONAL) and the strict gate
 *  (detectExplicitAcceptance, via HEDGE_VETO_PATTERNS) so the two stay in
 *  lockstep — offline hostile sweep (2026-06-22). */
const CONDITIONAL_DEFERRAL_PATTERN =
  /\b(?:once|after|when|as\s+soon\s+as|assuming|provided(?:\s+that)?|so\s+long\s+as|the\s+(?:day|moment|minute|second))\s+(?:we|you|i|they|it'?s|that'?s|the|my)\b[^.!?]{0,25}?\b(?:sort(?:ed|s)?|confirm(?:ed|s)?|finali[sz]e[sd]?|adjust(?:ed|s)?|revis(?:e[sd]?|it(?:s|ed)?)|fix(?:ed|es)?|agree[sd]?|settle[sd]?|match(?:ed|es)?|increase[sd]?|bump(?:ed|s)?|raise[sd]?|sen[dt]s?|updat(?:e[sd]?|ing)|sign(?:ed|s)?)\b/i;

/* PRI-59 (2026-06-22, offline precision sweep) — FALSE-CLOSE vetoes. The
 * recall-focused accept idioms (PRI-56/57/58) each carry a short substring
 * that hostile NON-accepts share, risking the worst failure mode: closing a
 * deal the candidate is actually rejecting / hedging / deferring. Each veto
 * below is shared single-source between the medium gate (classifyAcceptance
 * step 1) and the strict gate (HEDGE_VETO_PATTERNS) so the two stay in
 * lockstep. Every veto is scoped to a CONTINUATION that disambiguates the
 * hedge from the bare commit — "I'll take it" still accepts, "I'll take it
 * elsewhere" does not. */

/** Veto: "I'll take it ELSEWHERE / under advisement / or leave it / back / to
 *  my boss" — the take-it verb survives a walk-away or stall continuation. Bare
 *  "I'll take it" (the genuine accept) carries none of these and is untouched.
 *  PRI-61 (2026-06-22, offline precision sweep) — more stall/defer continuations
 *  the take-it verb hijacks: "under consideration/review" (defer), "from here"
 *  (I'll handle it myself), "on board" (I'll note it), "as a maybe" (non-commit),
 *  "slow" (slow down). All are "I'll think about it" in disguise, not consent.
 *  "as a maybe" is scoped to the non-commit noun so "take it as a yes" — a
 *  genuine (if rare) accept — is NOT vetoed. */
const TAKE_IT_HEDGE_PATTERN =
  /\btake\s+(?:it|the\s+offer)\s+(?:elsewhere|somewhere|under\s+(?:advisement|consideration|review)|or\s+leave\s+it|back\b|away\b|from\s+here\b|on\s+board\b|as\s+a\s+maybe\b|slow\b|to\s+(?:my|the|another|a\s)|with\s+me\b|home\b)/i;

/** Veto: "I'm in A / AN / TALKS / DISCUSSIONS / NO RUSH / THE MIDDLE / TWO
 *  MINDS …" — the "I'm in" commit hijacked by a hedge noun phrase. Plain
 *  "I'm in" / "I'm in!" / "I'm in for it" carry no hedge tail and still
 *  accept. Offer-nouns ("I'm in the deal") are deliberately NOT vetoed. */
const IM_IN_HEDGE_PATTERN =
  /\bi.?m\s+in\s+(?:a\b|an\b|talks|discussions?|conversations?|negotiations?|no\s+rush|two\s+minds|touch\b|agreement\b|agreeing\b|the\s+(?:middle|process|running|dark|weeds|loop)|another|other\s+(?:processes|rounds?))/i;

/** Veto: "I accept THAT … / I accept YOUR position / I accept THE reality" —
 *  performative "accept" applied to a proposition, stance, or fact rather than
 *  the OFFER. "I accept" / "I accept the offer" / "I accept your offer" are not
 *  matched (offer excluded from the noun list) and still accept.
 *
 *  INFLECTION (offline hostile sweep, 2026-06-27) — the verb head matches the
 *  inflected forms ("I'm accepting the reality", "I've accepted that", "I'd be
 *  accepting your position"), not just the bare "I accept". The performative
 *  recall bank matches "I'm accept(ing)", so a bare-stem veto here let the
 *  resigned "I'm accepting the reality here" FALSE-CLOSE — same asymmetry as the
 *  rhetorical veto. The proposition NOUN list (reality/fact/position/…) still
 *  excludes "offer", so a genuine "I'm accepting the offer" is untouched. */
const ACCEPT_PROPOSITION_PATTERN =
  /\bi\s*(?:'m|am|'d|'ve|have|'ll|will|had|was)?\s*(?:been\s+|be\s+)?accept(?:s|ing|ed)?\s+(?:that\b|the\s+(?:reality|fact|situation|premise|truth|position|challenge|terms\s+are)|your\s+(?:position|point|stance|reasoning|logic|view|argument|concern))/i;

/** Veto: "in principle" / "pending …" — explicit incomplete-commitment markers.
 *  "I accept in principle" / "yes, pending board approval" are hedges, not a
 *  terminal close. */
const IN_PRINCIPLE_PATTERN = /\b(?:in\s+principle|pending\b)/i;

/* PRI-60 (2026-06-22, offline precision sweep) — RHETORICAL / INVERTED /
 * NEGATED "accept". The performative bank matches the bare "I accept" / "I'd
 * accept" substring, but an interrogative inversion ("why would I accept…",
 * "would I accept…"), a disbelief frame ("do you really think I'd accept…",
 * "you expect me to accept…"), or a negation-by-impossibility ("there's no way
 * I accept…") flips the meaning into a rejection or a rhetorical question — the
 * single worst FALSE-CLOSE class. Each arm is scoped to GOVERN the accept verb
 * (the governor + "accept" within a short window) so a genuine "I accept" /
 * "yes, I accept the offer" — which carries no such governor — is untouched.
 * Shared single-source between the medium gate (classifyAcceptance step 1) and
 * the strict gate (HEDGE_VETO_PATTERNS), like the PRI-59 vetoes. */
const RHETORICAL_ACCEPT_VETO_PATTERNS: RegExp[] = [
  /* INFLECTION NOTE (offline hostile sweep, 2026-06-27) — every arm matches
   * the verb stem as `accept(?:s|ing|ed)?` rather than a bare `\baccept\b`.
   * `\baccept\b` does NOT match "accepting"/"accepted" (no word boundary after
   * the "t"), but the performative recall bank DOES ("\bi'?m\s+accept(?:ing|ed)?
   * \b"). The asymmetry meant "no way I'm accepting that" / "you think I'm
   * accepting this" slipped the veto and FALSE-CLOSED on an outright rejection —
   * the worst failure class. Keying both gates on the same inflected stem closes
   * the gap. */
  /* inverted interrogative: "why would/should I … accept(ing)" */
  /\bwhy\s+(?:would|should|will|on\s+earth\s+(?:would|should))\s+i\b[^.!?]{0,30}\baccept(?:s|ing|ed)?\b/i,
  /* subject-verb inversion: "would/should I (ever) accept" — never a genuine
   * accept (that is "I would accept"); the inversion marks a question. */
  /\b(?:would|should)\s+i\s+(?:ever\s+|really\s+|honestly\s+|seriously\s+)?(?:be\s+)?accept(?:s|ing|ed)?\b/i,
  /* disbelief frame: "(do) you (really) think/expect/believe … accept(ing)" */
  /\byou\s+(?:really\s+|seriously\s+|honestly\s+|actually\s+)?(?:think|expect|believe|assume|reckon|suppose|imagine)\b[^.!?]{0,30}\baccept(?:s|ing|ed)?\b/i,
  /* negation-by-impossibility: "(there's) no way I('m/d) accept(ing)" */
  /\b(?:no\s+way|there'?s\s+no\s+way)\b[^.!?]{0,20}\baccept(?:s|ing|ed)?\b/i,
  /* sarcastic counterfactual: "(as if / like) I'd accept that" — the
   * conditional "I'd accept" under an "as if"/"like" frame is a refusal, never
   * a genuine accept (which is "I accept" / "I'll accept"). Offline sweep
   * batch 2 (2026-06-23). */
  /\b(?:as\s+if|like)\s+i.?d\s+(?:ever\s+|really\s+|actually\s+)?accept(?:s|ing|ed)?\b/i,
  /* sarcasm prefix: "yeah right, I'll take it" / "yeah right, deal". "yeah
   * right" is a stock dismissive in a negotiation; the accept idiom after it is
   * sarcastic, not a commitment. Negative-lookahead exempts the genuinely eager
   * "yeah, right away / right now" so an enthusiastic accept still closes.
   * Offline sweep batch 4 (2026-06-23). */
  /\byeah,?\s+right\b(?!\s+(?:away|now|here|on\s+it|then))/i,
];

/* PRI-61 (2026-06-22, offline precision sweep) — PARTIAL accept: the candidate
 * accepts the role/premise but rejects the MONEY in the same utterance ("I
 * accept the role but not at this comp", "I'd accept, except the variable is
 * unacceptable"). The performative "I accept" / "I'd accept" matches, but a
 * contrastive conjunction governing a money-rejection makes it a counter, not a
 * clean close. NEGATIVE_BUT (above) only fires on a re-open token (more/higher/
 * …); these reject by NEGATING the money or calling it unacceptable, which that
 * pattern misses. Shared single-source between both gates via FALSE_CLOSE. */
const PARTIAL_ACCEPT_VETO_PATTERNS: RegExp[] = [
  /* "… but/except NOT <money noun>" — "but not at this comp", "except for the base" */
  /\b(?:but|except|however|though|aside\s+from)\b[^.!?]{0,40}\bnot\s+(?:at\s+|for\s+|on\s+|with\s+)?(?:this|that|the|these|those|such\s+a)?\s*(?:comp(?:ensation)?|number|figure|salary|package|ctc|price|amount|level|rate|pay|money|base|terms?)\b/i,
  /* "… but/except <too low / unacceptable / unworkable>" */
  /\b(?:but|except|however|though|aside\s+from)\b[^.!?]{0,40}\b(?:un(?:acceptable|workable|reasonable)|too\s+(?:low|little|less|small|tight))\b/i,
];

/* PRI-63 (2026-06-22, offline hostile sweep) — BARE money-rejection veto. A
 * close-consent idiom welded to an explicit price refusal in the SAME clause
 * ("ok, deal? not at this number", "close it out? no way at 30") is a
 * rejection, not consent (FALSE-CLOSE). NEGATION_PATTERN only fires on
 * "not/no … accept|want|…" and PARTIAL_ACCEPT requires a but/except
 * conjunction, so the conjunction-less "not AT this number" / "no way AT 30"
 * forms slipped both. This scopes the refusal to a money/number OBJECT after
 * at/for/on, so a genuine accept that happens to contain "at this number"
 * without a leading negation ("yes, fine at this number") is NOT vetoed.
 * Shared single-source so BOTH gates reject in lockstep. */
const MONEY_REJECTION_PATTERN =
  /\b(?:not|no\s+way|never|no\s+chance)\s+(?:at|for|on)\s+(?:this|that|these|those|the|such\s+a)?\s*(?:number|price|comp(?:ensation)?|figure|salary|rate|amount|level|money|ctc|package|pay|offer|\d)/i;

/* PRI-63b (2026-06-22) — NEGATED settle-token veto. The accept-with-number
 * idioms ("done at 45", "45 done", "it's a deal") match the bare settle token,
 * but a leading negation flips it into a refusal: "not done at 45", "this is
 * not a deal", "I'm not sold". NEGATION_PATTERN only governs accept/want/…, and
 * MONEY_REJECTION requires at/for/on, so the "not + settle-token" form slipped
 * both — a FALSE-CLOSE. Scoped to the UNAMBIGUOUS settle tokens the accept
 * patterns key on; a genuine accept never negates its own settle token. Shared
 * single-source so both gates reject in lockstep. */
const SETTLE_NEGATION_PATTERN =
  /\b(?:not|never|no\s+longer)\s+(?:done|sold|settled?|finali[sz]ed?|closing|a\s+deal)\b/i;

/* PRI-63c (2026-06-22) — "do it <redirect>" veto. The commitment idiom
 * "let's do it" (COMMITMENT_IDIOM, SPLIT_CLAUSE, and the strict gate all carry
 * a "do it" arm) matched "let's do it differently" / "let's do it your way" /
 * "let's do it later" — a redirect or deferral of the approach, NOT consent to
 * finalize (a FALSE-CLOSE: the bot finalized while the candidate was asking to
 * change tack). Scoped to the unambiguous redirect/defer tails only; the present
 * accept "let's do it now" / "let's do it at 45" is untouched (no tail token).
 * Shared single-source so both gates reject in lockstep. */
const DO_IT_REDIRECT_PATTERN =
  /\bdo\s+it\s+(?:differently|in\s+a\s+different\s+way|a\s+different\s+way|another\s+way|some\s+other\s+way|some\s+other\s+time|your\s+way|later|instead)\b/i;

/* Offline hostile sweep batch 2 (2026-06-23) — three more FALSE-CLOSE classes
 * surfaced by the adversarial probe, each a close idiom whose meaning is flipped
 * by a continuation the prior vetoes missed. All shared single-source so BOTH
 * gates reject in lockstep. */

/** Veto: a finalize/close idiom DEFERRED on a settlement noun — "make it
 *  official only after the revision", "lock it in once the bump comes through",
 *  "sign after the approval". CONDITIONAL_DEFERRAL_PATTERN only fires on a
 *  deferral VERB ("after you confirm"); this owns the NOUN-object form. Scoped
 *  to settlement nouns (revision/approval/sign-off/correction/bump/…) so a
 *  benign temporal tail ("send it after the call", "I'll sign after lunch")
 *  does NOT false-veto a genuine accept. */
const DEFERRED_SETTLE_NOUN_PATTERN =
  /\b(?:only\s+)?(?:after|once|upon|pending|following|subject\s+to)\s+(?:the\s+|your\s+|a\s+|their\s+)?(?:revisions?|re-?vise[sd]?|adjustments?|corrections?|amendments?|sign-?offs?|approvals?|confirmations?|bumps?|increases?|raises?|hikes?|revaluations?)\b/i;

/** Veto: a close idiom REDIRECTED to more negotiation — "where do I sign up for
 *  a better offer", "count me in for another round of talks", "lock it in for a
 *  higher number". The accept idiom matches, but "for a {better/another/more}
 *  {offer/round/talks/…}" reopens the negotiation rather than closing it.
 *  Scoped to a qualifier + negotiation noun so a benign "thanks for the offer"
 *  (no qualifier) is untouched. */
const NEGOTIATION_REDIRECT_PATTERN =
  /\bfor\s+(?:a\s+|an\s+|the\s+|some\s+)?(?:better|higher|bigger|revised|improved|stronger|another|more|further|second|next)\s+(?:offer|number|figure|package|comp(?:ensation)?|ctc|round|talks?|discussions?|negotiations?)\b/i;

/** Veto: explicit retraction / sarcasm tokens that void a preceding consent —
 *  "deal — just kidding", "yes, only kidding". No genuine accept contains a
 *  kidding/sarcasm token. */
const RETRACTION_PATTERN = /\b(?:just\s+|only\s+)?kidding\b|\bjk\b/i;

/** Veto: conditional RAISE demand welded to a close idiom — "make it 45 and we
 *  have a deal", "raise it to 50 and I'll sign", "bump it to 48 then we're
 *  done". The close idiom ("we have a deal", "I'll sign") matches, but it is
 *  CONTINGENT on the company first agreeing to the demanded figure — a counter,
 *  not an unconditional accept (FALSE-CLOSE: the bot finalizes at the current
 *  offer while the candidate is demanding a raise). Scoped to an unambiguous
 *  raise verb + number + and/then continuation; "make it official", "I'll do
 *  45 and sign" (no raise verb) are untouched. Offline sweep batch 3
 *  (2026-06-23).
 *
 *  PRI-66 (2026-06-26, broken-record sweep) — the raise target may NAME the
 *  cash component ("get the fixed to 58", "bump the base to 50", "push cash to
 *  60"), not just a bare "get it to N". Without an optional component noun
 *  between the verb and "to", the veto missed "Get fixed to 58 and we have a
 *  deal" — a live FALSE-CLOSE where the bot jumped to a formal close-recap and
 *  document collection while the candidate was demanding an above-band fixed
 *  raise (58 > maxStretch). The object slot now optionally absorbs
 *  it/fixed/base/cash (with or without a leading "the"). */
const CONDITIONAL_DEMAND_PATTERN =
  /\b(?:make\s+it|(?:get|bump|push|raise|take|bring|come\s+up)\s+(?:(?:it|the\s+fixed|the\s+base|the\s+cash|fixed|base|cash)\s+)?to)\s+\d+(?:\.\d+)?\s*(?:lpa|lakhs?|l|k|cr|crores?)?\b[^.!?]{0,25}\b(?:and|then|&)\b/i;

/** Veto: NON-numeric counter-demand welded to a close idiom — "beat their
 *  number and you've got a deal", "match it and we're done". Sibling to
 *  CONDITIONAL_DEMAND but the demand is a comparative beat/match of a competing
 *  figure rather than an explicit number. The close idiom is contingent on the
 *  company first improving, so it is a counter, not an accept (FALSE-CLOSE).
 *  Object scoped to money referents so "match the role and start" is untouched.
 *  Offline sweep batch 4 (2026-06-23). */
const COUNTER_THEN_CLOSE_PATTERN =
  /\b(?:beat|match|top|exceed|improve\s+(?:on|upon)|come\s+up\s+on)\s+(?:it|that|this|their\s+(?:offer|number|figure|comp\w*|package|ctc)|the\s+(?:offer|number|figure|comp\w*|package|ctc))\b[^.!?]{0,25}?\b(?:and|then|&)\b/i;

/** Veto: leading conditional governing a close idiom — "if you beat Google's
 *  offer I'm in", "if my manager approves then deal", "unless you fix the base,
 *  no deal". The close idiom ("I'm in"/"deal"/"I'll sign") is the CONSEQUENT of
 *  an unmet condition, so the candidate has not committed (FALSE-CLOSE). The
 *  medium gate already vetoes via HARD_CONDITIONAL; this shared veto closes the
 *  same gap in the STRICT gate, where the bare idiom would otherwise finalize.
 *  Consequent list is tight (explicit accept idioms only) so a benign "if the
 *  base is low this deal is weak" does not match. Offline sweep batch 4. */
const CONDITIONAL_ACCEPT_PATTERN =
  /\b(?:if|unless|provided|contingent\s+on|only\s+if|as\s+long\s+as)\b[^.!?\n]{0,40}?\b(?:i'?m\s+in\b|count\s+me\s+in\b|you'?ve\s+got\s+(?:a\s+|yourself\s+a\s+)?deal\b|we\s+(?:have|have\s+got|got)\s+a\s+deal\b|it'?s\s+a\s+deal\b|then\s+deal\b|i'?ll\s+(?:take\s+it|sign|join)\b)/i;

/** Veto: accept idiom trailed by a review/deliberation tail — "send the offer
 *  letter and I'll review it", "share the paperwork and I'll think it over".
 *  The "send the offer letter" close idiom matches, but "I'll review/think it
 *  over" means the candidate is deferring the decision to read it, not
 *  accepting. Verb list excludes commit verbs (take/sign/accept) so a genuine
 *  "yes send me the offer letter" still closes. Offline sweep batch 4. */
const REVIEW_TAIL_PATTERN =
  /\bi'?ll\s+(?:review|look\s+(?:it|that|them)?\s*over|think\s+(?:it|that|this)\s+over|go\s+over\s+(?:it|that|them)|read\s+(?:it|through|over)|consider\s+(?:it|that|this)|mull\s+(?:it|that)\s+over|run\s+(?:it|that)\s+by)\b/i;

/** Veto: commitment deferred to a personal consultation / future return —
 *  "I'll sign after I talk to my wife", "I'll accept once I see it in writing",
 *  "let me confirm tomorrow once I'm back". The performative verb fires but the
 *  commitment is gated on the candidate first consulting someone or reviewing
 *  later, so it is not a present accept. Scoped to consult/return verbs so
 *  "once you confirm the base I'll sign" (owned by CONDITIONAL_DEFERRAL) and
 *  genuine accepts are untouched. Offline sweep batch 4. */
const CONSULT_DEFERRAL_PATTERN =
  /\b(?:after|once|when|until)\s+(?:i'?m\s+back\b|i\s+am\s+back\b|(?:i|we)\s+(?:talk|speak|consult|discuss|chat|check\b|hear\b|sleep\b|see\b|return\b|run\s+it\s+by|get\s+back|am\s+back))/i;

/** All PRI-59/61/63 + batch-2 precision vetoes, shared by both gates. */
const FALSE_CLOSE_VETO_PATTERNS: RegExp[] = [
  TAKE_IT_HEDGE_PATTERN,
  IM_IN_HEDGE_PATTERN,
  ACCEPT_PROPOSITION_PATTERN,
  IN_PRINCIPLE_PATTERN,
  MONEY_REJECTION_PATTERN,
  SETTLE_NEGATION_PATTERN,
  DO_IT_REDIRECT_PATTERN,
  DEFERRED_SETTLE_NOUN_PATTERN,
  NEGOTIATION_REDIRECT_PATTERN,
  RETRACTION_PATTERN,
  CONDITIONAL_DEMAND_PATTERN,
  COUNTER_THEN_CLOSE_PATTERN,
  CONDITIONAL_ACCEPT_PATTERN,
  REVIEW_TAIL_PATTERN,
  CONSULT_DEFERRAL_PATTERN,
  ...RHETORICAL_ACCEPT_VETO_PATTERNS,
  ...PARTIAL_ACCEPT_VETO_PATTERNS,
];

/** Veto: hard conditional ("if/unless/provided"). Info-seeking
 *  conditionals are excepted ("if you could share the breakdown"). */
const HARD_CONDITIONAL_PATTERN =
  /\b(?:if|unless|provided|on condition|contingent|only\s+if|agar|jab\s+tak)\b/i;
const INFO_SEEKING_CONDITIONAL_PATTERN =
  /\b(?:if|unless|provided)\s+(?:you|it.?s|i)\s*(?:could|can|may|might|would|don.?t mind)?\s*(?:share|tell|let me know|elaborate|explain|clarify|confirm|provide|walk me through|give me|outline|show)\b/i;

/** Veto: "but/however … negotiation cue" within 60 chars. The
 *  cue list intentionally includes "more" — the most common
 *  re-open token. But "I would like to accept. But I'd like to
 *  know more about benefits" is info-seeking, not negotiation;
 *  the candidate has already accepted and is just asking for
 *  details. Excepted when an info-seeking verb (know/share/tell/
 *  explain/clarify/elaborate/walk through/understand/learn/
 *  hear) sits between the conjunction and the cue. */
const NEGOTIATING_BUT_PATTERN =
  /\b(?:but|however|lekin|magar)\b[^.!?\n]{0,60}?\b(?:more|higher|better|increase|raise|reduce|lower|stretch|bump|further|additional|negotiate|push|counter|extra|zyada|kam|aur)\b/i;
const INFO_SEEKING_BUT_PATTERN =
  /\b(?:but|however|lekin|magar)\b[^.!?\n]{0,60}?\b(?:know|share|tell|explain|clarify|elaborate|walk\s+(?:me\s+)?through|understand|learn|hear|see|ask|find\s+out)\b/i;

/** Veto: negation of acceptance ("not interested", "won't accept"). */
const NEGATION_PATTERN =
  /\b(no|not|don.?t|can.?t|won.?t|never)\s+(?:accept|interested|want|going|happy|comfortable|sure)\b/i;

/** Veto: weak-affirmative starters with no offer reference.
 *  "Okay, let's get started" type — Accenture session (2026-05-13). */
const WEAK_AFFIRMATIVE_ONLY_PATTERN =
  /^\s*(?:it'?s?\s+)?(?:ok(?:ay)?|alright|fine|sure|cool|good)[\s,.!]+(?:let'?s\s+(?:get\s+started|begin|start|kick\s+off|go|move\s+on)|let\s+us\s+(?:start|begin))[\s.!?]*$/i;

/** Split-clause acceptance phrases (Session 12 regression, 2026-05-14).
 *  Strong commit-to-join verbs that may appear as the first clause of
 *  an "accept + follow-up question" utterance. Kept separate from the
 *  performative bank so we can scope them to a per-sentence pass
 *  without changing whole-utterance classification semantics. */
const SPLIT_CLAUSE_ACCEPTANCE_PATTERNS: RegExp[] = [
  /\bi.?ll\s+join(?:\s+(?:the\s+)?(?:company|team|firm|role|offer))?\b/i,
  /\bi\s+accept\b/i,
  /\bi.?ll\s+accept\b/i,
  /\bi.?ll\s+take\s+(?:it|the\s+offer)\b/i,
  /\bsounds\s+good[,\s]+i.?ll\s+(?:join|take|sign|accept|go\s+with)\b/i,
  /\blet.?s\s+(?:do\s+it|go\s+ahead|lock\s+it\s+in)\b/i,
  /\bokay[,\s]+let.?s\s+go\s+ahead\b/i,
  /\bi.?m\s+in\b/i,
  /\baccepted\b/i,
  /\bi.?ll\s+go\s+with\s+(?:this|the\s+offer|that)\b/i,
  /\bworks\s+for\s+me[,\s]+i.?ll\s+sign\b/i,
  /\bit.?s\s+a\s+deal\b/i,
  /\bdone\s+deal\b/i,
  /\bdeal\b/i,
  /* Deal-close idioms as a split clause: "Yes, 40 works. Let's close it."
   * splits into "Yes, 40 works" + "Let's close it" — the second clause
   * must register as the commit. See COMMITMENT_IDIOM_PATTERNS rationale. */
  /\blet.?s\s+close\s+(?:it|this\s+out|the\s+deal|this\s+deal)\b/i,
  /\bclose\s+(?:the|this)\s+deal\b/i,
  /* Session B (2026-05-14) — bare-token commit phrases. Per-sentence
   * pass via splitSentences means "done. when's the start date?" splits
   * into "done." + "when's the start date?", and the first sentence
   * matches these. */
  /^\s*done\s*[.!?]?\s*$/i,
  /^\s*sold\s*[.!?]?\s*$/i,
  /^\s*let'?s\s+go\s*[.!?]?\s*$/i,
  /^\s*works\s+for\s+me\s*[.!?]?\s*$/i,
];

/** Question / info-ask cue at the clause level. */
const QUESTION_INTENT_PATTERN =
  /(?:\?\s*$)|^\s*(?:can\s+you|could\s+you|would\s+you|let\s+me\s+know|tell\s+me|what\s+about|give\s+me\s+details|share|explain|walk\s+me\s+through)\b/i;

/* ─── Helpers ──────────────────────────────────────────────────── */

function anyMatch(text: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(text));
}

/** Tokenize into clause-ish sentences by `.`, `!`, `?`, or `; `. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|;\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/** Per-sentence split-clause detection. Returns:
 *   - acceptance: at least one sentence carries strong accept phrasing
 *     AND has no negation;
 *   - question: at least one DIFFERENT sentence asks for info.
 *  Caller treats `acceptance && question` as accept-plus-followup. */
function detectSplitClause(text: string): {
  acceptance: boolean;
  question: boolean;
  acceptIdx: number;
} {
  const sentences = splitSentences(text);
  let acceptIdx = -1;
  let questionIdx = -1;
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    /* Negation in the same sentence vetoes acceptance for that
       sentence — "I won't join" must never trigger. "not yet" is
       caught here too. */
    if (NEGATION_PATTERN.test(s)) continue;
    if (/\b(?:won.?t|can.?t|don.?t|not|never|no)\s+(?:join|take|accept|sign|go|do|interested)\b/i.test(s)) continue;
    if (/\bnot\s+yet\b/i.test(s)) continue;
    if (acceptIdx === -1 && anyMatch(s, SPLIT_CLAUSE_ACCEPTANCE_PATTERNS)) {
      acceptIdx = i;
    }
  }
  for (let i = 0; i < sentences.length; i++) {
    if (i === acceptIdx) continue;
    if (QUESTION_INTENT_PATTERN.test(sentences[i])) {
      questionIdx = i;
      break;
    }
  }
  return {
    acceptance: acceptIdx !== -1,
    question: questionIdx !== -1,
    acceptIdx,
  };
}

/* ─── Classifier ──────────────────────────────────────────────── */

/**
 * Classify whether `text` constitutes acceptance.
 *
 * Decision tree:
 *   1. Vetoes (walk-away, hard-conditional, negotiating-but,
 *      negation, weak-affirmative-only) → not accepted.
 *   2. Strong performative verb → accepted (strong).
 *   3. Soft alignment (always names offer) → accepted (medium).
 *   4. Commitment idiom (incl. Hindi-mix) + offer reference →
 *      accepted (medium).
 *   5. Commitment idiom alone → accepted (medium) UNLESS context
 *      provides `offerOnTable === false`, in which case phase-gate
 *      veto: "you can't accept what hasn't been offered."
 *   6. Otherwise not accepted.
 *
 * `context.phase` is currently informational only — every gate that
 * benefits from phase is also covered by `offerOnTable`. Kept on the
 * interface so future rules can branch on phase without resignaturing.
 */
/** Audit Pass 2 Fix D (2026-05-16) — defense-in-depth curly-quote
 *  normalization. The kernel path already normalizes at
 *  applyCandidateAnswer entry, but `classifyAcceptance` is also called
 *  by the legacy whole-transcript facts extractor which does NOT route
 *  through the kernel. Inlined here (not imported from
 *  `_negotiation-kernel`) to avoid an import cycle — kernel already
 *  imports this classifier. Keep the two definitions byte-identical. */
function normalizeQuotesLocal(s: string): string {
  return s
    .replace(/[\u2018\u2019\u02BC\u02BB]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

export function classifyAcceptance(
  text: string,
  context: AcceptanceContext = {},
): AcceptanceResult {
  const reasons: string[] = [];
  const a = normalizeQuotesLocal(text || "").trim();
  if (!a) return { accepted: false, confidence: "none", reasons: ["empty"] };

  /* Step 1: vetoes. Each veto is structural — even if every other
     signal screams acceptance, these rule it out. */
  if (WALK_AWAY_PATTERN.test(a)) {
    return { accepted: false, confidence: "none", reasons: ["walk-away"] };
  }
  const hasAnyConditional = HARD_CONDITIONAL_PATTERN.test(a);
  const hasInfoSeeking = INFO_SEEKING_CONDITIONAL_PATTERN.test(a);
  if (hasAnyConditional && !hasInfoSeeking) {
    return { accepted: false, confidence: "none", reasons: ["hard-conditional"] };
  }
  if (CONDITIONAL_DEFERRAL_PATTERN.test(a)) {
    return { accepted: false, confidence: "none", reasons: ["conditional-deferral"] };
  }
  /* PRI-59 precision vetoes — a hostile NON-accept sharing a substring with a
     real accept idiom ("I'll take it elsewhere", "I'm in talks", "I accept
     that this is your final number", "I accept in principle"). */
  if (anyMatch(a, FALSE_CLOSE_VETO_PATTERNS)) {
    return { accepted: false, confidence: "none", reasons: ["false-close-veto"] };
  }
  if (NEGOTIATING_BUT_PATTERN.test(a) && !INFO_SEEKING_BUT_PATTERN.test(a)) {
    return { accepted: false, confidence: "none", reasons: ["negotiating-but"] };
  }
  if (NEGATION_PATTERN.test(a)) {
    return { accepted: false, confidence: "none", reasons: ["negation"] };
  }
  if (WEAK_AFFIRMATIVE_ONLY_PATTERN.test(a) && !OFFER_REFERENCE_PATTERN.test(a)) {
    return { accepted: false, confidence: "none", reasons: ["weak-affirmative-only"] };
  }

  /* Step 2: performative verb. Unambiguous speech act. */
  if (anyMatch(a, STRONG_PERFORMATIVE_PATTERNS)) {
    reasons.push("performative-verb");
    const split = detectSplitClause(a);
    return {
      accepted: true,
      confidence: "strong",
      reasons,
      hasFollowUpQuestion: split.acceptance && split.question,
    };
  }

  /* Step 2.5: split-clause acceptance with follow-up question.
     "I accept. What about variable components?" — the trailing
     interrogative would otherwise mask the commit clause from some
     downstream consumers; flag `hasFollowUpQuestion` so the
     orchestrator both transitions to `accepted` AND discloses the
     requested info in the same response. Only fires when BOTH
     halves are present (pure acceptance and pure question are
     handled by steps 2 / 3 / 4 / 5 / no-match respectively).

     Phase gate is preserved: if `offerOnTable === false` and the
     matched accept phrase is a soft commitment idiom (e.g. "let's
     do it") without a strong commit verb, we defer to step 4/5's
     existing gate logic by skipping the early return here. */
  {
    const split = detectSplitClause(a);
    if (split.acceptance && split.question) {
      const acceptedSentence = splitSentences(a)[split.acceptIdx] || "";
      const isStrongClause =
        anyMatch(acceptedSentence, STRONG_PERFORMATIVE_PATTERNS) ||
        /\bi.?ll\s+join\b/i.test(acceptedSentence) ||
        /\baccepted\b/i.test(acceptedSentence) ||
        /\bi\s+accept\b/i.test(acceptedSentence);
      const gateBlocks =
        context.offerOnTable === false &&
        !isStrongClause &&
        !OFFER_REFERENCE_PATTERN.test(a);
      if (!gateBlocks) {
        reasons.push("split-clause-acceptance", "follow-up-question");
        return {
          accepted: true,
          confidence: isStrongClause ? "strong" : "medium",
          reasons,
          hasFollowUpQuestion: true,
        };
      }
    }
  }

  /* Step 3: soft alignment. Each pattern names the offer itself,
     so the offer-reference check is implicit. */
  if (anyMatch(a, SOFT_ALIGNMENT_PATTERNS)) {
    reasons.push("soft-alignment");
    return { accepted: true, confidence: "medium", reasons };
  }

  /* Step 4 + 5: commitment idiom, with optional offer-reference upgrade
     and phase-gate veto. */
  const hasIdiom = anyMatch(a, COMMITMENT_IDIOM_PATTERNS) || anyMatch(a, HINDI_MIX_PATTERNS);
  if (hasIdiom) {
    const hasOfferRef = OFFER_REFERENCE_PATTERN.test(a);
    if (hasOfferRef) {
      reasons.push("commitment-idiom", "offer-reference");
      return { accepted: true, confidence: "medium", reasons };
    }
    /* Phase gate: caller told us no offer is on the table.
       "Sounds good" before any number has been quoted is filler. */
    if (context.offerOnTable === false) {
      reasons.push("commitment-idiom", "phase-gate-no-offer-veto");
      return { accepted: false, confidence: "none", reasons };
    }
    reasons.push("commitment-idiom");
    return { accepted: true, confidence: "medium", reasons };
  }

  return { accepted: false, confidence: "none", reasons: ["no-match"] };
}

/* ─── Bug 2 (2026-05-14) — STRICT explicit-acceptance gate ────────
 *
 * The user-test session surfaced a premature offer-letter close: the
 * candidate said "I'd be comfortable moving forward if you can do X"
 * and the bot transitioned into offer-letter / acceptance drafting.
 * That's a hedged conditional, not acceptance.
 *
 * `classifyAcceptance` above accepts "medium" confidence on idioms +
 * offer-reference, which is the right semantics for KERNEL phase
 * transitions (where the structural phase gate adds another layer).
 * But the offer-letter / closing UI path needs a STRICTER detector:
 * unambiguous performative-verb acceptance ONLY. This function is the
 * dedicated whitelist.
 *
 * Hedged signals that MUST NOT accept:
 *   - "sounds good", "thank you for clarifying", "I appreciate"
 *   - "I'd be comfortable moving forward IF / WHEN / SO LONG AS"
 *   - "let me think about it", "I'll get back to you"
 *   - any conditional with "if" / "as long as" / "provided that"
 */
const STRICT_ACCEPTANCE_PATTERNS: RegExp[] = [
  /\bi\s+accept(?:\s+(?:this|the|your)\s+offer|\s+it)?\b/i,
  /\bi\s+am\s+accepting\b/i,
  /\bi'?m\s+accepting\b/i,
  /\bi\s+(?:do\s+)?accept(?:\s+(?:this|the|your)\s+offer|\s+it)?\b/i,
  /\byes,?\s+i'?m\s+accepting\b/i,
  /\byes,?\s+i\s+accept\b/i,
  /\bplease\s+send\s+(?:me\s+)?the\s+offer\s+letter\b/i,
  /\bsend\s+(?:me\s+)?the\s+offer\s+letter\b/i,
  /\bi'?m\s+in\b/i,
  /\blet'?s\s+move\s+forward\s+with\s+this\s+number\b/i,
  /\blet'?s\s+move\s+forward\s+with\s+(?:this|the)\s+offer\b/i,
  /\bi'?ll\s+take\s+(?:it|the\s+offer)\b/i,
  /\bi'?m\s+signing\s+(?:today|now|tonight)\b/i,
  /* Explicit deal-close commitment idioms (live-staging 2026-06-19):
   * "Yes, let's close it." / "I said yes, let's close." were only
   * reaching the medium-confidence commitment-idiom path, so the
   * soft-accept trailing-non-counter gate blocked the close and the bot
   * kept negotiating over an explicit acceptance. These are unambiguous
   * consent — the candidate is asking to close the DEAL — so promote
   * them to strict, identical to "let's move forward with this offer".
   * The object is restricted to deal-nouns (NOT "close the gap" — a
   * negotiation move) and the conversational sense ("close this
   * interview/call") is excluded via lookahead (that routes to
   * end-interview in _terminal-intent). */
  /\blet'?s\s+(?:close|finali[sz]e)\s+(?:it|this|the\s+(?:deal|offer|number|fitment))\b(?!\s+(?:call|interview|conversation|session|chat|negotiation))/i,
  /\blet'?s\s+(?:close|finali[sz]e)\s*(?:[.,!?]|$)/i,
  /\b(?:close\s+it\s+out|lock\s+it\s+in)\b/i,
  /* #124 (2026-06-21, live-staging audit S13) — forward-commitment close
   * idioms. "Sounds good, let's go ahead" / "let's proceed" / "let's do it" /
   * "go ahead and close/send/finalise" are unambiguous same-turn consent over
   * a standing offer — structurally identical to the existing "let's move
   * forward with this offer". Without strict status they fell to
   * medium-confidence soft-accept, and PDF#48's one-AI-turn-wait gate
   * suppressed the close on the candidate's FIRST reaction to the anchor
   * (firstOfferAtTurn === turnIndex), so the bot re-probed expectations
   * instead of closing. detectExplicitAcceptance is consulted ONLY post-offer
   * (the strictBoost call is gated on highestOfferMade>0; the other call site
   * sits inside the signalsAcceptance branch), so these cannot fire pre-offer.
   * HEDGE_VETO_PATTERNS still runs first, so "let's go ahead if you can do X"
   * stays conditional and is NOT promoted. */
  /\blet'?s\s+(?:go\s+ahead|proceed|do\s+it)\b/i,
  /* PRI-63 (2026-06-22, offline hostile sweep) — the close/lock arm must
   * exclude a NEGOTIATION object the same way the "let's close" pattern above
   * (#124) does. "go ahead and close the GAP / DIFFERENCE / SPREAD" is a push to
   * shrink the spread, NOT consent to finalize — matching it here finalized a
   * deal the candidate was still haggling (FALSE-CLOSE, the worst failure mode).
   * The negative lookahead is scoped to the spread-nouns only, so "go ahead and
   * close" (clause-end) / "go ahead and send/finalise/draft" are untouched. */
  /\bgo\s+ahead\s+and\s+(?:close|send|finali[sz]e|draft|process|lock|roll)\b(?!\s+(?:the\s+|this\s+|that\s+)?(?:gap|difference|spread|distance|divide|delta)\b)/i,
  /* PRI-56 (2026-06-22) — terse spoken close-consent idioms ("ok, deal",
   * "deal, 40 works", "whatever you said works", "yes send it", "send it
   * over", "yes confirmed"). Shared single source with COMMITMENT_IDIOM_PATTERNS
   * so classification (medium) and the strict close gate stay in lockstep.
   * Routed strict because, like the #124 forward-commitment idioms above, they
   * are unambiguous same-turn consent over a standing offer; medium-only status
   * left them in the soft-accept path, whose trailing-non-counter gate dropped
   * the close. HEDGE_VETO_PATTERNS runs first; both kernel call sites are
   * post-offer-only, so no pre-offer false close. */
  ...CLOSE_CONSENT_IDIOM_PATTERNS,
];

/** Hedged-language vetoes — when ANY of these fire, accepted=false
 *  regardless of any pattern above. */
const HEDGE_VETO_PATTERNS: RegExp[] = [
  /\bif\s+you\s+can\b/i,
  /\bif\s+we\s+can\b/i,
  /\bif\s+the\b/i,
  /\bonly\s+if\b/i,
  /* PRI-63 (2026-06-25, real prod salary-negotiation audit, session f22e215b
   * — Flipkart EM). Conditional acceptance gated on an UNMET sweetener GRANT:
   * "Okay, if you throw in a joining bonus I can make it work", "if you add a
   * signing bonus, I'm in". The medium gate (classifyAcceptance) already
   * vetoes this via the broad HARD_CONDITIONAL "if"; the strict gate's narrow
   * conditional list above ("if you can" / "only if") let the bare grant-verb
   * form through. detectExplicitAcceptance therefore returned accepted=true,
   * and the kernel's escalation-boost (_negotiation-kernel.ts ~5955:
   * `!parsed.signalsAcceptance` → detectExplicitAcceptance → markAccepted)
   * locked terminal `accepted` at the standing offer with NO joining bonus —
   * SILENTLY DROPPING the candidate's stated condition. The recap then
   * enumerated a deal the candidate never agreed to: a soft FALSE-CLOSE, the
   * worst failure mode. Veto the grant-conditional in the strict gate too so
   * both detectors agree; the turn routes to the joining-bonus lever instead,
   * and the eventual close carries the bonus (see _next-action-planner.ts
   * conditional-close gate, same PRI-63). Scoped to grant verbs so a benign
   * info-conditional ("if you need anything from me, let me know") is
   * untouched. */
  /\b(?:if|when|once|provided|as\s+long\s+as)\s+(?:you|we|they)\s+(?:can\s+|could\s+|would\s+|will\s+)?(?:throw\s+in|add|include|cover|sweeten|bump|match|chip\s+in|give\s+me|toss\s+in)\b/i,
  /* PRI-63b (2026-06-25, pre-launch audit CRIT-2) — POST-POSITIVE imperative
   * requirement on an unmet sweetener. The PRI-63 pattern above catches the
   * fronted "if you throw in …" form; this catches the trailing demand form a
   * candidate appends to an otherwise-positive close idiom:
   *   "Yes, send the offer letter — just make sure the joining bonus is in there."
   *   "Sure, send it across, but I'll need that joining bonus included."
   * These read as a bare accept to the strict gate (the close idiom matches
   * STRICT_ACCEPTANCE_PATTERNS) yet carry an OUTSTANDING condition the bot has
   * not granted — force-closing flat silently drops it (soft FALSE-CLOSE, the
   * worst failure mode). Veto so the turn routes to the joining-bonus lever /
   * conditional-close gate, which grants + names the bonus at close (PRI-63).
   * Scoped to a requirement VERB (make sure / ensure / I('ll) need / I want /
   * need to see) within the same clause as a genuine SWEETENER noun (joining /
   * signing / sign-on / retention bonus, equity / ESOP / RSU, relocation) — NOT
   * bare "bonus", so confirming a GRANTED variable/perf bonus is untouched. */
  /\b(?:make\s+sure|ensure|i'?ll\s+need|i\s+need|i'?d\s+need|i\s+want|i'?ll\s+want|need\s+to\s+see)\b[^.?!]{0,40}?\b(?:joining\s+bonus|signing\s+bonus|sign[-\s]?on\s+bonus|retention\s+bonus|esops?|rsus?|equity|relocation)\b/i,
  /\bas\s+long\s+as\b/i,
  /\bprovided\s+that\b/i,
  /\bsubject\s+to\b/i,
  /\bcomfortable\s+moving\s+forward\s+if\b/i,
  /\bcomfortable\s+moving\s+forward\s+so\s+long\s+as\b/i,
  /\blet\s+me\s+think\b/i,
  /\bi'?ll\s+get\s+back\b/i,
  /\bi\s+(?:will|need to|have to)\s+(?:think|consider|sleep on)\b/i,
  /\bi\s+appreciate\b/i,
  /\bthank\s+you\s+for\s+clarifying\b/i,
  /* PDF#45 BUG-6 (2026-05-25) — Flipkart Sr-PD session phantom-accepted
   * mid-breakdown-question. Strict acceptance gate (used by closing UI)
   * must veto when the candidate is asking for the structure/breakdown
   * in the same utterance — that's a probe, not a commitment. */
  /\b(?:walk\s+me\s+through|break\s*down|breakdown|the\s+structure|the\s+split|how\s+does\s+(?:it|that)\s+(?:work|break)|what(?:'s|\s+is)\s+the\s+(?:split|structure|breakdown|fixed|variable))\b/i,
  /\bcan\s+you\s+(?:share|tell|show|explain|clarify|elaborate)\b/i,
  /\bcould\s+you\s+(?:share|tell|show|explain|clarify|elaborate)\b/i,
  /* PRI-58 (2026-06-22) — deferred-condition framing. Shared single source with
   * the medium gate so a close-consent idiom gated on a future settlement
   * ("where do I sign once we sort the base", "make it official after you bump
   * the base") is rejected by BOTH detectors in lockstep, not just one. */
  CONDITIONAL_DEFERRAL_PATTERN,
  /* PRI-59 (2026-06-22) — FALSE-CLOSE precision vetoes, shared single source
   * with the medium gate (classifyAcceptance step 1). A strict close idiom
   * hijacked by a hedge/deferral substring ("where do I sign assuming you fix
   * the variable", "I accept in principle") must be rejected by BOTH gates. */
  ...FALSE_CLOSE_VETO_PATTERNS,
];

export interface ExplicitAcceptanceResult {
  accepted: boolean;
  confidence: number;
}

/** Strict acceptance gate used for offer-letter / closing UI. Only
 *  returns accepted=true on unambiguous performative-verb acceptance
 *  WITHOUT any hedge. Returns confidence ∈ [0, 1]. */
export function detectExplicitAcceptance(text: string | null | undefined): ExplicitAcceptanceResult {
  if (!text || typeof text !== "string") return { accepted: false, confidence: 0 };
  const t = text.trim();
  if (!t) return { accepted: false, confidence: 0 };
  /* Veto on hedge. */
  for (const p of HEDGE_VETO_PATTERNS) {
    if (p.test(t)) return { accepted: false, confidence: 0 };
  }
  for (const p of STRICT_ACCEPTANCE_PATTERNS) {
    if (p.test(t)) return { accepted: true, confidence: 0.95 };
  }
  return { accepted: false, confidence: 0 };
}
