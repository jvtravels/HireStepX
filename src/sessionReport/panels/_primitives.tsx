/* Session Report — shared panel primitives.
 *
 * Extracted from NegotiationFullReport.tsx (2026-05-29 split). These are
 * the building blocks every panel composes:
 *
 *   • PanelShell, PanelEmptyState — the panel chrome contract.
 *   • SectionHeader, SectionBand — the heading hierarchy (h3 chapter
 *     band + h4 panel header).
 *   • InfoTile, ToneCard, EventRow, OutlinedCard, QuoteBlock — the
 *     in-panel callout shapes.
 *   • EyebrowLabel, HeaderChip, FreshnessChip, PlayableTime — the
 *     small metadata atoms.
 *   • Tone + toneToColor — the tone vocabulary used across panels.
 *
 * No state, no side effects. Pure presentation. */

import React from "react";
import { t, f, radius, shadows } from "../tokens";

export type Tone = "good" | "warn" | "bad" | "neutral";

/* Tone → token color. Single switch so a palette shift touches one
 * file. Used by PhaseLadderPanel, AnchorBracketPanel, NPVMathPanel,
 * ArchetypePanel. */
export function toneToColor(tone: Tone): string {
  switch (tone) {
    case "good": return t.success;
    case "warn": return t.copper;
    case "bad":  return t.error;
    case "neutral": return t.coal;
  }
}

export function FreshnessChip({ source, n, asOf, methodologyUrl }: {
  source: string; n?: number; asOf?: string; methodologyUrl?: string;
}) {
  /* When a methodology URL is wired, the chip becomes a real anchor —
     users can audit the cohort claim instead of trusting the math.
     Without it, the chip stays inert (plain <span>) so we don't fake
     a clickable affordance that goes nowhere. */
  const baseStyle = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "4px 10px", background: t.cream, border: `1px solid ${t.line}`,
    borderRadius: radius.pill, fontSize: 10, fontFamily: f.mono,
    color: t.inkSoft, letterSpacing: 0.3,
    textDecoration: "none",
  } as const;
  const inner = (
    <>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: t.success }} />
      <span style={{ fontWeight: 600 }}>{source}</span>
      {typeof n === "number" && <span>· n={n}</span>}
      {asOf && <span>· {asOf}</span>}
      {methodologyUrl && (
        <span
          style={{
            color: t.indigo, fontWeight: 700, textDecoration: "underline",
            textUnderlineOffset: 2, marginLeft: 2,
          }}
        >
          How?
        </span>
      )}
    </>
  );
  if (methodologyUrl) {
    return (
      <a
        href={methodologyUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={baseStyle}
        title="See how we computed this cohort"
      >
        {inner}
      </a>
    );
  }
  return <span style={baseStyle}>{inner}</span>;
}

export function InfoTile({
  children,
  size = "default",
}: {
  children: React.ReactNode;
  size?: "compact" | "default" | "roomy";
}) {
  const sizeClass =
    size === "compact" ? " nfr-info-tile-compact" :
    size === "roomy"   ? " nfr-info-tile-roomy"   : "";
  return <div className={`nfr-info-tile${sizeClass}`}>{children}</div>;
}

export function ToneCard({
  tone,
  pill,
  children,
}: {
  tone: Exclude<Tone, "neutral">;
  pill?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`nfr-tone-card nfr-tone-card-${tone}`}>
      <span className={`nfr-tone-dot nfr-tone-dot-${tone}`} aria-hidden />
      <div style={{ minWidth: 0 }}>{children}</div>
      {pill ?? <span aria-hidden />}
    </div>
  );
}

export function EyebrowLabel({
  children,
  color,
  marginBottom = 8,
  marginTop = 0,
}: {
  children: React.ReactNode;
  color?: string;
  marginBottom?: number;
  marginTop?: number;
}) {
  const style: React.CSSProperties = { marginBottom };
  if (marginTop) style.marginTop = marginTop;
  if (color) style.color = color;
  return (
    <div className="nfr-eyebrow" style={style}>
      {children}
    </div>
  );
}

