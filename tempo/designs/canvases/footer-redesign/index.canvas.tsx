import type { TempoPage, TempoStoryboard } from 'tempo-sdk';
import FooterDome from './FooterDome';

const page: TempoPage = {
  name: "Footer Redesign",
};

export default page;

export const FooterDomeScreen: TempoStoryboard = {
  render: () => <FooterDome />,
  name: "Footer — Dome 1728",
  layout: { x: 0, y: 0, width: 1728, height: 460 },
};
