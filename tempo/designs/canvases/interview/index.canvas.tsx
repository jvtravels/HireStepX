/* HireStepX — Interview canvas / index
   Voice-first AI interview screen across all of its lifecycle states.
   One Interview.tsx, props-driven. Each storyboard exercises a distinct
   moment so the team (and Chromatic) can review the system as a whole.

   Layout grid: 4 columns × 4 rows, each tile 1440×1024 with a 50px gutter.
   Coordinates are inlined as literals (not computed) so Tempo's static
   discovery analyzer parses them at build time. */

import type { TempoPage, TempoStoryboard } from "tempo-sdk";
import CanvasProviders from "../../../CanvasProviders";
import Interview from "./Interview";
import Reconnecting from "./Reconnecting";

const page: TempoPage = {
  name: "Interview",
};

export default page;

/* ─── Row 1 — happy path lifecycle ─────────────────────────────────── */

export const AISpeakingScreen: TempoStoryboard = {
  name: "1. AI is asking the question",
  render: () => (
    <CanvasProviders>
      <Interview
        state="ai-speaking"
        question={{
          before: "Tell me about a",
          accent: "time",
          after: "you led without authority",
        }}
        caption="Walk me through what happened — the people involved, the friction, and how you brought everyone on board."
        persona="Maya"
        current={3}
        total={5}
        elapsedSec={154}
        exchanges={3}
        status="good"
        context={{ role: "Product Manager", company: "Flipkart", focus: "Behavioral" }}
      />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 0, width: 1440, height: 1024 },
};

export const YourTurnScreen: TempoStoryboard = {
  name: "2. Your turn (idle, ready)",
  render: () => (
    <CanvasProviders>
      <Interview
        state="your-turn"
        question={{
          before: "Tell me about a",
          accent: "time",
          after: "you led without authority",
        }}
        hint="Lead with the result. Then tell the story."
        persona="Maya"
        current={3}
        total={5}
        elapsedSec={158}
        exchanges={3}
        status="good"
        context={{ role: "Product Manager", company: "Flipkart", focus: "Behavioral" }}
      />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 0, width: 1440, height: 1024 },
};

export const YouSpeakingScreen: TempoStoryboard = {
  name: "3. You are answering (mic hot)",
  render: () => (
    <CanvasProviders>
      <Interview
        state="you-speaking"
        question={{
          before: "Tell me about a",
          accent: "time",
          after: "you led without authority",
        }}
        caption="So at my last role, I was the only frontend person on a team of four backend engineers, and we needed to ship a payments rewrite in six weeks…"
        hint="Don't rush. Pauses are fine."
        persona="Maya"
        current={3}
        total={5}
        elapsedSec={172}
        exchanges={3}
        status="good"
        context={{ role: "Product Manager", company: "Flipkart", focus: "Behavioral" }}
      />
    </CanvasProviders>
  ),
  layout: { x: 2980, y: 0, width: 1440, height: 1024 },
};

export const AIThinkingScreen: TempoStoryboard = {
  name: "4. AI is thinking",
  render: () => (
    <CanvasProviders>
      <Interview
        state="ai-thinking"
        question={{
          before: "Tell me about a",
          accent: "time",
          after: "you led without authority",
        }}
        caption="Considering your answer…"
        persona="Maya"
        current={3}
        total={5}
        elapsedSec={206}
        exchanges={4}
        status="good"
        context={{ role: "Product Manager", company: "Flipkart", focus: "Behavioral" }}
      />
    </CanvasProviders>
  ),
  layout: { x: 4470, y: 0, width: 1440, height: 1024 },
};

/* ─── Row 2 — alternate inputs + interrupt states ──────────────────── */

export const TypingModeScreen: TempoStoryboard = {
  name: "5. Typing mode (keyboard fallback)",
  render: () => (
    <CanvasProviders>
      <Interview
        state="typing-mode"
        question={{
          before: "Tell me about a",
          accent: "time",
          after: "you led without authority",
        }}
        persona="Maya"
        current={3}
        total={5}
        elapsedSec={188}
        exchanges={3}
        status="good"
        context={{ role: "Product Manager", company: "Flipkart", focus: "Behavioral" }}
        typedAnswer="Last year I led the migration from a Rails monolith to a service-oriented architecture. I wasn't the tech lead, but"
      />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 1074, width: 1440, height: 1024 },
};

export const PausedScreen: TempoStoryboard = {
  name: "6. Paused",
  render: () => (
    <CanvasProviders>
      <Interview
        state="paused"
        question={{
          before: "Tell me about a",
          accent: "time",
          after: "you led without authority",
        }}
        persona="Maya"
        current={3}
        total={5}
        elapsedSec={154}
        exchanges={3}
        status="good"
        context={{ role: "Product Manager", company: "Flipkart", focus: "Behavioral" }}
      />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 1074, width: 1440, height: 1024 },
};

