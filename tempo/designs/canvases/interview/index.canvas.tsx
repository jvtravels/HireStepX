/* HireStepX — Interview canvas / index
   Voice-first AI interview screen across all of its lifecycle states.
   One Interview.tsx, props-driven. Each storyboard exercises a distinct
   moment so the team (and Chromatic) can review the system as a whole.

   Layout grid: 4 columns × 4 rows, each tile 1440×1024 with a 50px gutter.
   Coordinates are inlined as literals (not computed) so Tempo's static
   discovery analyzer parses them at build time. */

import CanvasProviders from "../../../CanvasProviders";
import Interview from "./Interview";
import Reconnecting from "./Reconnecting";
import SessionSetup from "./SessionSetup";
import { Canvas, Storyboard } from "tempo-sdk/canvas";

/* ─── Row 1 — happy path lifecycle ─────────────────────────────────── */

const AISpeakingScreen = () => (
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
  );

const YourTurnScreen = () => (
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
  );

const YouSpeakingScreen = () => (
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
  );

const AIThinkingScreen = () => (
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
  );

/* ─── Row 2 — alternate inputs + interrupt states ──────────────────── */

const TypingModeScreen = () => (
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
  );

const PausedScreen = () => (
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
  );

const ConnectionWarningScreen = () => (
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
  );

const EndConfirmScreen = () => (
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
  );

/* ─── Row 3 — edge moments ─────────────────────────────────────────── */

const FirstQuestionScreen = () => (
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
  );

const FinalQuestionScreen = () => (
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
  );

const LongQuestionScreen = () => (
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
  );

const FairConnectionScreen = () => (
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
  );

/* ─── Row 4 — camera-on + alternate role contexts ──────────────────── */

const CameraOnScreen = () => (
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
  );

const TechnicalRoundScreen = () => (
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
  );

const FresherCampusScreen = () => (
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
  );

const NegotiationScreen = () => (
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
  );

/* ─── Row 5 — recovery + auto-save ────────────────────────────────── */

const ReconnectingScreen = () => (
    <CanvasProviders>
      <Reconnecting attempt={2} question={{ current: 3, total: 5 }} />
    </CanvasProviders>
  );

const SaveToastScreen = () => (
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
  );

const LiveTranscriptScreen = () => (
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
  );

const MicQuietScreen = () => (
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
  );

const InlineFeedbackScreen = () => (
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
  );

const MutedScreen = () => (
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
  );

/* ─── Row 6 (cont.) + Row 7 — Session Setup (pre-interview) ─────────────
   Single-page progressive form. Each storyboard shows a different
   moment a user might land on so the team can review states side by side.
   Industry patterns baked in: smart defaults, "Recommended" social proof,
   resume-aware pre-fill, recent quick-picks, real autocomplete with
   keyboard hints, validation, and a mobile pass. */

const SetupEmpty = () => (
    <CanvasProviders>
      <SessionSetup />
    </CanvasProviders>
  );

const SetupFilled = () => (
    <CanvasProviders>
      <SessionSetup
        role="Frontend Developer"
        company="Google"
        focus="technical"
      />
    </CanvasProviders>
  );

const SetupReturningUser = () => (
    <CanvasProviders>
      <SessionSetup
        role="Product Manager"
        company="Flipkart"
        focus="behavioral"
        showResumeBanner
        showRecent
        userName="Priya Kumar"
      />
    </CanvasProviders>
  );

const SetupCompanyAutocomplete = () => (
    <CanvasProviders>
      <SessionSetup
        role="Software Engineer"
        company="G"
        focus="system-design"
        showCompanyAutocomplete
      />
    </CanvasProviders>
  );

const SetupValidationErrors = () => (
    <CanvasProviders>
      <SessionSetup
        role=""
        company=""
        showErrors
      />
    </CanvasProviders>
  );

const SetupMobile = () => (
    <CanvasProviders>
      <SessionSetup
        role="SDE-2"
        company="Razorpay"
        focus="system-design"
        compact
      />
    </CanvasProviders>
  );

