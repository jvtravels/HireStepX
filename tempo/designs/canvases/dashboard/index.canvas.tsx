/* HireStepX — Dashboard canvas / index
   Route storyboard over the real, authenticated /dashboard page
   (src/DashboardHome.tsx). Requires logging in once inside the canvas
   iframe — this renders the live app, not a mock. */
import { Canvas, RouteStoryboard } from "tempo-sdk/canvas";

export default function DashboardCanvas() {
  return (
    <Canvas name="Dashboard">
      <RouteStoryboard
        id="LiveDashboard"
        name="Dashboard — live /dashboard route"
        route="/dashboard"
        layout={{ x: 0, y: 0, width: 1440, height: 1024 }}
      />
    </Canvas>
  );
}
