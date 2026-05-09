/**
 * Codified definition of "broken" for the salary-negotiation feature.
 *
 * This module exists because "fix-the-bug-I-can-see" was failing — every
 * round patched the screenshot in front of me but a different bug
 * surfaced the next session. Until "broken" was a concrete predicate
 * over (transcript, llmOutput, band), every "fixed" claim was guess-
 * work. Now: each known failure mode is a pure function. The replay
 * harness in scripts/replay-negotiation.mts feeds saved sessions
 * through this detector to confirm whether a fix actually changed the
 * output for the same input.
 *
 * Design rules:
 *  - Pure functions, no I/O. Unit-testable.
 *  - One function per failure mode, named after the user-facing symptom.
 *  - Each returns NegotiationFailure | null. The CLI collects them.
 *  - Severity (blocker / major / minor) is the harness's call, not ours.
 *  - When a failure can't be detected without ambiguity, we err on
 *    flagging it. False positives are noise; false negatives are the
 *    bug pattern we already have.
 */

export interface NegotiationFailure {
  /** Stable ID for grouping across runs. e.g. "premature-close" */
  code: string;
  /** Human description of what went wrong. */
  message: string;
  /** Excerpt of the offending text (first ~120 chars). */
  evidence?: string;
  /** Severity hint — used by the harness for filtering / sorting. */
  severity: "blocker" | "major" | "minor";
}

export interface DetectorContext {
  /** The AI's most recent reply (the followUpText returned to the candidate). */
  llmOutput: string;
  /** Did the candidate explicitly accept? Pulled from extractNegotiationFacts. */
  acceptedImmediately: boolean;
  /** Did the candidate deflect/decline? */
  rejectedOutright?: boolean;
  /** Candidate's stated target as an LPA number, if any. */
  candidateTargetLpa?: number | null;
  /** Candidate's competing/in-hand offer as an LPA number, if any. */
  competingOfferLpa?: number | null;
  /** Negotiation band — initialOffer / maxStretch / walkAway in LPA. */
  band?: {
    initialOffer: number;
    maxStretch: number;
    walkAway: number;
    hasEquity?: boolean;
  };
  /** Phase the engine routed to for this turn. */
  phase?: string;
  /** 0-indexed turn within the negotiation. */
  questionIndex?: number;
  /** Whether this turn is the INITIAL offer (turn 1 / step 2). */
  isInitialOffer?: boolean;
  /** Highest offer the AI has actually MADE so far this session (LPA).
   *  Distinct from band.initialOffer — this is the live ceiling the AI
   *  has committed to in prior turns. Used to detect phantom counter
   *  movement: "our current offer of ₹X" when X > highestOfferMade. */
  highestOfferMade?: number | null;
  /** Prior AI turns in the same session, oldest first. Used to detect
   *  repeated questions (e.g. asking notice-period twice). */
  previousAiTurns?: string[];
}

/* ── #1 Premature close ───────────────────────────────────────────── */
export function detectPrematureClose(ctx: DetectorContext): NegotiationFailure | null {
  if (ctx.acceptedImmediately) return null;
  // Closing language patterns. Each pattern below was observed in a
  // production session that the previous regex set missed — the
  // Flipkart-session-2 retest produced "I'll work with HR to put
  // together the final, formal offer letter… within 24-48 hours" which
  // doesn't match "let me put together the final numbers" or "HR will
  // send" anchors. The regex set is now broader; new variants → add a
  // pattern, never paper over.
  const closingPatterns = [
    /let me put together the final numbers/i,
    /(?:I[''’]?ll|we[''’]?ll|going\s+to)\s+work\s+with\s+HR\s+to\s+(?:put\s+together|prepare|finalize|draft)/i,
    /put\s+together\s+the\s+(?:final[,\s]+)?(?:formal\s+)?offer\s+letter/i,
    /HR (?:will\s+)?send\s+you\s+the\s+(?:formal\s+)?offer\s+letter/i,
    /(?:get\s+(?:that|it|the\s+offer\s+letter)\s+to\s+you|(?:offer\s+letter|paperwork)\s+(?:in|within)\s+(?:the\s+)?next\s+\d+[-–\s]*\d*\s*(?:hours|days|weeks))/i,
    /finaliz(?:e|ing)\s+(?:the\s+)?(?:offer|package|paperwork|details)/i,
    /\bwelcome\s+(?:to\s+the\s+team|aboard)\b/i,
    /look\s+forward\s+to\s+having\s+you\s+(?:on\s+)?(?:the\s+team|board)/i,
    /\bcongratulations\b.{0,40}(?:joining|offer|accepted)/i,
    /\bwith\s+(?:these|those|the)\s+adjustments\b/i,
  ];
  for (const re of closingPatterns) {
    const m = ctx.llmOutput.match(re);
    if (m) {
      return {
        code: "premature-close",
        message: "AI used closing language without explicit candidate acceptance — stating a target ≠ accepting.",
        evidence: m[0],
        severity: "blocker",
      };
    }
  }
  return null;
}

