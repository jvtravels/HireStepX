"use client";

/* HireStepX 2.0 — Resume screen.
   One flat divided container (same shell as the dashboard and the employer
   screens): resume summary, strengths, quality/ATS/coverage
   metric strip, a score breakdown, an improvements checklist, experience
   history, focus areas, an ATS readiness detail, skills &
   achievements, and the "Practice next" interview-coverage list — all
   wired to the real resume pipeline via useResumeUpload() (extraction,
   SHA-256 hashing, AI analysis with regex-parser fallback, and removal),
   computeATSScore() (src/resumeAts.ts), and computeAllFitness()
   (src/resumeFitness.ts). Loading and empty states render when the
   dashboard's data is still loading or no resume has been uploaded yet. */

import { useMemo } from "react";
import { useAuth } from "./AuthContext";
import { useDashboardSessions, useDashboardUIActions } from "./DashboardContext";
import { practiceCoverageStatus } from "./practiceCoverageStatus";
import { useResumeUpload, type ResumePhase } from "./useResumeUpload";
import { PortfolioLinksSection, type PortfolioLinksSectionProps } from "./settingsSections";
import LoadingScreen from "./_LoadingScreen";
import { SkeletonReveal } from "./SkeletonReveal";
import { Skeleton } from "@/components/ui/skeleton";
import { computeATSScore, isMostlyEnglishScript } from "./resumeAts";
import { computeAllFitness, type InterviewType, type FitnessBand } from "./resumeFitness";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  FileTextIcon,
  BriefcaseIcon,
  TargetIcon,
  ShieldCheckIcon,
  MessageCircleIcon,
  UsersIcon,
  CompassIcon,
  BarChart3Icon,
  FilterIcon,
  MicIcon,
  CodeIcon,
  MonitorIcon,
  CheckIcon,
  AlertCircleIcon,
  LightbulbIcon,
  ToolboxIcon,
  UploadIcon,
  Trash2Icon,
  FileUpIcon,
  SparklesIcon,
  XIcon,
  LinkIcon,
} from "lucide-react";
import { useState } from "react";


type MetricTone = "good" | "warning" | "error";

const TONE: Record<MetricTone, { chip: string; bar: string; text: string }> = {
  good: { chip: "bg-hx-success-100 text-hx-success-ink", bar: "bg-hx-success", text: "text-hx-success-ink" },
  warning: { chip: "bg-hx-warning-100 text-hx-warning-ink", bar: "bg-hx-warning", text: "text-hx-warning-ink" },
  error: { chip: "bg-hx-error-100 text-hx-error-ink", bar: "bg-hx-error", text: "text-hx-error-ink" },
};

const SKILLS_COLLAPSE_THRESHOLD = 12;

function toneForPct(pct: number): MetricTone {
  if (pct >= 75) return "good";
  if (pct >= 50) return "warning";
  return "error";
}

function scoreChipLabel(tone: MetricTone): string {
  return tone === "good" ? "Good" : tone === "warning" ? "Needs improvement" : "Needs work";
}

// Canonical 5-track coverage vocabulary — mirrors DashboardResume.tsx's
// COVERAGE_LABELS exactly so "Behavioural rounds" etc. mean the same
// thing on both screens.
const COVERAGE_LABELS: Record<InterviewType, string> = {
  behavioral: "Behavioural rounds",
  technical: "Technical depth",
  system_design: "System design",
  case: "Case-study problem-solving",
  campus: "Campus placement",
};

const STRENGTH_ICONS = [MessageCircleIcon, UsersIcon, CompassIcon, ShieldCheckIcon, TargetIcon];
const FOCUS_ICONS = [CodeIcon, MonitorIcon, FileTextIcon, TargetIcon, BriefcaseIcon];

