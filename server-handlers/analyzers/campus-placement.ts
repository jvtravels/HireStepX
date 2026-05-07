/* Campus-placement interview analyzer — deterministic v1.
 *
 * Tailored to Indian campus / fresher hiring patterns. Catches:
 *   - User answered behavioral as IC professional (claims years of work)
 *     when they're actually a fresher — credibility gap
 *   - Generic "passion for technology" answers without specifics
 *   - No academic project or capstone discussed
 *   - AI didn't ask about CGPA / coursework / availability
 *   - User badmouthed the college / professors
 */

import { AnalyzerInput, AnalyzerResult, FocusAnalyzer, RubricGap, TranscriptTurn, emptyResult } from "./_types";

const isAi = (t: TranscriptTurn) => t.speaker.toLowerCase().startsWith("a");
const isUser = (t: TranscriptTurn) => t.speaker.toLowerCase().startsWith("u");

const ACADEMIC_PROJECT = /\b(capstone|final[- ]?year project|btech project|major project|college project|coursework|cgpa|gpa|sgpa|kt\b|backlog)\b/i;
const FRESHER_LEXICON = /\b(fresher|just graduated|final year|recent graduate|college senior|placement|on[- ]campus|btech|b\.?tech|bca|mca|m\.?tech)\b/i;
const GENERIC_PASSION = /\b(passionate about (?:tech|coding|technology|engineering|programming)|always loved|since childhood|always wanted to|love (?:to )?learn)\b/i;
const SPECIFIC_PROJECT = /\b(built|implemented|deployed|led|coded|designed|trained|integrated|published)\s+\w+/i;
const AVAILABILITY = /\b(available (?:from|after)|join (?:by|in|on|after)|notice|graduation|exam|semester|joining date)\b/i;
const COLLEGE_BADMOUTH = /\b(my college (?:was|is) (?:bad|terrible|awful)|(?:professors|faculty) (?:are|were) (?:useless|incompetent|terrible)|nothing was taught|wasted (?:my )?time)\b/i;

export const campusPlacementAnalyzer: FocusAnalyzer = {
  focus: "campus-placement",
  version: "campus-placement-v1",
  async analyze({ session }: AnalyzerInput): Promise<AnalyzerResult> {
    const result = emptyResult();
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    if (transcript.length === 0) { result.flags.push("empty_transcript"); return result; }

    const flags = new Set<string>();
    const gaps: RubricGap[] = [];

    const aiText = transcript.filter(isAi).map((t) => t.text || "").join(" ");
    const userText = transcript.filter(isUser).map((t) => t.text || "").join(" ");
    const fullText = `${aiText} ${userText}`;
    const userTurnCount = transcript.filter(isUser).filter((t) => (t.text || "").length > 50).length;

    // No academic project / coursework / CGPA discussed at all
    if (userTurnCount >= 3 && !ACADEMIC_PROJECT.test(fullText)) {
      flags.add("no_academic_project_discussed");
      gaps.push({
        dimension: "fresher_relevance",
        expected: "Campus interviews should surface capstone / final-year project / coursework",
        observed: "No academic project, CGPA, or coursework came up",
        severity: "medium",
      });
    }

    // Generic passion language without concrete project
    if (GENERIC_PASSION.test(userText) && !SPECIFIC_PROJECT.test(userText)) {
      flags.add("generic_passion_no_substance");
      gaps.push({
        dimension: "specificity",
        expected: "Replace 'passionate about tech' with a specific project + outcome",
        observed: "User used generic passion language without describing a built artifact",
        severity: "medium",
      });
    }

    // Identifies as fresher AND never mentioned availability
    if (FRESHER_LEXICON.test(userText) && !AVAILABILITY.test(`${aiText} ${userText}`) && userTurnCount >= 3) {
      flags.add("availability_never_discussed");
    }

    // Badmouthing college
    if (COLLEGE_BADMOUTH.test(userText)) {
      flags.add("user_badmouthing_college");
      gaps.push({
        dimension: "professionalism",
        expected: "Frame challenges constructively even when discussing weak coursework",
        observed: "User badmouthed college / professors — costs interview points",
        severity: "high",
      });
    }

    const tips: string[] = [];
    if (flags.has("no_academic_project_discussed")) tips.push("As a fresher, lead with your capstone or final-year project — it's your strongest evidence.");
    if (flags.has("generic_passion_no_substance")) tips.push("Replace 'I'm passionate about tech' with 'I built X using Y, here's what I learned.'");
    if (flags.has("user_badmouthing_college")) tips.push("Even if coursework was weak, frame it as 'I supplemented with self-study and projects' — never criticize professors.");

    result.rubricGaps = gaps;
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    return result;
  },
};
