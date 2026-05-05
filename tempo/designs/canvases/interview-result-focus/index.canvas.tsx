import type { TempoPage, TempoStoryboard, TempoRouteStoryboard } from 'tempo-sdk';
import { BehavioralStrongDemo } from './FocusAwareReport';
import { CaseStudyStrongDemo } from './FocusAwareReport';
import { SalaryNegStrongDemo } from './FocusAwareReport';
import { SalaryNegWeakDemo } from './FocusAwareReport';
import { TechnicalPartialDemo } from './FocusAwareReport';

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
