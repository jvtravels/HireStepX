import type { TempoPage, TempoStoryboard } from 'tempo-sdk';
import { ReportsFeatureSection } from './_reports-feature-section';
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
  layout: { x: -3165, y: -424, width: 1440, height: 30413 },
};

export const SalaryNegStrong: TempoStoryboard = {
  render: () => <SalaryNegStrongDemo />,
  name: "2. Salary Neg — strong (84) · same scenario, right rubric",
  layout: { x: 8231, y: -306, width: 100, height: 29191 },
};

export const Behavioral: TempoStoryboard = {
  render: () => <BehavioralStrongDemo />,
  name: "3. Behavioral — strong (82)",
  layout: { x: 0, y: 3050, width: 100, height: 5054 },
};

export const Technical: TempoStoryboard = {
  render: () => <TechnicalPartialDemo />,
  name: "4. Technical — partial (64) · skipped brute force",
  layout: { x: 5205, y: -306, width: 1440, height: 3560 },
};

export const CaseStudy: TempoStoryboard = {
  render: () => <CaseStudyStrongDemo />,
  name: "5. Case Study — strong (78) · diagnose framework",
  layout: { x: 2015, y: 3420, width: 1440, height: 3760 },
};

export const SystemDesign: TempoStoryboard = {
  render: () => <SystemDesignPartialDemo />,
  name: "6. System Design — partial (62) · skipped requirements",
  layout: { x: 5205, y: 3221, width: 1440, height: 3858 },
};

export const CampusPlacement: TempoStoryboard = {
  render: () => <CampusPlacementPartialDemo />,
  name: "7. Campus Placement — partial (58) · vague project role",
  layout: { x: 2015, y: 7241, width: 1440, height: 3870 },
};

export const Panel: TempoStoryboard = {
  render: () => <PanelStrongDemo />,
  name: "8. Panel — strong (78) · per-panelist tone calibration",
  layout: { x: 2015, y: -306, width: 1440, height: 3612 },
};

export const Strategic: TempoStoryboard = {
  render: () => <StrategicStrongDemo />,
  name: "9. Strategic — strong (80) · 4 stakeholders, 3 horizons",
  layout: { x: -3165, y: 10624, width: 1440, height: 3627 },
};

export const HR: TempoStoryboard = {
  render: () => <HRWeakDemo />,
  name: "10. HR Round — weak (42) · production HrFullReport · 8-dim gate + logistics + motivation rewrite",
  layout: { x: 1490, y: 12200, width: 100, height: 14008 },
};

export const Government: TempoStoryboard = {
  render: () => <GovernmentPartialDemo />,
  name: "11. Government / PSU — partial (60) · no current affairs cited",
  layout: { x: -3165, y: 14604, width: 1440, height: 3765 },
};

export const ReportsFeatureSectionStoryboard: TempoStoryboard = {
  render: () => <ReportsFeatureSection />,
  name: "12. Marketing — Personalized reports section · 1728×1000",
  layout: { x: -1322, y: 18704, width: 1728, height: 1000 },
};