export const ConnectionWarningScreen: TempoStoryboard = {
  name: "7. Connection unstable",
  render: () => (
    <CanvasProviders>
      <Interview
        state="connection-warning"
        question={{
          before: "Tell me about a",
          accent: "time",
          after: "you led without authority",
        }}
        persona="Maya"
        current={3}
        total={5}
        elapsedSec={154}
        exchanges={3}
        status="poor"
        context={{ role: "Product Manager", company: "Flipkart", focus: "Behavioral" }}
      />
    </CanvasProviders>
  ),
  layout: { x: 2980, y: 1074, width: 1440, height: 1024 },
};

export const EndConfirmScreen: TempoStoryboard = {
  name: "8. End-confirm overlay",
  render: () => (
    <CanvasProviders>
      <Interview
        state="end-confirm"
        question={{
          before: "Tell me about a",
          accent: "time",
          after: "you led without authority",
        }}
        persona="Maya"
        current={3}
        total={5}
        elapsedSec={188}
        exchanges={3}
        status="good"
        context={{ role: "Product Manager", company: "Flipkart", focus: "Behavioral" }}
      />
    </CanvasProviders>
  ),
  layout: { x: 4470, y: 1074, width: 1440, height: 1024 },
};

/* ─── Row 3 — edge moments ─────────────────────────────────────────── */

export const FirstQuestionScreen: TempoStoryboard = {
  name: "9. Q1 — warmup framing",
  render: () => (
    <CanvasProviders>
      <Interview
        state="ai-speaking"
        question={{
          before: "Let’s start",
          accent: "easy",
          after: "— walk me through your resume",
        }}
        caption="Take it from your most recent role and work backwards. Skip what doesn't matter."
        persona="Maya"
        current={1}
        total={5}
        elapsedSec={12}
        exchanges={0}
        status="good"
        context={{ role: "Product Manager", company: "Flipkart", focus: "Behavioral" }}
      />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 2148, width: 1440, height: 1024 },
};

export const FinalQuestionScreen: TempoStoryboard = {
  name: "10. Q5 — final question",
  render: () => (
    <CanvasProviders>
      <Interview
        state="your-turn"
        question={{
          before: "Last one —",
          accent: "why",
          after: "this company, and why now",
        }}
        hint="Specific is stronger than rehearsed. Mention something only you would notice."
        persona="Maya"
        current={5}
        total={5}
        elapsedSec={1322}
        exchanges={9}
        status="good"
        context={{ role: "Product Manager", company: "Flipkart", focus: "Behavioral" }}
      />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 2148, width: 1440, height: 1024 },
};

export const LongQuestionScreen: TempoStoryboard = {
  name: "11. Long question (text wrap stress test)",
  render: () => (
    <CanvasProviders>
      <Interview
        state="ai-speaking"
        question={{
          before: "Walk me through a project where you had to",
          accent: "convince",
          after: "a senior leader who initially disagreed with your approach",
        }}
        caption="I want the full arc — what their objection was, how you reframed it, what data or story shifted them, and what you learned about persuading up."
        persona="Maya"
        current={4}
        total={5}
        elapsedSec={742}
        exchanges={6}
        status="fair"
        context={{ role: "Product Manager", company: "Flipkart", focus: "Behavioral" }}
      />
    </CanvasProviders>
  ),
  layout: { x: 2980, y: 2148, width: 1440, height: 1024 },
};

export const FairConnectionScreen: TempoStoryboard = {
  name: "12. Connection fair (subtle chip)",
  render: () => (
    <CanvasProviders>
      <Interview
        state="your-turn"
        question={{
          before: "Tell me about a",
          accent: "decision",
          after: "you regret making at work",
        }}
        hint="Real ones land best. Don't pick a humble-brag."
        persona="Maya"
        current={2}
        total={5}
        elapsedSec={94}
        exchanges={1}
        status="fair"
        context={{ role: "Product Manager", company: "Flipkart", focus: "Behavioral" }}
      />
    </CanvasProviders>
  ),
  layout: { x: 4470, y: 2148, width: 1440, height: 1024 },
};

/* ─── Row 4 — camera-on + alternate role contexts ──────────────────── */

export const CameraOnScreen: TempoStoryboard = {
  name: "13. Camera on (self-view tile)",
  render: () => (
    <CanvasProviders>
      <Interview
        state="your-turn"
        question={{
          before: "How would you",
          accent: "size",
          after: "the market for groceries delivery in India",
        }}
        hint="Start with the user, not the TAM number."
        persona="Maya"
        current={2}
        total={5}
        elapsedSec={84}
        exchanges={1}
        status="good"
        context={{ role: "Product Manager", company: "Flipkart", focus: "Case study" }}
        cameraOn
      />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 3222, width: 1440, height: 1024 },
};

export const TechnicalRoundScreen: TempoStoryboard = {
  name: "14. Technical round — Google SDE",
  render: () => (
    <CanvasProviders>
      <Interview
        state="ai-speaking"
        question={{
          before: "Design a",
          accent: "rate-limiter",
          after: "for an API serving 100k req/sec",
        }}
        caption="Walk me through your high-level approach first. We can dig into the data structure choices after."
        persona="Maya"
        current={3}
        total={5}
        elapsedSec={420}
        exchanges={3}
        status="good"
        context={{ role: "SDE-2", company: "Google", focus: "System design" }}
      />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 3222, width: 1440, height: 1024 },
};

