import type { TempoPage, TempoStoryboard, TempoRouteStoryboard } from 'tempo-sdk';
import { HeroGapDesign } from './HeroGapDesign';
import { HeroGapDesignMobile } from './HeroGapDesign';

const page: TempoPage = {
  name: "Hero Section — The Gap",
};

export default page;

export const HeroDesktop: TempoStoryboard = {
  render: () => <HeroGapDesign />,
  name: "Hero — Desktop 1440",
  layout: { x: 0, y: 0, width: 1440, height: 900 },
};

export const HeroMobile: TempoStoryboard = {
  render: () => <HeroGapDesignMobile />,
  name: "Hero — Mobile 390",
  layout: { x: 1490, y: 0, width: 390, height: 920 },
};
