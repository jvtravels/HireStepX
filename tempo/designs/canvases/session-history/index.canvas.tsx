/* Session History canvas.
   List / Detail / Empty come from the canvas-local SessionHistoryDesign.
   The Report storyboards reuse the deep result-page demos from the
   `interview-result-focus` canvas — same chrome, same depth, same data
   shape as the production result page — so the Sessions tab's "open
   report" lands a user on the full instrumented result, not a distilled
   summary. */
import type { TempoPage, TempoStoryboard } from 'tempo-sdk';
import SessionHistoryDesign, { ReportShellWrap } from './SessionHistoryDesign';
import {
  BehavioralStrongDemo,
  SystemDesignPartialDemo,
  SalaryNegStrongDemo,
} from '../interview-result-focus/Demos';

const page: TempoPage = {
  name: "Session History",
};

export default page;

export const ListAllSessions: TempoStoryboard = {
  render: () => <SessionHistoryDesign variant="list" />,
  name: "1. List — all sessions",
  layout: { x: 0, y: 0, width: 1440, height: 1180 },
};

export const SessionDetail: TempoStoryboard = {
  render: () => <SessionHistoryDesign variant="detail" />,
  name: "2. Detail — question by question",
  layout: { x: 1490, y: 0, width: 1440, height: 1400 },
};

/* Behavioral report — matches the top session in the list (Razorpay PM,
   Behavioral, 86). Renders the same full-depth report as the canonical
   `interview-result-focus` canvas: focus banner, headline metric, hero,
   STAR matrix, skill bars, per-question cards, coached model answer,
   next-move CTA. */
export const ShareableReport: TempoStoryboard = {
  render: () => (
    <ReportShellWrap sessionLabel="Behavioral · Razorpay PM">
      <BehavioralStrongDemo />
    </ReportShellWrap>
  ),
  name: "3. Report — Behavioral · Razorpay PM (86)",
  layout: { x: 0, y: 1450, width: 1440, height: 3000 },
};

/* System Design report — partial-credit case. Same depth, different
   focus chrome + per-question rubric (requirements skipped, capacity
   math gap). Mirrors the System Design row in the session list. */
export const SystemDesignReport: TempoStoryboard = {
  render: () => (
    <ReportShellWrap sessionLabel="System Design · Flipkart">
      <SystemDesignPartialDemo />
    </ReportShellWrap>
  ),
  name: "4. Report — System Design · Flipkart (62)",
  layout: { x: 1490, y: 1450, width: 1440, height: 3000 },
};

/* Salary negotiation report — full negotiation analytics: tier bucket,
   offer trajectory, in-hand take-home, anchor bracket, concession map,
   unasked levers, counter-offer letter draft. Mirrors the Salary Neg
   row in the session list. */
export const SalaryNegReport: TempoStoryboard = {
  render: () => (
    <ReportShellWrap sessionLabel="Salary Neg · Swiggy EM">
      <SalaryNegStrongDemo />
    </ReportShellWrap>
  ),
  name: "5. Report — Salary Neg · Swiggy EM (84)",
  layout: { x: 0, y: 4500, width: 1440, height: 3000 },
};

export const EmptyState: TempoStoryboard = {
  render: () => <SessionHistoryDesign variant="empty" />,
  name: "6. Empty state",
  layout: { x: 1490, y: 4500, width: 1440, height: 900 },
};
