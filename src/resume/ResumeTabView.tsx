"use client";
/**
 * Cream-mode Resume tab view — pure presentational component for the
 * redesigned Resume tab. Mirrors the canvas at
 * tempo/designs/canvases/resume/ResumeTab.tsx.
 *
 * All state, network calls, and side effects live in DashboardResume.tsx.
 * This component takes typed props and renders the four phase variants
 * (idle / extracting / analyzing / error / done) in the cream + indigo
 * + copper palette.
 *
 * Discipline rule: Indigo is interactive · Copper is editorial · Never mix.
 */
import type { ReactNode, CSSProperties, RefObject } from "react";
import type { ResumeProfile } from "../dashboardData";
import type { FitnessBand, InterviewType, FitnessScore } from "../resumeFitness";

/* ─── Cream palette — mirrors design-system/_tokens.ts ─────────────── */
const t = {
  cream: "#FAF7F0",
  creamSoft: "#F4EFE3",
  white: "#FFFFFF",
  coal: "#0E0C08",
  inkSoft: "#6E6759",
  inkFaint: "#A39C8B",
  indigo: "#312E81",
  indigoDeep: "#1E1B4B",
  indigo100: "#E5E2F2",
  copper: "#B45309",
  copper100: "#F4E5D8",
  copperSoft: "rgba(180, 83, 9, 0.12)",
  copperLight: "#E8D5AE",
  successBorder: "rgba(21,128,61,0.22)",
  warningBorder: "rgba(161,98,7,0.22)",
  errorBorder: "rgba(185,28,28,0.22)",
  success: "#15803D",
  success100: "#DCFCE7",
  warning: "#A16207",
  warning100: "#FEF3C7",
  error: "#B91C1C",
  error100: "#FEE2E2",
  line: "#EBE5D2",
  lineStrong: "#D6CDB5",
};
const f = {
  serif: "'Instrument Serif', Georgia, serif",
  sans: "'Satoshi', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
};
const cardShadow =
  "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)";

/* ─── ATS shape (mirrors DashboardResume's local ATSResult) ────────── */
export interface ATSResult {
  score: number;
  label: string;
  found: string[];
  missing: string[];
  suggestions: string[];
}

/* ─── Props ────────────────────────────────────────────────────────── */
export interface ResumeTabViewProps {
  phase: "idle" | "extracting" | "analyzing" | "done" | "error";
  profile: ResumeProfile | null;
  analysisSource: "ai" | "fallback" | null;
  targetRole?: string;
  fileName: string | null;
  fileSizeKb?: number | null;
  lastAnalysedLabel?: string | null;
  errorMsg: string;
  needsReupload: boolean;
  truncated: boolean;

  /* Reanalyze */
  reanalyzing: boolean;
  reanalyzeDone: boolean;
  onReanalyze: () => void;

  /* Delete */
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  onRemove: () => void;

  /* Upload */
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  onTriggerUpload: () => void;
  onDropFile: (file: File | undefined) => void;
  fileInputRef?: RefObject<HTMLInputElement | null>;

  /* Polish — per-improvement state */
  polished: Record<
    number,
    { state: "loading" | "done" | "error"; rewrite?: string; rationale?: string; error?: string }
  >;
  onPolishBullet: (i: number, text: string) => void;
  onApplyPolish: (i: number, rewrite: string) => void;
  onDismissPolish: (i: number) => void;

  /* Domain — for upload empty-state tagging */
  domain: string;
  setDomain: (v: string) => void;
  customDomain: string;
  setCustomDomain: (v: string) => void;

  /* ATS */
  atsResult: ATSResult | null;

  /* Interview coverage — derived from computeAllFitness in the parent */
  coverage: Array<{ label: string; band: FitnessBand; score: number; type: InterviewType }>;

  /* Error-state recovery */
  onDismissError: () => void;

  /* Fallback re-analyze (used when analysisSource === "fallback" with text) */
  resumeText: string;
}

/* ─── Reusable bits ────────────────────────────────────────────────── */

function SectionCard({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: t.white,
        borderRadius: 16,
        border: `1px solid ${t.line}`,
        boxShadow: cardShadow,
        padding: "22px 24px",
        marginBottom: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  icon,
  label,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  trailing?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <h3 style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal, margin: 0, letterSpacing: "-0.005em" }}>
          {label}
        </h3>
      </div>
      {trailing}
    </div>
  );
}

function BandLabel({ text, pre }: { text: string; pre?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "32px 0 14px", padding: "0 4px" }}>
      <span
        style={{
          fontFamily: f.sans,
          fontSize: 11,
          fontWeight: 700,
          color: t.copper,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}
      >
        {text}
      </span>
      {pre && (
        <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, lineHeight: 1.45 }}>
          — {pre}
        </span>
      )}
      <div style={{ flex: 1, height: 1, background: t.line }} />
    </div>
  );
}

