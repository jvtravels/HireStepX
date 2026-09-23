import { Canvas, Storyboard } from "tempo-sdk/canvas";
import Employersdashboard, {
  EmployersDashboardEmployerJourneyIntro,
  EmployersDashboardEmployerAuth,
  EmployersDashboardEmployerOnboarding,
  EmployersDashboardEmployerPending,
  EmployersDashboardEmployerRejected,
  EmployersDashboardOpportunityDetails,
  EmployersDashboardOpportunityDetailsMatching,
  EmployersDashboardOpportunityDetailsAllLocked,
  EmployersDashboardOpportunityDetailsAllUnlocked,
  EmployersDashboardOpportunityDetailsMultiBatchPartial,
  EmployersDashboardOpportunityDetailsMultiBatchFullyUnlocked,
  EmployersDashboardOpportunityDetailsInterviewing,
  EmployersDashboardOpportunityDetailsPaused,
  EmployersDashboardOpportunityDetailsFilteredEmpty,
  EmployersDashboardOpportunityDetailsRepeatUnlock,
  EmployersDashboardOpportunityDetailsBulkSelection,
  EmployersDashboardOpportunityDetailsCompareDialog,
  EmployersDashboardOpportunityDetailsEvidenceDialog,
  EmployersDashboardOpportunityDetailsCandidateProfileLocked,
  EmployersDashboardOpportunityDetailsCandidateProfileUnlocked,
  EmployersDashboardAdminApprovals,
  EmployersDashboardAdminApprovalsEmpty,
  EmployersDashboardCompare,
  EmployersDashboardOutcomeFeedback,
  EmployersDashboardSettings,
} from "./EmployersDashboard";

export default function EmployersCanvas() {
  return (
    <Canvas name="Employers" backgroundColor="#232323">
      {/* ── Row A — Pre-approval journey: intro → Sign up/Log in → Company
          onboarding → Pending / Rejected outcomes, read left to right. ── */}
      <Storyboard
        id="EmployersDashboardEmployerJourneyIntro"
        name="Employer Journey — Overview"
        component={EmployersDashboardEmployerJourneyIntro}
        layout={{ x: 0, y: 0, width: 1728, height: 320, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="EmployersDashboardEmployerAuth"
        name="1. Sign up / Log in (Employer)"
        component={EmployersDashboardEmployerAuth}
        layout={{ x: 1878, y: 0, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="EmployersDashboardEmployerOnboarding"
        name="2. Company Onboarding"
        component={EmployersDashboardEmployerOnboarding}
        layout={{ x: 3756, y: 0, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="EmployersDashboardEmployerPending"
        name="3a. Pending Review"
        component={EmployersDashboardEmployerPending}
        layout={{ x: 5634, y: 0, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="EmployersDashboardEmployerRejected"
        name="3b. Rejected"
        component={EmployersDashboardEmployerRejected}
        layout={{ x: 7512, y: 0, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
      {/* ── Row B — Admin gate: the decision that unlocks Dashboard access. ── */}
      {/* ── Row C — Dashboard, the post-approval home screen. ── */}
      <Storyboard
        id="EmployersDashboardScreen"
        name="Dashboard"
        component={Employersdashboard}
        layout={{ x: 0, y: 1447, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
      {/* ── Rows D1–D4 — Opportunity Details pipeline-stage variants, a 4-wide
          grid instead of one long column so the whole set fits in view. ── */}
      <Storyboard
        id="EmployersDashboardOpportunityDetails"
        name="Opportunity Details — Hired (Expired Posting)"
        component={EmployersDashboardOpportunityDetails}
        layout={{ x: 0, y: 2698, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="EmployersDashboardOpportunityDetailsMatching"
        name="Opportunity Details — AI Matching"
        component={EmployersDashboardOpportunityDetailsMatching}
        layout={{ x: 1878, y: 2698, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="EmployersDashboardOpportunityDetailsAllLocked"
        name="Opportunity Details — Review, All Locked"
        component={EmployersDashboardOpportunityDetailsAllLocked}
        layout={{ x: 3756, y: 2698, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="EmployersDashboardOpportunityDetailsAllUnlocked"
        name="Opportunity Details — Review, Fully Unlocked"
        component={EmployersDashboardOpportunityDetailsAllUnlocked}
        layout={{ x: 5634, y: 2698, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="EmployersDashboardOpportunityDetailsMultiBatchPartial"
        name="Opportunity Details — Multi-Batch, Batch 1 Unlocked"
        component={EmployersDashboardOpportunityDetailsMultiBatchPartial}
        layout={{ x: 0, y: 4092, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="EmployersDashboardOpportunityDetailsMultiBatchFullyUnlocked"
        name="Opportunity Details — Multi-Batch, All Unlocked"
        component={EmployersDashboardOpportunityDetailsMultiBatchFullyUnlocked}
        layout={{ x: 1878, y: 4092, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="EmployersDashboardOpportunityDetailsInterviewing"
        name="Opportunity Details — Interviewing"
        component={EmployersDashboardOpportunityDetailsInterviewing}
        layout={{ x: 3756, y: 4092, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="EmployersDashboardOpportunityDetailsPaused"
        name="Opportunity Details — Paused Posting"
        component={EmployersDashboardOpportunityDetailsPaused}
        layout={{ x: 5634, y: 4092, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="EmployersDashboardOpportunityDetailsFilteredEmpty"
        name="Opportunity Details — Empty Stage Filter"
        component={EmployersDashboardOpportunityDetailsFilteredEmpty}
        layout={{ x: 0, y: 5266, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="EmployersDashboardOpportunityDetailsRepeatUnlock"
        name="Opportunity Details — Repeat-Unlock Confirmation"
        component={EmployersDashboardOpportunityDetailsRepeatUnlock}
        layout={{ x: 1878, y: 5266, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="EmployersDashboardOpportunityDetailsBulkSelection"
        name="Opportunity Details — Bulk Selection Toolbar"
        component={EmployersDashboardOpportunityDetailsBulkSelection}
        layout={{ x: 3756, y: 5266, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
      {/* ── Row E — Candidate Profile pair, reached from the shortlist table
          in the Opportunity Details grid above. ── */}
      <Storyboard
        id="EmployersDashboardOpportunityDetailsCandidateProfileLocked"
        name="Candidate Profile — Locked"
        component={EmployersDashboardOpportunityDetailsCandidateProfileLocked}
        layout={{ x: 0, y: 6660, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="EmployersDashboardOpportunityDetailsCandidateProfileUnlocked"
        name="Candidate Profile — Unlocked"
        component={EmployersDashboardOpportunityDetailsCandidateProfileUnlocked}
        layout={{ x: 1878, y: 6660, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
      {/* ── Row F — Compare (dedicated full-page route, grounded in the real
          requirements/[id]/compare route) beside Outcome Feedback. The
          existing "Compare Dialog" storyboard above (row D3) models the same
          feature as a modal — both are kept; a future cleanup should pick one. ── */}
      {/* ── Row G — Settings, reached from the Dashboard nav. ── */}
      <Storyboard
        id="EmployersDashboardSettings"
        name="Settings — Company Profile"
        component={EmployersDashboardSettings}
        layout={{ x: 0, y: 9545, width: 1728, height: 1024, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
