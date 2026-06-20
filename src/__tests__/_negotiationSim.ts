/* Offline negotiation simulator (2026-06-18).
 *
 * Replays a full salary negotiation through the REAL kernel + planner +
 * canonical-prose renderer — the exact deterministic path negotiate-turn.ts
 * ships when the LLM is off (the worst case we harden against). No network,
 * no browser: a whole conversation runs in microseconds, so the adversarial
 * battery can live in vitest instead of the flaky live harness.
 *
 * Faithful turn pipeline (mirrors negotiate-turn.ts):
 *   state = applyCandidateAnswer(state, answer)   // stamps plannedNextAction
 *   action = state.plannedNextAction              // the planner's decision
 *   move   = pickAiMove(state)
 *   text   = renderCanonicalProse(action, state)  // deterministic ship text
 *   state  = applyAiMove(state, move, text)
 */
import {
  initState,
  pickAiMove,
  applyAiMove,
  applyCandidateAnswer,
  isTerminalPhase,
  type NegotiationBand,
  type NegotiationState,
  type NegotiationPhase,
  type AiMove,
} from "../../server-handlers/_negotiation-kernel";
import {
  planNextAction,
  type NextAction,
} from "../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";

export interface SimTurn {
  candidate: string | null;
  aiText: string;
  kind: string;
  lever: string;
  phase: NegotiationPhase;
  highestOfferMade: number;
  terminal: boolean;
}

export interface SimOptions {
  sessionId?: string;
  role?: string;
  company?: string;
  band: NegotiationBand;
  /** Extra init fields (applicableYoe, experienceLevel, priorContext, …). */
  initExtras?: Record<string, unknown>;
  /** Candidate utterances, one per turn. */
  turns: string[];
  /** Stop driving once a terminal phase is reached (default true). */
  stopOnTerminal?: boolean;
}

function shipTurn(
  state: NegotiationState,
  candidate: string | null,
): { state: NegotiationState; turn: SimTurn } {
  const action = (state.plannedNextAction ?? planNextAction(state)) as NextAction;
  const move: AiMove = pickAiMove(state);
  const text = renderCanonicalProse(action, state);
  const next = applyAiMove(state, move, text);
  return {
    state: next,
    turn: {
      candidate,
      aiText: text,
      kind: action.kind,
      lever: move.lever,
      phase: next.phase,
      highestOfferMade: next.highestOfferMade,
      terminal: isTerminalPhase(next.phase),
    },
  };
}

export function runConversation(opts: SimOptions): {
  transcript: SimTurn[];
  finalState: NegotiationState;
} {
  const stopOnTerminal = opts.stopOnTerminal ?? true;
  let state = initState({
    sessionId: opts.sessionId ?? "sim",
    role: opts.role ?? "Software Engineer",
    company: opts.company ?? "Acme",
    band: opts.band,
    ...(opts.initExtras ?? {}),
  } as Parameters<typeof initState>[0]);

  const transcript: SimTurn[] = [];
  // Opening line.
  {
    const r = shipTurn(state, null);
    state = r.state;
    transcript.push(r.turn);
  }
  for (const ans of opts.turns) {
    state = applyCandidateAnswer(state, ans);
    const r = shipTurn(state, ans);
    state = r.state;
    transcript.push(r.turn);
    if (stopOnTerminal && isTerminalPhase(state.phase)) break;
  }
  return { transcript, finalState: state };
}

/* ── Invariant detectors ───────────────────────────────────────────── */

/** Content-free filler / deflection phrases the bot must never ship over a
 *  standing offer. These are the literal strings emitted by the legacy
 *  answer-direct branch, the contract fallback, and the humanizer prefix. */
export const FILLER_PHRASES: readonly string[] = [
  "let me come back to where we were",
  "happy to address that — let me come back",
  "coming back to the structure",
  "let me note that and come back",
  "sure — let me address that directly",
  "let me address that directly",
  "i realise i'm circling",
];

