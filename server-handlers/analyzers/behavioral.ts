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

type StarPart = "S" | "T" | "A" | "R";

const STAR_CUES: Record<StarPart, RegExp[]> = {
  S: [/\b(situation|context|background|at the time|when i was|the project was|we were|the team was|i once|once when|earlier this year|last year|previously)\b/i],
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
  version: "behavioral-v2",

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

    const seenQuestions: { idx: number; norm: string }[] = [];
    const starBreakdown: NonNullable<NonNullable<AnalyzerResult["meta"]>["behavioral"]>["starBreakdown"] = [];

    for (let i = 0; i < transcript.length; i++) {
      const turn = transcript[i];
      const text = (turn.text || "").trim();
      if (!text) continue;

      if (isAiTurn(turn)) {
        const norm = normalizeQuestion(text);
        // Only dedupe substantive AI prompts, not "got it" / "nice" etc.
        if (norm.length > 30) {
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
      if (text.length < 60) continue; // ignore "ok", "yes", micro-replies
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
    }

    if (userAnswerCount > 0) {
      const completionRate = starComplete / userAnswerCount;
      if (completionRate < 0.4) flags.add("weak_star_structure");

      const missingRRate = missingResultCount / userAnswerCount;
      if (missingRRate > 0.5) flags.add("frequent_missing_result");

      const acceptedRate = acceptedMissingR / Math.max(missingResultCount, 1);
      if (acceptedMissingR >= 2 && acceptedRate > 0.6) flags.add("ai_accepts_missing_result");

      const unquantifiedRate = unquantifiedCount / userAnswerCount;
      if (unquantifiedRate > 0.7 && userAnswerCount >= 3) flags.add("unquantified_answers");
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
      if (unknownCompanies.size >= 2) flags.add("unverifiable_companies");
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
