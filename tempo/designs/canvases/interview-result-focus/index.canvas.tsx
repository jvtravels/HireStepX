import type { TempoPage, TempoStoryboard } from 'tempo-sdk';
import { BehavioralStrongDemo } from './Demos';
import { CampusPlacementPartialDemo } from './Demos';
import { CaseStudyStrongDemo } from './Demos';
import { GovernmentPartialDemo } from './Demos';
import { HRWeakDemo } from './Demos';
import { PanelStrongDemo } from './Demos';
import { SalaryNegStrongDemo } from './Demos';
import { SalaryNegWeakDemo } from './Demos';
import { StrategicStrongDemo } from './Demos';
import { SystemDesignPartialDemo } from './Demos';
import { TechnicalPartialDemo } from './Demos';

const page: TempoPage = {
  name: "Interview Result Focus",
};

export default page;

/* HEADLINE PAIR — same ₹38L PhonePe scenario, opposite rubric outcomes.
   Lead with this row: it's the most persuasive single artifact in the canvas. */
export const SalaryNegWeak: TempoStoryboard = {
  render: () => <SalaryNegWeakDemo />,
  name: "1. Salary Neg — weak (38) · accepted first offer",
  layout: { x: 0, y: 0, width: 1440, height: 3000 },
};

export const SalaryNegStrong: TempoStoryboard = {
  render: () => <SalaryNegStrongDemo />,
  name: "2. Salary Neg — strong (84) · same scenario, right rubric",
  layout: { x: 1490, y: 0, width: 1440, height: 3000 },
};

export const Behavioral: TempoStoryboard = {
  render: () => <BehavioralStrongDemo />,
  name: "3. Behavioral — strong (82)",
  layout: { x: 0, y: 3050, width: 1440, height: 3000 },
};

export const Technical: TempoStoryboard = {
  render: () => <TechnicalPartialDemo />,
  name: "4. Technical — partial (64) · skipped brute force",
  layout: { x: 1490, y: 3050, width: 1440, height: 3000 },
};

export const CaseStudy: TempoStoryboard = {
  render: () => <CaseStudyStrongDemo />,
  name: "5. Case Study — strong (78) · diagnose framework",
  layout: { x: 0, y: 6100, width: 1440, height: 3000 },
};

export const SystemDesign: TempoStoryboard = {
  render: () => <SystemDesignPartialDemo />,
  name: "6. System Design — partial (62) · skipped requirements",
  layout: { x: 1490, y: 6100, width: 1440, height: 3000 },
};

export const CampusPlacement: TempoStoryboard = {
  render: () => <CampusPlacementPartialDemo />,
  name: "7. Campus Placement — partial (58) · vague project role",
  layout: { x: 0, y: 9150, width: 1440, height: 3000 },
};

export const Panel: TempoStoryboard = {
  render: () => <PanelStrongDemo />,
  name: "8. Panel — strong (78) · per-panelist tone calibration",
  layout: { x: 1490, y: 9150, width: 1440, height: 3000 },
};

export const Strategic: TempoStoryboard = {
  render: () => <StrategicStrongDemo />,
  name: "9. Strategic — strong (80) · 4 stakeholders, 3 horizons",
  layout: { x: 0, y: 12200, width: 1440, height: 3000 },
};

export const HR: TempoStoryboard = {
  render: () => <HRWeakDemo />,
  name: "10. HR Round — weak (42) · 4-chapter HR-native report · diagnose / act / practice / next",
  layout: { x: 1490, y: 12200, width: 1440, height: 7200 },
};

export const Government: TempoStoryboard = {
  render: () => <GovernmentPartialDemo />,
  name: "11. Government / PSU — partial (60) · no current affairs cited",
  layout: { x: 0, y: 15250, width: 1440, height: 3000 },
};
