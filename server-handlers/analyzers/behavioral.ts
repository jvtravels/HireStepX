/* Behavioral interview analyzer — deterministic v1.
 *
 * Catches the failure modes the live evaluator misses:
 *   - User answers without all four STAR components
 *   - AI accepted a missing-Result answer without probing for outcome
 *   - User gave qualitative claims with no numbers ("improved performance")
 *   - AI repeated the same question template back-to-back
 *
 * No LLM call. Pure regex/lexical analysis so it runs cheaply over
 * every session in the nightly cron and unit tests stay fast.
 *
 * v2 will add an LLM rubric pass for tone + cultural fit, gated on
 * a green ground-truth fixture set.
 */

import {
  AnalyzerInput,
  AnalyzerResult,
  BadQuestion,
  FocusAnalyzer,
  Hallucination,
  RubricGap,
  TranscriptTurn,
  emptyResult,
} from "./_types";
import {
  aggregateCompetencies,
  Competency,
  CompetencyTrack,
  detectCompetencies,
  topCompetenciesForTrack,
} from "./_behavioral-competencies";
import {
  classifyAiProbe,
  classifyFailureResponse,
  hasLearningReflection,
  isFailureQuestion,
  isVagueAnswer,
} from "./_behavioral-probing";
import { findUsismDrift, type UsismHit } from "./_usism-patterns";
import { detectEvidenceQuality } from "../_evidence-signals";
import { isAnswerOffTopic } from "../_topical-alignment";

type StarPart = "S" | "T" | "A" | "R";

const STAR_CUES: Record<StarPart, RegExp[]> = {
  S: [/\b(situation|context|background|at the time|when i was|the project was|we were|the team was|i once|once when|earlier this year|last year|previously)\b/i, /\bin one of my (?:projects|roles|teams)\b/i, /\bin my (?:current|previous|last) (?:project|role|team|company)\b/i, /\bfor (?:an?|our) (?:admin|internal|customer[\s-]?facing|user[\s-]?facing|legacy|enterprise|consumer|b2b|b2c|saas|mobile|web|fintech|edtech|healthtech|e[\s-]?commerce|growth|onboarding|checkout|payments?|dashboard|portal|product|platform|system|app|tool|component|service)\b/i],
  T: [/\b(my (?:task|goal|job|role|responsibility)|i was (?:responsible|assigned|asked|told)|the objective|i needed to|asked me to|to (?:adopt|migrate|deliver|ship|fix|build|design|reduce|launch))\b/i],
  // Action: any "I + past-tense verb" or "I + modal-action" — broad on purpose, narrows via R/T overlap.
  // Action: "I" + (optional filler word) + past-tense verb, OR explicit phrases.
  // Filler tolerance covers natural speech: "I once convinced", "I then built", "I personally led".
  A: [/\bi\s+(?:\w+\s+){0,2}(?:[a-z]+ed|built|led|wrote|drove|took|made|set|chose|ran|spoke|met|paired|shipped|gave|spent|broke|sent|put|got)\b/i, /\bmy approach\b/i, /\bi (?:decided|started by|focused on|worked with)\b/i],
  R: [/\b(the result|as a result|outcome|impact|we (?:shipped|launched|reduced|increased|saved|deprecated|migrated)|this led to|ultimately|in the end|by the end|saved (?:roughly|about|around)?\s*\d|dropped\s+\d|increased\s+\d|reduced\s+\d)\b/i],
};

/* IMPACT_QUANTIFIED — a number that lands near a result verb, signalling
 * an outcome claim ("reduced p99 by 40%", "shipped to 10k users"). Any
 * other number is NUMERIC_INCIDENTAL ("I worked 5 days a week") and
 * doesn't count as a quantified impact. We scan a ±48-char window
 * around each result verb hit. 48 chars ≈ 8 tokens at typical English
 * density — wider than that and proximity stops meaning attribution. */
const RESULT_VERB_RE = /\b(reduced|increased|saved|shipped|launched|grew|cut|improved|dropped|raised|lowered|boosted|accelerated|deprecated|migrated|delivered|onboarded|converted|retained|scaled)\b/gi;
const NUMBER_NEARBY_RE = /\b\d+(?:[.,]\d+)?\s*(?:%|percent|x|k|m|b|crores?|lakhs?|million|billion|hours?|days?|weeks?|months?|users?|customers?|requests?|qps|ms|engineers?|services?|teams?)?\b/i;

