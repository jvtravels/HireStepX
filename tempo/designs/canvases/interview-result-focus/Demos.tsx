/* HireStepX — Focus-aware demo wrappers
 *
 * Each export is a tiny React component that renders the EXISTING
 * InterviewResult component (../interview-result/InterviewResult)
 * with focus-specific data from ./_focus-data. No new layout — same
 * report structure, same hero, same skill bars, same per-question
 * card. Only the CONTENT inside those slots is focus-specific.
 *
 * This file exists purely so the canvas index can import named
 * components by string — Tempo's create-canvas tool requires that
 * shape. The actual rendering is delegated to InterviewResult.
 */

import InterviewResult from "../interview-result/InterviewResult";
import {
  BEHAVIORAL_STRONG,
  TECHNICAL_PARTIAL,
  CASE_STUDY_STRONG,
  SALARY_NEG_WEAK,
  SALARY_NEG_STRONG,
  SYSTEM_DESIGN_PARTIAL,
  STRATEGIC_STRONG,
  CAMPUS_PLACEMENT_PARTIAL,
  HR_WEAK,
  PANEL_STRONG,
  GOVERNMENT_PARTIAL,
} from "./_focus-data";

export function BehavioralStrongDemo() { return <InterviewResult data={BEHAVIORAL_STRONG} />; }
export function TechnicalPartialDemo() { return <InterviewResult data={TECHNICAL_PARTIAL} />; }
export function CaseStudyStrongDemo() { return <InterviewResult data={CASE_STUDY_STRONG} />; }
export function SalaryNegWeakDemo() { return <InterviewResult data={SALARY_NEG_WEAK} />; }
export function SalaryNegStrongDemo() { return <InterviewResult data={SALARY_NEG_STRONG} />; }
export function SystemDesignPartialDemo() { return <InterviewResult data={SYSTEM_DESIGN_PARTIAL} />; }
export function StrategicStrongDemo() { return <InterviewResult data={STRATEGIC_STRONG} />; }
export function CampusPlacementPartialDemo() { return <InterviewResult data={CAMPUS_PLACEMENT_PARTIAL} />; }
export function HRWeakDemo() { return <InterviewResult data={HR_WEAK} />; }
export function PanelStrongDemo() { return <InterviewResult data={PANEL_STRONG} />; }
export function GovernmentPartialDemo() { return <InterviewResult data={GOVERNMENT_PARTIAL} />; }
