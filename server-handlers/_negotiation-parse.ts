/* Negotiation kernel: candidate answer parsing and input-sanity bounds. */

import type { VossTactic, InfoIntent, NegotiationState, AffinityReason } from "./_negotiation-state-types";
import { type ComponentBreakdown, extractComponentBreakdown } from "./_component-breakdown";
import { type RationaleResult, extractHikeRationale } from "./_hike-rationale";
import { type NoticeJoiningResult, extractNoticeJoining } from "./_notice-joining";
import { type EquityVestingResult, extractEquityVesting } from "./_equity-vesting";
import { type LocationModeResult, extractLocationMode } from "./_location-mode";
import { type CompetingOfferDetail, extractCompetingOfferDetail } from "./_competing-offer-detail";
import { type DecisionDeadlineResult, extractDecisionDeadline } from "./_decision-deadline";
import { type CandidateProfileResult, EMPTY_CANDIDATE_PROFILE, extractCandidateProfile } from "./_candidate-profile";
import { type MiscSignalsResult, extractMiscSignals } from "./_misc-signals";
import { type CandidateStanceResult, extractCandidateStance } from "./_candidate-stance";
import { type RetentionCounterResult, EMPTY_RETENTION_COUNTER, extractRetentionCounter } from "./_retention-counter";
import { fingerprintWords } from "./_negotiation-serialize";
import type { NegotiationPhase } from "./_negotiation-vocab";
import { normalizeForParsing } from "./_speech-normalize";
import { classifyAcceptance } from "./_acceptance-classifier";
import { isWalkAway } from "./_walkaway-detection";
import { classifyNumberRoles } from "./_number-role-classifier";
import { maskTargetClauses } from "./_negotiation-turn-delta";
import type { RecruiterMoodDynamic } from "./_recruiter-prose-realism";

/* ─── Candidate answer → parsed signals ──────────────────────────── */

export interface ParsedAnswer {
  target: number | null;
  currentCtc: number | null;
  competing: number | null;
  signalsAcceptance: boolean;
  signalsWalkAway: boolean;
  /* Candidate stated their target as a range ("30-35 LPA") rather than
     a single number. Set on the turn it's detected; sticky on state. */
  targetAsRange: boolean;
  /** Audit Fix (2026-05-19) — Component scope of the bound `target`.
   *  Passed through from the number-role classifier. "total" by default,
   *  "fixed" when the candidate tagged the target with a base/fixed
   *  qualifier, null when no target was bound. The kernel routes
   *  "fixed"-scoped targets to candidateTargetFixed instead of
   *  candidateTarget. */
  targetComponent?: "total" | "fixed" | null;
  /* Voss / interviewing.io tactics detected this turn. Multiple may
     fire on the same answer. */
  vossTactics: VossTactic[];
  /* Information items the candidate explicitly asked about this turn. */
  infoAsked: InfoIntent[];
  /* Candidate has explicitly hedged on a competing offer ("I have other
     offers but can't share details"). Signals leverage without
     disclosing a number — kernel should respect but not anchor. */
  signalsCompetingExistsWithoutNumber: boolean;
  /* Component breakdown the candidate stated this turn — base /
     variable / equity. Phase 10A (2026-05-13). When `hasAny` is true,
     the LLM prompt surfaces these so it can respect base-floor /
     variable-cap constraints in subsequent offers. Phase 12 added
     enforcement in the move-picker (response hints + base-floor
     validator). */
  componentBreakdown: ComponentBreakdown;
  /* Phase 11 (2026-05-13) — rationale + hike justification cues. */
  rationale: RationaleResult | null;
  /* Phase 13 — notice / joining bonus / buyout signals. */
  noticeJoining: NoticeJoiningResult;
  /* Phase 14 — equity vesting preferences + literacy. */
  equityVesting: EquityVestingResult;
  /* Phase 15 — work-mode + location + relocation signals. */
  locationMode: LocationModeResult;
  /* Phase 16 — competing-offer paperwork / company / stage detail. */
  competingOfferDetail: CompetingOfferDetail;
  /* Phase 17A — deadline + conditional accept. */
  decisionDeadline: DecisionDeadlineResult;
  /* Phase 17B — candidate background (gap / tenure / level mismatch). */
  candidateProfile: CandidateProfileResult;
  /* Phase 17F — floor / review / proof / internal-counter scalars. */
  miscSignals: MiscSignalsResult;
  /* Phase 18 — candidate stance / posture scalars. */
  candidateStance: CandidateStanceResult;
  /* Phase 27 — retention-counter from current employer. */
  retentionCounter: RetentionCounterResult;
}

/* Parse the candidate's free-text answer for salary-relevant numbers
   and intent signals. Distinguishes "my current package is X" (currentCtc)
   from "I'm looking for Y" (target). Strict ordering: current/competing
   patterns claim their numbers first; target patterns only bind a
   number that wasn't already bound elsewhere. This is what the legacy
   extractor did across the whole transcript every render; here we run
   it once per candidate turn against the single fresh answer. */
/* Hinglish word-number substitution (`tees` → 30, `pachas` → 50, etc.)
 * was relocated to `_speech-normalize.ts` as part of the STT-fragility
 * audit (2026-05-22). The kernel-boundary `normalizeForParsing` call in
 * `parseCandidateAnswer` below runs it together with English
 * number-words, unit-typo fixups, and decimal-point folding — single
 * source of truth for STT normalization. */

/* Voss-tactic detection. These patterns are conservative — only
   reasonably unambiguous formulations are recognized. False positives
   here would silently boost concessions for candidates who didn't
   actually negotiate well. */
export function detectVossTactics(a: string, lastAiText: string): VossTactic[] {
  const out: VossTactic[] = [];

  /* Mirror: candidate ends with a 1-3 word echo of the AI's last
     content phrase, phrased as a question. We approximate by checking
     for trailing "?" + last-AI 1-3 word echo. */
  if (lastAiText && /\?\s*$/.test(a)) {
    const aiWords = fingerprintWords(lastAiText);
    const candWords = fingerprintWords(a);
    if (aiWords.length >= 2 && candWords.length >= 1) {
      const tail = candWords.slice(-3);
      if (tail.length > 0 && aiWords.slice(-6).join(" ").includes(tail.join(" "))) {
        out.push("mirror");
      }
    }
  }

  /* Label: "it sounds like X" / "it seems like X" / "you must be X".
     The classic Voss formulations that name the other party's
     constraint or emotion. */
  if (/\b(it\s+(?:sounds|seems|looks|feels)\s+like|you\s+must\s+(?:be|feel|need)|it\s+appears\s+that)\b/i.test(a)) {
    out.push("label");
  }

  /* Calibrated how/what question. We require "how"/"what" + a modal +
     question mark to avoid grabbing every "how are you" pleasantry. */
  if (/\b(how\s+(?:am\s+i|can\s+(?:we|i)|do\s+(?:you|we)|would\s+you|could\s+(?:we|you))|what.?s\s+(?:the\s+(?:best|most|maximum)|your\s+thinking|driving|behind))\b[^?]*\?/i.test(a)) {
    out.push("calibrated");
  }

  /* "Sign today if X+Y+Z" bundle from interviewing.io playbook.
     Matches both orderings: "sign today if X" and "if X I'll sign
     today". */
  const signToday = /\b(sign\s+today|accept\s+today|close\s+(?:this\s+)?today|done\s+today|sign\s+(?:right\s+)?now|sign\s+tonight)\b/i;
  const conditional = /\b(if|when|provided|as\s+long\s+as)\b/i;
  if (signToday.test(a) && conditional.test(a)) {
    out.push("sign-today-bundle");
  }

  /* Current-CTC deflection. Candidate explicitly refuses to disclose
     current package. */
  if (/\b(?:prefer\s+not\s+to\s+(?:share|disclose)|company\s+policy.*(?:share|disclose|reveal)|(?:current\s+)?ctc\s+is\s+(?:irrelevant|confidential)|focus\s+on\s+(?:expected|market)|don.?t\s+(?:share|disclose)\s+(?:my\s+)?(?:current\s+)?ctc|rather\s+(?:not\s+)?(?:share|discuss)\s+(?:my\s+)?current)\b/i.test(a)) {
    out.push("deflect-current-ctc");
  }

  return out;
}

