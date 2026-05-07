/* Government / PSU interview analyzer — deterministic v1.
 *
 * For UPSC, SSC, IBPS, RBI, ISRO, DRDO, SSB and PSU interviews. Different
 * vocabulary and motivations from corporate hiring. Catches:
 *   - Heavy use of corporate / private-sector vocabulary (KPI, OKR, sprint)
 *   - No public-service motivation articulated
 *   - User badmouthed previous private employer (not appropriate context)
 *   - AI didn't probe current affairs / general awareness
 *   - Service / posting / location preferences never came up
 */

import { AnalyzerInput, AnalyzerResult, FocusAnalyzer, RubricGap, TranscriptTurn, emptyResult } from "./_types";

const isAi = (t: TranscriptTurn) => t.speaker.toLowerCase().startsWith("a");
const isUser = (t: TranscriptTurn) => t.speaker.toLowerCase().startsWith("u");

const CORPORATE_JARGON = /\b(kpi|okr|sprint|agile|scrum|stakeholder|retro|standup|saas|b2b|customer acquisition|funnel|growth hack|startup mindset|hustle)\b/i;
const PUBLIC_SERVICE = /\b(public service|nation building|serve the country|public welfare|social impact|citizens|society|grassroots|administrative responsibility|constitution|civic duty)\b/i;
const PRIVATE_BADMOUTH = /\b(corporate (?:was|is) (?:awful|bad|toxic)|tired of (?:corporate|private sector)|just for the money|sold out)\b/i;
const CURRENT_AFFAIRS = /\b(current affair|recent (?:news|policy|budget|act|scheme|government|development)|government (?:scheme|polic|initiative)|latest polic|in the news|gazette|niti aayog|finance bill|budget announcement)/i;
const SERVICE_PREFERENCE = /\b(ias|ips|ifs|irs|services? preference|cadre|posting|state preference|allotment|service order)\b/i;
const PSU_LOGISTICS = /\b(transferable|all[- ]?india|relocation|posting|joining (?:formality|date)|medical (?:test|fitness)|dress code|reservation|character certificate)\b/i;

export const governmentPsuAnalyzer: FocusAnalyzer = {
  focus: "government-psu",
  version: "government-psu-v1",
  async analyze({ session }: AnalyzerInput): Promise<AnalyzerResult> {
    const result = emptyResult();
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    if (transcript.length === 0) { result.flags.push("empty_transcript"); return result; }

    const flags = new Set<string>();
    const gaps: RubricGap[] = [];

    const aiText = transcript.filter(isAi).map((t) => t.text || "").join(" ");
    const userText = transcript.filter(isUser).map((t) => t.text || "").join(" ");
    const fullText = `${aiText} ${userText}`;
    const userTurnCount = transcript.filter(isUser).filter((t) => (t.text || "").length > 60).length;

    // Corporate jargon used heavily
    const jargonHits = (userText.match(new RegExp(CORPORATE_JARGON, "gi")) || []).length;
    if (jargonHits >= 3) {
      flags.add("corporate_jargon_overuse");
      gaps.push({
        dimension: "audience_appropriateness",
        expected: "Government interviews expect formal, public-service vocabulary — avoid sprint / KPI / startup language",
        observed: `User used corporate jargon ${jargonHits} times — sounds out of place`,
        severity: "medium",
      });
    }

    // No public-service motivation
    if (userTurnCount >= 3 && !PUBLIC_SERVICE.test(userText)) {
      flags.add("no_public_service_motivation");
      gaps.push({
        dimension: "motivation",
        expected: "User must articulate why public service / civil service over corporate",
        observed: "No public-service or nation-building language across user answers",
        severity: "high",
      });
    }

    // Badmouthing private sector
    if (PRIVATE_BADMOUTH.test(userText)) {
      flags.add("user_badmouthing_private_sector");
    }

    // AI didn't probe current affairs
    if (userTurnCount >= 3 && !CURRENT_AFFAIRS.test(aiText)) {
      flags.add("no_current_affairs_probe");
    }

    // No service / posting preference discussion
    if (userTurnCount >= 4 && !SERVICE_PREFERENCE.test(fullText) && !PSU_LOGISTICS.test(fullText)) {
      flags.add("service_preference_never_discussed");
    }

    const tips: string[] = [];
    if (flags.has("corporate_jargon_overuse")) tips.push("Switch register: 'public welfare', 'administrative challenge', 'citizen impact' instead of KPI / sprint / OKR.");
    if (flags.has("no_public_service_motivation")) tips.push("Articulate clearly why this service over private sector — interviewers test sincerity here.");
    if (flags.has("user_badmouthing_private_sector")) tips.push("Frame the move positively: 'I want larger impact / public welfare', not 'private was bad'.");
    if (flags.has("no_current_affairs_probe")) tips.push("Brush up on the last 6 months of policy / current affairs — interviewers will test this.");

    result.rubricGaps = gaps;
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    return result;
  },
};
