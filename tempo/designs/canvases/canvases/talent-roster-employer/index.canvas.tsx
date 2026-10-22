import { Canvas, Storyboard } from "tempo-sdk/canvas";
import CanvasProviders from "../../../../CanvasProviders";
import TalentRosterEmployer from "./TalentRosterEmployer";

function EmployersLanding() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="employers-landing" />
    </CanvasProviders>
  );
}

function CompanyLogin() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="company-login" />
    </CanvasProviders>
  );
}

function ConsoleEmpty() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="console-empty" />
    </CanvasProviders>
  );
}

function Console() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="console" />
    </CanvasProviders>
  );
}

function PostRequirement() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="post-requirement" />
    </CanvasProviders>
  );
}

function Generating() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="generating" />
    </CanvasProviders>
  );
}

function ShortlistResults() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="shortlist" />
    </CanvasProviders>
  );
}

function Comparison() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="comparison" />
    </CanvasProviders>
  );
}

function PartialMatch() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="partial-match" />
    </CanvasProviders>
  );
}

function ZeroMatch() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="zero-match" />
    </CanvasProviders>
  );
}

function GenerationFailed() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="generation-failed" />
    </CanvasProviders>
  );
}

function UnlockConfirm() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="unlock-confirm" />
    </CanvasProviders>
  );
}

function UnlockFailed() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="unlock-failed" />
    </CanvasProviders>
  );
}

function UnlockedContact() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="unlocked-contact" />
    </CanvasProviders>
  );
}

function OutcomeFeedback() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="outcome-feedback" />
    </CanvasProviders>
  );
}

function RequirementClosed() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="requirement-closed" />
    </CanvasProviders>
  );
}

function CompanyOnboarding() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="company-onboarding" />
    </CanvasProviders>
  );
}

function CompanyPending() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="company-pending" />
    </CanvasProviders>
  );
}

function CompanyRejected() {
  return (
    <CanvasProviders>
      <TalentRosterEmployer variant="company-rejected" />
    </CanvasProviders>
  );
}

export default function TalentRosterEmployerCanvas() {
  return (
    <Canvas name="Talent Roster — Employer">
      <Storyboard
        id="EmployersLanding"
        name="0a. Employers landing page (marketing)"
        component={EmployersLanding}
        layout={{ x: 0, y: 13528, width: 1440, height: 900 }}
      />
      <Storyboard
        id="CompanyLogin"
        name="0b. Log in (same account as candidates)"
        component={CompanyLogin}
        layout={{ x: 0, y: 14478, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ConsoleEmpty"
        name="0. Requirements console — empty"
        component={ConsoleEmpty}
        layout={{ x: 0, y: 7876, width: 1440, height: 760 }}
      />
      <Storyboard
        id="Console"
        name="1. Requirements console"
        component={Console}
        layout={{ x: 0, y: 0, width: 1440, height: 900 }}
      />
      <Storyboard
        id="PostRequirement"
        name="2. Post a requirement"
        component={PostRequirement}
        layout={{ x: 1490, y: 0, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="Generating"
        name="3. Generating shortlist"
        component={Generating}
        layout={{ x: 0, y: 1074, width: 1440, height: 760 }}
      />
      <Storyboard
        id="ShortlistResults"
        name="4. Shortlist results"
        component={ShortlistResults}
        layout={{ x: 0, y: 1884, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="Comparison"
        name="4b. Compare candidates side by side"
        component={Comparison}
        layout={{ x: 1490, y: 1074, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="PartialMatch"
        name="5. Partial match"
        component={PartialMatch}
        layout={{ x: 0, y: 2958, width: 1440, height: 1100 }}
      />
      <Storyboard
        id="ZeroMatch"
        name="6. Zero match"
        component={ZeroMatch}
        layout={{ x: 0, y: 4108, width: 1440, height: 760 }}
      />
      <Storyboard
        id="GenerationFailed"
        name="7. Generation failed"
        component={GenerationFailed}
        layout={{ x: 0, y: 4918, width: 1440, height: 760 }}
      />
      <Storyboard
        id="UnlockConfirm"
        name="8. Unlock confirm"
        component={UnlockConfirm}
        layout={{ x: 0, y: 5728, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="UnlockFailed"
        name="8b. Unlock payment failed"
        component={UnlockFailed}
        layout={{ x: 0, y: 8686, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="UnlockedContact"
        name="9. Unlocked contact"
        component={UnlockedContact}
        layout={{ x: 0, y: 6802, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="OutcomeFeedback"
        name="9b. Outcome feedback (promoted from throwaway line)"
        component={OutcomeFeedback}
        layout={{ x: 1490, y: 2148, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="RequirementClosed"
        name="10. Requirement closed (read-only)"
        component={RequirementClosed}
        layout={{ x: 0, y: 9760, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="CompanyOnboarding"
        name="11. Company profile — submit for approval"
        component={CompanyOnboarding}
        layout={{ x: 0, y: 10834, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="CompanyPending"
        name="11b. Company pending approval"
        component={CompanyPending}
        layout={{ x: 0, y: 11908, width: 1440, height: 760 }}
      />
      <Storyboard
        id="CompanyRejected"
        name="11c. Company not approved"
        component={CompanyRejected}
        layout={{ x: 0, y: 12718, width: 1440, height: 760 }}
      />
    </Canvas>
  );
}
