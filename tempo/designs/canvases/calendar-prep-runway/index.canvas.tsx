import type { TempoPage, TempoStoryboard, TempoRouteStoryboard } from 'tempo-sdk';
import Calendarpreprunway, { PrepRunwayRail, SuggestRunwaySheet } from '../../../../src/CalendarPrepRunway';

const page: TempoPage = {
  name: "Calendar — Prep Runway",
};

export default page;

export const CalendarPage: TempoStoryboard = {
  render: () => <Calendarpreprunway />,
  name: "Calendar — full surface",
  layout: { x: 0, y: 0, width: 1340, height: 1040 },
};

export const RunwayRail: TempoStoryboard = {
  render: () => <PrepRunwayRail />,
  name: "Prep Runway rail",
  layout: { x: 1390, y: 0, width: 1160, height: 380 },
};

export const SuggestSheet: TempoStoryboard = {
  render: () => <SuggestRunwaySheet />,
  name: "Suggest-then-accept sheet",
  layout: { x: 0, y: 1090, width: 620, height: 540 },
};
