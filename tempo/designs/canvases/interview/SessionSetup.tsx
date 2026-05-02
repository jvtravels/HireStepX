/* HireStepX — Session Setup canvas-local component.
   Single-page progressive form for starting an interview session.
   Industry research notes baked in:
   - Single page > wizard (lower drop-off, faster start)
   - Required vs optional made explicit (asterisks + (optional))
   - "Not sure?" escape hatch on the focus picker (Mixed)
   - Recent quick-picks for returning users (lower friction)
   - Resume context banner — auto-personalised, editable
   - Real-time autocomplete for company with keyboard hints
   - Difficulty calibration revealed after focus is picked
   - Footer trust signal ("private, never shared")

   Design-system alignment:
   - Tokens / fonts / shadows from design-system/_tokens.ts only
   - EditorialHeading typography (italic-copper accent) matches _atoms.tsx
   - Reuses Avatar atom for the top-nav identity
   - Buttons match DesignSystemComponents btnPrimary "Large" spec
   - Inputs match DesignSystemComponents inputBase spec */

import React from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
import { Wordmark } from "../authentication/_auth-fields";
import { AUTH_STYLES } from "../authentication/_auth-styles";
import { ONBOARDING_STYLES } from "../onboarding/_onboarding-styles";

/* ─── Types ───────────────────────────────────────────────────────────── */

export type SetupFocus =
  | "technical" | "behavioral" | "system-design" | "frontend" | "backend"
  | "dsa" | "database" | "hr" | "case" | "mixed";

export interface SessionSetupProps {
  /** Pre-filled role (e.g. resume-derived). */
  role?: string;
  /** Pre-filled company (optional). */
  company?: string;
  /** Selected focus area. */
  focus?: SetupFocus;
  /** Show the company autocomplete dropdown. */
  showCompanyAutocomplete?: boolean;
  /** Show validation error states (e.g. role missing). */
  showErrors?: boolean;
  /** Show the resume context banner. */
  showResumeBanner?: boolean;
  /** Show the recent quick-picks row. */
  showRecent?: boolean;
  /** Account name shown in the top-right identity block. */
  userName?: string;
  /** Compact / narrow layout (mobile preview). */
  compact?: boolean;
}

/* ─── Focus catalogue (matches the existing interview canvas universe) ──── */

/* Three on-system tints rotated across the 10 chips for soft visual
   variety while staying inside the editorial cream / indigo / copper
   palette defined in design-system/_tokens.ts. */
