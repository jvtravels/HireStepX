/* HireStepX — Salary Negotiation Canonical State Kernel
 * ─────────────────────────────────────────────────────────────────────
 * The static 7-anchor script + regex transcript re-parsing + LLM echo
 * guards + post-hoc clamp layers — the legacy architecture — have
 * produced the same bug class over and over: state drift between the
 * three subsystems (script slot index, regex-extracted "current facts",
 * LLM-generated text). Every patch is a regex addition or guard
 * tightening that closes one crack and opens another.
 *
 * This module is the replacement: a single, authoritative
 * NegotiationState that the engine owns and mutates ONLY through
 * pure transition functions defined here. The LLM is downstream — it
 * receives state, returns text, and never sets state. Facts are folded
 * into state ONCE per turn (when the candidate's answer arrives), not
 * re-parsed every render.
 *
 * Design rules:
 *   1. State is the source of truth. The transcript is a render artefact.
 *   2. Transitions are pure functions. No LLM, no IO, no clock — all
 *      injected if needed. Same input → same output, always.
 *   3. Terminal phases are sticky. accepted / walked-away / stalemate
 *      never transition back.
 *   4. Numbers come from `band` and `state.highestOfferMade`. The LLM
 *      cannot invent a counter — its text is post-validated against
 *      the AiMove returned by pickAiMove(state).
 *   5. Backwards compatibility: this module is unused at runtime until
 *      a route handler (Ship 2) and the engine flag (Ship 3) are wired.
 *      Ship 1 establishes the data model only — tests cover transitions
 *      end-to-end without touching production code paths.
 *
 * Naming note: the existing `_negotiation-state.ts` covers a narrower
 * concern (per-turn intent classification — accepted/rejected/walking/
 * deflected). This kernel is the canonical session-long state object;
 * the intent classifier feeds into it. Keeping them separate so the
 * intent regexes stay reviewable in isolation.
 */

import type { NegotiationFacts } from "../src/interviewEvaluation";

/* ─── Phases ──────────────────────────────────────────────────────── */

export type NegotiationPhase =
  /* Pre-offer — AI hasn't put a number on the table yet. */
  | "opening"
  /* AI has presented the initial offer; candidate is reacting. */
  | "offer-presented"
  /* AI is probing candidate's target / reasoning. */
  | "probe-expectations"
  /* Candidate has anchored; AI is countering with cash levers. */
  | "counter-offer"
  /* Multiple rounds of counter exhausted base; exploring non-cash. */
  | "lever-explore"
  /* AI is pushing for close ("I need to know today"). */
  | "closing-push"
  /* Terminal — candidate accepted the offer. */
  | "accepted"
  /* Terminal — candidate walked away / rejected. */
  | "walked-away"
  /* Terminal — turn budget exhausted without resolution. */
  | "stalemate";

const TERMINAL_PHASES = new Set<NegotiationPhase>([
  "accepted",
  "walked-away",
  "stalemate",
]);
export const isTerminalPhase = (p: NegotiationPhase): boolean => TERMINAL_PHASES.has(p);

/* ─── Levers ─────────────────────────────────────────────────────── */

export type NegotiationLever =
  | "open-with-offer"   // initial offer presentation
  | "probe"             // ask what they want
  | "counter-base"      // bump base
  | "joining-bonus"     // one-time
  | "equity-grant"      // RSU/ESOP top-up
  | "notice-buyout"     // buy out notice period
  | "benefits-summary"  // recap non-cash
  | "hold-firm"         // explicit "this is final"
  | "close-acceptance"  // wrap with agreed terms
  | "close-walkaway"    // wrap acknowledging no-deal
  | "close-stalemate";  // wrap acknowledging out of turns

/* ─── Band — server-derived once at session start ────────────────── */

export interface NegotiationBand {
  /** AI's opening number (LPA). */
  initialOffer: number;
  /** Maximum the AI can stretch to with explicit approval (LPA). */
  maxStretch: number;
  /** Below this, AI walks (LPA). */
  walkAway: number;
  /** Whether equity/RSU is on the table for this role/company tier. */
  hasEquity: boolean;
}

/* ─── Canonical State ────────────────────────────────────────────── */

/* Information items a candidate can interrogate the recruiter about.
   Tracked as a set on state so we don't double-credit repeated asks
   and so the move-picker can reward depth of due diligence. */
export type InfoIntent =
  | "clawback-period"      // joining-bonus clawback duration / pro-rata
  | "variable-history"     // last 2-3yr variable payout %
  | "vest-schedule"        // RSU/ESOP grant + cliff + slope
  | "strike-price"         // ESOP exercise price / last 409A / FMV
  | "in-hand-monthly"      // CTC → net take-home breakdown
  | "exercise-window"      // post-termination ESOP exercise window
  | "acceleration"         // accelerated vesting on acquisition / RIF
  | "fixed-vs-variable"    // CTC split breakdown
  | "perks-non-cash";      // Sodexo / gratuity / NPS lumping

/* Negotiation tactics from the Voss / interviewing.io canon that the
   parser detects and the move-picker rewards. Tracked so a candidate
   who's clearly negotiating well faces less recruiter stiffening. */
export type VossTactic =
  | "mirror"               // repeats AI's last 1-3 words as a question
  | "label"                // "it sounds like..." framing
  | "calibrated"           // "how can I..." / "what's the best you can..."
  | "sign-today-bundle"    // "if you can do X+Y+Z I'll sign today"
  | "deflect-current-ctc"; // refuses to disclose current CTC

/* Macro market mode — adjusts global concession curves. Soft markets
   (post-layoff 2023-style) reduce concession willingness; hot markets
   (AI/ML 2025-style) increase it. Default neutral. */
export type MarketMode = "soft" | "neutral" | "hot";

export interface NegotiationState {
  /* Identity */
  readonly sessionId: string;
  readonly role: string;
  readonly company: string;

  /* Band — frozen at session start. Server is authoritative; the
     engine cannot mutate this after init. */
  readonly band: NegotiationBand;

  /* Phase + turn budget */
  phase: NegotiationPhase;
  turnIndex: number;    // number of AI turns produced; incremented in applyAiMove
  maxTurns: number;     // hard cap before stalemate (default 8)

  /* Candidate-stated facts. Folded in via applyCandidateAnswer or
     foldFactsIntoState — set ONCE per turn, never re-derived from
     transcript. Null = not stated. */
  candidateTarget: number | null;        // their ask (LPA)
  candidateCurrentCtc: number | null;    // current package (NOT target)
  competingOffer: number | null;         // BATNA in hand (NOT target)

