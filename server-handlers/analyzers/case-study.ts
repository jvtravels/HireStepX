/* Case-study interview analyzer — deterministic v1.
 *
 * Catches:
 *   - User jumped to solution without clarifying the problem
 *   - Numerical claims with no sanity check / units / order of magnitude
 *   - Framework dropped without applying to the numbers
 *   - AI accepted "I'd do market research" without forcing specifics
 *   - Conclusion didn't answer the original question
 */

import { AnalyzerInput, AnalyzerResult, FocusAnalyzer, RubricGap, TranscriptTurn, emptyResult } from "./_types";

const isAi = (t: TranscriptTurn) => t.speaker.toLowerCase().startsWith("a");
const isUser = (t: TranscriptTurn) => t.speaker.toLowerCase().startsWith("u");

const CLARIFYING_Q = /\b(what (?:is|are)|how (?:much|many|big|long)|can you (?:clarify|specify|define)|i'?d like to confirm|to make sure i understand|is the goal|what's the time horizon|geography|customer segment)\b/i;
const NUMBERS_USED = /\b\d{2,}(?:[.,]\d+)?\s*(?:k|m|b|million|billion|crore|lakh|%|percent)/i;
const SANITY_CHECK = /\b(sanity check|order of magnitude|roughly|that seems|that's about|napkin math|reality check|does that pass)/i;
const FRAMEWORK_NAME = /\b(profit(?:ability)? framework|3c|4p|porter|swot|issue tree|mece)\b/i;
const APPLICATION = /\b(applied to|in this case|for this business|that means|because|so the answer is)\b/i;
const VAGUE_RESEARCH = /\b(do (?:some |market )?research|analyze the (?:data|market)|look at competitors|study the segment)\b/i;
const FORCED_SPECIFIC = /\b(what specifically|which (?:competitors|segments|sources)|what data|what (?:would|will) you ask|narrow it down|be more specific)\b/i;

export const caseStudyAnalyzer: FocusAnalyzer = {
  focus: "case-study",
  version: "case-study-v1",
  async analyze({ session }: AnalyzerInput): Promise<AnalyzerResult> {
    const result = emptyResult();
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    if (transcript.length === 0) { result.flags.push("empty_transcript"); return result; }

    const flags = new Set<string>();
    const gaps: RubricGap[] = [];
    const aiText = transcript.filter(isAi).map((t) => t.text || "").join(" ");
    const userText = transcript.filter(isUser).map((t) => t.text || "").join(" ");
    const userTurnsSubstantive = transcript.filter(isUser).filter((t) => (t.text || "").length > 60);

    // First user response should clarify, not jump to solution
    const firstSubstantiveUser = userTurnsSubstantive[0];
    if (firstSubstantiveUser && !CLARIFYING_Q.test(firstSubstantiveUser.text || "")) {
      flags.add("jumped_to_solution");
      gaps.push({
        dimension: "problem_framing",
        expected: "Clarify scope, time horizon, geography, segment before proposing a solution",
        observed: "First substantive answer went straight to a recommendation",
        severity: "medium",
      });
    }

    // Numbers used but no sanity-check language
    if (NUMBERS_USED.test(userText) && !SANITY_CHECK.test(`${userText} ${aiText}`)) {
      flags.add("no_sanity_check");
    }

    // Named a framework but didn't apply
    if (FRAMEWORK_NAME.test(userText) && !APPLICATION.test(userText)) {
      flags.add("framework_without_application");
    }

    // Vague "do research" answers AI accepted
    if (VAGUE_RESEARCH.test(userText) && !FORCED_SPECIFIC.test(aiText)) {
      flags.add("ai_accepted_vague_research");
      gaps.push({
        dimension: "evaluator_rigor",
        expected: "AI should force specificity when user says 'I'd research the market'",
        observed: "AI accepted vague research-language without probing what specifically to ask / look at",
        severity: "medium",
      });
    }

    // Conclusion check — final user turn should restate a decision
    const lastUserTurn = userTurnsSubstantive[userTurnsSubstantive.length - 1];
    if (lastUserTurn && userTurnsSubstantive.length >= 3) {
      const text = (lastUserTurn.text || "").toLowerCase();
      const hasConclusion = /\b(my recommendation|i'?d recommend|the answer is|in summary|to conclude|so we should|bottom line|final answer)\b/i.test(text);
      if (!hasConclusion) flags.add("missing_conclusion");
    }

    const tips: string[] = [];
    if (flags.has("jumped_to_solution")) tips.push("Always open a case with 2-3 clarifying questions: scope, time horizon, success metric.");
    if (flags.has("no_sanity_check")) tips.push("State the order of magnitude before computing — 'roughly 50K, not 5M' — to catch errors early.");
    if (flags.has("framework_without_application")) tips.push("After naming a framework, apply it to the actual numbers immediately.");
    if (flags.has("missing_conclusion")) tips.push("Always close with an explicit recommendation that answers the original question.");

    result.rubricGaps = gaps;
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    return result;
  },
};
