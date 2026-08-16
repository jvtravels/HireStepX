import React from "react";
import { tokens as t, fonts as f, shadows } from "../auth/_tokens";

/* HireStepX — Employer console shared atoms.
   Mirrors src/auth/_fields.tsx conventions (inline styles + real tokens),
   ported from the talent-roster-employer canvas mockup. */

export function EmployerWordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <img src="/wordmark.png" alt="HireStepX" style={{ height: 28, width: "auto", display: "block" }} />
    </div>
  );
}

export function Eyebrow({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "copper" | "indigo" | "error" }) {
  const color = tone === "copper" ? t.copper : tone === "indigo" ? t.indigo : tone === "error" ? t.error : t.inkSoft;
  return (
    <div style={{ fontFamily: f.mono, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color, fontWeight: 600 }}>
      {children}
    </div>
  );
}

type PillTone = "indigo" | "copper" | "success" | "neutral" | "warning" | "error";

const pillPalette: Record<PillTone, { bg: string; fg: string }> = {
  indigo: { bg: t.indigo100, fg: t.indigoDeep },
  copper: { bg: t.copper100, fg: t.copper },
  success: { bg: t.success100, fg: t.success },
  warning: { bg: t.warning100, fg: t.warning },
  error: { bg: t.error100, fg: t.error },
  neutral: { bg: t.creamSoft, fg: t.inkSoft },
};

export function Pill({ children, tone = "neutral", filled = false }: { children: React.ReactNode; tone?: PillTone; filled?: boolean }) {
  const p = pillPalette[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontFamily: f.sans,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.2,
        background: filled ? p.fg : p.bg,
        color: filled ? t.white : p.fg,
      }}
    >
      {children}
    </span>
  );
}

export function ScoreChip({ score }: { score: number }) {
  const tone: PillTone = score >= 85 ? "success" : score >= 70 ? "copper" : "neutral";
  return (
    <div
      style={{
        width: 44,
        height: 32,
        borderRadius: 8,
        background: pillPalette[tone].bg,
        color: pillPalette[tone].fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: f.mono,
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {score}
    </div>
  );
}

export function Card({
  children,
  pad = 24,
  radius = 16,
  background = t.white,
  border = `1px solid ${t.line}`,
  style,
}: {
  children: React.ReactNode;
  pad?: number;
  radius?: number;
  background?: string;
  border?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section style={{ background, border, borderRadius: radius, padding: pad, boxShadow: shadows.card, ...style }}>
      {children}
    </section>
  );
}

export function PrimaryCta({
  children,
  onClick,
  icon,
  size = "md",
  disabled = false,
  full = false,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  size?: "sm" | "md";
  disabled?: boolean;
  full?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: full ? "100%" : undefined,
        padding: size === "sm" ? "10px 18px" : "14px 22px",
        borderRadius: 12,
        border: "none",
        background: disabled ? t.inkFaint : t.indigo,
        color: t.white,
        fontFamily: f.sans,
        fontSize: size === "sm" ? 13 : 14,
        fontWeight: 600,
        boxShadow: disabled ? "none" : shadows.cta,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
      {icon}
    </button>
  );
}

export function OutlineCta({
  children,
  onClick,
  icon,
  size = "md",
  full = false,
  tone = "neutral",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  size?: "sm" | "md";
  full?: boolean;
  tone?: "neutral" | "indigo";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: full ? "100%" : undefined,
        padding: size === "sm" ? "9px 16px" : "13px 20px",
        borderRadius: 12,
        border: `1px solid ${tone === "indigo" ? t.indigo : t.lineStrong}`,
        background: tone === "indigo" ? t.indigo100 : "transparent",
        color: tone === "indigo" ? t.indigoDeep : t.coal,
        fontFamily: f.sans,
        fontSize: size === "sm" ? 13 : 14,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export function SkillTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "4px 9px",
        borderRadius: 8,
        background: t.creamSoft,
        border: `1px solid ${t.line}`,
        fontFamily: f.sans,
        fontSize: 12,
        color: t.inkSoft,
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}

export function StatusChip({ status }: { status: "generating" | "ready" | "partial" | "zero" | "failed" | "closed" }) {
  const map: Record<string, { tone: PillTone; label: string }> = {
    generating: { tone: "indigo", label: "Generating…" },
    ready: { tone: "success", label: "Shortlist ready" },
    partial: { tone: "warning", label: "Partial match" },
    zero: { tone: "neutral", label: "No matches yet" },
    failed: { tone: "error", label: "Generation failed" },
    closed: { tone: "neutral", label: "Closed" },
  };
  const m = map[status];
  return <Pill tone={m.tone}>{m.label}</Pill>;
}

export function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: "block", fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, marginBottom: 6 }}>
      {children}
      {required && <span style={{ color: t.copper }}> *</span>}
    </label>
  );
}