const FOCUS: { id: SetupFocus; label: string; icon: React.ReactNode; tint: string; helper: { title: string; body: string } }[] = [
  { id: "technical",     label: "Technical",     icon: <Glyph d="M8 6 4 12l4 6M16 6l4 6-4 6M14 4l-4 16" />, tint: t.indigo100, helper: { title: "Technical Interview",       body: "Coding, problem solving, and system design fundamentals." } },
  { id: "behavioral",    label: "Behavioral",    icon: <Glyph d="M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />, tint: t.copper100, helper: { title: "Behavioral Interview",      body: "STAR-coached stories. Leadership, conflict, ownership, growth." } },
  { id: "system-design", label: "System Design", icon: <Glyph d="M3 7l9 4 9-4M3 12l9 4 9-4M3 17l9 4 9-4" />, tint: t.creamSoft, helper: { title: "System Design",              body: "High-level architecture, tradeoffs, and capacity estimation." } },
  { id: "frontend",      label: "Frontend",      icon: <Glyph d="M3 5h18v14H3z M3 9h18 M7 5v14" />, tint: t.indigo100, helper: { title: "Frontend Interview",        body: "React 19 patterns, browser internals, performance, accessibility." } },
  { id: "backend",       label: "Backend",       icon: <Glyph d="M4 6h16v4H4zM4 14h16v4H4zM7 8h.01M7 16h.01" />, tint: t.copper100, helper: { title: "Backend Interview",         body: "APIs, databases, scaling, queues, and reliability tradeoffs." } },
  { id: "dsa",           label: "DSA",           icon: <Glyph d="M5 12a7 7 0 1 1 14 0M5 12v7M19 12v7M5 19h14" />, tint: t.creamSoft, helper: { title: "Data Structures & Algorithms", body: "Patterns, complexity analysis, edge-case reasoning." } },
  { id: "database",      label: "Database",      icon: <Glyph d="M12 7c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3zM3 4v8c0 1.66 4.03 3 9 3s9-1.34 9-3V4M3 12v8c0 1.66 4.03 3 9 3s9-1.34 9-3v-8" />, tint: t.indigo100, helper: { title: "Database Round",              body: "SQL, schema design, indexing, partitioning, query plans." } },
  { id: "hr",            label: "HR Round",      icon: <Glyph d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />, tint: t.copper100, helper: { title: "HR Round",                   body: "Culture fit, salary expectations, notice period — India context." } },
  { id: "case",          label: "Case Study",    icon: <Glyph d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 4h6v4H9z" />, tint: t.creamSoft, helper: { title: "Case Study",                 body: "Estimation, structured frameworks, hypothesis testing." } },
  { id: "mixed",         label: "Mixed",         icon: <Glyph d="M8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0zM4 12a8 8 0 0 1 8-8 M20 12a8 8 0 0 1-8 8" />, tint: t.indigo100, helper: { title: "Mixed Interview",            body: "A blend of behavioral, technical, and HR. Closest to a real loop." } },
];

/* Inline 24-line glyph using the same stroke language as the rest of the canvas. */
function Glyph({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split("M").filter(Boolean).map((seg, i) => <path key={i} d={"M" + seg} />)}
    </svg>
  );
}

/* ─── Top nav  ──────────────────────────────────────────────────────────── */

/* Derives 1-2 letter initials from a full name. Falls back to the empty
   string if no usable letters — caller renders a person-glyph instead. */
function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/* Identity chip matches ResumeReview exactly — same dimensions, same
   tokens, same fallback person-glyph. */
function IdentityChip({ userName }: { userName: string }) {
  const trimmed = userName.trim();
  const initials = initialsFromName(trimmed);
  if (!trimmed) return null;
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: 14, fontWeight: 500, color: t.coal }}
      title={trimmed}
    >
      <span
        aria-hidden
        className="hsx-onb-avatar"
        style={{
          width: 30, height: 30, borderRadius: 999,
          background: t.indigo100, color: t.indigo,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontFamily: f.serif, fontSize: 13, fontWeight: 400,
          flexShrink: 0,
        }}
      >
        {initials || (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        )}
      </span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
        {trimmed}
      </span>
    </div>
  );
}

function TopNav({ userName = "Rahul Sharma" }: { userName?: string }) {
  /* 3-col grid header, same rhythm as ResumeReview / login screens.
     Wordmark left · empty centre (no stepper — this isn't the onboarding
     funnel) · identity + escape link right. */
  return (
    <header
      className="hsx-login-topbar"
      style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "32px 48px", gap: 16 }}
    >
      <div style={{ justifySelf: "start" }}><Wordmark /></div>
      <div style={{ justifySelf: "center" }} />
      <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 14 }}>
        <IdentityChip userName={userName} />
        <a
          href="#dashboard"
          className="hsx-link-indigo"
          style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 500, color: t.indigo, textDecoration: "none" }}
        >
          Skip for now
        </a>
      </div>
    </header>
  );
}

/* ─── Field shells  ─────────────────────────────────────────────────────── */

function FieldLabel({ children, optional, error }: { children: React.ReactNode; optional?: boolean; error?: boolean }) {
  /* 13/500 sans matches the rhythm of EndButton, ContextChip, KeycapButton labels.
     Required asterisk in copper (editorial accent), error in t.error.
     Optional pill rendered in inkFaint at 12/400. */
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.coal, marginBottom: 8 }}>
      {children}
      {!optional && <span style={{ color: error ? t.error : t.copper, fontSize: 12 }}>*</span>}
      {optional && <span style={{ color: t.inkFaint, fontSize: 12, fontWeight: 400 }}>(optional)</span>}
    </div>
  );
}

function SearchInput({ value, placeholder, error, onClear, focused }: { value: string; placeholder: string; error?: boolean; onClear?: () => void; focused?: boolean }) {
  /* DS inputBase: padding 12 14, radius 10, lineStrong border, 14 sans. */
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: t.white,
      border: `1px solid ${error ? t.error : focused ? t.indigo : t.lineStrong}`,
      borderRadius: 10, padding: "12px 14px",
      boxShadow: focused ? `0 0 0 3px ${t.indigoRing}` : "none",
      transition: "all 160ms ease",
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.inkFaint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      </svg>
      <span style={{ flex: 1, fontFamily: f.sans, fontSize: 14, color: value ? t.coal : t.inkFaint, fontWeight: value ? 500 : 400 }}>
        {value || placeholder}
      </span>
      {value && onClear && (
        <button aria-label="Clear" style={{ background: "none", border: 0, padding: 4, cursor: "pointer", color: t.inkFaint }} onClick={onClear}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m18 6-12 12M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );
}

function HelperLine({ icon, children, tone }: { icon: React.ReactNode; children: React.ReactNode; tone?: "default" | "error" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontFamily: f.sans, fontSize: 12, color: tone === "error" ? t.error : t.inkSoft }}>
      <span style={{ display: "inline-flex", color: tone === "error" ? t.error : t.copper }}>{icon}</span>
      {children}
    </div>
  );
}

