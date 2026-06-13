import type { TempoPage, TempoStoryboard, TempoRouteStoryboard } from 'tempo-sdk';
import { ReadinessIndex } from './ReadinessIndex';

const page: TempoPage = {
  name: "Readiness Index Analytics",
};

export default page;

/* Interview-ready, RI 74, above Razorpay's bar of 72. The complete
   analytics surface with a pinned RI header, wired range scrubber, sticky
   zone-nav rail, comparison frames (cohort + own baseline), session diff,
   per-pillar drill-to-evidence, attention timeline, follow-up prep, and
   coaching. Green band, positive trajectory, projection past the bar. */
export const ReadyState: TempoStoryboard = {
  render: () => <ReadinessIndex variant="ready" />,
  name: "1. Interview-ready candidate — full analytics",
  layout: { x: 0, y: 0, width: 1280, height: 6000 },
};

/* Still building, RI 58, below the bar. High variance (sigma 13), thin
   coverage (3/8 round types), composure runs hot, negotiation leaks. The
   same surface, with empty/sparse states where the sample is too small,
   turns "not ready" into a concrete, evidenced to-do list. */
export const BuildingState: TempoStoryboard = {
  render: () => <ReadinessIndex variant="building" />,
  name: "2. Still building — gaps surfaced",
  layout: { x: 1330, y: 0, width: 1280, height: 6000 },
};

/* Pillar drill-down — the "open any pillar, see its evidence" surface,
   generalized to all five pillars. Composure expanded into its delivery
   drivers against interviewer-comfort bands, with hold/fix narration and
   the attention timeline alongside. */
export const PillarDrilldown: TempoStoryboard = {
  render: () => <ReadinessIndex variant="drilldown" />,
  name: "3. Pillar drill-down — Composure",
  layout: { x: 1330, y: 6080, width: 1280, height: 1560 },
};

/* Mobile portrait — the ready state reflowed to a single 402px column,
   pinned RI header retained, range scrubber inline. */
export const MobileReady: TempoStoryboard = {
  render: () => <ReadinessIndex variant="mobile" />,
  name: "4. Mobile — ready",
  layout: { x: 0, y: 6080, width: 402, height: 9800 },
};
