/* HR-round interview analyzer — deterministic v1.
 *
 * HR-round failure modes are quieter than other focuses — what we watch for:
 *   - User volunteers a salary number unprompted (anchor leak — costly mistake)
 *   - User badmouths previous employer
 *   - User gives generic "tell me about yourself" answer with no specifics
 *   - AI never asked about availability / notice period / location preferences
 *   - Conversation spent <40% on culture/values fit topics it should cover
 */

import {
  AnalyzerInput,
  AnalyzerResult,
  FocusAnalyzer,
  RubricGap,
  TranscriptTurn,
  emptyResult,
} from "./_types";

function isAi(t: TranscriptTurn): boolean { return t.speaker.toLowerCase().startsWith("a"); }
function isUser(t: TranscriptTurn): boolean { return t.speaker.toLowerCase().startsWith("u"); }

const SALARY_NUMBER = /(?:₹|inr\s*)?\d{1,3}(?:[.,]\d{1,2})?\s*(?:lpa|lakhs?|l\b|cr|crores?|k|usd|\$)/i;
const ASKED_ABOUT_SALARY = /\b(salary expectation|comp(?:ensation)? expectation|what are you looking for|target salary|expected ctc)\b/i;
const BADMOUTHING = /\b(toxic|terrible|awful|hated|worst|stupid|incompetent|micromanag|backstab|crook)\b/i;
const NOTICE_PERIOD = /\b(notice period|when can you start|availability|join (?:by|on|in)|relocat|location preference)\b/i;
const SELF_INTRO_PROMPT = /\b(tell me about yourself|walk me through|introduce yourself|your background)\b/i;
const SPECIFICS = /\b\d+\s*(?:years?|months?)\b|\b(?:built|led|shipped|launched|migrated|deployed|scaled)\b/i;

export const hrRoundAnalyzer: FocusAnalyzer = {
  focus: "hr-round",
  version: "hr-round-v1",

  async analyze({ session }: AnalyzerInput): Promise<AnalyzerResult> {
    const result = emptyResult();
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    if (transcript.length === 0) {
      result.flags.push("empty_transcript");
      return result;
    }

    const flags = new Set<string>();
    const gaps: RubricGap[] = [];

    const aiText = transcript.filter(isAi).map((t) => t.text || "").join(" ");
    const userText = transcript.filter(isUser).map((t) => t.text || "").join(" ");

    // Anchor leak — user volunteered a salary number before being asked
    let anchorLeaked = false;
    let aiAskedAt = Infinity;
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && ASKED_ABOUT_SALARY.test(t.text || "") && i < aiAskedAt) {
        aiAskedAt = i;
      }
      if (isUser(t) && SALARY_NUMBER.test(t.text || "") && i < aiAskedAt) {
        anchorLeaked = true;
      }
    }
    if (anchorLeaked) {
      flags.add("user_anchor_leaked_salary");
      gaps.push({
        dimension: "negotiation_protection",
        expected: "User holds salary number until HR explicitly asks",
        observed: "User volunteered a number before being asked — costs leverage",
        severity: "high",
      });
    }

    // Badmouthing previous employer
    if (BADMOUTHING.test(userText)) {
      flags.add("user_badmouthing_employer");
      gaps.push({
        dimension: "professionalism",
        expected: "Frame past challenges constructively, never personally",
        observed: "Negative language about previous employer detected",
        severity: "high",
      });
    }

    // Notice period / availability never came up
    if (transcript.length > 6 && !NOTICE_PERIOD.test(`${aiText} ${userText}`)) {
      flags.add("notice_period_never_discussed");
    }

    // "Tell me about yourself" gets a generic answer
    if (SELF_INTRO_PROMPT.test(aiText)) {
      // Find user's response to that prompt
      const promptIdx = transcript.findIndex((t) => isAi(t) && SELF_INTRO_PROMPT.test(t.text || ""));
      const reply = transcript.slice(promptIdx + 1, promptIdx + 3).find(isUser);
      if (reply && reply.text && reply.text.length >= 60 && !SPECIFICS.test(reply.text)) {
        flags.add("generic_self_intro");
        gaps.push({
          dimension: "specificity",
          expected: "Self-intro includes years of experience, concrete projects, results",
          observed: "Self-intro lacked numbers, project names, or action verbs",
          severity: "medium",
        });
      }
    }

    const tips: string[] = [];
    if (flags.has("user_anchor_leaked_salary")) tips.push("Never name a salary first — deflect with 'I'd want to understand the role + level before discussing comp.'");
    if (flags.has("user_badmouthing_employer")) tips.push("Reframe past frustrations as growth opportunities. HR scores professionalism heavily.");
    if (flags.has("generic_self_intro")) tips.push("Tighten 'tell me about yourself' to a 90-second story with 2 concrete projects + outcomes.");

    result.rubricGaps = gaps;
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    return result;
  },
};