  /* Range ask: candidate stated "30-35 LPA" instead of a single number.
     Research (Idaho / Harvard PON) shows range asks earn meaningfully
     more than single-point asks. We reward this in the counter-offer
     split. */
  candidateAskedAsRange: boolean;

  /* AI moves made */
  highestOfferMade: number;              // best number AI has put on table (LPA)
  leversUsed: NegotiationLever[];        // ordered history
  lastAiText: string;                    // for verbatim-repeat detection

  /* Recruiter-side tactic counters. `finalOfferAssertedCount` tracks
     how many times the AI (or upstream LLM) has claimed "best and
     final" — used by the move-picker to decay credibility after the
     AI then moves anyway. */
  finalOfferAssertedCount: number;

  /* Candidate-side tactic & intent counters. */
  vossTacticsUsed: VossTactic[];
  infoAsked: InfoIntent[];

  /* Verbal-acceptance lock: the candidate said "yes" but then tried to
     re-open the conversation. Distinct from terminal `accepted` — when
     this fires, the move-picker stiffens dramatically and a small
     rescission risk applies on the next turn. */
  verbalAcceptanceTurn: number | null;

  /* Walk-away-and-return: candidate hit `walked-away` and then re-
     engaged. Comes with a penalty (loss of joining bonus, lower base
     ceiling on return). */
  walkAwayReturned: boolean;

  /* Hard-vs-soft band cap. When true, `maxStretch` is genuinely
     unreachable on base — the AI redirects to JB/equity/level instead
     of conceding on base. Modeled after services-co fitment caps. */
  hardBandCap: boolean;

  /* Macro market mode — adjusts concession curve globally. */
  marketMode: MarketMode;

  /* Terminal signals (turn index where the transition fired) */
  acceptedAtTurn: number | null;
  walkedAwayAtTurn: number | null;
}

/* ─── Factory ────────────────────────────────────────────────────── */

export interface InitStateInput {
  sessionId: string;
  role: string;
  company: string;
  band: NegotiationBand;
  maxTurns?: number;
}

export interface InitStateExtras {
  hardBandCap?: boolean;
  marketMode?: MarketMode;
}

export function initState(input: InitStateInput & InitStateExtras): NegotiationState {
  return {
    sessionId: input.sessionId,
    role: input.role,
    company: input.company,
    band: { ...input.band },
    phase: "opening",
    turnIndex: 0,
    maxTurns: input.maxTurns ?? 8,
    candidateTarget: null,
    candidateCurrentCtc: null,
    competingOffer: null,
    candidateAskedAsRange: false,
    highestOfferMade: 0,
    leversUsed: [],
    lastAiText: "",
    finalOfferAssertedCount: 0,
    vossTacticsUsed: [],
    infoAsked: [],
    verbalAcceptanceTurn: null,
    walkAwayReturned: false,
    hardBandCap: input.hardBandCap ?? false,
    marketMode: input.marketMode ?? "neutral",
    acceptedAtTurn: null,
    walkedAwayAtTurn: null,
  };
}

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
  /* Voss / interviewing.io tactics detected this turn. Multiple may
     fire on the same answer. */
  vossTactics: VossTactic[];
  /* Information items the candidate explicitly asked about this turn. */
  infoAsked: InfoIntent[];
  /* Candidate has explicitly hedged on a competing offer ("I have other
     offers but can't share details"). Signals leverage without
     disclosing a number — kernel should respect but not anchor. */
  signalsCompetingExistsWithoutNumber: boolean;
}

/* Parse the candidate's free-text answer for salary-relevant numbers
   and intent signals. Distinguishes "my current package is X" (currentCtc)
   from "I'm looking for Y" (target). Strict ordering: current/competing
   patterns claim their numbers first; target patterns only bind a
   number that wasn't already bound elsewhere. This is what the legacy
   extractor did across the whole transcript every render; here we run
   it once per candidate turn against the single fresh answer. */
/* Hinglish word-numbers commonly heard in spoken negotiation calls
   (and frequently mis-transcribed by STT into the wrong digit). We
   pre-substitute the spelled form into a digit so the rest of the
   parser sees a normal "30 LPA". Only the salary-relevant range
   (10–100 lakhs) is mapped — outside that, candidates use English
   digits anyway. Common surface forms: "tees LPA" (30), "paintees
   LPA" (35), "chalis lakh chahiye" (40), "pachas LPA" (50). */
const HINGLISH_NUMBERS: Record<string, string> = {
  das: "10", gyarah: "11", barah: "12", terah: "13", chaudah: "14",
  pandrah: "15", solah: "16", satrah: "17", atharah: "18", unnees: "19",
  bees: "20", ikees: "21", baees: "22", tees: "30", paintees: "35",
  chalees: "40", chalis: "40", paintaalis: "45", pachas: "50",
  pachaas: "50", pachpan: "55", saath: "60", pasath: "65", sattar: "70",
  pichattar: "75", assi: "80", pacchasi: "85", nabbe: "90", pachanve: "95",
  sau: "100",
};

function substituteHinglishNumbers(s: string): string {
  return s.replace(/\b(das|gyarah|barah|terah|chaudah|pandrah|solah|satrah|atharah|unnees|bees|ikees|baees|tees|paintees|chalees|chalis|paintaalis|pachas|pachaas|pachpan|saath|pasath|sattar|pichattar|assi|pacchasi|nabbe|pachanve|sau)\b/gi,
    (m) => HINGLISH_NUMBERS[m.toLowerCase()] ?? m);
}

/* Voss-tactic detection. These patterns are conservative — only
   reasonably unambiguous formulations are recognized. False positives
   here would silently boost concessions for candidates who didn't
   actually negotiate well. */
