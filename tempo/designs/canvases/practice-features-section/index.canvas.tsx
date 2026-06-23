import type { TempoPage, TempoStoryboard, TempoRouteStoryboard } from 'tempo-sdk';
import { PracticeFeatures } from './PracticeFeatures';

const page: TempoPage = {
  name: "Practice Features Section",
};

export default page;

export const PracticeFeaturesDesktop: TempoStoryboard = {
  render: () => <PracticeFeatures />,
  layout: { x: 0, y: 0, width: 1728, height: 1349 },
};
