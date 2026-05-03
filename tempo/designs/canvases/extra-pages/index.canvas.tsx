/* HireStepX — Extra pages canvas
   One-off marketing surfaces that don't belong inside the auth /
   onboarding / interview flows. First inhabitant: Coming Soon
   (the pre-launch marketing page rendered on apex hosts before the
   product is publicly open). */

import type { TempoPage, TempoStoryboard } from "tempo-sdk";
import CanvasProviders from "../../../CanvasProviders";
import ComingSoonDesign from "./ComingSoonDesign";

const page: TempoPage = {
  name: "Extra pages",
};

export default page;

/* Desktop — full-width hero composition. Tall enough that the founder
   note + footer are visible without internal scroll. */
export const ComingSoonDesktop: TempoStoryboard = {
  name: "Coming Soon — desktop",
  render: () => (
    <CanvasProviders>
      <ComingSoonDesign />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 0, width: 1440, height: 1300 },
};

/* Mobile — same component with compact prop. 480-wide so it surfaces
   stacking issues at iPhone-class viewports without shrinking past
   reasonable design widths. */
export const ComingSoonMobile: TempoStoryboard = {
  name: "Coming Soon — mobile",
  render: () => (
    <CanvasProviders>
      <ComingSoonDesign compact />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 0, width: 480, height: 1300 },
};