/* ─── Resume banner  ────────────────────────────────────────────────────── */

function ResumeBanner() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
      padding: "12px 16px", borderRadius: 12, background: t.copper100, border: `1px solid ${t.copperSoft}`,
      marginBottom: 28,
    }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
        <span style={{ display: "inline-flex", width: 32, height: 32, borderRadius: 6, background: t.white, alignItems: "center", justifyContent: "center", border: `1px solid ${t.copperSoft}` }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h4" />
          </svg>
        </span>
        <div>
          <div style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.coal }}>Pre-filled from your resume</div>
          <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 2 }}>arjun-sharma-resume-v3.pdf · parsed 2 min ago</div>
        </div>
      </div>
      <div style={{ display: "inline-flex", gap: 8 }}>
        <TextButton>Edit</TextButton>
        <TextButton>Re-upload</TextButton>
      </div>
    </div>
  );
}
function TextButton({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <button aria-label={label ?? (typeof children === "string" ? children : undefined)} style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 500, color: t.indigo, background: "transparent", border: 0, padding: "6px 10px", borderRadius: 6, cursor: "pointer" }}>{children}</button>
  );
}

/* ─── Recent quick-picks  ──────────────────────────────────────────────── */

function RecentRow() {
  const recent = [
    { role: "Frontend Developer", company: "Google", focus: "Technical" },
    { role: "Product Manager", company: "Flipkart", focus: "Behavioral" },
    { role: "SDE-2", company: "Razorpay", focus: "System Design" },
  ];
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontFamily: f.sans, fontSize: 11, fontWeight: 600, letterSpacing: 1, color: t.inkFaint, textTransform: "uppercase", marginBottom: 10 }}>
        Recent
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {recent.map((r, i) => (
          <button key={i} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 14px", borderRadius: 999, border: `1px solid ${t.line}`,
            background: t.white, cursor: "pointer", fontFamily: f.sans, fontSize: 12, color: t.coal,
            boxShadow: shadows.card,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: t.indigo }} />
            <strong style={{ fontWeight: 600 }}>{r.role}</strong>
            <span style={{ color: t.inkSoft }}>· {r.company}</span>
            <span style={{ color: t.inkFaint }}>· {r.focus}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Company autocomplete dropdown  ──────────────────────────────────── */

function CompanyDropdown({ query }: { query: string }) {
  /* Letter tiles use the same indigo / copper rotation as the focus
     chips so the dropdown stays inside the editorial palette. */
  const all = [
    { name: "Google",        roles: "L3-L7 · Bengaluru / HYD", bg: t.indigo,  letter: "G" },
    { name: "Goldman Sachs", roles: "Analyst · Bengaluru",     bg: t.copper,  letter: "G" },
    { name: "GoCardless",    roles: "Engineer · Remote",       bg: t.coal,    letter: "G" },
    { name: "Glassdoor",     roles: "Eng · Mumbai",            bg: t.indigoGray, letter: "G" },
  ];
  const filtered = all.filter((a) => a.name.toLowerCase().startsWith(query.toLowerCase()));
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, top: "calc(100% + 8px)",
      background: t.white, border: `1px solid ${t.line}`, borderRadius: 12,
      boxShadow: shadows.modal,
      overflow: "hidden", zIndex: 4,
    }}>
      {filtered.map((c, i) => (
        <div key={c.name} style={{
          display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
          background: i === 0 ? t.cream : t.white, cursor: "pointer",
          borderBottom: i < filtered.length - 1 ? `1px solid ${t.line}` : "none",
        }}>
          <span style={{ width: 30, height: 30, borderRadius: 6, background: c.bg, color: t.white, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: f.serif, fontSize: 13, fontWeight: 500 }}>{c.letter}</span>
          <div>
            <div style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 500, color: t.coal }}>{c.name}</div>
            <div style={{ fontFamily: f.sans, fontSize: 11, color: t.inkSoft, marginTop: 1 }}>{c.roles}</div>
          </div>
          {i === 0 && <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: f.mono, color: t.inkFaint }}>↵ Enter</span>}
        </div>
      ))}
      <div style={{ padding: "10px 16px", background: t.creamSoft, fontFamily: f.sans, fontSize: 11, color: t.inkSoft, display: "flex", justifyContent: "space-between" }}>
        <span>↑↓ navigate · ↵ select</span>
        <span>Don't see yours? <strong style={{ color: t.indigo, fontWeight: 500 }}>Add it manually</strong></span>
      </div>
    </div>
  );
}

