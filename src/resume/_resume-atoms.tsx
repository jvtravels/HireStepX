"use client";
/**
 * Editorial design atoms for the Resume tab — extracted so ResumeTabView
 * stays under the file-length lint cap and so the same visual language
 * can be reused if/when other dashboard surfaces adopt it.
 *
 * Mirrors the polish signature established by the auth + onboarding
 * surfaces:
 *   • Display-size serif H1 (40-72px) with one italic-copper accent word
 *   • Mono-uppercase pills for status / metadata
 *   • Section cards with a small mono editorial label up top
 *   • Circular score gauge as a hero focal element
 *
 * Discipline rule: Indigo is interactive · Copper is editorial · Never mix.
 */
import type { ReactNode, CSSProperties } from "react";

const t = {
  cream: "#FAF7F0",
  creamSoft: "#F4EFE3",
  white: "#FFFFFF",
  coal: "#0E0C08",
  inkSoft: "#6E6759",
  inkFaint: "#A39C8B",
  indigo: "#312E81",
  indigo100: "#E5E2F2",
  copper: "#B45309",
  copper100: "#F4E5D8",
  copperSoft: "rgba(180, 83, 9, 0.12)",
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
// cardShadow / tokens / fonts kept module-private — exporting non-component
// values from this file would trip react-refresh fast-refresh boundary.
// If another module needs these, hoist them to a dedicated tokens file.
const cardShadow =
  "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)";

/* ─── DisplayH1 — page-leading editorial headline ──────────────────── */

export interface DisplayH1Props {
  /** Plain text leading the headline (e.g. "Your"). */
  prefix?: string;
  /** The italic copper accent word (e.g. "resume"). */
  accent: string;
  /** Plain text trailing the headline (e.g. "interviews"). */
  suffix?: string;
  /** Whether to nowrap on desktop (matches auth's one-line headline). */
  nowrap?: boolean;
  /** Optional id for aria. */
  id?: string;
}
export function DisplayH1({ prefix, accent, suffix, nowrap = false, id }: DisplayH1Props) {
  return (
    <h1
      id={id}
      style={{
        fontFamily: f.serif,
        fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
        lineHeight: 1.05,
        fontWeight: 400,
        letterSpacing: "-0.02em",
        whiteSpace: nowrap ? "nowrap" : undefined,
        margin: 0,
        color: t.coal,
      }}
    >
      {prefix && <>{prefix} </>}
      <em style={{ fontStyle: "italic", fontWeight: 400, color: t.copper }}>{accent}</em>
      {suffix && <> {suffix}</>}
    </h1>
  );
}

/* ─── MonoPill — uppercase mono editorial chip ─────────────────────── */

export type PillTone = "muted" | "copper" | "indigo" | "success" | "warning" | "error";
export interface MonoPillProps {
  label: string;
  tone?: PillTone;
  icon?: ReactNode;
}
const TONE_BG: Record<PillTone, string> = {
  muted: t.creamSoft,
  copper: t.copper100,
  indigo: t.indigo100,
  success: t.success100,
  warning: t.warning100,
  error: t.error100,
};
const TONE_FG: Record<PillTone, string> = {
  muted: t.inkSoft,
  copper: t.copper,
  indigo: t.indigo,
  success: t.success,
  warning: t.warning,
  error: t.error,
};
const TONE_BORDER: Record<PillTone, string> = {
  muted: t.line,
  copper: t.copperSoft,
  indigo: t.indigo100,
  success: t.successBorder,
  warning: t.warningBorder,
  error: t.errorBorder,
};
export function MonoPill({ label, tone = "muted", icon }: MonoPillProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 11px",
        borderRadius: 999,
        background: TONE_BG[tone],
        border: `1px solid ${TONE_BORDER[tone]}`,
        color: TONE_FG[tone],
        fontFamily: f.mono,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        lineHeight: 1.2,
      }}
    >
      {icon}
      {label}
    </span>
  );
}

/* ─── EditorialSectionCard — card with mono label header ───────────── */