/* ── #2 Initial-offer breakdown leak ──────────────────────────────── */
export function detectInitialOfferBreakdownLeak(ctx: DetectorContext): NegotiationFailure | null {
  if (!ctx.isInitialOffer) return null;
  // If the candidate already asked for the breakdown in the same turn,
  // this isn't a leak — the AI is responding correctly. We don't have
  // turn-level "asked for breakdown" state here, but the initial offer
  // is by definition the FIRST AI offer turn, before the candidate has
  // had a chance to ask anything.
  const componentTokens = [
    /\bbase\s+(?:salary|pay|component)\b/i,
    /\bvariable\s+(?:component|pay|bonus)\b/i,
    /\bjoining\s+bonus\b/i,
    /\bgratuity\b/i,
    /\bprovident\s+fund\b/i,
    /\bPF\b(?!\s*(?:Chang|Sanjay))/, // PF as in Provident Fund
    /\bESOPs?\b/i,
    /\bRSUs?\b/i,
    /\bstock\s+options\b/i,
  ];
  const hits = componentTokens.filter(re => re.test(ctx.llmOutput));
  // One mention is "headline + invite". Two or more = breakdown.
  if (hits.length >= 2) {
    const evidence = hits
      .map(re => ctx.llmOutput.match(re)?.[0])
      .filter(Boolean)
      .join(" + ");
    return {
      code: "initial-offer-breakdown-leak",
      message: `Initial offer included ${hits.length} breakdown components (Indian-HR convention is headline-only on turn 1).`,
      evidence,
      severity: "major",
    };
  }
  return null;
}

/* ── #3 Above-maxStretch offer ────────────────────────────────────── */
export function detectAboveMaxStretch(ctx: DetectorContext): NegotiationFailure | null {
  if (!ctx.band) return null;
  const re = /₹?\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?|cr|crore)/g;
  const target = ctx.candidateTargetLpa ?? null;
  const competing = ctx.competingOfferLpa ?? null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ctx.llmOutput)) !== null) {
    const isCr = /cr|crore/i.test(m[0]);
    const v = parseFloat(m[1]) * (isCr ? 100 : 1);
    // Skip numbers that echo the candidate's stated target / competing
    // offer — those are the AI repeating back, not making an offer.
    if (target != null && Math.abs(v - target) < 0.5) continue;
    if (competing != null && Math.abs(v - competing) < 0.5) continue;
    // 5% tolerance matches the existing follow-up.ts clamp threshold.
    if (v > ctx.band.maxStretch * 1.05) {
      return {
        code: "above-max-stretch",
        message: `AI offered ₹${v} LPA, above maxStretch ₹${ctx.band.maxStretch} LPA (5% tolerance).`,
        evidence: m[0],
        severity: "blocker",
      };
    }
  }
  return null;
}

/* ── #4 ESOP / equity leak when band has no equity ────────────────── */
export function detectEquityLeakOnNonEquityBand(ctx: DetectorContext): NegotiationFailure | null {
  if (!ctx.band) return null;
  if (ctx.band.hasEquity) return null; // band grants equity — mention is fine
  const re = /\b(?:ESOPs?|RSUs?|stock\s+options|equity|vesting|cliff)\b/i;
  const m = ctx.llmOutput.match(re);
  if (m) {
    return {
      code: "equity-leak-on-non-equity-band",
      message: "AI mentioned equity/ESOPs but the band has hasEquity=false — this role doesn't grant equity.",
      evidence: m[0],
      severity: "major",
    };
  }
  return null;
}

/* ── #5 ESOP mention in initial offer regardless of band ──────────── */
export function detectEsopInInitialOffer(ctx: DetectorContext): NegotiationFailure | null {
  if (!ctx.isInitialOffer) return null;
  const re = /\b(?:ESOPs?|RSUs?|stock\s+options|equity)\b/i;
  const m = ctx.llmOutput.match(re);
  if (m) {
    return {
      code: "esop-in-initial-offer",
      message: "AI mentioned equity/ESOPs in the initial offer — Indian-HR convention defers equity to benefits-discussion or candidate-raised.",
      evidence: m[0],
      severity: "major",
    };
  }
  return null;
}

