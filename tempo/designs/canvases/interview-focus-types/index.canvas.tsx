import type { TempoPage, TempoStoryboard } from 'tempo-sdk';
import { DesktopCurrent } from './InterviewFocusDesign';
import { MobileCurrent } from './InterviewFocusDesign';
import { HeadingOptions } from './InterviewFocusDesign';
import { DesktopRedesign } from './InterviewFocusDesign';

const page: TempoPage = {
  name: "Interview Focus Types — Section Design",
};

export default page;

export const Desktop: TempoStoryboard = {
  render: () => <DesktopCurrent />,
  name: "Live Production — Desktop 1440",
  layout: { x: 0, y: 0, width: 1440, height: 894 },
};

export const Mobile: TempoStoryboard = {
  render: () => <MobileCurrent />,
  name: "Live Production — Mobile 390",
  layout: { x: 1490, y: 0, width: 390, height: 1194 },
};

export const Headings: TempoStoryboard = {
  render: () => <HeadingOptions />,
  name: "Copy Research Board — Shipped 2026-06-25",
  layout: { x: 0, y: 920, width: 1440, height: 838 },
};

export const Redesign: TempoStoryboard = {
  render: () => <DesktopRedesign />,
  name: "Icon Grid v2 — Redesign Proposal (hover to animate)",
  layout: { x: 0, y: 1900, width: 1440, height: 940 },
};