function hasImpactQuantified(text: string): boolean {
  RESULT_VERB_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RESULT_VERB_RE.exec(text)) !== null) {
    const start = Math.max(0, m.index - 48);
    const end = Math.min(text.length, m.index + m[0].length + 48);
    const window = text.slice(start, end);
    if (NUMBER_NEARBY_RE.test(window)) return true;
  }
  return false;
}

/* Corporate-suffix gate for `unverifiable_companies`. v1 fired on any
 * capitalized 2-word phrase after "at" — "At Northern India", "At Last
 * Year", "At The Time" all looked like company names. The fix: a
 * captured token only counts as a company hint if it has a corporate
 * suffix OR matches a known-company hint list. Mirrors the discipline
 * used in salary-negotiation / campus-placement company detection. */
const CORPORATE_SUFFIX_RE = /\b(Inc|Ltd|LLP|LLC|Pvt|Private|Limited|Technologies|Technology|Tech|Labs|Systems|Software|Solutions|Networks|Group|Corp|Corporation|Holdings|Industries|Enterprises|Consulting|Services|Capital|Ventures)\b\.?/i;

/* Hand-curated low-precision-cost stop-list of common false-positive
 * bigrams the old regex caught ("At Northern India" etc.). Anything in
 * this set is rejected even if it sneaks past the suffix check. */
const COMPANY_HINT_STOPLIST = new Set([
  "northern india", "southern india", "eastern india", "western india",
  "last year", "this year", "the time", "the moment", "the start", "the end",
  "the beginning", "the company", "the team", "the office", "the firm",
  "first glance", "one point", "some point", "the same", "the latest",
]);

/* Known-company hint list — small, high-precision set of cos that
 * appear in user transcripts without a corporate suffix. The set is
 * intentionally short; the resume cross-check + suffix gate carry the
 * verification load. Expand as production false-positive reports come
 * in, not preemptively. Stored lowercased; matching is lowercased. */
const KNOWN_COMPANY_HINT = new Set([
  "amazon", "google", "microsoft", "apple", "meta", "netflix", "tesla",
  "flipkart", "razorpay", "swiggy", "zomato", "ola", "uber", "paytm",
  "phonepe", "byju", "byjus", "freshworks", "zoho", "infosys", "tcs",
  "wipro", "accenture", "deloitte", "cognizant", "capgemini", "hcl",
  "oracle", "salesforce", "adobe", "ibm", "intel", "nvidia", "openai",
  "anthropic", "stripe", "shopify", "atlassian", "github", "linkedin",
  "myntra", "cred", "groww", "zerodha", "meesho", "udaan", "delhivery",
  "nykaa", "snapdeal", "makemytrip", "redbus", "bookmyshow", "cleartrip",
  "policybazaar", "lenskart", "boat", "boattt", "noise", "mamaearth",
  "sharechat", "moj", "dailyhunt", "inshorts", "unacademy", "vedantu",
  "physicswallah", "upgrad", "scaler", "newton", "interviewbit",
]);

const PROBE_FOR_RESULT = /\b(what (?:was|were) the (?:result|outcome|impact)|how did (?:it|that) turn out|did (?:it|that) work|what happened (?:in the end|after)|measurable|quantif|metric)\b/i;

/* Phase-6-hygiene — named thresholds. Promoted out of inline magic
 * numbers so a future tuning round can audit "why 0.4 vs 0.5" in one
 * place. Each value was calibrated against the fixture suite under
 * `__tests__/analyzers/behavioralFixtures.test.ts`; changes here will
 * shift fixture flag emissions and require re-pinning. */
