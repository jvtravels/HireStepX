import type { TempoPage, TempoStoryboard, TempoRouteStoryboard } from 'tempo-sdk';
import { AboutV2 } from '../../../../src/marketing-v2/MarketingPagesV2';
import { ContactV2 } from '../../../../src/marketing-v2/MarketingPagesV2';
import { ForStudentsV2 } from '../../../../src/marketing-v2/MarketingPagesV2';
import { HowItWorksV2 } from '../../../../src/marketing-v2/MarketingPagesV2';
import { NotFoundV2 } from '../../../../src/marketing-v2/MarketingPagesV2';
import { PricingPageV2 } from '../../../../src/marketing-v2/MarketingPagesV2';
import { PrivacyV2 } from '../../../../src/marketing-v2/MarketingPagesV2';
import { RefundPolicyV2 } from '../../../../src/marketing-v2/MarketingPagesV2';
import { ServerErrorV2 } from '../../../../src/marketing-v2/MarketingPagesV2';
import { TermsV2 } from '../../../../src/marketing-v2/MarketingPagesV2';

const page: TempoPage = {
  name: "Marketing pages v2",
};

export default page;

export const PricingDesktop: TempoStoryboard = {
  render: () => <PricingPageV2 />,
  name: "Pricing — desktop",
  layout: { x: 0, y: 0, width: 1440, height: 5600 },
};

export const PricingMobile: TempoStoryboard = {
  render: () => <PricingPageV2 />,
  name: "Pricing — mobile",
  layout: { x: 1490, y: 0, width: 420, height: 6800 },
};

export const HowItWorksDesktop: TempoStoryboard = {
  render: () => <HowItWorksV2 />,
  name: "How it works — desktop",
  layout: { x: 0, y: 6850, width: 1440, height: 5200 },
};

export const HowItWorksMobile: TempoStoryboard = {
  render: () => <HowItWorksV2 />,
  name: "How it works — mobile",
  layout: { x: 1960, y: 0, width: 420, height: 6400 },
};

export const AboutDesktop: TempoStoryboard = {
  render: () => <AboutV2 />,
  name: "About — desktop",
  layout: { x: 0, y: 12100, width: 1440, height: 4000 },
};

export const AboutMobile: TempoStoryboard = {
  render: () => <AboutV2 />,
  name: "About — mobile",
  layout: { x: 2430, y: 0, width: 420, height: 5000 },
};

export const ContactDesktop: TempoStoryboard = {
  render: () => <ContactV2 />,
  name: "Contact — desktop",
  layout: { x: 0, y: 16150, width: 1440, height: 3800 },
};

export const ContactMobile: TempoStoryboard = {
  render: () => <ContactV2 />,
  name: "Contact — mobile",
  layout: { x: 0, y: 20000, width: 420, height: 4600 },
};

export const ForStudentsDesktop: TempoStoryboard = {
  render: () => <ForStudentsV2 />,
  name: "For students — desktop",
  layout: { x: 0, y: 24650, width: 1440, height: 4400 },
};

export const ForStudentsMobile: TempoStoryboard = {
  render: () => <ForStudentsV2 />,
  name: "For students — mobile",
  layout: { x: 0, y: 29100, width: 420, height: 5400 },
};

export const NotFoundDesktop: TempoStoryboard = {
  render: () => <NotFoundV2 />,
  name: "404 — desktop",
  layout: { x: 0, y: 53350, width: 1440, height: 1800 },
};

export const NotFoundMobile: TempoStoryboard = {
  render: () => <NotFoundV2 />,
  name: "404 — mobile",
  layout: { x: 0, y: 55200, width: 420, height: 2200 },
};

export const ServerErrorDesktop: TempoStoryboard = {
  render: () => <ServerErrorV2 />,
  name: "500 — desktop",
  layout: { x: 0, y: 57450, width: 1440, height: 1800 },
};

export const ServerErrorMobile: TempoStoryboard = {
  render: () => <ServerErrorV2 />,
  name: "500 — mobile",
  layout: { x: 0, y: 59300, width: 420, height: 2200 },
};

export const PrivacyDesktop: TempoStoryboard = {
  render: () => <PrivacyV2 />,
  name: "Privacy — desktop",
  layout: { x: 0, y: 61550, width: 1440, height: 3400 },
};

export const PrivacyMobile: TempoStoryboard = {
  render: () => <PrivacyV2 />,
  name: "Privacy — mobile",
  layout: { x: 0, y: 65000, width: 420, height: 4200 },
};

export const TermsDesktop: TempoStoryboard = {
  render: () => <TermsV2 />,
  name: "Terms — desktop",
  layout: { x: 0, y: 69250, width: 1440, height: 3400 },
};

export const TermsMobile: TempoStoryboard = {
  render: () => <TermsV2 />,
  name: "Terms — mobile",
  layout: { x: 0, y: 72700, width: 420, height: 4200 },
};

export const RefundDesktop: TempoStoryboard = {
  render: () => <RefundPolicyV2 />,
  name: "Refund policy — desktop",
  layout: { x: 0, y: 76950, width: 1440, height: 3000 },
};

export const RefundMobile: TempoStoryboard = {
  render: () => <RefundPolicyV2 />,
  name: "Refund policy — mobile",
  layout: { x: 0, y: 80000, width: 420, height: 3800 },
};

export const LivePricingRoute: TempoRouteStoryboard = {
  route: "/pricing",
  name: "Live route — /pricing",
  layout: { x: 0, y: 91550, width: 1440, height: 900 },
};
