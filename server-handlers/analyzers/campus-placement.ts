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
import { classifyCompanyTier } from "../_company-tier";

const isAi = (t: TranscriptTurn) => t.speaker.toLowerCase().startsWith("a");
const isUser = (t: TranscriptTurn) => t.speaker.toLowerCase().startsWith("u");

const ACADEMIC_PROJECT = /\b(capstone|final[- ]?year project|btech project|major project|college project|coursework|cgpa|gpa|sgpa|kt\b|backlog)\b/i;
const FRESHER_LEXICON = /\b(fresher|just graduated|final year|recent graduate|college senior|placement|on[- ]campus|btech|b\.?tech|bca|mca|m\.?tech)\b/i;
const GENERIC_PASSION = /\b(passionate about (?:tech|coding|technology|engineering|programming)|always loved|since childhood|always wanted to|love (?:to )?learn)\b/i;
const SPECIFIC_PROJECT = /\b(built|implemented|deployed|led|coded|designed|trained|integrated|published)\s+\w+/i;
const AVAILABILITY = /\b(available (?:from|after)|join (?:by|in|on|after)|notice|graduation|exam|semester|joining date|relocat)\b/i;
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

/* Mother-Tongue-Influence (MTI) — top high-frequency Indian-English deviations
 * that recruiters flag in tier-2/3 freshers. Each entry is a distinct phrase
 * shape; we count distinct hits across all patterns and trigger at ≥1. */
const MTI_PATTERNS: RegExp[] = [
  /\bdo(?:ing)?\s+the\s+needful\b/i,
  /\brevert\s+back\b/i,                     // "revert" already means reply
  /\bpass(?:ed|ing|\s+)?out\s+(?:of|from|in)\s+(?:20|19)\d{2}\b/i,
  /\bpass(?:ed|ing)?\s+out\s+from\s+\w+/i,  // "passed out from XYZ college"
  /\bmyself\s+[A-Z][a-z]+\b/,               // "Myself Rahul"
  /\bgood\s+name\b/i,                       // "May I know your good name?"
  /\bkindly\s+(?:do|find|note|revert|provide|share)\b/i,
  /\bcope\s+up\s+with\b/i,                  // standard is "cope with"
  /\bdiscuss\s+about\b/i,                   // standard is "discuss"
  /\bhaving\s+(?:a\s+)?doubt\b/i,           // "doubt" = question in IndE
  /\bprepone\b/i,                           // not standard English
  /\breach\s+(?:by|at|till)\s+\d/i,         // "reach by 5" vs "arrive by 5"
];

/* Stated CGPA values — captures the numeric value so we can grade framing. */
const CGPA_STATED = /\b(?:cgpa|gpa|sgpa)\s*(?:is|was|of|:)?\s*(\d(?:\.\d{1,2})?)/i;
/* Framing context that excuses a low CGPA — must appear in the same user
 * span as the number for the candidate to get credit. */
const CGPA_FRAMING_CONTEXT = /\b(?:family|health|hospital|surgery|loss|covid|caregiv|financial|part[- ]?time job|supported|recovered|bounced back|after that|since then|the next sem|improved|trended? up|consistent improvement|i (?:worked on|focused on|built|shipped|interned|won|cleared|topped))\b/i;

/* Reverse-question grading. Every Indian campus interview closes with
 * "Do you have any questions for us?" — what the candidate asks back
 * is part of the grade. */