/* S13-B9 — recruiter-elicited-disclosure detector.
 *
 * True when the recruiter's immediately-prior turn SOLICITED a disclosure
 * from the candidate — i.e. it posed a question that asks the candidate to
 * enumerate / share / walk through a package or comp detail. When this fires,
 * any info-intent the classifier picks up on the candidate's reply is
 * recruiter-ELICITED, not candidate-INITIATED, and must NOT credit the report's
 * "You justified your number" stage. Conservative: it requires an interrogative
 * shape (trailing `?` OR an interrogative lead) AND a second-person solicitation
 * frame directed at the candidate, so a recruiter statement that merely mentions
 * a component ("our variable is 10%") does not count as elicitation. */
export function recruiterElicitedDisclosure(lastAiText: string | null | undefined): boolean {
  const t = (lastAiText ?? "").trim();
  if (!t) return false;
  const interrogative = /\?\s*$/.test(t) || /\b(?:what|which|how|could|can|would|do)\b/i.test(t);
  if (!interrogative) return false;
  /* Second-person solicitation directed at the candidate: "what's your …",
     "can you share/tell/walk me through …", "your current/expected …",
     "break down your …". The recruiter is asking the candidate to disclose. */
  const solicits =
    /\b(?:what.?s|what\s+is|what\s+are)\s+your\b/i.test(t) ||
    /\b(?:can|could|would)\s+you\s+(?:share|tell|walk|give|provide|break|list|elaborate|explain)\b/i.test(t) ||
    /\b(?:share|tell\s+me|walk\s+me\s+through|give\s+me|provide|break\s+down|list|elaborate\s+on)\s+(?:your|the)\b/i.test(t) ||
    /\byour\s+(?:current|expected|present)\b/i.test(t) ||
    /* Recruiter inviting the candidate's questions — "what would you like to
       know…?", "any questions (about …)?", "what can I tell you about …?".
       A question the candidate then asks in reply is elicited, not initiated. */
    /\bwhat\s+would\s+you\s+like\s+to\s+know\b/i.test(t) ||
    /\b(?:any|other)\s+questions\b/i.test(t) ||
    /\bwhat\s+(?:can|could)\s+i\s+(?:tell|share\s+with)\s+you\b/i.test(t);
  return solicits;
}

/* Info-intent detection. The candidate explicitly asks about an offer
   component. Each phrase is conservative — we'd rather miss an ask than
   credit one that wasn't there. */