function detectVossTactics(a: string, lastAiText: string): VossTactic[] {
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

/* Info-intent detection. The candidate explicitly asks about an offer
   component. Each phrase is conservative — we'd rather miss an ask than
   credit one that wasn't there. */
function detectInfoIntents(a: string): InfoIntent[] {
  const out: InfoIntent[] = [];
  if (/\b(clawback|claw\s+back|return\s+(?:the\s+)?bonus|repay(?:ment)?|pro[-\s]?rata|tenure\s+requirement)\b/i.test(a)) out.push("clawback-period");
  if (/\b(variable\s+(?:pay|component|payout|history)|bonus\s+payout\s+(?:history|last|past)|payout\s+(?:percentage|%|history)|how\s+much\s+variable)\b/i.test(a)) out.push("variable-history");
  if (/\b(vest(?:ing)?\s+(?:schedule|period|cliff|slope)|cliff|grant\s+schedule|back[-\s]?loaded|monthly\s+vest|quarterly\s+vest)\b/i.test(a)) out.push("vest-schedule");
  if (/\b(strike\s+price|exercise\s+price|409a|fmv|fair\s+market\s+value|grant\s+price)\b/i.test(a)) out.push("strike-price");
  if (/\b(in[-\s]?hand|take[-\s]?home|net\s+(?:salary|monthly|pay)|monthly\s+(?:salary|pay|in\s+hand))\b/i.test(a)) out.push("in-hand-monthly");
  if (/\b(exercise\s+window|post[-\s]?termination|after\s+(?:leaving|resignation)|exercise\s+period)\b/i.test(a)) out.push("exercise-window");
  if (/\b(accelerat(?:ed|ion)\s+vest|change\s+of\s+control|acquisition\s+(?:trigger|clause|vesting)|single[-\s]?trigger|double[-\s]?trigger)\b/i.test(a)) out.push("acceleration");
  if (/\b(fixed\s+(?:vs|versus|and)\s+variable|split\s+(?:between|of)\s+fixed|how\s+much\s+(?:is\s+)?fixed|fixed\s+component|ctc\s+(?:breakdown|split))\b/i.test(a)) out.push("fixed-vs-variable");
  if (/\b(sodexo|food\s+coupon|gratuity|nps|insurance\s+(?:value|cost)|non[-\s]?cash|benefits\s+(?:value|in\s+ctc))\b/i.test(a)) out.push("perks-non-cash");
  return out;
}

export function parseCandidateAnswer(answer: string, lastAiText = ""): ParsedAnswer {
  const a = substituteHinglishNumbers((answer || "").trim());
  if (!a) {
    return {
      target: null, currentCtc: null, competing: null,
      signalsAcceptance: false, signalsWalkAway: false,
      targetAsRange: false, vossTactics: [], infoAsked: [],
      signalsCompetingExistsWithoutNumber: false,
    };
  }

  /* Acceptance / walk-away (single-turn). The session-long sticky
     check sits in applyCandidateAnswer (consults existing state).

     Both English and Hindi-mix patterns are matched. Hindi-mix accept
     phrases ("theek hai", "ho jayega", "kar dijiye", "manzoor hai")
     and walk phrases ("nahi chahiye", "nahi karna", "nahi banega")
     were previously invisible to the parser — candidates speaking
     code-switched English/Hindi would have terminal-phase transitions
     drop on the floor, leaving the AI to keep negotiating past a
     clear yes/no signal. */
  /* Broadened from the original "i (would like to|want to|'d like to) accept"
     anchor. Real candidates speak much more loosely than that — the
     Tech-Mahindra UX session (May 2026) had three explicit acceptance
     phrases ("completely agree with your offer", "I am accepting your
     initial offer", "I've already accepted") and the kernel matched
     none of them, so the AI kept probing and the candidate got
     frustrated. Each alternation is a single, readable phrase pattern;
     the whole thing is OR-joined into one regex. Conditional / "but I
     want more" gating is handled by the gates below, not in here. */
  const acceptPat = new RegExp(
    [
      // "i accept the offer" / "i'd accept" / "i accept it"
      String.raw`\bi(?:'d)?\s+accept(?:\s+(?:this|the|your)\s+offer|\s+it)?\b`,
      // "i'm accepting" / "i am accepting" / "i'll accept" / "i will accept"
      String.raw`\bi\s*(?:'m|am)\s+accept(?:ing|ed)?\b`,
      String.raw`\bi\s*(?:'?ll|will)\s+accept(?:\s+(?:this|the|your)\s+offer|\s+it)?\b`,
      // "i've accepted" / "i have (already) accepted" / "i already accepted"
      String.raw`\bi\s*(?:'ve|have)\s+(?:already\s+)?accepted\b`,
      String.raw`\bi(?:\s+have)?\s+already\s+accepted\b`,
      // "accepting your offer" / "accepted your offer"
      String.raw`\baccept(?:ing|ed)\s+(?:this|the|your)\s+offer\b`,
      // "i (fully|totally|completely) agree" or bare "completely agree (with the offer)"
      String.raw`\bi\s+(?:fully\s+|totally\s+|completely\s+)?agree\b`,
      String.raw`\b(?:fully|totally|completely)\s+agree\b`,
      // "i'll take it" / "i'm in" / "your offer works"
      String.raw`\bi.?ll\s+take\s+(?:it|the\s+offer)\b`,
      String.raw`\bi.?m\s+in\b`,
      String.raw`\b(?:your|the)\s+offer\s+(?:works|sounds\s+good|is\s+fine|is\s+great)\b`,
      // Idioms.
      String.raw`\bsounds\s+good\b`,
      String.raw`\bthat\s+works\b`,
      String.raw`\bit.?s\s+a\s+deal\b`,
      String.raw`\bdone\s+deal\b`,
      String.raw`\blet.?s\s+(?:go\s+ahead|do\s+it|lock\s+it\s+in)\b`,
      String.raw`\bhappy\s+to\s+accept\b`,
      String.raw`\bi.?m\s+happy\s+with\s+(?:that|the\s+offer)\b`,
      // Hindi-mix.
      String.raw`\btheek\s+hai\b`,
      String.raw`\btheek\s+he\b`,
      String.raw`\bho\s+ja(?:y|e)ega\b`,
      String.raw`\bkar\s+(?:di(?:ya|jiye)|do|dijiye)\b`,
      String.raw`\bmanzoor(?:\s+hai)?\b`,
      String.raw`\bhaan\s+(?:thik|theek|ok|okay|done)\b`,
    ].join("|"),
    "i",
  );
  const conditionalPat = /\b(?:if|unless|provided|on condition|contingent|only\s+if|agar|jab\s+tak)\b/i;
  /* "but/however/lekin/magar … <ask-for-more>" within a single
     sentence. Previously this required the negotiation cue to sit
     immediately next to "but" with at most whitespace in between, so
     "but I want a bit more on base" missed (because of "a bit" between
     "want" and "more"). The new pattern looks for any negotiation cue
     within 60 chars of the conjunction. */
  const negotiatingButPat = /\b(?:but|however|lekin|magar)\b[^.!?\n]{0,60}?\b(?:more|higher|better|increase|raise|reduce|lower|stretch|bump|further|additional|negotiate|push|counter|extra|zyada|kam|aur)\b/i;
  const walkAwayPat = /\b(walk away|walking away|i.?m out|not interested|i.?ll pass|no deal|withdraw|decline|won.?t work|isn.?t going to work|have to pass|that won.?t work|move on|nahi\s+(?:chahiye|karna|banega|hoga|kar\s+sakta)|nahin\s+(?:chahiye|karna)|mujhe\s+nahi(?:n)?\s+chahiye)\b/i;
  const signalsAcceptance = acceptPat.test(a) && !conditionalPat.test(a) && !negotiatingButPat.test(a) && !walkAwayPat.test(a);
  const signalsWalkAway = walkAwayPat.test(a);

  /* Current-CTC patterns. These claim their number FIRST so the
     target regex can't accidentally pick "8.5" out of "my current
     package is 8.5 LPA" — that exact bug shipped in production
     (Bombay Design Centre session, May 2026).

     Range support: "I'm earning 25-28 LPA" binds the upper bound so
     a candidate's stated comp ceiling becomes the disclosed value
     (matching how recruiters interpret stated current packages). */
  const currentCtc =
    extractUsdAmount(a, [
      /\bcurrent(?:ly)?\s+(?:package|salary|ctc|comp(?:ensation)?|pay)[^.!?\n]{0,30}?\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(k|K)?/i,
      /\b(?:currently|earning|getting|drawing|making|making\s+about|take\s+home|i\s+get|i\s+earn|i.?m\s+at)\s.*?\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(k|K)?/i,
    ]) ??
    extractFirstNumber(a, [
      /\b(?:my\s+)?current(?:ly)?\s+(?:package|salary|ctc|comp(?:ensation)?|pay|role)[^.!?\n₹]{0,30}?₹?\s*\d+(?:\.\d+)?\s*(?:[-–—]|to)\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b|cr|crore)/i,
      /\b(?:my\s+)?current(?:ly)?\s+(?:package|salary|ctc|comp(?:ensation)?|pay|role)[^.!?\n₹]{0,30}?₹?\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b|cr|crore)/i,
      /\b(?:currently|earning|getting|drawing|my\s+ctc|i.?m\s+at|making|take\s+home|i\s+get|i\s+earn)\s.*?₹?\s*\d+(?:\.\d+)?\s*(?:[-–—]|to)\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b|cr|crore)/i,
      /\b(?:currently|earning|getting|drawing|my\s+ctc|i.?m\s+at|making|take\s+home|i\s+get|i\s+earn)\s.*?₹?\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b|cr|crore)/i,
      /\bpackage\s+progression[^.!?\n₹]{0,30}?₹?\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b|cr|crore)/i,
    ]);

  /* Competing-offer patterns. Also must NOT bind to target. */
  const competingCtx = /(?:offer\s+of|in[-\s]?hand(?:\s+offer)?\s+(?:of|at)?|already\s+have|received|competing\s+offer\s+(?:of|at)?|got\s+an\s+offer\s+(?:of|at)?|another\s+offer\s+(?:of|at)?)/i;
  const competing =
    extractUsdAmount(a, [
      new RegExp(competingCtx.source + /\s*\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(k|K)?/.source, "i"),
    ]) ??
    extractFirstNumber(a, [
      /(?:offer\s+of|in[-\s]?hand(?:\s+offer)?\s+(?:of|at)?|already\s+have|received|competing\s+offer\s+(?:of|at)?|got\s+an\s+offer\s+(?:of|at)?|another\s+offer\s+(?:of|at)?)\s*₹?\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|cr|crore)/i,
    ]);

  /* Target patterns. We require explicit ask context to bind — bare
     numbers are ignored to avoid "currently 8.5" leaking to target.
     Both directions matter for Indian candidates:
       - English / pre-number: "want / expecting / looking for N LPA"
       - Hindi-mix / post-number: "N lakh chahiye", "N LPA ka package",
         "N lakh mil jaye", "N LPA milna chahiye" — common in mixed
         Hindi-English STT output, previously dropped on the floor. */
  const targetCtxPat = /(?:expecting|want|need|asking|target|hoping|looking\s+for|would\s+like|i.?d\s+like|aim(?:ing)?\s+for|comfortable\s+with|settle\s+for|around|mujhe|mera\s+target)\s+(?:to\s+(?:have|get)\s+)?(?:an?\s+|about\s+|approximately\s+|roughly\s+)?₹?\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b|cr|crore)?/i;
  const targetHindiPostPat = /₹?\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|lakh|l\b|cr|crore)\s+(?:chahiye|ka\s+package|mil\s+jaye|milna\s+chahiye|expect\s+kar(?:ta|ti)\s+hu|chahta\s+hu|chahti\s+hu)/i;
  /* Range patterns — "30-35 LPA" / "30 to 35 lakhs" / "₹30 – ₹35 LPA".
     Candidates anchor at the top of their stated range, so we bind the
     upper bound as the target (more realistic recruiter framing). */
  const targetRangePat = /(?:expecting|want|need|asking|target|hoping|looking\s+for|would\s+like|aim(?:ing)?\s+for|around|between)\s+(?:an?\s+)?₹?\s*\d+(?:\.\d+)?\s*(?:[-–—]|to)\s*₹?\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b|cr|crore)/i;
  /* USD anchors — "$150k", "$120,000", "USD 100k". Common in tech
     candidates moving from US-comp companies. Converted to LPA at a
     fixed rate so kernel math stays in one unit. */
  const targetUsdPat = /(?:expecting|want|need|asking|target|hoping|looking\s+for|would\s+like|aim(?:ing)?\s+for)\s+(?:an?\s+|about\s+|approximately\s+|roughly\s+)?\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(k|K)?/i;
  let target = extractUsdAmount(a, [targetUsdPat]) ?? extractFirstNumber(a, [targetRangePat, targetCtxPat, targetHindiPostPat]);

  /* Disambiguation: if a number was already bound to current/
     competing, it isn't ALSO the target — drop it. */
  if (target != null && (target === currentCtc || target === competing)) {
    target = null;
  }

  /* Range-ask detection — fires if any of the range patterns matched
     regardless of whether the bound number came from a range or a
     single-value path. */
  const rangeAnyPat = /\b\d+(?:\.\d+)?\s*(?:[-–—]|to)\s*\d+(?:\.\d+)?\s*(?:lpa|lakhs?|l\b|cr|crore)/i;
  const targetAsRange = rangeAnyPat.test(a) && target != null;

  /* Competing-without-number: candidate has signaled competing exists
     but refuses or omits to share magnitude. */
  const competingMentionPat = /\b(competing\s+offer|another\s+offer|other\s+offers?|offer\s+in\s+hand|other\s+companies|elsewhere|other\s+conversations|in\s+the\s+market)\b/i;
  const hedgePat = /\b(can.?t\s+share|prefer\s+not|nda|confidential|not\s+at\s+liberty|won.?t\s+disclose|details\s+(?:are\s+)?confidential)\b/i;
  const signalsCompetingExistsWithoutNumber =
    competing == null && competingMentionPat.test(a) && (hedgePat.test(a) || !/[\d]/.test(a));

  const vossTactics = detectVossTactics(a, lastAiText);
  const infoAsked = detectInfoIntents(a);

  return {
    target, currentCtc, competing,
    signalsAcceptance, signalsWalkAway,
    targetAsRange, vossTactics, infoAsked,
    signalsCompetingExistsWithoutNumber,
  };
}

