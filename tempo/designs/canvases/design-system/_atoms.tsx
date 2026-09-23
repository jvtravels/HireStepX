/* HireStepX — Design System / Shared Atoms
   The reusable structural components every storyboard needs:
   MonoLabel, SectionHead, Footer, StatePanel, Hex, PageShell, PageHeader.

   Discipline note: copper is the ONE accent (primary CTAs, active/selected
   states, links, focus rings) — used sparingly, never as a decorative
   headline color. Section numbers and page titles stay neutral ink. See
   _tokens.ts for the canonical color + type-scale discipline. */
import React from "react";
import "../../../public/fonts/af-sobremesa.css";
import { tokens as t, fonts as f, type, radius } from "./_tokens";

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
        fontSize: type.micro.size,
        fontWeight: type.micro.weight,
        letterSpacing: type.micro.letterSpacing,
        textTransform: "uppercase",
        color: color || t.inkSoft,
      }}
    >
      {children}
    </div>
  );
}

/* ─── SectionHead — number + compact title + right-aligned desc ─── */
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
        gap: 14,
        borderBottom: `1px solid ${t.line}`,
        paddingBottom: 14,
        marginBottom: 24,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontFamily: f.mono,
          fontSize: type.micro.size,
          color: t.inkSoft,
          letterSpacing: type.micro.letterSpacing,
          fontWeight: type.micro.weight,
        }}
      >
        {num}
      </span>
      <h2
        style={{
          fontFamily: f.sans,
          fontSize: type.h2.size,
          fontWeight: type.h2.weight,
          lineHeight: type.h2.lineHeight,
          letterSpacing: type.h2.letterSpacing,
          color: t.coal,
          margin: 0,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: "0 0 0 auto",
          color: t.inkMuted,
          fontSize: type.small.size,
          lineHeight: type.small.lineHeight,
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
        marginTop: 56,
        paddingTop: 24,
        borderTop: `1px solid ${t.line}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        fontFamily: f.mono,
        fontSize: type.micro.size,
        color: t.inkSoft,
        letterSpacing: "0.02em",
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

/* ─── StatePanel — bordered card with mono-cap label ─── */
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
        borderRadius: radius.md,
        padding: "20px 24px",
        boxShadow: "0 1px 2px rgba(24,24,27,.04)",
      }}
    >
      <MonoLabel>{title}</MonoLabel>
      <div style={{ marginTop: 16 }}>{children}</div>
    </div>
  );
}

/* ─── Hex — small hex code chip ─── */
export function Hex({ value }: { value: string }) {
  return (
    <span
      style={{
        fontFamily: f.mono,
        fontSize: type.micro.size,
        color: t.coal,
        background: t.creamSoft,
        padding: "3px 8px",
        borderRadius: radius.sm,
        display: "inline-block",
      }}
    >
      {value}
    </span>
  );
}

/* ─── PageShell — standard page container. Tighter, denser padding than the
   old editorial "print margin" treatment — information density over
   whitespace-as-luxury. ─── */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');
      `}</style>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "48px 48px 96px",
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

/* ─── PageHeader — standard compact top-of-page header. Replaces the old
   "Masthead" hero (huge display headline + bold copper accent word): a
   functional H1 at the top of the compact scale, one clear line of
   supporting copy, optional right-aligned meta. No decorative accent word —
   copper here is reserved for the one primary action, if any, in metaRight. ─── */
export function PageHeader({
  eyebrow = "Design System · v1.0",
  title,
  description,
  metaRight,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  metaRight?: React.ReactNode;
}) {
  return (
    <header
      style={{
        borderBottom: `1px solid ${t.line}`,
        paddingBottom: 28,
        marginBottom: 40,
        display: "grid",
        gridTemplateColumns: metaRight ? "1fr auto" : "1fr",
        gap: 20,
        alignItems: "end",
      }}
    >
      <div>
        <MonoLabel>{eyebrow}</MonoLabel>
        <h1
          style={{
            fontFamily: f.sans,
            fontSize: type.h1.size,
            fontWeight: type.h1.weight,
            letterSpacing: type.h1.letterSpacing,
            lineHeight: type.h1.lineHeight,
            color: t.coal,
            margin: "8px 0 0",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            color: t.inkMuted,
            fontSize: type.bodyLg.size,
            lineHeight: type.bodyLg.lineHeight,
            margin: "10px 0 0",
            maxWidth: 560,
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
            fontSize: type.micro.size,
            color: t.inkSoft,
            lineHeight: 1.6,
          }}
        >
          {metaRight}
        </div>
      )}
    </header>
  );
}

/* Back-compat alias: prior sessions called this component `Masthead` with a
   titlePre/titleAccent/titlePost split so a headline word could be rendered
   in copper. That split has been retired — the SaaS-flat direction has no
   decorative accent word — so `Masthead` now forwards to `PageHeader` with
   the pieces joined into one plain title. Keep new callers on `PageHeader`
   directly; this only exists so nothing importing the old name breaks. */
export function Masthead({
  eyebrow,
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
    <PageHeader
      eyebrow={eyebrow}
      title={`${titlePre} ${titleAccent}${titlePost}`}
      description={description}
      metaRight={metaRight}
    />
  );
}