export function OutlinedCard({
  variant = "white",
  padding = 22,
  marginBottom,
  children,
  style,
}: {
  variant?: "white" | "cream";
  padding?: number | string;
  marginBottom?: number | string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: variant === "cream" ? t.creamSoft : t.white,
        border: `1px solid ${t.line}`,
        borderRadius: radius.card,
        padding,
        ...(marginBottom !== undefined ? { marginBottom } : null),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function QuoteBlock({ children }: { children: React.ReactNode }) {
  return <div className="nfr-quote">&ldquo;{children}&rdquo;</div>;
}

export function EventRow({
  tone = "neutral",
  leading,
  primary,
  secondary,
  trailing,
  paddingX = 12,
}: {
  tone?: "neutral" | "good" | "warn" | "bad";
  leading?: React.ReactNode;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  trailing?: React.ReactNode;
  paddingX?: number;
}) {
  const bg =
    tone === "good" ? t.success100 :
    tone === "bad"  ? t.error100   :
    tone === "warn" ? t.copperTint :
    t.creamSoft;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 12,
        alignItems: "center",
        padding: `10px ${paddingX}px`,
        background: bg,
        borderRadius: radius.tile,
      }}
    >
      {leading ?? <span aria-hidden />}
      <div style={{ minWidth: 0 }}>
        {primary}
        {secondary !== undefined && secondary !== null && (
          <div style={{ fontSize: 12, color: t.inkSoft, marginTop: 2, lineHeight: 1.5 }}>
            {secondary}
          </div>
        )}
      </div>
      {trailing ?? <span aria-hidden />}
    </div>
  );
}

export function HeaderChip({
  variant = "neutral",
  title,
  children,
}: {
  variant?: "accent" | "neutral";
  title?: string;
  children: React.ReactNode;
}) {
  const isAccent = variant === "accent";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        background: isAccent ? t.copperSoft : t.creamSoft,
        color: isAccent ? t.copper : t.inkSoft,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.8,
        borderRadius: radius.tile,
        textTransform: "uppercase",
        fontFamily: f.mono,
        border: isAccent ? "none" : `1px solid ${t.line}`,
      }}
      title={title}
    >
      {children}
    </span>
  );
}

export function PlayableTime({ at }: { at: string }) {
  /* a11y: display-only timestamp pill (no false button affordance
     until audio-playback wiring lands). */
  return (
    <span className="nfr-time-pill">
      <span style={{ fontSize: 9 }} aria-hidden>▶</span>
      <span className="sr-only">at </span>
      {at}
    </span>
  );
}

