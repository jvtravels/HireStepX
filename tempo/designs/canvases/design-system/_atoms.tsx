/* HireStepX — Design System / Shared Atoms
   The reusable structural components every storyboard needs:
   MonoLabel, SectionHead, Footer, StatePanel, Hex.

   Discipline note: section numbers use ink-soft, NOT copper.
   Copper is reserved for the masthead italic word and highlighted facts.
   See _tokens.ts for the canonical brand color discipline. */
import React from "react";
import { tokens as t, fonts as f } from "./_tokens";

/* ─── MonoLabel — eyebrow caps in JetBrains Mono ─── */
export function MonoLabel({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        fontFamily: f.mono,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: color || t.inkSoft,
      }}
    >
      {children}
    </div>
  );
}

/* ─── SectionHead — number + serif title + right-aligned desc ───
   Section numbers are INK-SOFT (neutral), not copper.
   This enforces the "one copper moment per page" rule by reserving
   copper exclusively for the masthead italic accent + highlighted facts. */
export function SectionHead({
  num,
  title,
  desc,
}: {
  num: string;
  title: string;
  desc: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 16,
        borderBottom: `1px solid ${t.line}`,
        paddingBottom: 16,
        marginBottom: 28,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontFamily: f.mono,
          fontSize: 11,
          color: t.inkSoft,
          letterSpacing: "0.12em",
          fontWeight: 500,
        }}
      >
        {num}
      </span>
      <h2
        style={{
          fontFamily: f.serif,
          fontSize: 28,
          fontWeight: 400,
          letterSpacing: "-0.01em",
          margin: 0,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: "0 0 0 auto",
          color: t.inkSoft,
          fontSize: 13,
          maxWidth: 380,
          textAlign: "right",
        }}
      >
        {desc}
      </p>
    </div>
  );
}

/* ─── Footer — closing line for every storyboard ─── */
export function Footer({
  section,
  tagline,
}: {
  section: string;
  tagline: string;
}) {
  return (
    <div
      style={{
        marginTop: 80,
        paddingTop: 32,
        borderTop: `1px solid ${t.line}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        fontFamily: f.mono,
        fontSize: 11,
        color: t.inkSoft,
        letterSpacing: "0.04em",
      }}
    >
      <div>
        <b style={{ color: t.coal, fontWeight: 500 }}>HireStepX</b> · Design
        System · v1.0 · {section}
      </div>
      <div>{tagline}</div>
    </div>
  );
}

/* ─── StatePanel — white card with mono-cap label ─── */
export function StatePanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        padding: "28px 32px",
        boxShadow:
          "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)",
      }}
    >
      <MonoLabel>{title}</MonoLabel>
      <div style={{ marginTop: 20 }}>{children}</div>
    </div>
  );
}

/* ─── Hex — small hex code chip ─── */
export function Hex({ value }: { value: string }) {
  return (
    <span
      style={{
        fontFamily: f.mono,
        fontSize: 11,
        color: t.coal,
        background: t.creamSoft,
        padding: "3px 8px",
        borderRadius: 4,
        display: "inline-block",
      }}
    >
      {value}
    </span>
  );
}

/* ─── PageShell — standard page container ─── */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
        @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap');
      `}</style>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "80px 56px 120px",
          fontFamily: f.sans,
          color: t.coal,
          background: t.cream,
        }}
      >
        {children}
      </div>
    </>
  );
}

/* ─── Masthead — standard top-of-page hero with italic accent ─── */
export function Masthead({
  eyebrow = "Design System · v1.0",
  titlePre,
  titleAccent,
  titlePost = ".",
  description,
  metaRight,
}: {
  eyebrow?: string;
  titlePre: string;
  titleAccent: string;
  titlePost?: string;
  description: string;
  metaRight?: React.ReactNode;
}) {
  return (
    <header
      style={{
        borderBottom: `1px solid ${t.line}`,
        paddingBottom: 40,
        marginBottom: 64,
        display: "grid",
        gridTemplateColumns: metaRight ? "1fr auto" : "1fr",
        gap: 24,
        alignItems: "end",
      }}
    >
      <div>
        <MonoLabel>{eyebrow}</MonoLabel>
        <h1
          style={{
            fontFamily: f.serif,
            fontSize: 56,
            fontWeight: 400,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            margin: "12px 0 0",
          }}
        >
          {titlePre}{" "}
          <em style={{ fontStyle: "italic", color: t.copper }}>
            {titleAccent}
          </em>
          {titlePost}
        </h1>
        <p
          style={{
            color: t.indigoGray,
            fontSize: 15,
            margin: "16px 0 0",
            maxWidth: 540,
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>
      </div>
      {metaRight && (
        <div
          style={{
            textAlign: "right",
            fontFamily: f.mono,
            fontSize: 11,
            color: t.inkSoft,
            lineHeight: 1.7,
          }}
        >
          {metaRight}
        </div>
      )}
    </header>
  );
}
