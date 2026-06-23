import type { TempoPage, TempoStoryboard } from 'tempo-sdk';
import { FeatureBentoDesign, FeatureBentoDesignMobile } from './FeatureBentoDesign';

const page: TempoPage = {
  name: "Feature Bento Section",
};

export default page;

export const BentoDesktop: TempoStoryboard = {
  render: () => <FeatureBentoDesign />,
  name: "Bento — desktop 1440",
  layout: { x: 0, y: 0, width: 1440, height: 1403 },
};

export const BentoMobile: TempoStoryboard = {
  render: () => <FeatureBentoDesignMobile />,
  name: "Bento — mobile 390",
  layout: { x: 1490, y: 0, width: 390, height: 2296 },
};
