/* Campus-placement interview analyzer — deterministic v2.
 *
 * Tailored to Indian campus / fresher hiring patterns. Catches:
 *   - Generic "passion for technology" answers without specifics
 *   - No academic project or capstone discussed
 *   - AI didn't ask about CGPA / coursework / availability
 *   - User badmouthed the college / professors
 *   - Project descriptions with no concrete tech stack named
 *   - Implausible team-size claims ("I led 20 people in a college project")
 *   - "Why this company" asked but answered with no company-specific signal
 *   - Volunteered backlogs / KTs / low CGPA unprompted (poor framing)
 *   - Excessive filler words ("basically", "as such", "like")
 *   - Internship claimed in resume but never elaborated
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

/* Concrete tech stack — at least one of these must appear when the user
 * narrates a project, otherwise the answer reads as hand-wave. */
const TECH_STACK = /\b(python|java\b|javascript|typescript|c\+\+|kotlin|swift|go(?:lang)?|rust|node(?:\.?js)?|react|next(?:\.?js)?|angular|vue|django|flask|spring|express|fastapi|tensorflow|pytorch|numpy|pandas|scikit|opencv|sql|mysql|postgres|mongodb|redis|firebase|aws|gcp|azure|docker|kubernetes|git|linux|raspberry pi|arduino|html|css|tailwind|bootstrap|figma|excel|tableau|powerbi|r studio|matlab|verilog|vhdl|simulink|autocad|solidworks|catia|ansys|matlab simulink|plc|scada)\b/i;
const PROJECT_NARRATION = /\b(my project|our project|the project|i (?:built|made|developed|coded|designed|trained|implemented)|we (?:built|made|developed|coded|designed|trained|implemented))\b/i;

/* Implausible team-size brag for a fresher / college context. */
const IMPLAUSIBLE_TEAM = /\b(?:led|managed|headed|directed)\s+(?:a\s+)?team\s+of\s+(\d{2,})/i;

/* "Why this company / what attracted you" probe by AI. Tightened — the
 * earlier version's `\w{2,}` fallback matched any "why X?" question. */
const WHY_COMPANY_PROBE = /\b(?:why\b[^?.!]{0,80}?\b(?:join us|work (?:here|with us|for us)|us specifically|this (?:company|firm|role|org)|our (?:company|firm|org))|what\s+(?:attracted|brought|drew|excites|excited)\s+you\s+(?:to|about|here|towards))\b/i;
/* Company-specific signal in user answer: tight tokens that indicate
 * the candidate did real research, not generic filler. Avoid generic
 * words like "team" / "product" / "values" — those false-positive on
 * unrelated answers. */
const COMPANY_GENERIC_FILLER = /\b(great culture|good culture|brand value|brand name|great brand|big company|good company|great company|reputation|growth opportunit|learning opportunit|big mnc)\b/i;
const COMPANY_SPECIFIC_SIGNAL = /\b(trailhead|nqt|infytq|techbee|genc|engage|step program|leadership principles?|customer obsession|day\s*1|crucible|future leaders|gennxt|peak|spirit of wipro|infosys lex|tata code of conduct|your (?:founder|ceo|cofounder|recent|latest|q[1-4]|fy\d|launch|ipo|acquisition|investment|hiring plan|product line|ai strategy|tech stack)|i (?:read|saw|noticed|came across|listened to))\b/i;

/* Volunteered backlogs / KTs / low CGPA unprompted is a framing error.
 * DEFICIT_PROBE intentionally excludes /fail/ — behavioral failure
 * chestnuts like "tell me about a failure" must NOT count as the AI
 * probing academic deficits. */
