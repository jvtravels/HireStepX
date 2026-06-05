import type { TempoPage, TempoStoryboard } from 'tempo-sdk';
import { VariantADiagnosticFirst } from './VariantADiagnosticFirst';
import { VariantBHeroFirst } from './VariantBHeroFirst';
import { VariantCSequencedScroll } from './VariantCSequencedScroll';

const page: TempoPage = {
  name: "Behavioral Interview Result",
};

export default page;

export const VariantA_DiagnosticFirst: TempoStoryboard = {
  render: () => <VariantADiagnosticFirst />,
  name: "A Diagnostic-first",
  layout: { x: 0, y: 0, width: 1280, height: 2400 },
};

export const VariantB_HeroFirst: TempoStoryboard = {
  render: () => <VariantBHeroFirst />,
  name: "B Hero-first",
  layout: { x: 1330, y: 0, width: 1280, height: 2400 },
};

export const VariantC_SequencedScroll: TempoStoryboard = {
  render: () => <VariantCSequencedScroll />,
  name: "C Sequenced scroll",
  layout: { x: 0, y: 2450, width: 760, height: 3200 },
};