const REVERSE_QUESTION_PROBE = /\b(?:any\s+questions?\s+(?:for\s+(?:us|me|the\s+team))?|do\s+you\s+have\s+(?:any\s+)?questions?|anything\s+you'?d?\s+like\s+to\s+ask|questions?\s+from\s+your\s+(?:side|end))\b/i;
/* Specific, prepared reverse-questions — these score. */
const REVERSE_QUESTION_SPECIFIC = /\b(?:training\s+program|onboarding|mentor|on[- ]?call|rotation|tech\s+stack|deployment|production|code\s+review|team\s+structure|growth\s+(?:track|path|plan)|career\s+(?:track|progression|ladder)|appraisal|promotion\s+(?:cycle|timeline)|notice\s+period|bond|service\s+agreement|recent\s+launch|product\s+roadmap|client\s+(?:engagement|project)|new\s+(?:product|launch|hire)|ppt|pre[- ]?placement\s+talk|the\s+(?:speaker|presenter)\s+mentioned)\b/i;
/* Generic / lazy reverse-questions — these don't score. */
const REVERSE_QUESTION_GENERIC = /\b(?:work\s+culture|company\s+culture|good\s+culture|growth\s+opportunit|learning\s+opportunit|work[- ]?life\s+balance|when\s+(?:can|do)\s+i\s+(?:start|join|expect)|how\s+(?:is|are)\s+the\s+(?:team|culture|company))\b/i;
/* "No, I don't" / declining the offer to ask. */
const REVERSE_QUESTION_DECLINED = /\b(?:no\s*[,.]?\s*(?:i\s+(?:don'?t|do\s+not)|that'?s\s+(?:all|fine|good)|nothing\s+(?:from|for)\s+(?:my|now))|i'?m\s+(?:good|clear|set|fine|done|sorted)|i\s+think\s+i'?m\s+(?:good|clear|set|fine|done|sorted)|i'?ve\s+got\s+everything|all\s+(?:clear|good)|nothing\s+from\s+(?:me|my\s+(?:side|end))|i\s+(?:don'?t|do\s+not)\s+have\s+(?:any|questions))\b/i;

/* Bond / service-agreement probe + readiness signal. Real Indian campus
 * interviews probe bond comfort directly; freshers who say "I don't know
 * about bonds" or refuse outright disqualify themselves. */
const BOND_PROBE = /\b(?:service\s+agreement|service\s+bond|training\s+bond|two[- ]?year\s+bond|2[- ]?year\s+bond|1[- ]?year\s+bond|bond\s+(?:period|duration|amount)|sign\s+(?:the\s+|a\s+)?bond|notice\s+period\s+bond)\b/i;
const BOND_HEALTHY_RESPONSE = /\b(?:comfortable\s+(?:with|signing)|i'?m\s+aware|i\s+know\s+(?:the|about|of)\s+(?:the\s+)?(?:bond|service\s+agreement|2\s*year|1\s*year)|happy\s+to\s+sign|(?:2|two|1|one|15)\s*(?:[- ]?)(?:month|year)s?|standard\s+practice|fully\s+aware)\b/i;
const BOND_REFUSAL = /\b(?:i\s+won'?t\s+sign|absolutely\s+not|no\s+way|refuse|never\s+sign|i\s+don'?t\s+(?:sign|do)\s+bonds?)\b/i;
const BOND_IGNORANCE = /\b(?:what'?s?\s+(?:a\s+)?bond|i\s+don'?t\s+know\s+(?:about|what)|never\s+heard\s+of|first\s+(?:time\s+)?hearing)\b/i;

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

    // Mother-Tongue-Influence (MTI) deviations — count distinct pattern hits
    const mtiHits = MTI_PATTERNS.filter((rx) => rx.test(userText)).length;
    if (mtiHits >= 1) {
      flags.add("mti_pattern_detected");
      gaps.push({
        dimension: "communication clarity",
        expected: "Swap MTI phrases for standard professional phrasing — 'please do this' instead of 'kindly do the needful', 'I graduated in 2024' instead of 'I passed out in 2024'",
        observed: `User used ${mtiHits} Mother-Tongue-Influence phrase${mtiHits === 1 ? "" : "s"} — recruiters in tier-1 firms grade against these`,
        severity: mtiHits >= 3 ? "medium" : "low",
      });
    }

    // Low CGPA stated without framing context — tier-aware threshold.
    // Tier-1 global firms (Google/MS/Amazon India) typically gate at 7.5;
    // most others gate at 7.0; service-tier (TCS/Infosys/Wipro) at 6.5.
    const companyTier = classifyCompanyTier(session.target_company);
    const cgpaCutoff = companyTier === "product-global" ? 7.5
      : companyTier === "service" ? 6.5
      : 7.0;
    const cgpaMatch = userText.match(CGPA_STATED);
    if (cgpaMatch) {
      const cgpa = Number(cgpaMatch[1]);
      if (cgpa > 0 && cgpa < cgpaCutoff && !CGPA_FRAMING_CONTEXT.test(userText)) {
        flags.add("cgpa_low_no_framing");
        gaps.push({
          dimension: "framing",
          expected: `CGPA below ${cgpaCutoff.toFixed(1)} for this company tier needs a one-sentence honest reason + evidence of capability (project, internship, ranking improvement, hackathon)`,
          observed: `User stated CGPA ${cgpa.toFixed(1)} with no framing — below the typical threshold for ${companyTier === "product-global" ? "tier-1 global product firms" : companyTier === "service" ? "Indian IT services" : "this company tier"}`,
          severity: "high",
        });
      }
    }

    // Reverse-questions: AI closed with "any questions for us?" — grade what came back.
    // We inspect the LAST user turn AFTER the latest reverse-question probe by the AI.
    let reverseProbeIdx = -1;
    transcript.forEach((t, idx) => { if (isAi(t) && REVERSE_QUESTION_PROBE.test(t.text || "")) reverseProbeIdx = idx; });
    if (reverseProbeIdx >= 0) {
      const afterProbe = transcript.slice(reverseProbeIdx + 1).filter(isUser).map((t) => t.text || "").join(" ");
      if (afterProbe) {
        if (REVERSE_QUESTION_DECLINED.test(afterProbe)) {
          flags.add("reverse_questions_declined");
          gaps.push({
            dimension: "preparation",
            expected: "Always have 2-3 prepared reverse-questions — about training program, tech stack, mentor structure, growth track, or something from the PPT",
            observed: "User declined the reverse-question slot ('No, I'm good') — reads as unprepared / disinterested",
            severity: "medium",
          });
        } else if (REVERSE_QUESTION_GENERIC.test(afterProbe) && !REVERSE_QUESTION_SPECIFIC.test(afterProbe)) {
          flags.add("weak_reverse_questions");
          gaps.push({
            dimension: "preparation",
            expected: "Specific reverse-questions score: 'What's the typical TCS-Ignite cohort exit destination after the 2-year bond?' beats 'How is the work culture?'",
            observed: "User's reverse-questions were generic ('work culture' / 'growth opportunities') — weak tie-breaker signal",
            severity: "low",
          });
        }
      } else {
        flags.add("reverse_questions_declined");
        gaps.push({
          dimension: "preparation",
          expected: "Always have 2-3 prepared reverse-questions — silence on the closer is a credibility hit",
          observed: "AI asked 'any questions for us?' — user gave no response",
          severity: "medium",
        });
      }
    }

    // Bond / service-agreement probing — service-tier only.
    const aiBondProbed = transcript.some((t) => isAi(t) && BOND_PROBE.test(t.text || ""));
    if (aiBondProbed) {
      const userBondText = transcript.filter(isUser).map((t) => t.text || "").join(" ");
      if (BOND_REFUSAL.test(userBondText)) {
        flags.add("bond_refusal");
        gaps.push({
          dimension: "preparation",
          expected: "Refusing the bond outright is an instant DQ at TCS/Infosys/Wipro. If genuinely concerned, frame as 'I'd like to understand the buyout terms' — never 'I won't sign'",
          observed: "User refused the service agreement outright — at service-tier firms this ends the interview",
          severity: "high",
        });
      } else if (BOND_IGNORANCE.test(userBondText) && !BOND_HEALTHY_RESPONSE.test(userBondText)) {
        flags.add("bond_unprepared");
        gaps.push({
          dimension: "preparation",
          expected: "Know the bond duration for your target company before the interview: TCS 2yr, Infosys 1yr, Wipro 15mo + ₹2L, Cognizant 1yr, HCL 1.5yr",
          observed: "User showed unfamiliarity with service-bond concept when asked — reads as unresearched",
          severity: "medium",
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
    if (flags.has("mti_pattern_detected")) tips.push("Watch for Mother-Tongue-Influence phrasing: 'I graduated in 2024' (not 'passed out'), 'please reply' (not 'kindly revert back'), 'I have a question' (not 'doubt'), 'I'm Rahul' (not 'Myself Rahul').");
    if (flags.has("cgpa_low_no_framing")) tips.push("If your CGPA is under 7, never state it bare. Use the 3-part frame: one-sentence honest reason → one piece of recent evidence (project / internship / hackathon) → forward-looking intent. Bare numbers below 7 stick in the interviewer's memory.");
    if (flags.has("reverse_questions_declined")) tips.push("Always have 2-3 reverse-questions ready: training program details, mentor structure, what the first 6 months look like, a specific point from the PPT. Saying 'no' to 'any questions for us?' tells the interviewer you didn't prepare.");
    if (flags.has("weak_reverse_questions")) tips.push("'What's the work culture?' isn't a real question — every interviewer hears it 20 times a day. Ask specific: 'What does a typical week look like for an SDE on your Trailhead team?' or 'You mentioned the new ABDM project in the PPT — would freshers rotate through it?'");
    if (flags.has("bond_refusal")) tips.push("Never refuse the bond outright in an on-campus TCS/Infosys/Wipro interview — it's an instant disqualifier. If concerned, ask: 'Could you walk me through the buyout terms and the typical reasons people exercise them?' Sounds informed, not resistant.");
    if (flags.has("bond_unprepared")) tips.push("Know the bond duration for your target company before the interview. Quick reference: TCS 2 years, Infosys 1 year, Wipro 15 months + ₹2L bond, Cognizant 1 year, HCL 1.5 years, Tech Mahindra / Capgemini / Accenture 1 year. Service-tier firms WILL ask.");

    result.rubricGaps = gaps;
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    return result;
  },
};