/* Extract the first numeric value from `text` using any of `patterns`.
   Output is normalised to LPA.

   Unit handling: when the matched substring contains a crore marker
   (`cr` / `crore`) we multiply by 100 so "5 crore" → 500 LPA. Without
   this, the senior/exec hiring path silently truncated magnitude (we
   captured the digit `5` but treated it as 5 LPA). Clamp is widened
   to 5000 LPA (= 50 crore) which covers C-suite while still rejecting
   garbage from STT mishears like "five hundred thousand".

   Comma stripping: Indian "30,00,000" and Western "3,000,000" both
   strip to "3000000". The downstream LPA/lakh unit then resolves
   them correctly. */
function extractFirstNumber(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m && m[1]) {
      let n = parseFloat(m[1].replace(/,/g, ""));
      if (!Number.isFinite(n)) continue;
      const isCrore = /\bcr\b|crore/i.test(m[0]);
      if (isCrore) n *= 100;
      if (n >= 1 && n <= 5000) return n;
    }
  }
  return null;
}

/* Convert a USD amount to LPA. Used when a candidate quotes US-comp
   numbers ("$150k", "$120,000"). We use a fixed 83 INR/USD rate —
   close enough for negotiation-band math and avoids the operational
   risk of a live FX lookup on every turn. Anything outside 10k–5M USD
   is rejected as malformed. */