interface StatTileProps {
  label: string;
  value: ReactNode;
  qualifier: string;
  qualifierColor: string;
  bar?: { pct: number; color: string };
}
function StatTile({ label, value, qualifier, qualifierColor, bar }: StatTileProps) {
  return (
    <div
      style={{
        background: t.white,
        borderRadius: 14,
        border: `1px solid ${t.line}`,
        boxShadow: cardShadow,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <span
        style={{
          fontFamily: f.sans,
          fontSize: 11,
          fontWeight: 700,
          color: t.inkSoft,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: f.serif, fontSize: 36, fontWeight: 400, color: t.coal, lineHeight: 1, letterSpacing: "-0.02em" }}>
          {value}
        </span>
        <span style={{ fontFamily: f.sans, fontSize: 12, color: qualifierColor, fontWeight: 600 }}>
          {qualifier}
        </span>
      </div>
      {bar && (
        <div style={{ height: 4, background: t.creamSoft, borderRadius: 999, overflow: "hidden", marginTop: 4 }}>
          <div style={{ height: "100%", width: `${bar.pct}%`, background: bar.color, borderRadius: 999 }} />
        </div>
      )}
    </div>
  );
}

const PageShell = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      background: t.cream,
      minHeight: "100%",
      color: t.coal,
      fontFamily: f.sans,
      padding: "16px 24px 64px",
    }}
  >
    <div style={{ maxWidth: 980, margin: "0 auto" }}>{children}</div>
  </div>
);

/* ─── Coverage helpers ─────────────────────────────────────────────── */

const BAND_COLOR: Record<FitnessBand, string> = {
  excellent: t.success,
  good: t.success,
  fair: t.warning,
  low: t.error,
};

const BAND_LABEL: Record<FitnessBand, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  low: "Low",
};

function isStrongBand(b: FitnessBand): boolean {
  return b === "excellent" || b === "good";
}

/* ─── Polish helpers ───────────────────────────────────────────────── */

function improvementText(tip: unknown): string {
  if (typeof tip === "string") return tip;
  if (tip && typeof tip === "object") {
    const vals = Object.values(tip as Record<string, unknown>).filter(
      (v): v is string => typeof v === "string",
    );
    return vals.join(" — ");
  }
  return String(tip ?? "");
}

/* ─── Loading + Error + Idle (empty) renders ───────────────────────── */