export const FresherCampusScreen: TempoStoryboard = {
  name: "15. Fresher · TCS campus placement",
  render: () => (
    <CanvasProviders>
      <Interview
        state="your-turn"
        question={{
          before: "Why",
          accent: "TCS",
          after: "and why this role",
        }}
        hint="Specific is stronger than rehearsed."
        persona="Maya"
        current={1}
        total={3}
        elapsedSec={28}
        exchanges={0}
        status="good"
        context={{ role: "Graduate Trainee", company: "TCS", focus: "Campus HR" }}
      />
    </CanvasProviders>
  ),
  layout: { x: 2980, y: 3222, width: 1440, height: 1024 },
};

export const NegotiationScreen: TempoStoryboard = {
  name: "16. Salary negotiation · Razorpay",
  render: () => (
    <CanvasProviders>
      <Interview
        state="ai-speaking"
        question={{
          before: "We can offer ₹28 LPA — is that",
          accent: "workable",
          after: "for you",
        }}
        caption="That's at the top of our band for this level. Help me understand your expectations."
        persona="Maya"
        current={4}
        total={5}
        elapsedSec={612}
        exchanges={5}
        status="good"
        context={{ role: "Senior Engineer", company: "Razorpay", focus: "Negotiation" }}
        cameraOn
      />
    </CanvasProviders>
  ),
  layout: { x: 4470, y: 3222, width: 1440, height: 1024 },
};

/* ─── Row 5 — recovery + auto-save ────────────────────────────────── */

export const ReconnectingScreen: TempoStoryboard = {
  name: "17. Reconnecting (network dropped)",
  render: () => (
    <CanvasProviders>
      <Reconnecting attempt={2} question={{ current: 3, total: 5 }} />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 4296, width: 1440, height: 1024 },
};

export const SaveToastScreen: TempoStoryboard = {
  name: "18. Auto-save toast confirmation",
  render: () => (
    <CanvasProviders>
      <Interview
        state="ai-thinking"
        question={{
          before: "Tell me about a",
          accent: "time",
          after: "you led without authority",
        }}
        caption="Considering your answer…"
        persona="Maya"
        current={3}
        total={5}
        elapsedSec={208}
        exchanges={4}
        status="good"
        showSaveToast
      />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 4296, width: 1440, height: 1024 },
};

export const LiveTranscriptScreen: TempoStoryboard = {
  name: "19. You speaking — live transcript + pace",
  render: () => (
    <CanvasProviders>
      <Interview
        state="you-speaking"
        question={{
          before: "Tell me about a",
          accent: "time",
          after: "you led without authority",
        }}
        persona="Maya"
        current={3}
        total={5}
        elapsedSec={222}
        exchanges={3}
        status="good"
        transcript={{
          text: "So at my last role, I was the only frontend engineer on a team of four backend folks, and we had six weeks to ship a payments rewrite",
          interim: "before our SOC-2 audit",
        }}
        showPace
      />
    </CanvasProviders>
  ),
  layout: { x: 2980, y: 4296, width: 1440, height: 1024 },
};

export const MicQuietScreen: TempoStoryboard = {
  name: "20. Mic-quiet warning during answer",
  render: () => (
    <CanvasProviders>
      <Interview
        state="you-speaking"
        question={{
          before: "Tell me about a",
          accent: "time",
          after: "you led without authority",
        }}
        persona="Maya"
        current={3}
        total={5}
        elapsedSec={195}
        exchanges={3}
        status="good"
        transcript={{ text: "" , interim: "" }}
        showPace
        micQuiet
      />
    </CanvasProviders>
  ),
  layout: { x: 4470, y: 4296, width: 1440, height: 1024 },
};

export const InlineFeedbackScreen: TempoStoryboard = {
  name: "21. Inline mini-feedback between questions",
  render: () => (
    <CanvasProviders>
      <Interview
        state="your-turn"
        question={{
          before: "Now —",
          accent: "describe",
          after: "a time you disagreed with your manager",
        }}
        persona="Maya"
        current={4}
        total={5}
        elapsedSec={342}
        exchanges={5}
        status="good"
        inlineFeedback={{
          positives: ["Clear STAR structure", "Specific 40% metric"],
          improvements: ["1 filler word: \"basically\" ×4", "Cut 15 seconds"],
        }}
      />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 5370, width: 1440, height: 1024 },
};

export const MutedScreen: TempoStoryboard = {
  name: "22. Mic temporarily muted (cough/water break)",
  render: () => (
    <CanvasProviders>
      <Interview
        state="your-turn"
        question={{
          before: "Tell me about a",
          accent: "time",
          after: "you led without authority",
        }}
        hint="Take a sip — unmute when you're ready."
        persona="Maya"
        current={3}
        total={5}
        elapsedSec={166}
        exchanges={3}
        status="good"
        muted
      />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 5370, width: 1440, height: 1024 },
};