export const BEHAVIORAL_THRESHOLDS = {
  /* "Substantive" answer floor (chars). Below this we treat the turn
   * as a micro-reply ("yes", "I think so") and exclude from STAR /
   * topical / evidence counters. */
  MIN_ANSWER_CHARS: 60,
  /* AI-question normalised length floor for dedupe — short
   * acknowledgements ("got it") shouldn't dedupe against each other. */
  MIN_QUESTION_NORM_CHARS: 30,
  /* STAR completion rate below which the session is "weak STAR". */
  WEAK_STAR_COMPLETION_RATE: 0.4,
  /* Missing-Result rate above which we flag candidate-side. */
  MISSING_RESULT_RATE: 0.5,
  /* AI accepted-missing-Result rate (of missing-R answers AI rolled
   * past) above which we flag AI-side. Paired with a min-count gate
   * because one miss in two is noisy. */
  AI_ACCEPTED_MISSING_R_RATE: 0.6,
  AI_ACCEPTED_MISSING_R_MIN_COUNT: 2,
  /* Unquantified-answer rate above which we flag (gated by min
   * answer count so a 2-question screen doesn't trip). */
  UNQUANTIFIED_RATE: 0.7,
  UNQUANTIFIED_MIN_ANSWERS: 3,
  /* Most "≥2 across the session" pattern thresholds — single misfire
   * is forgivable; the pattern is what we care about. */
  PATTERN_MIN_COUNT: 2,
  /* No-learning-reflection requires a min session length so short
   * screens (single answer) don't trip it. */
  NO_LEARNING_MIN_ANSWERS: 4,
  /* `we_attribution_heavy` — fraction of substantive user answers
   * that lean on we / team framing WITHOUT a first-person action verb.
   * Paired with a min-count gate so one stray collective turn doesn't
   * trip the session-level flag. */
  WE_ATTRIBUTION_RATE: 0.5,
  WE_ATTRIBUTION_MIN_HITS: 3,
} as const;

function classifyStar(text: string): Set<StarPart> {
  const found = new Set<StarPart>();
  for (const part of ["S", "T", "A", "R"] as StarPart[]) {
    if (STAR_CUES[part].some((rx) => rx.test(text))) found.add(part);
  }
  return found;
}

function isUserTurn(t: TranscriptTurn): boolean {
  return t.speaker.toLowerCase().startsWith("u");
}

function isAiTurn(t: TranscriptTurn): boolean {
  return t.speaker.toLowerCase().startsWith("a");
}

function normalizeQuestion(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}

