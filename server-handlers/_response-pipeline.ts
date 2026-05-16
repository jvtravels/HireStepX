/* Kernel-first response pipeline (2026-05-16).
 *
 * The single generation path that replaces the prior LLM-first reroll
 * loop. Flow:
 *
 *   1. planNextAction(state) → NextAction (kernel decides what to do).
 *   2. If candidate asked an off-script question → answer from factPack
 *      (LLM may only use factPack content; missing fact → graceful
 *      defer + resume planned canonical).
 *   3. Otherwise → renderCanonicalProse(action, state) builds the line
 *      the kernel WANTS shipped.
 *   4. LLM restyles under tight constraint (no new numbers, no new
 *      facts, no meaning change).
 *   5. validateRestyle preserves canonical semantics; on failure or
 *      LLM throw, ship the canonical verbatim.
 *
 * The LLM physically cannot:
 *   - Anchor in opening — canonical opening is a discovery probe with
 *     no number, restyle can't introduce one.
 *   - Repeat a probe — planner advances; canonical changes per turn.
 *   - Hallucinate facts — restyle prompt forbids new facts; factPack
 *     is the only context for off-script answers.
 *
 * Pure orchestration. The LLM caller is injected so tests can mock it.
 */

import type { NegotiationState, AiMove } from "./_negotiation-kernel";
import { planNextAction, actionToLever, type NextAction } from "./_next-action-planner";
import {
  renderCanonicalProse,
  buildRestylePrompt,
  buildAnswerCandidatePrompt,
  BANNED_RECRUITER_IDIOM_RE,
  IDIOM_PER_UTTERANCE_CAP,
  countPreferredIdioms,
  ACK_TEMPLATES,
} from "./_canonical-prose";
import {
  buildFactPack,
  detectFactGap,
  detectCandidateAskedQuestion,
} from "./_fact-pack";

export type GenerateAiTextFn = (
  system: string,
  user: string,
  opts?: { temperature?: number; userId?: string },
) => Promise<string>;

export interface PipelineResult {
  text: string;
  source: "restyle" | "canonical-fallback" | "answer-restyle" | "answer-canonical";
  action: NextAction;
  move: AiMove;
  /** Diagnostic reason when the restyle was rejected (telemetry). */
  rejectReason?: string;
}

/** Top-level generator. Always returns a useful text — falls back to
 *  the canonical verbatim if the LLM throws or the restyle violates
 *  semantics. */
export async function generateBotReply(
  state: NegotiationState,
  generateAiText: GenerateAiTextFn,
  candidateAnswer?: string,
): Promise<PipelineResult> {
  const action = planNextAction(state);
  const move = actionToLever(action, state);

  /* Off-script candidate-question routing. Two signals — preferred is
   * the structured candidateAskedQuestion field carried on TurnDelta;
   * fallback is a fresh detection on the candidate answer string. */
  const lastDelta = state.lastTurnDelta;
  const ext = (lastDelta ?? {}) as {
    candidateAskedQuestion?: { raw: string; intent?: string };
    askedQuestion?: boolean;
  };
  const askedFromDelta = ext.candidateAskedQuestion;
  const askedFromAnswer = candidateAnswer
    ? detectCandidateAskedQuestion(candidateAnswer)
    : { asked: false };

  if ((askedFromDelta && askedFromDelta.raw) || askedFromAnswer.asked) {
    const rawQ = askedFromDelta?.raw ?? askedFromAnswer.raw ?? candidateAnswer ?? "";
    return generateAnswerToCandidate(state, action, move, rawQ, generateAiText);
  }

  return generateRestyledCanonical(state, action, move, generateAiText);
}

