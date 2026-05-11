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
  /** Hiring company for this session (e.g. "Flipkart"). Used to detect
   *  hallucinated current-employer mentions. */
  hiringCompany?: string | null;
  /** Concatenated candidate transcript so far. Used as a corpus the
   *  detector can check before flagging "at <CompanyName>" — if the
   *  candidate did say it, it's not hallucinated. */
  candidateTranscript?: string | null;
  /** Canonical role label for this session (e.g. "ux-designer" slug
   *  or "UI/UX Designer" display). Used to detect role-title drift. */
  sessionRole?: string | null;
  /** The candidate's MOST RECENT message (their last turn before this
   *  AI reply). Distinct from candidateTranscript which is the full
   *  concatenation. Used by closing-with-pending-question. */
  candidateLastMessage?: string | null;
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
    /(?:let me\s+)?put\s+together\s+(?:the\s+)?final\s+numbers/i,
    /(?:I[''’]?ll|we[''’]?ll|going\s+to)\s+work\s+with\s+HR\s+to\s+(?:put\s+together|prepare|finalize|draft)/i,
    /put\s+together\s+the\s+(?:final[,\s]+)?(?:formal\s+)?offer\s+letter/i,
    /HR (?:will\s+)?send\s+you\s+(?:the|a)\s+(?:formal\s+)?offer\s+letter/i,
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
    /(?:i\s+heard|you\s+(?:mentioned|said|stated)|your\s+(?:target|number)\s+of|thinking\s+around|looking\s+(?:for|at)|you[''’]?re\s+(?:looking|asking|seeking|targeting|thinking)(?:\s+(?:for|at|about|around))?|seeing|you\s+want|driving\s+(?:that|this|the))\s+(?:a\s+(?:total\s+)?(?:CTC|salary|package)\s+of\s+(?:around\s+)?)?₹?\s*(\d+(?:\.\d+)?)\s*(?:LPAs?|lpas?|lakhs?|cr|crore)/gi,
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
  // Pattern A — named offer phrase ("our current/best/revised offer")
  // followed (within ~160 chars, possibly past commas/parentheticals) by
  // an LPA value. Decoupled because real LLM output puts the value past
  // a clause: "My current best offer, considering the role and our
  // internal bands, is a total CTC of ₹40 LPA".
  const reA = /(?:our|the|my|company[''’]?s)\s+(?:current|latest|revised|updated|standing|new|best)\s+(?:best\s+)?offer\b[^.!?]{0,160}?₹?\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?|cr|crore)/gi;
  // Pattern B — "the ₹X LPA package/offer/CTC" (computed-number leak,
  // e.g. AI references the band's internal initialOffer ₹30.4 when the
  // headline shown to the candidate was rounded to ₹30).
  const reB = /(?:^|[\s,;.])(?:the|our)\s+₹?\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?|cr|crore)\s+(?:package|offer|comp(?:ensation)?|CTC)/gi;
  // For pattern A (named offer phrase): fire when the value exceeds
  // highestOfferMade by >5% — classic phantom-bumped offer.
  // For pattern B ("the ₹X package"): fire when the value doesn't match
  // ANY known reference (highest offer made, candidate target, competing
  // offer) within 0.5 LPA — catches fabricated numbers like ₹30.4 when
  // the headline was ₹30 (precision leak from internal band).
  const refs = [
    ctx.highestOfferMade ?? null,
    ctx.candidateTargetLpa ?? null,
    ctx.competingOfferLpa ?? null,
  ].filter((n): n is number => n != null);
  // Pattern B uses tight tolerance (0.15 LPA ≈ ₹15k) — the bug it
  // catches is "₹30.4 LPA package" when the offer was rendered as
  // ₹30 LPA (internal band's exact initialOffer leaked through). 0.5
  // tolerance would mask precision-leaks that vary by ≤₹50k.
  const matchesAnyRef = (v: number) => refs.some(r => Math.abs(v - r) < 0.15);
  let m: RegExpExecArray | null;
  while ((m = reA.exec(ctx.llmOutput)) !== null) {
    const isCr = /cr|crore/i.test(m[0]);
    const v = parseFloat(m[1]) * (isCr ? 100 : 1);
    if (v > ceiling * 1.05) {
      return {
        code: "phantom-counter",
        message: `AI claimed "${m[0].trim()}" but highest offer this session was ₹${ceiling} LPA — counter was never explicitly stated.`,
        evidence: m[0],
        severity: "blocker",
      };
    }
  }
  while ((m = reB.exec(ctx.llmOutput)) !== null) {
    const isCr = /cr|crore/i.test(m[0]);
    const v = parseFloat(m[1]) * (isCr ? 100 : 1);
    if (!matchesAnyRef(v)) {
      return {
        code: "phantom-counter",
        message: `AI referenced "${m[0].trim()}" — that number wasn't the offer (₹${ceiling}), the candidate's target, or a competing offer. Likely an internal-band number leaking.`,
        evidence: m[0].trim(),
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

/* ── #11 Hallucinated employer name ──────────────────────────────── */
/**
 * Flags when the AI references the candidate's current employer by name
 * but (a) the candidate never said that name in the session and (b) the
 * name isn't the hiring company. Real production bug from Flipkart
 * round-3: AI said "your notice period at 3INSYS" — the candidate
 * never said any company name. Likely an ASR mishearing of "Infosys"
 * (or pure hallucination) that the LLM propagated as fact.
 *
 * Pattern: "at|with|from <ProperNoun>" near notice/join/company words.
 */
// Allow ASR-garbled names that begin with a digit (e.g. "3INSYS",
// "7-Eleven"). Real production: AI emitted "your notice period at
// 3INSYS" when ASR mangled "Infosys".
const EMPLOYER_PROBE_RE = /\b(?:at|with|from|in)\s+((?:[A-Z]|\d)[A-Za-z0-9]{1,}(?:\s+[A-Z][A-Za-z0-9]+)?)\b/g;
const EMPLOYER_CONTEXT_RE = /\b(?:notice\s+period|current\s+company|current\s+employer|currently\s+at|currently\s+work|currently\s+working|leaving|joining)\b/i;
// Common false-positive proper nouns that aren't current-employer names.
const EMPLOYER_STOPLIST = new Set<string>([
  "India", "Bangalore", "Bengaluru", "Mumbai", "Delhi", "Hyderabad",
  "Chennai", "Pune", "Kolkata", "Gurgaon", "Noida", "Ahmedabad",
  "HR", "Mr", "Ms", "Mrs", "Sir", "Madam", "Jay", "Rahul",
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]);

export function detectHallucinatedEmployer(ctx: DetectorContext): NegotiationFailure | null {
  const text = ctx.llmOutput;
  // Need at least one of: notice-period / current-company context.
  if (!EMPLOYER_CONTEXT_RE.test(text)) return null;
  const candidateText = (ctx.candidateTranscript ?? "").toLowerCase();
  const hiringCompany = (ctx.hiringCompany ?? "").toLowerCase();
  EMPLOYER_PROBE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EMPLOYER_PROBE_RE.exec(text)) !== null) {
    const name = m[1];
    if (EMPLOYER_STOPLIST.has(name)) continue;
    const lower = name.toLowerCase();
    // Skip if it's the hiring company (can be referenced freely).
    if (hiringCompany && (lower.includes(hiringCompany) || hiringCompany.includes(lower))) continue;
    // Skip if the candidate actually said this name in the session.
    if (candidateText && candidateText.includes(lower)) continue;
    return {
      code: "hallucinated-employer",
      message: `AI referenced "${name}" as if it were the candidate's current employer — candidate never said it and it isn't the hiring company.`,
      evidence: m[0],
      severity: "blocker",
    };
  }
  return null;
}

/* ── #12 Role-title drift ─────────────────────────────────────────── */
/**
 * Flags when the AI refers to the open role by a title that doesn't
 * match the session's role. Real production bug: user picked "UI/UX
 * Designer" but AI ran the negotiation as "Senior Product Designer".
 *
 * Heuristic: extract job-title-shaped phrases ("X Y Designer/Engineer/
 * Manager/etc.") and check that at least one word overlaps with the
 * canonical role string. Misses proper-noun titles like "Architect" if
 * role is "developer", but those are edge cases — we err on flagging.
 */
const ROLE_TITLE_RE = /\b((?:[A-Z][a-z]+(?:[/-][A-Z][a-z]+)?\s+){1,3}(?:Designer|Engineer|Developer|Manager|Analyst|Architect|Scientist|Specialist|Consultant|Director|Lead|Officer))\b/g;
// Role families grouped by interchangeable suffix. A role's suffix is
// the last family-word in its slug (e.g. "ux-designer" → designer
// family). Cross-family titles ("Engineering Manager" vs role
// "backend-engineer") are flagged. Within-family variants ("UI
// Designer" vs role "ux-designer") are NOT flagged — too noisy.
const ROLE_SUFFIX_FAMILIES: Record<string, string[]> = {
  designer: ["designer", "design"],
  engineer: ["engineer", "developer", "dev"],
  manager: ["manager", "management", "lead"],
  analyst: ["analyst", "analytics", "analysis"],
  scientist: ["scientist", "researcher"],
  architect: ["architect"],
  consultant: ["consultant"],
  director: ["director"],
  officer: ["officer"],
  specialist: ["specialist"],
};

// Seniority/qualifier tokens that don't disambiguate the role at all.
// "Senior", "Lead" etc. carry seniority not flavor — we strip them
// before computing qualifier groups so "Senior Product Designer" and
// "Product Designer" produce the same {product} group.
const SENIORITY_TOKENS = new Set([
  "senior", "sr", "junior", "jr", "principal", "staff", "lead",
  "associate", "entry", "level",
]);

// Qualifier synonym groups. The big behavioral fix: "UI" and "UX" are
// interchangeable in Indian recruiter usage so they share a group, but
// "Product" is distinct — a "Senior Product Designer" when the candidate
// picked "ux-designer" is a real role-title drift (Flipkart screenshots
// 1–3, MakeMyTrip 2, KPIT 1). Groups are intentionally narrow — if a
// qualifier doesn't appear here, it stays as itself (its own group).
const QUALIFIER_GROUPS: Record<string, string> = {
  ui: "ui-ux",
  ux: "ui-ux",
  // product is its own group → flags vs ui/ux
  // data, backend, frontend, mobile, platform, ml, ai default to themselves
  fe: "frontend",
  frontend: "frontend",
  "front-end": "frontend",
  be: "backend",
  backend: "backend",
  "back-end": "backend",
  full: "fullstack",
  fullstack: "fullstack",
  "full-stack": "fullstack",
  android: "mobile",
  ios: "mobile",
  mobile: "mobile",
  ai: "ml",
  ml: "ml",
  machine: "ml",
  infra: "platform",
  infrastructure: "platform",
  platform: "platform",
};

function tokensOf(text: string): string[] {
  return text.toLowerCase().split(/[\s/-]+/).filter(Boolean);
}

function familyFor(text: string): string | null {
  // Suffix family = rightmost token that matches a family synonym.
  const tokens = tokensOf(text);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const tok = tokens[i];
    for (const [fam, syns] of Object.entries(ROLE_SUFFIX_FAMILIES)) {
      if (syns.includes(tok)) return fam;
    }
  }
  return null;
}

