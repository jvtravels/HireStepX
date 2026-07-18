/* Deterministic salary-negotiation report fallback (#PRI-51).
 *
 * Why this exists: a full coached report needs the LLM only for the `parsed`
 * slice (skills / overallScore / verdict / wins / fixes). Everything else in
 * evaluate-session's report assembly — coreMetrics, advancedDelivery, redFlags,
 * fairnessSignals, calibration, bands, the client-side Deal Summary — is built
 * deterministically from the transcript and analyzers. So when the entire LLM
 * provider chain is down/quota'd (70b → gemini → cerebras → 8b all throw), the
 * robust answer is NOT another 503 dead-end on a 25-minute interview: it is to
 * synthesize JUST that `parsed` slice from transcript signals and fall through
 * to the existing, tested assembly. The candidate gets a real, honest report
 * (skill breakdown + verdict + Deal Summary) flagged as an estimate, instead of
 * "couldn't generate — retry".
 *
 * This is salary-negotiation ONLY. The six axes mirror NEGOTIATION_SKILL_AXES
 * verbatim so the synthesized breakdown lines up with the live rubric.
 *
 * Pure + unit-tested (deterministicNegReport.test.ts). No LLM, no I/O.
 */

export interface NegReportTurn {
  role: string; // "interviewer" | "candidate" | ...
  text: string;
}

/* Authoritative session-exit read, mirrors the kernel/metrics enum
   (_negotiation-metrics.ts: "accepted" | "walked-away" | "stalemate" |
   "in-progress"). Threaded in from the caller — NOT re-derived from the
   transcript — because a stalemate is a kernel-state fact (ran out of turns
   without resolution), not something a keyword scan can honestly infer. */
export type NegOutcome = "accepted" | "walked-away" | "stalemate" | "in-progress";

/* A no-agreement deadlock: the session ended without either side yielding.
   On these, the candidate's problem is the impasse itself, not a failure to
   state a walk-away floor — so floor-coaching would be false advice. */
function isDeadlockOutcome(outcome: NegOutcome | undefined): boolean {
  return outcome === "stalemate" || outcome === "walked-away";
}

/* Matches NEGOTIATION_SKILL_AXES in _evaluate-session-helpers.ts. Duplicated
   here (not imported) to keep this module dependency-free and trivially
   testable; a drift guard test asserts the two lists stay identical. */
export const NEG_AXES = [
  "Anchor strength",
  "Counter-offer judgement",
  "Trade-off awareness",
  "Structural fluency",
  "Tactical composure",
  "Walk-away discipline",
] as const;

export interface DeterministicNegReport {
  skills: Array<{ name: string; score: number }>;
  overallScore: number;
  scoreConfidence: number;
  verdict: string;
  wins: Array<{ text: string; questionIdx: number; quote: string }>;
  fixes: Array<{ text: string; questionIdx: number; quote: string }>;
}

/* A compensation figure in LPA: "65", "65 LPA", "65L", "65 lakh", "1.2 cr". */
const COMP_NUM_RE = /\b(\d{1,3}(?:\.\d{1,2})?)\s*(?:lpa|lakhs?|lacs?|l\b|cr\b|crores?|k\b)?/i;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function has(corpus: string, ...needles: string[]): boolean {
  return needles.some((n) => corpus.includes(n));
}

function countMatches(corpus: string, re: RegExp): number {
  const m = corpus.match(re);
  return m ? m.length : 0;
}

/* Score one axis from boolean/graded signals: baseline 55, +/- evidence,
   clamped to a believable 35-90 band (never a flat 50, never a fake 95). */
function axisScore(base: number, points: number): number {
  return Math.round(clamp(base + points, 35, 90));
}

/**
 * Synthesize the LLM `parsed` slice of a salary-negotiation report from the
 * transcript alone. Heuristic, transcript-grounded, and deliberately
 * conservative (scoreConfidence ~0.4) so the UI flags it as an estimate.
 */