export default function InterviewCanvas() {
  return (
    <Canvas name="Interview">
      <Storyboard
        id="AISpeakingScreen"
        name="1. AI is asking the question"
        component={AISpeakingScreen}
        layout={{ x: 0, y: 0, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="YourTurnScreen"
        name="2. Your turn (idle, ready)"
        component={YourTurnScreen}
        layout={{ x: 1490, y: 0, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="YouSpeakingScreen"
        name="3. You are answering (mic hot)"
        component={YouSpeakingScreen}
        layout={{ x: 2980, y: 0, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="AIThinkingScreen"
        name="4. AI is thinking"
        component={AIThinkingScreen}
        layout={{ x: 4470, y: 0, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="TypingModeScreen"
        name="5. Typing mode (keyboard fallback)"
        component={TypingModeScreen}
        layout={{ x: 0, y: 1074, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="PausedScreen"
        name="6. Paused"
        component={PausedScreen}
        layout={{ x: 1490, y: 1074, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ConnectionWarningScreen"
        name="7. Connection unstable"
        component={ConnectionWarningScreen}
        layout={{ x: 2980, y: 1074, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="EndConfirmScreen"
        name="8. End-confirm overlay"
        component={EndConfirmScreen}
        layout={{ x: 4470, y: 1074, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="FirstQuestionScreen"
        name="9. Q1 — warmup framing"
        component={FirstQuestionScreen}
        layout={{ x: 0, y: 2148, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="FinalQuestionScreen"
        name="10. Q5 — final question"
        component={FinalQuestionScreen}
        layout={{ x: 1490, y: 2148, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="LongQuestionScreen"
        name="11. Long question (text wrap stress test)"
        component={LongQuestionScreen}
        layout={{ x: 2980, y: 2148, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="FairConnectionScreen"
        name="12. Connection fair (subtle chip)"
        component={FairConnectionScreen}
        layout={{ x: 4470, y: 2148, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="CameraOnScreen"
        name="13. Camera on (self-view tile)"
        component={CameraOnScreen}
        layout={{ x: 0, y: 3222, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="TechnicalRoundScreen"
        name="14. Technical round — Google SDE"
        component={TechnicalRoundScreen}
        layout={{ x: 1490, y: 3222, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="FresherCampusScreen"
        name="15. Fresher · TCS campus placement"
        component={FresherCampusScreen}
        layout={{ x: 2980, y: 3222, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="NegotiationScreen"
        name="16. Salary negotiation · Razorpay"
        component={NegotiationScreen}
        layout={{ x: 4470, y: 3222, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ReconnectingScreen"
        name="17. Reconnecting (network dropped)"
        component={ReconnectingScreen}
        layout={{ x: 0, y: 4296, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="SaveToastScreen"
        name="18. Auto-save toast confirmation"
        component={SaveToastScreen}
        layout={{ x: 1490, y: 4296, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="LiveTranscriptScreen"
        name="19. You speaking — live transcript + pace"
        component={LiveTranscriptScreen}
        layout={{ x: 2980, y: 4296, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="MicQuietScreen"
        name="20. Mic-quiet warning during answer"
        component={MicQuietScreen}
        layout={{ x: 4470, y: 4296, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="InlineFeedbackScreen"
        name="21. Inline mini-feedback between questions"
        component={InlineFeedbackScreen}
        layout={{ x: 0, y: 5370, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="MutedScreen"
        name="22. Mic temporarily muted (cough/water break)"
        component={MutedScreen}
        layout={{ x: 1490, y: 5370, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="SetupEmpty"
        name="23. Setup — first touch (empty)"
        component={SetupEmpty}
        layout={{ x: 2980, y: 5370, width: 1440, height: 1280 }}
      />
      <Storyboard
        id="SetupFilled"
        name="24. Setup — filled, happy path"
        component={SetupFilled}
        layout={{ x: 4470, y: 5370, width: 1440, height: 1380 }}
      />
      <Storyboard
        id="SetupReturningUser"
        name="25. Setup — returning user (resume + recent)"
        component={SetupReturningUser}
        layout={{ x: 0, y: 6750, width: 1440, height: 1480 }}
      />
      <Storyboard
        id="SetupCompanyAutocomplete"
        name="26. Setup — company autocomplete open"
        component={SetupCompanyAutocomplete}
        layout={{ x: 1490, y: 6750, width: 1440, height: 1380 }}
      />
      <Storyboard
        id="SetupValidationErrors"
        name="27. Setup — validation errors"
        component={SetupValidationErrors}
        layout={{ x: 2980, y: 6750, width: 1440, height: 1080 }}
      />
      <Storyboard
        id="SetupMobile"
        name="28. Setup — mobile (narrow viewport)"
        component={SetupMobile}
        layout={{ x: 4470, y: 6750, width: 480, height: 1620 }}
      />
    </Canvas>
  );
}
