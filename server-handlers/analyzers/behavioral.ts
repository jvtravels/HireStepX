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

const NUMERIC_CLAIM = /\b\d+(?:\.\d+)?\s*(?:%|percent|x|hours?|days?|weeks?|months?|users?|customers?|requests?|qps|ms|seconds?|crores?|lakhs?|k|m|b|million|billion)\b/i;

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
  version: "behavioral-v1",

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

      if (parts.has("A") && !NUMERIC_CLAIM.test(text)) {
        unquantifiedCount += 1;
      }
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
      const companyHints = userText.match(/\bat ([A-Z][a-zA-Z0-9&.]{2,30}(?:\s[A-Z][a-zA-Z0-9&.]{2,30})?)\b/g) || [];
      const unknownCompanies = new Set<string>();
      for (const hint of companyHints) {
        const co = hint.replace(/^at\s+/i, "").trim();
        if (co.length < 3) continue;
        if (!resumeText.includes(co.toLowerCase())) unknownCompanies.add(co);
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

    result.hallucinations = hallucinations;
    result.rubricGaps = gaps;
    result.badQuestions = bad;
    result.flags = Array.from(flags);
    result.coachingNotes = coachingBits.join(" ");
    return result;
  },
};