const SCORE_BREAKDOWN_META: { key: string; label: string; max: number }[] = [
  { key: "quantifiedAchievements", label: "Quantified achievements", max: 20 },
  { key: "relevantSkills", label: "Relevant skills", max: 20 },
  { key: "experienceProgression", label: "Career progression", max: 20 },
  { key: "formattingStructure", label: "Formatting & structure", max: 15 },
  { key: "summaryClarity", label: "Summary clarity", max: 15 },
  { key: "educationCerts", label: "Education & certs", max: 10 },
];

const DEPTH_LABEL: Record<string, string> = {
  primary: "Core",
  secondary: "Secondary",
  exposure: "Exposure",
};

/* ── Flat-container building blocks (same shell as the dashboard) ── */

const SHELL = "divide-y divide-hx-line overflow-hidden rounded-2xl border border-hx-line bg-white";
const SEC = "min-w-0 px-5 py-5 min-[640px]:px-7 min-[640px]:py-6";
const BAND = "flex items-start gap-3 px-5 py-3 min-[640px]:px-7";
const HEAD = "mb-3 flex min-h-7 items-center justify-between gap-3";
const H2 = "m-0 flex items-center gap-2 text-[15px] font-semibold text-hx-coal";
const BODY = "m-0 text-[14px] leading-[22px] text-hx-neutral-ink";
const ICON = "shrink-0 text-hx-ink-soft";

function SectionHead({ icon, title, aside }: { icon: React.ReactNode; title: string; aside?: React.ReactNode }) {
  return (
    <div className={HEAD}>
      <h2 className={H2}>
        {icon}
        {title}
      </h2>
      {aside}
    </div>
  );
}