async function generateRestyledCanonical(
  state: NegotiationState,
  action: NextAction,
  move: AiMove,
  generateAiText: GenerateAiTextFn,
): Promise<PipelineResult> {
  let canonical: string;
  try {
    canonical = renderCanonicalProse(action, state);
  } catch (err) {
    /* Canonical coverage gap — surface a defensive default rather than
     * crashing the turn. The repro test for canonical exhaustiveness
     * should catch this in CI, not in prod. */
    void err;
    return {
      text: "Let me come back to you in a moment.",
      source: "canonical-fallback",
      action,
      move,
      rejectReason: "canonical-render-threw",
    };
  }

  const { system, user } = buildRestylePrompt(canonical, state);
  let restyled: string;
  try {
    restyled = await generateAiText(system, user, { temperature: 0.4 });
  } catch {
    return { text: canonical, source: "canonical-fallback", action, move, rejectReason: "llm-throw" };
  }
  restyled = (restyled || "").trim();

  const validation = validateRestyle(canonical, restyled, state, action);
  if (!validation.valid) {
    return {
      text: canonical,
      source: "canonical-fallback",
      action,
      move,
      rejectReason: validation.reason,
    };
  }
  return { text: restyled, source: "restyle", action, move };
}

/** BUG-4 (PDF#24, 2026-05-16) — every defer path used to ship the
 *  identical "Let me confirm that with the team and get back to you. In
 *  the meantime — ..." string. That phrase (a) models the bot as a
 *  passthrough who has to escalate every question, (b) promises a
 *  callback that the simulator can't honour, and (c) makes the
 *  candidate hear the same line three turns running.
 *
 *  The honest fix: a defer text that varies by reason and pivots back
 *  to the planned canonical line without faking a callback. Reasons:
 *    - "fact-gap"   → unknowable from the session FactPack (workMode,
 *                     team size, reporting line). Acknowledge openly.
 *    - "llm-throw"  → LLM error; we can't restyle but the canonical
 *                     line is already loaded.
 *    - "empty-llm"  → LLM returned blank; same as above.
 *    - "validation" → LLM injected a number/fact the factPack didn't
 *                     authorise. Quietly fall back to the canonical.
 *
 *  In all branches we ship the canonical follow-up so the negotiation
 *  keeps moving — the difference is only the lead-in. */
function buildDeferLead(reason: "fact-gap" | "llm-throw" | "empty-llm" | "validation", missing: string[]): string {
  if (reason === "fact-gap") {
    const topic = missing[0] ?? "";
    /* Indian-recruiter idiom — honest about what we don't know
     * without committing to "circle back" / "get back to you". */
    if (topic === "workMode")     return "On the work mode, I'll keep that one open for now —";
    if (topic === "joiningWindow") return "On the joining side, that's something we firm up post-offer —";
    if (topic === "teamSize")     return "Team size is something the HM walks through in the next round —";
    if (topic === "reportingTo")  return "Reporting line gets confirmed once the band is locked —";
    return "That detail is one I'd rather not commit to off the cuff —";
  }
  /* llm-throw / empty-llm / validation — quietly fall through to the
   * planned next move; no fake-callback theatre. */
  return "Coming back to the structure —";
}

function buildDeferText(
  reason: "fact-gap" | "llm-throw" | "empty-llm" | "validation",
  missing: string[],
  canonicalFollowup: string,
): string {
  const lead = buildDeferLead(reason, missing);
  return `${lead} ${lowercaseFirst(canonicalFollowup)}`;
}

async function generateAnswerToCandidate(
  state: NegotiationState,
  action: NextAction,
  move: AiMove,
  candidateQuestion: string,
  generateAiText: GenerateAiTextFn,
): Promise<PipelineResult> {
  const factPack = buildFactPack(state, candidateQuestion);
  const gap = detectFactGap(factPack, candidateQuestion);
  const canonicalFollowup = (() => {
    try { return renderCanonicalProse(action, state); }
    catch { return "Let me come back to that in a moment."; }
  })();

  /* When a fact is missing → graceful defer + resume planned line.
   * No LLM call needed — the deterministic answer is more reliable. */
  if (!gap.canAnswer) {
    const defer = buildDeferText("fact-gap", gap.missing, canonicalFollowup);
    return { text: defer, source: "answer-canonical", action, move, rejectReason: `fact-gap: ${gap.missing.join(",")}` };
  }

  /* All required facts present — ask the LLM to answer from factPack. */
  const { system, user } = buildAnswerCandidatePrompt(
    candidateQuestion,
    JSON.stringify(factPack, null, 2),
    canonicalFollowup,
    state,
  );
  let answer: string;
  try {
    answer = await generateAiText(system, user, { temperature: 0.4 });
  } catch {
    const defer = buildDeferText("llm-throw", [], canonicalFollowup);
    return { text: defer, source: "answer-canonical", action, move, rejectReason: "llm-throw" };
  }
  answer = (answer || "").trim();
  if (!answer) {
    const defer = buildDeferText("empty-llm", [], canonicalFollowup);
    return { text: defer, source: "answer-canonical", action, move, rejectReason: "empty-llm" };
  }
  /* Answer-side validation: same number/fact discipline as restyle. */
  const validation = validateAnswer(answer, factPack);
  if (!validation.valid) {
    const defer = buildDeferText("validation", [], canonicalFollowup);
    return { text: defer, source: "answer-canonical", action, move, rejectReason: validation.reason };
  }
  return { text: answer, source: "answer-restyle", action, move };
}

