import CanvasProviders from "../../../CanvasProviders";
import ResumeUpload from "./ResumeUpload";
import ResumeAnalysing from "./ResumeAnalysing";
import ResumeReview from "./ResumeReview";
import { Canvas, Storyboard } from "tempo-sdk/canvas";

/* Onboarding — 3 logical stages of the same flow:
   1. Upload resume → 2. AI analyses it → 3. Review what AI understood */

/* ── Step 1 · Upload ───────────────────────────────────────────────────── */

const ResumeUploadScreen = () => (
    <CanvasProviders>
      <ResumeUpload name="Rahul" />
    </CanvasProviders>
  );

const ResumeUploadSelectedScreen = () => (
    <CanvasProviders>
      <ResumeUpload
        name="Rahul"
        initialFile={{ name: "Rahul_Sharma_Resume.pdf", sizeKb: 248 }}
      />
    </CanvasProviders>
  );

const ResumeUploadUploadingScreen = () => (
    <CanvasProviders>
      <ResumeUpload
        name="Rahul"
        initialFile={{ name: "Rahul_Sharma_Resume.pdf", sizeKb: 248 }}
        uploading
      />
    </CanvasProviders>
  );

const ResumeUploadErrorScreen = () => (
    <CanvasProviders>
      <ResumeUpload
        name="Rahul"
        error="Couldn't read that file. Try a PDF, DOC, or DOCX under 10 MB."
      />
    </CanvasProviders>
  );

/* ── Step 2 · AI analyses ──────────────────────────────────────────────── */

const ResumeAnalysingScreen = () => (
    <CanvasProviders>
      <ResumeAnalysing fileName="Rahul_Sharma_Resume.pdf" />
    </CanvasProviders>
  );

const ResumeAnalysingNearDoneScreen = () => (
    <CanvasProviders>
      <ResumeAnalysing
        fileName="Rahul_Sharma_Resume.pdf"
        initialStatus="Looking for patterns worth practising…"
        initialProgress={88}
      />
    </CanvasProviders>
  );

const ResumeAnalysingErrorScreen = () => (
    <CanvasProviders>
      <ResumeAnalysing
        fileName="Rahul_Sharma_Resume.pdf"
        error="The AI couldn't make sense of your file. It might be a scan or have an unusual layout."
      />
    </CanvasProviders>
  );

/* ── Step 3 · Review ───────────────────────────────────────────────────── */

const ResumeReviewScreen = () => (
    <CanvasProviders>
      <ResumeReview userName="Rahul Sharma" />
    </CanvasProviders>
  );

const ResumeReviewLowConfidenceScreen = () => (
    <CanvasProviders>
      <ResumeReview
        userName="Priya Patel"
        lowConfidence
        profile={{
          headline: "Frontend Engineer (early-career)",
          summary:
            "Less than two years out of college, currently shipping React UI at a small SaaS startup. Some signal of side-project ambition, but the resume is light on quantified outcomes — worth fleshing out before senior interviews.",
          yearsExperience: 1,
          seniorityLevel: "Junior",
          topSkills: ["JavaScript", "React", "Node", "TypeScript", "CSS"],
          keyAchievements: [
            "Built the marketing site redesign solo (Next.js + Vercel).",
          ],
          industries: ["B2B SaaS"],
          interviewStrengths: [
            "Curious learner — picks up new stacks quickly",
            "Strong on UI fundamentals (semantics, accessibility)",
          ],
          interviewGaps: [
            "Limited backend exposure — vulnerable to system-design rounds",
            "Few quantified outcomes in resume — practise impact stories",
            "No on-call / production-ownership experience yet",
          ],
          careerTrajectory:
            "Graduated CSE 2024 → joined Acme Corp as a Frontend Engineer. Promotion timeline TBD — target a mid-level role 18-24 months from now.",
          resumeScore: 54,
          improvements: [
            "Quantify the marketing site redesign — traffic? conversion?",
            "Add a one-line summary of role + scope at the top.",
          ],
        }}
        suggestedTracks={[
          "Frontend fundamentals",
          "Behavioural · early-career stories",
          "Junior system design",
        ]}
      />
    </CanvasProviders>
  );

const ResumeReviewParseFailedScreen = () => (
    <CanvasProviders>
      <ResumeReview parseFailed fileName="scanned-resume.pdf" />
    </CanvasProviders>
  );

export default function OnboardingCanvas() {
  return (
    <Canvas name="Onboarding">
      <Storyboard
        id="ResumeUploadScreen"
        name="1. Upload resume"
        component={ResumeUploadScreen}
        layout={{ x: 0, y: 0, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ResumeUploadSelectedScreen"
        name="1. Upload — file selected"
        component={ResumeUploadSelectedScreen}
        layout={{ x: 1490, y: 0, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ResumeUploadUploadingScreen"
        name="1. Upload — sending"
        component={ResumeUploadUploadingScreen}
        layout={{ x: 0, y: 1074, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ResumeUploadErrorScreen"
        name="1. Upload — parse error"
        component={ResumeUploadErrorScreen}
        layout={{ x: 1490, y: 1074, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ResumeAnalysingScreen"
        name="2. AI analysing"
        component={ResumeAnalysingScreen}
        layout={{ x: 0, y: 2148, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ResumeAnalysingNearDoneScreen"
        name="2. AI analysing — near done"
        component={ResumeAnalysingNearDoneScreen}
        layout={{ x: 1490, y: 2148, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ResumeAnalysingErrorScreen"
        name="2. AI analysing — error"
        component={ResumeAnalysingErrorScreen}
        layout={{ x: 0, y: 4296, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ResumeReviewScreen"
        name="3. AI result — review"
        component={ResumeReviewScreen}
        layout={{ x: 0, y: 3222, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ResumeReviewLowConfidenceScreen"
        name="3. AI result — low confidence"
        component={ResumeReviewLowConfidenceScreen}
        layout={{ x: 1490, y: 3222, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ResumeReviewParseFailedScreen"
        name="3. AI result — parse failed (manual entry)"
        component={ResumeReviewParseFailedScreen}
        layout={{ x: 1490, y: 4296, width: 1440, height: 1024 }}
      />
    </Canvas>
  );
}