const USD_TO_INR = 83;
function extractUsdAmount(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m && m[1]) {
      let usd = parseFloat(m[1].replace(/,/g, ""));
      if (!Number.isFinite(usd)) continue;
      /* The `k` suffix on the match means thousands. */
      if (/k/i.test(m[2] || "")) usd *= 1000;
      if (usd < 10_000 || usd > 5_000_000) continue;
      /* USD → INR → lakhs. 1 lakh = 100k INR. */
      const lpa = Math.round((usd * USD_TO_INR) / 100_000 * 10) / 10;
      if (lpa >= 1 && lpa <= 5000) return lpa;
    }
  }
  return null;
}

/* ─── State transition: fold candidate's answer into state ───────── */

/** Apply a candidate turn to state. Returns a new state — never
 *  mutates the input. Terminal phases are sticky: if state.phase is
 *  already terminal, returns state unchanged. */
export function applyCandidateAnswer(state: NegotiationState, answer: string): NegotiationState {
  /* Walk-away-and-return: if state is terminal `walked-away` but the
     candidate sends a non-empty engagement, re-open the conversation
     with a penalty flag. This is the only path out of a terminal phase
     and it's a one-way trapdoor (the flag is sticky). */
  if (state.phase === "walked-away" && (answer || "").trim().length > 0 &&
      !/\b(walk away|walking away|not interested|withdraw|decline|won.?t work|isn.?t going to work|move on|nahi\s+(?:chahiye|karna|banega))\b/i.test(answer)) {
    const reopened: NegotiationState = {
      ...state,
      leversUsed: [...state.leversUsed],
      vossTacticsUsed: [...state.vossTacticsUsed],
      infoAsked: [...state.infoAsked],
      phase: "counter-offer",
      walkAwayReturned: true,
      walkedAwayAtTurn: null,
    };
    return applyCandidateAnswer(reopened, answer);
  }
  if (isTerminalPhase(state.phase)) return state;

  const parsed = parseCandidateAnswer(answer, state.lastAiText);
  const next: NegotiationState = {
    ...state,
    leversUsed: [...state.leversUsed],
    vossTacticsUsed: [...state.vossTacticsUsed],
    infoAsked: [...state.infoAsked],
  };

  /* Bind newly-stated facts. Last-stated wins (the candidate may
     revise their target mid-conversation; that's allowed). */
  if (parsed.target != null) next.candidateTarget = parsed.target;
  if (parsed.currentCtc != null) next.candidateCurrentCtc = parsed.currentCtc;
  if (parsed.competing != null) next.competingOffer = parsed.competing;
  if (parsed.targetAsRange) next.candidateAskedAsRange = true;

  /* Merge tactic + info sets — sticky, never cleared. */
  for (const t of parsed.vossTactics) {
    if (!next.vossTacticsUsed.includes(t)) next.vossTacticsUsed.push(t);
  }
  for (const i of parsed.infoAsked) {
    if (!next.infoAsked.includes(i)) next.infoAsked.push(i);
  }

  /* Verbal-acceptance lock — if the candidate previously said yes but
     now is asking for more (target above current offer, or new lever
     request), record the turn so the move-picker can stiffen. We do
     NOT transition to terminal `accepted` in this case; the candidate
     re-opened. */
  const reneging =
    next.verbalAcceptanceTurn != null &&
    (parsed.target != null || parsed.vossTactics.includes("sign-today-bundle") || parsed.infoAsked.length > 0) &&
    !parsed.signalsAcceptance;
  if (reneging) {
    /* Sticky — leave verbalAcceptanceTurn set so the move-picker keeps
       seeing it across subsequent turns. */
  }

  /* Terminal transitions. */
  if (parsed.signalsAcceptance) {
    /* Conditional accept ("yes if X") set verbalAcceptanceTurn instead
       of locking terminal. parseCandidateAnswer's acceptPat already
       rejects most conditionals; this is belt-and-suspenders for the
       sign-today-bundle path which carries its own implicit "if". */
    if (parsed.vossTactics.includes("sign-today-bundle")) {
      next.verbalAcceptanceTurn = state.turnIndex;
      next.phase = derivePhase(next);
      return next;
    }
    next.phase = "accepted";
    next.acceptedAtTurn = state.turnIndex;
    return next;
  }
  if (parsed.signalsWalkAway) {
    next.phase = "walked-away";
    next.walkedAwayAtTurn = state.turnIndex;
    return next;
  }

  /* Non-terminal: re-derive phase from updated state. */
  next.phase = derivePhase(next);
  return next;
}

/** Fold an externally-computed NegotiationFacts (from the legacy
 *  whole-transcript extractor) into state. Useful during the
 *  feature-flag transition: legacy code already has facts, and the
 *  new kernel can adopt them without re-parsing. */