/* ─── validators ───────────────────────────────────────────────────── */

/** Numbers (LPA / lakh / crore) that look like salary references. */
const SALARY_NUM_RE = /(\d+(?:\.\d+)?)\s*(?:LPA|L\b|lakhs?|crores?|cr|lac|lacs)/gi;
/** ₹-prefixed numbers. */
const RUPEE_NUM_RE = /₹\s*(\d[\d,.]*)/g;

function extractNumbers(s: string): string[] {
  const out: string[] = [];
  if (!s) return out;
  let m: RegExpExecArray | null;
  SALARY_NUM_RE.lastIndex = 0;
  while ((m = SALARY_NUM_RE.exec(s)) !== null) out.push(m[1]);
  RUPEE_NUM_RE.lastIndex = 0;
  while ((m = RUPEE_NUM_RE.exec(s)) !== null) out.push(m[1].replace(/[,]/g, ""));
  return out;
}

const CLOSE_VOCAB_RE =
  /\b(welcome to the team|congratulations[^.!?]*on board|we['’]?re excited to have you|offer letter (?:will be|is being|has been) (?:prepared|sent|issued)|let['’]?s get you onboarded)\b/i;

/** Discovery-probe ack-prefix vocab. buildDiscoveryAck emits one of
 *  six phrases ("Noted on …", "Got it on …", "Understood on …",
 *  "Appreciate the colour …"). When the kernel canonical opens with
 *  any of these, the restyle MUST keep the acknowledgement gesture so
 *  the bot doesn't sound transactional. We don't require verbatim
 *  reproduction — Indian recruiter idiom has several broadly-aligned
 *  near-equivalents ("right, on the X side …", "thanks for that —")
 *  so we accept any of an extended vocab set. */
const ACK_VOCAB_RE =
  /\b(noted|got it|understood|appreciate|right[,\s—]+on|thanks for that|fair enough|fine,?\s+so|okay,?\s+on|alright,?\s+on)\b/i;

/** Defect 6 (2026-05-16) — sentiment-prefix anchor phrases.
 *  `renderSentimentPrefix` (in _canonical-prose.ts) prepends one of
 *  three fixed phrases ("I hear you …", "Glad we're broadly aligned —",
 *  "Take your time on this —") in front of the canonical body when the
 *  candidate sentiment is frustrated / excited / hesitant. The restyle
 *  prompt explicitly permits opening-phrase changes, so without a
 *  preservation rule the LLM can fully strip the empathy lead and the
 *  bot regresses to flat-affect cadence. Accept any of an extended
 *  anchor set so Indian-recruiter rephrasings ("I get where you're
 *  coming from", "good that we're broadly aligned", "no rush") pass. */
