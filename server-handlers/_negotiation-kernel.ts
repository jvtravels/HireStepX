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

  /* AI moves made */
  highestOfferMade: number;              // best number AI has put on table (LPA)
  leversUsed: NegotiationLever[];        // ordered history
  lastAiText: string;                    // for verbatim-repeat detection

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

export function initState(input: InitStateInput): NegotiationState {
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
    highestOfferMade: 0,
    leversUsed: [],
    lastAiText: "",
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
}

/* Parse the candidate's free-text answer for salary-relevant numbers
   and intent signals. Distinguishes "my current package is X" (currentCtc)
   from "I'm looking for Y" (target). Strict ordering: current/competing
   patterns claim their numbers first; target patterns only bind a
   number that wasn't already bound elsewhere. This is what the legacy
   extractor did across the whole transcript every render; here we run
   it once per candidate turn against the single fresh answer. */
export function parseCandidateAnswer(answer: string): ParsedAnswer {
  const a = (answer || "").trim();
  if (!a) {
    return { target: null, currentCtc: null, competing: null, signalsAcceptance: false, signalsWalkAway: false };
  }

  /* Acceptance / walk-away (single-turn). The session-long sticky
     check sits in applyCandidateAnswer (consults existing state). */
  const acceptPat = /(?:i (?:would like to |want to |'?d like to )?accept(?:\s+(?:this|the|your))?\s*(?:offer)?|sounds good|that works|it.?s a deal|let.?s go ahead|happy to accept|i agree|i.?m happy with that)\b/i;
  const conditionalPat = /\b(?:if|unless|provided|on condition|contingent|only\s+if)\b/i;
  const negotiatingButPat = /\b(?:but|however)\s+(?:i\s+)?(?:want|need|would like|expect|require)?\s*(?:more|higher|better|increase|raise|reduce|lower|stretch|change|different|bump|up|further|additional)/i;
  const walkAwayPat = /\b(walk away|walking away|i.?m out|not interested|i.?ll pass|no deal|withdraw|decline|won.?t work|isn.?t going to work|have to pass|that won.?t work|move on)\b/i;
  const signalsAcceptance = acceptPat.test(a) && !conditionalPat.test(a) && !negotiatingButPat.test(a) && !walkAwayPat.test(a);
  const signalsWalkAway = walkAwayPat.test(a);

  /* Current-CTC patterns. These claim their number FIRST so the
     target regex can't accidentally pick "8.5" out of "my current
     package is 8.5 LPA" — that exact bug shipped in production
     (Bombay Design Centre session, May 2026). */
  const currentCtc = extractFirstNumber(a, [
    /\b(?:my\s+)?current(?:ly)?\s+(?:package|salary|ctc|comp(?:ensation)?|pay|role)[^.!?\n₹]{0,30}?₹?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b|cr|crore)/i,
    /\b(?:currently|earning|getting|drawing|my\s+ctc|i.?m\s+at|making|take\s+home|i\s+get|i\s+earn)\s.*?₹?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b|cr|crore)/i,
    /\bpackage\s+progression[^.!?\n₹]{0,30}?₹?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b|cr|crore)/i,
  ]);

  /* Competing-offer patterns. Also must NOT bind to target. */
  const competing = extractFirstNumber(a, [
    /(?:offer\s+of|in[-\s]?hand(?:\s+offer)?\s+(?:of|at)?|already\s+have|received|competing\s+offer\s+(?:of|at)?|got\s+an\s+offer\s+(?:of|at)?|another\s+offer\s+(?:of|at)?)\s*₹?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|cr|crore)/i,
  ]);

  /* Target patterns. We require explicit ask context to bind — bare
     numbers are ignored to avoid "currently 8.5" leaking to target.
     Both directions matter for Indian candidates:
       - English / pre-number: "want / expecting / looking for N LPA"
       - Hindi-mix / post-number: "N lakh chahiye", "N LPA ka package",
         "N lakh mil jaye", "N LPA milna chahiye" — common in mixed
         Hindi-English STT output, previously dropped on the floor. */
  const targetCtxPat = /(?:expecting|want|need|asking|target|hoping|looking\s+for|would\s+like|i.?d\s+like|aim(?:ing)?\s+for|comfortable\s+with|settle\s+for|around|mujhe|mera\s+target)\s+(?:to\s+(?:have|get)\s+)?(?:an?\s+|about\s+|approximately\s+|roughly\s+)?₹?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b|cr|crore)?/i;
  const targetHindiPostPat = /₹?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|lakh|l\b|cr|crore)\s+(?:chahiye|ka\s+package|mil\s+jaye|milna\s+chahiye|expect\s+kar(?:ta|ti)\s+hu|chahta\s+hu|chahti\s+hu)/i;
  let target = extractFirstNumber(a, [targetCtxPat, targetHindiPostPat]);

  /* Disambiguation: if a number was already bound to current/
     competing, it isn't ALSO the target — drop it. */
  if (target != null && (target === currentCtc || target === competing)) {
    target = null;
  }

  return { target, currentCtc, competing, signalsAcceptance, signalsWalkAway };
}