export function foldFactsIntoState(state: NegotiationState, facts: NegotiationFacts): NegotiationState {
  if (isTerminalPhase(state.phase)) return state;
  const next: NegotiationState = {
    ...state,
    leversUsed: [...state.leversUsed],
    vossTacticsUsed: [...state.vossTacticsUsed],
    infoAsked: [...state.infoAsked],
  };
  const num = (s: string | null): number | null => {
    if (!s) return null;
    const v = parseFloat(s.replace(/[^\d.]/g, ""));
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const t = num(facts.candidateCounter);
  const c = num(facts.candidateCurrentCTC);
  const comp = num(facts.competingOfferAmount ?? null);
  if (t != null) next.candidateTarget = t;
  if (c != null) next.candidateCurrentCtc = c;
  if (comp != null) next.competingOffer = comp;
  if (facts.acceptedImmediately) {
    next.phase = "accepted";
    next.acceptedAtTurn = state.turnIndex;
    return next;
  }
  if (facts.rejectedOutright) {
    next.phase = "walked-away";
    next.walkedAwayAtTurn = state.turnIndex;
    return next;
  }
  next.phase = derivePhase(next);
  return next;
}

/* ─── Phase derivation ───────────────────────────────────────────── */

/** State → phase. Pure, no transcript dependency. The earlier
 *  detectSalaryPhase needed transcript + turn index + facts because it
 *  was reconstructing state from scratch each render; here the phase
 *  IS state, and we just compute the next bucket from already-folded
 *  facts. */
export function derivePhase(state: NegotiationState): NegotiationPhase {
  if (isTerminalPhase(state.phase)) return state.phase;
  if (state.turnIndex >= state.maxTurns) return "stalemate";

  const target = state.candidateTarget;

  /* Target above max stretch + ≥2 levers tried → lever-explore. Only
     non-cash bridges remain. */
  if (target != null && target > state.band.maxStretch && state.leversUsed.length >= 2) {
    return "lever-explore";
  }

  /* Target stated + we've made an offer → counter territory. */
  if (target != null && state.highestOfferMade > 0) {
    return "counter-offer";
  }

  /* Offered, no target. If the candidate has revealed anything (current
     CTC, competing offer) or we've already probed, we're in probe
     territory; otherwise we're awaiting their first reaction. */
  if (state.highestOfferMade > 0) {
    const candidateEngaged =
      state.candidateCurrentCtc != null ||
      state.competingOffer != null ||
      state.leversUsed.includes("probe");
    return candidateEngaged ? "probe-expectations" : "offer-presented";
  }

  return "opening";
}

/* ─── AI move selection ──────────────────────────────────────────── */

export interface AiMove {
  lever: NegotiationLever;
  /** New total CTC the AI is willing to put on the table this turn
   *  (LPA). Null when the move is non-numeric (probe / benefits / hold). */
  newTotalLpa: number | null;
  /** Human-readable rationale for telemetry and prompt context. */
  rationale: string;
}

/** Pick the AI's move for this turn from state alone. Pure. */
export function pickAiMove(state: NegotiationState): AiMove {
  /* Terminal closings. */
  if (state.phase === "accepted") {
    return {
      lever: "close-acceptance",
      newTotalLpa: state.highestOfferMade || state.band.initialOffer,
      rationale: "Candidate accepted; recap terms.",
    };
  }
  if (state.phase === "walked-away") {
    return {
      lever: "close-walkaway",
      newTotalLpa: null,
      rationale: "Candidate walked; acknowledge respectfully.",
    };
  }
  if (state.phase === "stalemate") {
    return {
      lever: "close-stalemate",
      newTotalLpa: state.highestOfferMade || state.band.initialOffer,
      rationale: "Turn budget exhausted; offer time to think.",
    };
  }

  /* Opening: put the initial offer on the table. */
  if (state.phase === "opening") {
    return {
      lever: "open-with-offer",
      newTotalLpa: state.band.initialOffer,
      rationale: `Open with band initial ₹${state.band.initialOffer} LPA.`,
    };
  }

  /* No candidate anchor yet → probe. */
  if (state.phase === "offer-presented" || state.phase === "probe-expectations") {
    return {
      lever: "probe",
      newTotalLpa: null,
      rationale: "Probe candidate's expectation before moving.",
    };
  }

  /* Counter-offer: split toward target, capped at maxStretch.

     Stiffening: the split factor decays as we repeat counter-base.
     A flat 0.5 every turn was exploitable — a candidate who simply
     re-asserted the same demand each turn could pull the offer to
     maxStretch in 4–5 turns. Real recruiters concede less each time
     the same lever is pulled. Schedule: 0.5 → 0.35 → 0.22 → 0.12 → 0.06,
     then floor at 0.05. The full ceiling (maxStretch) remains the hard
     cap, so this never *exceeds* band, only approaches it more slowly. */
  if (state.phase === "counter-offer") {
    /* Hard band cap: base is structurally capped; redirect concession
       energy to non-cash levers instead of inching toward maxStretch. */
    if (state.hardBandCap) {
      return pickLeverExploreMove(state);
    }
    /* Verbal-acceptance-then-renegotiate: heavy stiffening + reject any
       further base movement. Modeled after the offer-rescission risk
       documented in Salary.com survey data. */
    if (state.verbalAcceptanceTurn != null) {
      return {
        lever: "hold-firm",
        newTotalLpa: state.highestOfferMade,
        rationale: "Candidate verbally accepted; further base asks risk rescission. Hold firm.",
      };
    }

    const target = state.candidateTarget ?? state.band.maxStretch;
    const floor = Math.max(state.highestOfferMade, state.band.initialOffer);
    const ceiling = state.band.maxStretch;
    const aspiration = Math.min(target, ceiling);

    /* No headroom → switch to lever-explore. */
    if (aspiration <= floor + 0.1) {
      return pickLeverExploreMove(state);
    }
    const counterCount = state.leversUsed.filter(l => l === "counter-base").length;
    const splitSchedule = [0.5, 0.35, 0.22, 0.12, 0.06];
    let split = splitSchedule[counterCount] ?? 0.05;

    /* Tactic boost: candidates using calibrated questions, range asks,
       and labeling get larger concessions per turn. Mirroring alone is
       a softer signal so it earns a smaller bump. Sign-today bundles
       get the biggest boost (Voss-canon-grade certainty-for-concession
       trade). Cumulative, capped at 2x the base split. */
    let boost = 1;
    if (state.candidateAskedAsRange) boost += 0.15;
    if (state.vossTacticsUsed.includes("calibrated")) boost += 0.25;
    if (state.vossTacticsUsed.includes("label")) boost += 0.15;
    if (state.vossTacticsUsed.includes("mirror")) boost += 0.05;
    if (state.vossTacticsUsed.includes("sign-today-bundle")) boost += 0.35;
    if (state.vossTacticsUsed.includes("deflect-current-ctc")) boost += 0.10;
    if (boost > 2) boost = 2;
    split = Math.min(split * boost, 0.6);

    /* Market mode modulator. Soft markets squeeze candidates; hot
       markets reward them. */
    if (state.marketMode === "soft") split *= 0.7;
    else if (state.marketMode === "hot") split *= 1.3;

    /* Walk-away-and-return penalty: returning candidate gets a worse
     * concession curve to model the loss of leverage. */
    if (state.walkAwayReturned) split *= 0.5;

    if (split > 0.95) split = 0.95;
    const newTotal = Math.round((floor + (aspiration - floor) * split) * 10) / 10;
    return {
      lever: "counter-base",
      newTotalLpa: newTotal,
      rationale: `Split toward target (stiffening ${splitSchedule[counterCount] ?? 0.05}, effective ${split.toFixed(2)}, boost ${boost.toFixed(2)}, market ${state.marketMode}${state.walkAwayReturned ? ", returned" : ""}): floor ₹${floor} → ₹${newTotal} (target ₹${target}, ceiling ₹${ceiling}).`,
    };
  }

  /* lever-explore / closing-push: rotate non-cash levers. */
  return pickLeverExploreMove(state);
}

function pickLeverExploreMove(state: NegotiationState): AiMove {
  const used = new Set(state.leversUsed);
  /* Lever order optimises for company P&L: when the band supports equity
     we prefer equity-grant FIRST because grants vest over multi-year
     schedules and dilute cap-table paper (not in-year cash), whereas a
     joining bonus is full sunk cash at hire. Falling back to joining-
     bonus only when the tier has no equity to offer keeps the AI from
     leaking the cheapest concession last. */
  if (state.band.hasEquity && !used.has("equity-grant")) {
    return {
      lever: "equity-grant",
      newTotalLpa: state.highestOfferMade,
      rationale: "Add equity grant; cheaper long-term than cash sweeteners.",
    };
  }
  if (!used.has("joining-bonus")) {
    return {
      lever: "joining-bonus",
      newTotalLpa: state.highestOfferMade,
      rationale: "Cash headroom exhausted; add one-time joining bonus.",
    };
  }
  if (!used.has("notice-buyout")) {
    return {
      lever: "notice-buyout",
      newTotalLpa: state.highestOfferMade,
      rationale: "Offer notice-period buyout as soft lever.",
    };
  }
  if (!used.has("benefits-summary")) {
    return {
      lever: "benefits-summary",
      newTotalLpa: state.highestOfferMade,
      rationale: "Recap non-cash benefits totality.",
    };
  }
  return {
    lever: "hold-firm",
    newTotalLpa: state.highestOfferMade,
    rationale: "All levers exhausted; hold firm and invite decision.",
  };
}

/* ─── State transition: apply an AI move ─────────────────────────── */

/** Apply an AI move to state, incrementing turn index and recording
 *  the lever + offered number. Pure. Caller is responsible for the
 *  actual text generation; this just bookkeeps the move. */
export function applyAiMove(state: NegotiationState, move: AiMove, aiText: string): NegotiationState {
  const next: NegotiationState = {
    ...state,
    turnIndex: state.turnIndex + 1,
    leversUsed: [...state.leversUsed, move.lever],
    lastAiText: aiText,
  };
  if (move.newTotalLpa != null && move.newTotalLpa > state.highestOfferMade) {
    next.highestOfferMade = move.newTotalLpa;
  }
  /* Re-derive phase only for non-terminal states (terminal phases set
     by candidate-turn don't get clobbered by an AI move that follows). */
  if (!isTerminalPhase(next.phase)) {
    next.phase = derivePhase(next);
  }
  return next;
}

/* ─── Validation helpers ─────────────────────────────────────────── */

/** Does the LLM's generated text contain a salary number that
 *  violates the band? Returns the first violating number (in LPA) or
 *  null. Used by the route handler to detect when the LLM has invented
 *  a number outside the approved band.
 *
 *  Unit-aware: matches both `LPA / lakh` and `cr / crore` and normalises
 *  crore→LPA (×100). Without crore matching, the LLM could write
 *  "₹2 crore total" and bypass the validator entirely — a real risk
 *  since the upstream parser now accepts crore inputs from candidates. */
export function findOutOfBandNumber(text: string, band: NegotiationBand): number | null {
  /* Currency prefix accepts ₹, Rs., Rs, INR so an LLM switching
     notation can't sneak past validation. Strip commas before
     parseFloat for "₹1,50,000 LPA"-style numbers. */
  const re = /(?:₹|Rs\.?\s*|INR\s*)([\d,]+(?:\.\d+)?)\s*(LPA|lpa|lakhs?|crore|\bcr\b)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let n = parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    if (/cr/i.test(m[2])) n *= 100;
    if (n > band.maxStretch + 0.01 || n < band.walkAway - 0.01) return n;
  }
  return null;
}

