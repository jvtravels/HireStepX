import type { TempoPage, TempoStoryboard, TempoRouteStoryboard } from 'tempo-sdk';
import { PlanStatusWidget } from './PlanStatusWidget';

const page: TempoPage = {
  name: "Plan Status Widget",
};

export default page;

export const ProPlan: TempoStoryboard = {
  render: () => <PlanStatusWidget tier="pro" subscriptionEnd="2026-07-07" />,
  name: "Pro Plan",
  layout: { x: 0, y: 0, width: 280, height: 220 },
};

export const StarterPlan: TempoStoryboard = {
  render: () => <PlanStatusWidget tier="starter" sessionsThisWeek={3} subscriptionEnd="2026-07-07" />,
  name: "Starter Plan",
  layout: { x: 330, y: 0, width: 280, height: 220 },
};

export const FreePlan: TempoStoryboard = {
  render: () => <PlanStatusWidget tier="free" sessionsUsed={1} />,
  name: "Free Plan",
  layout: { x: 660, y: 0, width: 280, height: 220 },
};