const VOLUNTEERED_DEFICIT = /\b(?:i (?:have|had|got)|i'?ve got|unfortunately)\s+(?:\d+\s+)?(?:backlog|kts?|low\s+cgpa|bad\s+cgpa|poor\s+grade)/i;
const DEFICIT_PROBE = /\b(?:backlog|\bkts?\b|cgpa|gpa|grade|repeat (?:a |the )?(?:year|semester|course))\b/i;

/* Excessive filler — count occurrences across user turns. */
const FILLER = /\b(basically|as such|like,? you know|um|uh|sort of|kind of|i mean)\b/gi;
const FILLER_PER_100_WORDS_THRESHOLD = 4;

/* Internship probe + content. */
const INTERNSHIP_CLAIM = /\b(internship|interned|intern at|summer intern|summer training|industrial training|6[- ]month\s+intern)\b/i;
const INTERNSHIP_DETAIL = /\b(intern(ship)?\s+at\s+\w|stipend|deliverable|reported to|mentor|onboarded|shipped|merged|in production)\b/i;

export const campusPlacementAnalyzer: FocusAnalyzer = {
  focus: "campus-placement",
  version: "campus-placement-v2",
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

    // Project narrated but no concrete tech stack named
    if (PROJECT_NARRATION.test(userText) && !TECH_STACK.test(userText)) {
      flags.add("project_no_tech_stack");
      gaps.push({
        dimension: "specificity",
        expected: "Name the actual stack — language, framework, DB, deployment target",
        observed: "User narrated a project without naming any concrete technology",
        severity: "medium",
      });
    }

    // Implausible team-size brag (fresher claiming to have led a 20-person team)
    const teamMatch = userText.match(IMPLAUSIBLE_TEAM);
    if (teamMatch && Number(teamMatch[1]) >= 15) {
      flags.add("implausible_team_size");
      gaps.push({
        dimension: "credibility",
        expected: "Calibrate leadership claims to the college context (3-6 person teams typical)",
        observed: `User claimed to have led a team of ${teamMatch[1]} — implausible for college projects`,
        severity: "medium",
      });
    }

    // "Why this company" probed but only generic filler in response
    const aiAskedWhyCompany = transcript.some((t) => isAi(t) && WHY_COMPANY_PROBE.test(t.text || ""));
    if (aiAskedWhyCompany && COMPANY_GENERIC_FILLER.test(userText) && !COMPANY_SPECIFIC_SIGNAL.test(userText)) {
      flags.add("no_company_specific_research");
      gaps.push({
        dimension: "preparation",
        expected: "Reference a specific program (TCS NQT, Infosys InfyTQ, Amazon LP), recent launch, or values from the careers page",
        observed: "AI probed 'why this company' — user replied with generic 'great culture / brand' filler",
        severity: "high",
      });
    }

    // Volunteered backlogs / low CGPA without being asked
    const aiAskedAboutDeficit = transcript.some((t) => isAi(t) && DEFICIT_PROBE.test(t.text || ""));
    if (VOLUNTEERED_DEFICIT.test(userText) && !aiAskedAboutDeficit) {
      flags.add("volunteered_academic_deficit");
      gaps.push({
        dimension: "framing",
        expected: "Don't volunteer backlogs / KTs / low CGPA. If asked, explain context briefly + what you learned",
        observed: "User volunteered an academic deficit unprompted — costs interview points before any probe",
        severity: "medium",
      });
    }

    // Excessive filler word usage
    const userWordCount = userText.split(/\s+/).filter(Boolean).length;
    const fillerMatches = userText.match(FILLER) || [];
    if (userWordCount >= 100) {
      const fillerPer100 = (fillerMatches.length / userWordCount) * 100;
      if (fillerPer100 >= FILLER_PER_100_WORDS_THRESHOLD) {
        flags.add("excessive_filler_words");
        gaps.push({
          dimension: "communication clarity",
          expected: "≤3 fillers per 100 words. Pause instead of saying 'basically' / 'as such' / 'like'",
          observed: `User used filler ${fillerMatches.length} times across ${userWordCount} words (${fillerPer100.toFixed(1)} per 100)`,
          severity: "low",
        });
      }
    }

    // Internship claimed but no detail given (resume padding signal)
    if (INTERNSHIP_CLAIM.test(userText) && !INTERNSHIP_DETAIL.test(userText) && userTurnCount >= 3) {
      flags.add("internship_unsubstantiated");
      gaps.push({
        dimension: "credibility",
        expected: "An internship mention should come with company, duration, deliverable, mentor, and a concrete output",
        observed: "User mentioned an internship but never named the company, deliverable, or impact",
        severity: "medium",
      });
    }

    const tips: string[] = [];
    if (flags.has("no_academic_project_discussed")) tips.push("As a fresher, lead with your capstone or final-year project — it's your strongest evidence.");
    if (flags.has("generic_passion_no_substance")) tips.push("Replace 'I'm passionate about tech' with 'I built X using Y, here's what I learned.'");
    if (flags.has("user_badmouthing_college")) tips.push("Even if coursework was weak, frame it as 'I supplemented with self-study and projects' — never criticize professors.");
    if (flags.has("project_no_tech_stack")) tips.push("Always name the stack: language + framework + DB + deployment. 'I built it in Python, FastAPI, Postgres, deployed on Render' beats 'I built a web app.'");
    if (flags.has("implausible_team_size")) tips.push("College projects are typically 3-6 people. If you led 20, it was likely a college fest — frame the leadership separately from technical projects.");
    if (flags.has("no_company_specific_research")) tips.push("Spend 20 minutes on the careers page before each interview. Name a program, a value, or a recent launch — never just 'great culture'.");
    if (flags.has("volunteered_academic_deficit")) tips.push("Don't volunteer backlogs or low CGPA. If asked directly, say what happened in one sentence and pivot to what you did about it.");
    if (flags.has("excessive_filler_words")) tips.push("Replace fillers with a half-second pause. Recording one mock and counting your 'basically's is the fastest fix.");
    if (flags.has("internship_unsubstantiated")) tips.push("If you list an internship, be ready with: company, duration, mentor, what shipped, and a measurable outcome.");

    result.rubricGaps = gaps;
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    return result;
  },
};
