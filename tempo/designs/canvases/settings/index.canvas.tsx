/* HireStepX — Settings canvas / index
   Five storyboards, one per tab. The `tab` prop drives which section
   highlights in the sidebar and renders in the content pane.
   CanvasProviders supplies brand CSS custom properties. */
import CanvasProviders from '../../../CanvasProviders';
import { Settings } from './Settings';
import { Canvas, Storyboard } from "tempo-sdk/canvas";

const AccountTab = () => (
    <CanvasProviders>
      <Settings tab="account" />
    </CanvasProviders>
  );

const InterviewTab = () => (
    <CanvasProviders>
      <Settings tab="interview" />
    </CanvasProviders>
  );

const NotificationsTab = () => (
    <CanvasProviders>
      <Settings tab="notifications" />
    </CanvasProviders>
  );

const PlanTab = () => (
    <CanvasProviders>
      <Settings tab="plan" />
    </CanvasProviders>
  );

const ReferralTab = () => (
    <CanvasProviders>
      <Settings tab="referral" />
    </CanvasProviders>
  );

export default function SettingsCanvas() {
  return (
    <Canvas name="Settings">
      <Storyboard
        id="AccountTab"
        name="1. Account"
        component={AccountTab}
        layout={{ x: 0, y: 0, width: 1728, height: 1060 }}
      />
      <Storyboard
        id="InterviewTab"
        name="2. Interview"
        component={InterviewTab}
        layout={{ x: 0, y: 1110, width: 1728, height: 1060 }}
      />
      <Storyboard
        id="NotificationsTab"
        name="3. Notifications (future)"
        component={NotificationsTab}
        layout={{ x: 0, y: 2220, width: 1728, height: 1060 }}
      />
      <Storyboard
        id="PlanTab"
        name="4. Plan and data"
        component={PlanTab}
        layout={{ x: 0, y: 3330, width: 1728, height: 1060 }}
      />
      <Storyboard
        id="ReferralTab"
        name="5. Referral"
        component={ReferralTab}
        layout={{ x: 0, y: 4440, width: 1728, height: 1060 }}
      />
    </Canvas>
  );
}
