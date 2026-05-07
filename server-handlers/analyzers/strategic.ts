/* Strategic interview analyzer — deterministic v1.
 *
 * Catches:
 *   - User cited generic frameworks (Porter's, SWOT, BCG) without applying
 *     them to a concrete situation
 *   - AI never probed trade-offs ("what would you NOT do?")
 *   - User's recommendations weren't tied to measurable success criteria
 *   - AI accepted vague "it depends" answers without forcing specificity
 *   - No discussion of stakeholders, timing, or risks
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

const FRAMEWORK_MENTIONS = /\b(porter'?s? (?:five|5) forces|swot|bcg matrix|ansoff|value chain|blue ocean|jobs to be done|jtbd|aarrr|north star|okr)\b/i;
const APPLICATION_CUES = /\b(in (?:our|this) case|applied to|specifically for|for (?:the company|this business)|that means|because of (?:our|their)|in this scenario|if we focus on)\b/i;

const TRADEOFF_PROBES = /\b(trade[- ]?off|what (?:would|wouldn'?t) you|opportunity cost|at the expense|in exchange|risk of|downside|sacrifice)\b/i;
const SUCCESS_METRICS = /\b(measure|metric|kpi|target|success (?:criteria|metric)|how (?:will|would) (?:we|you) know|by what date|within \d+|by \d+ (?:%|percent|x|months|weeks))\b/i;
const STAKEHOLDER_LANG = /\b(stakeholder|customer|partner|investor|board|engineering team|sales team|marketing team|leadership|cross[- ]?functional)\b/i;
const RISK_LANG = /\b(risk|mitigat|fallback|contingenc|what (?:if|could) go wrong|failure mode)\b/i;
const VAGUE_HEDGE = /\b(it depends|maybe|kind of|sort of|something like|generally speaking|in theory|on paper)\b/i;
const ACCEPTANCE_NO_PROBE = /\b(makes sense|sounds good|reasonable|fair point|i agree|exactly|right)\b/i;

export const strategicAnalyzer: FocusAnalyzer = {
  focus: "strategic",
  version: "strategic-v1",

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
    const fullText = `${aiText} ${userText}`;
    const userTurnCount = transcript.filter(isUser).filter((t) => (t.text || "").length > 60).length;

    // Generic-framework citation without concrete application
    if (FRAMEWORK_MENTIONS.test(userText) && !APPLICATION_CUES.test(userText)) {
      flags.add("framework_without_application");
      gaps.push({
        dimension: "applied_thinking",
        expected: "Frameworks should be applied to the specific company / situation, not just named",
        observed: "User named a strategy framework but didn't tie it to a concrete recommendation",
        severity: "medium",
      });
    }

    if (userTurnCount >= 2) {
      // AI never probed trade-offs
      if (!TRADEOFF_PROBES.test(aiText)) {
        flags.add("no_tradeoff_probing");
        gaps.push({
          dimension: "rigor",
          expected: "AI should ask 'what would you not do?' or surface opportunity cost",
          observed: "Trade-off language never appeared in AI turns",
          severity: "medium",
        });
      }

      // Discussion never touched measurable success
      if (!SUCCESS_METRICS.test(fullText)) {
        flags.add("no_success_metrics");
      }

      // No stakeholder consideration
      if (!STAKEHOLDER_LANG.test(fullText)) {
        flags.add("stakeholders_never_considered");
      }

      // No risk discussion
      if (!RISK_LANG.test(fullText)) {
        flags.add("risks_never_discussed");
      }
    }

    // User hedging persistently
    let vagueAnswers = 0;
    let acceptedVague = 0;
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!isUser(t)) continue;
      const text = t.text || "";
      if (text.length < 60) continue;
      if (VAGUE_HEDGE.test(text)) {
        vagueAnswers += 1;
        const next = transcript.slice(i + 1, i + 3).find(isAi);
        if (next && ACCEPTANCE_NO_PROBE.test(next.text || "") && !TRADEOFF_PROBES.test(next.text || "") && !/\?/.test(next.text || "")) {
          acceptedVague += 1;
        }
      }
    }
    if (vagueAnswers >= 2 && acceptedVague >= 2) {
      flags.add("ai_accepts_vague_strategy");
      gaps.push({
        dimension: "evaluator_rigor",
        expected: "AI should push back when answers stay at 'it depends' level",
        observed: `${acceptedVague} vague user answers were accepted without follow-up`,
        severity: "high",
      });
    }

    const tips: string[] = [];
    if (flags.has("framework_without_application")) tips.push("After naming a framework, immediately apply it: 'Using SWOT for THIS company, the strength is X because…'");
    if (flags.has("no_tradeoff_probing")) tips.push("Strategic answers must articulate what you'd give up — every choice has an opportunity cost.");
    if (flags.has("no_success_metrics")) tips.push("Tie every recommendation to a measurable outcome and timeline (e.g. '+15% retention in 2 quarters').");
    if (flags.has("stakeholders_never_considered")) tips.push("Name the affected stakeholders explicitly — strategy without people is theory.");

    result.rubricGaps = gaps;
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    return result;
  },
};