export const behavioralAnalyzer: FocusAnalyzer = {
  focus: "behavioral",
  version: "behavioral-v5",

  async analyze({ session }: AnalyzerInput): Promise<AnalyzerResult> {
    const result = emptyResult();
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    if (transcript.length === 0) {
      result.flags.push("empty_transcript");
      return result;
    }

    const hallucinations: Hallucination[] = [];
    const gaps: RubricGap[] = [];
    const bad: BadQuestion[] = [];
    const flags = new Set<string>();

    let userAnswerCount = 0;
    let starComplete = 0;
    let missingResultCount = 0;
    let unquantifiedCount = 0;
    let acceptedMissingR = 0;

    /* Phase-3 probing-depth counters. The pairing is "user answer →
     * next AI turn". We compute them inline with the STAR loop so a
     * single pass over the transcript covers both. */
    let aiProbedDepth = 0;
    let aiProbedOwnership = 0;
    let aiAcceptedVague = 0;
    let learningReflections = 0;
    let failureQuestionAsked = false;
    let failureResponse: "owns" | "deflects" | "neutral" | null = null;

    /* Phase-6.3 evidence-quality counters. An answer with a metric but
     * no baseline / method / sample is a soft fail at senior level —
     * Bar-Raiser interviewers push exactly there. We aggregate across
     * the session because one floating "+30%" is forgivable; a pattern
     * of unsourced metrics + an AI that never probes the source is
     * what we want to flag. */
    let metricAnswersCount = 0;
    let metricAnswersUnevidenced = 0;
    let aiAcceptedUnevidencedMetric = 0;
    const evidenceGapHits: { turn_idx: number; missing: string[]; preview: string }[] = [];

    /* Phase-6.2 — answer↔question topical-alignment counters. We pair
     * each user answer with the LAST preceding AI turn (the prompt it
     * was responding to) and ask whether the answer is on-topic. */
    let offTopicCount = 0;
    const offTopicHits: { turn_idx: number; questionIntent: string; preview: string }[] = [];

    /* Phase-6-hygiene — `we_attribution_heavy` counter. Increment for
     * each substantive user answer that leans on collective framing
     * (`isVagueAnswer` returns true) — that helper already AND-gates
     * on "no first-person action verb", which is exactly the signal
     * we want. */
    let weAttributionHits = 0;

    const seenQuestions: { idx: number; norm: string }[] = [];
    const starBreakdown: NonNullable<NonNullable<AnalyzerResult["meta"]>["behavioral"]>["starBreakdown"] = [];

    for (let i = 0; i < transcript.length; i++) {
      const turn = transcript[i];
      const text = (turn.text || "").trim();
      if (!text) continue;

      if (isAiTurn(turn)) {
        /* Phase-3: tag the first AI turn that asks a failure-style
         * question and capture the user's classification on the NEXT
         * substantive user reply. We capture only the first failure
         * Q/A pair because the report renders one card. */
        if (!failureQuestionAsked && isFailureQuestion(text)) {
          failureQuestionAsked = true;
          const nextUser = transcript
            .slice(i + 1, i + 6)
            .find((t) => isUserTurn(t) && (t.text || "").trim().length >= 60);
          if (nextUser) {
            failureResponse = classifyFailureResponse(nextUser.text || "");
          }
        }
        const norm = normalizeQuestion(text);
        // Only dedupe substantive AI prompts, not "got it" / "nice" etc.
        if (norm.length > BEHAVIORAL_THRESHOLDS.MIN_QUESTION_NORM_CHARS) {
          const dup = seenQuestions.find((q) => q.norm === norm);
          if (dup) {
            bad.push({
              turn_idx: i,
              reason: "duplicate_question",
              evidence: text.slice(0, 280),
            });
            flags.add("duplicate_question");
          } else {
            seenQuestions.push({ idx: i, norm });
          }
        }
      }

      if (!isUserTurn(turn)) continue;
      if (text.length < BEHAVIORAL_THRESHOLDS.MIN_ANSWER_CHARS) continue; // ignore "ok", "yes", micro-replies
      userAnswerCount += 1;

      const parts = classifyStar(text);
      const present: StarPart[] = (["S", "T", "A", "R"] as StarPart[]).filter((p) => parts.has(p));
      const missing: StarPart[] = (["S", "T", "A", "R"] as StarPart[]).filter((p) => !parts.has(p));

      if (missing.length === 0) starComplete += 1;

      if (!parts.has("R")) {
        missingResultCount += 1;
        const nextAi = transcript.slice(i + 1, i + 3).find(isAiTurn);
        if (nextAi && !PROBE_FOR_RESULT.test(nextAi.text || "")) {
          acceptedMissingR += 1;
          gaps.push({
            dimension: "result_quantification",
            expected: "AI should probe for outcome when user omits Result",
            observed: `User answer at turn ${i} had no Result; AI replied without probing`,
            severity: "medium",
          });
        }
      }

      /* Quantified-impact check: v1 accepted any number (`5 days a
       * week` flagged as quantified). v2 requires the number to land
       * within ~8 tokens of a result verb — that's the difference
       * between "reduced p99 by 40%" and "I worked 5 days a week". */
      const quantified = hasImpactQuantified(text);
      if (parts.has("A") && !quantified) {
        unquantifiedCount += 1;
      }

      /* Phase-6.3 evidence-quality scan. Independent of the
       * `hasImpactQuantified` STAR signal: that asks "did the
       * candidate quote a number near a result verb?"; this asks
       * "for the numbers they quoted, did they attach baseline /
       * method / sample size?". A senior answer does both. */
      const evidence = detectEvidenceQuality(text);
      if (evidence.hasMetric) {
        metricAnswersCount += 1;
        if (!evidence.evidenced) {
          metricAnswersUnevidenced += 1;
          evidenceGapHits.push({
            turn_idx: i,
            missing: evidence.missingDimensions,
            preview: text.slice(0, 160),
          });
          /* AI-side probe check: did the next AI turn ask for
           * baseline / method / sample? If yes, the gap was caught
           * conversationally and we don't double-charge the score. */
          const nextAiTurn = transcript.slice(i + 1, i + 3).find(isAiTurn);
          if (nextAiTurn) {
            const probe = nextAiTurn.text || "";
            const probed =
              /\b(baseline|before|previously|from\s+\d|down\s+from|up\s+from)\b/i.test(probe) ||
              /\b(how (?:did|was) (?:you|that|it|the team) (?:measure|measured|track))\b/i.test(probe) ||
              /\b(a[\s\/-]?b\s+test|sample|cohort|how many users)\b/i.test(probe);
            if (!probed) aiAcceptedUnevidencedMetric += 1;
          } else {
            aiAcceptedUnevidencedMetric += 1;
          }
        }
      }

      /* Phase-6.2 topical-alignment pass. Find the most recent AI turn
       * before this user reply — that's the prompt the candidate was
       * answering. If the answer carries neither the question's intent
       * nor shared vocabulary, count it. ≥2 occurrences raises the
       * session-level flag below. */
      let precedingAi: TranscriptTurn | undefined;
      for (let j = i - 1; j >= 0; j--) {
        if (isAiTurn(transcript[j]) && (transcript[j].text || "").trim().length > 0) {
          precedingAi = transcript[j];
          break;
        }
      }
      if (precedingAi) {
        const check = isAnswerOffTopic(precedingAi.text || "", text);
        if (check.offTopic) {
          offTopicCount += 1;
          offTopicHits.push({
            turn_idx: i,
            questionIntent: check.questionIntent ?? "unknown",
            preview: text.slice(0, 160),
          });
        }
      }

      /* Phase 2: per-answer competency detection. Storing the keys
       * here means the report can show "this answer demonstrated
       * ownership + bias-for-action" inline with the STAR matrix —
       * not just an aggregate at the bottom. */
      const competencies = Array.from(detectCompetencies(text));

      starBreakdown.push({
        turn_idx: i,
        present,
        missing,
        text_preview: text.slice(0, 160),
        quantified,
        competencies,
      });

      /* Phase-6-hygiene — independent we-attribution counter. Same
       * `isVagueAnswer` predicate as the Phase-3 probing pass below,
       * but counted unconditionally on every answer (not only when an
       * AI follow-up exists). The session-level `we_attribution_heavy`
       * flag fires off this counter. */
      if (isVagueAnswer(text)) weAttributionHits += 1;

      /* Phase-3 probing pass: classify the AI turn that follows this
       * user answer. We look at the next 2 AI turns (some sessions
       * interleave a brief acknowledgement before the real probe). */
      const nextAi = transcript.slice(i + 1, i + 4).find(isAiTurn);
      if (nextAi) {
        const probe = classifyAiProbe(nextAi.text || "");
        if (probe.probedDepth) aiProbedDepth += 1;
        if (probe.probedOwnership) aiProbedOwnership += 1;
        /* "Accepted vague" = the user answer was vague AND the AI's
         * next turn neither probed for depth nor for ownership. This
         * is the false-pass we want to catch: the AI rolled on
         * without pushing back. */
        if (isVagueAnswer(text) && !probe.probedDepth && !probe.probedOwnership) {
          aiAcceptedVague += 1;
        }
      }

      if (hasLearningReflection(text)) learningReflections += 1;
    }

    if (userAnswerCount > 0) {
      const completionRate = starComplete / userAnswerCount;
      if (completionRate < BEHAVIORAL_THRESHOLDS.WEAK_STAR_COMPLETION_RATE) flags.add("weak_star_structure");

      const missingRRate = missingResultCount / userAnswerCount;
      if (missingRRate > BEHAVIORAL_THRESHOLDS.MISSING_RESULT_RATE) flags.add("frequent_missing_result");

      const acceptedRate = acceptedMissingR / Math.max(missingResultCount, 1);
      if (acceptedMissingR >= BEHAVIORAL_THRESHOLDS.AI_ACCEPTED_MISSING_R_MIN_COUNT && acceptedRate > BEHAVIORAL_THRESHOLDS.AI_ACCEPTED_MISSING_R_RATE) {
        flags.add("ai_accepts_missing_result");
      }

      const unquantifiedRate = unquantifiedCount / userAnswerCount;
      if (unquantifiedRate > BEHAVIORAL_THRESHOLDS.UNQUANTIFIED_RATE && userAnswerCount >= BEHAVIORAL_THRESHOLDS.UNQUANTIFIED_MIN_ANSWERS) {
        flags.add("unquantified_answers");
      }

      /* Phase-6-hygiene — `we_attribution_heavy`. Fires when ≥3 user
       * answers and ≥50% of them lean on collective framing (we / the
       * team / they) WITHOUT a first-person action verb. This is the
       * signal `BEHAVIORAL_PRIOR_FLAG_TO_DIMENSION` was already wired
       * to consume — we just hadn't implemented the emitter. */
      if (
        weAttributionHits >= BEHAVIORAL_THRESHOLDS.WE_ATTRIBUTION_MIN_HITS &&
        weAttributionHits / userAnswerCount >= BEHAVIORAL_THRESHOLDS.WE_ATTRIBUTION_RATE
      ) {
        flags.add("we_attribution_heavy");
      }
    } else {
      /* All-AI transcript or every user reply was a micro-utterance
       * below MIN_ANSWER_CHARS. Distinguishable from empty_transcript
       * (which has length 0); useful for the report layer to show a
       * different empty-state ("we have your interviewer but no
       * substantive answers") vs. "we have nothing". */
      flags.add("no_user_answers_recorded");
    }

    // Resume cross-check: if user mentions a company that isn't in the
    // resume, flag for human review. Cheap signal — avoids LLM cost.
    const resumeText = (session.jd_analysis ? JSON.stringify(session.jd_analysis) : "").toLowerCase();
    if (resumeText.length > 0) {
      const userText = transcript
        .filter(isUserTurn)
        .map((t) => t.text || "")
        .join(" ");
      /* Case-insensitive "at" — natural speech starts sentences with
       * "At Phantom Technologies" and the existing case-sensitive
       * `at` pattern silently lost those. Safe to broaden now that
       * the suffix + stoplist + known-co gate filters noise. */
      const companyHints = userText.match(/\bat\s+([A-Z][a-zA-Z0-9&.]{2,30}(?:\s[A-Z][a-zA-Z0-9&.]{2,30}){0,3})\b/gi) || [];
      const unknownCompanies = new Set<string>();
      for (const hint of companyHints) {
        const co = hint.replace(/^at\s+/i, "").trim();
        if (co.length < 3) continue;
        const coLower = co.toLowerCase();
        /* Drop bigrams that are obviously not company names. v1 fired
         * on "At Northern India" / "At Last Year" — false positives
         * that eroded the signal. */
        if (COMPANY_HINT_STOPLIST.has(coLower)) continue;
        /* A capitalized phrase only counts as a company hint when it
         *  (a) carries a corporate suffix (Inc / Pvt Ltd / Technologies),
         *  (b) matches a known-company list, or
         *  (c) appears in the resume (treated as user-attested name).
         * Without one of these, the phrase is noise. */
        const hasSuffix = CORPORATE_SUFFIX_RE.test(co);
        const isKnown = KNOWN_COMPANY_HINT.has(coLower) ||
          Array.from(KNOWN_COMPANY_HINT).some((k) => coLower.startsWith(k + " "));
        const inResume = resumeText.includes(coLower);
        if (!(hasSuffix || isKnown || inResume)) continue;
        if (!inResume) unknownCompanies.add(co);
      }
      if (unknownCompanies.size >= BEHAVIORAL_THRESHOLDS.PATTERN_MIN_COUNT) flags.add("unverifiable_companies");
    }

    /* Phase-4.1 — register-drift detector. Run the shared USISM
     * scanner against AI turns. The Behavioral focus is Indian-
     * register by default (see BEHAVIOURAL_INDIAN_REGISTER_RULE in
     * generate-questions); when the LLM slips into "$120k base" or
     * "401(k) match" the candidate's mock prep drifts to a market
     * they're not interviewing for. Single hit is noisy (one stray
     * "$" can sneak through); 2+ across the session is a pattern. */
    const usismHits: UsismHit[] = findUsismDrift(transcript);
    if (usismHits.length >= BEHAVIORAL_THRESHOLDS.PATTERN_MIN_COUNT) {
      flags.add("register_drift_to_us");
      /* Surface the top 3 hits as rubric gaps so the report can quote
       * the exact phrasing back at the user — same pattern salary-neg
       * uses for credibility cross-checks. */
      for (const hit of usismHits.slice(0, 3)) {
        gaps.push({
          dimension: "indian_register",
          expected: "AI should ground coaching in Indian-market terms (₹ / LPA / leave / EPF)",
          observed: `Turn ${hit.turn_idx}: "${hit.phrase}" — ${hit.label}`,
          severity: "low",
          flag: "register_drift_to_us",
        });
      }
    }

    /* Phase-3 flags. Thresholds are conservative: 2+ vague accepts is
     * a pattern; one could be the AI moving on intentionally because
     * the question was already answered. Same for missing learning
     * reflection — gated to sessions with ≥4 substantive answers so
     * short screens don't trip it. Set BEFORE coaching so the
     * coaching block below reads a fully-populated flag set. */
    /* Phase-6.3 evidence flags. Two distinct signals:
     *  - `metric_without_baseline` fires on the CANDIDATE (≥2 metric
     *    answers that floated untethered out of ≥2 metric answers).
     *  - `ai_accepted_unevidenced_metric` fires on the AI (≥2 cases
     *    where the next AI turn rolled past without probing).
     * Separating them matches the way the rest of the analyzer
     * distinguishes user-side vs interviewer-side misses (see
     * `frequent_missing_result` vs `ai_accepts_missing_result`). */
    if (metricAnswersUnevidenced >= BEHAVIORAL_THRESHOLDS.PATTERN_MIN_COUNT && metricAnswersCount >= BEHAVIORAL_THRESHOLDS.PATTERN_MIN_COUNT) {
      flags.add("metric_without_baseline");
      for (const hit of evidenceGapHits.slice(0, 3)) {
        gaps.push({
          dimension: "evidence_quality",
          expected: "Metrics quoted should attach baseline (from X to Y), measurement method (A/B / analytics), or sample size",
          observed: `Turn ${hit.turn_idx}: "${hit.preview}" — missing ${hit.missing.join(", ")}`,
          severity: "medium",
          flag: "metric_without_baseline",
        });
      }
    }
    if (aiAcceptedUnevidencedMetric >= BEHAVIORAL_THRESHOLDS.PATTERN_MIN_COUNT) flags.add("ai_accepted_unevidenced_metric");

    /* Phase-6.2 — repeated off-topic answers. Single misfire is
     * forgivable (paraphrased to a related theme); ≥2 across the
     * session signals the candidate isn't anchoring to the prompt. */
    if (offTopicCount >= BEHAVIORAL_THRESHOLDS.PATTERN_MIN_COUNT) {
      flags.add("answer_off_topic");
      for (const hit of offTopicHits.slice(0, 3)) {
        gaps.push({
          dimension: "topical_alignment",
          expected: `Answer should address the question's intent (${hit.questionIntent})`,
          observed: `Turn ${hit.turn_idx}: "${hit.preview}"`,
          severity: "medium",
          flag: "answer_off_topic",
        });
      }
    }

    if (aiAcceptedVague >= BEHAVIORAL_THRESHOLDS.PATTERN_MIN_COUNT) flags.add("ai_accepted_vague");
    if (userAnswerCount >= BEHAVIORAL_THRESHOLDS.NO_LEARNING_MIN_ANSWERS && learningReflections === 0) {
      flags.add("no_learning_reflection");
    }
    if (failureQuestionAsked && failureResponse === "deflects") {
      flags.add("deflects_failure");
    }
    if (failureQuestionAsked && failureResponse === "owns") {
      /* Positive signal — kept in flags so the report can render it
       * as a strength badge alongside negative flags. */
      flags.add("owns_failure");
    }

    const coachingBits: string[] = [];
    if (flags.has("weak_star_structure")) {
      coachingBits.push("Practice answering with all four STAR parts — many answers skipped Situation or Task framing.");
    }
    if (flags.has("frequent_missing_result")) {
      coachingBits.push("Most answers stopped before the Result. Always close with the measurable outcome.");
    }
    if (flags.has("unquantified_answers")) {
      coachingBits.push("Add concrete numbers (%, hours saved, users impacted) to make impact credible.");
    }
    /* Phase-3 coaching. Aim per the plan: tell the candidate not just
     * that the AI rolled past a vague answer, but what to do about it
     * (preempt with first-person framing). */
    if (flags.has("ai_accepted_vague")) {
      coachingBits.push("Some answers stayed at 'we' / 'the team' — lead with what *you* personally did so the interviewer doesn't have to dig.");
    }
    if (flags.has("no_learning_reflection")) {
      coachingBits.push("Close stories with what you took away — 'In hindsight I would have…' lands well in Indian behavioral rounds.");
    }
    if (flags.has("deflects_failure")) {
      coachingBits.push("The failure question landed on blame routing — own the miss explicitly before naming external factors.");
    }
    if (flags.has("register_drift_to_us")) {
      coachingBits.push("The mock drifted into US framing (USD figures / PTO / 401k) — for Indian-market rounds, keep numbers in ₹ / LPA and leave / PL/CL terminology.");
    }
    if (flags.has("metric_without_baseline")) {
      coachingBits.push("You cited numbers without anchoring them — for senior rounds, always say what the baseline was, how it was measured (A/B test / analytics / session recordings), or the sample size. A floating '35-40% improvement' invites the next probe.");
    }
    if (flags.has("ai_accepted_unevidenced_metric")) {
      coachingBits.push("The mock interviewer rolled past quantified claims without checking the source — in real Bar-Raiser / Director rounds you should expect 'what was the baseline?' or 'how was that measured?' right after every number.");
    }
    if (flags.has("we_attribution_heavy")) {
      coachingBits.push("Most answers narrated the team's work, not yours — open every story with what *you* personally did ('I led / I designed / I decided') so the interviewer doesn't have to ask who-did-what twice.");
    }
    if (flags.has("answer_off_topic")) {
      coachingBits.push("A few answers drifted from the question's intent — start every response by mirroring the prompt ('You asked about a conflict — let me take one from my last role…') so the interviewer hears you've heard them.");
    }

    /* Phase 2: aggregate competency counts across the session and
     * rank the top demonstrated for the candidate's target track.
     * If we can't infer the track, fall back to unweighted top-by-
     * frequency — still useful as a positive signal in the report. */
    const userAnswers = transcript
      .filter(isUserTurn)
      .map((t) => (t.text || "").trim())
      .filter((t) => t.length >= 60);
    const competencyCounts = aggregateCompetencies(userAnswers);
    const track = inferCompetencyTrack(session.target_company || null);
    const topCompetencies = topCompetenciesForTrack(competencyCounts, track, 3);

    /* Coaching: positive anchoring. Plan principle #5 — surface
     * positives, not just negatives. When the candidate clearly
     * demonstrated 2+ competencies, name them. */
    if (topCompetencies.length >= 2) {
      const labels = topCompetencies.slice(0, 2).join(", ");
      coachingBits.unshift(
        `Strong signals on ${labels} — anchor future stories on these proven strengths.`,
      );
    }

    result.hallucinations = hallucinations;
    result.rubricGaps = gaps;
    result.badQuestions = bad;
    result.flags = Array.from(flags);
    result.coachingNotes = coachingBits.join(" ");
    if (starBreakdown.length > 0) {
      result.meta = {
        ...(result.meta || {}),
        behavioral: {
          starBreakdown,
          /* `Record<Competency, number>` widens to `Record<string, number>`
           * at the meta boundary because consumers (DB rows, report
           * UI) treat the keys as opaque strings. */
          competencyCounts: { ...competencyCounts },
          topCompetencies: topCompetencies.map((c) => String(c)),
          probing: {
            aiProbedDepth,
            aiProbedOwnership,
            aiAcceptedVague,
            learningReflections,
            failureQuestionAsked,
            failureResponse,
          },
          evidence: {
            metricAnswersCount,
            metricAnswersUnevidenced,
            aiAcceptedUnevidencedMetric,
          },
        },
      };
    }
    return result;
  },
};