function LoadingState({ phase, fileName }: { phase: "extracting" | "analyzing"; fileName: string | null }) {
  return (
    <PageShell>
      <SectionCard
        style={{
          textAlign: "center",
          padding: "60px 40px",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            margin: "0 auto 24px",
            background: t.copper100,
            border: `1px solid ${t.copperSoft}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              border: `2.5px solid ${t.copper100}`,
              borderTopColor: t.copper,
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
        </div>
        <h2
          style={{
            fontFamily: f.serif,
            fontSize: 28,
            fontWeight: 400,
            color: t.coal,
            margin: "0 0 8px",
            letterSpacing: "-0.02em",
          }}
        >
          {phase === "extracting" ? "Reading your resume" : "Building your profile"}
        </h2>
        <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, lineHeight: 1.6, maxWidth: 440, margin: "0 auto" }}>
          {phase === "extracting"
            ? `Extracting text from ${fileName || "your document"}…`
            : "We're analysing your experience, skills, and achievements to build a personalised candidate profile."}
        </p>
        {phase === "analyzing" && (
          <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 12 }}>
            This usually takes 10–20 seconds.
          </p>
        )}
        {fileName && (
          <div
            style={{
              marginTop: 20,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: t.creamSoft,
              borderRadius: 8,
              padding: "8px 14px",
              border: `1px solid ${t.line}`,
            }}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span style={{ fontFamily: f.sans, fontSize: 12, color: t.coal }}>{fileName}</span>
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}

function ErrorState({
  errorMsg,
  onTriggerUpload,
  onDismissError,
}: {
  errorMsg: string;
  onTriggerUpload: () => void;
  onDismissError: () => void;
}) {
  return (
    <PageShell>
      <header style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontFamily: f.serif,
            fontSize: "clamp(2.25rem, 4vw, 3rem)",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            fontWeight: 400,
            color: t.coal,
            margin: 0,
          }}
        >
          Your <em style={{ fontStyle: "italic", fontWeight: 400, color: t.copper }}>resume</em>
        </h1>
      </header>
      <SectionCard style={{ textAlign: "center", padding: "32px 28px" }}>
        <div
          role="alert"
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            margin: "0 auto 16px",
            background: t.error100,
            border: `1px solid ${t.errorBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={t.error} strokeWidth="1.8">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <p style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 600, color: t.coal, margin: "0 0 4px" }}>
          Couldn&apos;t process this file
        </p>
        <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: "0 0 20px" }}>{errorMsg}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            type="button"
            onClick={onTriggerUpload}
            style={{
              fontFamily: f.sans,
              fontSize: 13,
              fontWeight: 600,
              color: t.white,
              background: t.indigo,
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            Try another file
          </button>
          <button
            type="button"
            onClick={onDismissError}
            style={{
              fontFamily: f.sans,
              fontSize: 13,
              fontWeight: 500,
              color: t.inkSoft,
              background: "transparent",
              border: `1px solid ${t.line}`,
              borderRadius: 8,
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      </SectionCard>
    </PageShell>
  );
}

function IdleState({
  isDragging,
  setIsDragging,
  onTriggerUpload,
  onDropFile,
  domain,
  setDomain,
  customDomain,
  setCustomDomain,
}: Pick<
  ResumeTabViewProps,
  "isDragging" | "setIsDragging" | "onTriggerUpload" | "onDropFile" | "domain" | "setDomain" | "customDomain" | "setCustomDomain"
>) {
  return (
    <PageShell>
      <header style={{ marginBottom: 24, textAlign: "center" }}>
        <h1
          style={{
            fontFamily: f.serif,
            fontSize: "clamp(2.25rem, 4vw, 3rem)",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            fontWeight: 400,
            color: t.coal,
            margin: 0,
          }}
        >
          Add your <em style={{ fontStyle: "italic", fontWeight: 400, color: t.copper }}>resume</em>
        </h1>
        <p
          style={{
            fontFamily: f.sans,
            fontSize: 15,
            color: t.inkSoft,
            marginTop: 12,
            lineHeight: 1.55,
            maxWidth: 540,
            marginLeft: "auto",
            marginRight: "auto",
            textWrap: "balance",
          }}
        >
          One upload powers everything else — interview questions, fitness scores, coaching nudges. We&apos;ll read it once and never ask again.
        </p>
      </header>

      <SectionCard style={{ padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <label
            htmlFor="resume-domain"
            style={{
              fontFamily: f.sans,
              fontSize: 11,
              fontWeight: 700,
              color: t.inkSoft,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Tag for
          </label>
          <select
            id="resume-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            style={{
              fontFamily: f.sans,
              fontSize: 12,
              color: t.coal,
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 8,
              padding: "6px 10px",
              minHeight: 30,
            }}
          >
            <option value="general">General</option>
            <option value="sde">Software Engineering</option>
            <option value="pm">Product Management</option>
            <option value="design">Design</option>
            <option value="sales">Sales</option>
            <option value="marketing">Marketing</option>
            <option value="ops">Operations</option>
            <option value="hr">HR / People</option>
            <option value="data">Data / Analytics</option>
            <option value="custom">Custom…</option>
          </select>
          {domain === "custom" && (
            <input
              type="text"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value.slice(0, 32))}
              placeholder="e.g. Solutions Engineering"
              aria-label="Custom domain name"
              style={{
                fontFamily: f.sans,
                fontSize: 12,
                color: t.coal,
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 8,
                padding: "6px 10px",
                minHeight: 30,
                maxWidth: 200,
              }}
            />
          )}
        </div>

        <div
          role="button"
          tabIndex={0}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            onDropFile(e.dataTransfer.files[0]);
          }}
          onClick={onTriggerUpload}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onTriggerUpload();
            }
          }}
          style={{
            border: `2px dashed ${isDragging ? t.indigo : t.lineStrong}`,
            background: isDragging ? t.indigo100 : t.creamSoft,
            borderRadius: 14,
            padding: "44px 24px",
            textAlign: "center",
            cursor: "pointer",
            transition: "background 160ms ease, border-color 160ms ease",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              margin: "0 auto 14px",
              background: t.copper100,
              border: `1px solid ${t.copperSoft}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div style={{ fontFamily: f.sans, fontSize: 17, fontWeight: 600, color: t.coal, lineHeight: 1.3 }}>
            Drag a file here, or <span style={{ color: t.indigo, textDecoration: "underline", textUnderlineOffset: 3 }}>browse</span>
          </div>
          <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 6 }}>
            PDF, DOC, DOCX, or TXT · up to 10 MB
          </div>
        </div>

        {/* Trust pills */}
        <ul
          aria-label="How we handle your resume"
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 8,
            margin: "16px 0 0",
            padding: 0,
            listStyle: "none",
          }}
        >
          {[
            { label: "Encrypted in transit (TLS)" },
            { label: "Never sold or shared" },
            { label: "Delete any time" },
          ].map((p) => (
            <li
              key={p.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                background: t.creamSoft,
                border: `1px solid ${t.line}`,
                borderRadius: 999,
                fontFamily: f.sans,
                fontSize: 12,
                color: t.inkSoft,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
              {p.label}
            </li>
          ))}
        </ul>
      </SectionCard>
    </PageShell>
  );
}

/* ─── Done state — populated ───────────────────────────────────────── */

function DoneState(props: ResumeTabViewProps) {
  const {
    profile,
    analysisSource,
    targetRole,
    fileName,
    fileSizeKb,
    lastAnalysedLabel,
    errorMsg,
    needsReupload,
    truncated,
    reanalyzing,
    reanalyzeDone,
    onReanalyze,
    confirmDelete,
    setConfirmDelete,
    onRemove,
    onTriggerUpload,
    polished,
    onPolishBullet,
    onApplyPolish,
    onDismissPolish,
    atsResult,
    coverage,
    onDismissError,
    resumeText,
  } = props;

  const coverageStrong = coverage.filter((c) => isStrongBand(c.band)).length;
  const coverageNeedsWork = coverage.length - coverageStrong;

  // Derived headline — strip the "with X years of …" tail the LLM tends
  // to produce. The seniority + years already render as badges.
  const fullHeadline = profile?.headline || "";
  const roleOnly = fullHeadline
    .split(/\s+(?:with|,|—|–|\||·)\s+/i)[0]
    .replace(/^(?:a|an|the)\s+/i, "")
    .trim();
  const headlineDisplay = roleOnly || fullHeadline || "Resume uploaded";

  const resumeScore = typeof profile?.resumeScore === "number" ? profile.resumeScore : null;
  const qualityQualifier = resumeScore == null
    ? "Pending"
    : resumeScore >= 80
    ? "Strong"
    : resumeScore >= 65
    ? "Solid"
    : resumeScore >= 50
    ? "Needs work"
    : "Weak";
  const qualityColor = resumeScore == null
    ? t.inkSoft
    : resumeScore >= 65
    ? t.success
    : resumeScore >= 50
    ? t.warning
    : t.error;

  const atsScore = atsResult?.score ?? null;
  const atsQualifier = atsScore == null
    ? "Add resume text"
    : atsScore >= 85
    ? "Recruiter-ready"
    : atsScore >= 70
    ? "ATS-friendly"
    : atsScore >= 50
    ? "Could improve"
    : "At risk";
  const atsColor = atsScore == null
    ? t.inkSoft
    : atsScore >= 70
    ? t.success
    : atsScore >= 50
    ? t.warning
    : t.error;

  const coveragePct = coverage.length > 0 ? Math.round((coverageStrong / coverage.length) * 100) : 0;
  const experiences = profile?.experiences ?? [];
  const skillsDetailed = profile?.skillsDetailed ?? [];

  return (
    <PageShell>
      {/* Header */}
      <header
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: f.serif,
              fontSize: "clamp(2.25rem, 4vw, 3rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              fontWeight: 400,
              color: t.coal,
              margin: 0,
            }}
          >
            Your <em style={{ fontStyle: "italic", fontWeight: 400, color: t.copper }}>resume</em>
          </h1>
          <p
            style={{
              fontFamily: f.sans,
              fontSize: 15,
              color: t.inkSoft,
              marginTop: 10,
              lineHeight: 1.55,
              maxWidth: 540,
              textWrap: "balance",
            }}
          >
            Your resume drives every interview question, fitness score, and coaching nudge.
            Keep it current — even small edits change what we ask next.
          </p>
        </div>
        {targetRole && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 999,
              padding: "8px 14px",
              boxShadow: cardShadow,
              fontFamily: f.sans,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: t.inkSoft, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Tailored for
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.coal }}>{targetRole}</span>
          </div>
        )}
      </header>

      {/* Active resume hero */}
      <div
        style={{
          background: `linear-gradient(135deg, ${t.white} 0%, ${t.copper100} 160%)`,
          borderRadius: 16,
          border: `1px solid ${t.line}`,
          boxShadow: cardShadow,
          padding: "28px 28px 0",
          marginBottom: 16,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontFamily: f.serif,
                fontSize: 32,
                color: t.coal,
                margin: "0 0 10px",
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
                fontWeight: 400,
              }}
            >
              {headlineDisplay}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {profile?.seniorityLevel && (
                <span
                  style={{
                    fontFamily: f.sans,
                    fontSize: 11,
                    fontWeight: 600,
                    color: t.copper,
                    background: t.copper100,
                    border: `1px solid ${t.copperSoft}`,
                    borderRadius: 6,
                    padding: "3px 10px",
                  }}
                >
                  {profile.seniorityLevel}
                </span>
              )}
              {profile?.yearsExperience != null && profile.yearsExperience > 0 && (
                <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
                  {profile.yearsExperience}+ years experience
                </span>
              )}
              {profile?.industries && profile.industries.length > 0 && (
                <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
                  {profile.industries.join(", ")}
                </span>
              )}
              {analysisSource && (
                <span
                  style={{
                    fontFamily: f.sans,
                    fontSize: 10,
                    fontWeight: 600,
                    color: analysisSource === "ai" ? t.success : t.inkSoft,
                    background: analysisSource === "ai" ? t.success100 : t.creamSoft,
                    border: `1px solid ${analysisSource === "ai" ? t.successBorder : t.line}`,
                    borderRadius: 6,
                    padding: "2px 8px",
                  }}
                >
                  {analysisSource === "ai" ? "AI Profile" : "Basic Extract"}
                </span>
              )}
            </div>
          </div>
        </div>

        {profile?.summary && (
          <p style={{ fontFamily: f.sans, fontSize: 14, color: t.coal, lineHeight: 1.65, margin: "0 0 14px", maxWidth: 720 }}>
            {profile.summary}
          </p>
        )}

        {/* Career trajectory */}
        {profile?.careerTrajectory && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: t.success100,
              border: `1px solid ${t.successBorder}`,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="1.8">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              <span
                style={{
                  fontFamily: f.sans,
                  fontSize: 10,
                  fontWeight: 700,
                  color: t.success,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Career Trajectory
              </span>
            </div>
            <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.55 }}>
              {profile.careerTrajectory}
            </span>
          </div>
        )}

        {/* Truncated warning */}
        {truncated && (
          <div
            role="status"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: t.warning100,
              border: `1px solid ${t.warningBorder}`,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.warning} strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ fontFamily: f.sans, fontSize: 12, color: t.coal }}>
              Your resume was truncated to fit the analysis window. For best results, keep it to 2 pages.
            </span>
          </div>
        )}

        {/* Inline error banner (re-analysis or save errors) */}
        {errorMsg && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: t.error100,
              border: `1px solid ${t.errorBorder}`,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.error} strokeWidth="1.8" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ fontFamily: f.sans, fontSize: 12, color: t.coal, flex: 1 }}>{errorMsg}</span>
            <button
              type="button"
              onClick={onDismissError}
              aria-label="Dismiss error"
              style={{ background: "none", border: "none", color: t.inkSoft, cursor: "pointer", padding: 4, display: "flex" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Fallback notice — basic extract w/ "Re-analyse with AI" */}
        {analysisSource === "fallback" && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: t.copper100,
              border: `1px solid ${t.copperSoft}`,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ fontFamily: f.sans, fontSize: 12, color: t.coal, flex: 1, minWidth: 220 }}>
              {resumeText
                ? "Showing basic extraction. Run AI analysis for a full profile with score and insights."
                : "Resume text not available. Re-upload to get a full AI profile."}
            </span>
            {resumeText ? (
              <button
                type="button"
                onClick={onReanalyze}
                disabled={reanalyzing}
                style={{
                  fontFamily: f.sans,
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.white,
                  background: t.indigo,
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 14px",
                  cursor: reanalyzing ? "default" : "pointer",
                  opacity: reanalyzing ? 0.7 : 1,
                }}
              >
                {reanalyzing ? "Analysing…" : "Re-analyse with AI"}
              </button>
            ) : (
              <button
                type="button"
                onClick={onTriggerUpload}
                style={{
                  fontFamily: f.sans,
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.indigo,
                  background: t.white,
                  border: `1px solid ${t.indigo}`,
                  borderRadius: 8,
                  padding: "6px 14px",
                  cursor: "pointer",
                }}
              >
                Re-upload
              </button>
            )}
          </div>
        )}

        {/* needsReupload nudge — file present but no profile generated */}
        {needsReupload && !profile?.summary && (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 10,
              background: t.copper100,
              border: `1px solid ${t.copperSoft}`,
              marginBottom: 16,
            }}
          >
            <p style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.55, margin: "0 0 10px" }}>
              Your resume was uploaded but the AI summary wasn&apos;t generated. Re-upload it for a detailed profile with strengths and interview prep insights.
            </p>
            <button
              type="button"
              onClick={onTriggerUpload}
              style={{
                fontFamily: f.sans,
                fontSize: 12,
                fontWeight: 600,
                color: t.white,
                background: t.indigo,
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                cursor: "pointer",
              }}
            >
              Re-upload for AI analysis
            </button>
          </div>
        )}

        {/* File metadata bar — full-bleed strip at bottom of hero */}
        {fileName && (
          <div
            style={{
              margin: "0 -28px",
              padding: "14px 28px",
              borderTop: `1px solid ${t.line}`,
              background: t.creamSoft,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", minWidth: 0 }}>
              <div
                aria-hidden="true"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: t.copper100,
                  border: `1px solid ${t.copperSoft}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, lineHeight: 1.3 }}>
                  {fileName}
                </span>
                <span style={{ fontFamily: f.sans, fontSize: 11, color: t.inkSoft, marginTop: 2 }}>
                  {fileSizeKb != null ? `${fileSizeKb} KB · ` : ""}
                  {lastAnalysedLabel ? `last analysed ${lastAnalysedLabel}` : "freshly analysed"}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {reanalyzeDone && (
                <span style={{ fontFamily: f.sans, fontSize: 11, color: t.success, fontWeight: 600, marginRight: 4 }}>
                  Updated ✓
                </span>
              )}
              <button
                type="button"
                onClick={onReanalyze}
                disabled={reanalyzing}
                aria-label="Re-analyse resume"
                title="Re-analyse with AI"
                style={{
                  fontFamily: f.sans,
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.coal,
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: 8,
                  padding: "7px 12px",
                  cursor: reanalyzing ? "default" : "pointer",
                  opacity: reanalyzing ? 0.7 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {reanalyzing ? (
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      border: `2px solid ${t.line}`,
                      borderTopColor: t.copper,
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.inkSoft} strokeWidth="1.8">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                )}
                Re-analyse
              </button>
              <button
                type="button"
                onClick={onTriggerUpload}
                style={{
                  fontFamily: f.sans,
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.indigo,
                  background: t.white,
                  border: `1px solid ${t.indigo}`,
                  borderRadius: 8,
                  padding: "7px 14px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.indigo} strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Replace
              </button>
              {confirmDelete ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: f.sans, fontSize: 12, color: t.error, fontWeight: 600 }}>Delete?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onRemove();
                      setConfirmDelete(false);
                    }}
                    aria-label="Confirm delete resume"
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: t.error,
                      color: t.white,
                      fontFamily: f.sans,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    aria-label="Cancel delete"
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: `1px solid ${t.line}`,
                      background: t.white,
                      color: t.inkSoft,
                      fontFamily: f.sans,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Delete resume"
                  title="Remove resume"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: t.white,
                    border: `1px solid ${t.line}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.error} strokeWidth="1.8">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Readiness Index — at-a-glance answer (only when scores are real) */}
      {profile && (resumeScore != null || atsScore != null || coverage.length > 0) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          {resumeScore != null && (
            <StatTile
              label="Resume Quality"
              value={
                <>
                  {resumeScore}
                  <span style={{ fontSize: 16, fontWeight: 400, color: t.inkFaint, marginLeft: 2 }}>/100</span>
                </>
              }
              qualifier={qualityQualifier}
              qualifierColor={qualityColor}
              bar={{ pct: resumeScore, color: qualityColor }}
            />
          )}
          {atsScore != null && (
            <StatTile
              label="ATS Compatibility"
              value={
                <>
                  {atsScore}
                  <span style={{ fontSize: 16, fontWeight: 400, color: t.inkFaint, marginLeft: 2 }}>/100</span>
                </>
              }
              qualifier={atsQualifier}
              qualifierColor={atsColor}
              bar={{ pct: atsScore, color: atsColor }}
            />
          )}
          {coverage.length > 0 && (
            <StatTile
              label="Interview Coverage"
              value={
                <>
                  {coverageStrong}
                  <span style={{ fontSize: 16, fontWeight: 400, color: t.inkFaint, marginLeft: 2 }}>/{coverage.length}</span>
                </>
              }
              qualifier={coverageNeedsWork === 0 ? "All strong" : `${coverageNeedsWork} need work`}
              qualifierColor={coverageNeedsWork === 0 ? t.success : t.warning}
              bar={{ pct: coveragePct, color: coverageNeedsWork === 0 ? t.success : t.warning }}
            />
          )}
        </div>
      )}

      {/* ─── DIAGNOSE band ────────────────────────────────────────── */}
      {profile && <BandLabel text="Diagnose" pre="What the AI sees on your resume" />}

      {/* Experience timeline — only when profile.experiences[] populated */}
      {experiences.length > 0 && (
        <SectionCard>
          <SectionHeader
            label="Experience"
            icon={
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            }
            trailing={
              <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
                <span style={{ fontWeight: 600, color: t.coal }}>{experiences.length} roles</span>
                {profile?.yearsExperience != null && profile.yearsExperience > 0
                  ? ` · ${profile.yearsExperience}+ years`
                  : ""}
              </span>
            }
          />
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {experiences.map((exp, i) => {
              const isCurrent = (exp.end || "").toLowerCase() === "present";
              const isLast = i === experiences.length - 1;
              return (
                <li key={`${exp.company}-${exp.title}-${i}`} style={{ display: "flex", gap: 16, paddingBottom: isLast ? 0 : 18 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: isCurrent ? t.copper : t.white,
                        border: `2px solid ${isCurrent ? t.copper : t.lineStrong}`,
                        marginTop: 5,
                      }}
                    />
                    {!isLast && <div style={{ width: 2, flex: 1, background: t.line, marginTop: 4 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: isLast ? 0 : 4 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <span style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal }}>
                          {exp.title}
                        </span>
                        <span style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>
                          {" · "}
                          {exp.company}
                        </span>
                      </div>
                      {(exp.start || exp.end) && (
                        <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft }}>
                          {exp.start} {exp.start && exp.end ? "—" : ""} {exp.end}
                        </span>
                      )}
                    </div>
                    {exp.scope && (
                      <p style={{ fontFamily: f.sans, fontSize: 12, color: t.coal, margin: "4px 0 8px", lineHeight: 1.55 }}>
                        {exp.scope}
                      </p>
                    )}
                    {(exp.teamSize != null || exp.partners.length > 0) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {exp.teamSize != null && (
                          <span
                            style={{
                              fontFamily: f.sans,
                              fontSize: 11,
                              fontWeight: 500,
                              color: t.coal,
                              background: t.creamSoft,
                              border: `1px solid ${t.line}`,
                              borderRadius: 999,
                              padding: "2px 9px",
                            }}
                          >
                            Team of {exp.teamSize}
                          </span>
                        )}
                        {exp.partners.map((p) => (
                          <span
                            key={p}
                            style={{
                              fontFamily: f.sans,
                              fontSize: 11,
                              color: t.inkSoft,
                              background: t.creamSoft,
                              border: `1px solid ${t.line}`,
                              borderRadius: 999,
                              padding: "2px 9px",
                            }}
                          >
                            ↔ {p}
                          </span>
                        ))}
                      </div>
                    )}
                    {exp.topProjects.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {exp.topProjects.map((p) => (
                          <div key={p} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <span style={{ width: 4, height: 4, borderRadius: "50%", background: t.copper, marginTop: 7, flexShrink: 0 }} />
                            <span style={{ fontFamily: f.sans, fontSize: 12, color: t.coal, lineHeight: 1.5 }}>{p}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </SectionCard>
      )}

      {/* Strengths · Focus areas */}
      {profile &&
        ((profile.interviewStrengths && profile.interviewStrengths.length > 0) ||
          (profile.interviewGaps && profile.interviewGaps.length > 0)) && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 16,
              marginBottom: 16,
            }}
          >
            {profile.interviewStrengths && profile.interviewStrengths.length > 0 && (
              <div
                style={{
                  background: t.success100,
                  borderRadius: 16,
                  border: `1px solid ${t.successBorder}`,
                  padding: 22,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="1.8">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <h3
                    style={{
                      fontFamily: f.sans,
                      fontSize: 13,
                      fontWeight: 700,
                      color: t.coal,
                      margin: 0,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Strengths
                  </h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {profile.interviewStrengths.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span
                        style={{ width: 6, height: 6, borderRadius: "50%", background: t.success, flexShrink: 0, marginTop: 7 }}
                      />
                      <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.55 }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {profile.interviewGaps && profile.interviewGaps.length > 0 && (
              <div
                style={{
                  background: t.warning100,
                  borderRadius: 16,
                  border: `1px solid ${t.warningBorder}`,
                  padding: 22,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.warning} strokeWidth="1.8">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                  <h3
                    style={{
                      fontFamily: f.sans,
                      fontSize: 13,
                      fontWeight: 700,
                      color: t.coal,
                      margin: 0,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Focus areas
                  </h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {profile.interviewGaps.map((g, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span
                        style={{ width: 6, height: 6, borderRadius: "50%", background: t.warning, flexShrink: 0, marginTop: 7 }}
                      />
                      <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.55 }}>{g}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      {/* ATS — collapsed by default; suggestions inside <details> */}
      {atsResult && (
        <SectionCard>
          <SectionHeader
            label="ATS Compliance"
            icon={
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            }
            trailing={
              <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
                <span style={{ fontFamily: f.mono, fontSize: 13, fontWeight: 700, color: atsColor, marginRight: 4 }}>
                  {atsResult.score}
                </span>
                / 100 · {atsResult.label}
              </span>
            }
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {atsResult.found.length > 0 && (
              <div>
                <span
                  style={{
                    fontFamily: f.sans,
                    fontSize: 11,
                    fontWeight: 700,
                    color: t.inkSoft,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Found
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {atsResult.found.map((item) => (
                    <span
                      key={item}
                      style={{
                        fontFamily: f.sans,
                        fontSize: 11,
                        fontWeight: 500,
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: t.success100,
                        color: t.success,
                        border: `1px solid ${t.successBorder}`,
                      }}
                    >
                      ✓ {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {atsResult.missing.length > 0 && (
              <div>
                <span
                  style={{
                    fontFamily: f.sans,
                    fontSize: 11,
                    fontWeight: 700,
                    color: t.inkSoft,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Missing
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {atsResult.missing.map((item) => (
                    <span
                      key={item}
                      style={{
                        fontFamily: f.sans,
                        fontSize: 11,
                        fontWeight: 500,
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: t.warning100,
                        color: t.warning,
                        border: `1px solid ${t.warningBorder}`,
                      }}
                    >
                      ! {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {atsResult.suggestions.length > 0 && (
            <details style={{ marginTop: 16 }}>
              <summary
                style={{
                  fontFamily: f.sans,
                  fontSize: 12,
                  fontWeight: 600,
                  color: t.indigo,
                  cursor: "pointer",
                  listStyle: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Show {atsResult.suggestions.length} suggestions
                <span style={{ fontSize: 10 }}>▾</span>
              </summary>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {atsResult.suggestions.map((tip, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: t.creamSoft,
                      border: `1px solid ${t.line}`,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: f.mono,
                        fontSize: 10,
                        fontWeight: 700,
                        color: t.copper,
                        background: t.copper100,
                        borderRadius: 5,
                        padding: "2px 7px",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.55 }}>{tip}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </SectionCard>
      )}

      {/* ─── PRACTISE band ────────────────────────────────────────── */}
      {profile && coverage.length > 0 && <BandLabel text="Practise" pre="Where to spend your next session" />}

      {/* Coverage panel */}
      {coverage.length > 0 && (
        <SectionCard>
          <SectionHeader
            label="Interview Coverage"
            icon={
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8">
                <path d="M12 2v20" />
                <path d="M2 12h20" />
              </svg>
            }
            trailing={
              <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
                <span style={{ fontWeight: 600, color: t.coal }}>{coverageStrong}</span> of {coverage.length} tracks at Good+
              </span>
            }
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "12px 24px",
            }}
          >
            {coverage.map((row) => {
              const color = BAND_COLOR[row.band];
              return (
                <div key={row.label}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.4 }}>{row.label}</span>
                    <span
                      style={{
                        fontFamily: f.sans,
                        fontSize: 10,
                        fontWeight: 700,
                        color,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {BAND_LABEL[row.band]}
                    </span>
                  </div>
                  <div style={{ height: 6, background: t.creamSoft, borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${row.score}%`, background: color, borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* ─── IMPROVE band ─────────────────────────────────────────── */}
      {profile?.improvements && profile.improvements.length > 0 && (
        <BandLabel text="Improve" pre="Concrete edits to lift your score" />
      )}

      {/* Improvements with Polish */}
      {profile?.improvements && profile.improvements.length > 0 && (
        <SectionCard>
          <SectionHeader
            label="How to lift your score"
            icon={
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            }
            trailing={
              <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
                Each fix typically adds <span style={{ fontWeight: 600, color: t.success }}>3–6 pts</span>
              </span>
            }
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {profile.improvements.map((tip, i) => {
              const text = improvementText(tip);
              const polishState = polished[i];
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: t.creamSoft,
                    border: `1px solid ${t.line}`,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span
                      style={{
                        fontFamily: f.mono,
                        fontSize: 11,
                        fontWeight: 700,
                        color: t.copper,
                        background: t.copper100,
                        borderRadius: 6,
                        padding: "3px 8px",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.55, flex: 1 }}>{text}</span>
                    <button
                      type="button"
                      onClick={() => onPolishBullet(i, text)}
                      disabled={polishState?.state === "loading"}
                      title="Rewrite with stronger verbs and metrics"
                      style={{
                        fontFamily: f.sans,
                        fontSize: 11,
                        fontWeight: 600,
                        color: t.white,
                        background: t.indigo,
                        border: "none",
                        borderRadius: 6,
                        padding: "5px 12px",
                        cursor: polishState?.state === "loading" ? "wait" : "pointer",
                        flexShrink: 0,
                        opacity: polishState?.state === "loading" ? 0.7 : 1,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {polishState?.state === "loading"
                        ? "…"
                        : polishState?.state === "done"
                        ? "✓ Polished"
                        : "Polish"}
                    </button>
                  </div>
                  {polishState?.state === "done" && polishState.rewrite && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: t.success100,
                        border: `1px solid ${t.successBorder}`,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: f.sans,
                          fontSize: 10,
                          fontWeight: 700,
                          color: t.success,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        Suggested rewrite
                      </span>
                      <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.55 }}>
                        {polishState.rewrite}
                      </span>
                      {polishState.rationale && (
                        <span style={{ fontFamily: f.sans, fontSize: 11, color: t.inkSoft, fontStyle: "italic" }}>
                          {polishState.rationale}
                        </span>
                      )}
                      <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                        <button
                          type="button"
                          onClick={() => onApplyPolish(i, polishState.rewrite!)}
                          style={{
                            fontFamily: f.sans,
                            fontSize: 11,
                            fontWeight: 600,
                            color: t.white,
                            background: t.success,
                            border: "none",
                            borderRadius: 6,
                            padding: "4px 12px",
                            cursor: "pointer",
                          }}
                        >
                          Use this
                        </button>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText(polishState.rewrite!)}
                          style={{
                            fontFamily: f.sans,
                            fontSize: 11,
                            fontWeight: 600,
                            color: t.inkSoft,
                            background: "transparent",
                            border: `1px solid ${t.line}`,
                            borderRadius: 6,
                            padding: "4px 12px",
                            cursor: "pointer",
                          }}
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => onDismissPolish(i)}
                          style={{
                            fontFamily: f.sans,
                            fontSize: 11,
                            color: t.inkSoft,
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "4px 8px",
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}
                  {polishState?.state === "error" && (
                    <span style={{ fontFamily: f.sans, fontSize: 11, color: t.error }}>{polishState.error}</span>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* What's on your resume — collapsed reference */}
      {profile && (profile.topSkills.length > 0 || profile.keyAchievements.length > 0) && (
        <details
          style={{
            background: t.white,
            borderRadius: 16,
            border: `1px solid ${t.line}`,
            boxShadow: cardShadow,
            padding: "18px 24px",
            marginBottom: 16,
          }}
        >
          <summary
            style={{
              listStyle: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <h3 style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal, margin: 0, letterSpacing: "-0.005em" }}>
                What&apos;s on your resume
              </h3>
              <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
                · {profile.topSkills.length} skills · {profile.keyAchievements.length} achievements
              </span>
            </div>
            <span style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 600, color: t.indigo }}>Show ▾</span>
          </summary>

          <div style={{ marginTop: 18 }}>
            <span
              style={{
                fontFamily: f.sans,
                fontSize: 11,
                fontWeight: 700,
                color: t.inkSoft,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Top skills
            </span>
            {skillsDetailed.length > 0 ? (
              <>
                <p style={{ fontFamily: f.sans, fontSize: 11, color: t.inkSoft, margin: "6px 0 10px", lineHeight: 1.5 }}>
                  Depth lets us calibrate question difficulty — primary skills earn deeper probes; exposure-only skills get fundamentals.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                  {skillsDetailed.map((skill) => {
                    const isPrimary = skill.depth === "primary";
                    const isExposure = skill.depth === "exposure";
                    const yearsLabel =
                      skill.depth === "primary"
                        ? skill.yearsUsed
                          ? `${skill.yearsUsed}y · core`
                          : "core"
                        : skill.depth === "exposure"
                        ? "exposure"
                        : skill.yearsUsed
                        ? `${skill.yearsUsed}y`
                        : "secondary";
                    return (
                      <span
                        key={skill.name}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontFamily: f.sans,
                          fontSize: 12,
                          color: isPrimary ? t.copper : isExposure ? t.inkSoft : t.coal,
                          background: isPrimary ? t.copper100 : t.creamSoft,
                          border: `1px solid ${isPrimary ? t.copperSoft : t.line}`,
                          borderRadius: 999,
                          padding: "5px 6px 5px 12px",
                          fontWeight: isPrimary ? 600 : 500,
                          opacity: isExposure ? 0.85 : 1,
                        }}
                      >
                        {skill.name}
                        <span
                          style={{
                            fontFamily: f.mono,
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            color: t.white,
                            background: isPrimary ? t.copper : isExposure ? t.inkFaint : t.inkSoft,
                            borderRadius: 999,
                            padding: "2px 7px",
                          }}
                        >
                          {yearsLabel}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, marginBottom: 18 }}>
                {profile.topSkills.map((skill, i) => (
                  <span
                    key={skill}
                    style={{
                      fontFamily: f.sans,
                      fontSize: 12,
                      color: i < 3 ? t.copper : t.coal,
                      background: i < 3 ? t.copper100 : t.creamSoft,
                      border: `1px solid ${i < 3 ? t.copperSoft : t.line}`,
                      borderRadius: 999,
                      padding: "5px 12px",
                      fontWeight: i < 3 ? 600 : 500,
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}

            {profile.keyAchievements.length > 0 && (
              <>
                <span
                  style={{
                    fontFamily: f.sans,
                    fontSize: 11,
                    fontWeight: 700,
                    color: t.inkSoft,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Key achievements
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                  {profile.keyAchievements.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: 12,
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: t.creamSoft,
                        border: `1px solid ${t.line}`,
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          background: t.copper100,
                          border: `1px solid ${t.copperSoft}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="2.4">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <p style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.55, margin: 0 }}>{item}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </details>
      )}

      {/* Trust footer — quiet by design */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          borderRadius: 10,
          background: "transparent",
          border: `1px solid ${t.line}`,
        }}
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.inkSoft} strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
          Your resume is analysed securely and never shared. Delete anytime.
        </span>
      </div>
    </PageShell>
  );
}

/* ─── Top-level dispatcher ─────────────────────────────────────────── */

export default function ResumeTabView(props: ResumeTabViewProps) {
  const { phase } = props;
  if (phase === "extracting" || phase === "analyzing") {
    return <LoadingState phase={phase} fileName={props.fileName} />;
  }
  if (phase === "error") {
    return (
      <ErrorState
        errorMsg={props.errorMsg}
        onTriggerUpload={props.onTriggerUpload}
        onDismissError={props.onDismissError}
      />
    );
  }
  if (phase === "idle") {
    return (
      <IdleState
        isDragging={props.isDragging}
        setIsDragging={props.setIsDragging}
        onTriggerUpload={props.onTriggerUpload}
        onDropFile={props.onDropFile}
        domain={props.domain}
        setDomain={props.setDomain}
        customDomain={props.customDomain}
        setCustomDomain={props.setCustomDomain}
      />
    );
  }
  return <DoneState {...props} />;
}

/* Re-export the score helper so DashboardResume can map FitnessScore → coverage rows
   without the parent reaching into resumeFitness internals beyond what it already needs. */
export type { FitnessScore };