/* Extract the first numeric value from `text` using any of `patterns`.
   Output is normalised to LPA.

   Unit handling: when the matched substring contains a crore marker
   (`cr` / `crore`) we multiply by 100 so "5 crore" → 500 LPA. Without
   this, the senior/exec hiring path silently truncated magnitude (we
   captured the digit `5` but treated it as 5 LPA). Clamp is widened
   to 5000 LPA (= 50 crore) which covers C-suite while still rejecting
   garbage from STT mishears like "five hundred thousand". */
function extractFirstNumber(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m && m[1]) {
      let n = parseFloat(m[1]);
      if (!Number.isFinite(n)) continue;
      const isCrore = /\bcr\b|crore/i.test(m[0]);
      if (isCrore) n *= 100;
      if (n >= 1 && n <= 5000) return n;
    }
  }
  return null;
}

/* ─── State transition: fold candidate's answer into state ───────── */

/** Apply a candidate turn to state. Returns a new state — never
 *  mutates the input. Terminal phases are sticky: if state.phase is
 *  already terminal, returns state unchanged. */
export function applyCandidateAnswer(state: NegotiationState, answer: string): NegotiationState {
  if (isTerminalPhase(state.phase)) return state;

  const parsed = parseCandidateAnswer(answer);
  const next: NegotiationState = { ...state, leversUsed: [...state.leversUsed] };

  /* Bind newly-stated facts. Last-stated wins (the candidate may
     revise their target mid-conversation; that's allowed). */
  if (parsed.target != null) next.candidateTarget = parsed.target;
  if (parsed.currentCtc != null) next.candidateCurrentCtc = parsed.currentCtc;
  if (parsed.competing != null) next.competingOffer = parsed.competing;

  /* Terminal transitions. */
  if (parsed.signalsAcceptance) {
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
  const next: NegotiationState = { ...state, leversUsed: [...state.leversUsed] };
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

  /* Counter-offer: split toward target, capped at maxStretch. */
  if (state.phase === "counter-offer") {
    const target = state.candidateTarget ?? state.band.maxStretch;
    const floor = Math.max(state.highestOfferMade, state.band.initialOffer);
    const ceiling = state.band.maxStretch;
    const aspiration = Math.min(target, ceiling);

    /* No headroom → switch to lever-explore. */
    if (aspiration <= floor + 0.1) {
      return pickLeverExploreMove(state);
    }
    const newTotal = Math.round((floor + (aspiration - floor) * 0.5) * 10) / 10;
    return {
      lever: "counter-base",
      newTotalLpa: newTotal,
      rationale: `Split toward target: floor ₹${floor} → ₹${newTotal} (target ₹${target}, ceiling ₹${ceiling}).`,
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
 *  violates the band? Returns the first violating number or null.
 *  Used by the route handler to detect when the LLM has invented a
 *  number outside the approved band. */
export function findOutOfBandNumber(text: string, band: NegotiationBand): number | null {
  const re = /₹\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseFloat(m[1]);
    if (!Number.isFinite(n)) continue;
    if (n > band.maxStretch + 0.01 || n < band.walkAway - 0.01) return n;
  }
  return null;
}

/** Verbatim-repeat check. The LLM occasionally regenerates the
 *  identical question two turns in a row; this catches it without
 *  relying on Jaccard tuning. Returns true if `text` shares an
 *  8-content-word prefix with state.lastAiText. */
export function isVerbatimRepeat(text: string, state: NegotiationState): boolean {
  if (!state.lastAiText || !text) return false;
  return prefixFingerprint(text) === prefixFingerprint(state.lastAiText);
}

const STOP_WORDS = new Set([
  "the","a","an","is","are","be","you","your","i","we","our","that","this","of","to","for",
  "and","or","but","with","what","how","do","does","can","could","would","should","let","me",
  "just","in","on","at","by","as","so","if","like","than","then","its","it","ll","ve","re",
]);

function prefixFingerprint(s: string): string {
  return s.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 8)
    .join(" ");
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
}

export function deserializeState(json: string): NegotiationState {
  const parsed: unknown = JSON.parse(json);
  validateState(parsed);
  return parsed;
}
