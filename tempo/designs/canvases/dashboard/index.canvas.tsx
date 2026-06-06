/* HireStepX — Dashboard canvas / index
   Post-onboarding home screen. Five storyboards exercise distinct
   moments: returning user (default), new user empty state, power
   user mid-journey (Phase-2 hint), interview-imminent (3-day
   countdown rebalances the whole dashboard around urgency), and
   loading skeleton.

   Layout: 1440×1024 storyboards arranged in a vertical stack
   (returning + empty side-by-side at top, then power-user, imminent,
   skeleton stacked). Coordinates are inlined as literals so Tempo's
   static AST discovery picks them up at build. */
import type { TempoPage, TempoStoryboard } from 'tempo-sdk';
import CanvasProviders from '../../../CanvasProviders';
import Dashboard from './Dashboard';

const page: TempoPage = {
  name: "Dashboard",
};

export default page;

/* Returning user — Arjun, 7-day streak, +12 pts vs last week, focus:
   answer-structure. Most common state. */
export const DefaultReturningUser: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Dashboard variant="returning" userName="Arjun" greetingHour={9} />
    </CanvasProviders>
  ),
  name: "1. Returning user — mid-flow",
  layout: { x: 0, y: 0, width: 1728, height: 1060 },
};

/* Empty state — brand-new user, 0 sessions. Hero matches Setup
   canvas's "Let's get you ready" voice; right rail collapses to a
   "your sessions start here" placeholder; streak card suppressed. */
export const NewUserEmpty: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Dashboard variant="empty" userName="Priya" greetingHour={14} />
    </CanvasProviders>
  ),
  name: "2. New user — empty state",
  layout: { x: 1778, y: 0, width: 1728, height: 1060 },
};

/* Power user — active multi-round Google FAANG journey: 6 rounds, 2
   passed, 1 next, 3 locked. 14-day streak, top 6%, behavioural
   coverage 10/10. Previews the Aug-2026 Phase-2 surface inside
   today's dashboard shell. Includes daily-goal ribbon (2/2 sessions),
   skill radar with all axes filled, contribution graph at intense
   profile, and 5/6 achievements earned. */
export const PowerUserActiveJourney: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Dashboard variant="power-user" userName="Sneha" greetingHour={19} />
    </CanvasProviders>
  ),
  name: "3. Power user — active journey",
  layout: { x: 0, y: 1110, width: 1728, height: 1060 },
};

/* Interview-imminent — 3 days to a Razorpay senior PM round. The
   entire dashboard rebalances around urgency: countdown pill takes
   the prime header slot, focus area auto-targets the highest-leverage
   gap before the date, daily goal pivots to "2 sessions / 90 min /
   3 weak-spots reviewed", coach insight is interview-specific. */
export const InterviewImminent: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Dashboard variant="interview-imminent" userName="Rohan" greetingHour={10} />
    </CanvasProviders>
  ),
  name: "4. Interview-imminent — 3-day countdown",
  layout: { x: 0, y: 2220, width: 1728, height: 1060 },
};

/* Loading skeleton — zero-CLS placeholder matching the final layout
   exactly. Sidebar skeleton, hero skeleton, KPI row skeleton, focus
   skeleton, right-rail skeleton. Production: rendered while the
   /api/dashboard fetch is in flight. */
export const LoadingSkeleton: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Dashboard variant="loading" userName="Arjun" />
    </CanvasProviders>
  ),
  name: "5. Loading skeleton",
  layout: { x: 0, y: 3330, width: 1728, height: 1060 },
};

/* Mobile portrait — 390×844 phone composition. Top app bar, single-
   column stage, fixed bottom tab bar. Hero compresses to 24pt serif,
   KPI tiles stack instead of row, daily-goal ribbon hidden in favour
   of a compact streak strip. */
export const MobilePortrait: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Dashboard variant="mobile" userName="Arjun" greetingHour={9} />
    </CanvasProviders>
  ),
  name: "6. Mobile portrait",
  layout: { x: 0, y: 4440, width: 390, height: 844 },
};

/* Command palette overlay — Linear-style ⌘K dialog over the dimmed
   dashboard. Three sections (Quick actions, Jump to, Recent
   sessions), keyboard shortcuts on each row, search input pre-filled
   "razor", focused row "Start an interview journey". */
export const CommandPaletteOverlay: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Dashboard variant="command-palette" userName="Arjun" greetingHour={9} />
    </CanvasProviders>
  ),
  name: "7. Command palette (⌘K)",
  layout: { x: 0, y: 5334, width: 1728, height: 1060 },
};

/* Notifications panel — slide-in drawer from the bell icon. 5 items
   grouped by type (evaluation, milestone, coach, journey, system),
   2 unread at top with copper indicator dot, "Mark all read" + close
   actions, ago-time pills. */
export const NotificationsOpen: TempoStoryboard = {
  render: () => (
    <CanvasProviders>
      <Dashboard variant="notifications" userName="Arjun" greetingHour={9} />
    </CanvasProviders>
  ),
  name: "8. Notifications panel",
  layout: { x: 0, y: 6444, width: 1728, height: 1060 },
};