/* ── #6 Number-echo mis-bind ──────────────────────────────────────── */
export function detectNumberEchoMisbind(ctx: DetectorContext): NegotiationFailure | null {
  if (ctx.candidateTargetLpa == null) return null;
  // Pattern: "I heard ₹X" / "you mentioned ₹X" / "your target of ₹X" /
  // "thinking around ₹X" — when followed by an LPA number that ISN'T
  // the candidate's actual stated target. This was the Flipkart
  // "thinking around ₹58 LPAs" bug when candidate had said ₹70.
  // Anchor phrases the AI uses when paraphrasing the candidate's stated
  // target. Each captured group is the LPA number it claims to be
  // echoing. Trailing-s on LPA matches the LLM's frequent "₹20 LPAs"
  // pluralization. Real session that motivated each addition is in a
  // comment in the harness's fixtures/flipkart-ux-*.json.
  const echoPatterns = [
    /(?:i\s+heard|you\s+(?:mentioned|said|stated)|your\s+(?:target|number)\s+of|thinking\s+around|looking\s+(?:for|at)|you[''’]?re\s+(?:looking|asking|seeking|targeting|thinking)(?:\s+(?:for|at|about|around))?|seeing|you\s+want)\s+(?:a\s+(?:total\s+)?(?:CTC|salary|package)\s+of\s+(?:around\s+)?)?₹?\s*(\d+(?:\.\d+)?)\s*(?:LPAs?|lpas?|lakhs?|cr|crore)/gi,
  ];
  const target = ctx.candidateTargetLpa;
  const competing = ctx.competingOfferLpa ?? null;
  for (const re of echoPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(ctx.llmOutput)) !== null) {
      const echoed = parseFloat(m[1]);
      if (Number.isNaN(echoed)) continue;
      // Allow the echo to match either the target OR the competing
      // offer (both are things the candidate may have said). Anything
      // else is a hallucination.
      const matchesTarget = Math.abs(echoed - target) < 0.5;
      const matchesCompeting = competing != null && Math.abs(echoed - competing) < 0.5;
      if (!matchesTarget && !matchesCompeting) {
        return {
          code: "number-echo-misbind",
          message: `AI echoed "${m[0].trim()}" but candidate stated target ₹${target} LPA${competing != null ? ` and competing offer ₹${competing} LPA` : ""}.`,
          evidence: m[0],
          severity: "blocker",
        };
      }
    }
  }
  return null;
}

/* ── #7 Markdown leak ─────────────────────────────────────────────── */
export function detectMarkdownLeak(ctx: DetectorContext): NegotiationFailure | null {
  // Bold/italic/code/bullet markers leaking through to TTS/render.
  // The post-LLM stripper in follow-up.ts should remove these — if any
  // survive into the output passed to this detector, the stripper is
  // missing a case.
  const patterns: Array<[RegExp, string]> = [
    [/\*\*[^*\n]+\*\*/, "bold (**)"],
    [/(?<![A-Za-z0-9])\*[^*\n]+\*(?![A-Za-z0-9])/, "italic (*)"],
    [/(?<![A-Za-z0-9])_[^_\n]+_(?![A-Za-z0-9])/, "italic (_)"],
    [/`[^`\n]+`/, "code (`)"],
    [/^\s*[*\-•]\s+/m, "bullet marker"],
  ];
  for (const [re, label] of patterns) {
    const m = ctx.llmOutput.match(re);
    if (m) {
      return {
        code: "markdown-leak",
        message: `Markdown ${label} survived the post-LLM stripper.`,
        evidence: m[0],
        severity: "minor",
      };
    }
  }
  return null;
}

/* ── #8 Placeholder leak ──────────────────────────────────────────── */
export function detectPlaceholderLeak(ctx: DetectorContext): NegotiationFailure | null {
  // ₹X / ₹Y / [amount] / [number] / TBD — placeholders the LLM was
  // supposed to substitute and didn't.
  const re = /(?:₹\s*[XYZWV]\b|\[amount\]|\[number\]|\bTBD\b|\[\.\.\.\])/;
  const m = ctx.llmOutput.match(re);
  if (m) {
    return {
      code: "placeholder-leak",
      message: "LLM left a placeholder unsubstituted in its reply.",
      evidence: m[0],
      severity: "blocker",
    };
  }
  return null;
}

