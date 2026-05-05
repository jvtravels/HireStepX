import type { TempoPage, TempoStoryboard, TempoRouteStoryboard } from 'tempo-sdk';
import { BehavioralStrongDemo } from './Demos';
import { CaseStudyStrongDemo } from './Demos';
import { SalaryNegStrongDemo } from './Demos';
import { SalaryNegWeakDemo } from './Demos';
import { TechnicalPartialDemo } from './Demos';
import { SystemDesignPartialDemo } from './Demos';
import { StrategicStrongDemo } from './Demos';
import { CampusPlacementPartialDemo } from './Demos';
import { HRWeakDemo } from './Demos';
import { PanelStrongDemo } from './Demos';
import { GovernmentPartialDemo } from './Demos';

const page: TempoPage = {
  name: "Interview Result Focus",
};

export default page;

export const Behavioral: TempoStoryboard = {
  render: () => <BehavioralStrongDemo />,
  name: "1. Behavioral — strong (82)",
  layout: { x: 0, y: 0, width: 1100, height: 2200 },
};

export const Technical: TempoStoryboard = {
  render: () => <TechnicalPartialDemo />,
  name: "2. Technical — partial (64) · skipped brute force",
  layout: { x: 1150, y: 0, width: 1100, height: 2400 },
};

export const CaseStudy: TempoStoryboard = {
  render: () => <CaseStudyStrongDemo />,
  name: "3. Case Study — strong (78) · diagnose framework",
  layout: { x: 0, y: 2450, width: 1100, height: 2000 },
};

export const SalaryNegWeak: TempoStoryboard = {
  render: () => <SalaryNegWeakDemo />,
  name: "4. Salary Neg — weak (38) · accepted first offer",
  layout: { x: 0, y: 4500, width: 1100, height: 2400 },
};

export const SalaryNegStrong: TempoStoryboard = {
  render: () => <SalaryNegStrongDemo />,
  name: "5. Salary Neg — strong (84) · same scenario, right rubric",
  layout: { x: 0, y: 6950, width: 1100, height: 2000 },
};

export const SystemDesign: TempoStoryboard = {
  render: () => <SystemDesignPartialDemo />,
  name: "6. System Design — partial (62) · skipped requirements",
  layout: { x: 0, y: 9000, width: 1100, height: 2000 },
};

export const Strategic: TempoStoryboard = {
  render: () => <StrategicStrongDemo />,
  name: "7. Strategic — strong (80) · 4 stakeholders, 3 horizons",
  layout: { x: 0, y: 11050, width: 1100, height: 2000 },
};

export const CampusPlacement: TempoStoryboard = {
  render: () => <CampusPlacementPartialDemo />,
  name: "8. Campus Placement — partial (58) · vague project role",
  layout: { x: 0, y: 13100, width: 1100, height: 2000 },
};

export const HR: TempoStoryboard = {
  render: () => <HRWeakDemo />,
  name: "9. HR Round — weak (42) · badmouthing + generic motivation",
  layout: { x: 0, y: 15150, width: 1100, height: 2000 },
};

export const Panel: TempoStoryboard = {
  render: () => <PanelStrongDemo />,
  name: "10. Panel — strong (78) · per-panelist tone calibration",
  layout: { x: 0, y: 17200, width: 1100, height: 2200 },
};

export const Government: TempoStoryboard = {
  render: () => <GovernmentPartialDemo />,
  name: "11. Government / PSU — partial (60) · no current affairs cited",
  layout: { x: 0, y: 19450, width: 1100, height: 2000 },
};