export interface EditorialSectionCardProps {
  label: string;
  trailing?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  /** Padding override — defaults to 22×24. */
  padding?: string | number;
}
export function EditorialSectionCard({
  label,
  trailing,
  children,
  style,
  padding,
}: EditorialSectionCardProps) {
  return (
    <section
      style={{
        background: t.white,
        borderRadius: 14,
        border: `1px solid ${t.line}`,
        boxShadow: cardShadow,
        padding: padding ?? "20px 22px",
        marginBottom: 16,
        ...style,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <span
          style={{
            fontFamily: f.mono,
            fontSize: 11,
            fontWeight: 500,
            color: t.copper,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
          }}
        >
          {label}
        </span>
        {trailing}
      </header>
      {children}
    </section>
  );
}

/* ─── ScoreGauge — circular hero stat ──────────────────────────────── */

export type GaugeTone = "success" | "warning" | "error" | "muted";
export interface ScoreGaugeProps {
  /** 0-100 score. Pass null to render a muted placeholder. */
  score: number | null;
  tone?: GaugeTone;
  label?: string;
  qualifier?: string;
  /** Optional metadata strip rendered below the gauge (chips). */
  meta?: ReactNode;
  /** Outer diameter in px — defaults to 168. */
  size?: number;
}
const TONE_COLOR: Record<GaugeTone, string> = {
  success: t.success,
  warning: t.warning,
  error: t.error,
  muted: t.inkFaint,
};
const TONE_BG_RING: Record<GaugeTone, string> = {
  success: t.success100,
  warning: t.warning100,
  error: t.error100,
  muted: t.creamSoft,
};
function inferTone(score: number | null): GaugeTone {
  if (score == null) return "muted";
  if (score >= 70) return "success";
  if (score >= 50) return "warning";
  return "error";
}
export function ScoreGauge({
  score,
  tone,
  label = "Resume Quality",
  qualifier,
  meta,
  size = 168,
}: ScoreGaugeProps) {
  const resolvedTone = tone ?? inferTone(score);
  const ringColor = TONE_COLOR[resolvedTone];
  const ringTrack = TONE_BG_RING[resolvedTone];
  const radius = size / 2 - 10; // stroke 8 + 2px breathing
  const circumference = 2 * Math.PI * radius;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  const dashOffset = circumference * (1 - pct / 100);
  const display = score == null ? "—" : score;

  return (
    <section
      style={{
        background: t.white,
        borderRadius: 14,
        border: `1px solid ${t.line}`,
        boxShadow: cardShadow,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <span
        style={{
          fontFamily: f.mono,
          fontSize: 11,
          fontWeight: 500,
          color: t.copper,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          alignSelf: "flex-start",
        }}
      >
        {label}
      </span>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringTrack}
            strokeWidth={8}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <span
            style={{
              fontFamily: f.serif,
              fontSize: Math.round(size * 0.32),
              fontWeight: 400,
              color: t.coal,
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {display}
          </span>
          {score != null && (
            <span style={{ fontFamily: f.sans, fontSize: 11, color: t.inkFaint, fontWeight: 500 }}>
              / 100
            </span>
          )}
        </div>
      </div>
      {qualifier && (
        <span style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: ringColor, textAlign: "center" }}>
          {qualifier}
        </span>
      )}
      {meta && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>{meta}</div>}
    </section>
  );
}

/* ─── UtilityRow — top-bar utility cluster (Re-analyse · Download · Last analysed) ─ */

export interface UtilityRowProps {
  lastAnalysedLabel?: string | null;
  reanalyzing: boolean;
  onReanalyze: () => void;
  onDownload?: () => void;
  /** Optional trailing slot (e.g. account chip when used outside the dashboard chrome). */
  trailing?: ReactNode;
}
export function UtilityRow({
  lastAnalysedLabel,
  reanalyzing,
  onReanalyze,
  onDownload,
  trailing,
}: UtilityRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 24,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
        {lastAnalysedLabel ? <>Last analysed <span style={{ color: t.coal, fontWeight: 600 }}>{lastAnalysedLabel}</span></> : "Freshly analysed"}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={onReanalyze}
          disabled={reanalyzing}
          aria-label="Re-analyse resume"
          title="Re-analyse with AI"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
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
            boxShadow: cardShadow,
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
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            aria-label="Download report"
            title="Download report (PDF)"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: t.white,
              border: `1px solid ${t.line}`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: cardShadow,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        )}
        {trailing}
      </div>
    </div>
  );
}