export function fillerHit(text: string): string | null {
  const t = (text || "").toLowerCase();
  for (const p of FILLER_PHRASES) if (t.includes(p)) return p;
  return null;
}

/** Indian-HR register violations. The bot is an Indian HR/recruiter; its
 *  language must use Indian comp vocabulary (LPA / lakh / CTC / ₹), address
 *  candidates by first name (no sir/ma'am), and never use US/foreign idioms
 *  ($/USD/401k/PTO/vacation/social-security). */
export interface RegisterViolation {
  rule: string;
  evidence: string;
}

const REGISTER_RULES: ReadonlyArray<{ rule: string; re: RegExp }> = [
  { rule: "honorific", re: /\b(sir|ma'?am|madam)\b/i },
  { rule: "usd-symbol", re: /\$\s?\d/ },
  { rule: "usd-word", re: /\b(usd|dollars?)\b/i },
  { rule: "us-retirement", re: /\b401\s?k\b/i },
  { rule: "us-leave-pto", re: /\bPTO\b/ },
  { rule: "us-vacation", re: /\bvacation\b/i },
  { rule: "us-social-security", re: /\bsocial security\b/i },
  // "$" amounts or "k" salary framing (US "120k") rather than LPA/lakh.
  { rule: "k-salary-framing", re: /\b\d{2,3}\s?k\b(?!\s?(?:m|km))/i },
  /* US baseball idiom (2026-06-21, live staging) — an Indian recruiter
   * says "rough figure / rough range", never "ballpark". Same #114
   * Americanism family as corridor/zip-code. */
  { rule: "us-idiom-ballpark", re: /\bball\s?park\b/i },
];

export function registerViolations(text: string): RegisterViolation[] {
  const out: RegisterViolation[] = [];
  for (const { rule, re } of REGISTER_RULES) {
    const m = (text || "").match(re);
    if (m) out.push({ rule, evidence: m[0] });
  }
  return out;
}

/** Indian-HR fluency violations (D5) — artifacts the realism overlay
 *  chain produced before the `tidyRealismArtifacts` output contract:
 *  stacked leading discourse fillers and a lowercase letter immediately
 *  after a sentence-final period. A clean recruiter utterance has neither. */
export interface FluencyViolation {
  rule: string;
  evidence: string;
}

/* A short list of the discourse openers the overlays prepend. Two or more
 * comma-separated in a row at the very start = a stacked-filler garble. */
const FLUENCY_OPENERS =
  "(?:look|frankly|honestly|basically|fundamentally|right|okay|ok|sure|yeah|well|actually|noted|fine|i mean|to be fair)";
const STACKED_OPENERS_RE = new RegExp(
  `^\\s*${FLUENCY_OPENERS}\\s*,\\s*${FLUENCY_OPENERS}\\s*[,.]`,
  "i",
);
/* Lowercase letter right after a sentence-final period + space (broken
 * capitalization). Excludes the "e.g." / "i.e." abbreviation shapes. */
const LOWER_AFTER_PERIOD_RE = /(?<![A-Za-z]\.[A-Za-z])[.!?]\s+[a-z]/;

export function fluencyViolations(text: string): FluencyViolation[] {
  const out: FluencyViolation[] = [];
  const t = text || "";
  const stacked = t.match(STACKED_OPENERS_RE);
  if (stacked) out.push({ rule: "stacked-openers", evidence: stacked[0] });
  const lower = t.match(LOWER_AFTER_PERIOD_RE);
  if (lower) out.push({ rule: "lowercase-after-period", evidence: lower[0] });
  return out;
}

/** Verbatim-loop detector — normalised equality with the prior AI line
 *  (mirrors negotiate-turn.ts's same-response guard normalize). */
const LEADING_ACK_RE =
  /^\s*(?:got it|okay|ok|right|sure|alright|noted|understood|fair enough|fine|i hear you)[\s,.\-—:;]+/i;
export function normLine(s: string): string {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(LEADING_ACK_RE, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");
}