export function SectionHeader({ index, title, subtitle, accent = t.indigo, aside }: {
  index: string; title: string; subtitle?: string; accent?: string;
  aside?: React.ReactNode;
}) {
  const headBlock = (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
      <span
        style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
          color: accent, fontFamily: f.mono,
        }}
        aria-hidden
      >
        {index}
      </span>
      <div>
        <h4
          style={{
            fontSize: 18, fontWeight: 600, color: t.coal,
            letterSpacing: -0.2, fontFamily: f.serif,
            margin: 0,
          }}
        >
          {title}
        </h4>
        {subtitle && <div style={{ fontSize: 13, color: t.inkSoft, marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
  if (!aside) {
    return <div style={{ marginBottom: 14 }}>{headBlock}</div>;
  }
  return (
    <div
      style={{
        marginBottom: 14,
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", gap: 16,
      }}
    >
      {headBlock}
      <div style={{ flexShrink: 0 }}>{aside}</div>
    </div>
  );
}

export function SectionBand({
  label, title, subtitle, accent, bg, anchorId,
}: { label: string; title: string; subtitle: string; accent: string; bg: string; anchorId?: string }) {
  return (
    <section
      id={anchorId}
      className="nfr-section-band"
      style={{ background: bg, borderTopColor: accent, borderTopWidth: 2, borderTopStyle: "solid", scrollMarginTop: 80 }}
    >
      <div
        style={{
          padding: "5px 11px", background: accent, color: "#FFFFFF",
          fontSize: 10, fontWeight: 700, letterSpacing: 1.4,
          borderRadius: radius.sm, textTransform: "uppercase", fontFamily: f.mono,
          flexShrink: 0,
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3
          style={{
            fontSize: 17, fontWeight: 600, color: t.coal,
            letterSpacing: -0.2, fontFamily: f.serif,
            margin: 0,
          }}
        >
          {title}
        </h3>
        <div style={{ fontSize: 13, color: t.inkSoft, marginTop: 1 }}>{subtitle}</div>
      </div>
    </section>
  );
}

/* ReportCardShell — the white card chrome every top-level Session
 * Report section sits inside. Extracted 2026-05-30: the same 6-property
 * style object (white background, 1px line border, radius.shell,
 * shadows.card, scrollMarginTop: 72, padding) was open-coded in
 * NegotiationFullReport, sr-HeroSection, and inside SrSectionShell.
 * Padding is the only real variation; everything else is fixed.
 *
 * Use this whenever a top-level section needs the standard card. For
 * the band-plus-eyebrow contract (most sr-*Section files), keep using
 * SrSectionShell — it composes ReportCardShell internally. */
export function ReportCardShell({
  id,
  ariaLabelledBy,
  padding = "28px clamp(16px, 4vw, 32px)",
  scrollMarginTop = 72,
  children,
  style,
}: {
  id?: string;
  ariaLabelledBy?: string;
  padding?: number | string;
  scrollMarginTop?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section
      id={id}
      aria-labelledby={ariaLabelledBy}
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: radius.shell,
        padding,
        boxShadow: shadows.card,
        scrollMarginTop,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function PanelShell({
  index,
  title,
  subtitle,
  accent,
  aside,
  children,
}: {
  index: string;
  title: string;
  subtitle?: string;
  accent?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="nfr-panel">
      <SectionHeader
        index={index}
        title={title}
        subtitle={subtitle}
        accent={accent}
        aside={aside}
      />
      {children}
    </div>
  );
}

export function PanelEmptyState({
  index,
  title,
  subtitle,
  infoSize = "default",
  children,
}: {
  index: string;
  title: string;
  subtitle?: string;
  infoSize?: "compact" | "default" | "roomy";
  children: React.ReactNode;
}) {
  return (
    <PanelShell index={index} title={title} subtitle={subtitle}>
      <InfoTile size={infoSize}>{children}</InfoTile>
    </PanelShell>
  );
}

/* StatTile — extracted 2026-05-29 as part of the per-panel split.
 *
 * Three consumer sites with genuinely different layouts:
 *   • "aside" — right-aligned, label below the value, faded "/ total"
 *     denominator (PhaseLadderPanel header aside).
 *   • "headline" — big mono value with a sibling phrase, label optional.
 *     (Was used by the removed CohortPlacementPanel for "p{n} + Top X%
 *     of candidates"; no current consumer, kept for future panels.)
 *   • "monthly" — label above, big mono value with /mo suffix, tax
 *     footnote (RegimeTile inside InHandMonthlyCard).
 *
 * One discriminated-union component carries all three. The variants
 * intentionally don't share more chrome than they need to — the prior
 * rejection of StatTile was correct about that — but the variants ARE
 * worth naming, because each one was being hand-rolled inline with the
 * same magic-number scale (32 / 22 / 56 px) and ad-hoc font/family
 * choices. Centralising them here means a future scale-shift touches
 * one place. */
export type StatTileProps =
  | {
      variant: "aside";
      value: React.ReactNode;
      denominator?: React.ReactNode;
      label?: React.ReactNode;
      valueColor?: string;
    }
  | {
      variant: "headline";
      value: React.ReactNode;
      phrase?: React.ReactNode;
      valueColor?: string;
    }
  | {
      variant: "monthly";
      label: React.ReactNode;
      value: React.ReactNode;
      suffix?: React.ReactNode;
      footnote?: React.ReactNode;
    };

export function StatTile(props: StatTileProps) {
  if (props.variant === "aside") {
    const color = props.valueColor ?? t.coal;
    return (
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 32, fontWeight: 800, fontFamily: f.mono, color, lineHeight: 1 }}>
          {props.value}
          {props.denominator !== undefined && (
            <span style={{ color: t.inkFaint, fontWeight: 500 }}> / {props.denominator}</span>
          )}
        </div>
        {props.label && <EyebrowLabel marginBottom={0} marginTop={4}>{props.label}</EyebrowLabel>}
      </div>
    );
  }
  if (props.variant === "headline") {
    const color = props.valueColor ?? t.coal;
    return (
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 6, flexWrap: "wrap" }}>
        <div
          style={{
            fontSize: 56, fontWeight: 700, fontFamily: f.mono,
            color, letterSpacing: -2, lineHeight: 1,
          }}
        >
          {props.value}
        </div>
        {props.phrase && (
          <div style={{ fontSize: 17, fontWeight: 600, color, lineHeight: 1.2 }}>{props.phrase}</div>
        )}
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontSize: 11, color: t.inkSoft, marginBottom: 4, fontFamily: f.sans }}>
        {props.label}
      </div>
      <div
        style={{
          fontSize: 22, fontWeight: 700, fontFamily: f.mono,
          color: t.coal, lineHeight: 1.1,
        }}
      >
        {props.value}
        {props.suffix && (
          <span style={{ fontSize: 12, fontWeight: 500, color: t.inkSoft, marginLeft: 6 }}>
            {props.suffix}
          </span>
        )}
      </div>
      {props.footnote && (
        <div style={{ fontSize: 10, color: t.inkSoft, marginTop: 4, fontFamily: f.mono }}>
          {props.footnote}
        </div>
      )}
    </div>
  );
}

/* SectionEyebrow — the "01 · OVERVIEW" header rule used by every
 * sr-*Section card. Hoisted here from sr-JumpNav.tsx 2026-05-29 so
 * SrSectionShell can compose it without a cross-file import dance.
 * sr-JumpNav.tsx re-exports for back-compat with any existing
 * `import { SectionEyebrow } from "./sr-JumpNav"` call sites. */
export function SectionEyebrow({ num, label }: { num: string; label: string }) {
  return (
    <div className="ir-section-eyebrow">
      <span className="ir-section-num">{num} · {label.toUpperCase()}</span>
      <span className="ir-section-rule" aria-hidden="true" />
    </div>
  );
}

/* SrSectionShell — the section-card chrome shared by every sr-*Section
 * file. Extracted 2026-05-29: the prior pass split SessionReportView
 * into 18 panel files but each one inlined the same
 * `<section style={shell}><SectionEyebrow/><h2/>[<p subtitle/>]<children/></section>`
 * skeleton. This shell owns:
 *   - the cream/border/shadow card with `scrollMarginTop: 72`
 *   - responsive horizontal padding (`clamp(16px, 4vw, 32px)`) + responsive h2
 *     font size (`clamp(18px, 4.5vw, 22px)`) — matches the canonical pattern
 *     used by NegotiationFullReport's section shell so narrow viewports get
 *     breathing room without per-panel overrides
 *   - the SectionEyebrow row
 *   - the serif h2 with the report's standard heading typography
 *   - an optional subtitle paragraph (default margin 18px below)
 *
 * Sites with non-standard shell shape (padding 0, custom outer container)
 * stay inline — the shell is opt-in for the byte-identical-output case,
 * not a forced abstraction. */
export function SrSectionShell({
  anchorId,
  headingId,
  num,
  label,
  title,
  subtitle,
  aside,
  children,
}: {
  anchorId?: string;
  headingId?: string;
  num: string;
  label: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /* Optional right-aligned slot rendered in a flex row alongside the
   * title/subtitle block — same contract as SectionHeader's aside.
   * Used for inline legends, status chips, "how is this calculated?"
   * buttons, and other small heading-row affordances. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const titleBlock = (
    <>
      <h2
        id={headingId}
        style={{
          fontFamily: f.serif,
          fontSize: "clamp(18px, 4.5vw, 22px)",
          fontWeight: 400,
          color: t.coal,
          margin: subtitle ? "0 0 6px" : 0,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: "0 0 18px", lineHeight: 1.5 }}>
          {subtitle}
        </p>
      )}
    </>
  );
  return (
    <ReportCardShell id={anchorId} ariaLabelledBy={headingId}>
      <SectionEyebrow num={num} label={label} />
      {aside ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>{titleBlock}</div>
          <div style={{ flexShrink: 0 }}>{aside}</div>
        </div>
      ) : titleBlock}
      {children}
    </ReportCardShell>
  );
}

/* Re-export tokens for panel files — they import everything from one
 * place so per-panel imports stay short. */
export { t, f, radius, space } from "../tokens";
