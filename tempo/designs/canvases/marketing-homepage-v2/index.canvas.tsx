import type { TempoPage, TempoStoryboard, TempoRouteStoryboard } from 'tempo-sdk';
import Homepagev2, {
  BuiltForIndiaV2,
  ChangelogTeaseV2,
  ComparisonV2,
  FAQV2,
  FeatureGridV2,
  FinalCTAFooterV2,
  HeroV2,
  InterviewFocusV2,
  LogoStripV2,
  NavV2,
  PricingV2,
  ProductStoryV2,
  SecurityComplianceV2,
  TestimonialsV2,
  TrustRowV2,
} from '../../../../src/marketing-v2/HomepageV2';

const page: TempoPage = {
  name: "Marketing Homepage v2",
};

export default page;

export const FullHomepageV2: TempoStoryboard = {
  render: () => <Homepagev2 />,
  name: "Full homepage (desktop)",
  layout: { x: -3313, y: -90, width: 1440, height: 8400 },
};

export const FullHomepageMobile: TempoStoryboard = {
  render: () => <Homepagev2 />,
  name: "Full homepage (mobile)",
  layout: { x: -1653, y: -90, width: 420, height: 9200 },
};

export const NavSection: TempoStoryboard = {
  render: () => <NavV2 />,
  name: "Nav",
  layout: { x: 1490, y: 0, width: 1440, height: 120 },
};

export const HeroSection: TempoStoryboard = {
  render: () => <HeroV2 />,
  name: "Hero",
  layout: { x: -4574, y: 11370, width: 1440, height: 657 },
};

export const LogoStripSection: TempoStoryboard = {
  render: () => <LogoStripV2 />,
  name: "Logo strip + stat",
  layout: { x: 4234, y: 8891, width: 1440, height: 559 },
};

export const ProductStorySection: TempoStoryboard = {
  render: () => <ProductStoryV2 />,
  name: "3-step product story",
  layout: { x: 4234, y: 10885, width: 1440, height: 1760 },
};

export const FeatureGridSection: TempoStoryboard = {
  render: () => <FeatureGridV2 />,
  name: "Feature grid",
  layout: { x: 2457, y: 8091, width: 1440, height: 1213 },
};

export const TestimonialsSection: TempoStoryboard = {
  render: () => <TestimonialsV2 />,
  name: "Testimonials",
  layout: { x: 2210, y: 10193, width: 1440, height: 974 },
};

export const PricingSection: TempoStoryboard = {
  render: () => <PricingV2 />,
  name: "Pricing",
  layout: { x: 2664, y: 12120, width: 1440, height: 1049 },
};

export const BuiltForIndiaSection: TempoStoryboard = {
  render: () => <BuiltForIndiaV2 />,
  name: "Built for India",
  layout: { x: 0, y: 12970, width: 100, height: 1204 },
};

export const SecurityComplianceSection: TempoStoryboard = {
  render: () => <SecurityComplianceV2 />,
  name: "Security & Compliance",
  layout: { x: -1653, y: 14607, width: 1440, height: 648 },
};

export const TrustRowSection: TempoStoryboard = {
  render: () => <TrustRowV2 />,
  name: "Trust row",
  layout: { x: 0, y: 13720, width: 1440, height: 93 },
};

export const ChangelogTeaseSection: TempoStoryboard = {
  render: () => <ChangelogTeaseV2 />,
  name: "Changelog tease",
  layout: { x: 1490, y: 170, width: 100, height: 377 },
};

export const ComparisonSection: TempoStoryboard = {
  render: () => <ComparisonV2 />,
  name: "Comparison vs ChatGPT / question banks",
  layout: { x: 1490, y: 360, width: 100, height: 1616 },
};

export const FAQSection: TempoStoryboard = {
  render: () => <FAQV2 />,
  name: "Pricing FAQ",
  layout: { x: 1490, y: 1310, width: 100, height: 2103 },
};


export const FinalCTAFooterSection: TempoStoryboard = {
  render: () => <FinalCTAFooterV2 />,
  name: "Final CTA + footer",
  layout: { x: 1944, y: 13813, width: 100, height: 1965 },
};

export const InterviewFocusSection: TempoStoryboard = {
  render: () => <InterviewFocusV2 />,
  name: "Interview focus (roles × companies)",
  layout: { x: 1490, y: 2260, width: 1440, height: 1046 },
};

export const LivePreviewRoute: TempoRouteStoryboard = {
  route: "/",
  name: "Live route preview",
  layout: { x: 0, y: 15060, width: 1440, height: 900 },
};
