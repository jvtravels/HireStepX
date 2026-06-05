/* HireStepX — Settings canvas / index
   Five storyboards, one per tab. The `tab` prop drives which section
   highlights in the sidebar and renders in the content pane.
   CanvasProviders supplies brand CSS custom properties. */
import type { TempoPage, TempoStoryboard } from 'tempo-sdk';
import CanvasProviders from '../../../CanvasProviders';
import { Settings } from './Settings';

const page: TempoPage = {
  name: "Settings",
};

export default page;

export const AccountTab: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Settings tab="account" />
    </CanvasProviders>
  ),
  name: "1. Account",
  layout: { x: 0, y: 0, width: 1440, height: 1024 },
};

export const InterviewTab: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Settings tab="interview" />
    </CanvasProviders>
  ),
  name: "2. Interview",
  layout: { x: 1490, y: 0, width: 1440, height: 1024 },
};

export const NotificationsTab: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Settings tab="notifications" />
    </CanvasProviders>
  ),
  name: "3. Notifications",
  layout: { x: 0, y: 1074, width: 1440, height: 1024 },
};

export const PlanTab: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Settings tab="plan" />
    </CanvasProviders>
  ),
  name: "4. Plan and data",
  layout: { x: 0, y: 2148, width: 1440, height: 1024 },
};

export const ReferralTab: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Settings tab="referral" />
    </CanvasProviders>
  ),
  name: "5. Referral",
  layout: { x: 0, y: 3222, width: 1440, height: 1024 },
};
