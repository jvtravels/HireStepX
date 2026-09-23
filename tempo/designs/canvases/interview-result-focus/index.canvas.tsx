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
import { Canvas, Storyboard } from "tempo-sdk/canvas";

/* HEADLINE PAIR — same ₹38L PhonePe scenario, opposite rubric outcomes.
   Lead with this row: it's the most persuasive single artifact in the canvas. */

export default function InterviewResultFocusCanvas() {
  return (
    <Canvas name="Interview Result Focus">
      <Storyboard
        id="SalaryNegWeak"
        name="1. Salary Neg — weak (38) · accepted first offer"
        component={SalaryNegWeakDemo}
        layout={{ x: -3165, y: -424, width: 1440, height: 30413 }}
      />
      <Storyboard
        id="SalaryNegStrong"
        name="2. Salary Neg — strong (84) · same scenario, right rubric"
        component={SalaryNegStrongDemo}
        layout={{ x: 8231, y: -306, width: 100, height: 29191 }}
      />
      <Storyboard
        id="Behavioral"
        name="3. Behavioral — strong (82)"
        component={BehavioralStrongDemo}
        layout={{ x: 0, y: 3050, width: 100, height: 5054 }}
      />
      <Storyboard
        id="Technical"
        name="4. Technical — partial (64) · skipped brute force"
        component={TechnicalPartialDemo}
        layout={{ x: 5205, y: -306, width: 1440, height: 3560 }}
      />
      <Storyboard
        id="CaseStudy"
        name="5. Case Study — strong (78) · diagnose framework"
        component={CaseStudyStrongDemo}
        layout={{ x: 2015, y: 3420, width: 1440, height: 3760 }}
      />
      <Storyboard
        id="SystemDesign"
        name="6. System Design — partial (62) · skipped requirements"
        component={SystemDesignPartialDemo}
        layout={{ x: 5205, y: 3221, width: 1440, height: 3858 }}
      />
      <Storyboard
        id="CampusPlacement"
        name="7. Campus Placement — partial (58) · vague project role"
        component={CampusPlacementPartialDemo}
        layout={{ x: 2015, y: 7241, width: 1440, height: 3870 }}
      />
      <Storyboard
        id="Panel"
        name="8. Panel — strong (78) · per-panelist tone calibration"
        component={PanelStrongDemo}
        layout={{ x: 2015, y: -306, width: 1440, height: 3612 }}
      />
      <Storyboard
        id="Strategic"
        name="9. Strategic — strong (80) · 4 stakeholders, 3 horizons"
        component={StrategicStrongDemo}
        layout={{ x: -3165, y: 10624, width: 1440, height: 3627 }}
      />
      <Storyboard
        id="HR"
        name="10. HR Round — weak (42) · production HrFullReport · 8-dim gate + logistics + motivation rewrite"
        component={HRWeakDemo}
        layout={{ x: 1490, y: 12200, width: 100, height: 14008 }}
      />
      <Storyboard
        id="Government"
        name="11. Government / PSU — partial (60) · no current affairs cited"
        component={GovernmentPartialDemo}
        layout={{ x: -3165, y: 14604, width: 1440, height: 3765 }}
      />
      <Storyboard
        id="ReportsFeatureSectionStoryboard"
        name="12. Marketing — Personalized reports section · 1728×1000"
        component={ReportsFeatureSection}
        layout={{ x: -1322, y: 18704, width: 1728, height: 1000 }}
      />
    </Canvas>
  );
}
