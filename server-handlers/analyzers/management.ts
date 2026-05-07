/* Management interview analyzer — deterministic v1.
 *
 * For people-management roles (engineering manager, product lead, etc).
 * Catches:
 *   - User answered as IC, not as a manager (no 'my team' / 'my report')
 *   - Stories don't include team metrics (retention, growth, hiring)
 *   - AI didn't probe difficult conversations / underperformer / firing
 *   - No stakeholder/cross-functional management discussed
 *   - No discussion of leadership philosophy or style
 */

import { AnalyzerInput, AnalyzerResult, FocusAnalyzer, RubricGap, TranscriptTurn, emptyResult } from "./_types";

const isAi = (t: TranscriptTurn) => t.speaker.toLowerCase().startsWith("a");
const isUser = (t: TranscriptTurn) => t.speaker.toLowerCase().startsWith("u");

const TEAM_LANG = /\b(my team|my report|my direct|i hired|i mentored|i coached|team of \d+|the engineers? (?:i|on my)|managed (?:a |the )?team|i led (?:a |the )?team|reported to me)\b/i;
const TEAM_METRICS = /\b(retention|attrition|hiring|promot(?:ion|ed)|levelled up|growth (?:plan|path)|performance review|1[- :]on[- :]1|skip[- ]?level|team velocity|team morale|team health)\b/i;
// 'Difficult situation' alone matches generic IC questions; require team context
// to count as a real management-only probe.
const HARD_CONVO_PROBES = /\b(difficult conversation|underperform|let (?:someone|them) go|\bfired\b|managed out|hard feedback|tough call|conflict (?:with|on) (?:the|your|a) (?:team|report|engineer)|difficult (?:situation|moment) (?:with|on) (?:your|the|a|our|my) (?:team|report))/i;
const STAKEHOLDER = /\b(stakeholder|cross[- ]?functional|partner team|product partner|design partner|leadership|skip-level|director|vp\b)\b/i;
const PHILOSOPHY = /\b(my (?:management|leadership) (?:style|philosophy)|i believe (?:in|that)|how i (?:lead|manage)|approach to (?:management|leading)|servant leader|coaching style)\b/i;

export const managementAnalyzer: FocusAnalyzer = {
  focus: "management",
  version: "management-v1",
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

    // No team-management language
    if (userTurnCount >= 3 && !TEAM_LANG.test(userText)) {
      flags.add("answered_as_ic_not_manager");
      gaps.push({
        dimension: "management_framing",
        expected: "Manager-role answers should reference 'my team', 'my report', team-level outcomes",
        observed: "User answers stayed at IC level — no team / report / hiring language",
        severity: "high",
      });
    }

    // No team-level metrics
    if (userTurnCount >= 3 && !TEAM_METRICS.test(userText)) {
      flags.add("no_team_metrics");
    }

    // AI didn't probe hard conversations
    if (userTurnCount >= 3 && !HARD_CONVO_PROBES.test(aiText)) {
      flags.add("no_hard_conversation_probe");
      gaps.push({
        dimension: "interviewer_rigor",
        expected: "Manager interviews must probe difficult conversations / underperformers",
        observed: "AI never raised performance management or difficult-conversation topics",
        severity: "medium",
      });
    }

    // No stakeholder management
    if (userTurnCount >= 3 && !STAKEHOLDER.test(fullText)) {
      flags.add("no_stakeholder_management");
    }

    // No leadership philosophy
    if (userTurnCount >= 3 && !PHILOSOPHY.test(userText)) {
      flags.add("no_leadership_philosophy");
    }

    const tips: string[] = [];
    if (flags.has("answered_as_ic_not_manager")) tips.push("Reframe stories around your team's outcome, not your own — 'my team shipped X' beats 'I shipped X'.");
    if (flags.has("no_team_metrics")) tips.push("Quantify team outcomes: retention rate, promotions, hires, velocity. Numbers > narrative.");
    if (flags.has("no_leadership_philosophy")) tips.push("Be ready to articulate your leadership philosophy in 2 sentences — 'I lead by [X], because [Y]'.");

    result.rubricGaps = gaps;
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    return result;
  },
};
