"use client";

/* HireStepX 2.0 — Resume screen.
   Sidebar shell, top bar, resume summary, strengths, quality/ATS/coverage
   metric cards, a score breakdown, an improvements checklist, experience
   history, focus areas, an ATS readiness detail card, skills &
   achievements, and the "Practice next" interview-coverage card — all
   wired to the real resume pipeline via useResumeUpload() (extraction,
   SHA-256 hashing, AI analysis with regex-parser fallback, and removal),
   computeATSScore() (src/resumeAts.ts), and computeAllFitness()
   (src/resumeFitness.ts). Loading and empty states render when the
   dashboard's data is still loading or no resume has been uploaded yet. */

import { useMemo } from "react";
import Image from "next/image";
import { tokens as T, fonts as F, textSize as S, shadows } from "./auth/_tokens";
import { useAuth } from "./AuthContext";
import { useDashboardUI } from "./DashboardContext";
import { useResumeUpload, type ResumePhase } from "./useResumeUpload";
import { computeATSScore } from "./resumeAts";
import { computeAllFitness, type InterviewType, type FitnessBand } from "./resumeFitness";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboardIcon,
  ClipboardListIcon,
  CalendarIcon,
  TrendingUpIcon,
  FileTextIcon,
  BriefcaseIcon,
  HelpCircleIcon,
  SettingsIcon,
  SparklesIcon,
  UserCircleIcon,
  CreditCardIcon,
  BellIcon,
  MailIcon,
  LogOutIcon,
  ChevronsUpDownIcon,
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
  Loader2Icon,
  FileUpIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useState } from "react";

const font = { ui: F.sans, mono: F.mono };

/* ── Nav shell (unchanged from the concept) ── */

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "sessions", label: "Sessions" },
  { id: "calendar", label: "Calendar" },
  { id: "analytics", label: "Analytics" },
  { id: "resume", label: "Resume" },
  { id: "jobs", label: "Jobs" },
] as const;

function NavIcon({ id }: { id: string }) {
  switch (id) {
    case "dashboard":
      return <LayoutDashboardIcon size={18} aria-hidden="true" />;
    case "sessions":
      return <ClipboardListIcon size={18} aria-hidden="true" />;
    case "calendar":
      return <CalendarIcon size={18} aria-hidden="true" />;
    case "analytics":
      return <TrendingUpIcon size={18} aria-hidden="true" />;
    case "resume":
      return <FileTextIcon size={18} aria-hidden="true" />;
    case "jobs":
      return <BriefcaseIcon size={18} aria-hidden="true" />;
    default:
      return null;
  }
}

type MetricTone = "good" | "warning" | "error";

const metricColor: Record<MetricTone, { chipBg: string; chipText: string; bar: string }> = {
  good: { chipBg: T.success100, chipText: T.successInk, bar: T.success },
  warning: { chipBg: T.warning100, chipText: T.warningInk, bar: T.warning },
  error: { chipBg: T.error100, chipText: T.error, bar: T.error },
};

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

/* ── Shell ── */

