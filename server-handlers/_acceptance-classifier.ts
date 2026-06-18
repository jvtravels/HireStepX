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
];

/** Soft-alignment forms — language that affirms the offer
 *  specifically, surfaced by MakeMyTrip UX session (2026-05-12).
 *  Each pattern already references the offer object, so the offer-
 *  reference gate is implicitly satisfied. */
const SOFT_ALIGNMENT_PATTERNS: RegExp[] = [
  /\bi\s+(?:really\s+|truly\s+)?like\s+(?:the|this|your)\s+(?:initial\s+)?offer\b/i,
  /\b(?:i'?m|i\s+am|we'?re|we\s+are)\s+aligned\s+(?:with|on)\s+(?:the|this|your)\s+(?:initial\s+)?offer\b/i,
  /\b(?:we|i)\s+(?:'?ve|have)\s+(?:already\s+)?aligned\s+(?:on|with)\s+(?:the|this|your)\s+(?:initial\s+)?offer\b/i,
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
];

/** Offer reference — the candidate's text mentions the offer object
 *  or a specific number. Required to upgrade a commitment idiom
 *  from "ambiguous filler" to "acceptance". */
const OFFER_REFERENCE_PATTERN =
  /\b(?:offer|deal|salary|ctc|package|lpa|lp[a-z]|lakhs?|lacs?|lacks|lax|₹|rs\.?|inr|\$\s*\d|\d+\s*(?:lpa|lp[a-z]|lakhs?|lacs?|lacks|lax|l\b|cr|crore|k\b))\b/i;

/** Veto: walk-away or rejection. */
const WALK_AWAY_PATTERN =
  /\b(walk away|walking away|i.?m out|not interested|i.?ll pass|no deal|withdraw|decline|won.?t work|isn.?t going to work|have to pass|that won.?t work|move on|nahi\s+(?:chahiye|karna|banega|hoga|kar\s+sakta)|nahin\s+(?:chahiye|karna)|mujhe\s+nahi(?:n)?\s+chahiye)\b/i;

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
];

/** Hedged-language vetoes — when ANY of these fire, accepted=false
 *  regardless of any pattern above. */
const HEDGE_VETO_PATTERNS: RegExp[] = [
  /\bif\s+you\s+can\b/i,
  /\bif\s+we\s+can\b/i,
  /\bif\s+the\b/i,
  /\bonly\s+if\b/i,
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
