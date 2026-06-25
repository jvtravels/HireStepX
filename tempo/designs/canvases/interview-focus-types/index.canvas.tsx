import type { TempoPage, TempoStoryboard } from 'tempo-sdk';
import { DesktopCurrent } from './InterviewFocusDesign';
import { MobileCurrent } from './InterviewFocusDesign';
import { HeadingOptions } from './InterviewFocusDesign';

const page: TempoPage = {
  name: "Interview Focus Types — Section Design",
};

export default page;

export const Desktop: TempoStoryboard = {
  render: () => <DesktopCurrent />,
  name: "Live Production — Desktop 1440",
  layout: { x: 0, y: 0, width: 1440, height: 860 },
};

export const Mobile: TempoStoryboard = {
  render: () => <MobileCurrent />,
  name: "Live Production — Mobile 390",
  layout: { x: 1490, y: 0, width: 390, height: 1020 },
};

export const Headings: TempoStoryboard = {
  render: () => <HeadingOptions />,
  name: "Copy Research Board — Shipped 2026-06-25",
  layout: { x: 0, y: 920, width: 1440, height: 660 },
};