export function HelpText({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "error" }) {
  return (
    <div style={{ fontFamily: f.sans, fontSize: 12, color: tone === "error" ? t.error : t.inkFaint, marginTop: 6 }}>
      {children}
    </div>
  );
}

/** Multi-value tag input — type + Enter (or comma) to add, click "x" to
 *  remove. Backs every array-valued requirement field (locations, skills,
 *  preferred colleges, target companies, perks). No dropdown/autocomplete;
 *  it's a free-text chip list, matching what the API actually stores. */
export function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = React.useState("");

  const commit = () => {
    const cleaned = draft.trim();
    if (cleaned.length === 0) return;
    if (!values.includes(cleaned)) onChange([...values, cleaned]);
    setDraft("");
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 10,
        border: `1px solid ${t.line}`,
        background: t.white,
      }}
    >
      {values.map((v) => (
        <span
          key={v}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 6px 4px 10px",
            borderRadius: 8,
            background: t.creamSoft,
            border: `1px solid ${t.line}`,
            fontFamily: f.sans,
            fontSize: 12,
            color: t.inkSoft,
            fontWeight: 500,
          }}
        >
          {v}
          <button
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            aria-label={`Remove ${v}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 16,
              height: 16,
              border: "none",
              background: "transparent",
              color: t.inkFaint,
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && draft.length === 0 && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={values.length === 0 ? placeholder : ""}
        style={{
          flex: 1,
          minWidth: 120,
          border: "none",
          outline: "none",
          fontFamily: f.sans,
          fontSize: 14,
          padding: "4px 2px",
        }}
      />
    </div>
  );
}

export function Divider() {
  return <div style={{ height: 1, background: t.line, width: "100%" }} />;
}

/** Groups related fields under a small-caps label with a hairline rule,
 *  so a long form reads as scannable sections instead of one flat list. */
export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontFamily: f.mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: t.inkFaint, fontWeight: 600 }}>
          {title}
        </span>
        <Divider />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
    </div>
  );
}

/** Toggle-button group for a small closed set of mutually-exclusive options
 *  (e.g. work mode) — replaces bare native radios with a brand-consistent,
 *  larger-touch-target control. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div style={{ display: "inline-flex", padding: 3, borderRadius: 11, background: t.creamSoft, gap: 2 }}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={selected}
            style={{
              padding: "8px 16px",
              minHeight: 36,
              borderRadius: 8,
              border: "none",
              background: selected ? t.white : "transparent",
              color: selected ? t.indigoDeep : t.inkSoft,
              boxShadow: selected ? shadows.card : "none",
              fontFamily: f.sans,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* Mirrors DashboardHome.tsx's StatCell — same 3-column stat-strip pattern
   used on the candidate dashboard, reused so the employer dashboard reads
   as the same product. */
export function StatCell({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div style={{ padding: "16px 4px", borderRight: `1px solid ${t.line}` }}>
      <dt style={{ fontFamily: f.mono, fontSize: 10, color: t.inkSoft, letterSpacing: 0.6, textTransform: "uppercase", margin: 0 }}>
        {label}
      </dt>
      <dd style={{ margin: "6px 0 0", display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontFamily: f.serif, fontSize: 30, fontWeight: 400, color: t.coal, letterSpacing: -0.5, lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>{unit}</span>}
      </dd>
    </div>
  );
}

export const EmployerIcon = {
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Lock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="11" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V7a4 4 0 118 0v4" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Arrow: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Refresh: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M4 4v6h6M20 20v-6h-6M4.5 15a8 8 0 0013.9 3.4M19.5 9A8 8 0 005.6 5.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Alert: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 9v4M12 17h.01M10.3 3.9L2.7 18a2 2 0 001.8 3h15a2 2 0 001.8-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Clock: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Building: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="10" height="18" rx="1" stroke="currentColor" strokeWidth="2" />
      <path d="M14 8h6v13h-6M8 7h.01M8 11h.01M8 15h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ChevronUp: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
      <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ChevronDown: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};