export function detectInfoIntents(a: string): InfoIntent[] {
  const out: InfoIntent[] = [];
  if (/\b(clawback|claw\s+back|return\s+(?:the\s+)?bonus|repay(?:ment)?|pro[-\s]?rata|tenure\s+requirement)\b/i.test(a)) out.push("clawback-period");
  if (/\b(variable\s+(?:pay|component|payout|history)|bonus\s+payout\s+(?:history|last|past)|payout\s+(?:percentage|%|history)|how\s+much\s+variable)\b/i.test(a)) out.push("variable-history");
  if (/\b(vest(?:ing)?\s+(?:schedule|period|cliff|slope)|cliff|grant\s+schedule|back[-\s]?loaded|monthly\s+vest|quarterly\s+vest)\b/i.test(a)) out.push("vest-schedule");
  if (/\b(strike\s+price|exercise\s+price|409a|fmv|fair\s+market\s+value|grant\s+price)\b/i.test(a)) out.push("strike-price");
  if (/\b(in[-\s]?hand|take[-\s]?home|net\s+(?:salary|monthly|pay)|monthly\s+(?:salary|pay|in\s+hand))\b/i.test(a)) out.push("in-hand-monthly");
  if (/\b(exercise\s+window|post[-\s]?termination|after\s+(?:leaving|resignation)|exercise\s+period)\b/i.test(a)) out.push("exercise-window");
  if (/\b(accelerat(?:ed|ion)\s+vest|change\s+of\s+control|acquisition\s+(?:trigger|clause|vesting)|single[-\s]?trigger|double[-\s]?trigger)\b/i.test(a)) out.push("acceleration");
  /* PDF#41 BUG-B (2026-05-21) — broaden fixed-vs-variable detection.
   * Live Flipkart session: candidate asked "can you provide the
   * breakdown of base vs variable?" and the AI freelanced a refusal
   * because neither this regex (matched only "fixed vs variable", not
   * "base vs variable") nor package-breakdown (required "breakdown of
   * offer/package/ctc", not "breakdown of base") fired. Added
   * "base vs/versus/or/and variable" + "breakdown of base" + "base
   * split" so the wantsBreakdown short-circuit at the planner picks
   * the canonical breakdown lever instead of routing to the LLM
   * answer path. */
  if (/\b(fixed\s+(?:vs|versus|and|or)\s+variable|variable\s+(?:vs|versus|or)\s+fixed|base\s+(?:vs|versus|and|or)\s+variable|variable\s+(?:vs|versus|or|and)\s+base|split\s+(?:between|of)\s+(?:fixed|base)|how\s+much\s+(?:is\s+)?fixed|fixed\s+component|ctc\s+(?:breakdown|split)|base\s+fixed\s+or\s+variable|breakdown\s+of\s+base|base\s+split)\b/i.test(a)) out.push("fixed-vs-variable");
  if (/\b(sodexo|food\s+coupon|gratuity|nps|insurance\s+(?:value|cost)|non[-\s]?cash|benefits\s+(?:value|in\s+ctc))\b/i.test(a)) out.push("perks-non-cash");
  /* Generic "walk me through / break it down / what's the structure" —
     the candidate is explicitly asking the recruiter to enumerate the
     package, NOT to probe their expectations. The Lollypop session
     (May 2026) showed the AI responding to "could you break down the
     offer for me?" with "what range are you targeting?" — a phase
     mismatch the move-picker now overrides via this intent. */
  if (/\b(walk\s+me\s+through|break\s+(?:it|that|the\s+offer|the\s+package)\s+down|breakdown\s+of\s+(?:the\s+)?(?:offer|package|ctc)|structure\s+of\s+(?:the\s+)?(?:offer|package|ctc)|what(?:'s|\s+is)\s+(?:in\s+)?(?:the\s+)?(?:package|offer)|tell\s+me\s+more\s+about\s+(?:the\s+)?(?:package|offer|ctc))\b/i.test(a)) out.push("package-breakdown");
  /* Generic benefits / perks ask — "what are the benefits?", "what
     perks do you offer?", "what do I get besides salary?", "tell me
     about the benefits package", "for the benefits.". Bug report 11
     follow-up E (2026-05-14): the recruiter previously had no response
     for this and looped close-acceptance. Distinct from `perks-non-cash`
     (lump-into-CTC trick) — this is purely an info disclosure. We
     deliberately do NOT match a bare "benefits" word standing alone
     against substrings like "fringe benefits of equity"; we anchor to
     interrogative shapes or the explicit "for the benefits" follow-up. */
  /* Bug session 12 (2026-05-14) — broaden benefits detection.
   * Trigger when an utterance contains \bbenefits?\b OR \bperks?\b AND
   * shows interrogative / imperative shape:
   *   - ends with `?`
   *   - imperative verb: tell|let me know|give|share|explain|list|
   *     describe|details|breakdown|elaborate|walk me through
   *   - question lead: what are|what is|what's|how about|how does|
   *     what does|what kind of|which|can you|could you
   * Falsy guard: bare declaratives like "I counted the benefits." don't
   * trip because they lack interrogative shape and end with `.`.
   * Existing narrow phrases (for the benefits., what do I get, etc.)
   * still match via the legacy regex. */
  const hasBenefitsWord = /\b(?:benefits?|perks?)\b/i.test(a);
  const endsWithQuestion = /\?\s*$/.test(a.trim());
  const imperativeCue = /\b(?:tell\s+me|let\s+me\s+know|give\s+(?:me)?|share|explain|list|describe|details?|breakdown|elaborate|walk\s+me\s+through|can\s+you|could\s+you|would\s+you)\b/i.test(a);
  const questionLead = /\b(?:what\s+are|what\s+is|what['’]s|how\s+about|how\s+does|what\s+does|what\s+kind\s+of|which)\b/i.test(a);
  const broadBenefitsMatch = hasBenefitsWord && (endsWithQuestion || imperativeCue || questionLead);
  const legacyBenefitsMatch =
    /\b(?:what(?:'s|\s+is|\s+are)?\s+(?:the\s+|some\s+|your\s+)?(?:benefits|perks)|tell\s+me\s+(?:about\s+)?(?:the\s+)?(?:benefits|perks)|(?:any|other)\s+(?:benefits|perks)|let\s+me\s+know\s+(?:about\s+)?(?:are\s+)?(?:the\s+)?(?:benefits|perks)|for\s+the\s+(?:benefits|perks)\b|what\s+do\s+i\s+get|benefits\s+(?:for\s+this\s+role|package|breakdown)|perks\s+(?:do\s+you|of\s+(?:this|the)))\b/i.test(a);
  /* "fringe benefits" used to be a standalone trigger; it now requires
   * interrogative shape so "fringe benefits of equity are nice"
   * (declarative) does not fire. */
  const fringeBenefitsMatch = /\bfringe\s+benefits\b/i.test(a) && (endsWithQuestion || imperativeCue || questionLead);
  if (broadBenefitsMatch || legacyBenefitsMatch || fringeBenefitsMatch) out.push("benefits-overview");

  /* Bug session 12 (2026-05-14) — compensation-breakdown.
   * Candidate asking about variable / bonus / ESOP / equity / RSU /
   * OTE structure — generally, NOT about THIS offer's components. Same
   * interrogative/imperative shape gate as benefits-overview so bare
   * declaratives ("the variable was 12% last year") don't trip. */
  const hasCompWord =
    /\bvariable\s+(?:components?|pay|comp(?:ensation)?)\b/i.test(a) ||
    /\bbonus(?:es)?\b/i.test(a) ||
    /\bESOPs?\b/i.test(a) ||
    /\bstock\s+options?\b/i.test(a) ||
    /\bRSUs?\b/i.test(a) ||
    /\bequity\b/i.test(a) ||
    /\bOTE\b/i.test(a) ||
    /on[-\s]target\s+earnings/i.test(a) ||
    /performance\s+bonus/i.test(a) ||
    /\bcommission\b/i.test(a);
  if (hasCompWord && (endsWithQuestion || imperativeCue || questionLead)) {
    out.push("compensation-breakdown");
  }

  /* Session B (2026-05-14) — notice-period info ask. Anchored to
   * interrogative shapes around notice / start-date / joining-date /
   * buyout so declarative "I have a 60-day notice" doesn't trip. */
  const noticeAskPatterns = [
    /\bnotice\s+period\s*\?/i,
    /\b(?:what(?:'s|\s+is)|how\s+long\s+is)\s+(?:the\s+)?(?:notice|notice\s+period)\b/i,
    /\b(?:when|how\s+soon)\s+can\s+i\s+(?:join|start)\b/i,
    /\b(?:earliest|expected)\s+(?:start\s+date|joining\s+date)\s*\??/i,
    /\bjoining\s+date\s*\?/i,
    /\bstart\s+date\s*\?/i,
    /\bbuyout\s*\?/i,
    /\b(?:do\s+you|will\s+you|can\s+you)\s+(?:offer|cover|do)\s+(?:a\s+)?buy[-\s]?out\b/i,
    /\bbuy[-\s]?out\s+option\b/i,
  ];
  if (noticeAskPatterns.some((p) => p.test(a))) out.push("notice-period-ask");

  /* Session B (2026-05-14) — hike-percentage info ask. The candidate
   * is asking what hike% the offer represents vs their current CTC.
   * Anchored to interrogative shape so declarative "I want a 30% hike"
   * doesn't fire. */
  const hikeDeclarativeGuard = /\b(?:i\s+want|i.?m\s+asking|i\s+expect|i\s+need|i.?d\s+like|i\s+am\s+looking\s+for|expecting)\b/i.test(a);
  const hikeAskPatterns = [
    /\b(?:what(?:'s|\s+is)?|how\s+much)\s+(?:(?:the|a)\s+)?(?:hike|raise|increment|bump)\b/i,
    /\bhike\s*%/i,
    /(?:^|\s)%\s+(?:hike|raise|increment)\s*\?/i,
    /\b(?:is\s+this|will\s+this\s+be)\s+(?:a\s+)?\d{1,3}\s*%\s+(?:hike|raise|increment|bump)\b/i,
    /\bhike\s+(?:from|on)\s+(?:my\s+)?current\b/i,
    /\bwhat\s+hike\s+is\s+this\b/i,
  ];
  if (!hikeDeclarativeGuard && hikeAskPatterns.some((p) => p.test(a))) out.push("hike-percentage-ask");

  return out;
}

/* ─── Input-sanity bounds (launch-blocker, 2026-05-14) ──────────────
 *
 * The kernel previously accepted any number the parsers extracted —
 * including absurd values like "₹50,000 crore" from STT mishears or
 * scripted abuse. That number then propagated into hike-% math, band-
 * comparison branches, and telemetry. The clamping helpers below pin
 * each numeric input to a plausible upper bound and reject negative /
 * NaN / Infinity. Out-of-bounds values become null — which is the
 * "not-stated" sentinel the rest of the kernel already handles. */

/** Hard ceiling on INR LPA values. 5000 LPA = ₹50 Cr per annum, which
 *  is well above any real Indian comp number (top-of-market C-suite
 *  TC is ~₹15-25 Cr including equity). Anything above this is a
 *  parser / STT artefact. */
export const MAX_INR_LPA = 5000;

/** Hard ceiling on notice-period days. 365 days = 1 year, which is
 *  the longest realistic notice (some senior overseas contracts).
 *  Anything above is a parser artefact. */
export const MAX_NOTICE_DAYS = 365;

/** Hard ceiling on career-gap months. 60 months = 5 years, which is
 *  the soft outer bound already enforced by extractGapMonths. We add
 *  a defensive clamp here so out-of-band values from any source get
 *  rejected. */
export const MAX_GAP_MONTHS = 60;

/** Clamp an INR LPA-denominated number to [0, MAX_INR_LPA]. Returns
 *  null for negative, NaN, ±Infinity, or > MAX_INR_LPA. Zero is
 *  accepted (a candidate stating "current package zero" / fresher
 *  with no prior salary is structurally valid). */
export function clampInr(v: number | null): number | null {
  if (v == null) return null;
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v)) return null;
  if (v < 0) return null;
  if (v > MAX_INR_LPA) return null;
  return v;
}

/** Clamp notice-period days to (0, MAX_NOTICE_DAYS]. Zero is
 *  rejected (candidate states "no notice" via other signals, not 0
 *  days). Negative / NaN / ±Infinity / overflow → null. */
export function clampNoticeDays(v: number | null): number | null {
  if (v == null) return null;
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v)) return null;
  if (v <= 0) return null;
  if (v > MAX_NOTICE_DAYS) return null;
  return v;
}

/** Clamp career-gap months to (0, MAX_GAP_MONTHS]. Same rules as
 *  clampNoticeDays — zero is rejected (no gap means null, not 0). */
export function clampGapMonths(v: number | null): number | null {
  if (v == null) return null;
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v)) return null;
  if (v <= 0) return null;
  if (v > MAX_GAP_MONTHS) return null;
  return v;
}

/* Phase param is optional and only used to widen target-binding when
 * the recruiter just asked for expectations. The Tech-Mahindra UX
 * session (May 2026) had the candidate reply "30 lpa thirty lakhs
 * per ctc" — bare number, no "looking for / want / expecting"
 * trigger — and the kernel left target = null, so the AI kept
 * probing instead of countering. When `phase === "probe-expectations"`
 * a bare "<n> LPA / lakhs" is accepted as the target (still gated
 * by the current/competing disambiguator). */
export function parseCandidateAnswer(
  answer: string,
  lastAiText = "",
  phase?: NegotiationPhase,
  /** Whether an offer has been quoted by the bot. When known and
   *  false, the acceptance classifier vetoes commitment idioms
   *  ("sounds good") that lack an offer reference — you can't
   *  accept what hasn't been offered. Default undefined preserves
   *  back-compat for callers that don't have state context. */
  offerOnTable?: boolean,
  /** Phase 3 missing-lever set (2026-05-17) — current state.turnIndex.
   *  Threaded through to extractCandidateStance to stamp
   *  stallSignal.statedAt at the candidate-turn index of first
   *  detection. Default 0 preserves back-compat with callers that
   *  don't have state context (unit-test fixtures). */
  turnIndex: number = 0,
  /** PDF#29 Bug 1 (2026-05-18) — prior-state total CTC. When supplied
   *  AND the candidate names a single-sided absolute split this turn,
   *  the component-breakdown parser derives the complement (variable =
   *  total − base, or base = total − variable). Optional to preserve
   *  back-compat for callers that don't have state context. */
  priorTotalCtc: number | null = null,
  /** finding #110 (2026-06-20) — the company we're hiring for
   *  (state.company). Threaded to extractCompetingOfferDetail so the
   *  hiring company is never mis-read as a competing offer ("for this
   *  role at Flipkart, I'm targeting 65" must not register Flipkart as a
   *  rival). Optional to preserve back-compat for fixture callers. */
  hiringCompany: string | null = null,
  /** §11 (2026-07-08) — the numeric standing offer (state.highestOfferMade).
   *  Threaded to classifyAcceptance so an accept frame naming a number at or
   *  below the offer ("I'll take 40", "happy with 38") is read as acceptance,
   *  not a self-defeating upward counter. Optional to preserve back-compat for
   *  fixture callers that don't have state context. */
  offerLpa: number | null = null,
): ParsedAnswer {
  /* STT fragility audit (2026-05-22) — kernel-boundary normalization.
   *
   * Follow-up to f5289f3 (LPA→LPE STT mishear fix). That commit landed
   * inline fixes in two parsers; this routes ALL downstream parsers
   * through a single normalizer at the candidate-turn entry boundary.
   * `normalizeForParsing` is a superset of the legacy
   * `substituteHinglishNumbers` (which it absorbs) plus English
   * number-words, unit-typo fixups (LPE/lacks/krore/rupies), letter-
   * spelled "L P A", and decimal-point folding. Every extractor below
   * (`extractComponentBreakdown`, `extractHikeRationale`,
   * `extractNoticeJoining`, `extractEquityVesting`,
   * `extractLocationMode`, `extractCompetingOfferDetail`,
   * `extractDecisionDeadline`, `extractCandidateProfile`,
   * `extractMiscSignals`, `extractCandidateStance`,
   * `extractRetentionCounter`, `classifyAcceptance`,
   * `classifyNumberRoles`) sees the normalized string. */
  const a = normalizeForParsing((answer || "").trim());
  if (!a) {
    return {
      target: null, currentCtc: null, competing: null,
      signalsAcceptance: false, signalsWalkAway: false,
      targetAsRange: false, targetComponent: null, vossTactics: [], infoAsked: [],
      signalsCompetingExistsWithoutNumber: false,
      componentBreakdown: { base: null, variable: null, equity: null, hasAny: false },
      rationale: null,
      noticeJoining: { noticePeriodDays: null, buyoutRequested: false, joiningBonusAsk: null, earlyJoinPreferred: false, joiningBonusClawbackDiscussed: false, lastWorkingDayText: null, hasAny: false },
      equityVesting: { vestingYears: null, cliffMonths: null, preference: null, familiarity: null, strikePriceDiscussed: false, valuationDiscussed: false, liquidityDiscussed: false, equityExists: null, hasAny: false },
      locationMode: { workMode: null, locationCity: null, relocationRequested: false, relocationRefused: false, hasAny: false },
      competingOfferDetail: { company: null, status: null, stage: null, amount: null, letterShareOffered: false, onHold: false, proofRequestedAtTurn: null, proofProvided: false, hasAny: false },
      decisionDeadline: { deadlineDays: null, deadlineExplicit: false, conditionalAcceptance: false, conditionalEvidence: null, requestsHold: false, hasAny: false },
      candidateProfile: { ...EMPTY_CANDIDATE_PROFILE },
      miscSignals: { candidateFloor: null, salaryReviewMonths: null, proofOfCtcShareable: null, internalCounterRisk: null, hasAny: false },
      candidateStance: { flexibilityPosture: null, marketReferenceVague: false, salaryOnlyFactor: false, badmouthsCurrent: false, confidentialOvershare: false, soundsDesperate: false, treatsEquityAsCash: false, avoidsAnchor: false, personalExpenseJustification: false, offerShoppingDemand: false, dismissesVariableRisk: false, overpromisesJoining: false, hasAny: false },
      retentionCounter: { ...EMPTY_RETENTION_COUNTER },
    };
  }

  /* Acceptance detection is delegated to the unified
   * `_acceptance-classifier` module (Phase 9, 2026-05-13). The legacy
   * inline regex bank that lived here was duplicated in
   * `interviewEvaluation.extractNegotiationFacts.acceptedImmediately`
   * and the two paths drifted across sessions — each fix had to land
   * twice. The classifier is the single source of truth for both
   * detectors, and adds a structural phase gate that pure regex can't
   * express ("you can't accept what hasn't been offered"). The
   * walk-away signal is still computed locally because the kernel
   * exposes it as an independent ParsedAnswer field, and the legacy
   * extractor needs a paired walk-away check on the same axis. */
  const acceptanceResult = classifyAcceptance(a, {
    phase,
    offerOnTable,
    offerLpa: offerLpa != null && offerLpa > 0 ? offerLpa : undefined,
  });
  const signalsAcceptance = acceptanceResult.accepted;
  const signalsWalkAway = isWalkAway(a);

  /* Architectural refactor (PDF#30, 2026-05-18) — number-role classification.
   *
   * Five PDFs in a row surfaced parser misses where a candidate's
   * disclosure was dropped on the floor and the bot looped. Each fix
   * added a regex alternative to a 60+-alt bank in this function;
   * eventually the bank became impossible to reason about (alt-N
   * shadowing alt-N+1, role cues interleaved across patterns).
   *
   * That entire bank is now replaced by `classifyNumberRoles`
   * (`_number-role-classifier.ts`):
   *
   *   - One token-finder for salary numbers (LPA / USD / range upper).
   *   - Three small cue tables (current / target / competing) — adding
   *     a phrasing means appending one row to the matching table.
   *   - One scoring function that picks the role per number span.
   *   - Sentence-level defaults when no cue fires (Gricean cooperation
   *     when AI just asked for CTC; phase-aware bare number when in
   *     probe-expectations).
   *
   * The 200 lines this block used to occupy now live in a 350-line
   * module with explicit precedence, a single decision point, and a
   * table-driven test surface. */
  const roles = classifyNumberRoles(a, { lastAiText, phase, currentCtc: priorTotalCtc });
  const currentCtc = roles.currentCtc;
  const competing = roles.competing;
  const target = roles.target;
  const targetAsRange = roles.targetAsRange;
  const targetComponent = roles.targetComponent;

  /* Competing-without-number: candidate has signaled competing exists
     but refuses or omits to share magnitude.
     F8 (PDF#20 2026-05-15) — expanded pattern set.  Added:
       "another opportunity", "another offer", "evaluating other roles/
       companies/options", "in process with", "in talks with",
       "interviewing with/at/elsewhere", "offer on the table",
       "multiple offers". */
  const competingMentionPat = /\b(competing\s+offer|another\s+offer|another\s+opportunity|other\s+offers?|offer\s+in\s+hand|offer\s+on\s+the\s+table|other\s+companies|other\s+roles?|other\s+options?|other\s+conversations|elsewhere|in\s+the\s+market|evaluating\s+other|in\s+process\s+with|in\s+talks\s+with|interviewing\s+with|interviewing\s+at|interviewing\s+elsewhere|multiple\s+offers?)\b/i;
  const hedgePat = /\b(can.?t\s+share|prefer\s+not|nda|confidential|not\s+at\s+liberty|won.?t\s+disclose|details\s+(?:are\s+)?confidential)\b/i;
  const signalsCompetingExistsWithoutNumber =
    competing == null && competingMentionPat.test(a) && (hedgePat.test(a) || !/[\d]/.test(a));

  const vossTactics = detectVossTactics(a, lastAiText);
  const infoAsked = detectInfoIntents(a);
  /* PDF#29 Bug 1 (2026-05-18) — pass total CTC so a single-sided
   * absolute-rupee split ("₹12 LPA fixed" with known currentCtc=18)
   * can derive the complement. Prefer the freshly-parsed currentCtc
   * from THIS turn (if any) over the stale state field so a turn that
   * names both total + split satisfies fixedVariableSplitHasBoth in
   * one shot. */
  /* PDF#29 Bug 1 (2026-05-18) — total source preference. The prior state
   * total wins over a same-turn freshly-parsed currentCtc, because the
   * fresh parse can mis-bind a single component value (e.g. the "12" in
   * "₹12 LPA fixed" is the FIXED component, not the total) and that
   * would force the complement gate to compute complement=0. The stale
   * state value (set in an earlier discovery turn) is the trustworthy
   * total here. Falls back to fresh currentCtc only when no prior is
   * recorded. */
  const totalForSplitComplement =
    (priorTotalCtc != null && priorTotalCtc > 0 ? priorTotalCtc : null) ??
    (typeof currentCtc === "number" && currentCtc > 0 ? currentCtc : null);
  /* Audit Fix (2026-05-19) — Mask target-context clauses before
   * feeding the disclosed-breakdown parser. Target utterances
   * ("my target is ₹26 LPA fixed at minimum") describe what the
   * candidate WANTS, not what they're CURRENTLY paid; without this
   * mask the breakdown parser would update candidateComponentBreakdown
   * .base = 26 even though the candidate's actual current fixed is
   * unchanged (e.g. 18 from an earlier disclosure). The masker
   * replaces target clauses with whitespace of the same length so all
   * regex offsets remain stable and only DISCLOSURE-context language
   * reaches extractComponentBreakdown. */
  const breakdownInput = maskTargetClauses(a);
  const componentBreakdown = extractComponentBreakdown(breakdownInput, totalForSplitComplement);
  /* Phases 11/13/14/15/16 parsers — each returns a structured record
   * with `hasAny` (or null for the rationale singleton). They run
   * over the SAME normalized text so a single utterance "I'm in
   * Bangalore, 90-day notice, market is 32 LPA for my YOE" populates
   * location + notice + rationale in one pass. */
  const hikeRationale = extractHikeRationale(a, target, currentCtc);
  const noticeJoining = extractNoticeJoining(a);
  const equityVesting = extractEquityVesting(a);
  const locationMode = extractLocationMode(a);
  const competingOfferDetail = extractCompetingOfferDetail(a, hiringCompany);
  const decisionDeadline = extractDecisionDeadline(a);
  const candidateProfile = extractCandidateProfile(a);
  const miscSignals = extractMiscSignals(a);
  const candidateStance = extractCandidateStance(a, turnIndex);
  const retentionCounter = extractRetentionCounter(a);

  /* Phase 17A — when a conditional acceptance fires, the legacy
   * `signalsAcceptance` boolean must be downgraded. A conditional
   * commit is not an unconditional accept; the AI should respond to
   * the CONDITION, not close the deal. The classifier already requires
   * an "if X" clause to fire conditional, so this is structural:
   * conditional ⇒ NOT accepted. */
  const signalsAcceptanceFinal =
    signalsAcceptance && !decisionDeadline.conditionalAcceptance;

  /* Input-sanity clamps — out-of-bound numeric values become null at
   * the parse boundary so they never leak into hike-% math, band
   * comparisons, or telemetry. See clampInr / clampNoticeDays /
   * clampGapMonths above for the policy. */
  const sanitizedNoticeJoining = {
    ...noticeJoining,
    noticePeriodDays: clampNoticeDays(noticeJoining.noticePeriodDays),
    joiningBonusAsk: clampInr(noticeJoining.joiningBonusAsk),
  };
  const sanitizedCandidateProfile = {
    ...candidateProfile,
    careerGapMonths: clampGapMonths(candidateProfile.careerGapMonths),
  };

  return {
    target: clampInr(target),
    currentCtc: clampInr(currentCtc),
    competing: clampInr(competing),
    signalsAcceptance: signalsAcceptanceFinal, signalsWalkAway,
    targetAsRange, targetComponent, vossTactics, infoAsked,
    signalsCompetingExistsWithoutNumber,
    componentBreakdown,
    rationale: hikeRationale.rationale,
    noticeJoining: sanitizedNoticeJoining,
    equityVesting,
    locationMode,
    competingOfferDetail,
    decisionDeadline,
    candidateProfile: sanitizedCandidateProfile,
    miscSignals,
    candidateStance,
    retentionCounter,
  };
}

/* 2026-05-29 mood-shift-pass — recruiter mood transition helper.
 *
 * Real recruiters' mood SHIFTS during a call:
 *   - Cool: visibly colder when the candidate pushes hard. Triggers:
 *       1. 3+ consecutive over-band asks (candidate keeps asking
 *          beyond maxStretch), OR
 *       2. explicit pushback at counter-offer phase (user rejects
 *          the recruiter's latest move at counter-offer), OR
 *       3. detected user-confrontation phrases ("that's ridiculous",
 *          "you're lowballing", "you're joking", "this is a joke")
 *   - Rewarm: re-warm when the candidate concedes after being cooled.
 *       1. Drop in their ask by ≥10%, OR
 *       2. explicit acceptance phrases ("ok that works", "fair enough",
 *          "that's fair", "deal", "sounds reasonable")
 *
 * Cool persists for up to MOOD_COOLED_TTL turns or until a rewarm
 * trigger fires; after TTL expires it auto-resets to baseline (the
 * recruiter eventually settles back, not into rewarm — rewarm is a
 * positive response to candidate concession, not a passive decay).
 *
 * The function mutates `n` in place (consistent with the
 * applyCandidateAnswer pattern of folding facts onto `next`). */
export const MOOD_COOLED_TTL = 4;
export const CONFRONTATION_RE =
  /\b(?:that'?s\s+ridiculous|you'?re\s+lowballing|low[\s-]?balling|you'?re\s+joking|this\s+is\s+(?:a\s+)?joke|that'?s\s+(?:a\s+)?joke|insulting|disrespectful|waste\s+of\s+(?:my\s+)?time|are\s+you\s+serious)\b/i;
export const ACCEPTANCE_SOFT_RE =
  /\b(?:ok(?:ay)?\s+(?:that\s+)?works|fair\s+enough|that'?s\s+fair|sounds\s+reasonable|sounds\s+fair|that\s+works\s+for\s+me|deal|i\s+can\s+(?:work\s+with|live\s+with)\s+that)\b/i;

export const COUNTER_PUSHBACK_RE =
  /\b(?:not\s+enough|too\s+low|need\s+more|come\s+up|won'?t\s+work|can'?t\s+accept|push\s+(?:the\s+)?(?:band|range|number|offer)|stretch\s+(?:more|further)|i'?ll\s+pass)\b/i;

/* FNV-1a 32-bit — local copy to avoid importing _session-jitter or
 * _recruiter-prose-realism (kernel module is the dependency root). */
export function fnv1a32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* Affinity-dynamic feature (2026-05-29) — pattern-match candidate
 * utterance for rapport / respect / abrasion / transparency / value-
 * prop / evasion / stalling signals. Updates state.recruiterAffinity
 * (clamped to [-3, +3]) and appends to state.affinityLedger.
 *
 * Per-turn delta cap: ±2. Cumulative cap: [-3, +3].
 *
 * Pure / deterministic; no I/O. Called from finalize() in
 * applyCandidateAnswer AFTER applyMoodShift so the mood-shift can read
 * the prior affinity (we order detection AFTER mood-shift so the next
 * planner call sees the freshly-updated affinity, but the CURRENT
 * mood-shift reads pre.recruiterAffinity — see applyMoodShift). */
export const AFFINITY_PER_TURN_CAP = 2;
export const AFFINITY_MIN = -3;
export const AFFINITY_MAX = 3;

export const TRANSPARENCY_RE =
  /\b(?:to be honest|honestly|let me be (?:upfront|honest|straight)|upfront|frankly|to be (?:upfront|frank|candid)|i'?ll be honest|i'?ll be upfront|i'?ll level with you)\b/i;
export const VALUE_PROP_NUM_RE =
  /\b(?:led|drove|delivered|grew|scaled|took|increased|reduced|cut|saved|generated|owned)\b[^.!?]{0,80}(?:\d+|\$\d|₹\d|\bcrore\b|\blakh\b|\bmillion\b|\bbillion\b|%)/i;
export const ABRASIVE_RE =
  /\b(?:you don'?t get it|that'?s ridiculous|lowballing|lowball|you'?re wasting|stop wasting|insulting|joke|are you serious|ridiculous offer|cheap|stingy|shut up|nonsense|garbage|bullshit|bs\b)\b/i;
/* "Evasion" — uses a 3-turn-running heuristic. We approximate by counting
 * "i don't want to share / not comfortable / let's skip / pass on that"
 * style cues. */
export const EVASION_RE =
  /\b(?:i (?:don'?t|do not) want to (?:share|disclose|say)|not (?:comfortable|sure i want)|let'?s skip|pass on that|rather not say|prefer not to|that'?s personal|move on|next question)\b/i;

export function detectAffinitySignals(
  answer: string,
  pre: NegotiationState,
): { deltas: Array<{ delta: number; reason: AffinityReason }>; totalCap: number } {
  const out: Array<{ delta: number; reason: AffinityReason }> = [];
  const a = answer || "";
  if (!a.trim()) return { deltas: out, totalCap: AFFINITY_PER_TURN_CAP };

  /* Respect-marker — name use + thanks/appreciate. We split the test so
   * the gratitude keyword matches case-insensitively but the proper-noun
   * (candidate addressing recruiter by name) is recognised as a capital-
   * starting word in the original casing. */
  const thanksHit = /\b(?:thanks?|thank you|appreciate|appreciated|cheers)\b/i.test(a);
  const nameHit = /\b[A-Z][a-z]{2,}\b/.test(a);
  if (thanksHit && nameHit) {
    out.push({ delta: 1, reason: "respect-marker" });
  }

  /* Rapport-signal — mirror phrasing. Light heuristic: the candidate
   * echoes a recruiter-introduced noun phrase from the prior AI turn.
   * Look at pre.lastAiText for shared 2-3-word phrases. */
  const lastAi = (pre.lastAiText || "").toLowerCase();
  if (lastAi.length > 0) {
    const candidateLower = a.toLowerCase();
    /* Pull candidate ≥6-char noun-ish tokens from lastAi (fitment, joining
     * bonus, comp committee, variable, hike, band, etc.) */
    const MIRROR_VOCAB =
      /(fitment|joining bonus|comp committee|comp-committee|variable|stretch|band|esop|grade|hike|equity|cliff|notice period|in[- ]hand|loop|grade fitment)/g;
    let matched = false;
    let m: RegExpExecArray | null;
    while ((m = MIRROR_VOCAB.exec(lastAi)) !== null) {
      if (candidateLower.includes(m[1])) {
        matched = true;
        break;
      }
    }
    if (matched) {
      out.push({ delta: 1, reason: "rapport-signal" });
    }
  }

  /* Transparency cues. */
  if (TRANSPARENCY_RE.test(a)) {
    out.push({ delta: 1, reason: "transparency" });
  }

  /* Value-prop signal — impact + numbers. */
  if (VALUE_PROP_NUM_RE.test(a)) {
    out.push({ delta: 1, reason: "value-prop-signal" });
  }

  /* Abrasive — bigger negative weight. */
  if (ABRASIVE_RE.test(a)) {
    out.push({ delta: -2, reason: "abrasive-tone" });
  }

  /* Evasion — single-turn heuristic. */
  if (EVASION_RE.test(a)) {
    out.push({ delta: -1, reason: "evasion" });
  }

  /* Wasted-time — repeats prior turn's content nearly verbatim. */
  const log = pre.conversationLog ?? [];
  let lastUser: string | null = null;
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (e?.speaker === "candidate" && typeof e.text === "string" && e.text.trim()) {
      lastUser = e.text.trim().toLowerCase();
      break;
    }
  }
  if (lastUser) {
    const curr = a.trim().toLowerCase();
    if (curr.length >= 10) {
      const overlap = lastUser === curr ||
        (curr.length >= 0.7 * lastUser.length &&
          (lastUser.includes(curr.slice(0, Math.max(15, Math.floor(curr.length * 0.6))))));
      if (overlap) {
        out.push({ delta: -1, reason: "wasted-time" });
      }
    }
  }

  return { deltas: out, totalCap: AFFINITY_PER_TURN_CAP };
}

export function applyAffinitySignals(
  n: NegotiationState,
  pre: NegotiationState,
  answer: string,
): void {
  const turn = n.turnIndex;
  const { deltas } = detectAffinitySignals(answer, pre);
  if (deltas.length === 0) return;

  /* Cap the per-turn aggregate delta. Apply caps separately to positive
   * and negative sums so a single abrasive (-2) plus a respect (+1) lands
   * at -1, not capped. We want: net = clamp(sum, -2, +2). */
  let posSum = 0;
  let negSum = 0;
  for (const d of deltas) {
    if (d.delta > 0) posSum += d.delta;
    else if (d.delta < 0) negSum += d.delta;
  }
  if (posSum > AFFINITY_PER_TURN_CAP) posSum = AFFINITY_PER_TURN_CAP;
  if (negSum < -AFFINITY_PER_TURN_CAP) negSum = -AFFINITY_PER_TURN_CAP;
  const net = posSum + negSum;
  if (net === 0) return;

  const prevAffinity = pre.recruiterAffinity ?? 0;
  let nextAffinity = prevAffinity + net;
  if (nextAffinity > AFFINITY_MAX) nextAffinity = AFFINITY_MAX;
  if (nextAffinity < AFFINITY_MIN) nextAffinity = AFFINITY_MIN;
  n.recruiterAffinity = nextAffinity;

  /* Append to ledger — record each detected reason (use net delta on the
   * first dominant reason to keep ledger compact). Append all individual
   * detections so analyzers can see what fired. */
  const ledger = [...(pre.affinityLedger ?? [])];
  /* Compose effective applied delta proportional to net direction; emit
   * one entry per detected reason. We DON'T re-clamp inside the entries —
   * the cumulative state tracks the truth; the ledger is per-detection. */
  for (const d of deltas) {
    ledger.push({ turn, delta: d.delta, reason: d.reason });
  }
  n.affinityLedger = ledger;
}

export function applyMoodShift(
  n: NegotiationState,
  pre: NegotiationState,
  parsed: { target?: number | null },
  answer: string,
): void {
  const ans = (answer || "").toLowerCase();
  const turn = n.turnIndex;
  const band = n.band;
  const prevDynamic: RecruiterMoodDynamic = pre.recruiterMoodDynamic ?? "baseline";

  /* Track peak candidate ask across the session — used by concession
   * detection. Capture BEFORE we evaluate concession so a fresh higher
   * ask updates the peak first; concession compares the CURRENT ask
   * against the PRIOR peak. */
  const priorPeak = pre.recruiterMoodPeakCandidateAskLpa ?? null;
  const currentTarget = (parsed as { target?: number | null }).target ?? null;

  /* ---------- 1. Over-band streak counter ---------- */
  let overBandStreak = pre.consecutiveOverBandAsks ?? 0;
  if (currentTarget != null && band && typeof band.maxStretch === "number") {
    if (currentTarget > band.maxStretch + 0.01) {
      overBandStreak += 1;
    } else {
      /* Within-band ask resets the streak. */
      overBandStreak = 0;
    }
  }
  n.consecutiveOverBandAsks = overBandStreak;

  /* ---------- 2. Detect cool / rewarm trigger signals ---------- */
  const confrontation = CONFRONTATION_RE.test(ans);
  const softAccept = ACCEPTANCE_SOFT_RE.test(ans);
  const rejectedAtCounter =
    pre.phase === "counter-offer" && COUNTER_PUSHBACK_RE.test(ans);
  const overBandPush = overBandStreak >= 3;

  /* Concession: candidate's new target is ≥10% below their prior peak. */
  let concession = false;
  if (currentTarget != null && priorPeak != null && priorPeak > 0) {
    concession = currentTarget <= priorPeak * 0.9;
  }

  /* Update peak AFTER concession check so the next turn compares
   * against the updated peak. */
  let newPeak = priorPeak;
  if (currentTarget != null) {
    newPeak = priorPeak == null ? currentTarget : Math.max(priorPeak, currentTarget);
  }
  n.recruiterMoodPeakCandidateAskLpa = newPeak;

  /* ---------- 3. Transition decisions ---------- */
  let nextDynamic: RecruiterMoodDynamic = prevDynamic;
  let enteredAt = pre.recruiterMoodDynamicEnteredAtTurn ?? null;

  /* Rewarm wins over cool when both fire on the same turn — a
   * concession after being cooled IS the recovery signal even if the
   * same utterance happens to be over-band. Rewarm is gated on the
   * recruiter having BEEN cooled this session. */
  const wasCooled = prevDynamic === "cooled";
  const canRewarm = wasCooled && (concession || softAccept);
  let canCool =
    !canRewarm &&
    (confrontation || overBandPush || rejectedAtCounter);

  /* Affinity-dynamic feature (2026-05-29) — affinity ≥ +2 halves the
   * probability of cooling; affinity ≤ -2 boosts it by ~50%. Deterministic
   * FNV gate keyed on (sessionId, turnIndex). When canCool is already
   * false we don't suppress to true (negative affinity doesn't manufacture
   * confrontation that wasn't there); we only modulate the existing
   * candidate-side trigger. */
  const affinity = pre.recruiterAffinity ?? 0;
  if (canCool && pre.sessionId) {
    const hashSeed = `affinity-cool|${pre.sessionId}|${turn}`;
    const u = fnv1a32(hashSeed) / 0x100000000;
    if (affinity >= 2) {
      /* 50% suppression of the cool trigger. */
      if (u < 0.5) canCool = false;
    } else if (affinity <= -2) {
      /* Already-cooling: leave as is (no further amplification needed).
       * Boost mode is also fold into rewarm gating below: shorter rewarm
       * window. Nothing additional here. */
    }
  }

  /* 2026-05-30 time-context cool-bumper — Friday-rush and after-hours-
   * tired recruiters get terser more readily. When canCool is already
   * triggered, leave alone (already cooling). When canCool is false but
   * we're in a time-context that drains energy/time AND there's some
   * negative signal this turn (overBandStreak ≥ 2 OR confrontation OR
   * rejectedAtCounter), flip canCool with ~30% probability. Deterministic
   * FNV gate keyed on (sessionId, turnIndex, time-context). */
  const tCtx = pre.timeContext ?? "midweek-standard";
  if (
    !canCool &&
    pre.sessionId &&
    (tCtx === "friday-rush" || tCtx === "after-hours-tired") &&
    (overBandStreak >= 2 || confrontation || rejectedAtCounter)
  ) {
    const hashSeed = `time-cool-bump|${pre.sessionId}|${turn}|${tCtx}`;
    const u = fnv1a32(hashSeed) / 0x100000000;
    if (u < 0.3) canCool = true;
  }

  if (!canCool && affinity <= -2 && pre.sessionId &&
             (overBandStreak >= 2 || ans.length > 0)) {
    /* Negative affinity: when over-band streak hits 2 (one shy of the
     * baseline 3-streak trigger), a deterministic ~50% gate trips cool
     * early. This implements the "+50% probability" half of the spec
     * symmetrically with the positive-affinity suppression. */
    if (overBandStreak >= 2) {
      const hashSeed = `affinity-cool-boost|${pre.sessionId}|${turn}`;
      const u = fnv1a32(hashSeed) / 0x100000000;
      if (u < 0.5) canCool = true;
    }
  }

  if (canRewarm) {
    nextDynamic = "rewarmed";
    enteredAt = turn;
  } else if (canCool) {
    /* Re-cool resets the entered-at timestamp so the TTL window
     * restarts. */
    nextDynamic = "cooled";
    enteredAt = turn;
  } else if (prevDynamic === "cooled" && enteredAt != null && (turn - enteredAt) > MOOD_COOLED_TTL) {
    /* TTL expiry → settle back to baseline (NOT rewarmed, since the
     * candidate never gave us a positive signal). */
    nextDynamic = "baseline";
    enteredAt = null;
  }

  n.recruiterMoodDynamic = nextDynamic;
  n.recruiterMoodDynamicEnteredAtTurn = enteredAt;

  /* ---------- 4. Cold-line / rewarm-line single-fire latch ----------
   * The prose layer (`humanizeRecruiterProse`) appends ONE cold line when
   * the recruiter is `cooled` and ONE rewarm prefix when `rewarmed`. Both
   * are deterministic given their gate, so the kernel — which runs BEFORE
   * the prose for this turn — stamps the firing turn the FIRST turn of each
   * episode. The prose then fires iff the latch is null OR equals the
   * current turn (see `coldLineAlreadyFired` / `rewarmLineAlreadyFired`
   * wiring in the planner and canonical-prose). Leaving the state clears
   * the latch so a LATER cooling/rewarming episode re-fires exactly once.
   *
   * Without this, the latch field stayed null forever and the cold line
   * re-fired on every consecutive cooled turn — the "Look, I've given you
   * my best — if this doesn't work for you, I understand." tail repeated
   * verbatim on turns 5/6/7 (live staging, 2026-06-20). Re-cool resets
   * `enteredAt` every turn the candidate keeps confronting, so an
   * entered-this-turn gate was insufficient; a sticky per-episode latch is
   * the structural fix. */
  let coldFiredAt = pre.recruiterMoodColdLineFiredAtTurn ?? null;
  if (nextDynamic === "cooled") {
    if (coldFiredAt == null) coldFiredAt = turn;
  } else {
    coldFiredAt = null;
  }
  n.recruiterMoodColdLineFiredAtTurn = coldFiredAt;

  let rewarmFiredAt = pre.recruiterMoodRewarmLineFiredAtTurn ?? null;
  if (nextDynamic === "rewarmed") {
    if (rewarmFiredAt == null) rewarmFiredAt = turn;
  } else {
    rewarmFiredAt = null;
  }
  n.recruiterMoodRewarmLineFiredAtTurn = rewarmFiredAt;
}