/* ─── Focus card grid  ──────────────────────────────────────────────────── */

function FocusGrid({ value, columns }: { value?: SetupFocus; columns: number }) {
  return (
    <div role="radiogroup" aria-label="Interview focus" style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 10 }}>
      {FOCUS.map((it) => {
        const active = value === it.id;
        return (
          <button
            key={it.id}
            type="button"
            role="radio"
            aria-checked={active}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: 14, borderRadius: 12, cursor: "pointer",
              background: active ? `linear-gradient(180deg, ${t.indigo100}, ${t.white})` : t.white,
              border: `1px solid ${active ? t.indigo : t.line}`,
              boxShadow: active ? `0 0 0 3px ${t.indigoRing}` : shadows.card,
              transition: "all 220ms cubic-bezier(.2,.7,.2,1)",
              fontFamily: f.sans, textAlign: "left",
            }}
          >
            <span style={{
              width: 32, height: 32, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center",
              background: it.tint, color: t.coal,
            }}>{it.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: t.coal, flex: 1 }}>{it.label}</span>
            <span aria-hidden style={{
              width: 18, height: 18, borderRadius: 999,
              border: `1.5px solid ${active ? t.indigo : t.line}`,
              background: active ? t.indigo : "transparent",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              {active && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FocusContextCard({ focus }: { focus: SetupFocus }) {
  const it = FOCUS.find((x) => x.id === focus)!;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: 18, borderRadius: 12, marginTop: 14,
      background: `linear-gradient(180deg, ${it.tint}, transparent)`,
      border: `1px solid ${t.line}`,
    }}>
      <span style={{ width: 44, height: 44, borderRadius: 6, background: t.white, display: "inline-flex", alignItems: "center", justifyContent: "center", color: t.coal, border: `1px solid ${t.line}` }}>{it.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: f.serif, fontSize: 16, fontWeight: 600, color: t.coal }}>{it.helper.title}</div>
        <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 4 }}>{it.helper.body}</div>
      </div>
      <span style={{ display: "inline-flex", gap: 6, fontFamily: f.sans, fontSize: 11, color: t.inkSoft }}>
        <span style={{ padding: "4px 8px", borderRadius: 999, background: t.white, border: `1px solid ${t.line}` }}>≈ 8-10 questions</span>
        <span style={{ padding: "4px 8px", borderRadius: 999, background: t.white, border: `1px solid ${t.line}` }}>STAR coaching</span>
      </span>
    </div>
  );
}

/* ─── Primary CTA  ─────────────────────────────────────────────────────── */

/* Mirrors `ctaStyle` in ResumeReview. Locking exact values keeps every
   onboarding-style CTA visually identical. */
const ctaStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: f.sans,
  fontSize: 15,
  fontWeight: 600,
  color: t.cream,
  background: t.indigo,
  border: "1px solid transparent",
  borderRadius: 10,
  padding: "16px 18px",
  cursor: "pointer",
  marginTop: 22,
  boxShadow: shadows.cta,
  letterSpacing: 0.1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  textDecoration: "none",
};