function qualifierGroups(text: string): Set<string> {
  // Tokens that aren't seniority and aren't the suffix family. Map each
  // through QUALIFIER_GROUPS (falling back to the token itself) so that
  // synonyms like {ui, ux} collapse to a single group "ui-ux".
  const tokens = tokensOf(text);
  const family = familyFor(text);
  const familySyns = family ? new Set(ROLE_SUFFIX_FAMILIES[family]) : new Set<string>();
  const groups = new Set<string>();
  for (const tok of tokens) {
    if (SENIORITY_TOKENS.has(tok)) continue;
    if (familySyns.has(tok)) continue;
    if (tok.length < 2) continue;
    groups.add(QUALIFIER_GROUPS[tok] ?? tok);
  }
  return groups;
}

export function detectRoleTitleDrift(ctx: DetectorContext): NegotiationFailure | null {
  const role = (ctx.sessionRole ?? "").trim();
  if (!role) return null;
  const roleFamily = familyFor(role);
  if (!roleFamily) return null;
  const roleGroups = qualifierGroups(role);
  ROLE_TITLE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ROLE_TITLE_RE.exec(ctx.llmOutput)) !== null) {
    const title = m[1];
    const titleFamily = familyFor(title);
    if (!titleFamily) continue;
    // Cross-family always flags.
    if (titleFamily !== roleFamily) {
      return {
        code: "role-title-drift",
        message: `AI referred to the role as "${m[1]}" but the session's role is "${role}".`,
        evidence: m[0],
        severity: "major",
      };
    }
    // Same family — check qualifier-group overlap. If both sides have
    // qualifier groups and they're disjoint, it's still drift ("Senior
    // Product Designer" vs ux-designer = same family "designer" but
    // disjoint groups {product} vs {ui-ux}).
    const titleGroups = qualifierGroups(title);
    if (roleGroups.size > 0 && titleGroups.size > 0) {
      let overlap = false;
      for (const g of titleGroups) if (roleGroups.has(g)) { overlap = true; break; }
      if (!overlap) {
        return {
          code: "role-title-drift",
          message: `AI referred to the role as "${m[1]}" but the session's role is "${role}".`,
          evidence: m[0],
          severity: "major",
        };
      }
    }
  }
  return null;
}

