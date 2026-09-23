import { PlanStatusWidget } from './PlanStatusWidget';
import { Canvas, Storyboard } from "tempo-sdk/canvas";

export default function PlanStatusWidgetCanvas() {
  return (
    <Canvas name="Plan Status Widget">
      <Storyboard
        id="ProPlan"
        name="Pro Plan"
        component={PlanStatusWidget}
        props={{ tier: "pro", subscriptionEnd: "2026-07-07" }}
        layout={{ x: 0, y: 0, width: 280, height: 220 }}
      />
      <Storyboard
        id="StarterPlan"
        name="Starter Plan"
        component={PlanStatusWidget}
        props={{ tier: "starter", sessionsThisWeek: 3, subscriptionEnd: "2026-07-07" }}
        layout={{ x: 330, y: 0, width: 280, height: 220 }}
      />
      <Storyboard
        id="FreePlan"
        name="Free Plan"
        component={PlanStatusWidget}
        props={{ tier: "free", sessionsUsed: 1 }}
        layout={{ x: 660, y: 0, width: 280, height: 220 }}
      />
    </Canvas>
  );
}
