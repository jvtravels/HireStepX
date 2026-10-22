import { ReadinessIndex } from './ReadinessIndex';
import { Canvas, Storyboard } from "tempo-sdk/canvas";

/* Interview-ready, RI 74, above Razorpay's bar of 72. The complete
   analytics surface with a pinned RI header, wired range scrubber, sticky
   zone-nav rail, comparison frames (cohort + own baseline), session diff,
   per-pillar drill-to-evidence, attention timeline, follow-up prep, and
   coaching. Green band, positive trajectory, projection past the bar. */

/* Still building, RI 58, below the bar. High variance (sigma 13), thin
   coverage (3/8 round types), composure runs hot, negotiation leaks. The
   same surface, with empty/sparse states where the sample is too small,
   turns "not ready" into a concrete, evidenced to-do list. */

/* Pillar drill-down — the "open any pillar, see its evidence" surface,
   generalized to all five pillars. Composure expanded into its delivery
   drivers against interviewer-comfort bands, with hold/fix narration and
   the attention timeline alongside. */

/* Mobile portrait — the ready state reflowed to a single 402px column,
   pinned RI header retained, range scrubber inline. */

export default function ReadinessIndexAnalyticsCanvas() {
  return (
    <Canvas name="Readiness Index Analytics">
      <Storyboard
        id="ReadyState"
        name="1. Interview-ready candidate — full analytics"
        component={ReadinessIndex}
        props={{ variant: "ready" }}
        layout={{ x: 0, y: 0, width: 1280, height: 6000 }}
      />
      <Storyboard
        id="BuildingState"
        name="2. Still building — gaps surfaced"
        component={ReadinessIndex}
        props={{ variant: "building" }}
        layout={{ x: 1330, y: 0, width: 1280, height: 6000 }}
      />
      <Storyboard
        id="PillarDrilldown"
        name="3. Pillar drill-down — Composure"
        component={ReadinessIndex}
        props={{ variant: "drilldown" }}
        layout={{ x: 1330, y: 6080, width: 1280, height: 1560 }}
      />
      <Storyboard
        id="MobileReady"
        name="4. Mobile — ready"
        component={ReadinessIndex}
        props={{ variant: "mobile" }}
        layout={{ x: 0, y: 6080, width: 402, height: 9800 }}
      />
    </Canvas>
  );
}