/** Verbatim-repeat check. The LLM occasionally regenerates the
 *  identical question two turns in a row; this catches it without
 *  relying on Jaccard tuning. Returns true when both texts have a
 *  matching 8-content-word prefix AND both have at least that many
 *  content words. The min-length guard avoids false positives on very
 *  short closers like "Sounds good." which legitimately repeat across
 *  turns. */
const FINGERPRINT_WORDS = 8;
const MIN_CONTENT_WORDS = 4;

export function isVerbatimRepeat(text: string, state: NegotiationState): boolean {
  if (!state.lastAiText || !text) return false;
  const a = fingerprintWords(text);
  const b = fingerprintWords(state.lastAiText);
  /* Min-length guard: trivial closers ("Sounds good.", "Right.") can't
     trigger a verbatim flag — they have <4 content words and may
     legitimately repeat across turns. */
  if (a.length < MIN_CONTENT_WORDS || b.length < MIN_CONTENT_WORDS) return false;
  return a.slice(0, FINGERPRINT_WORDS).join(" ") === b.slice(0, FINGERPRINT_WORDS).join(" ");
}

const STOP_WORDS = new Set([
  "the","a","an","is","are","be","you","your","i","we","our","that","this","of","to","for",
  "and","or","but","with","what","how","do","does","can","could","would","should","let","me",
  "just","in","on","at","by","as","so","if","like","than","then","its","it","ll","ve","re",
]);

