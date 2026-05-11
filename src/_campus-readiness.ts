/* Campus-placement readiness — pure logic.
 *
 * Drives the live chip strip in InterviewPanels.tsx
 * (`CampusReadinessChips`). Extracted so the regex assertions can be
 * unit-tested (see __tests__/campusReadiness.test.ts) and so they stay
 * in sync with the v2 analyzer at
 * `server-handlers/analyzers/campus-placement.ts`.
 *
 * Chip semantics:
 *   - pass  : positive signal present (green check)
 *   - warn  : the candidate did the wrong-shape version of the right
 *             thing — e.g. mentioned a project without naming the
 *             stack, gave generic culture-talk instead of company
 *             specifics. Coachable in-session.
 *   - empty : no signal yet — gentle prompt, no penalty.
 *   - alert : red-flag pattern that costs interview points and the
 *             candidate may not realise. (badmouth college, volunteered
 *             a backlog / KT / low CGPA unprompted, implausible team
 *             size brag.) Rendered in a distinct red style.
 *
 * The "alert" tier didn't exist in v1 of the chips — we surfaced
 * regret-class mistakes only in the post-session report. Catching them
 * live is what justifies a separate fresher panel over the generic
 * micro-feedback strip.
 */

export type CpChipState = "pass" | "warn" | "empty" | "alert";

export interface CampusReadiness {
  /** Project narration + concrete tech stack named. */
  project: { state: CpChipState; label: string };
  /** Specific company research vs generic culture-talk. */
  research: { state: CpChipState; label: string };
  /** Joining date / notice / relocation addressed. */
  logistics: { state: CpChipState; label: string };
  /** Volunteered academic deficit (backlog / KT / low CGPA) unprompted. */
  deficit: { state: CpChipState; label: string } | null;
  /** Badmouthed college / professors. */
  badmouth: { state: CpChipState; label: string } | null;
  /** Implausibly large team-size claim for a college project. */
  team: { state: CpChipState; label: string } | null;
  /** Internship claimed but no detail (company / mentor / deliverable). */
  internship: { state: CpChipState; label: string } | null;
  /** Filler-word counter — surfaces a warn chip past the threshold. */
  filler: { count: number; wordCount: number; per100: number; warn: boolean };
}