function Chip({ tone, children }: { tone: MetricTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-[11px] font-semibold ${TONE[tone].chip}`}>
      {children}
    </span>
  );
}

function ProgressBar({
  value,
  max,
  barClass,
  label,
  thick = false,
}: {
  value: number;
  max: number;
  barClass: string;
  label: string;
  thick?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={`overflow-hidden rounded-full bg-hx-soft ${thick ? "h-2" : "h-1.5"}`}
    >
      <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function MetricCell({
  icon,
  label,
  chip,
  tone,
  value,
  unit,
  barValue,
  barMax,
  barLabel,
}: {
  icon: React.ReactNode;
  label: string;
  chip: string;
  tone: MetricTone;
  value: React.ReactNode;
  unit: string;
  barValue: number;
  barMax: number;
  barLabel: string;
}) {
  return (
    <div className="min-w-0 px-5 py-5 min-[640px]:px-7">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="m-0 flex items-center gap-2 text-[13px] font-medium text-hx-ink-soft">
          {icon}
          {label}
        </p>
        <Chip tone={tone}>{chip}</Chip>
      </div>
      <p className="m-0 mb-2 flex items-baseline gap-1">
        <span className="text-[24px] font-semibold leading-8 text-hx-coal">{value}</span>
        <span className="text-[13px] text-hx-ink-soft">{unit}</span>
      </p>
      <ProgressBar value={barValue} max={barMax} barClass={TONE[tone].bar} label={barLabel} />
    </div>
  );
}

/* ── Loading / empty states ── */

function SkeletonBlock({ w, h = 12 }: { w: number | string; h?: number }) {
  return <Skeleton style={{ width: w, height: h }} aria-hidden="true" />;
}

function ResumeSkeleton() {
  return (
    <div role="status" aria-label="Loading resume" className="mb-16 text-hx-coal">
      <div className={SHELL}>
        <div className={`${SEC} flex flex-col gap-3`}>
          <SkeletonBlock w={220} h={24} />
          <SkeletonBlock w="90%" />
          <SkeletonBlock w="70%" />
        </div>
        <div className="grid grid-cols-1 divide-y divide-hx-line min-[700px]:grid-cols-3 min-[700px]:divide-x min-[700px]:divide-y-0">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-3 px-5 py-5 min-[640px]:px-7">
              <SkeletonBlock w={100} />
              <SkeletonBlock w={60} h={28} />
            </div>
          ))}
        </div>
        <div className="grid divide-y divide-hx-line min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] min-[1100px]:divide-x min-[1100px]:divide-y-0">
          <div className="divide-y divide-hx-line">
            {[0, 1].map((i) => (
              <div key={i} className={`${SEC} flex flex-col gap-3`}>
                <SkeletonBlock w={140} h={18} />
                <SkeletonBlock w="80%" />
                <SkeletonBlock w="60%" />
              </div>
            ))}
          </div>
          <div className="divide-y divide-hx-line">
            {[0, 1].map((i) => (
              <div key={i} className={`${SEC} flex flex-col gap-3`}>
                <SkeletonBlock w={160} h={18} />
                <SkeletonBlock w="90%" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResumeAnalyzingCard({ phase }: { phase: ResumePhase }) {
  return (
    <LoadingScreen
      fullScreen={false}
      title={phase === "extracting" ? "Reading your resume…" : "Analyzing your resume…"}
      message="This usually takes a few seconds."
    />
  );
}

function ResumeEmptyState({ onUpload, errorMsg }: { onUpload: () => void; errorMsg: string }) {
  return (
    <div className={`${SEC} flex flex-col items-center gap-3 py-10 text-center min-[640px]:py-14`}>
      <span className="inline-flex size-12 items-center justify-center rounded-xl bg-hx-indigo-100">
        <FileUpIcon size={22} className="text-hx-indigo" aria-hidden="true" />
      </span>
      <h1 className="m-0 text-[20px] font-semibold leading-7 text-hx-coal">Upload your resume</h1>
      <p className={`${BODY} max-w-[420px] text-hx-ink-soft`}>
        Add your resume to get an AI-scored summary, ATS readiness check, and questions matched to your experience.
      </p>
      {errorMsg && <p className="m-0 text-[13px] text-hx-error">{errorMsg}</p>}
      <Button onClick={onUpload} size="lg" className="mt-1 h-11 gap-2">
        <UploadIcon size={16} aria-hidden="true" />
        Upload resume
      </Button>
    </div>
  );
}

function PortfolioSection(props: PortfolioLinksSectionProps) {
  return (
    <section className={SEC}>
      <SectionHead icon={<LinkIcon size={16} className={ICON} aria-hidden="true" />} title="Portfolio & Work Samples" />
      <PortfolioLinksSection {...props} />
    </section>
  );
}

/* ── Root ── */

export default function ResumeV2Screen() {
  const { user, loading: authLoading, updateUser: authUpdateUser } = useAuth();
  const { showToast } = useDashboardUIActions();
  const { practiceCoverage } = useDashboardSessions();
  const {
    phase,
    profile,
    analysisSource,
    fileName,
    resumeText,
    errorMsg,
    truncated,
    handleRemove,
    triggerUpload,
  } = useResumeUpload();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [skillsExpanded, setSkillsExpanded] = useState(false);

  const atsResult = useMemo(() => {
    const source = resumeText || user?.resumeText || "";
    if (!source || !isMostlyEnglishScript(source)) return null;
    return computeATSScore(source, user?.targetRole, {
      experience: (profile?.experiences?.length ?? 0) > 0,
      skills: (profile?.topSkills.length ?? 0) > 0,
    });
  }, [resumeText, user?.resumeText, user?.targetRole, profile]);

  const coverageRows = useMemo(() => {
    if (!profile) return [];
    const fits = computeAllFitness(profile);
    return (Object.keys(COVERAGE_LABELS) as InterviewType[]).map((type) => ({
      type,
      label: COVERAGE_LABELS[type],
      band: fits[type].band as FitnessBand,
      score: fits[type].score,
    }));
  }, [profile]);

  const practiceFocusItems = useMemo(() => {
    if (!profile) return [];
    const items: string[] = [];
    if (profile.topSkills.length > 0) {
      items.push(`Technical depth on ${profile.topSkills.slice(0, 3).join(", ")}`);
    }
    if (profile.interviewGaps.length > 0) {
      items.push("Behavioural stories at scale");
    }
    if (profile.seniorityLevel) {
      items.push(`${profile.seniorityLevel}-level system-design questions`);
    }
    if (items.length === 0) {
      items.push("Personalised question mix based on your profile");
    }
    return items.slice(0, 3);
  }, [profile]);

  let body: React.ReactNode;
  if (!profile) {
    if (phase === "extracting" || phase === "analyzing") {
      body = <ResumeAnalyzingCard phase={phase} />;
    } else {
      body = (
        <div className="mb-16 text-hx-coal">
          <div className={SHELL}>
            <ResumeEmptyState onUpload={triggerUpload} errorMsg={errorMsg} />
            <PortfolioSection portfolioLinks={user?.portfolioLinks} authUpdateUser={authUpdateUser} showToast={showToast} />
          </div>
        </div>
      );
    }
  } else {
    const qualityScore = profile.resumeScore ?? 0;
    const qualityTone = toneForPct(qualityScore);
    const atsTone = atsResult ? toneForPct(atsResult.score) : "error";
    // Resume-fit tracks (the "Practice next" list) are a separate signal from
    // practice coverage; coverage itself comes from the same helper and data
    // the dashboard card uses so the two screens can never disagree.
    const strongFitCount = coverageRows.filter((r) => r.band === "good" || r.band === "excellent").length;
    const coverageStatus = practiceCoverageStatus(practiceCoverage);
    const coveredCount = practiceCoverage.practicedCount;
    const coverageTotal = practiceCoverage.totalAreas;
    const coverageTone: MetricTone = coverageStatus.status === "not_started" ? "error" : coverageStatus.status === "in_progress" ? "warning" : "good";
    const fitTone: MetricTone = strongFitCount === coverageRows.length ? "good" : "warning";

    const scoreBreakdownRows = SCORE_BREAKDOWN_META.map((meta) => {
      const value = profile.scoreBreakdown?.[meta.key] ?? 0;
      return { label: meta.label, value, max: meta.max, tone: toneForPct((value / meta.max) * 100) };
    });

    const coreSkills = profile.skillsDetailed && profile.skillsDetailed.length > 0
      ? profile.skillsDetailed
      : profile.topSkills.map((s) => ({ name: s, depth: "primary" as const, yearsUsed: undefined, recent: undefined }));

    const experiences = profile.experiences ?? [];
    const busy = phase === "extracting" || phase === "analyzing";

    body = (
      <div className="mb-16 text-hx-coal">
        <div className={SHELL}>
          {busy && (
            <div role="status" className={`${BAND} items-center bg-hx-soft`}>
              <SparklesIcon size={16} className={ICON} aria-hidden="true" />
              <p className="m-0 text-[13px] text-hx-ink-soft">
                {phase === "extracting" ? "Reading your new resume…" : "Analyzing your new resume. This page will update shortly."}
              </p>
            </div>
          )}
          {errorMsg && (
            <div role="alert" className={`${BAND} bg-hx-error-100`}>
              <AlertCircleIcon size={16} className="mt-0.5 shrink-0 text-hx-error-ink" aria-hidden="true" />
              <p className="m-0 text-[13px] text-hx-error-ink">{errorMsg}</p>
            </div>
          )}
          {analysisSource === "fallback" && !busy && (
            <div role="status" className={`${BAND} bg-hx-warning-100`}>
              <AlertCircleIcon size={16} className="mt-0.5 shrink-0 text-hx-warning-ink" aria-hidden="true" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="m-0 text-[13px] font-semibold text-hx-warning-ink">Basic parse, not AI-reviewed</p>
                <p className="m-0 text-[13px] leading-[19px] text-hx-warning-ink">
                  {errorMsg ? "The summary below comes from a simpler keyword scan" : "Our AI couldn't read this resume (often a scanned PDF or unusual formatting), so the summary below comes from a simpler keyword scan"}.
                  {" "}Scores and skill coverage may be less accurate than an AI-parsed resume.
                </p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={triggerUpload}
                  className="h-auto self-start p-0 text-[13px] text-hx-warning-ink underline"
                >
                  Try a different file
                </Button>
              </div>
            </div>
          )}

          {/* Title + resume file */}
          <header className={SEC}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="m-0 min-w-0 text-[20px] font-semibold leading-7 text-hx-coal">
                  {profile.headline || "Your resume overview"}
                </h1>
                {typeof profile.yearsExperience === "number" && (
                  <span className="inline-flex h-5 items-center rounded-full bg-hx-indigo-100 px-2 text-[11px] font-semibold text-hx-indigo-deep">
                    {profile.yearsExperience}+ Years
                  </span>
                )}
                {analysisSource === "fallback" && <Chip tone="warning">Basic profile</Chip>}
              </div>
              <div className="flex flex-wrap items-stretch overflow-hidden rounded-lg border border-hx-line bg-white">
                <div className="flex min-w-0 items-center gap-2 px-3 py-1.5">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded bg-hx-indigo">
                    <FileTextIcon size={14} className="text-white" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p title={fileName || "resume"} className="m-0 max-w-[160px] truncate text-[13px] font-medium text-hx-coal">{fileName || "resume"}</p>
                    <p className="m-0 text-[12px] text-hx-ink-soft">Resume file</p>
                  </div>
                </div>
                <div aria-hidden="true" className="w-px self-stretch bg-hx-line" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={triggerUpload}
                  disabled={busy}
                  className="min-h-11 gap-1.5 rounded-none text-[13px] font-medium"
                >
                  <UploadIcon size={14} aria-hidden="true" />
                  Replace
                </Button>
                <div aria-hidden="true" className="w-px self-stretch bg-hx-line" />
                {confirmDelete ? (
                  <div role="group" aria-label="Confirm delete resume" aria-live="polite" className="flex items-center gap-1 px-1.5">
                    <Button
                      variant="destructive"
                      size="sm"
                      aria-label="Confirm delete resume"
                      onClick={() => { handleRemove(); setConfirmDelete(false); }}
                      className="min-h-11 min-w-11 px-3"
                    >
                      <CheckIcon size={14} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Cancel delete"
                      onClick={() => setConfirmDelete(false)}
                      className="min-h-11 min-w-11 px-3"
                    >
                      <XIcon size={14} aria-hidden="true" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete resume"
                    title="Remove resume"
                    onClick={() => setConfirmDelete(true)}
                    className="min-h-11 min-w-11 rounded-none"
                  >
                    <Trash2Icon size={14} className="text-hx-error" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
            {profile.summary && <p className={`${BODY} mt-3 max-w-[75ch]`}>{profile.summary}</p>}
            {truncated && (
              <p className="m-0 mt-2 text-[13px] text-hx-warning-ink">
                Your resume is long, so we analysed a shortened version that keeps the start of every section. Content past that point was not scored.
              </p>
            )}
          </header>

          {profile.careerTrajectory && (
            <div className={`${BAND} py-5`}>
              <TargetIcon size={16} className="mt-0.5 shrink-0 text-hx-indigo" aria-hidden="true" />
              <div className="min-w-0">
                <p className="m-0 text-[13px] font-semibold text-hx-indigo-deep">Career objective</p>
                <p className={`${BODY} mt-1 max-w-[75ch]`}>{profile.careerTrajectory}</p>
              </div>
            </div>
          )}

          {/* Score strip */}
          <div className="grid grid-cols-1 divide-y divide-hx-line min-[700px]:grid-cols-3 min-[700px]:divide-x min-[700px]:divide-y-0">
            <MetricCell
              icon={<BarChart3Icon size={15} className={ICON} aria-hidden="true" />}
              label="Resume quality"
              chip={scoreChipLabel(qualityTone)}
              tone={qualityTone}
              value={qualityScore}
              unit="/ 100"
              barValue={qualityScore}
              barMax={100}
              barLabel={`Resume quality: ${qualityScore} out of 100`}
            />
            <MetricCell
              icon={<FilterIcon size={15} className={ICON} aria-hidden="true" />}
              label="ATS readiness"
              chip={atsResult ? scoreChipLabel(atsTone) : "Unavailable"}
              tone={atsTone}
              value={atsResult?.score ?? "–"}
              unit="/ 100"
              barValue={atsResult?.score ?? 0}
              barMax={100}
              barLabel={`ATS readiness: ${atsResult?.score ?? 0} out of 100`}
            />
            <MetricCell
              icon={<MicIcon size={15} className={ICON} aria-hidden="true" />}
              label="Practice coverage"
              chip={coverageStatus.label}
              tone={coverageTone}
              value={coveredCount}
              unit={`/ ${coverageTotal}`}
              barValue={coveredCount}
              barMax={coverageTotal}
              barLabel={`Practice coverage: ${coveredCount} out of ${coverageTotal}`}
            />
          </div>

          <div className="grid divide-y divide-hx-line min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] min-[1100px]:divide-x min-[1100px]:divide-y-0">
            {/* Left column */}
            <div className="min-w-0 divide-y divide-hx-line">
              {profile.interviewStrengths.length > 0 && (
                <section className={SEC}>
                  <SectionHead icon={<ShieldCheckIcon size={16} className={ICON} aria-hidden="true" />} title="Strengths" />
                  <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                    {profile.interviewStrengths.map((text, i) => {
                      const Icon = STRENGTH_ICONS[i % STRENGTH_ICONS.length];
                      return (
                        <li key={i} className="flex items-start gap-2.5">
                          <Icon size={16} className="mt-[3px] shrink-0 text-hx-ink-soft" aria-hidden="true" />
                          <p className={`${BODY} flex-1`}>{text}</p>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {profile.scoreBreakdown && (
                <section className={SEC}>
                  <SectionHead icon={<BarChart3Icon size={16} className={ICON} aria-hidden="true" />} title="Score Breakdown" />
                  <div className="flex flex-col">
                    {scoreBreakdownRows.map((row) => (
                      <div key={row.label} className="flex items-center gap-3 py-2">
                        <p title={row.label} className="m-0 min-w-[100px] flex-[0_1_180px] truncate text-[13px] text-hx-neutral-ink">{row.label}</p>
                        <div className="flex-1">
                          <ProgressBar value={row.value} max={row.max} barClass={TONE[row.tone].bar} label={`${row.label}: ${row.value} out of ${row.max}`} />
                        </div>
                        <p className="m-0 flex w-12 shrink-0 items-baseline justify-end gap-0.5">
                          <span className="text-[13px] font-semibold text-hx-coal">{row.value}</span>
                          <span className="text-[11px] text-hx-ink-soft">/{row.max}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {profile.improvements && profile.improvements.length > 0 && (
                <section className={SEC}>
                  <SectionHead icon={<SparklesIcon size={16} className={ICON} aria-hidden="true" />} title={`Resume improvements (${profile.improvements.length})`} />
                  <ol className="m-0 list-none divide-y divide-hx-line p-0">
                    {profile.improvements.map((text, i) => (
                      <li key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                        <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-hx-soft text-[11px] font-semibold text-hx-ink-soft">{i + 1}</span>
                        <p className={`${BODY} flex-1`}>{text}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {experiences.length > 0 && (
                <section className={SEC}>
                  <SectionHead
                    icon={<BriefcaseIcon size={16} className={ICON} aria-hidden="true" />}
                    title="Experience"
                    aside={
                      <p className="m-0 text-[13px] text-hx-ink-soft">
                        {experiences.length} role{experiences.length === 1 ? "" : "s"}
                        {typeof profile.yearsExperience === "number" ? ` · ${profile.yearsExperience}+ years` : ""}
                      </p>
                    }
                  />
                  <div className="divide-y divide-hx-line">
                    {experiences.map((job, i) => (
                      <div key={`${job.title}-${i}`} className="py-3.5 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <h3 className="m-0 min-w-0 flex-[1_1_240px] break-words text-[14px] font-semibold text-hx-coal">
                            {job.title}{job.company ? ` · ${job.company}` : ""}
                          </h3>
                          <p className="m-0 shrink-0 whitespace-nowrap text-[13px] text-hx-ink-soft">
                            {job.start || job.end ? `${job.start || "Earlier"} - ${job.end || "Present"}` : ""}
                          </p>
                        </div>
                        {(job.scope || (job.topProjects && job.topProjects.length > 0)) && (
                          <p className={`${BODY} mt-1`}>{job.scope || job.topProjects.join("; ")}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <PortfolioSection portfolioLinks={user?.portfolioLinks} authUpdateUser={authUpdateUser} showToast={showToast} />
            </div>

            {/* Right rail */}
            <div className="min-w-0 divide-y divide-hx-line">
              {profile.interviewGaps.length > 0 && (
                <section className={SEC}>
                  <SectionHead icon={<TargetIcon size={16} className={ICON} aria-hidden="true" />} title="Focus Areas" />
                  <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                    {profile.interviewGaps.map((text, i) => {
                      const Icon = FOCUS_ICONS[i % FOCUS_ICONS.length];
                      return (
                        <li key={i} className="flex items-start gap-2.5">
                          <Icon size={16} className="mt-[3px] shrink-0 text-hx-ink-soft" aria-hidden="true" />
                          <p className={`${BODY} flex-1`}>{text}</p>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <section className={SEC}>
                <SectionHead icon={<CompassIcon size={16} className={ICON} aria-hidden="true" />} title="Practice Focus" />
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {practiceFocusItems.map((text, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <CheckIcon size={16} className="mt-[3px] shrink-0 text-hx-indigo" aria-hidden="true" />
                      <p className={`${BODY} flex-1`}>{text}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <section className={SEC}>
                <SectionHead
                  icon={<ShieldCheckIcon size={16} className={ICON} aria-hidden="true" />}
                  title="ATS Readiness"
                  aside={atsResult ? <Chip tone={atsTone}>{atsResult.score} / 100</Chip> : undefined}
                />
                {atsResult ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <ProgressBar value={atsResult.score} max={100} barClass={TONE[atsTone].bar} thick label={`ATS readiness score: ${atsResult.score} out of 100`} />
                      <p className="m-0 text-[13px] text-hx-ink-soft">{atsResult.label}</p>
                    </div>
                    <div>
                      <p className="m-0 mb-2 text-[13px] font-semibold text-hx-coal">Found ({atsResult.found.length})</p>
                      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-x-3 gap-y-2 p-0">
                        {atsResult.found.map((item) => (
                          <li key={item} className="flex items-center gap-2">
                            <span className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-hx-success-100">
                              <CheckIcon size={10} className="text-hx-success-ink" aria-hidden="true" />
                            </span>
                            <span className="text-[13px] text-hx-neutral-ink">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {atsResult.suggestions.length > 0 && (
                      <ul className="m-0 flex list-none flex-col gap-2 p-0">
                        {atsResult.suggestions.map((s, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <LightbulbIcon size={14} className="mt-[3px] shrink-0 text-hx-warning-ink" aria-hidden="true" />
                            <p className="m-0 flex-1 text-[13px] leading-5 text-hx-coal">{s}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {atsResult.missing.length > 0 && (
                      <p className="m-0 flex items-start gap-2.5 text-[13px] leading-5 text-hx-error-ink">
                        <AlertCircleIcon size={14} className="mt-[3px] shrink-0" aria-hidden="true" />
                        <span>Needs attention: {atsResult.missing.join(", ")}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="m-0 text-[13px] text-hx-ink-soft">
                    {(resumeText || user?.resumeText) && !isMostlyEnglishScript(resumeText || user?.resumeText || "")
                      ? "ATS readiness is only scored for English resumes. Interviews run in English, so an English version works best."
                      : "Re-upload your resume to see an ATS readiness score."}
                  </p>
                )}
              </section>

              {(coreSkills.length > 0 || profile.keyAchievements.length > 0) && (
                <section className={SEC}>
                  <SectionHead
                    icon={<ToolboxIcon size={16} className={ICON} aria-hidden="true" />}
                    title="Skills & Achievements"
                    aside={<span className="text-[12px] text-hx-ink-soft">{coreSkills.length} skills · {profile.keyAchievements.length} achievements</span>}
                  />
                  {coreSkills.length > 0 && (
                    <div className="mb-4 flex flex-col gap-2">
                      <p className="m-0 text-[12px] font-semibold text-hx-ink-soft">Skills</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {(skillsExpanded ? coreSkills : coreSkills.slice(0, SKILLS_COLLAPSE_THRESHOLD)).map((skill) => (
                          <span key={skill.name} className="inline-flex items-center gap-2 rounded-full border border-hx-line bg-white px-2.5 py-1.5">
                            <span className="text-[12px] font-medium text-hx-neutral-ink">
                              {skill.name}
                              {skill.yearsUsed != null && <span className="ml-1 text-[11px] text-hx-ink-soft">{skill.yearsUsed}Y</span>}
                            </span>
                            <span className="rounded-full bg-hx-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.4px] text-hx-indigo-deep">
                              {DEPTH_LABEL[skill.depth] ?? skill.depth}
                            </span>
                          </span>
                        ))}
                        {coreSkills.length > SKILLS_COLLAPSE_THRESHOLD && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSkillsExpanded((v) => !v)}
                            className="min-h-11 bg-transparent px-2 text-[12px] font-semibold text-hx-indigo"
                          >
                            {skillsExpanded ? "Show less" : `+${coreSkills.length - SKILLS_COLLAPSE_THRESHOLD} more`}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {profile.keyAchievements.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="m-0 text-[12px] font-semibold text-hx-ink-soft">Key Achievements</p>
                      <ol className="m-0 list-none divide-y divide-hx-line p-0">
                        {profile.keyAchievements.map((text, i) => (
                          <li key={i} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
                            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-hx-soft text-[11px] font-semibold text-hx-ink-soft">{i + 1}</span>
                            <p className={`${BODY} flex-1`}>{text}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </section>
              )}

              {coverageRows.length > 0 && (
                <section className={SEC}>
                  <SectionHead
                    icon={<MicIcon size={16} className={ICON} aria-hidden="true" />}
                    title="Resume fit by round"
                    aside={<Chip tone={fitTone}>{strongFitCount} of {coverageRows.length} strong</Chip>}
                  />
                  <p className="m-0 mb-3 text-[13px] text-hx-ink-soft">How well your resume supports each interview type</p>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {coverageRows.map((track) => {
                      const tone: MetricTone = track.band === "good" || track.band === "excellent" ? "good" : track.band === "fair" ? "warning" : "error";
                      return (
                        <li key={track.type} className="flex items-center gap-2.5">
                          <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${TONE[tone].bar}`} />
                          <p className="m-0 flex-1 text-[13px] text-hx-neutral-ink">{track.label}</p>
                          <Chip tone={tone}>{track.score}</Chip>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex w-full flex-col">
        <SkeletonReveal loading={authLoading} skeleton={<ResumeSkeleton />}>
          {body}
        </SkeletonReveal>
      </div>
    </TooltipProvider>
  );
}