/* ── #13 Flat-breakdown leak ──────────────────────────────────────── */
/**
 * Flags when the AI gives a "breakdown" where every component is the
 * same LPA number — placeholder-substitution gone wrong. Real production
 * bug from Razorpay round-5: "base salary of ₹49 LPA, variable
 * component of ₹49 LPA, ESOPs worth ₹49 LPA, PF contribution of ₹49
 * LPA". The candidate sees a confident HR who can't do basic math. The
 * detector: ≥3 LPA numbers all equal within the same reply AND the
 * reply contains ≥2 component keywords (base/variable/ESOP/PF/joining/
 * gratuity). Below 3 same numbers it could be a legitimate "₹X LPA …
 * total ₹X LPA" recap; above 3 it's always pathological.
 */
export function detectFlatBreakdown(ctx: DetectorContext): NegotiationFailure | null {
  const text = ctx.llmOutput;
  const componentRe = /\b(?:base\s+(?:salary|pay|component)|variable\s+(?:component|pay|bonus)|joining\s+bonus|gratuity|provident\s+fund|\bPF\b|ESOPs?|RSUs?|stock\s+options)\b/gi;
  const components = text.match(componentRe) ?? [];
  if (components.length < 2) return null;
  const numRe = /₹\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?)/g;
  const counts = new Map<string, number>();
  let m: RegExpExecArray | null;
  while ((m = numRe.exec(text)) !== null) {
    const key = parseFloat(m[1]).toFixed(2);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [key, count] of counts) {
    if (count >= 3) {
      return {
        code: "flat-breakdown",
        message: `AI gave a breakdown where ₹${parseFloat(key)} LPA appears ${count}× across ${components.length} components — placeholder-substitution failure (every slot got the same number).`,
        evidence: `₹${parseFloat(key)} LPA × ${count}`,
        severity: "blocker",
      };
    }
  }
  return null;
}