/* ── #9 Phantom counter movement ──────────────────────────────────── */
/**
 * Flags when the AI's reply references "our current/latest/revised
 * offer of ₹X" with X > the highest offer the AI has actually made
 * this session. Real production bug from the Flipkart UX retest:
 *   turn 1: "₹20 LPA total CTC"           ← initial offer
 *   turn 5: "our current offer of ₹24 LPA" ← phantom — never countered
 * The "₹24" was the candidate's TARGET; the LLM conflated target with
 * offer and silently teleported the offer to match. The candidate sees
 * a confident hiring manager who happens to be lying. Detector requires
 * highestOfferMade context — when that's missing we fall back to the
 * band's initialOffer.
 */
export function detectPhantomCounter(ctx: DetectorContext): NegotiationFailure | null {
  const ceiling = ctx.highestOfferMade ?? ctx.band?.initialOffer ?? null;
  if (ceiling == null) return null;
  const re = /(?:our|the|my|company[''’]?s)\s+(?:current|latest|revised|updated|standing|new)\s+offer\s+of\s+₹?\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?|cr|crore)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ctx.llmOutput)) !== null) {
    const isCr = /cr|crore/i.test(m[0]);
    const v = parseFloat(m[1]) * (isCr ? 100 : 1);
    if (v > ceiling * 1.05) {
      return {
        code: "phantom-counter",
        message: `AI claimed "current offer of ₹${v} LPA" but highest offer this session was ₹${ceiling} LPA — counter was never explicitly stated.`,
        evidence: m[0],
        severity: "blocker",
      };
    }
  }
  return null;
}

/* ── #10 Repeated question ────────────────────────────────────────── */
/**
 * Flags when the AI asks the same probe twice (e.g. "What's your
 * notice period?" in turn 4 and again in turn 6). Candidate experience:
 * "you keep asking me the same thing." The existing Jaccard repetition
 * guard in follow-up.ts can miss probe-shape repeats when the
 * surrounding sentence varies; this is a post-hoc check on a small
 * set of probe signatures that hurt most when repeated.
 */
const PROBE_SIGNATURES: Array<[RegExp, string]> = [
  [/\bnotice\s+period\b/i, "notice-period"],
  [/\bjoining\s+(?:date|bonus)\b/i, "joining"],
  [/\bcurrent\s+CTC\b/i, "current-ctc"],
  [/\bcompeting\s+offer/i, "competing-offer"],
  [/what.{0,20}driving\s+(?:that|this|the)\s+number/i, "driving-number"],
  [/\bwhat\s+would\s+it\s+take\b/i, "what-would-it-take"],
];
/**
 * Returns true if `text` contains the probe phrase IN AN INTERROGATIVE
 * SHAPE — "What's your notice period?" counts; "Thanks for clarifying
 * your notice period" does not. Without this guard the detector flagged
 * turn-5 of the Flipkart retest where the AI was acknowledging the
 * answer it had received in turn-4. Heuristic: probe word must appear
 * in the same sentence as a question marker (?, what, when, can you,
 * could you, tell me, walk me, share, give us).
 */
function isProbeQuestion(text: string, probeRe: RegExp): boolean {
  // Split into rough sentence chunks — keep terminators with each chunk.
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    if (!probeRe.test(s)) continue;
    const interrog =
      /\?|^\s*(?:what|when|where|why|how|could|can|would|do)\b|\b(?:tell|let|walk)\s+me\b|\b(?:share|give\s+us)\b/i;
    if (interrog.test(s)) return true;
  }
  return false;
}

export function detectRepeatedQuestion(ctx: DetectorContext): NegotiationFailure | null {
  const prev = ctx.previousAiTurns;
  if (!prev || prev.length === 0) return null;
  const out = ctx.llmOutput;
  for (const [re, label] of PROBE_SIGNATURES) {
    if (!isProbeQuestion(out, re)) continue;
    const priorHit = prev.some(p => isProbeQuestion(p, re));
    if (priorHit) {
      return {
        code: "repeated-question",
        message: `AI asked the "${label}" probe again — already asked in a prior turn this session.`,
        evidence: out.slice(0, 140),
        severity: "major",
      };
    }
  }
  return null;
}

/* ── Aggregate runner ─────────────────────────────────────────────── */
const ALL_DETECTORS = [
  detectPrematureClose,
  detectInitialOfferBreakdownLeak,
  detectAboveMaxStretch,
  detectEquityLeakOnNonEquityBand,
  detectEsopInInitialOffer,
  detectNumberEchoMisbind,
  detectMarkdownLeak,
  detectPlaceholderLeak,
  detectPhantomCounter,
  detectRepeatedQuestion,
];

export function detectAllFailures(ctx: DetectorContext): NegotiationFailure[] {
  const out: NegotiationFailure[] = [];
  for (const fn of ALL_DETECTORS) {
    const f = fn(ctx);
    if (f) out.push(f);
  }
  return out;
}
