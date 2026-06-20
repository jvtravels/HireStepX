import type { TempoPage, TempoStoryboard, TempoRouteStoryboard } from 'tempo-sdk';
import { HireStepXHero } from './_hero';

const page: TempoPage = {
  name: "Marketing Hero",
};

export default page;

export const HeroStoryboard: TempoStoryboard = {
  render: () => <HireStepXHero />,
  name: "1. Hero Section · 1728×1080 · Deepnote-inspired",
  layout: { x: 0, y: 0, width: 1728, height: 1080 },
};
