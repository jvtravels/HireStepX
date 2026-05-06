/* HireStepX — Focus-aware demo wrappers
 *
 * Each export is a tiny React component that renders the EXISTING
 * InterviewResult component (../interview-result/InterviewResult)
 * with focus-specific data from ./_focus-data. No new layout — same
 * report structure, same hero, same skill bars, same per-question
 * card. Only the CONTENT inside those slots is focus-specific.
 *
 * Each demo is wrapped in <CanvasProviders> (matching the pattern
 * used by the sibling interview-result canvas). Without it, the
 * storyboards render blank in Tempo iframes — InterviewResult
 * inherits cream/coal CSS-token styling from the providers' wrapper
 * div, and the canvas frame has no other surface backing it.
 */

import CanvasProviders from "../../../CanvasProviders";
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

export function BehavioralStrongDemo() { return <CanvasProviders><InterviewResult data={BEHAVIORAL_STRONG} /></CanvasProviders>; }
export function TechnicalPartialDemo() { return <CanvasProviders><InterviewResult data={TECHNICAL_PARTIAL} /></CanvasProviders>; }
export function CaseStudyStrongDemo() { return <CanvasProviders><InterviewResult data={CASE_STUDY_STRONG} /></CanvasProviders>; }
export function SalaryNegWeakDemo() { return <CanvasProviders><InterviewResult data={SALARY_NEG_WEAK} /></CanvasProviders>; }
export function SalaryNegStrongDemo() { return <CanvasProviders><InterviewResult data={SALARY_NEG_STRONG} /></CanvasProviders>; }
export function SystemDesignPartialDemo() { return <CanvasProviders><InterviewResult data={SYSTEM_DESIGN_PARTIAL} /></CanvasProviders>; }
export function StrategicStrongDemo() { return <CanvasProviders><InterviewResult data={STRATEGIC_STRONG} /></CanvasProviders>; }
export function CampusPlacementPartialDemo() { return <CanvasProviders><InterviewResult data={CAMPUS_PLACEMENT_PARTIAL} /></CanvasProviders>; }
export function HRWeakDemo() { return <CanvasProviders><InterviewResult data={HR_WEAK} /></CanvasProviders>; }
export function PanelStrongDemo() { return <CanvasProviders><InterviewResult data={PANEL_STRONG} /></CanvasProviders>; }
export function GovernmentPartialDemo() { return <CanvasProviders><InterviewResult data={GOVERNMENT_PARTIAL} /></CanvasProviders>; }