function AppSidebar({ name, email }: { name: string; email: string }) {
  const { logout } = useAuth();
  const initial = (name.trim()[0] || email.trim()[0] || "U").toUpperCase();

  return (
    <Sidebar collapsible="icon" className="border-none">
      <SidebarHeader className="px-3 pt-4 pb-3">
        <div className="flex items-center gap-2 overflow-hidden px-2">
          <div className="hidden shrink-0 items-center justify-center group-data-[collapsible=icon]:flex">
            <Image src="/favicon.svg" alt="HireStepX" width={28} height={28} style={{ width: 24, height: 24, borderRadius: 6 }} />
          </div>
          <Image
            src="/wordmark.png"
            alt="HireStepX"
            width={387}
            height={108}
            className="group-data-[collapsible=icon]:hidden"
            style={{ height: 22, width: "auto" }}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-1.5">
            {NAV_ITEMS.map((item) => {
              const active = item.id === "resume";
              return (
                <SidebarMenuItem key={item.id} style={{ position: "relative" }}>
                  {active && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: -12,
                        top: 4,
                        width: 4,
                        height: 32,
                        borderRadius: "0 4px 4px 0",
                        background: T.indigo,
                      }}
                    />
                  )}
                  <SidebarMenuButton
                    isActive={active}
                    tooltip={item.label}
                    style={{
                      height: 40,
                      gap: 10,
                      background: active ? T.white : "transparent",
                      border: active ? `1px solid ${T.line}` : "1px solid transparent",
                      color: active ? T.indigo : T.inkFaint,
                      fontFamily: font.ui,
                      fontSize: S.md,
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    <NavIcon id={item.id} />
                    <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2">
        <SidebarMenu className="gap-1.5">
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Help & Support" style={{ height: 40, gap: 10, color: T.inkFaint, fontFamily: font.ui, fontSize: S.md, fontWeight: 500 }}>
              <HelpCircleIcon size={18} aria-hidden="true" />
              <span className="truncate group-data-[collapsible=icon]:hidden">Help & Support</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings" style={{ height: 40, gap: 10, color: T.inkFaint, fontFamily: font.ui, fontSize: S.md, fontWeight: 500 }}>
              <SettingsIcon size={18} aria-hidden="true" />
              <span className="truncate group-data-[collapsible=icon]:hidden">Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0"
              style={{ borderColor: T.line, background: T.white, cursor: "pointer" }}
            >
              <Avatar style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0 }}>
                <AvatarFallback style={{ borderRadius: 8, background: T.indigo, fontFamily: font.ui, fontSize: S.md, fontWeight: 700, color: T.white }}>{initial}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p style={{ fontFamily: font.ui, fontSize: S.base, fontWeight: 600, color: T.coal, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</p>
                <p style={{ fontFamily: font.ui, fontSize: S.xs, color: T.inkFaint, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</p>
              </div>
              <ChevronsUpDownIcon
                className="shrink-0 group-data-[collapsible=icon]:hidden"
                size={14}
                color={T.inkFaint}
                aria-hidden="true"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" style={{ width: 232, fontFamily: font.ui }}>
            <DropdownMenuLabel style={{ padding: "6px 8px" }}>
              <div className="flex items-center gap-2.5">
                <Avatar style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0 }}>
                  <AvatarFallback style={{ borderRadius: 8, background: T.indigo, fontFamily: font.ui, fontSize: S.md, fontWeight: 700, color: T.white }}>{initial}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p style={{ fontFamily: font.ui, fontSize: S.base, fontWeight: 600, color: T.coal, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</p>
                  <p style={{ fontFamily: font.ui, fontSize: S.sm, fontWeight: 400, color: T.inkFaint, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* Upgrade / Account / Billing / Notifications have no target
                surface yet on this screen (no pricing/account page wired
                into ResumeV2) — left as clearly-disabled stubs, same as
                the rest of the app's not-yet-built chrome. */}
            <DropdownMenuItem aria-disabled="true" title="Not wired in this preview" style={{ padding: "8px", fontSize: S.base, color: T.coal }}>
              <SparklesIcon size={15} aria-hidden="true" />
              Upgrade to Pro
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem aria-disabled="true" title="Not wired in this preview" style={{ padding: "8px", fontSize: S.base, color: T.coal }}>
              <UserCircleIcon size={15} aria-hidden="true" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem aria-disabled="true" title="Not wired in this preview" style={{ padding: "8px", fontSize: S.base, color: T.coal }}>
              <CreditCardIcon size={15} aria-hidden="true" />
              Billing
            </DropdownMenuItem>
            <DropdownMenuItem aria-disabled="true" title="Not wired in this preview" style={{ padding: "8px", fontSize: S.base, color: T.coal }}>
              <BellIcon size={15} aria-hidden="true" />
              Notifications
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { void logout(); }} style={{ padding: "8px", fontSize: S.base, color: T.coal, cursor: "pointer" }}>
              <LogOutIcon size={15} aria-hidden="true" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function TopBar() {
  return (
    <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", padding: "8px 16px", width: "100%" }}>
      <div
        style={{
          height: 62,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          background: T.white,
          border: `1px solid ${T.line}`,
          borderRadius: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SidebarTrigger style={{ color: T.coal }} />
          <span style={{ fontFamily: font.ui, fontSize: S.md, color: T.coal }}>Resume</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Button variant="ghost" size="icon" aria-label="Messages" aria-disabled="true" title="Not wired in this preview">
            <MailIcon size={20} aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Notifications" aria-disabled="true" title="Not wired in this preview">
            <BellIcon size={20} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Presentational building blocks ── */

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: T.white,
        border: `1px solid ${T.line}`,
        borderRadius: 12,
        padding: 20,
        boxShadow: shadows.card,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function ProgressBar({
  value,
  max,
  color,
  trackColor = T.line,
  height = 6,
  label,
}: {
  value: number;
  max: number;
  color: string;
  trackColor?: string;
  height?: number;
  label: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      style={{ height, borderRadius: height / 2, background: trackColor, overflow: "hidden" }}
    >
      <div style={{ height, borderRadius: height / 2, width: `${pct}%`, background: color }} />
    </div>
  );
}

/* ── Loading / empty states ── */

function SkeletonBlock({ w, h = 12 }: { w: number | string; h?: number }) {
  return <span style={{ display: "block", width: w, height: h, borderRadius: 4, background: T.creamSoft }} aria-hidden="true" />;
}

function ResumeSkeleton() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }} role="status" aria-label="Loading resume">
      <div style={{ flex: "1 1 640px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        <SectionCard>
          <SkeletonBlock w={220} h={24} />
          <SkeletonBlock w="90%" />
          <SkeletonBlock w="70%" />
        </SectionCard>
        <SectionCard>
          <SkeletonBlock w={140} h={18} />
          <SkeletonBlock w="80%" />
          <SkeletonBlock w="60%" />
        </SectionCard>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <SectionCard key={i} style={{ flex: "1 1 160px", minWidth: 160 }}>
              <SkeletonBlock w={100} />
              <SkeletonBlock w={60} h={28} />
            </SectionCard>
          ))}
        </div>
      </div>
      <div style={{ flex: "1 1 420px", maxWidth: 550, display: "flex", flexDirection: "column", gap: 16 }}>
        <SectionCard>
          <SkeletonBlock w={140} h={18} />
          <SkeletonBlock w="80%" />
        </SectionCard>
        <SectionCard>
          <SkeletonBlock w={160} h={18} />
          <SkeletonBlock w="90%" />
        </SectionCard>
      </div>
    </div>
  );
}

function ResumeAnalyzingCard({ phase }: { phase: ResumePhase }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "80px 16px" }}>
      <SectionCard style={{ maxWidth: 420, alignItems: "center", textAlign: "center" }}>
        <Loader2Icon size={28} color={T.indigo} aria-hidden="true" className="animate-spin" />
        <h2 style={{ fontFamily: font.ui, fontSize: S.lg, fontWeight: 700, color: T.coal, margin: 0 }}>
          {phase === "extracting" ? "Reading your resume…" : "Analyzing your resume…"}
        </h2>
        <p style={{ fontFamily: font.ui, fontSize: S.md, color: T.inkFaint, margin: 0 }}>
          This usually takes a few seconds.
        </p>
      </SectionCard>
    </div>
  );
}

function ResumeEmptyState({ onUpload, errorMsg }: { onUpload: () => void; errorMsg: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "80px 16px" }}>
      <SectionCard style={{ maxWidth: 460, alignItems: "center", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: T.indigo100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FileUpIcon size={24} color={T.indigo} aria-hidden="true" />
        </div>
        <h2 style={{ fontFamily: font.ui, fontSize: S.xl, fontWeight: 700, color: T.coal, margin: 0 }}>Upload your resume</h2>
        <p style={{ fontFamily: font.ui, fontSize: S.md, lineHeight: "22px", color: T.inkFaint, margin: 0 }}>
          Add your resume to get an AI-scored summary, ATS readiness check, and questions matched to your experience.
        </p>
        {errorMsg && (
          <p style={{ fontFamily: font.ui, fontSize: S.sm, color: T.error, margin: 0 }}>{errorMsg}</p>
        )}
        <Button
          onClick={onUpload}
          style={{ background: T.indigo, color: T.white, fontFamily: font.ui, fontSize: S.base, fontWeight: 600, gap: 8, height: 44, borderRadius: 8 }}
        >
          <UploadIcon size={16} aria-hidden="true" />
          Upload resume
        </Button>
      </SectionCard>
    </div>
  );
}

/* ── Root ── */

export default function ResumeV2Screen() {
  const { user } = useAuth();
  const { dataLoading } = useDashboardUI();
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

  const atsResult = useMemo(() => {
    const source = resumeText || user?.resumeText || "";
    if (!source) return null;
    return computeATSScore(source, user?.targetRole);
  }, [resumeText, user?.resumeText, user?.targetRole]);

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

  const name = user?.name || "Your account";
  const email = user?.email || "";

  let body: React.ReactNode;
  if (dataLoading) {
    body = <ResumeSkeleton />;
  } else if (!profile) {
    if (phase === "extracting" || phase === "analyzing") {
      body = <ResumeAnalyzingCard phase={phase} />;
    } else {
      body = <ResumeEmptyState onUpload={triggerUpload} errorMsg={errorMsg} />;
    }
  } else {
    const qualityScore = profile.resumeScore ?? 0;
    const qualityTone = toneForPct(qualityScore);
    const atsTone = atsResult ? toneForPct(atsResult.score) : "error";
    const coveredCount = coverageRows.filter((r) => r.band === "good" || r.band === "excellent").length;
    const coverageTone: MetricTone = coveredCount === 0 ? "error" : coveredCount < coverageRows.length ? "warning" : "good";
    const coverageChip = coveredCount === 0 ? "Not started" : coveredCount === coverageRows.length ? "Complete" : "In progress";

    const scoreBreakdownRows = SCORE_BREAKDOWN_META.map((meta) => {
      const value = profile.scoreBreakdown?.[meta.key] ?? 0;
      return { label: meta.label, value, max: meta.max, tone: toneForPct((value / meta.max) * 100) };
    });

    const coreSkills = profile.skillsDetailed && profile.skillsDetailed.length > 0
      ? profile.skillsDetailed
      : profile.topSkills.map((s) => ({ name: s, depth: "primary" as const, yearsUsed: undefined, recent: undefined }));

    const experiences = profile.experiences ?? [];

    body = (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 640px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Resume summary */}
          <SectionCard>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h1 style={{ fontFamily: font.ui, fontSize: S["2xl"], fontWeight: 700, color: T.coal, margin: 0 }}>
                  {profile.headline || "Your profile"}
                </h1>
                {typeof profile.yearsExperience === "number" && (
                  <Badge style={{ background: T.indigo100, color: T.indigoDeep, borderRadius: 16, fontFamily: font.ui, fontWeight: 500, fontSize: S.md, padding: "2px 10px" }}>
                    {profile.yearsExperience}+ Years
                  </Badge>
                )}
                {analysisSource === "fallback" && (
                  <Badge style={{ background: T.warning100, color: T.warningInk, borderRadius: 16, fontFamily: font.ui, fontWeight: 500, fontSize: S.sm, padding: "2px 10px" }}>
                    Basic profile
                  </Badge>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.creamSoft, border: `1px solid ${T.line}`, borderRadius: 8, padding: "6px 12px 6px 10px" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 4, background: T.indigo, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <FileTextIcon size={14} color={T.white} aria-hidden="true" />
                  </div>
                  <div>
                    <p style={{ fontFamily: font.ui, fontSize: S.base, fontWeight: 500, color: T.coal, margin: 0, maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fileName || "resume"}</p>
                    <p style={{ fontFamily: font.ui, fontSize: S.sm, color: T.inkFaint, margin: 0 }}>Resume file</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={triggerUpload}
                  disabled={phase === "extracting" || phase === "analyzing"}
                  style={{ borderColor: T.indigo, color: T.indigo, fontFamily: font.ui, fontSize: S.base, fontWeight: 500, gap: 6 }}
                >
                  <UploadIcon size={14} aria-hidden="true" />
                  Replace
                </Button>
                {confirmDelete ? (
                  <div role="group" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontFamily: font.ui, fontSize: S.sm, color: T.inkFaint }}>Delete?</span>
                    <Button
                      size="sm"
                      onClick={() => { handleRemove(); setConfirmDelete(false); }}
                      style={{ background: T.error, color: T.white, fontFamily: font.ui, fontSize: S.sm, fontWeight: 500 }}
                    >
                      Yes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDelete(false)}
                      style={{ fontFamily: font.ui, fontSize: S.sm, fontWeight: 500, color: T.inkSoft }}
                    >
                      No
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Delete resume"
                    title="Remove resume"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2Icon size={14} color={T.error} aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
            {profile.summary && (
              <p style={{ fontFamily: font.ui, fontSize: S.md, lineHeight: "24px", color: T.inkFaint, margin: 0 }}>{profile.summary}</p>
            )}
            {truncated && (
              <p style={{ fontFamily: font.ui, fontSize: S.sm, color: T.warningInk, margin: 0 }}>
                Your resume was long — analysis ran on a truncated excerpt.
              </p>
            )}
            {profile.careerTrajectory && (
              <div style={{ background: T.indigo100, border: `1px solid ${T.indigoRing}`, borderRadius: 10, padding: "10px 14px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 8, background: T.indigo, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <TargetIcon size={10} color={T.white} aria-hidden="true" />
                  </div>
                  <p style={{ fontFamily: font.ui, fontSize: S.base, fontWeight: 600, color: T.indigoDeep, margin: 0 }}>Career objective</p>
                </div>
                <p style={{ fontFamily: font.ui, fontSize: S.md, lineHeight: "22px", color: T.inkFaint, margin: 0 }}>{profile.careerTrajectory}</p>
              </div>
            )}
          </SectionCard>

          {/* Strengths */}
          {profile.interviewStrengths.length > 0 && (
            <SectionCard>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheckIcon size={16} color={T.coal} aria-hidden="true" />
                <h2 style={{ fontFamily: font.ui, fontSize: S.lg, fontWeight: 700, color: T.coal, margin: 0 }}>Strengths</h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {profile.interviewStrengths.map((text, i) => {
                  const Icon = STRENGTH_ICONS[i % STRENGTH_ICONS.length];
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <Icon size={18} color={T.inkFaintWeak} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
                      <p style={{ fontFamily: font.ui, fontSize: S.md, lineHeight: "21px", color: T.inkFaint, margin: 0, flex: 1 }}>{text}</p>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* Metric cards */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <SectionCard style={{ flex: "1 1 160px", minWidth: 160 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <BarChart3Icon size={16} color={T.inkFaint} aria-hidden="true" />
                  <p style={{ fontFamily: font.ui, fontSize: S.sm, fontWeight: 500, color: T.inkFaint, margin: 0 }}>Resume quality</p>
                </div>
                <Badge style={{ background: metricColor[qualityTone].chipBg, color: metricColor[qualityTone].chipText, borderRadius: 999, fontFamily: font.ui, fontWeight: 600, fontSize: S.xs, padding: "2px 8px" }}>
                  {scoreChipLabel(qualityTone)}
                </Badge>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontFamily: font.ui, fontSize: 32, fontWeight: 700, color: T.coal }}>{qualityScore}</span>
                  <span style={{ fontFamily: font.ui, fontSize: S.md, color: T.inkFaint }}>/ 100</span>
                </div>
                <ProgressBar value={qualityScore} max={100} color={metricColor[qualityTone].bar} label={`Resume quality: ${qualityScore} out of 100`} />
              </div>
            </SectionCard>
            <SectionCard style={{ flex: "1 1 160px", minWidth: 160 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FilterIcon size={16} color={T.inkFaint} aria-hidden="true" />
                  <p style={{ fontFamily: font.ui, fontSize: S.sm, fontWeight: 500, color: T.inkFaint, margin: 0 }}>ATS readiness</p>
                </div>
                <Badge style={{ background: metricColor[atsTone].chipBg, color: metricColor[atsTone].chipText, borderRadius: 999, fontFamily: font.ui, fontWeight: 600, fontSize: S.xs, padding: "2px 8px" }}>
                  {atsResult ? scoreChipLabel(atsTone) : "Unavailable"}
                </Badge>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontFamily: font.ui, fontSize: 32, fontWeight: 700, color: T.coal }}>{atsResult?.score ?? "–"}</span>
                  <span style={{ fontFamily: font.ui, fontSize: S.md, color: T.inkFaint }}>/ 100</span>
                </div>
                <ProgressBar value={atsResult?.score ?? 0} max={100} color={metricColor[atsTone].bar} label={`ATS readiness: ${atsResult?.score ?? 0} out of 100`} />
              </div>
            </SectionCard>
            <SectionCard style={{ flex: "1 1 160px", minWidth: 160 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <MicIcon size={16} color={T.inkFaint} aria-hidden="true" />
                  <p style={{ fontFamily: font.ui, fontSize: S.sm, fontWeight: 500, color: T.inkFaint, margin: 0 }}>Interview coverage</p>
                </div>
                <Badge style={{ background: metricColor[coverageTone].chipBg, color: metricColor[coverageTone].chipText, borderRadius: 999, fontFamily: font.ui, fontWeight: 600, fontSize: S.xs, padding: "2px 8px" }}>
                  {coverageChip}
                </Badge>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontFamily: font.ui, fontSize: 32, fontWeight: 700, color: T.coal }}>{coveredCount}</span>
                  <span style={{ fontFamily: font.ui, fontSize: S.md, color: T.inkFaint }}>/ {coverageRows.length}</span>
                </div>
                <ProgressBar value={coveredCount} max={coverageRows.length} color={metricColor[coverageTone].bar} label={`Interview coverage: ${coveredCount} out of ${coverageRows.length}`} />
              </div>
            </SectionCard>
          </div>

          {/* Score breakdown */}
          {profile.scoreBreakdown && (
            <SectionCard>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BarChart3Icon size={16} color={T.coal} aria-hidden="true" />
                <h2 style={{ fontFamily: font.ui, fontSize: S.lg, fontWeight: 700, color: T.coal, margin: 0 }}>Score Breakdown</h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {scoreBreakdownRows.map((row) => (
                  <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
                    <p style={{ fontFamily: font.ui, fontSize: S.base, color: T.inkSoft, margin: 0, width: 180, flexShrink: 0 }}>{row.label}</p>
                    <div style={{ flex: 1 }}>
                      <ProgressBar value={row.value} max={row.max} color={metricColor[row.tone].bar} trackColor={T.creamSoft} label={`${row.label}: ${row.value} out of ${row.max}`} />
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 2, width: 48, flexShrink: 0, justifyContent: "flex-end" }}>
                      <span style={{ fontFamily: font.ui, fontSize: S.base, fontWeight: 600, color: T.coal }}>{row.value}</span>
                      <span style={{ fontFamily: font.ui, fontSize: S.xs, color: T.inkFaint }}>/{row.max}</span>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Improvements */}
          {profile.improvements && profile.improvements.length > 0 && (
            <SectionCard style={{ boxShadow: shadows.card }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: T.creamSoft, border: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <SparklesIcon size={16} color={T.coal} aria-hidden="true" />
                </div>
                <div>
                  <h2 style={{ fontFamily: font.ui, fontSize: S.lg, fontWeight: 700, color: T.coal, margin: 0 }}>Resume improvements ({profile.improvements.length})</h2>
                </div>
              </div>
              <div style={{ height: 1, background: T.line }} />
              <div>
                {profile.improvements.map((text, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 0" }}>
                      <div style={{ width: 24, height: 24, borderRadius: 12, background: T.creamSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                        <span style={{ fontFamily: font.ui, fontSize: S.xs, fontWeight: 700, color: T.inkSoft }}>{i + 1}</span>
                      </div>
                      <p style={{ fontFamily: font.ui, fontSize: S.md, lineHeight: "22px", color: T.inkSoft, margin: 0, flex: 1 }}>{text}</p>
                    </div>
                    {i < profile.improvements!.length - 1 && <div style={{ height: 1, background: T.creamSoft }} />}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Experience */}
          {experiences.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <BriefcaseIcon size={16} color={T.coal} aria-hidden="true" />
                  <h2 style={{ fontFamily: font.ui, fontSize: S.xl, fontWeight: 700, color: T.coal, margin: 0 }}>Experience</h2>
                </div>
                <p style={{ fontFamily: font.ui, fontSize: S.md, color: T.inkFaint, margin: 0 }}>
                  {experiences.length} role{experiences.length === 1 ? "" : "s"}
                  {typeof profile.yearsExperience === "number" ? ` · ${profile.yearsExperience}+ years` : ""}
                </p>
              </div>
              {experiences.map((job, i) => (
                <div key={`${job.title}-${i}`} style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 12, padding: 20, boxShadow: shadows.card, width: "100%" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                      <h3 style={{ fontFamily: font.ui, fontSize: S.lg, fontWeight: 600, color: T.coal, margin: 0, flex: 1 }}>
                        {job.title}{job.company ? ` · ${job.company}` : ""}
                      </h3>
                      <p style={{ fontFamily: font.ui, fontSize: S.base, fontWeight: 500, color: T.inkFaint, margin: 0, whiteSpace: "nowrap" }}>
                        {job.start || job.end ? `${job.start || "?"} - ${job.end || "Present"}` : ""}
                      </p>
                    </div>
                    {(job.scope || (job.topProjects && job.topProjects.length > 0)) && (
                      <p style={{ fontFamily: font.ui, fontSize: S.md, lineHeight: "24px", color: T.inkFaint, margin: 0 }}>
                        {job.scope || job.topProjects.join("; ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: "1 1 420px", maxWidth: 550, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Focus areas */}
          {profile.interviewGaps.length > 0 && (
            <SectionCard>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TargetIcon size={16} color={T.coal} aria-hidden="true" />
                <h2 style={{ fontFamily: font.ui, fontSize: S.lg, fontWeight: 700, color: T.coal, margin: 0 }}>Focus Areas</h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {profile.interviewGaps.map((text, i) => {
                  const Icon = FOCUS_ICONS[i % FOCUS_ICONS.length];
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <Icon size={18} color={T.inkFaintWeak} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
                      <p style={{ fontFamily: font.ui, fontSize: S.md, lineHeight: "21px", color: T.inkFaint, margin: 0, flex: 1 }}>{text}</p>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* ATS readiness */}
          <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 16, boxShadow: shadows.card, width: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: T.creamSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ShieldCheckIcon size={16} color={T.coal} aria-hidden="true" />
                  </div>
                  <div>
                    <h2 style={{ fontFamily: font.ui, fontSize: S.lg, fontWeight: 700, color: T.coal, margin: 0 }}>ATS Readiness</h2>
                    <p style={{ fontFamily: font.ui, fontSize: S.sm, color: T.inkFaint, margin: 0 }}>Score snapshot</p>
                  </div>
                </div>
                {atsResult && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, background: metricColor[atsTone].chipBg, border: `1px solid ${T.warningLine}`, borderRadius: 999, padding: "6px 12px" }}>
                    <span style={{ fontFamily: font.ui, fontSize: S.xl, fontWeight: 700, color: metricColor[atsTone].chipText }}>{atsResult.score}</span>
                    <span style={{ fontFamily: font.ui, fontSize: S.sm, fontWeight: 500, color: metricColor[atsTone].chipText }}>/ 100</span>
                  </div>
                )}
              </div>
              {atsResult ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <ProgressBar value={atsResult.score} max={100} color={metricColor[atsTone].bar} trackColor={T.creamSoft} height={8} label={`ATS readiness score: ${atsResult.score} out of 100`} />
                  <p style={{ fontFamily: font.ui, fontSize: S.sm, color: T.inkFaint, margin: 0 }}>{atsResult.label}</p>
                </div>
              ) : (
                <p style={{ fontFamily: font.ui, fontSize: S.sm, color: T.inkFaint, margin: 0 }}>
                  Re-upload your resume to see an ATS readiness score.
                </p>
              )}
            </div>
            {atsResult && (
              <>
                <div style={{ height: 1, background: T.line }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px 20px 20px" }}>
                  <div style={{ background: T.creamSoft, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <p style={{ fontFamily: font.ui, fontSize: S.base, fontWeight: 700, color: T.coal, margin: 0 }}>Found ({atsResult.found.length})</p>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      {atsResult.found.map((item) => (
                        <div key={item} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 18, height: 18, borderRadius: 9, background: T.success100, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <CheckIcon size={10} color={T.successInk} aria-hidden="true" />
                          </div>
                          <p style={{ fontFamily: font.ui, fontSize: S.base, color: T.inkSoft, margin: 0 }}>{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {atsResult.suggestions.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {atsResult.suggestions.map((s, i) => (
                        <div key={i} style={{ background: T.warning100, borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 18, height: 18, borderRadius: 9, background: T.white, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <LightbulbIcon size={10} color={T.warningInk} aria-hidden="true" />
                          </div>
                          <p style={{ fontFamily: font.ui, fontSize: S.base, color: T.inkSoft, margin: 0, flex: 1 }}>{s}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {atsResult.missing.length > 0 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: T.error100, borderRadius: 12, padding: 14 }}>
                      <div style={{ width: 18, height: 18, borderRadius: 9, background: T.white, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                        <AlertCircleIcon size={10} color={T.error} aria-hidden="true" />
                      </div>
                      <p style={{ fontFamily: font.ui, fontSize: S.base, color: T.inkSoft, margin: 0, flex: 1 }}>
                        Missing: {atsResult.missing.join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Skills & achievements */}
          {(coreSkills.length > 0 || profile.keyAchievements.length > 0) && (
            <SectionCard style={{ padding: "20px 24px", boxShadow: shadows.card }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ToolboxIcon size={16} color={T.coal} aria-hidden="true" />
                    <h2 style={{ fontFamily: font.ui, fontSize: S.lg, fontWeight: 700, color: T.coal, margin: 0 }}>Skills & Achievements</h2>
                  </div>
                  <div style={{ background: T.creamSoft, border: `1px solid ${T.line}`, borderRadius: 999, padding: "3px 8px" }}>
                    <span style={{ fontFamily: font.ui, fontSize: S.sm, fontWeight: 500, color: T.inkFaint }}>{coreSkills.length} skills · {profile.keyAchievements.length} achievements</span>
                  </div>
                </div>
              </div>
              <div style={{ height: 1, background: T.line }} />
              {coreSkills.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontFamily: font.ui, fontSize: S.xs, fontWeight: 700, color: T.inkFaint, margin: 0 }}>Skills</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {coreSkills.map((skill) => (
                      <div key={skill.name} style={{ display: "flex", alignItems: "center", gap: 8, background: T.white, border: `1px solid ${T.line}`, borderRadius: 999, padding: "6px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ fontFamily: font.ui, fontSize: S.sm, fontWeight: 500, color: T.inkSoft }}>{skill.name}</span>
                          {skill.yearsUsed != null && <span style={{ fontFamily: font.ui, fontSize: S.xs, color: T.inkFaint }}>{skill.yearsUsed}Y</span>}
                        </div>
                        <div style={{ background: T.indigo100, borderRadius: 999, padding: "3px 6px" }}>
                          <span style={{ fontFamily: font.ui, fontSize: S.xs, fontWeight: 700, color: T.indigoDeep, letterSpacing: "0.4px", textTransform: "uppercase" }}>{DEPTH_LABEL[skill.depth] ?? skill.depth}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {profile.keyAchievements.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontFamily: font.ui, fontSize: S.xs, fontWeight: 700, color: T.inkFaint, margin: 0 }}>Key Achievements</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {profile.keyAchievements.map((text, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: T.creamSoft, borderRadius: 10, padding: "10px 12px" }}>
                        <div style={{ width: 24, height: 24, borderRadius: 12, background: T.white, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontFamily: font.ui, fontSize: S.xs, fontWeight: 700, color: T.inkSoft }}>{i + 1}</span>
                        </div>
                        <p style={{ fontFamily: font.ui, fontSize: S.md, lineHeight: "22px", color: T.inkSoft, margin: 0, flex: 1 }}>{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {/* Practice next */}
          {coverageRows.length > 0 && (
            <SectionCard>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <MicIcon size={16} color={T.coal} aria-hidden="true" />
                    <h2 style={{ fontFamily: font.ui, fontSize: S.lg, fontWeight: 700, color: T.coal, margin: 0 }}>Practice next</h2>
                  </div>
                  <p style={{ fontFamily: font.ui, fontSize: S.base, color: T.inkFaint, margin: "2px 0 0" }}>Questions matched to resume</p>
                </div>
                <Badge style={{ background: metricColor[coverageTone].chipBg, color: metricColor[coverageTone].chipText, borderRadius: 999, fontFamily: font.ui, fontWeight: 600, fontSize: S.sm, padding: "4px 10px" }}>
                  {coveredCount} / {coverageRows.length} covered
                </Badge>
              </div>
              <div style={{ height: 1, background: T.line }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ fontFamily: font.ui, fontSize: S.sm, fontWeight: 600, color: T.inkFaint, margin: 0 }}>Coverage tracks</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {coverageRows.map((track) => {
                    const tone: MetricTone = track.band === "good" || track.band === "excellent" ? "good" : track.band === "fair" ? "warning" : "error";
                    return (
                      <div key={track.type} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: metricColor[tone].bar, flexShrink: 0 }} />
                        <p style={{ fontFamily: font.ui, fontSize: S.base, color: T.inkSoft, margin: 0, flex: 1 }}>{track.label}</p>
                        <Badge style={{ background: metricColor[tone].chipBg, color: metricColor[tone].chipText, borderRadius: 999, fontFamily: font.ui, fontWeight: 600, fontSize: S.sm, padding: "4px 8px" }}>
                          {track.score}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <SidebarProvider style={{ width: "100%", maxWidth: 1728, height: "100vh", background: T.creamSoft, fontFamily: font.ui }}>
        <AppSidebar name={name} email={email} />
        <SidebarInset style={{ background: T.creamSoft, minHeight: 0 }}>
          <TopBar />
          <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 16px 16px" }}>
            {body}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
