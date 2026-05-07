/* HireStepX — Dashboard canvas / index (v4 editorial redesign)
   Six storyboards exercise distinct moments of the new editorial
   composition. Magazine layout — single column, max-width 760,
   serif hero, single primary action per scroll, AI coach insight
   as a pullquote rather than a card.

   Variants: cover (returning), invitation (empty), countdown
   (interview-imminent), chapter (power-user / journey), skeleton,
   mobile.

   Layout: 1440×1024 storyboards arranged 2-up + 2-up + 1, plus a
   390×844 mobile beside the skeleton. Coordinates are inlined as
   literals so Tempo's static AST discovery picks them up at build. */
import type { TempoPage, TempoStoryboard } from 'tempo-sdk';
import CanvasProviders from '../../../CanvasProviders';
import Dashboard from './Dashboard';

const page: TempoPage = {
  name: "Dashboard",
};

export default page;

/* "The cover" — default returning user. Hero: "You're three sessions
   from the hire bar." Inline metric ribbon (no KPI tiles), single
   15-min focused action, AI coach pullquote, rhythm strip + recent
   sessions list. */
export const DefaultReturningUser: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Dashboard variant="returning" userName="Arjun" greetingHour={9} />
    </CanvasProviders>
  ),
  name: "1. The cover — returning user",
  layout: { x: 0, y: 0, width: 1440, height: 1024 },
};

/* "The invitation" — empty state. Hero: "Welcome, Priya. Let's
   begin." Single primary action, serif-numbered first-steps list. No
   ribbon, no spotlight (no data to spotlight yet). */
export const NewUserEmpty: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Dashboard variant="empty" userName="Priya" greetingHour={14} />
    </CanvasProviders>
  ),
  name: "2. The invitation — empty state",
  layout: { x: 1490, y: 0, width: 1440, height: 1024 },
};

/* "The countdown" — interview-imminent. Hero: "Three days. Use them
   well." Eyebrow includes "3 days to Razorpay" in copper. Action is
   a 30-min focused drill with a copper accent strip. 3-day calendar
   plan as the below-fold. */
export const InterviewCountdown: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Dashboard variant="interview-imminent" userName="Rohan" greetingHour={10} />
    </CanvasProviders>
  ),
  name: "3. The countdown — 3 days to interview",
  layout: { x: 0, y: 1074, width: 1440, height: 1024 },
};

/* "The chapter" — power user mid-journey. Hero: "Vikram is waiting
   at the system design round." Eyebrow shows "Day 4 of your Google
   FAANG loop". Round-by-round chapter list with Roman numerals,
   serif italic, status-coloured scores. */
export const PowerUserChapter: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Dashboard variant="power-user" userName="Sneha" greetingHour={19} />
    </CanvasProviders>
  ),
  name: "4. The chapter — active journey",
  layout: { x: 1490, y: 1074, width: 1440, height: 1024 },
};

/* Skeleton — zero-CLS placeholder matching the editorial v4 shape.
   Same eyebrow → hero → ribbon → action → spotlight rhythm, all
   shimmering. */
export const LoadingSkeleton: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Dashboard variant="loading" userName="Arjun" />
    </CanvasProviders>
  ),
  name: "5. Loading skeleton",
  layout: { x: 0, y: 2148, width: 1440, height: 1024 },
};

/* Mobile portrait — same editorial idea, single-column phone shape.
   Hero compresses to 38pt serif, ribbon stacks vertically, no
   action sub-meta (just the headline + Begin button). */
export const MobilePortrait: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Dashboard variant="mobile" userName="Arjun" greetingHour={9} />
    </CanvasProviders>
  ),
  name: "6. Mobile portrait",
  layout: { x: 1490, y: 2148, width: 390, height: 844 },
};