function PrimaryCTA({ disabled, label = "Start practice" }: { disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="hsx-login-cta"
      style={{
        ...ctaStyle,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
      </svg>
    </button>
  );
}

/* ─── Title block  ─────────────────────────────────────────────────────── */

function TitleBlock() {
  /* Hero spec is byte-for-byte the same as the ResumeReview parse-failed
     hero — same clamp scale, weight, letter-spacing, italic-copper accent,
     subtitle treatment. Same className hooks so AUTH_STYLES picks up its
     responsive rules. */
  return (
    <div className="hsx-login-hero" style={{ width: "100%", textAlign: "center", marginBottom: 28 }}>
      <h1
        style={{
          fontFamily: f.serif,
          fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
          lineHeight: 1.05,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          whiteSpace: "nowrap",
          margin: 0,
          color: t.coal,
        }}
      >
        Let&apos;s get you{" "}
        <em style={{ fontStyle: "italic", fontWeight: 400, color: t.copper }}>ready</em>
      </h1>
      <p
        className="hsx-login-subtitle"
        style={{
          fontFamily: f.sans,
          fontSize: 16,
          lineHeight: 1.55,
          color: t.inkSoft,
          marginTop: 14,
          marginBottom: 0,
          textWrap: "balance",
        }}
      >
        Tell us a few things and we&apos;ll personalise the experience for you.
      </p>
    </div>
  );
}

/* ─── Footer trust bar  ────────────────────────────────────────────────── */

function FooterBar() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 18, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      Your responses stay private and are never shared.
    </div>
  );
}

/* ─── Main  ────────────────────────────────────────────────────────────── */

export default function SessionSetup({
  role = "",
  company = "",
  focus,
  showCompanyAutocomplete = false,
  showErrors = false,
  showResumeBanner = false,
  showRecent = false,
  userName,
  compact = false,
}: SessionSetupProps) {
  const ctaDisabled = !role || !focus;
  return (
    <>
      {/* AUTH_STYLES carries the CDN @font-face fallback, link/cta hover
          treatments, and topbar responsive tweaks. ONBOARDING_STYLES adds
          the avatar/stack rhythm. Both used by every onboarding screen. */}
      <style>{AUTH_STYLES}{ONBOARDING_STYLES}</style>
      <div style={{
        background: t.cream, color: t.coal, fontFamily: f.sans,
        minHeight: "100dvh", display: "flex", flexDirection: "column",
        position: "relative",
      }}>
        <TopNav userName={userName} />

        <main
          className="hsx-login-main"
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "clamp(24px, 4vh, 64px) 24px" }}
        >
          <div className="hsx-onb-stack" style={{ width: "100%", maxWidth: compact ? "100%" : 1080 }}>
            <TitleBlock />

          {showResumeBanner && <ResumeBanner />}
          {showRecent && <RecentRow />}

          {/* Row: Role + Company */}
          <div style={{ display: compact ? "block" : "grid", gridTemplateColumns: compact ? undefined : "1fr 1fr", gap: 24, marginBottom: 28 }}>
            <div style={{ marginBottom: compact ? 24 : 0 }}>
              <FieldLabel error={showErrors && !role}>Target role</FieldLabel>
              <SearchInput value={role} placeholder="e.g. Frontend Developer" error={showErrors && !role} onClear={() => undefined} />
              {showErrors && !role ? (
                <HelperLine icon={<ErrorIcon />} tone="error">Please pick a target role to continue.</HelperLine>
              ) : (
                <HelperLine icon={<SparkIcon />}>Be specific. Better matches lead to better practice.</HelperLine>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <FieldLabel optional>Company</FieldLabel>
              <SearchInput value={company} placeholder="Search 50+ companies" focused={showCompanyAutocomplete} onClear={() => undefined} />
              <HelperLine icon={<BuildingIcon />}>Helps us tailor questions to the company's interview style.</HelperLine>
              {showCompanyAutocomplete && <CompanyDropdown query={company || "G"} />}
            </div>
          </div>

          {/* Focus */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <FieldLabel>Interview focus</FieldLabel>
                <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 2 }}>Choose one area to focus on.</div>
              </div>
              <button type="button" aria-label="Pick Mixed if you're unsure" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: 12, fontWeight: 500, color: t.indigo, background: "transparent", border: 0, cursor: "pointer", padding: 0 }}>
                <InfoIcon /> Not sure? Start with Mixed.
              </button>
            </div>
            <FocusGrid value={focus} columns={compact ? 2 : 5} />
            {focus && <FocusContextCard focus={focus} />}
          </div>

          <PrimaryCTA disabled={ctaDisabled} />
          <FooterBar />
          </div>
        </main>
      </div>
    </>
  );
}

/* ─── Tiny helper icons used in helper-line rows  ─────────────────────── */

function SparkIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3 3M16 16l3 3M19 5l-3 3M5 19l3-3" /></svg>;
}
function BuildingIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 21h18M5 21V7l8-4 8 4v14M9 9h.01M9 12h.01M9 15h.01M13 9h.01M13 12h.01M13 15h.01" /></svg>;
}
function InfoIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>;
}
function ErrorIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>;
}
