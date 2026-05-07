import type { TempoPage, TempoStoryboard } from 'tempo-sdk';
import ResumeTab from './ResumeTab';
import ResumeTabEmpty from './ResumeTabEmpty';

const page: TempoPage = {
  name: "Resume",
};

export default page;

export const ResumeTabScreen: TempoStoryboard = {
  name: "Resume tab — populated",
  render: () => <ResumeTab />,
  layout: { x: 0, y: 0, width: 1440, height: 2600 },
};

export const ResumeTabEmptyScreen: TempoStoryboard = {
  name: "Resume tab — empty state",
  render: () => <ResumeTabEmpty />,
  layout: { x: 1490, y: 0, width: 1440, height: 1024 },
};

