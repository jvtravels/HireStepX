/* Panel-interview analyzer — deterministic v1.
 *
 * Panel interviews simulate multiple personas (technical, HR, hiring
 * manager). Common failures:
 *   - AI never switched persona — entire session sounds like one voice
 *   - Same question asked from different angles wasn't varied
 *   - User used the same tone for every persona (didn't adapt)
 *   - Difficulty inconsistent across the panel — one persona never went deep
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

const PERSONA_MARKERS = {
  technical: /\b(architecture|implementation|complexity|system design|code review|tech stack|debug|production incident|api|database|scalab)/i,
  hr: /\b(culture|values|teamwork|conflict|growth|career|why our company|tell me about yourself|notice period|joining|expectation)/i,
  hiringManager: /\b(role expectation|first 90 days|why this role|leadership|stakeholder management|influence|prioritization|business impact|customer impact)/i,
};

const PERSONA_INTRO = /\b(i'?m (?:the|your|playing) (?:hr|technical|hiring manager|engineering manager|director|cto|head of)|now (?:speaking|asking) as|switching gears|passing to|next up is)\b/i;

function classifyPersona(text: string): "technical" | "hr" | "hiring_manager" | "unknown" {
  const t = text.toLowerCase();
  let best: "technical" | "hr" | "hiring_manager" | "unknown" = "unknown";
  let bestScore = 0;
  const tHits = (t.match(PERSONA_MARKERS.technical) || []).length;
  const hHits = (t.match(PERSONA_MARKERS.hr) || []).length;
  const mHits = (t.match(PERSONA_MARKERS.hiringManager) || []).length;
  if (tHits > bestScore) { best = "technical"; bestScore = tHits; }
  if (hHits > bestScore) { best = "hr"; bestScore = hHits; }
  if (mHits > bestScore) { best = "hiring_manager"; bestScore = mHits; }
  return best;
}

export const panelAnalyzer: FocusAnalyzer = {
  focus: "panel",
  version: "panel-v1",

  async analyze({ session }: AnalyzerInput): Promise<AnalyzerResult> {
    const result = emptyResult();
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    if (transcript.length === 0) {
      result.flags.push("empty_transcript");
      return result;
    }

    const flags = new Set<string>();
    const gaps: RubricGap[] = [];

    const aiTurns = transcript.filter(isAi);

    // Detect persona switches via explicit markers
    const personaSwitchMarkers = aiTurns.filter((t) => PERSONA_INTRO.test(t.text || "")).length;

    // Classify each substantive AI turn into a persona bucket
    const personaCounts = { technical: 0, hr: 0, hiring_manager: 0, unknown: 0 };
    for (const t of aiTurns) {
      if ((t.text || "").length < 80) continue;
      const p = classifyPersona(t.text || "");
      personaCounts[p] += 1;
    }
    const distinctPersonas = (["technical", "hr", "hiring_manager"] as const).filter((p) => personaCounts[p] >= 1).length;

    if (distinctPersonas < 2 && personaSwitchMarkers === 0 && aiTurns.length >= 4) {
      flags.add("single_persona_panel");
      gaps.push({
        dimension: "panel_realism",
        expected: "Panel interviews should sound like multiple distinct personas (technical / HR / hiring manager)",
        observed: `Only ${distinctPersonas} persona detected and no explicit hand-off markers — feels like a single interviewer`,
        severity: "high",
      });
    }

    // Coverage: at least HR + technical OR hiring-manager + technical questions should appear
    if (aiTurns.length >= 5 && personaCounts.technical === 0) {
      flags.add("missing_technical_persona");
    }
    if (aiTurns.length >= 5 && personaCounts.hr === 0 && personaCounts.hiring_manager === 0) {
      flags.add("missing_behavioral_persona");
    }

    // Flat tone — user used very similar opening words across answers (a proxy
    // for not adapting to different personas).
    const userTurns = transcript.filter(isUser).filter((t) => (t.text || "").length > 80);
    if (userTurns.length >= 3) {
      const openings = userTurns.map((t) => (t.text || "").trim().split(/\s+/).slice(0, 4).join(" ").toLowerCase());
      const repeated = openings.filter((o, i) => openings.indexOf(o) !== i).length;
      if (repeated >= 2) {
        flags.add("user_didnt_adapt_tone");
        gaps.push({
          dimension: "audience_adaptation",
          expected: "Answers should adapt in tone/depth based on the persona asking",
          observed: "User opened multiple answers identically — same register across the panel",
          severity: "medium",
        });
      }
    }

    // Difficulty inconsistency — one persona stayed surface-level
    if (personaCounts.technical >= 2) {
      const technicalTurns = aiTurns.filter((t) => classifyPersona(t.text || "") === "technical");
      const avgLen = technicalTurns.reduce((s, t) => s + (t.text || "").length, 0) / technicalTurns.length;
      if (avgLen < 90) {
        flags.add("technical_persona_too_shallow");
      }
    }

    const tips: string[] = [];
    if (flags.has("single_persona_panel")) tips.push("Real panels feel like 3 different humans. Practice answering as if HR, then technical, then hiring manager are taking turns.");
    if (flags.has("missing_technical_persona")) tips.push("Panels almost always have a technical screen — prepare to switch into specifics on architecture / code.");
    if (flags.has("user_didnt_adapt_tone")) tips.push("Adapt your tone: HR wants a short story; technical wants concrete numbers; hiring manager wants impact framing.");

    result.rubricGaps = gaps;
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    return result;
  },
};