function fingerprintWords(s: string): string[] {
  return s.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/* ─── Serialization ──────────────────────────────────────────────── */

/* JSON-safe state for over-the-wire transit. Sets/Maps and `readonly`
   round-trip cleanly because NegotiationState uses plain arrays. */
export function serializeState(state: NegotiationState): string {
  return JSON.stringify(state);
}

const VALID_PHASES: ReadonlySet<NegotiationPhase> = new Set<NegotiationPhase>([
  "opening",
  "offer-presented",
  "probe-expectations",
  "counter-offer",
  "lever-explore",
  "closing-push",
  "accepted",
  "walked-away",
  "stalemate",
]);

const VALID_LEVERS: ReadonlySet<NegotiationLever> = new Set<NegotiationLever>([
  "open-with-offer",
  "probe",
  "counter-base",
  "joining-bonus",
  "equity-grant",
  "notice-buyout",
  "benefits-summary",
  "hold-firm",
  "close-acceptance",
  "close-walkaway",
  "close-stalemate",
]);

function isFiniteNonNegInt(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && Number.isInteger(n);
}
function isFiniteNumOrNull(n: unknown): n is number | null {
  return n === null || (typeof n === "number" && Number.isFinite(n));
}

/** Throws if `state` is not a structurally valid NegotiationState. The
 *  route relies on this — malformed/out-of-sequence state from the
 *  client must not silently flow into applyCandidateAnswer. */
export function validateState(state: unknown): asserts state is NegotiationState {
  if (!state || typeof state !== "object") throw new Error("state: not an object");
  const s = state as Record<string, unknown>;
  if (typeof s.sessionId !== "string" || !s.sessionId) throw new Error("state.sessionId");
  if (typeof s.role !== "string") throw new Error("state.role");
  if (typeof s.company !== "string") throw new Error("state.company");
  const band = s.band as Record<string, unknown> | undefined;
  if (!band || typeof band !== "object") throw new Error("state.band");
  if (typeof band.initialOffer !== "number" || !Number.isFinite(band.initialOffer)) throw new Error("state.band.initialOffer");
  if (typeof band.maxStretch !== "number" || !Number.isFinite(band.maxStretch)) throw new Error("state.band.maxStretch");
  if (typeof band.walkAway !== "number" || !Number.isFinite(band.walkAway)) throw new Error("state.band.walkAway");
  if (typeof band.hasEquity !== "boolean") throw new Error("state.band.hasEquity");
  if (typeof s.phase !== "string" || !VALID_PHASES.has(s.phase as NegotiationPhase)) throw new Error("state.phase");
  if (!isFiniteNonNegInt(s.turnIndex)) throw new Error("state.turnIndex");
  if (!isFiniteNonNegInt(s.maxTurns) || s.maxTurns === 0) throw new Error("state.maxTurns");
  if (s.turnIndex > s.maxTurns + 1) throw new Error("state.turnIndex exceeds maxTurns");
  if (!isFiniteNumOrNull(s.candidateTarget)) throw new Error("state.candidateTarget");
  if (!isFiniteNumOrNull(s.candidateCurrentCtc)) throw new Error("state.candidateCurrentCtc");
  if (!isFiniteNumOrNull(s.competingOffer)) throw new Error("state.competingOffer");
  if (typeof s.highestOfferMade !== "number" || !Number.isFinite(s.highestOfferMade)) throw new Error("state.highestOfferMade");
  if (!Array.isArray(s.leversUsed) || !s.leversUsed.every((l) => typeof l === "string" && VALID_LEVERS.has(l as NegotiationLever))) {
    throw new Error("state.leversUsed");
  }
  if (typeof s.lastAiText !== "string") throw new Error("state.lastAiText");
  if (s.acceptedAtTurn !== null && !isFiniteNonNegInt(s.acceptedAtTurn)) throw new Error("state.acceptedAtTurn");
  if (s.walkedAwayAtTurn !== null && !isFiniteNonNegInt(s.walkedAwayAtTurn)) throw new Error("state.walkedAwayAtTurn");
  /* Backward-compatible optional fields: tolerate absence (older
     in-flight sessions) but reject malformed values. deserializeState
     backfills defaults so the rest of the kernel sees a fully-shaped
     state. */
  if (s.finalOfferAssertedCount !== undefined && !isFiniteNonNegInt(s.finalOfferAssertedCount)) throw new Error("state.finalOfferAssertedCount");
  if (s.candidateAskedAsRange !== undefined && typeof s.candidateAskedAsRange !== "boolean") throw new Error("state.candidateAskedAsRange");
  if (s.vossTacticsUsed !== undefined && !(Array.isArray(s.vossTacticsUsed) && s.vossTacticsUsed.every((v) => typeof v === "string"))) throw new Error("state.vossTacticsUsed");
  if (s.infoAsked !== undefined && !(Array.isArray(s.infoAsked) && s.infoAsked.every((v) => typeof v === "string"))) throw new Error("state.infoAsked");
  if (s.verbalAcceptanceTurn !== undefined && s.verbalAcceptanceTurn !== null && !isFiniteNonNegInt(s.verbalAcceptanceTurn)) throw new Error("state.verbalAcceptanceTurn");
  if (s.walkAwayReturned !== undefined && typeof s.walkAwayReturned !== "boolean") throw new Error("state.walkAwayReturned");
  if (s.hardBandCap !== undefined && typeof s.hardBandCap !== "boolean") throw new Error("state.hardBandCap");
  if (s.marketMode !== undefined && s.marketMode !== "soft" && s.marketMode !== "neutral" && s.marketMode !== "hot") throw new Error("state.marketMode");
}

export function deserializeState(json: string): NegotiationState {
  const parsed: unknown = JSON.parse(json);
  validateState(parsed);
  /* Backfill defaults for optional fields added after the wire format
     was first deployed. Existing in-flight sessions serialized without
     these keys; we default them on read so the rest of the kernel can
     assume they exist. */
  const s = parsed as NegotiationState & Partial<Record<string, unknown>>;
  return {
    ...parsed,
    candidateAskedAsRange: s.candidateAskedAsRange ?? false,
    finalOfferAssertedCount: s.finalOfferAssertedCount ?? 0,
    vossTacticsUsed: (s.vossTacticsUsed as VossTactic[] | undefined) ?? [],
    infoAsked: (s.infoAsked as InfoIntent[] | undefined) ?? [],
    verbalAcceptanceTurn: s.verbalAcceptanceTurn ?? null,
    walkAwayReturned: s.walkAwayReturned ?? false,
    hardBandCap: s.hardBandCap ?? false,
    marketMode: (s.marketMode as MarketMode | undefined) ?? "neutral",
  };
}
