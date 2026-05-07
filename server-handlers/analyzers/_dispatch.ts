/* Maps a session to its focus-specific analyzer.
 *
 * Adding a new analyzer:
 *   1. Implement FocusAnalyzer in `./<focus>.ts`.
 *   2. Register it in REGISTRY below.
 *   3. Add a ground-truth fixture set under
 *      `src/__tests__/analyzers/fixtures/<focus>/` and a CI accuracy test.
 *
 * Sessions whose `type` doesn't match a registered analyzer fall
 * through to the noop analyzer — they still get an insight row so
 * the cron's "did we look at this session" question has a yes/no
 * answer, but with empty findings.
 */

import { FocusAnalyzer, AnalyzerInput, AnalyzerResult, emptyResult } from "./_types";
import { behavioralAnalyzer } from "./behavioral";
import { salaryNegotiationAnalyzer } from "./salary-negotiation";
import { technicalAnalyzer } from "./technical";
import { systemDesignAnalyzer } from "./system-design";
import { hrRoundAnalyzer } from "./hr-round";
import { strategicAnalyzer } from "./strategic";
import { panelAnalyzer } from "./panel";
import { caseStudyAnalyzer } from "./case-study";
import { campusPlacementAnalyzer } from "./campus-placement";
import { managementAnalyzer } from "./management";
import { governmentPsuAnalyzer } from "./government-psu";

const noopAnalyzer: FocusAnalyzer = {
  focus: "unknown",
  version: "noop-v1",
  async analyze(_input: AnalyzerInput): Promise<AnalyzerResult> {
    const r = emptyResult();
    r.flags.push("no_analyzer_for_focus");
    return r;
  },
};

const REGISTRY: Record<string, FocusAnalyzer> = {
  behavioral: behavioralAnalyzer,
  "salary-negotiation": salaryNegotiationAnalyzer,
  technical: technicalAnalyzer,
  "system-design": systemDesignAnalyzer,
  "hr-round": hrRoundAnalyzer,
  strategic: strategicAnalyzer,
  panel: panelAnalyzer,
  "case-study": caseStudyAnalyzer,
  "campus-placement": campusPlacementAnalyzer,
  management: managementAnalyzer,
  "government-psu": governmentPsuAnalyzer,
};

export function pickAnalyzer(sessionType: string): FocusAnalyzer {
  return REGISTRY[sessionType] || noopAnalyzer;
}

export function registeredFocuses(): string[] {
  return Object.keys(REGISTRY);
}