export function buildDeterministicNegotiationReport(
  transcript: ReadonlyArray<NegReportTurn>,
  outcome?: NegOutcome,
): DeterministicNegReport {
  const candidateTurns = transcript.filter(
    (t) => t.role === "candidate" && typeof t.text === "string" && t.text.trim().length > 0,
  );
  const corpus = candidateTurns.map((t) => t.text).join("\n");
  const lc = corpus.toLowerCase();

  // ── Signal extraction ────────────────────────────────────────────────
  const namedNumber = COMP_NUM_RE.test(corpus);
  const anchoredTarget =
    /\b(?:target(?:ing)?|expecting|looking for|aiming|hoping for|want(?:ing)? (?:at least|around)?|need(?:ing)? (?:at least|around)?|ask(?:ing)?)\b/i.test(
      lc,
    ) && namedNumber;
  const counterSignals = countMatches(
    lc,
    /\b(?:counter|can we|could we|would you consider|i was hoping|push (?:back|to)|match|bump|revise|come up to|meet me)\b/gi,
  );
  const tradeoffSignals = countMatches(
    lc,
    /\b(?:esop|equity|rsu|variable|joining bonus|sign[- ]?on|sign(?:ing)? bonus|in lieu|instead of|trade|flexible on|relocation|wfh|remote|notice period|stock)\b/gi,
  );
  /* A candidate-INITIATED trade, not a bare mention. tradeoffSignals fires on
     any lever term anywhere in the corpus — so "what's the notice period?" or
     "you offer variable pay" over-matches and would falsely credit a structural
     lever the candidate never actually put on the table as a trade. The
     structural-levers WIN requires a lever term co-occurring with explicit
     trade framing (instead of / in lieu of / in exchange for / swap / rather
     than / trade X for Y / if cash|base is capped …). A discovery question or
     acknowledgement satisfies neither clause. */
  const LEVER_TERM = String.raw`esop|equity|rsu|variable|joining bonus|sign[- ]?on|sign(?:ing)? bonus|relocation|wfh|remote|notice period|stock`;
  const TRADE_FRAME = String.raw`instead of|in lieu of|in exchange for|rather than|\btrade\b|\bswap\b|move (?:it|that|the \w+) (?:to|into)|if (?:the )?(?:cash|base|fixed|salary) (?:is |are )?capped`;
  const leverTradeInitiated =
    new RegExp(String.raw`(?:${LEVER_TERM})[^.?!]{0,80}(?:${TRADE_FRAME})`, "i").test(lc) ||
    new RegExp(String.raw`(?:${TRADE_FRAME})[^.?!]{0,80}(?:${LEVER_TERM})`, "i").test(lc);
  const structuralSignals = countMatches(
    lc,
    /\b(?:fixed|variable|ctc|base|total comp|in[- ]?hand|breakdown|split|gross|net|per annum|annum|component)\b/gi,
  );
  const composureSignals = has(
    lc,
    "appreciate",
    "understand",
    "thank",
    "makes sense",
    "i hear",
    "fair enough",
    "i get that",
    "respect",
  );
  const walkAwaySignals = has(
    lc,
    "walk away",
    "other offer",
    "competing",
    "explore other",
    "deadline",
    "can't go below",
    "cannot go below",
    "my minimum",
    "deal-breaker",
    "deal breaker",
    "floor",
    "below my",
  );
  // Caved on the very first recruiter offer (no back-and-forth) — only count
  // it as a composure/discipline ding if the candidate did engage at all.
  const acceptedEarly =
    candidateTurns.length <= 2 &&
    /\b(?:accept|i'll take|works for me|let's do it|deal|happy to)\b/i.test(lc);

  // ── Per-axis scoring ─────────────────────────────────────────────────
  const skills = [
    { name: NEG_AXES[0], score: axisScore(52, (anchoredTarget ? 22 : 0) + (namedNumber ? 8 : -8)) },
    { name: NEG_AXES[1], score: axisScore(50, Math.min(counterSignals, 3) * 10 + (namedNumber ? 6 : -6)) },
    { name: NEG_AXES[2], score: axisScore(50, Math.min(tradeoffSignals, 4) * 8) },
    { name: NEG_AXES[3], score: axisScore(52, Math.min(structuralSignals, 4) * 7) },
    {
      name: NEG_AXES[4],
      score: axisScore(58, (composureSignals ? 14 : 0) + (acceptedEarly ? -12 : 0)),
    },
    {
      name: NEG_AXES[5],
      score: axisScore(52, (walkAwaySignals ? 20 : 0) + (acceptedEarly ? -10 : 0)),
    },
  ];

  const overallScore = Math.round(
    skills.reduce((sum, s) => sum + s.score, 0) / skills.length,
  );

  // ── Outcome read for the verdict ─────────────────────────────────────
  const closed = /\b(?:accept|deal|let's do it|works for me|happy to accept|sounds good|i'm in)\b/i.test(
    lc,
  );
  const engaged = candidateTurns.length >= 3;
  const outcomeClause = closed
    ? "you engaged the recruiter and moved toward a close"
    : engaged
      ? "you held the negotiation through multiple turns"
      : "the conversation stayed brief";
  const anchorClause = anchoredTarget
    ? "named a clear target"
    : namedNumber
      ? "put numbers on the table"
      : "kept things qualitative";

  const verdict = (
    `Estimated from your transcript — live AI grading was briefly unavailable, so this score is heuristic. ` +
    `You ${anchorClause} and ${outcomeClause}. Re-run evaluation for a full AI-graded report.`
  ).slice(0, 200);

  // ── Wins / fixes (cross-cutting, questionIdx -1 so they survive grounding) ──
  const wins: DeterministicNegReport["wins"] = [];
  const fixes: DeterministicNegReport["fixes"] = [];
  if (anchoredTarget) {
    wins.push({ text: "You anchored with a specific target rather than waiting to be offered a number.", questionIdx: -1, quote: "" });
  } else if (counterSignals > 0) {
    wins.push({ text: "You pushed back on the first offer instead of accepting it outright.", questionIdx: -1, quote: "" });
  }
  if (leverTradeInitiated) {
    wins.push({ text: "You brought structural levers (equity / variable / joining bonus) into the conversation.", questionIdx: -1, quote: "" });
  }
  if (!anchoredTarget) {
    fixes.push({ text: "Open with a concrete target number early — anchoring first sets the negotiation range.", questionIdx: -1, quote: "" });
  }
  if (tradeoffSignals === 0) {
    fixes.push({ text: "Trade across components: if cash is capped, ask for ESOP, joining bonus, or variable instead.", questionIdx: -1, quote: "" });
  }
  if (!walkAwaySignals && !isDeadlockOutcome(outcome)) {
    // Suppress on a no-agreement/stalemate deadlock: the candidate's problem
    // there is the impasse, not a missing floor — floor-coaching would be false
    // advice. Only surfaces on settled/accepted sessions where no floor was set.
    fixes.push({ text: "State a walk-away floor or a competing option to give your counter real leverage.", questionIdx: -1, quote: "" });
  }

  return {
    skills,
    overallScore,
    // Deliberately low: this is a transcript-heuristic estimate, not an AI grade.
    scoreConfidence: 0.4,
    verdict,
    wins: wins.slice(0, 3),
    fixes: fixes.slice(0, 3),
  };
}
