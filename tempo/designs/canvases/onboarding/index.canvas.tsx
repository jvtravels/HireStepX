import type { TempoPage, TempoStoryboard } from "tempo-sdk";
import CanvasProviders from "../../../CanvasProviders";
import ResumeUpload from "./ResumeUpload";
import ResumeAnalysing from "./ResumeAnalysing";
import ResumeReview from "./ResumeReview";

const page: TempoPage = {
  name: "Onboarding",
};

export default page;

/* Onboarding — 3 logical stages of the same flow:
   1. Upload resume → 2. AI analyses it → 3. Review what AI understood */

/* ── Step 1 · Upload ───────────────────────────────────────────────────── */

export const ResumeUploadScreen: TempoStoryboard = {
  name: "1. Upload resume",
  render: () => (
    <CanvasProviders>
      <ResumeUpload name="Rahul" />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 0, width: 1440, height: 1024 },
};

export const ResumeUploadSelectedScreen: TempoStoryboard = {
  name: "1. Upload — file selected",
  render: () => (
    <CanvasProviders>
      <ResumeUpload
        name="Rahul"
        initialFile={{ name: "Rahul_Sharma_Resume.pdf", sizeKb: 248 }}
      />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 0, width: 1440, height: 1024 },
};

export const ResumeUploadUploadingScreen: TempoStoryboard = {
  name: "1. Upload — sending",
  render: () => (
    <CanvasProviders>
      <ResumeUpload
        name="Rahul"
        initialFile={{ name: "Rahul_Sharma_Resume.pdf", sizeKb: 248 }}
        uploading
      />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 1074, width: 1440, height: 1024 },
};

export const ResumeUploadErrorScreen: TempoStoryboard = {
  name: "1. Upload — parse error",
  render: () => (
    <CanvasProviders>
      <ResumeUpload
        name="Rahul"
        error="Couldn't read that file. Try a PDF, DOC, or DOCX under 10 MB."
      />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 1074, width: 1440, height: 1024 },
};

/* ── Step 2 · AI analyses ──────────────────────────────────────────────── */

export const ResumeAnalysingScreen: TempoStoryboard = {
  name: "2. AI analysing",
  render: () => (
    <CanvasProviders>
      <ResumeAnalysing fileName="Rahul_Sharma_Resume.pdf" />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 2148, width: 1440, height: 1024 },
};

export const ResumeAnalysingNearDoneScreen: TempoStoryboard = {
  name: "2. AI analysing — near done",
  render: () => (
    <CanvasProviders>
      <ResumeAnalysing
        fileName="Rahul_Sharma_Resume.pdf"
        initialStatus="Looking for patterns worth practising…"
        initialProgress={88}
      />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 2148, width: 1440, height: 1024 },
};

export const ResumeAnalysingErrorScreen: TempoStoryboard = {
  name: "2. AI analysing — error",
  render: () => (
    <CanvasProviders>
      <ResumeAnalysing
        fileName="Rahul_Sharma_Resume.pdf"
        error="The AI couldn't make sense of your file. It might be a scan or have an unusual layout."
      />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 4296, width: 1440, height: 1024 },
};

/* ── Step 3 · Review ───────────────────────────────────────────────────── */

export const ResumeReviewScreen: TempoStoryboard = {
  name: "3. AI result — review",
  render: () => (
    <CanvasProviders>
      <ResumeReview userName="Rahul Sharma" />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 3222, width: 1440, height: 1024 },
};

export const ResumeReviewLowConfidenceScreen: TempoStoryboard = {
  name: "3. AI result — low confidence",
  render: () => (
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
  ),
  layout: { x: 1490, y: 3222, width: 1440, height: 1024 },
};

export const ResumeReviewParseFailedScreen: TempoStoryboard = {
  name: "3. AI result — parse failed (manual entry)",
  render: () => (
    <CanvasProviders>
      <ResumeReview parseFailed fileName="scanned-resume.pdf" />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 4296, width: 1440, height: 1024 },
};
