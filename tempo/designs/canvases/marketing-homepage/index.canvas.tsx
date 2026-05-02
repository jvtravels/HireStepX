import type { TempoPage, TempoStoryboard } from "tempo-sdk";
import CanvasProviders from "../../../CanvasProviders";
import Homepage, {
  HomepageHero,
  HomepagePinnedStory,
  HomepageIntentRouter,
  HomepageBento,
  HomepageCompanyPreview,
  HomepageComparison,
  HomepageFounder,
  HomepageTestimonials,
  HomepagePricing,
  HomepagePrivacy,
  HomepageFAQ,
  HomepageFinalPush,
} from "./Homepage";

const page: TempoPage = {
  name: "Marketing Homepage",
};

export default page;

/* Full-page render — left column. The page is tall; the canvas viewport
   scrolls inside the iframe so the pinned-story scrub still works. */
export const FullHomepage: TempoStoryboard = {
  name: "Full homepage (desktop)",
  render: () => (
    <CanvasProviders>
      <Homepage />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 0, width: 1440, height: 8800 },
};

/* Section-by-section storyboards — right column, top to bottom in
   reading order so a reviewer can scan the spine of the page. */
export const HeroSection: TempoStoryboard = {
  name: "Hero",
  render: () => (
    <CanvasProviders>
      <HomepageHero />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 0, width: 1440, height: 1024 },
};

export const PinnedStorySection: TempoStoryboard = {
  name: "Pinned story (4 acts)",
  render: () => (
    <CanvasProviders>
      <HomepagePinnedStory />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 1074, width: 1440, height: 1024 },
};

export const IntentRouterSection: TempoStoryboard = {
  name: "Intent router",
  render: () => (
    <CanvasProviders>
      <HomepageIntentRouter />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 2148, width: 1440, height: 700 },
};

export const BentoSection: TempoStoryboard = {
  name: "Bento — what you actually get",
  render: () => (
    <CanvasProviders>
      <HomepageBento />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 2898, width: 1440, height: 1180 },
};

export const CompanyPreviewSection: TempoStoryboard = {
  name: "Company-aware preview",
  render: () => (
    <CanvasProviders>
      <HomepageCompanyPreview />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 4128, width: 1440, height: 900 },
};

export const ComparisonSection: TempoStoryboard = {
  name: "Comparison band",
  render: () => (
    <CanvasProviders>
      <HomepageComparison />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 5078, width: 1440, height: 820 },
};

export const FounderSection: TempoStoryboard = {
  name: "Founder moment",
  render: () => (
    <CanvasProviders>
      <HomepageFounder />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 5948, width: 1440, height: 720 },
};

export const TestimonialsSection: TempoStoryboard = {
  name: "Testimonials + offer logos",
  render: () => (
    <CanvasProviders>
      <HomepageTestimonials />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 6718, width: 1440, height: 1100 },
};

export const PricingSection: TempoStoryboard = {
  name: "Pricing",
  render: () => (
    <CanvasProviders>
      <HomepagePricing />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 7868, width: 1440, height: 1100 },
};

export const PrivacySection: TempoStoryboard = {
  name: "Privacy band",
  render: () => (
    <CanvasProviders>
      <HomepagePrivacy />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 9018, width: 1440, height: 360 },
};

export const FAQSection: TempoStoryboard = {
  name: "FAQ",
  render: () => (
    <CanvasProviders>
      <HomepageFAQ />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 9428, width: 1440, height: 900 },
};

export const FinalPushSection: TempoStoryboard = {
  name: "Final push",
  render: () => (
    <CanvasProviders>
      <HomepageFinalPush />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 10378, width: 1440, height: 800 },
};