/* ── #14 Phantom competing offer ──────────────────────────────────── */
/**
 * Flags when the AI references "your competing offer / the other
 * company / the other offer" but (a) competingOfferLpa is null/0 and
 * (b) the candidate transcript doesn't mention a competing/in-hand
 * offer. Real production bug from Lemon Yellow round-5: candidate said
 * "any competing offer as of now?" (no), AI replied "I appreciate you
 * bringing up a competing offer, Jay" — pure fabrication.
 */
export function detectPhantomCompetingOffer(ctx: DetectorContext): NegotiationFailure | null {
  // Has a real competing offer? Not phantom.
  if (ctx.competingOfferLpa != null && ctx.competingOfferLpa > 0) return null;
  const phantomRe = /\b(?:(?:your|the|a|that)\s+competing\s+offer|bringing\s+up\s+(?:a|the|your)\s+competing\s+offer|the\s+other\s+(?:company|offer)|from\s+the\s+other\s+company|that\s+other\s+offer|you(?:'?re|\s+are)\s+(?:weighing|considering)\s+(?:another|other)\s+offer)\b/i;
  const m = ctx.llmOutput.match(phantomRe);
  if (!m) return null;
  const transcript = (ctx.candidateTranscript ?? "").toLowerCase();
  // Allow if the candidate actually AFFIRMED having a competing/in-hand
  // offer. Just the words "competing offer" aren't enough (candidate
  // echoing the AI's question back doesn't count). Require an
  // affirmative phrasing: "I have …", "received …", "in-hand …", or a
  // ballpark number attached.
  const candidateMentioned =
    /\b(?:i\s+have\s+(?:an?|another|a\s+competing)\s+offer|received\s+(?:an|another|a\s+competing)\s+offer|in[\s-]?hand\s+offer|another\s+company\s+(?:offered|has\s+offered)|got\s+(?:an|another)\s+offer\s+from)\b/.test(transcript) ||
    /\b(?:competing|other|another)\s+offer\s+(?:of|at|for)\s+₹?\s*\d/.test(transcript);
  if (candidateMentioned) return null;
  return {
    code: "phantom-competing-offer",
    message: "AI referenced a competing offer that doesn't exist — candidate never mentioned one and competingOfferLpa is unset.",
    evidence: m[0],
    severity: "blocker",
  };
}

/* ── #15 Counter below ceiling ────────────────────────────────────── */
/**
 * Flags when the AI states a "revised / updated / new / pushed" offer
 * of ₹X where X < highestOfferMade by ≥0.5 LPA. The Razorpay round-5
 * screenshot: initial offer ₹49 LPA, two turns later "I can push for a
 * revised offer of ₹35.3 LPA total CTC" — a phantom-counter that
 * MOVES BACKWARDS. The monotonic clamp in follow-up.ts is supposed to
 * catch this but missed it; the detector here pins the failure so the
 * regression can't slip silently.
 */
export function detectCounterBelowCeiling(ctx: DetectorContext): NegotiationFailure | null {
  const ceiling = ctx.highestOfferMade ?? null;
  if (ceiling == null || ceiling <= 0) return null;
  const re = /(?:revised|updated|new|pushed?(?:\s+for)?|can\s+do|stretch\s+to|landing\s+at|come\s+up\s+to|i'?ll\s+push\s+for)\s+(?:an?\s+|the\s+)?(?:revised\s+|updated\s+|new\s+)?offer\s+of\s+₹?\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?|cr|crore)|push\s+for\s+(?:a\s+)?(?:revised|updated|new)\s+offer\s+of\s+₹?\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?|cr|crore)|revised\s+offer\s+of\s+₹?\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?|cr|crore)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ctx.llmOutput)) !== null) {
    const numStr = m[1] ?? m[2] ?? m[3];
    if (!numStr) continue;
    const isCr = /cr|crore/i.test(m[0]);
    const v = parseFloat(numStr) * (isCr ? 100 : 1);
    if (v < ceiling - 0.5) {
      return {
        code: "counter-below-ceiling",
        message: `AI stated a "${m[0].trim()}" but the highest offer this session was ₹${ceiling} LPA — the counter moved BACKWARDS.`,
        evidence: m[0].trim(),
        severity: "blocker",
      };
    }
  }
  return null;
}

/* ── #16 Trailing closing question ────────────────────────────────── */
/**
 * Flags when the AI's reply contains closing language AND ends with a
 * question. Real production bug across all five sessions in the bug
 * doc: the "outro" message ends with "Anything else you'd like to
 * clarify?" or similar but the UI shows a "View result" button with no
 * answer affordance — the candidate has no way to respond. Closing
 * messages should be declarative, not interrogative.
 */
export function detectTrailingClosingQuestion(ctx: DetectorContext): NegotiationFailure | null {
  const closingMarker = /(?:put\s+together\s+(?:the\s+)?final\s+numbers|work\s+with\s+HR\s+to|HR\s+(?:will\s+)?send\s+you\s+(?:the|a)\s+(?:formal\s+)?offer\s+letter|finaliz(?:e|ing)\s+(?:the\s+)?(?:offer|package|paperwork))/i;
  if (!closingMarker.test(ctx.llmOutput)) return null;
  const trimmed = ctx.llmOutput.trim();
  if (!trimmed.endsWith("?")) return null;
  return {
    code: "trailing-closing-question",
    message: "AI's closing message ends with a question — UI offers no answer affordance in the outro state.",
    evidence: trimmed.slice(-120),
    severity: "major",
  };
}

// Shared regex set: closing-template markers used across multiple
// detectors. Kept in sync with detectPrematureClose's pattern list.
const CLOSING_OUTRO_RE = /(?:put\s+together\s+(?:the\s+)?final\s+numbers|work\s+with\s+HR\s+to|HR\s+(?:will\s+)?send\s+you\s+(?:the|a)\s+(?:formal\s+)?offer\s+letter|finaliz(?:e|ing)\s+(?:the\s+)?(?:offer|package|paperwork|details)|take\s+(?:all\s+)?this\s+(?:information\s+)?back|formal\s+offer\s+letter\s+with\s+(?:the|all)\s+(?:details|next))/i;

/* ── #17 Closing while candidate has a pending question ───────────── */
// The Senior PD / Morningstar session: candidate asked "Can you give me
// a breakdown of ₹27?" and the AI closed instead. This is the
// architectural failure that causes the "AI ends after 6 exchanges"
// pattern — closing fires regardless of whether the candidate has an
// active request the AI hasn't answered.
export function detectClosingWithPendingQuestion(ctx: DetectorContext): NegotiationFailure | null {
  if (!ctx.candidateLastMessage) return null;
  if (!CLOSING_OUTRO_RE.test(ctx.llmOutput)) return null;
  const last = ctx.candidateLastMessage.trim();
  const isQuestion = /\?\s*$/.test(last);
  const explicitRequest = /\b(?:can\s+you|could\s+you|would\s+you|give\s+me|share|tell\s+me|walk\s+me\s+through|break\s*down|explain|clarify|what(?:'?s|\s+is)|how\s+(?:much|does|is)|why)\b/i.test(last);
  if (!isQuestion && !explicitRequest) return null;
  return {
    code: "closing-with-pending-question",
    message: "AI fired the closing template while the candidate's last message contained an unanswered question/request — the request was dropped.",
    evidence: last.slice(0, 140),
    severity: "blocker",
  };
}

/* ── #18 Ignored acceptance (re-opens decision after candidate accepted) ─ */
// Once the candidate has accepted (acceptedImmediately === true), the
// AI should be in confirmation/logistics mode — not asking "what would
// help your final decision" or "anything else to discuss." That framing
// treats the accepted offer as still open.
export function detectIgnoredAcceptance(ctx: DetectorContext): NegotiationFailure | null {
  if (!ctx.acceptedImmediately) return null;
  const openDecisionPhrases = [
    /\b(?:final|your)\s+decision\b/i,
    /\banything\s+else\s+(?:that\s+we\s+need\s+to|we\s+need\s+to|to)\s+(?:discuss|clarify|cover|address)/i,
    /\bwhat\s+would\s+(?:help|make|move)\s+(?:this|the)(?:\s+offer)?\s+(?:a\s+)?(?:yes|work)/i,
    /\bare\s+you\s+(?:still\s+)?on\s+the\s+fence\b/i,
    /\bis\s+there\s+(?:anything|something)\s+(?:that['']?s\s+)?holding\s+you\s+back\b/i,
  ];
  for (const re of openDecisionPhrases) {
    const m = ctx.llmOutput.match(re);
    if (m) {
      return {
        code: "ignored-acceptance",
        message: "Candidate already accepted earlier in this session; AI is treating the offer as still undecided.",
        evidence: m[0],
        severity: "major",
      };
    }
  }
  return null;
}

/* ── #19 Apology-loop reprobe ─────────────────────────────────────── */
// When the candidate complains "you already asked me that" and the AI
// apologises BUT then asks the same thing again in the same message.
// Senior PD / Morningstar T4: "Apologies, Jay, you're absolutely right
// that you mentioned a thirty-day notice period… So, to be clear, you
// could join us in thirty days from the date of acceptance?"
export function detectApologyLoopReprobe(ctx: DetectorContext): NegotiationFailure | null {
  const apologyRe = /\b(?:apologies|apologize|my\s+(?:apologies|mistake|bad)|you[''’]?re\s+(?:absolutely\s+)?right|sorry\s+(?:about|for))\b/i;
  if (!apologyRe.test(ctx.llmOutput)) return null;
  // After the apology, does the AI re-ask a question? A question mark
  // in the same message AND a re-probe phrase = the loop pattern.
  const apologyIdx = ctx.llmOutput.search(apologyRe);
  const afterApology = ctx.llmOutput.slice(apologyIdx);
  if (!afterApology.includes("?")) return null;
  const reprobeRe = /\b(?:to\s+be\s+clear|just\s+to\s+(?:confirm|clarify|check)|so\s+(?:you|just\s+to)|let\s+me\s+(?:just\s+)?confirm|i\s+just\s+want(?:ed)?\s+to\s+(?:confirm|clarify))\b/i;
  const m = afterApology.match(reprobeRe);
  if (!m) return null;
  return {
    code: "apology-loop-reprobe",
    message: "AI acknowledged a complaint about repetition but immediately re-asked the same question — apology without behavior change.",
    evidence: m[0],
    severity: "major",
  };
}

/* ── #20 Phantom revision ─────────────────────────────────────────── */
// AI's outro promises a "revised offer" or "updated offer" but the
// candidate accepted the original number — nothing was revised. Senior
// PD / Morningstar T6: "I'll take all this back and put together a
// revised offer based on our conversation" — but the conversation
// produced no counter-offer. Fires only when band.initialOffer is known
// AND highestOfferMade === initialOffer (no counter happened).
export function detectPhantomRevision(ctx: DetectorContext): NegotiationFailure | null {
  if (!ctx.band) return null;
  const noCounterHappened =
    ctx.highestOfferMade == null ||
    Math.abs((ctx.highestOfferMade ?? ctx.band.initialOffer) - ctx.band.initialOffer) < 0.05;
  if (!noCounterHappened) return null;
  const revisionRe = /\b(?:revised|updated|new|adjusted|reworked|improved)\s+(?:offer|package|number|figure|proposal)\b/i;
  const m = ctx.llmOutput.match(revisionRe);
  if (!m) return null;
  return {
    code: "phantom-revision",
    message: "AI promised a 'revised/updated offer' but no number was ever revised — initial offer was accepted as-is.",
    evidence: m[0],
    severity: "major",
  };
}

/* ── #21 Breakdown deflection ─────────────────────────────────────── */
// Pine Labs Senior PD T3/T4: candidate asks "I would like to know a
// breakdown of ₹33 LPA CTC", AI replies "happy to walk through the
// structure (base, variable, joining bonus, PF) if that would help —
// what part would you like to dig into?" — listing the categories
// without the numbers, treating the breakdown ask as a menu choice.
// This is the structural-fix-still-needed case: the LLM did not set
// wantsBreakdown=true, so the server-side breakdown template did not
// fire, and the LLM punted.
//
// Heuristic: candidate-last-message asks for a breakdown AND the AI
// reply names at least two component categories but contains fewer
// than two ₹-LPA figures (so it's listing slots without numbers).
export function detectBreakdownDeflection(ctx: DetectorContext): NegotiationFailure | null {
  if (!ctx.candidateLastMessage) return null;
  const breakdownAskRe = /\b(?:break\s*down|breakup|components?|structure|split)\b/i;
  if (!breakdownAskRe.test(ctx.candidateLastMessage)) return null;
  const reply = ctx.llmOutput;
  // Count component-category mentions.
  const categoryHits = [
    /\bbase\b/i,
    /\bvariable\b/i,
    /\bjoining\s+(?:bonus|amount)\b/i,
    /\bpf\b|\bprovident\s+fund\b/i,
    /\bgratuity\b/i,
    /\besop|\brsu|\bequity\b/i,
  ].reduce((n, re) => (re.test(reply) ? n + 1 : n), 0);
  if (categoryHits < 2) return null;
  // Count rupee-attached LPA numbers. A real breakdown has at least
  // two of these (e.g. base ₹X LPA, variable ₹Y LPA). Fewer than two
  // means the AI listed categories but didn't give the numbers.
  const rupeeFigureRe = /₹\s*\d+(?:\.\d+)?\s*(?:lpa|lakhs?|cr|crore)/gi;
  const rupeeHits = (reply.match(rupeeFigureRe) || []).length;
  if (rupeeHits >= 2) return null;
  return {
    code: "breakdown-deflection",
    message: "Candidate explicitly asked for a breakdown; AI listed the component categories without the numbers (treating the ask as a menu choice instead of delivering the breakdown).",
    evidence: reply.slice(0, 160),
    severity: "major",
  };
}

/* ── #22 Notice-period re-ask ─────────────────────────────────────── */
// Pine Labs T5: candidate said "Join in thirty days itself" in T2.
// AI's outro at T5: "What's your current notice period situation,
// and what's the earliest you could potentially join us?" — re-asking
// information the candidate already provided. Distinct from
// repeated-question (which fires on AI asking itself the same thing
// twice) — this fires when the candidate's transcript shows the
// answer is on record.
//
// Why this is a blocker, not just annoying: the closing recap claims
// to "reflect our agreed-upon terms" while simultaneously asking for
// terms the candidate already stated. It contradicts the recap.
export function detectNoticePeriodReask(ctx: DetectorContext): NegotiationFailure | null {
  const transcript = (ctx.candidateTranscript || "").toLowerCase();
  if (!transcript) return null;
  // Did the candidate state a notice period / joining timeline?
  const candidateAnsweredRe =
    /\b(?:thirty|sixty|ninety|fifteen|forty[\s-]?five|\d+)\s*[-]?\s*(?:day|month|week)s?\b/i;
  const explicitJoinRe = /\b(?:i\s+can\s+join|i['']?ll\s+join|join\s+in\s+\w+\s+(?:day|month|week)|notice\s+period\s+is)\b/i;
  if (!candidateAnsweredRe.test(transcript) && !explicitJoinRe.test(transcript)) return null;
  // Is the AI's current reply asking for the same thing again?
  const aiAskRe =
    /\b(?:(?:what['']?s|your)\s+(?:current\s+)?notice\s+period|earliest\s+you\s+could\s+(?:join|start)|when\s+(?:could|would|can)\s+you\s+(?:join|start)|how\s+soon\s+could\s+you\s+join|when\s+would\s+you\s+ideally\s+start)\b/i;
  const m = ctx.llmOutput.match(aiAskRe);
  if (!m) return null;
  return {
    code: "notice-period-reask",
    message: "AI asked about notice period / joining timeline but the candidate already answered earlier in this session — the prior answer was dropped.",
    evidence: m[0],
    severity: "major",
  };
}

/* ── #23 Duplicate reply (AI emitted same reply twice) ────────────── */
// Pine Labs T4: candidate restated "Breakdown of all the parts" and
// the AI emitted the EXACT same followUpText as T3 — verbatim. This
// is distinct from repeated-question (which only fires on a fixed
// probe-signature list, e.g. notice-period). Verbatim-repeat is a
// "stuck in a loop" symptom regardless of what the reply was about,
// and it strongly suggests the LLM hit the same fallback path twice.
//
// Heuristic: normalize whitespace + case, then check whether the
// current reply matches any prior AI turn under a high similarity
// bar. We use a literal-equality check after normalization rather
// than a fuzzy similarity score — cheap, no false positives.
function normalizeForDuplicate(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, " ")
    .replace(/[.,;:!?—–-]+/g, "")
    .trim();
}
export function detectDuplicateReply(ctx: DetectorContext): NegotiationFailure | null {
  const prev = ctx.previousAiTurns;
  if (!prev || prev.length === 0) return null;
  const out = ctx.llmOutput.trim();
  // Ignore very short replies — "Got it." matching another "Got it." is
  // not a bug. Require ≥ 80 chars (a real sentence) before flagging.
  if (out.length < 80) return null;
  const norm = normalizeForDuplicate(out);
  for (const p of prev) {
    if (normalizeForDuplicate(p) === norm) {
      return {
        code: "duplicate-reply",
        message: "AI's current reply is a verbatim duplicate of a prior reply in this session — the loop indicates the LLM took the same fallback twice instead of responding to the candidate's restated ask.",
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
  detectHallucinatedEmployer,
  detectRoleTitleDrift,
  detectFlatBreakdown,
  detectPhantomCompetingOffer,
  detectCounterBelowCeiling,
  detectTrailingClosingQuestion,
  detectClosingWithPendingQuestion,
  detectIgnoredAcceptance,
  detectApologyLoopReprobe,
  detectPhantomRevision,
  detectBreakdownDeflection,
  detectNoticePeriodReask,
  detectDuplicateReply,
];

export function detectAllFailures(ctx: DetectorContext): NegotiationFailure[] {
  const out: NegotiationFailure[] = [];
  for (const fn of ALL_DETECTORS) {
    const f = fn(ctx);
    if (f) out.push(f);
  }
  return out;
}