/* Track-inference: which hiring track is this candidate interviewing
 * for? Heuristic on `target_company` because behavioral sessions
 * rarely carry an explicit track field. Conservative — when we don't
 * recognise the company, return null and the analyzer falls back to
 * unweighted top-by-frequency. */
function inferCompetencyTrack(company: string | null): CompetencyTrack | null {
  if (!company) return null;
  const c = company.toLowerCase();
  if (
    /\b(amazon|aws|amzn)\b/.test(c)
  ) {
    return "amazon-lp";
  }
  if (/\b(google|alphabet|youtube)\b/.test(c)) return "google";
  if (
    /\b(flipkart|razorpay|swiggy|zomato|cred|phonepe|paytm|myntra|nykaa|groww|zerodha|meesho|udaan|delhivery|ola|uber\s+india)\b/.test(
      c,
    )
  ) {
    return "indian-product";
  }
  if (
    /\b(tcs|infosys|wipro|cognizant|accenture|capgemini|hcl|tech\s+mahindra|mindtree|deloitte\s+india)\b/.test(
      c,
    )
  ) {
    return "services-lateral";
  }
  if (/\b(startup|seed|pre[\s-]?seed|series[\s-]?a)\b/.test(c)) return "startup";
  return null;
}

/* Local type alias re-exports kept for downstream files that import
 * the analyzer module directly (legacy DB-row mappers). */
export type { Competency };
