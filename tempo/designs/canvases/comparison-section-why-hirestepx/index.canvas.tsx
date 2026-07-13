import type { TempoPage, TempoStoryboard, TempoRouteStoryboard } from 'tempo-sdk';
import { ComparisonDesktop } from './ComparisonDesign';
import { ComparisonMobile } from './ComparisonDesign';

const page: TempoPage = {
  name: "Comparison Section — Why HireStepX",
};

export default page;

export const Desktop: TempoStoryboard = {
  render: () => <ComparisonDesktop />,
  name: "Comparison — Desktop 1440",
  layout: { x: 0, y: 0, width: 1440, height: 960 },
};

export const Mobile: TempoStoryboard = {
  render: () => <ComparisonMobile />,
  name: "Comparison — Mobile 390",
  layout: { x: 1490, y: 0, width: 390, height: 825 },
};