const SENTIMENT_VOCAB_RE =
  /\b(i hear you|i get where you|i understand where you|broadly aligned|glad we['’]?re aligned|take your time|no rush|in your own time)\b/i;

/** Bug 1 (PDF#25, 2026-05-16) — declarative-connective-lead + trailing
 *  question-mark, IN THE SAME CLAUSE. The sentence starts with one of
 *  the connectives the restyle prompt is allowed to use as a soft ack
 *  ("Fair enough,", "Got it,", "Sure,", "Right,", "Okay,", "Alright,",
 *  "Noted,", "Understood,") followed by a COMMA (i.e. same-clause
 *  continuation, not a separate sentence) and ends with "?".
 *
 *  Counter-example we MUST allow: "Noted on the expected side. What's
 *  the notice period?" — two separate sentences, the first declarative
 *  with a period, the second a clean interrogative. We require the
 *  connective to be comma-joined to the rest of the same clause AND no
 *  intervening period / em-dash / question-mark before the trailing "?"
 *  so genuine two-sentence acks still pass. */
const DECLARATIVE_PLUS_QUESTION_RE =
  /^\s*(?:fair enough|got it|sure|right|okay|alright|noted|understood)[^.?\u2014\u2013]*,[^.?\u2014\u2013]*\?\s*$/i;

/** F1 / Audit Pass 2 (PDF#25, 2026-05-16) — topic-keyword map.
 *
 *  One regex per discovery topic. Used by the multi-topic-utterance
 *  gate: count how many distinct topics a restyled line mentions and
 *  reject when >1. Keywords are scoped tightly so generic English words
 *  ("at present", "structure") don't collide across topics. */
export const TOPIC_KEYWORD_MAP: Record<string, RegExp> = {
  currentCtc:
    /\b(?:current\s+(?:ctc|package|compensation|comp|fitment|side)|at\s+present|right\s+now|today)\b/i,
  targetCtc:
    /\b(?:expected|fitment|target|looking\s+at|anchoring|expectation)\b/i,
  fixedVariable:
    /\b(?:fixed[\s\/\-]*variable|variable\s+split|fixed\s+and\s+variable|split\s+between\s+fixed|how\s+is\s+(?:your|the)\s+package\s+structured)\b/i,
  notice:
    /\b(?:notice\s+period|notice\s+side|buyout)\b/i,
  competing:
    /\b(?:competing\s+(?:offer|process|opportunity)|other\s+process|other\s+opportunity|other\s+offer)\b/i,
  valueProof:
    /\b(?:value\s+proof|impact|one\s+project)\b/i,
};

/** F2 / Audit Pass 2 (PDF#25, 2026-05-16) — internal-hedge-filler.
 *
 *  Recruiter-internal thought leaking into the dialog ("let me check as
 *  per the band ... but broadly aligned") is process-narration that
 *  doesn't belong in the candidate-facing line. Canonical prose never
 *  emits these patterns except via the sentiment-prefix path (where
 *  "broadly aligned" is the legitimate excited-sentiment lead). The
 *  gate respects canonical content — if the canonical itself carries
 *  the hedge phrase, the restyle is allowed to mirror it. */
export const HEDGE_FILLER_RE =
  /\b(?:let\s+me\s+check|broadly\s+aligned|just\s+to\s+confirm|hmm,?\s+let\s+me)\b/i;

/** Bug 1 (PDF#25, 2026-05-16) — "total CTC as per your current band"
 *  tautology. The candidate's current CTC IS their current-band number;
 *  the qualifier adds no information. Catches both directions ("CTC as
 *  per … band" and "band … current CTC" within close proximity). */
const TAUTOLOGY_RE =
  /\b(?:total\s+)?ctc\s+as\s+per\s+(?:your|the)\s+(?:current\s+)?band\b/i;

/* Audit Pass 3 / Fix 3 / ArchRec 3 (2026-05-16) — per-NextAction
 * validator contract. Until now `validateRestyle` enforced only the
 * global rules (number subset, sentiment vocab, banned idioms, close-
 * recap completeness). Different NextAction kinds have different
 * invariants — a discovery-probe must not introduce numbers at all,
 * a counter-offer MUST emit at least one number, a close-recap-formal
 * needs the verbal-acceptance acknowledgement token to bind the recap
 * to the candidate's prior yes. Hard-coding those into separate branches
 * spreads the per-kind contract across the validator body and makes it
 * easy for new NextAction kinds to ship with zero validation.
 *
 * The contract table keys NextAction.kind values to:
 *   - numberPolicy: "forbidden" (no numbers permitted), "required" (at
 *     least one number must appear), or "optional" (no constraint
 *     beyond the global subset rule).
 *   - requiredTokens: regexes that MUST match the restyle.
 *   - bannedTokens: regexes that MUST NOT match the restyle.
 *
 * Seeded with five entries that capture documented invariants. Kinds
 * without an entry fall through to the global checks — there is no
 * implicit-deny default to keep the change non-breaking for the long
 * tail of action kinds. Add entries here as invariants are documented. */
type NextActionContractEntry = {
  numberPolicy: "forbidden" | "required" | "optional";
  requiredTokens?: RegExp[];
  bannedTokens?: RegExp[];
};

const NEXT_ACTION_CONTRACT: Partial<Record<NextAction["kind"], NextActionContractEntry>> = {
  /* Discovery probes ask one structured question; emitting a number
   * here is almost always the LLM hallucinating a salary anchor before
   * the recruiter has decided to disclose. Numbers that legitimately
   * appear in the canonical (e.g. "your 18L current") are echoed via
   * the global subset rule — restyle output containing numbers that
   * weren't already in the canonical is blocked there. The forbidden
   * policy makes the failure mode obvious in the validator log. */
  "discovery-probe": { numberPolicy: "forbidden" },
  /* Probe-justification asks "why this number?" without quoting one. */
  "probe-justification": { numberPolicy: "forbidden" },
  /* Counter-offers are math turns — the restyle must carry a numeric
   * offer or the candidate has no anchor to react to. */
  "counter-offer": { numberPolicy: "required" },
  /* Open-with-offer is the seed anchor; numbers are mandatory. */
  "open-with-offer": { numberPolicy: "required" },
  /* close-recap-formal is the structured confirmation turn — numbers
   * are mandatory (the recap exists to bind the candidate to the
   * structured offer). The four band-anchor field tokens (fixed /
   * variable / notice / bgv) are enforced by the legacy
   * `close-recap-incomplete` branch below to preserve its named-reason
   * contract; the table entry layers in the numeric-content invariant
   * the legacy check did not cover. */
  "close-recap-formal": { numberPolicy: "required" },
  /* ResumeFactPack track Step 4 (2026-05-16) — credibility-probe. No
   * numbers (alignment question, not an offer). Required token "resume"
   * pins the line to its purpose so the LLM can't restyle away the
   * resume reference. */
  "credibility-probe": { numberPolicy: "forbidden", requiredTokens: [/\bresume\b/i] },
  /* AP3-F2 (2026-05-17) — component-aware discovery. Per-component
   * requiredTokens pin the restyle to its topic (the LLM cannot restyle
   * a "what's the base split?" into a generic compensation probe).
   * numberPolicy is "optional" — the candidate may quote a number back
   * but the kernel itself doesn't author one. The actual component
   * regex applied at validation time is selected by inspecting the
   * NextAction.component field via the lookup helper below. */
  "component-probe": { numberPolicy: "optional" },
};

/** AP3-F2 (2026-05-17) — component-probe requiredTokens are
 *  per-component, so they cannot be statically baked into the contract
 *  table. The validator below consults this map when the action kind is
 *  "component-probe" and layers the matching regex on top of the
 *  static entry. */
const COMPONENT_PROBE_REQUIRED_TOKENS: Record<
  "base" | "variable" | "esop",
  RegExp
> = {
  base: /\bbase\b/i,
  variable: /\b(?:variable|bonus|perf)\b/i,
  esop: /\b(?:esop|rsu|equity|vest)\b/i,
};

/** Validate the LLM restyle against the canonical line. Rejection
 *  causes canonical fallback. Conservative: any number not present in
 *  the canonical, any new closing-vocab outside close phase, or any
 *  >2x length blow-up is rejected. */
export function validateRestyle(
  canonical: string,
  restyled: string,
  state: NegotiationState,
  action?: NextAction,
): { valid: boolean; reason?: string } {
  if (!restyled || !restyled.trim()) {
    return { valid: false, reason: "empty-restyle" };
  }
  /* Length check — restyle must not balloon past 2x canonical. */
  if (restyled.length > canonical.length * 2 && restyled.length > 280) {
    return { valid: false, reason: "restyle-too-long" };
  }
  /* Numbers in restyle must be a subset of numbers in canonical. */
  const canonicalNums = new Set(extractNumbers(canonical));
  const restyleNums = extractNumbers(restyled);
  for (const n of restyleNums) {
    if (!canonicalNums.has(n)) {
      return { valid: false, reason: `new-number-in-restyle:${n}` };
    }
  }
  /* Closing vocab is allowed only when the canonical itself has it OR
   * the phase is a close phase. */
  const canonicalHasClose = CLOSE_VOCAB_RE.test(canonical);
  const inClosePhase = state.phase === "accepted" || state.phase === "walked-away" || state.phase === "stalemate";
  if (!canonicalHasClose && !inClosePhase && CLOSE_VOCAB_RE.test(restyled)) {
    return { valid: false, reason: "new-close-vocab-outside-close-phase" };
  }
  /* PDF#24 follow-up (2026-05-16) — ack-prefix preservation. When the
   * kernel canonical was authored with a discovery-probe acknowledgement
   * prefix (buildDiscoveryAck), the restyle MUST preserve some form of
   * acknowledgement. The restyle prompt explicitly permits opening-phrase
   * changes, so without this rule the LLM can fully strip the ack and
   * regress to the transactional cadence the prefix was meant to fix.
   * The vocab set is broad — any of "noted", "got it", "understood",
   * "appreciate", "right on …", "thanks for that", "fair enough" is fine. */
  if (ACK_VOCAB_RE.test(canonical) && !ACK_VOCAB_RE.test(restyled)) {
    return { valid: false, reason: "ack-prefix-stripped" };
  }
  /* Defect 2 (2026-05-16) — banned Indian-recruiter idiom (US-tech
   * recruiter phrases like "circle back", "touch base", "on board",
   * "synergy", "reach out") MUST NOT leak into the restyle output.
   * Canonical never emits these (renderCanonicalProse is curated), so
   * any occurrence in the restyle is the LLM ignoring the banned-list
   * directive. Fall back to canonical verbatim. */
  if (BANNED_RECRUITER_IDIOM_RE.test(restyled)) {
    return { valid: false, reason: "banned-idiom-leaked" };
  }
  /* F7 / Audit Pass 2 (PDF#25, 2026-05-16) — ack-without-disclosure.
   *
   * Every ACK_TEMPLATES entry pairs a restyle keyword pattern (e.g.
   * "Fair enough on your current compensation") with a state predicate
   * that must hold for that ACK to be honest. If the restyle leaks an
   * ACK keyword but the corresponding state field is null/empty, the
   * recruiter is fabricating a disclosure. Reject before any grammar /
   * idiom-stacking gate so the more fundamental invariant gets the
   * named rejection reason. */
  for (const t of ACK_TEMPLATES) {
    if (t.restyleKeywordRe.test(restyled) && !t.requires(state)) {
      return { valid: false, reason: "ack-without-disclosure" };
    }
  }
  /* Bug 1 fix (PDF#25, 2026-05-16) — IDIOM STACKING.
   *
   * Session #25 (Senior Product Designer @ Flipkart) produced restyles
   * that crammed 3-4 Indian-recruiter idioms into a single sentence
   * ("on the expected fitment", "as per the band for this grade",
   * "broadly aligned"). The whitelist is per-token; nothing previously
   * capped the per-utterance count. Real recruiters pick ONE idiom and
   * route the rest as plain English.
   *
   * The effective cap is max(IDIOM_PER_UTTERANCE_CAP, canonicalIdioms)
   * — the restyle must not introduce MORE idioms than the canonical
   * already chose. Canonical prose is curated (e.g. close-recap-formal
   * legitimately uses both "fitment" + "revert" — 2 idioms — because
   * those are the load-bearing tokens for the recap and the
   * confirmation). The cap floor applies to free-form turns where the
   * canonical opted for one idiom and the LLM padded with two more. */
  const canonicalIdiomCount = countPreferredIdioms(canonical);
  const restyleIdiomCount = countPreferredIdioms(restyled);
  const effectiveCap = Math.max(IDIOM_PER_UTTERANCE_CAP, canonicalIdiomCount);
  if (restyleIdiomCount > effectiveCap) {
    return { valid: false, reason: "idiom-stacking" };
  }
  /* Bug 1 fix (PDF#25, 2026-05-16) — GRAMMAR MISMATCH.
   *
   * Lines like "Fair enough on your current compensation, let's look at
   * the total CTC at present?" mix a declarative connective lead with a
   * trailing "?" — grammatically wrong in any English. Reject and rebuild
   * from canonical. The declarative leads we police are the ones the
   * restyle prompt explicitly nominates ("Fair enough", "Got it", "Sure",
   * "Right") plus "Okay" / "Alright" which the LLM reaches for as
   * synonyms. */
  if (DECLARATIVE_PLUS_QUESTION_RE.test(restyled)) {
    return { valid: false, reason: "declarative-plus-question-mark" };
  }
  /* Bug 1 fix (PDF#25, 2026-05-16) — TAUTOLOGY CHECK.
   *
   * "what's the total CTC as per your current band?" — the candidate's
   * current CTC is, definitionally, set by their current employer's
   * band. The "as per your current band" qualifier is a tautology that
   * makes the recruiter sound like they're padding. The canonical never
   * emits this; the LLM is filling space. Reject. */
  if (TAUTOLOGY_RE.test(restyled)) {
    return { valid: false, reason: "tautology-current-band" };
  }
  /* F1 / Audit Pass 2 (PDF#25, 2026-05-16) — multi-topic-per-utterance.
   *
   * Session #25 T2 packed two discovery topics into a single bot turn
   * ("expected fitment ... what's the total CTC at present?"). Canonical
   * prose is curated to one topic per turn; the LLM restyle must not
   * collapse two probes into one. Count distinct topic keywords; if >1,
   * reject so the canonical (single-topic) line ships verbatim. */
  let topicHits = 0;
  for (const re of Object.values(TOPIC_KEYWORD_MAP)) {
    if (re.test(restyled)) topicHits += 1;
    if (topicHits > 1) break;
  }
  if (topicHits > 1) {
    /* But canonical may legitimately reference two topics (e.g. the
     * close-recap-formal recap names notice + variable + fixed). Skip
     * the gate when the canonical itself spans >1 topic — the LLM is
     * mirroring, not stacking. */
    let canonicalHits = 0;
    for (const re of Object.values(TOPIC_KEYWORD_MAP)) {
      if (re.test(canonical)) canonicalHits += 1;
      if (canonicalHits > 1) break;
    }
    if (canonicalHits <= 1) {
      return { valid: false, reason: "multi-topic-utterance" };
    }
  }
  /* F2 / Audit Pass 2 (PDF#25, 2026-05-16) — internal-hedge leak.
   *
   * Recruiter-internal thought ("let me check as per the band ... but
   * broadly aligned") is process-narration. Canonical never emits these
   * patterns outside the legitimate sentiment-prefix path; if the
   * restyle introduces one the canonical didn't, the LLM is padding.
   * Reject. */
  if (HEDGE_FILLER_RE.test(restyled) && !HEDGE_FILLER_RE.test(canonical)) {
    return { valid: false, reason: "internal-hedge-leak" };
  }
  /* Defect 6 (2026-05-16) — sentiment-prefix preservation. If the
   * canonical opened with one of the renderSentimentPrefix anchor
   * phrases, the restyle MUST keep at least one anchor phrase (broad
   * vocab — see SENTIMENT_VOCAB_RE). Without this rule a frustrated /
   * excited / hesitant cue gets stripped to flat-affect cadence. */
  if (SENTIMENT_VOCAB_RE.test(canonical) && !SENTIMENT_VOCAB_RE.test(restyled)) {
    return { valid: false, reason: "sentiment-prefix-stripped" };
  }
  /* Audit Pass 3 / Fix 3 (2026-05-16) — per-kind contract enforcement.
   * Looks up the active NextAction kind in NEXT_ACTION_CONTRACT and
   * applies numberPolicy + requiredTokens + bannedTokens on top of the
   * global checks above. Unknown kinds fall through (no implicit deny).*/
  if (action != null) {
    const contract = NEXT_ACTION_CONTRACT[action.kind];
    if (contract != null) {
      if (contract.numberPolicy === "forbidden" && restyleNums.length > 0) {
        return { valid: false, reason: `contract-number-forbidden:${action.kind}` };
      }
      if (contract.numberPolicy === "required" && restyleNums.length === 0) {
        return { valid: false, reason: `contract-number-required:${action.kind}` };
      }
      if (contract.requiredTokens != null) {
        for (const re of contract.requiredTokens) {
          if (!re.test(restyled)) {
            return { valid: false, reason: `contract-required-token-missing:${action.kind}:${re.source}` };
          }
        }
      }
      if (contract.bannedTokens != null) {
        for (const re of contract.bannedTokens) {
          if (re.test(restyled)) {
            return { valid: false, reason: `contract-banned-token-present:${action.kind}:${re.source}` };
          }
        }
      }
    }
    /* AP3-F2 (2026-05-17) — component-probe per-component requiredToken
     * overlay. The base contract entry for "component-probe" carries no
     * static requiredTokens because each component (base/variable/esop)
     * pins a different lexical surface. Layer the per-component regex
     * on top of the contract's static checks so the restyle for a
     * "base" probe cannot drift into a "variable" probe or vice-versa. */
    if (action.kind === "component-probe") {
      const re = COMPONENT_PROBE_REQUIRED_TOKENS[action.component];
      if (re != null && !re.test(restyled)) {
        return {
          valid: false,
          reason: `contract-required-token-missing:component-probe:${action.component}:${re.source}`,
        };
      }
    }
  }
  /* Defect 6 (2026-05-16) — close-recap-formal field completeness.
   * The formal recap canonical enumerates Fixed | Variable | (JB) |
   * Notice | BGV | OL ETA, and the candidate is asked to confirm
   * against that list. The LLM has historically smoothed over the
   * recap into a single-sentence summary that drops "fixed",
   * "variable", "notice", or "BGV" — a recap that's missing any of
   * those four is unfit to ship because the candidate's "yes" no
   * longer binds them to the structured terms. */
  if (action != null && action.kind === "close-recap-formal") {
    const lc = restyled.toLowerCase();
    const required = ["fixed", "variable", "notice", "bgv"] as const;
    for (const term of required) {
      if (!lc.includes(term)) {
        return { valid: false, reason: "close-recap-incomplete" };
      }
    }
  }
  return { valid: true };
}

/** Validate the LLM answer against the factPack. Numbers in the answer
 *  must appear in the factPack JSON (or be the candidate's own ctc /
 *  expected). Fabricated specifics → fall back to deterministic defer. */
export function validateAnswer(
  answer: string,
  factPack: { candidateCurrentCtc?: number; candidateExpectedCtc?: number; budgetBand?: { low: number; high: number; walk: number }; teamSize?: number },
): { valid: boolean; reason?: string } {
  if (!answer || !answer.trim()) return { valid: false, reason: "empty-answer" };
  const allowed = new Set<string>();
  if (factPack.candidateCurrentCtc != null) allowed.add(String(factPack.candidateCurrentCtc));
  if (factPack.candidateExpectedCtc != null) allowed.add(String(factPack.candidateExpectedCtc));
  if (factPack.budgetBand) {
    allowed.add(String(factPack.budgetBand.low));
    allowed.add(String(factPack.budgetBand.high));
    allowed.add(String(factPack.budgetBand.walk));
  }
  if (typeof factPack.teamSize === "number") allowed.add(String(factPack.teamSize));
  /* Allow tiny integers that show up in canonical reference facts (e.g.
   * "15 days", "12% PF", "4-year vest", "1-year cliff"). */
  for (const tinyInt of ["1", "3", "4", "5", "7", "12", "15", "25"]) allowed.add(tinyInt);

  const restyleNums = extractNumbers(answer);
  for (const n of restyleNums) {
    if (!allowed.has(n)) {
      return { valid: false, reason: `unfounded-number:${n}` };
    }
  }
  /* Defect 2 (2026-05-16) — answer path also enforces the banned-idiom
   * floor. Off-script answers go through the LLM with a factPack hint,
   * which historically leaked phrases like "let me get back to you" /
   * "circle back" on fact-gap defers. Pipeline-built defers use the
   * deterministic `buildDeferLead` text instead. */
  if (BANNED_RECRUITER_IDIOM_RE.test(answer)) {
    return { valid: false, reason: "banned-idiom-leaked" };
  }
  return { valid: true };
}

function lowercaseFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}
