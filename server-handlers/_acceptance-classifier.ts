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

import { analyzeDemand } from "./_utterance-intent";
import { isWalkAway } from "./_walkaway-detection";

export interface AcceptanceContext {
  /** Current kernel phase, if known. Pass undefined from legacy
   *  whole-transcript callers — the phase gate is skipped. */
  phase?: string;
  /** Whether the bot has quoted a salary number yet (i.e. an offer
   *  exists to accept). Pass undefined when unknown — phase gate
   *  is skipped. The kernel passes `state.highestOfferMade > 0`. */
  offerOnTable?: boolean;
  /** The numeric standing offer (LPA), when known. Enables the
   *  accept-at-or-below-offer rule (§11): an accept frame naming a
   *  number no higher than this is an acceptance, not a counter. Pass
   *  undefined when unknown — the rule is skipped. The kernel passes
   *  `state.highestOfferMade`. */
  offerLpa?: number;
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

/** §11 (2026-07-08, offline hostile battery) — an accept/settle frame
 *  immediately followed by a bare cash number: "I'll take 40", "happy with 38",
 *  "I'll do 40 lpa", "fine at 40", "let's close at 40". The captured number is
 *  gated by the CALLER against the standing offer (classifyAcceptance step 2.4):
 *  a number at or below the offer is an acceptance/concession; a number above it
 *  is a genuine counter and is left to fall through.
 *
 *  Deliberately NARROW to avoid false accepts: the verb must be a commit/settle
 *  verb, the number must sit right after it, and a trailing time/count/percent
 *  noun is excluded by lookahead so "I'll take 40 minutes", "I'll do 3 rounds",
 *  "I'll take 5%" never match. The verb "take it/the offer" (no number) is
 *  unchanged — it stays with the performative bank. */
const ACCEPT_FRAME_NUMBER_PATTERN =
  /\b(?:i(?:'?ll|\s+will|\s+would|\s+can|\s+could)?\s+(?:take|do|go\s+with|accept|settle\s+for)|happy\s+(?:with|at)|fine\s+(?:with|at)|good\s+(?:with|at)|ok(?:ay)?\s+(?:with|at)|settle\s+(?:for|at)|let'?s\s+(?:do|close\s+at|go\s+with|settle\s+at))\s+(?:₹|rs\.?\s*|inr\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|lac|l|k)?(?!\s*(?:%|percent|per\s?cent|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?|yrs?|people|folks?|things?|reasons?|questions?|calls?|rounds?|candidates?|offers?))\b/i;

/** Performative acceptance verbs — these alone are strong enough
 *  to count as acceptance regardless of whether an offer reference
 *  is present. The verb itself names the speech act. */
/** Willingness-to-commit performative — "happy/glad/delighted/pleased/thrilled/
 *  keen to accept/sign/join". Generalizes the original narrow "happy to accept"
 *  so "I'd be glad to sign", "delighted to accept", "keen to join" also close
 *  (round-3 hostile probe surfaced "I'd be glad to sign" as a NO-CLOSE). Lives
 *  in the MEDIUM gate (STRONG_PERFORMATIVE_PATTERNS) only — deliberately NOT in
 *  the strict gate, exactly like the "happy to accept" idiom it generalizes: a
 *  willingness idiom is soft consent that drives signalsAcceptance and the
 *  planner's soft close, but is intentionally kept out of the strict
 *  offer-letter/formal-recap gate (promoting it there flips the planner from
 *  `close` to `close-recap-formal`). The conditional/deferral vetoes run BEFORE
 *  this in the medium gate, so "glad to sign if you bump base" is still
 *  excluded. */
const WILLING_TO_COMMIT_PATTERN =
  /\b(?:happy|glad|delighted|pleased|thrilled|keen)\s+to\s+(?:accept|sign|join)\b/i;

/* Clause-start boundary — SINGLE SOURCE OF TRUTH (PRI-82, 2026-07-10, surfaced
 * by the adversarial differential audit as an OVERREACH: a real accept silently
 * dropped, same missed-close class as I-5). Every clause-anchored accept/close
 * pattern below builds its leading boundary from this instead of inlining a
 * `[,.!?]` char class. A closer can begin the utterance (^) or follow a clause
 * separator. Besides . ! ? and comma, speech-to-text transcripts routinely
 * separate clauses with an em/en dash ("This is great — deal!"), a spaced
 * hyphen ("Perfect - I'll take it") or a colon ("my answer: deal") — none of
 * which the old char class recognized, so a closer after a dash clause fell
 * through to no-match. A bare hyphen must be spaced on BOTH sides so intra-word
 * hyphens ("deal-breaker", "sign-on") never count as a boundary. Composed via
 * `.source` so each consumer stays a readable literal with no hand-escaping. */
const CLAUSE_START = /(?:^|[,.!?:]\s*|\s*[—–]\s*|\s+-\s+)/.source;

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
  new RegExp(CLAUSE_START + /(?:would|want)\s+to\s+accept\b/.source, "i"),
  new RegExp(CLAUSE_START + /(?:would\s+)?like\s+to\s+accept\b/.source, "i"),
  /\bi\s*(?:'ve|have)\s+(?:already\s+)?accepted\b/i,
  /\bi(?:\s+have)?\s+already\s+accepted\b/i,
  /\baccept(?:ing|ed)\s+(?:this|the|your)\s+offer\b/i,
  /\bi\s+(?:fully\s+|totally\s+|completely\s+)?agree\b/i,
  /\b(?:fully|totally|completely)\s+agree\b/i,
  /\bi.?ll\s+take\s+(?:it|the\s+offer)\b/i,
  WILLING_TO_COMMIT_PATTERN,
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
   * negation / conditional / negotiating-but vetoes still run first.
   *
   * Round-8 hostile probe (2026-07-10) — a bare verb TERMINATED BY "?" is an
   * interrogative echo of the recruiter's ask ("Accept? Ha.", "Accept? Ask me
   * again at 55.", the recruiter's own "will you accept?"), never the
   * candidate's own commitment. A genuine terse close ends with .!, or nothing,
   * never "?". Drop "?" from the trailing clause-terminator (the LEADING
   * boundary keeps it — a prior sentence may end in "?"). */
  new RegExp(
    CLAUSE_START +
      /(?:(?:yes|yeah|yep|yup|ok|okay|sure|alright|fine)[,\s]+)?accept(?:ed|ing|s)?\b(?:\s+(?:it|this|the\s+offer))?\s*(?:[.!,]|$)/
        .source,
    "i",
  ),
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
  new RegExp(
    CLAUSE_START +
      /(?:ok(?:ay)?|alright|yes|yeah|yep|fine|sure)?[,\s]*deal\b(?!\s*[-\s]?breaker)(?!'?s?\s+(?:off|dead|over\b|done\s+for|cancell?ed|gone))(?!\s+(?:is|was)\s+(?:off|dead|over|done|cancell?ed|gone))/
        .source,
    "i",
  ),
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
  /* PRI-74 (2026-07-10) — verb widened to send|ship: "ship the offer letter"
   * / "ship it over" is the same finalize-the-paperwork consent as "send". */
  /\b(?:send|ship)\s+(?:me\s+|it\s+|them\s+)?(?:(?:over|across)\s+)?(?:the\s+)?(?:offer\s+)?(?:letter|paperwork|paper\s*work|docs?|contract)\b/i,
  /* 4. "confirmed" / "yes confirmed" / "confirming" — a bare confirmation
   *    token closing the deal. Anchored to a clause boundary AND required to
   *    END the clause so the info-probe "can you confirm the split" (confirm
   *    + object) does NOT match. */
  new RegExp(
    CLAUSE_START +
      /(?:yes,?\s+|ok(?:ay)?,?\s+)?confirm(?:ed|ing)?\s*(?:[.!?,]|$)/.source,
    "i",
  ),
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
  /* 8b. "you've got yourself a new hire" — the hiring-idiom sibling of arm 8.
   *     Naming the speaker as the company's new hire IS accepting the job
   *     (surfaced as an OVERREACH miss by the 2026-07-10 adversarial probe).
   *     Same subject scaffold as arm 8 — "you"/"we" must directly abut
   *     "got"/"have", so a negated future ("you won't have a new hire", where
   *     "won't" sits between) can never match. */
  /\b(?:you'?ve|you|we'?ve|we)\s+(?:got|have)\s+(?:yourself\s+|yourselves\s+|ourselves\s+)?(?:a\s+)?new\s+hire\b/i,
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
  new RegExp(CLAUSE_START + /agreed\s*(?:[.!?,]|$)/.source, "i"),
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
  /* Batch-2 recall (2026-07-08) — "works for me" beyond the whole-utterance
   * anchor below. "fine, works for me." carries a leading "fine," so the
   * `^…$` bare-token arm failed and the accept was lost (NO-CLOSE). The
   * offer-on-table phase gate still vetoes pre-offer filler; NEGATION owns
   * "doesn't work for me" (no trailing "s"), NEGOTIATING_BUT owns
   * "works for me but I want more". */
  /\bworks\s+for\s+me\b/i,
  /* Batch-2 gate-drift fix (2026-07-08) — "let's move forward with this/the
   * offer/number" was STRICT-gate-only (STRICT_ACCEPTANCE_PATTERNS), so the
   * medium classifier returned signalsAcceptance=false on "done, let's move
   * forward with this offer" — exactly the two-detector drift this module
   * exists to prevent. Mirror it into the commitment bank; offer-reference is
   * implicit, HEDGE/CONDITIONAL vetoes still run first. */
  /\blet'?s\s+move\s+forward\s+with\s+(?:this|the)\s+(?:offer|number|package|deal|fitment)\b/i,
  /\bit.?s\s+a\s+deal\b/i,
  /\bdone\s+deal\b/i,
  /\blet.?s\s+(?:go\s+ahead|do\s+(?:it|this)|lock\s+it\s+in|proceed)\b/i,
  /* Deal-close idioms (live-staging 2026-06-19). "let's close it" /
   * "let's close the deal" / "close the deal" / "let's close this out" are
   * unambiguous finalize-the-deal commits in a negotiation — the candidate
   * is accepting, not asking to end the call (which terminal-intent owns,
   * and which requires an explicit conversational noun). Gated as a
   * commitment idiom so the offer-on-table phase gate still applies: you
   * cannot "close the deal" before one exists. */
  /\blet.?s\s+close\s+(?:it|this\s+out|the\s+deal|this\s+deal)\b/i,
  /\bclose\s+(?:the|this)\s+deal\b/i,
  /* Anaphoric close-at (#133, 2026-07-07, offline hostile sweep). "let's close
   * at that / at this / at it" points the settle-verb at the STANDING offer by
   * anaphora — an unambiguous accept ("Okay, done. Let's close at that."). The
   * bare-token "done" below needs the WHOLE utterance, so a "done." welded to a
   * trailing close-out clause dropped to no-match and the yes was lost (the bot
   * pivoted to an ESOP ask instead of closing). Pronoun-anchored ONLY: "let's
   * close at <number>" names a NEW figure and is a COUNTER (owned by
   * _number-role-classifier's "let's close at 35" / "come up to 36"), so the
   * numeric form is deliberately excluded here. Still a commitment idiom, so the
   * offer-on-table phase gate and the NEGATION/HEDGE/CONDITIONAL vetoes all
   * still apply ("I won't close at that" stays vetoed). */
  /\blet.?s\s+close\s+at\s+(?:that|this|it)\b/i,
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

/* Veto: walk-away or rejection — owned by the canonical single source
 * of truth `_walkaway-detection.ts` (isWalkAway), imported above. This
 * module previously carried a PRIVATE, divergent WALK_AWAY_PATTERN copy
 * that never picked up the canonical module's negation guard
 * (stripNegatedDepartures) or its richer decline/move-on forms — a
 * "single source of truth" claim the code did not actually honor.
 * classifyAcceptance now vetoes via isWalkAway(a) directly. */

/** Veto: deferred-condition framing — "once we sort the base", "after you
 *  confirm the split". A close-consent idiom ("where do I sign", "count me
 *  in") gated on a future event is NOT a same-turn commitment. Scoped to a
 *  follow-on settlement/adjust verb so the temporal "once" ("I worked there
 *  once") and benign "after the call" don't false-veto. Shared by BOTH the
 *  medium gate (classifyAcceptance, via HARD_CONDITIONAL) and the strict gate
 *  (detectExplicitAcceptance, via HEDGE_VETO_PATTERNS) so the two stay in
 *  lockstep — offline hostile sweep (2026-06-22). */
/* Offline hostile close battery (2026-07-08) — the subject slot was scoped to
 * first/second-person + it/that/the/my, so a deferral gated on an ORG ACTOR
 * ("I'll sign once PAYROLL confirms the base", "count me in when FINANCE signs
 * off") slipped the veto and FALSE-CLOSED at the un-adjusted offer. Widened to
 * the settlement-relevant org actors (payroll/hr/finance/legal/management/the
 * team/the company/approvals); the trailing settlement VERB is still required,
 * so a benign temporal "once payroll ran the numbers last year" (no
 * sort/confirm/finalize/… verb) is untouched. */
const CONDITIONAL_DEFERRAL_PATTERN =
  /\b(?:once|after|when|as\s+soon\s+as|assuming|provided(?:\s+that)?|so\s+long\s+as|the\s+(?:day|moment|minute|second))\s+(?:we|you|i|they|it'?s|that'?s|the|my|payroll|hr|finance|legal|management|approvals?|the\s+team|the\s+company)\b[^.!?]{0,25}?\b(?:sort(?:ed|s)?|confirm(?:ed|s)?|finali[sz]e[sd]?|adjust(?:ed|s)?|revis(?:e[sd]?|it(?:s|ed)?)|fix(?:ed|es)?|agree[sd]?|settle[sd]?|match(?:ed|es)?|increase[sd]?|bump(?:ed|s)?|raise[sd]?|hits?|reach(?:es|ed)?|sen[dt]s?|updat(?:e[sd]?|ing)|sign(?:ed|s)?|signs?\s+off|approv(?:e[sd]?|es)|in\s+writing|on\s+paper|in\s+the\s+(?:offer|contract|letter|paperwork))\b/i;

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
/* PRI-79 (2026-07-10, round-11) — "take it UP WITH <someone>" is the phrasal
 * verb "take (a matter) up with", NOT "take it" = accept: "I'll take it up with
 * your competitor", "I'll take it up with my lawyer". The bare "take it" idiom
 * matched and FALSE-CLOSED an outright deflection. "up with" is never a genuine
 * accept tail, so folding it into this hedge list is safe. */
const TAKE_IT_HEDGE_PATTERN =
  /\btake\s+(?:it|the\s+offer)\s+(?:elsewhere|somewhere|under\s+(?:advisement|consideration|review)|or\s+leave\s+it|back\b|away\b|from\s+here\b|on\s+board\b|as\s+a\s+maybe\b|slow\b|up\s+with\b|to\s+(?:my|the|another|a\s)|with\s+me\b|home\b)/i;

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
  /\bi\s*(?:'m|am|'d|'ve|have|'ll|will|had|was)?\s*(?:been\s+|be\s+)?accept(?:s|ing|ed)?\s+(?:that\b|the\s+(?:reality|fact|situation|premise|truth|position|challenge|terms\s+are)|your\s+(?:position|point|stance|reasoning|logic|view|argument|concern|apology|apologies))/i;

/** Veto (PRI-74, 2026-07-10, offline hostile close battery — round-6) — an
 *  accept verb whose OBJECT is explicitly contrasted AWAY from the offer: "I'd
 *  accept a coffee, not this offer", "I accept the challenge, not the number".
 *  ACCEPT_PROPOSITION excludes a fixed noun list (reality/fact/position/…), but
 *  the object here is an arbitrary noun ("a coffee") disambiguated only by the
 *  trailing "not (this/the/your/that) offer/number/comp" — a refusal, not a
 *  commit. The contrast tail is the single disambiguator, so a genuine "I
 *  accept the offer" (no "not … offer" tail) is untouched; "not letting this
 *  offer go" has a verb between "not" and "offer" and does not match. */
const ACCEPT_NOT_THE_OFFER_PATTERN =
  /\baccept(?:s|ing|ed)?\b[^.!?]{0,30}?\bnot\s+(?:this|the|your|that)\s+(?:offer|number|comp(?:ensation)?|package|deal|base|money)\b/i;

/** Veto (PRI-78, 2026-07-10, round-10) — an accept verb whose OBJECT is a
 *  concrete NON-offer noun: "I'm happy to accept a counteroffer, not this", "I
 *  accept your invitation to keep talking". ACCEPT_PROPOSITION owns the
 *  subject-led "I accept the reality/your position" form but requires the verb
 *  to abut the subject ("happy to accept" detaches it), and its object list is
 *  abstractions (reality/fact/position), not a counteroffer/invitation. Verb-
 *  fronted here (no subject needed) and scoped to objects that are definitionally
 *  NOT the on-table offer — accepting a COUNTEROFFER or an INVITATION/apology/
 *  challenge/defeat is a deflection, never a close. "offer/deal/role/position/
 *  job" are deliberately excluded so a genuine "accept the offer" is untouched. */
const WRONG_OBJECT_ACCEPT_PATTERN =
  /\baccept(?:s|ing|ed)?\s+(?:a|an|your|the|another|this|that)\s+(?:counter[\s-]?(?:offer|proposal)|invitation|invite|apology|apologies|challenge|defeat)\b/i;

/** Veto (PRI-83, 2026-07-10, adversarial probe) — an accept verb whose OBJECT
 *  is a COMPARATIVE-qualified offer: "I'll accept a better offer, not this
 *  one", "I'd accept a higher number". WRONG_OBJECT_ACCEPT_PATTERN deliberately
 *  excludes bare "offer/number/package" so a genuine "accept the offer" closes,
 *  and NEGOTIATION_REDIRECT_PATTERN only owns the PP form ("sign up FOR a better
 *  offer") — the direct-object form ("accept A BETTER offer") slipped both and
 *  FALSE-CLOSED on an outright refusal (accepting a hypothetical SUPERIOR offer
 *  is, by definition, declining the one on the table). The comparative adjective
 *  is the single disambiguator: a genuine close never qualifies its object as
 *  better/higher/different, so "accept the offer" / "accept your offer" is
 *  untouched. A bare "another/other <offer-noun>" ("I accept ANOTHER offer, not
 *  yours") carries the same wrong-object sense without a comparative adjective —
 *  accepting a DIFFERENT offer is declining this one — so it's a second arm.
 *  Shared by both gates via FALSE_CLOSE_VETO_PATTERNS. */
const COMPARATIVE_OFFER_ACCEPT_PATTERN =
  /\baccept(?:s|ing|ed)?\s+(?:(?:a|an|the|any|some|another)\s+(?:better|higher|bigger|stronger|improved|revised|different|superior|sweeter|richer|competing|rival)|another|(?:some\s+|any\s+)?other)\s+(?:offer|number|figure|package|comp(?:ensation)?|ctc|deal|proposal)\b/i;

/** Veto: "in principle" / "pending …" — explicit incomplete-commitment markers.
 *  "I accept in principle" / "yes, pending board approval" are hedges, not a
 *  terminal close. */
const IN_PRINCIPLE_PATTERN = /\b(?:in\s+principle|pending\b)/i;

/** Veto: DOUBT / POSSIBILITY governor over an embedded commit idiom (2026-07-09
 *  offline hostile sweep). The performative/idiom banks match the bare "I'll
 *  take it" / "I'm in" / "accept" substring, but a leading non-committal
 *  qualifier ("I don't think I'll take it", "I doubt I'll take it", "I'm not
 *  convinced I'll take it", "maybe I'll take it", "unlikely I'll take it at this
 *  number") flips the utterance into a NON-commitment. NEGATION_PATTERN only
 *  fires on a negator ADJACENT to the verb, so a governor separated from the
 *  commit by a subject ("I don't think" + "I'll take it") slipped it and
 *  FALSE-CLOSED — and the strict gate never ran NEGATION_PATTERN at all, so it
 *  leaked every form. Scoped like the PRI-60 rhetorical vetoes: the governor
 *  must GOVERN a commit idiom within a short window, so a doubt about a
 *  DIFFERENT aspect ("I'm not sure about the title, but I accept the offer")
 *  keeps its distant, ungoverned accept. Blocking a hedged accept is the SAFE
 *  direction under the safe-default contract — it costs one recoverable turn,
 *  never an unrecoverable false close. Shared single-source so BOTH gates reject
 *  in lockstep (FALSE_CLOSE_VETO_PATTERNS → HEDGE_VETO_PATTERNS). */
const DOUBT_HEDGE_THEN_COMMIT_PATTERN =
  /\b(?:i\s+don.?t\s+think|i\s+doubt|i.?m\s+not\s+(?:sure|convinced|certain)|not\s+(?:sure|convinced|certain)|unlikely|i.?m\s+leaning\s+(?:against|towards?\s+no)|hard\s+to\s+say|i.?m\s+on\s+the\s+fence|i.?m\s+hesitant|maybe|perhaps|possibly)\b[^.!?]{0,18}?\b(?:i.?(?:ll|d)\s+(?:take|sign|go\s+with|do\s+it|join|accept)|i.?m\s+in\b|take\s+(?:it|the\s+offer)|sign(?:\s+up)?\b|accept\b|go\s+ahead|do\s+it\b|it.?s\s+a\s+deal|\bdeal\b)/i;

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
  /* VERB WIDENING (offline hostile close battery, 2026-07-08) — the disbelief /
   * inversion frames governed only "accept", but the same rhetorical frame over
   * the "take N" / "sign" commit verb ("You really think I'll TAKE 40?", "Why
   * would I SIGN this?") flipped an accept-frame into a rejection that step-2.4
   * (accept-at-or-below-offer) then FALSE-CLOSED. The commit-verb group below
   * matches accept/take/sign in all inflections; a genuine accept ("I accept",
   * "I'll take 40", "I'll sign") carries none of these governors, so it is
   * untouched. */
  /* inverted interrogative: "why would/should I … accept/take/sign" */
  /\bwhy\s+(?:would|should|will|on\s+earth\s+(?:would|should))\s+i\b[^.!?]{0,30}\b(?:accept(?:s|ing|ed)?|takes?|taking|took|sign(?:s|ing|ed)?)\b/i,
  /* subject-verb inversion: "would/should I (ever) accept/take/sign" — never a
   * genuine accept (that is "I would accept"); the inversion marks a question. */
  /\b(?:would|should)\s+i\s+(?:ever\s+|really\s+|honestly\s+|seriously\s+)?(?:be\s+)?(?:accept(?:s|ing|ed)?|takes?|taking|took|sign(?:s|ing|ed)?)\b/i,
  /* disbelief frame: "(do) you (really) think/expect/believe … accept/take/sign" */
  /\byou\s+(?:really\s+|seriously\s+|honestly\s+|actually\s+)?(?:think|expect|believe|assume|reckon|suppose|imagine)\b[^.!?]{0,30}\b(?:accept(?:s|ing|ed)?|takes?|taking|took|sign(?:s|ing|ed)?)\b/i,
  /* negation-by-impossibility: "(there's) no way I('m/d) accept/take/sign" */
  /\b(?:no\s+way|there'?s\s+no\s+way)\b[^.!?]{0,20}\b(?:accept(?:s|ing|ed)?|takes?|taking|took|sign(?:s|ing|ed)?)\b/i,
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
  /* PRI-74 (2026-07-10, offline hostile close battery — round-6) — NEGATED
   * IMPERATIVE governor: "don't expect me to sign", "don't count on me to
   * accept". The disbelief frame above needs "you … expect …"; the
   * imperative-negation form ("DON'T expect me to …") has no "you" subject, so
   * it slipped and FALSE-CLOSED on the embedded "sign"/"accept". Scoped to the
   * negated expectation verb GOVERNING a commit verb within a short window; a
   * genuine "I accept" carries no "don't expect me to" head. */
  /\bdon.?t\s+(?:expect|count\s+on|bank\s+on|hold\s+your\s+breath\s+(?:for|on))\s+me\b[^.!?]{0,18}?\b(?:accept(?:s|ing|ed)?|takes?|taking|took|sign(?:s|ing|ed)?|do\s+it|join)\b/i,
  /* PRI-74 (2026-07-10) — COUNTERFACTUAL SUBJUNCTIVE inversion: "Were I you,
   * I'd accept", "Were I in your shoes, I'd sign". The "were I <other-party>"
   * head is a hypothetical about someone ELSE ("but I'm not you"), never the
   * speaker's own commitment (which is "I accept" / "I'll accept"). The
   * sarcastic-counterfactual arm above owns only the "as if/like I'd accept"
   * frame; the inverted-subjunctive form carried none. Scoped to the inversion
   * head so a genuine "I would accept" (no leading "were I …") is untouched. */
  /\bwere\s+i\s+(?:you|him|her|them|in\s+(?:your|his|her|their))\b[^.!?]{0,25}?\b(?:accept(?:s|ing|ed)?|takes?|taking|took|sign(?:s|ing|ed)?)\b/i,
  /* PRI-76 (2026-07-10, round-8) excluded a "?"-TERMINATED bare accept verb
   * ("Accept? Ha.") as an interrogative echo. Round-9 finds the sibling that
   * slips it: a QUOTATIVE ATTRIBUTION welded to the accept idiom — "Accept it,
   * you say?", "Sign this, they said". The bare verb is followed by an object
   * and then a comma (not "?"), so the round-8 trailing-terminator fix doesn't
   * reach it; the tell is the reported-speech tag (you/they/he/she + say/said)
   * that reframes the verb as the recruiter's instruction being echoed, never
   * the candidate's own commit. A genuine accept never attributes the accept to
   * "you say". Shared single-source so both gates reject in lockstep. */
  /\b(?:accept(?:s|ing|ed)?|takes?|taking|took|sign(?:s|ing|ed)?)\b(?:\s+(?:it|this|that|the\s+offer))?\s*,?\s*(?:so\s+)?(?:you|they|he|she|we)\s+(?:say|says|said)\b/i,
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
/* PRI-75 (2026-07-10, offline hostile close battery — round-7) — the refusal
 * head widened to the CAN'T/WON'T modals: "I'd love to accept, but I can't at
 * 40" welds a warm accept idiom to "can't at <number>", a money-refusal the
 * "not/no way" head missed (and PARTIAL_ACCEPT's money-noun list excludes a
 * bare digit), so it FALSE-CLOSED on a polite decline. `can'?t` requires the
 * trailing t, so an affirmative "I can do it at 40" (no negation) is untouched. */
const MONEY_REJECTION_PATTERN =
  /\b(?:not|no\s+way|never|no\s+chance|can'?t|cannot|couldn'?t|won'?t|wouldn'?t)\s+(?:at|for|on)\s+(?:this|that|these|those|the|such\s+a)?\s*(?:number|price|comp(?:ensation)?|figure|salary|rate|amount|level|money|ctc|package|pay|offer|\d)/i;

/* PRI-77 (2026-07-10, offline hostile close battery — round-9) — a close idiom
 * welded to an "at <price>, NOT <price>" COUNTER: "I'll take it at forty-five,
 * not forty", "deal at 50, not 40". The candidate accepts AT a figure they name
 * and explicitly rejects another (the on-table offer) — a price-counter, not an
 * unconditional close. MONEY_REJECTION requires "not (at/for/on) …" so the bare
 * "not forty"/"not 40" rejection slipped it, and "take it at 45" alone is
 * indistinguishable from the genuine "I accept at 40" without number parsing.
 * The tell that disambiguates is the explicit "not <bare cardinal>" — a genuine
 * accept ("I accept at 40") never negates a number. Scoped to a close idiom
 * within a short window of "not <digit|spelled-cardinal>", so a plain "not
 * because …" / "not gonna lie" (non-numeric) is untouched. Shared single-source
 * so both gates reject in lockstep. */
const COUNTER_NOT_NUMBER_PATTERN =
  /\b(?:take\s+it|i.?ll\s+take|accept(?:s|ing|ed)?(?:\s+it)?|sign|deal|count\s+me\s+in|i.?m\s+in)\b[^.!?]{0,40}?\bnot\s+(?:at\s+)?(?:\d[\d,.]*|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)(?:[\s-](?:one|two|three|four|five|six|seven|eight|nine))?)\b/i;

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
  /\bdo\s+(?:it|this)\s+(?:differently|in\s+a\s+different\s+way|a\s+different\s+way|another\s+way|some\s+other\s+way|some\s+other\s+time|your\s+way|later|instead)\b/i;

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
 *  kidding/sarcasm token.
 *  Round-3 hostile probe (2026-07-08) — a self-cancelling retraction voids the
 *  consent the same way: "Deal — actually no, forget it.", "I accept, never
 *  mind." None of never mind / forget it / scratch that / "actually no" ever
 *  appears in a genuine unconditional accept, so a flat token veto is safe. */
const RETRACTION_PATTERN =
  /\b(?:just\s+|only\s+)?kidding\b|\bjk\b|\bnever\s*mind\b|\bforget\s+it\b|\bscratch\s+that\b|\bactually,?\s+no(?:pe)?\b/i;

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
 *  §11b (2026-07-08) widened the object set to the candidate's OWN reference
 *  ("beat my current by 5 and I'm in", "top my package and we're done"): a
 *  beat-by-N on their current pay is just as much an unmet condition as beating
 *  a rival's number, and the number-role classifier deliberately drops the
 *  unresolvable "by 5" delta — so without this the bare "and I'm in" idiom
 *  false-closed at the un-bumped offer. Offline sweep batch 4 (2026-06-23). */
const COUNTER_THEN_CLOSE_PATTERN =
  /\b(?:beat|match|top|exceed|improve\s+(?:on|upon)|come\s+up\s+on)\s+(?:it|that|this|their\s+(?:offer|number|figure|comp\w*|package|ctc)|the\s+(?:offer|number|figure|comp\w*|package|ctc)|my\s+(?:current|ctc|comp\w*|package|base|salary|pay|number))\b[^.!?]{0,25}?\b(?:and|then|&)\b/i;

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

/** Veto (PRI-78, 2026-07-10, round-10) — the MIRROR of CONDITIONAL_ACCEPT: a
 *  close idiom FOLLOWED by a hard condition — "I accept on the condition you
 *  never do this again", "I'll take it, provided the base moves". CONDITIONAL_
 *  ACCEPT keys on condition-BEFORE-close; the reversed order (accept, THEN the
 *  condition) slipped it and FALSE-CLOSED at the un-met condition. Scoped to
 *  STRONG condition markers only (on-condition / provided / only-if / as-long-as
 *  / contingent / subject-to), deliberately NOT bare "if", so politeness tails
 *  ("I accept, if that's alright") are spared. A genuine unconditional accept
 *  carries none of these after the close. Shared so BOTH gates reject. */
const CLOSE_THEN_CONDITIONAL_PATTERN =
  /\b(?:accept(?:s|ing|ed)?|i.?ll\s+(?:take\s+it|sign|do\s+it)|it.?s\s+a\s+deal|count\s+me\s+in|i.?m\s+in|deal)\b[^.!?]{0,30}?\b(?:on\s+(?:the\s+)?condition|only\s+(?:if|when|on)|provided|as\s+long\s+as|contingent\s+(?:on|upon)|subject\s+to)\b/i;

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
  /\b(?:after|once|when|until)\s+(?:i'?m\s+back\b|i\s+am\s+back\b|(?:i|we)(?:'?ve|'?d|\s+ha(?:ve|d))?\s+(?:talk|speak|consult|discuss|chat|check\b|hear\b|sleep\b|see\b|return\b|run\s+it\s+(?:by|past|with)|get\s+back|am\s+back))/i;

/** Veto (offline hostile close battery, 2026-07-08) — the LEADING consult form:
 *  "Let me run it past my spouse and I'll sign", "let me sleep on it and it's a
 *  deal", "let me check with my manager, then deal". CONSULT_DEFERRAL_PATTERN
 *  owns only the TRAILING "…and I'll sign once I talk to X" (after/once/when/
 *  until head); a candidate who fronts the consultation carries no such head, so
 *  the welded close idiom ("I'll sign"/"deal") FALSE-CLOSED while they were
 *  deferring to a third party. Scoped to unambiguous consult/deliberate verbs
 *  after "let me" so the genuine performative "let me sign" (a commit) does NOT
 *  match. Shared single-source so BOTH gates reject in lockstep. */
const CONSULT_FIRST_PATTERN =
  /\blet\s+me\s+(?:first\s+|just\s+)?(?:run\s+it\s+(?:by|past|with)|bounce\s+it\s+(?:off|by)|check\s+(?:with|in\s+with)|speak\s+(?:to|with)|talk\s+(?:to|it\s+over\s+with|with)|consult|discuss\s+(?:it\s+)?with|sleep\s+on\s+it|loop\s+in|think\s+it\s+over)\b/i;

/** Veto (offline future-deferral battery, 2026-07-09) — a request for TIME
 *  before committing, welded to a close idiom: "Give me till Monday and I'll
 *  sign", "get me a couple of days, then deal", "let me have the weekend, I'm
 *  in". The commit is deferred to a future clock point, so closing NOW is a
 *  FALSE-CLOSE. CONSULT_DEFERRAL owns the "after I talk to X" consult form and
 *  REVIEW_TAIL the "I'll review it" deliberation form; a bare time request
 *  ("give me a day") carries neither, so it slipped every veto. Anchored on a
 *  time-request verb (give/get/grant/allow/let me) + EITHER a till/until/through
 *  head OR a determiner + explicit TIME unit — so "give me the paperwork and I'm
 *  in" ("paperwork" is not a time unit) stays a genuine accept. Shared
 *  single-source so BOTH gates reject in lockstep. */
const TEMPORAL_DEFERRAL_PATTERN =
  /\b(?:give|gimme|get|grant|allow|let)\s+me\s+(?:have\s+)?(?:(?:till|until|through)\b|(?:a|an|another|some|more|the|a\s+couple(?:\s+of)?|a\s+few)\s+(?:days?|weeks?|weekend|nights?|evenings?|hours?|moments?|minutes?|mins?|bit|while|months?|time)\b)/i;

/** Veto (offline future-deferral battery, 2026-07-09) — a close idiom gated on
 *  a FUTURE EVENT that has not yet happened: "The day the joining bonus lands,
 *  I'm in", "the moment the equity clears, deal", "the minute it hits my account,
 *  I'll sign". The "the day/moment/minute … <future-verb>" frame defers the
 *  commit to an unrealized event (the offer is un-bumped now), so closing is a
 *  FALSE-CLOSE. The demand-then-close vetoes need a grant VERB abutting the
 *  sweetener; a future-event frame carries none, so "the day the joining bonus
 *  lands" slipped them. Scoped to a temporal head noun + a settlement/arrival
 *  verb within 40 chars; genuine accepts never use this frame. Shared
 *  single-source so BOTH gates reject in lockstep. */
const FUTURE_EVENT_CLOSE_PATTERN =
  /\bthe\s+(?:day|moment|minute|second|instant|hour)\b[^.!?\n]{0,40}?\b(?:lands?|arrives?|comes?\s+(?:in|through)|clears?|hits?|shows?\s+up|is\s+(?:confirmed|sorted|done|in|finalized|settled|through|paid|approved)|goes?\s+through)\b/i;

/** Veto (offline future-deferral battery, 2026-07-09) — a commit gated on first
 *  receiving a CHANGED document: "Send the revised letter and I'll sign then",
 *  "share the updated offer and I'm in", "the corrected paperwork, then deal".
 *  The revised/updated/corrected/amended qualifier marks the current document as
 *  superseded — an unmet demand for a change — so the welded close finalizes at
 *  the un-revised offer (soft FALSE-CLOSE). REVIEW_TAIL owns "I'll review it";
 *  this owns the pending-revision request. Scoped to unambiguous change-markers
 *  (a genuine "send the offer letter and I'll sign" carries none). Shared
 *  single-source so BOTH gates reject in lockstep. */
const REVISED_DOCUMENT_PATTERN =
  /\b(?:revised|updated|corrected|amended|reworked)\s+(?:offer(?:\s+letter)?|letter|paperwork|contract|agreement|version|draft|document|terms|ctc\s+letter)\b/i;

/** Veto (offline hostile close battery, 2026-07-08) — a NON-numeric sweetener
 *  GRANT demand welded to a close idiom by a non-contrastive conjunction:
 *  "Throw in relocation and we've got a deal", "Add a joining bonus and I'll
 *  sign", "Include equity and I'm in", "Sort out the ESOP and count me in". The
 *  close idiom matches, but it is CONTINGENT on the company first granting an
 *  unmet sweetener — a counter, not an unconditional accept (soft FALSE-CLOSE,
 *  the worst mode). CONDITIONAL_DEMAND / DEMAND_FOR_MORE / VERB_MAGNITUDE all
 *  require a NUMBER, COUNTER_THEN_CLOSE requires a beat/match verb, and PRI-63's
 *  grant veto owns only the LEADING "if you throw in …" form — so the "and"-
 *  welded bare-grant form slipped every existing veto. Match a grant verb
 *  (throw/toss/chip in · add · include · cover · sort out · guarantee · sweeten ·
 *  match) + an explicit SWEETENER noun (joining/signing/retention bonus · equity/
 *  ESOP/RSU/stock · relocation · notice buyout · variable · allowance/HRA · perks/
 *  benefits · WFH) ABUTTING an and/then/& continuation. The sweetener noun is
 *  REQUIRED, so a genuine accept naming no sweetener ("add me and I'll sign") is
 *  untouched, and past-tense acknowledgement of a GRANTED sweetener ("you covered
 *  relocation and I'm in" — "covered"/"threw" carry no \bcover\b/\bthrow\b
 *  boundary) does not match. Shared single-source so BOTH gates reject in
 *  lockstep. */
const GRANT_THEN_CLOSE_PATTERN =
  /\b(?:throw\s+in|toss\s+in|chip\s+in|add\b|include\b|cover\b|sort\s+out|guarantee|sweeten|match\b)\b[^.!?]{0,30}?\b(?:joining\s+bonus|signing\s+bonus|sign[-\s]?on\s+bonus|retention\s+bonus|bonus(?:es)?|joining|relocation|reloc\b|notice\s+(?:buyout|pay|period(?:\s+buyout)?)|buyout|esops?|rsus?|equity|stock(?:\s+options?)?|shares?|variable|allowances?|hra\b|perks?|benefits?|wfh|remote|sabbatical)\b[^.!?]{0,25}?\b(?:and|then|&)\b/i;

/** Veto (offline hostile close battery batch 2, 2026-07-08) — a close idiom
 *  welded to a STOCK SARCASTIC REFUSAL: "Deal? Only in your dreams.", "I'll
 *  sign — dream on.", "count me in, when pigs fly." The bare-"deal" / "I'm in"
 *  idiom matches, but the dismissive stock phrase flips it to an emphatic
 *  rejection (FALSE-CLOSE). None of these idioms ever appear in a genuine
 *  accept, so a flat token veto is safe. "fat chance" / "not a chance" overlap
 *  WALK_AWAY (harmless redundancy). Shared single-source so BOTH gates reject. */
/* PRI-74 (2026-07-10, offline hostile close battery — round-6) — the
 * "…, said no one" sarcasm idiom negates the whole preceding clause, but the
 * bank only carried the fixed "said no one EVER" form. "I'll sign, said no one
 * looking at this base." carries "said no one" WITHOUT "ever" (the sarcasm is
 * completed by the trailing qualifier, not the "ever"), so it slipped and
 * FALSE-CLOSED on an outright refusal — the worst mode. Widen the trailing
 * "ever" to optional and accept "said nobody" too; a genuine accept never
 * carries a "said no one/nobody" tag. */
/* PRI-75 (2026-07-10, offline hostile close battery — round-7) — three more
 * stock IMPOSSIBILITY idioms that negate a welded close, each a FALSE-CLOSE on
 * an outright refusal: "the day pigs fly" (the "when pigs fly" sibling), "in
 * an alternate/another universe" (the "in your dreams" sibling), and "only in
 * your imagination". A genuine accept never carries an impossibility tag, so
 * matching anywhere in the clause is safe under the safe-default contract. */
/* PRI-78 (2026-07-10, round-10) — the "…, said no X ever" sarcasm idiom
 * generalizes past "said no one/body ever": "I'll take it… said no engineer
 * ever." PRI-74 only widened the "ever" to optional on the fixed one/body head;
 * the arbitrary-noun form ("said no <noun> ever") slipped and FALSE-CLOSED. The
 * "ever" is the disambiguator for an arbitrary noun (so "he said no engineer
 * would apply" without "ever" is untouched); the bare one/body head keeps its
 * ever-optional form. A genuine accept never carries a "said no … ever" tag. */
/* PRI-79 (2026-07-10, round-11) — the "when monkeys fly (out of my ass)"
 * impossibility idiom, sibling of "when pigs fly" / "when hell freezes over"
 * already here. "I accept, and monkeys might fly out of my ass." welds a close
 * to an impossibility tag = emphatic refusal (FALSE-CLOSE). A genuine accept
 * never carries a "monkeys fly" tag, so matching anywhere in the clause is safe
 * under the safe-default contract. */
/* PRI-83 (2026-07-10, adversarial probe) — the stock emphatic-refusal slang
 * "hard pass" / "hard no" welded to a bare-"deal" close: "Deal? Hard pass."
 * The interrogative "Deal?" fires the deal-noun accept core, and the dismissive
 * "hard pass" flips it to an outright refusal (FALSE-CLOSE, the worst mode).
 * Like the rest of this bank, "hard pass" / "hard no" never appear in a genuine
 * accept, so a flat token veto anywhere in the clause is safe. */
const SARCASTIC_REFUSAL_PATTERN =
  /\b(?:in\s+your\s+dreams|keep\s+dreaming|dream\s+on|not\s+in\s+a\s+million\s+years|over\s+my\s+dead\s+body|(?:when|the\s+day)\s+pigs\s+fly|monkeys?\s+(?:might\s+|will\s+|could\s+|may\s+|would\s+)?fly|(?:when|till|until)\s+hell\s+freezes(?:\s+over)?|fat\s+chance|not\s+on\s+your\s+life|yeah\s+no\b|hard\s+(?:pass|no)\b|said\s+no\s+(?:\w+\s+)?ever|said\s+no\s*(?:one|body)|in\s+(?:an?\s+)?(?:alternate|another|parallel)\s+(?:universe|reality|world|timeline|dimension)|in\s+your\s+(?:imagination|fantasy|fantasies))\b/i;

/** Veto (PRI-79, 2026-07-10, round-11) — an accept verb whose OBJECT is a
 *  GIVING-UP / WALK noun: "I accept defeat — I'm walking", "I accept my
 *  resignation from this conversation", "I accept the loss". WRONG_OBJECT_ACCEPT
 *  requires an article before its noun list and does not carry "defeat" bare, a
 *  "my"-articled object, or "resignation/loss" — so these slipped and FALSE-
 *  CLOSED an explicit surrender/walk. "Accepting defeat" is the opposite of
 *  closing the deal. The offer nouns are absent from this list, so a genuine
 *  "accept the offer" is untouched. */
const ACCEPT_WALK_OBJECT_PATTERN =
  /\baccept(?:s|ing|ed)?\s+(?:my\s+|your\s+|the\s+|this\s+)?(?:defeat|resignation|loss|walk[\s-]?away)\b/i;

/** Veto (PRI-79, 2026-07-10, round-11) — the "(agree/offer) to disagree/differ"
 *  idiom riding an accept verb: "I accept the offer to disagree". The literal
 *  "the offer" satisfied the accept core, but "offer to disagree/differ" is a
 *  fixed idiom (a willingness to stop agreeing), never the comp offer — a
 *  refusal. Scoped to the "to disagree/differ" idiom tail so a genuine "accept
 *  the offer" is untouched. */
const OFFER_TO_DISAGREE_PATTERN =
  /\b(?:offer|agree)\s+to\s+(?:dis)?(?:agree|differ)\b/i;

/** Veto (PRI-79, 2026-07-10, round-11) — a close idiom whose deal is attributed
 *  to a NON-PARTY: "You have yourself a deal with nobody", "Consider it accepted
 *  — by someone else", "It's a deal for someone else". The bare "deal"/"accepted"
 *  idiom matched, but the attribution ("with nobody", "by/for someone else")
 *  says the candidate is NOT the party closing — an emphatic refusal (FALSE-
 *  CLOSE). No genuine accept attributes the deal away from the speaker, so this
 *  is safe. */
const NON_PARTY_ATTRIBUTION_PATTERN =
  /\b(?:deal|accepted|sign(?:ed|ing)?|in|take\s+it)\b[^.!?]{0,20}?\b(?:with\s+(?:nobody|no\s+one|no-one)|(?:by|for)\s+someone\s+else)\b/i;

/** Veto (PRI-79, 2026-07-10, round-11) — an emphatic TRAILING "— NOT" negation:
 *  "Fine, deal — NOT.", "I'll take it... not." The close idiom matches, but the
 *  clause-final standalone "not" (behind a dash or ellipsis) flips the whole
 *  statement to a refusal (the '90s sarcasm construction). Scoped to a dash/
 *  ellipsis-preceded, clause-final "not" so mid-sentence "I'm not sure" and
 *  "not a problem, deal" are untouched. */
const TRAILING_NOT_NEGATION_PATTERN =
  /(?:[—–-]{1,2}|\.{2,})\s*not\b[.!\s]*$/i;

/** Veto (PRI-79, 2026-07-10, round-11; temporal head completed PRI-81,
 *  2026-07-10 via the adversarial differential audit) — a commit gated on the
 *  offer first becoming "worth" it: "I'll sign when you offer something worth
 *  signing", "I'll take it once it's worth accepting". The "<temporal> … worth
 *  <verb>" frame is a sarcastic refusal (the current offer is deemed unworthy) —
 *  a FALSE-CLOSE. The temporal head enumerates the full synonym set of
 *  conditional-time conjunctions — the conjunction forms (when/once/until/till)
 *  AND the noun-phrase forms (the moment/second/minute/instant), which the audit
 *  found leaking ("Deal, the moment it's worth signing"). Scoped to that head so
 *  a genuine "this is worth signing, deal!" (no temporal conditional) is
 *  untouched. */
const WORTH_SIGNING_CONDITIONAL_PATTERN =
  /\b(?:when|once|until|till|the\s+(?:moment|second|minute|instant))\s+(?:you|they|it.?s|there.?s)\b[^.!?]{0,30}?\bworth\s+(?:signing|accepting|taking|considering|my\s+(?:time|while))\b/i;

/** Veto (offline hostile close battery, 2026-07-09) — a close idiom welded to a
 *  PEJORATIVE CHARACTERIZATION OF THE OFFER: "count me in, for a pay cut", "I'll
 *  take it if you enjoy lowballing me", "deal, if you call this an offer", "I'll
 *  sign — for someone with half my experience", "I'll take it, what a joke". The
 *  close idiom ("count me in"/"I'll take it"/"deal") matches, but the candidate
 *  is simultaneously calling the offer a pay cut / lowball / insult — a sarcastic
 *  refusal, not an accept (soft FALSE-CLOSE, the worst mode). SARCASTIC_REFUSAL
 *  owns only stock dismissive interjections ("in your dreams"); a pejorative
 *  DESCRIPTION of the offer carries none, so these slipped every veto. Per the
 *  safe-default contract (a false-close is unrecoverable; missing an accept costs
 *  one turn) the veto is deliberately aggressive: it matches the pejorative
 *  anywhere, so a rare grudging accept that names a "pay cut" is re-asked (safe)
 *  rather than risking a false-close. The token set excludes ambiguous praise
 *  words with a common SINCERE accept use — notably "so generous" ("that's so
 *  generous, I'll take it!") is intentionally NOT here. Shared single-source so
 *  BOTH gates reject in lockstep. */
const DISMISSIVE_OFFER_CHARACTERIZATION_PATTERN =
  /\b(?:pay[\s-]?cut|low[\s-]?ball(?:ing|ed|s)?|under[\s-]?paid|under[\s-]?pay(?:ing)?|what\s+a\s+joke|call\s+(?:this|that)\s+an?\s+offer|half\s+(?:my|the|your)\s+experience|insulting\s+(?:offer|number|amount|lowball)|an\s+insult\b)/i;

/** Veto (round-3 hostile probe, 2026-07-08) — a NON-comp demand ("make it a
 *  Principal role", "make it a Staff title") welded to a close idiom by
 *  and/then/&. GRANT_THEN_CLOSE owns cash SWEETENERS and CONDITIONAL_RAISE owns
 *  a numeric raise; a role/title/level/designation upgrade is neither, so
 *  "Make it a Principal role and it's a deal." FALSE-CLOSED at the un-upgraded
 *  offer. Scoped to "make it" + a level/title noun + an and/then continuation;
 *  "make it official and I'll sign" ("official" is not a level noun) is
 *  untouched. Shared single-source so BOTH gates reject in lockstep. */
const NONCOMP_DEMAND_THEN_CLOSE_PATTERN =
  /\bmake\s+it\s+(?:a\s+|an\s+|the\s+)?[^.!?]{0,20}?\b(?:roles?|titles?|designations?|levels?|bands?|grades?|positions?|principal|staff|senior|lead|director|manager|architect)\b[^.!?]{0,25}?\b(?:and|then|&)\b/i;

/** PRI-69 (2026-07-08, offline hostile close battery) — first-person DEMAND for
 *  MORE money welded to a close idiom by a NON-contrastive conjunction. The
 *  candidate says "Give me 8% more and it's a deal" / "I want 2L more and I'll
 *  sign": the close idiom ("it's a deal", "I'll sign") matches, but it is
 *  CONTINGENT on the company first granting the demanded increase — a counter,
 *  not an unconditional accept (FALSE-CLOSE: the bot finalizes at the un-bumped
 *  offer while the candidate is demanding a raise). CONDITIONAL_DEMAND owns the
 *  "make it / get it TO <target>" absolute form; PARTIAL_ACCEPT / NEGOTIATING_BUT
 *  require a but/except/however CONTRASTIVE conjunction, so the "and"-welded
 *  RELATIVE demand ("N% more", "N more") slipped every existing veto. Scoped to a
 *  first-person demand verb (give/gimme/get/hand/throw/toss me · I want/need/…) +
 *  an explicit increase magnitude (N% / N<unit> / bare N) + an increase token
 *  (more/higher/extra/additional/on top). The `(?!\s+than)` guard spares
 *  gratitude phrasings ("3% more than I expected, deal"); the delta form with no
 *  increase token ("give me another 2L") carries no "more" and stays with the
 *  PRI-68 meet-and-close path (resolveConditionalCashTarget). Shared
 *  single-source so BOTH gates reject in lockstep. */
const DEMAND_FOR_MORE_PATTERN =
  /\b(?:(?:give|gimme|get|hand|throw|toss)\s+me|i(?:'?d)?\s+(?:want|need|expect|like)|i'?m\s+(?:after|looking\s+for))\b[^.!?]{0,20}?\d+(?:\.\d+)?\s*(?:%|percent|l|lpa|lakhs?|lac|k)?\s*(?:more|higher|extra|additional|on\s+top)\b(?!\s+than)/i;

/** PRI-69b (2026-07-08) — companion to DEMAND_FOR_MORE for the BARE relative
 *  demand welded to a close idiom by a non-contrastive conjunction, WITHOUT the
 *  first-person demand verb: "Just 2 higher and it's a deal", "3% more then
 *  we're done". A magnitude + increase token ("2 higher", "3% more") ABUTS an
 *  and/then/& continuation carrying the close idiom. Mirrors CONDITIONAL_DEMAND
 *  (which owns the absolute "make it TO N and…" form) for the relative case;
 *  DEMAND_FOR_MORE covers only the "give me / I want N more" first-person form.
 *  `(?!\s+than)` spares gratitude ("3% more than I expected, and I'm thrilled").
 *  Shared single-source so BOTH gates reject in lockstep. */
const RELATIVE_DEMAND_THEN_CLOSE_PATTERN =
  /\b\d+(?:\.\d+)?\s*(?:%|percent|lpa|lakhs?|lac|l|k)?\s*(?:more|higher|extra|additional|on\s+top)(?!\s+than)\b[^.!?]{0,25}?\b(?:and|then|&)\b/i;

/** #33b (2026-07-08, offline hostile close battery) — the WORD/ARTICLE-quantified
 *  sibling of RELATIVE_DEMAND_THEN_CLOSE. The relative-demand veto keys on a
 *  DIGIT magnitude ("2 higher", "3% more"), so a demand whose magnitude is an
 *  indefinite article, "half", or a couple/few word ("a lakh more and I'll
 *  sign", "half a lakh more and I'm in") slipped every veto and was classified
 *  an UNCONDITIONAL accept — the close finalized at the un-bumped offer while the
 *  candidate was demanding a raise (soft false-close, the worst mode). Match a
 *  verbal cash quantifier + increase token (more/higher/extra) ABUTTING an
 *  and/then/& continuation, mirroring the digit pattern. Vetoing here routes the
 *  turn to the conditional-close path, where resolveConditionalCashTarget (#33)
 *  resolves the verbal delta and honors or declines it. `(?!\s+than)` spares
 *  gratitude ("a lakh more than I hoped, deal"). Shared single-source so BOTH
 *  gates reject in lockstep. */
const WORD_DEMAND_THEN_CLOSE_PATTERN =
  /\b(?:a|an|one|half\s+a|(?:a\s+)?couple(?:\s+of)?|(?:a\s+)?few|several)\s+(?:l\b|lpa|lakhs?|lac|%|percent)\s*(?:more|higher|extra|additional|on\s+top)(?!\s+than)\b[^.!?]{0,25}?\b(?:and|then|&)\b/i;

/** #35 (2026-07-08, offline hostile close battery) — VERB-FRONTED cash bump
 *  welded to a close idiom. The three demand vetoes above all require a TRAILING
 *  increase token ("2 higher", "a lakh more"), but a bump whose increase intent
 *  lives in the VERB carries none: "Bump it 5% and I'll sign", "Push the base up
 *  by a few percent and we have a deal". Those slipped every veto and classified
 *  an UNCONDITIONAL accept → the close finalized at the un-bumped offer while the
 *  candidate demanded a raise (soft false-close). Match an increase VERB
 *  (same set as the planner's INCREASE_VERB) + a magnitude (digit or verbal
 *  quantifier) + a cash/percent unit, ABUTTING an and/then/& close continuation.
 *  Vetoing routes the turn to the conditional-close path where
 *  resolveConditionalCashTarget (#35) resolves the percent/lakh delta and honors
 *  or declines it. Needs the unit, so "add the joining bonus and I'll sign" (no
 *  magnitude+unit) and "I'm 100 percent in" (no increase verb, no and/then) are
 *  both spared. Shared single-source so BOTH gates reject in lockstep. */
const VERB_MAGNITUDE_THEN_CLOSE_PATTERN =
  /\b(?:bump|raise|increase|push|hike|lift|boost|stretch|nudge|add|jack)\b[^.!?]{0,25}?\b(?:\d+(?:\.\d+)?|a|an|one|half\s+a|(?:a\s+)?couple(?:\s+of)?|(?:a\s+)?few|several)\s*(?:%|(?:percent|per\s?cent|lpa|lakhs?|lac|l|k)\b)[^.!?]{0,25}?\b(?:and|then|&)\b/i;

/** All PRI-59/61/63/69 + batch-2 precision vetoes, shared by both gates. */
const FALSE_CLOSE_VETO_PATTERNS: RegExp[] = [
  DEMAND_FOR_MORE_PATTERN,
  RELATIVE_DEMAND_THEN_CLOSE_PATTERN,
  WORD_DEMAND_THEN_CLOSE_PATTERN,
  VERB_MAGNITUDE_THEN_CLOSE_PATTERN,
  TAKE_IT_HEDGE_PATTERN,
  IM_IN_HEDGE_PATTERN,
  ACCEPT_PROPOSITION_PATTERN,
  ACCEPT_NOT_THE_OFFER_PATTERN,
  WRONG_OBJECT_ACCEPT_PATTERN,
  COMPARATIVE_OFFER_ACCEPT_PATTERN,
  CLOSE_THEN_CONDITIONAL_PATTERN,
  IN_PRINCIPLE_PATTERN,
  DOUBT_HEDGE_THEN_COMMIT_PATTERN,
  MONEY_REJECTION_PATTERN,
  COUNTER_NOT_NUMBER_PATTERN,
  SETTLE_NEGATION_PATTERN,
  DO_IT_REDIRECT_PATTERN,
  DEFERRED_SETTLE_NOUN_PATTERN,
  NEGOTIATION_REDIRECT_PATTERN,
  RETRACTION_PATTERN,
  CONDITIONAL_DEMAND_PATTERN,
  COUNTER_THEN_CLOSE_PATTERN,
  GRANT_THEN_CLOSE_PATTERN,
  NONCOMP_DEMAND_THEN_CLOSE_PATTERN,
  CONDITIONAL_ACCEPT_PATTERN,
  SARCASTIC_REFUSAL_PATTERN,
  ACCEPT_WALK_OBJECT_PATTERN,
  OFFER_TO_DISAGREE_PATTERN,
  NON_PARTY_ATTRIBUTION_PATTERN,
  TRAILING_NOT_NEGATION_PATTERN,
  WORTH_SIGNING_CONDITIONAL_PATTERN,
  DISMISSIVE_OFFER_CHARACTERIZATION_PATTERN,
  REVIEW_TAIL_PATTERN,
  CONSULT_DEFERRAL_PATTERN,
  CONSULT_FIRST_PATTERN,
  TEMPORAL_DEFERRAL_PATTERN,
  FUTURE_EVENT_CLOSE_PATTERN,
  REVISED_DOCUMENT_PATTERN,
  ...RHETORICAL_ACCEPT_VETO_PATTERNS,
  ...PARTIAL_ACCEPT_VETO_PATTERNS,
];

/** Veto: hard conditional ("if/unless/provided"). Info-seeking
 *  conditionals are excepted ("if you could share the breakdown"). */
const HARD_CONDITIONAL_PATTERN =
  /\b(?:if|unless|provided|on condition|conditional\s+on|contingent|only\s+if|as\s+long\s+as|so\s+long\s+as|assuming|subject\s+to|agar|jab\s+tak)\b/i;
const INFO_SEEKING_CONDITIONAL_PATTERN =
  /\b(?:if|unless|provided)\s+(?:you|it.?s|i)\s*(?:could|can|may|might|would|don.?t mind)?\s*(?:share|tell|let me know|elaborate|explain|clarify|confirm|provide|walk me through|give me|outline|show)\b/i;
/* Acquiescence exception (hostile-probe over-block, 2026-07-09) — an "if"
 * that introduces CONCESSION, not a demand: "if that's the best you can do,
 * I'll take it", "if you say so, deal", "if that works for you". These are
 * genuine accepts, not hard conditionals, and the broad HARD_CONDITIONAL "if"
 * was blocking them. Whitelisting them here is safe: any real demand riding in
 * the same utterance is still caught downstream by the unmet-demand gate, so
 * this only rescues the pure-acquiescence accept. */
const ACQUIESCENCE_CONDITIONAL_PATTERN =
  /\bif\s+(?:you\s+(?:say\s+so|insist|really\s+(?:say\s+so|mean\s+it))|need\s+be|(?:that|this|it)(?:'?s|\s+is)?\s+(?:the\s+best|really\s+(?:the\s+)?best|what\s+(?:it|you)|final|it\s+is|fine|good|ok(?:ay)?|works?|acceptable|all\s+you|the\s+deal)|that'?ll\s+work|that\s+works\s+for\s+you)\b/i;

/** Shared conditional-acceptance veto — the SINGLE source of truth for
 *  "this close idiom is gated on an unmet condition, so it is not an
 *  unconditional accept". Both gates call it: the medium gate
 *  (classifyAcceptance, step 1) and the strict gate
 *  (detectExplicitAcceptance), so a conditional close is blocked in lockstep.
 *  A hard conditional ("as long as / provided / only if / assuming / subject
 *  to / contingent on …") wins unless it's the info-seeking ("if you could
 *  share …") or acquiescence ("if that's the best you can do, I'll take it")
 *  variant — both of which are genuine, non-blocking. A temporal deferral
 *  ("I'll sign once you confirm the title") is the second blocking class.
 *  Returns the reason id (so the medium gate keeps its granular reasons) or
 *  null. */
function blockingConditionalReason(a: string): "hard-conditional" | "conditional-deferral" | null {
  if (
    HARD_CONDITIONAL_PATTERN.test(a) &&
    !INFO_SEEKING_CONDITIONAL_PATTERN.test(a) &&
    !ACQUIESCENCE_CONDITIONAL_PATTERN.test(a)
  ) {
    return "hard-conditional";
  }
  if (CONDITIONAL_DEFERRAL_PATTERN.test(a)) return "conditional-deferral";
  return null;
}

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

/** Veto: negation of acceptance ("not interested", "won't accept", "won't
 *  sign", "not accepting this offer"). The verb alternation must cover the
 *  SAME acceptance verbs the positive arms match, or a negated accept slips the
 *  veto and FALSE-CLOSES on an outright rejection (2026-07-09 probe: "I won't
 *  sign today" matched the "signing today" arm; "I am not accepting this offer"
 *  matched the performative-accept arm). `accept(?:ing|ed)?` is required because
 *  bare `\baccept\b` stops at the word boundary before "-ing"/"-ed", so it never
 *  matched the inflected "not accepting"/"not accepted". Adjacency (single \s+
 *  gap) keeps enthusiastic accepts safe: "I can't wait to sign" has filler
 *  between the negator and the verb, so it is not vetoed. */
const NEGATION_PATTERN =
  /\b(no|not|don.?t|can.?t|won.?t|never)\s+(?:accept(?:ing|ed)?|interested|want|going|happy|comfortable|sure|sign(?:ing)?|tak(?:e|ing))\b/i;

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

/** Does the utterance carry ANY commit / close idiom (performative
 *  verb, commitment idiom, Hindi-mix accept, soft alignment, an
 *  accept-frame number, or a split-clause commit)? Used only to
 *  compose the conjunction-independent unmet-demand gate: a demand
 *  matters for false-close prevention only when a close idiom is also
 *  present. A superset of every idiom bank the classifier can accept
 *  on, so the gate can never let a demand-welded close slip past
 *  merely because the two are joined by a comma / "plus" / no joiner
 *  rather than "and" / "then". */
function hasCommitOrCloseIdiom(text: string): boolean {
  return (
    anyMatch(text, STRONG_PERFORMATIVE_PATTERNS) ||
    anyMatch(text, COMMITMENT_IDIOM_PATTERNS) ||
    anyMatch(text, HINDI_MIX_PATTERNS) ||
    anyMatch(text, SOFT_ALIGNMENT_PATTERNS) ||
    anyMatch(text, SPLIT_CLAUSE_ACCEPTANCE_PATTERNS) ||
    ACCEPT_FRAME_NUMBER_PATTERN.test(text)
  );
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
  if (isWalkAway(a)) {
    return { accepted: false, confidence: "none", reasons: ["walk-away"] };
  }
  const hasAcquiescence = ACQUIESCENCE_CONDITIONAL_PATTERN.test(a);
  const condReason = blockingConditionalReason(a);
  if (condReason) {
    return { accepted: false, confidence: "none", reasons: [condReason] };
  }
  /* PRI-59 precision vetoes — a hostile NON-accept sharing a substring with a
     real accept idiom ("I'll take it elsewhere", "I'm in talks", "I accept
     that this is your final number", "I accept in principle"). */
  /* CONDITIONAL_ACCEPT_PATTERN ("if <cond> … I'll take it") is the old
   * bridge-style veto; under an ACQUIESCENCE "if" ("if that's the best you can
   * do, I'll take it") it over-fires on a genuine concession accept. Lift only
   * that one pattern for acquiescence — every other false-close veto AND the
   * downstream unmet-demand gate still apply, so a real demand riding the same
   * acquiescence clause ("if you say so, but bump it 2%") is still blocked. */
  const falseClosePatterns = hasAcquiescence
    ? FALSE_CLOSE_VETO_PATTERNS.filter((p) => p !== CONDITIONAL_ACCEPT_PATTERN)
    : FALSE_CLOSE_VETO_PATTERNS;
  if (anyMatch(a, falseClosePatterns)) {
    return { accepted: false, confidence: "none", reasons: ["false-close-veto"] };
  }
  /* Conjunction-independent unmet-demand gate (single source of truth,
   * _utterance-intent.ts). The FALSE_CLOSE_VETO_PATTERNS above bridge a
   * demand to its close idiom with a literal `and|then|&`; a comma,
   * "plus", "with", a different demand verb, or no joiner at all
   * defeats every one of them, FALSE-CLOSING a conditional counter at
   * the un-bumped offer ("Bump the base by 5 lakh, I'll sign today.",
   * "Give me 45 and I'm in."). Detecting the demand as a STRUCTURED
   * slot and requiring only that a close idiom appears somewhere in the
   * same utterance closes that whole class regardless of the
   * conjunction. Runs after the bridge vetoes so their finer-grained
   * reason ids win when they DO match; this catches the rest. */
  if (hasCommitOrCloseIdiom(a) && analyzeDemand(a, context.offerLpa).unmet) {
    return { accepted: false, confidence: "none", reasons: ["unmet-demand-then-close"] };
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

  /* Step 2.4 (§11, 2026-07-08, offline hostile battery) — accept-frame naming a
   * number AT or BELOW the standing offer. "I'll take 40" (restating the offer),
   * "happy with 38", "I'll do 40" are acceptances/concessions, not counters: a
   * candidate naming a number no higher than what's on the table has conceded to
   * (or under) it. The performative bank only matched "take it / the offer", so a
   * numbered restatement fell through to no-match and the planner defaulted to a
   * self-defeating UPWARD counter (confirmed via probe: offer ₹40L, "I'll take
   * 40" → counter ₹43L — the bot raised its OWN offer on a done deal). Runs after
   * every step-1 veto (walk-away / negation / hard-conditional / false-close),
   * so "I won't take 40" and "I'll take 40 elsewhere" are already excluded. A
   * number ABOVE the offer is a genuine counter/target and is left to fall
   * through untouched. Gated on the numeric offer; skipped when it's unknown. */
  if (context.offerLpa != null && context.offerLpa > 0) {
    const m = ACCEPT_FRAME_NUMBER_PATTERN.exec(a);
    if (m) {
      const n = parseFloat(m[1]);
      if (Number.isFinite(n) && n > 0 && n <= context.offerLpa + 1e-9) {
        reasons.push("accept-at-or-below-offer");
        return { accepted: true, confidence: "strong", reasons };
      }
    }
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
  /\bplease\s+(?:send|ship)\s+(?:me\s+)?the\s+offer\s+letter\b/i,
  /\b(?:send|ship)\s+(?:me\s+)?the\s+offer\s+letter\b/i,
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
  /* Conditional-acceptance veto — LOCKSTEP with the medium gate via the shared
   * blockingConditionalReason(). A close idiom gated on an unmet condition
   * ("...contingent on a WFH guarantee", "...assuming the base moves to 50") is
   * not an unconditional accept. The medium gate blocked these, but the strict
   * gate checked neither HARD_CONDITIONAL_PATTERN nor CONDITIONAL_DEFERRAL_PATTERN,
   * so a conditional whose demand needs offer context to prove it's upward (WFH,
   * a title, a passive "base moves to 50") slipped past analyzeDemand's
   * offer-unknown mode and matched a STRICT_ACCEPTANCE close idiom — a soft
   * FALSE-CLOSE. Sharing the exact carve-out logic (info-seeking / acquiescence)
   * keeps the two gates in lockstep. */
  if (blockingConditionalReason(t)) return { accepted: false, confidence: 0 };
  /* Structured-demand veto — LOCKSTEP with the medium gate (classifyAcceptance).
   * HEDGE_VETO_PATTERNS above spreads the OLD conjunction-bridge vetoes, which
   * only span `and|then|&`; a comma / "plus" / "with" / no-joiner defeats all of
   * them, so a demand-then-close ("make it 50, I'll take it") slipped past the
   * hedge veto and matched a STRICT_ACCEPTANCE close idiom — a soft FALSE-CLOSE
   * driving the closing UI + kernel escalation-boost off an unmet demand (worst
   * failure mode). A differential probe found 407/756 such utterances accepted
   * here while the medium gate blocked them. analyzeDemand is the single source
   * of truth for "does this carry an unmet demand", conjunction-independent.
   * The strict gate has no offer context, so absolute bare demands ("give me 45")
   * that need the offer to prove they exceed it are NOT flagged here — matching
   * analyzeDemand's offer-unknown behavior (relative/sweetener/comparative/title
   * and absolute-TARGET change-requests still fire; they are inherently upward). */
  if (analyzeDemand(t).unmet) return { accepted: false, confidence: 0 };
  for (const p of STRICT_ACCEPTANCE_PATTERNS) {
    if (p.test(t)) return { accepted: true, confidence: 0.95 };
  }
  return { accepted: false, confidence: 0 };
}