const CP_PROJECT_NARRATION = /\b(my project|our project|the project|i (?:built|made|developed|coded|designed|trained|implemented)|we (?:built|made|developed|coded|designed|trained|implemented))\b/i;
const CP_TECH_STACK = /\b(python|java\b|javascript|typescript|c\+\+|kotlin|swift|go(?:lang)?|rust|node(?:\.?js)?|react|next(?:\.?js)?|angular|vue|django|flask|spring|express|fastapi|tensorflow|pytorch|numpy|pandas|scikit|opencv|sql|mysql|postgres|mongodb|redis|firebase|aws|gcp|azure|docker|kubernetes|git|linux|raspberry pi|arduino|html|css|tailwind|bootstrap|figma|excel|tableau|powerbi|r studio|matlab|verilog|vhdl|simulink|autocad|solidworks|catia|ansys|matlab simulink|plc|scada)\b/i;
const CP_COMPANY_GENERIC = /\b(great culture|good culture|brand value|brand name|great brand|big company|good company|great company|reputation|growth opportunit|learning opportunit|big mnc)\b/i;
const CP_COMPANY_SPECIFIC = /\b(trailhead|nqt|infytq|techbee|genc|engage|step program|leadership principles?|customer obsession|day\s*1|crucible|future leaders|gennxt|peak|spirit of wipro|infosys lex|tata code of conduct|your (?:founder|ceo|cofounder|recent|latest|q[1-4]|fy\d|launch|ipo|acquisition|investment|hiring plan|product line|ai strategy|tech stack)|i (?:read|saw|noticed|came across|listened to))\b/i;
const CP_AVAILABILITY = /\b(available (?:from|after)|join (?:by|in|on|after)|notice|graduation|exam|semester|joining date|relocat)\b/i;
const CP_FILLER = /\b(basically|as such|like,? you know|um|uh|sort of|kind of|i mean)\b/gi;
const CP_VOLUNTEERED_DEFICIT = /\b(?:i (?:have|had|got)|i'?ve got|unfortunately)\s+(?:\d+\s+)?(?:backlog|kts?|low\s+cgpa|bad\s+cgpa|poor\s+grade)/i;
const CP_BADMOUTH = /\b(my college (?:was|is) (?:bad|terrible|awful)|(?:professors|faculty) (?:are|were) (?:useless|incompetent|terrible)|nothing was taught|wasted (?:my )?time)\b/i;
const CP_IMPLAUSIBLE_TEAM = /\b(?:led|managed|headed|directed)\s+(?:a\s+)?team\s+of\s+(\d{2,})/i;
const CP_INTERNSHIP_CLAIM = /\b(internship|interned|intern at|summer intern|summer training|industrial training|6[- ]month\s+intern)\b/i;
const CP_INTERNSHIP_DETAIL = /\b(intern(ship)?\s+at\s+\w|stipend|deliverable|reported to|mentor|onboarded|shipped|merged|in production)\b/i;

const FILLER_PER_100_WARN = 4;

/** Compute the readiness state for a campus-placement session given the
 *  full transcript so far. Pure function — call it inside useMemo. */
export function computeCampusReadiness(
  transcript: { speaker: string; text: string }[],
): CampusReadiness | null {
  const userText = transcript
    .filter((t) => t.speaker.toLowerCase().startsWith("u"))
    .map((t) => t.text || "")
    .join(" ");
  if (userText.trim().length < 20) return null;

  /* Project. */
  const projectNarrated = CP_PROJECT_NARRATION.test(userText);
  const stackNamed = CP_TECH_STACK.test(userText);
  const project: CampusReadiness["project"] =
    projectNarrated && stackNamed
      ? { state: "pass", label: "Project + stack named" }
      : projectNarrated
      ? { state: "warn", label: "Project mentioned — name the stack" }
      : { state: "empty", label: "No project yet — lead with your capstone" };

  /* Research. */
  const specificResearch = CP_COMPANY_SPECIFIC.test(userText);
  const genericOnly = CP_COMPANY_GENERIC.test(userText) && !specificResearch;
  const research: CampusReadiness["research"] = specificResearch
    ? { state: "pass", label: "Company-specific signal cited" }
    : genericOnly
    ? { state: "warn", label: "Generic — name a program / launch / value" }
    : { state: "empty", label: "Drop a program name (NQT / InfyTQ / LP)" };

  /* Logistics. */
  const logistics: CampusReadiness["logistics"] = CP_AVAILABILITY.test(userText)
    ? { state: "pass", label: "Joining / availability addressed" }
    : { state: "empty", label: "Mention joining date / relocation" };

  /* Red-flag tier — only surfaced when the pattern fires. */
  const deficit = CP_VOLUNTEERED_DEFICIT.test(userText)
    ? { state: "alert" as const, label: "Don't volunteer backlogs / low CGPA" }
    : null;
  const badmouth = CP_BADMOUTH.test(userText)
    ? { state: "alert" as const, label: "Reframe — don't criticise college" }
    : null;
  const teamMatch = userText.match(CP_IMPLAUSIBLE_TEAM);
  const team = teamMatch && Number(teamMatch[1]) >= 15
    ? { state: "alert" as const, label: `Team of ${teamMatch[1]}? Re-scope the claim` }
    : null;
  const internshipClaimed = CP_INTERNSHIP_CLAIM.test(userText);
  const internshipDetailed = CP_INTERNSHIP_DETAIL.test(userText);
  const internship = internshipClaimed && !internshipDetailed
    ? { state: "warn" as const, label: "Name internship company + deliverable" }
    : internshipClaimed && internshipDetailed
    ? { state: "pass" as const, label: "Internship substantiated" }
    : null;

  /* Filler. */
  const wordCount = userText.split(/\s+/).filter(Boolean).length;
  const fillerCount = (userText.match(CP_FILLER) || []).length;
  const per100 = wordCount >= 50 ? (fillerCount / wordCount) * 100 : 0;
  const fillerWarn = wordCount >= 100 && per100 >= FILLER_PER_100_WARN;

  return {
    project,
    research,
    logistics,
    deficit,
    badmouth,
    team,
    internship,
    filler: { count: fillerCount, wordCount, per100, warn: fillerWarn },
  };
}
