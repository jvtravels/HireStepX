/* HireStepX — Full Salary Negotiation Report (production)
 *
 * Replaces the legacy `NegotiationOutcomeSection` for sessions where
 * `data.negotiationOutcome` is present. Renders a multi-panel deep-dive
 * organised in 4 chapters:
 *
 *   Part 1 — What happened in this call (diagnosis)
 *   Part 2 — What to do next (action: counter-offer email + checklist)
 *   Part 3 — What it's worth in rupees (cohort + NPV math)
 *   Part 4 — Your pattern across sessions (archetype + drills)
 *
 * Design principles:
 *
 *   • Plain English. No jargon (BATNA, anchor delta, NPV, p18) unaided.
 *     Every metric reads as a question or sentence. A first-time
 *     negotiator can read every section without a glossary.
 *
 *   • Honest about empty states. Each panel renders only when its
 *     slice of data is present. The component degrades gracefully if
 *     the backend hasn't wired a particular signal yet — we don't
 *     show "coming soon" placeholders.
 *
 *   • Mobile-first reflow. All 2-up and 3-up grids collapse to single
 *     column at ≤768px via the `nfr-*` classes in styles.ts. The TL;DR
 *     stats grid drops to 2-up on phones, then 1-up under 420px.
 *
 *   • View-mode aware. The "Start here" hint above the TL;DR adapts
 *     to the outcome state — accepted, walked away, no agreement —
 *     and (when present) to daysUntilInterview urgency.
 *
 *   • Production tokens. All colours come from `./tokens` so the
 *     surface stays editorial cream/coal/copper/indigo rather than
 *     freelancing. The TL;DR hero is the one exception (a dark
 *     gradient card) — it earns the contrast as the most-read piece.
 *
 * The legacy NegotiationOutcomeSection is preserved (offer trajectory
 * pill row + acceptance email + transcript export) and rendered as
 * the canonical "outcome record" inside Part 1, alongside the new
 * concession analysis and anchor-bracket panels. Nothing is lost. */

import React, { useState } from "react";
import type { Question } from "./types";
import { t, f, shadows, radius, space } from "./tokens";
import {
  NPV_MODEL,
  derivePhases,
  deriveConcessionsFromOffers,
  deriveAnchorBracket,
  computeNpvRows,
  type NegotiationOutcome,
} from "./derivations";

/* 2026-05-26 editorial rework — the TL;DR no longer renders on a
   dark gradient, so the previous on-dark color block (lightened
   brand hues for AA contrast on the coal→indigo gradient) is
   retired. Tone colors now reuse the standard cream-background
   tokens directly. */

interface Props {
  outcome: NegotiationOutcome;
  role: string;
  company: string;
  questions: Question[];
  daysUntilInterview?: number;
  priorSessionCount?: number;
  /* Optional handler — if wired by the parent, the drill plan cards
     show "Start drill →" buttons that call this with the drill slug.
     If omitted, the buttons are hidden entirely (no placeholder UI). */
  onLaunchDrill?: (slug: string) => void;
  /* Phase 1 SCORE_IMPROVEMENT_PLAN — surfaces the analyzer's tier
     band (FAANG / GCC / unicorn / startup / services / BFSI) in the
     report header, plus in-hand monthly take-home under both regimes
     on the offer card. Undefined for pre-v5 rows or non-salary
     sessions. */
  salaryMeta?: {
    tierBucket?: string;
    tierBucketLabel?: string;
    closingTotalLpa?: number | null;
    monthlyTakeHomeNewRegimeInr?: number | null;
    monthlyTakeHomeOldRegimeInr?: number | null;
    annualTaxNewRegimeLpa?: number | null;
    annualTaxOldRegimeLpa?: number | null;
    /* Phase 3 of Salary-Negotiation plan (2026-05-18) — Indian
       recruiter SECTOR persona surfaced as a chip next to the
       tier band chip. Undefined for pre-v7 rows. */
    recruiterPersona?: string;
    recruiterPersonaLabel?: string;
  };
}

/* ─── Inline primitives ─────────────────────────────────────── */

function FreshnessChip({ source, n, asOf, methodologyUrl }: {
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

/* ─── Shared primitives (2026-05-26 audit) ─────────────────────
 *
 * The prior implementation rolled the same three shapes inline at
 * 15+ call sites: a cream "info tile" callout, a tone-accented event
 * card, and a tiny uppercase mono eyebrow label. The tone-accented
 * card also used a 3px colored `border-left` as its accent — a
 * side-stripe pattern this project's design system bans.
 *
 * These primitives consolidate all three. Tone is now carried by a
 * leading status dot + full 1px tone-tinted border + faint tone-
 * tinted background. The chrome is in styles.ts (`.nfr-info-tile`,
 * `.nfr-tone-card-*`, `.nfr-eyebrow`, `.nfr-quote`) so the React
 * surface stays declarative.
 *
 * Decision (2026-05-26, reconfirmed 2026-05-27): NOT splitting this
 * file into per-panel modules. The 2026-05-27 audit re-evaluated
 * with: 16 panels, 1950 LOC, file still has a single consumer
 * (SessionReportView for salary-neg sessions). A `panels/` directory
 * would yield ~120 LOC average files but add 16 imports, 16
 * round-trips through the import graph, and 16 new module surfaces
 * to maintain — investment without compounding return when no panel
 * is reused elsewhere and each panel is already self-contained and
 * grep-able. The primitive extraction (this section) is where the
 * real leverage lives.
 *
 * Revisit if any of these change:
 *   • panel count crosses 20
 *   • any panel becomes reused outside NegotiationFullReport
 *   • a panel grows past ~250 LOC (currently the max is
 *     CounterOfferLetterPanel at ~160 LOC including helpers)
 *
 * 2026-05-27 additions to this section:
 *   • PanelEmptyState — the `nfr-panel + SectionHeader + InfoTile`
 *     shape appeared at 3 call sites (ConcessionAnalysis turn-zero,
 *     AnchorBracket no-bracket, Archetype <2-sessions).
 *   • EventRow — the `grid auto/1fr/auto` tonal row pattern appeared
 *     at 2 call sites (VerbalHabits costly-phrases, SilenceMap moments).
 *
 * 2026-05-28 additions:
 *   • PanelShell — the `<div className="nfr-panel"><SectionHeader …/>…</div>`
 *     wrapper appeared at 12 call sites. Now one primitive carries the
 *     panel chrome contract; PanelEmptyState became a one-line consumer.
 *     CounterOfferLetterPanel is the lone holdout because it opens with
 *     a "MOST ACTIONABLE" pill row above the section header.
 *   • .nfr-vstack-{sm,md,lg,xl} (styles.ts) — replaces 8+ instances of
 *     `display:flex; flexDirection:column; gap:N` inline. The gap values
 *     map to the spacing scale in tokens.ts.
 *   • space.* tokens (tokens.ts) — names the recurring inline spacing
 *     literals (xs/sm/md/lg/xl/row/block/panel/panelPad/partGap). Replaces
 *     scattered 4/6/8/10/12/14/16/18 across panel internals.
 *   • NPVMathPanel — table now uses the existing `.nfr-table` class +
 *     a new `.nfr-table-total` modifier instead of hand-rolling the
 *     border-collapse + cream-wash + bold-last-row chrome inline.
 *
 * 2026-05-28 part-2 audit:
 *   • Copper-tint tokens — 6 hardcoded `rgba(180,83,9, …)` strings with
 *     5 different alphas (0.06 / 0.08 / 0.18 / 0.20, plus the existing
 *     copperSoft 0.12) lived inline across PhaseLadder, ToneCard,
 *     SectionBand, CohortPlacement, ArchetypePanel, and AmountPill.
 *     Now tokens.ts carries copperWash / copperTint / copperSoft /
 *     copperMid / copperBorder named by role on the surface.
 *
 *   • StatTile — considered and rejected. Three sites (PhaseLadder
 *     aside, CohortPlacement headline, RegimeTile) superficially share
 *     a label-plus-mono-value shape, but each differs on every styling
 *     axis: alignment, label position (above / below / beside), the
 *     role of the secondary element (faded denominator vs. inline /mo
 *     suffix vs. sibling phrase), and scale (32 / 22 / 56 px). A
 *     primitive that fits all three needs 6+ props for 2-3 consumers,
 *     none reused elsewhere — net negative. Local RegimeTile stays
 *     local; the other two stay inline as one-off shapes.
 *
 *   • No file split — re-evaluated. File now 2110 LOC (up ~160 since
 *     last audit). None of the documented revisit criteria are met:
 *     panel count steady at 16, max-panel still ~155 LOC
 *     (CounterOfferLetterPanel), single consumer (SessionReportView).
 *     Splitting would add 16 import sites and 16 module surfaces with
 *     no compounding return. Reaffirmed: one file. */

type Tone = "good" | "warn" | "bad" | "neutral";

function InfoTile({
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

function ToneCard({
  tone,
  pill,
  children,
}: {
  tone: Exclude<Tone, "neutral">;
  /* Optional trailing pill (the prior call sites used `nfr-pill nfr-pill-*`
     for a status word at the right edge — `held` / `deflected` / etc).
     Pass the pill node and ToneCard slots it into the third grid column. */
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

function EyebrowLabel({
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

/* OutlinedCard — the white/cream surface + 1px line + radius.card +
 * uniform padding shape that the two OfferTrajectory states and a few
 * other one-off wrappers were rolling inline. Variants distinguish
 * the bright "this is the recorded record" white card from the muted
 * "this is a contextual stat lockup" cream card.
 *
 * Deliberately NOT generalising to a "Card" component for the whole
 * report — the .nfr-panel class is already the canonical panel chrome.
 * This primitive is for the smaller in-panel callouts that aren't
 * panels themselves but want consistent edge treatment. */
function OutlinedCard({
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

function QuoteBlock({ children }: { children: React.ReactNode }) {
  /* Quotation marks live in JSX (not CSS pseudo-elements) so the
     glyph is selectable + accessible to copy/paste. */
  return <div className="nfr-quote">&ldquo;{children}&rdquo;</div>;
}

/* PanelEmptyState — the `nfr-panel + SectionHeader + InfoTile` shape
 * for panels that have a header to render but no data to surface yet.
 * The rule across all 3 prior call sites: render the header so the
 * user can see what's being measured, render an honest "we don't
 * have the signal" tile underneath (NOT a fabricated verdict). The
 * InfoTile body varies — pass it as children. */
function PanelEmptyState({
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

/* EventRow — `display: grid; auto / 1fr / auto` tonal row for
 * timeline-style events (verbal habits, silence moments). The two
 * prior call sites had the same 3-column layout (leading marker /
 * primary+secondary text / trailing pill) and differed only in the
 * background tint (creamSoft vs success100/error100). Tone-tinted
 * variants drive the background from a token, so the row reads as
 * an extension of the report's existing tone vocabulary.
 *
 * For "neutral" rows on cream the background is creamSoft; for
 * good/bad rows it's the matching token100 wash. The leading +
 * trailing slots can be omitted (renders as an aria-hidden filler
 * to keep the grid columns stable). */
function EventRow({
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

/* Tone → token color. Was repeated as a ternary at five call sites
 * (PhaseLadderPanel, AnchorBracketPanel, NPVMathPanel, Cohort, Archetype).
 * Now: one switch, one place to change if the palette shifts. */
function toneToColor(tone: Tone): string {
  switch (tone) {
    case "good": return t.success;
    case "warn": return t.copper;
    case "bad":  return t.error;
    case "neutral": return t.coal;
  }
}

/* Header chip — the small uppercase mono pill row above the report
 * title. Was three near-identical 16-line inline-styled <span> blocks
 * (main eyebrow / tier band / recruiter persona). Same chrome, three
 * call sites, two variants: the lead chip uses the copper-soft accent;
 * the trailing meta chips use the cream-soft neutral. */
function HeaderChip({
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

function PlayableTime({ at }: { at: string }) {
  /* 2026-05-26 a11y pass — the prior implementation carried
     `role="button"`, `tabIndex={0}`, and a tooltip ("Jump to this
     moment in the recording") without an `onClick` or `onKeyDown`
     handler. That's a false affordance: screen readers announced
     "button" and keyboard users could focus a control that did
     nothing. The visual hover style was the same lie in CSS.
     Until audio-playback wiring is implemented, render as a plain
     timestamp pill (display-only). When playback lands, swap this
     for a `<button>` with onClick + visible :focus-visible ring. */
  return (
    <span className="nfr-time-pill">
      <span style={{ fontSize: 9 }} aria-hidden>▶</span>
      <span className="sr-only">at </span>
      {at}
    </span>
  );
}

function SectionHeader({ index, title, subtitle, accent = t.indigo, aside }: {
  index: string; title: string; subtitle?: string; accent?: string;
  /* Optional trailing slot — renders to the right of the title block on
   * a baseline-aligned row. Three panels (PhaseLadder, CohortPlacement,
   * Counterparty) used to wrap SectionHeader in an identical
   * `display:flex; space-between` div to pin a stat tile or freshness
   * chip alongside the title. That wrapper now lives here so the call
   * sites don't repeat the same 3-property style object. */
  aside?: React.ReactNode;
}) {
  /* 2026-05-26 a11y pass — panel titles are now real h4 elements
     under the chapter h3 (SectionBand) and the page h2 ("The full
     breakdown of your negotiation"), giving the report a real
     heading-tree screen readers can navigate. The visual styling
     (serif 18px, weight 600, kerned) is preserved via inline style;
     UA defaults for h4 (browser-tinted margin / weight) are reset. */
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

function SectionBand({
  label, title, subtitle, accent, bg, anchorId,
}: { label: string; title: string; subtitle: string; accent: string; bg: string; anchorId?: string }) {
  /* 2026-05-26 a11y pass — chapter titles ("What happened in this
     call", etc.) are now real h3 elements under the page h2,
     forming the chapter level in the heading tree. */
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


/* PanelShell — the `<div className="nfr-panel"><SectionHeader … />…</div>`
 * wrapper that opens 13 of the 16 panels. The prior implementation
 * had each panel re-open this scaffolding by hand, which meant:
 * (a) any panel-chrome change (border, padding, radius) had to be
 * applied at 13 call sites or the .nfr-panel class itself, (b) the
 * "panel has a header" invariant was structural in JSX rather than
 * enforced by the type, (c) the EmptyState variant (`PanelEmptyState`)
 * looked like a different shape when it's really PanelShell + a single
 * InfoTile child.
 *
 * The full-panel variant accepts the SectionHeader props inline so
 * call sites read as one block per panel instead of two. Pass
 * `index=""` to suppress the header (no panel currently needs this,
 * but the type carries it for future). */
function PanelShell({
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

/* ─── Panels ─────────────────────────────────────────────────── */

/* Render the start-here hint only for state-specific guidance — when
   we actually have something useful to say (real round imminent, or
   the outcome was accepted/walked-away). For the default case, the
   TL;DR hero IS the start-here cue, so an additional arrow is just
   redundant chrome. */
/* Anchor IDs for in-page jumps from the start-here hint. */
const ANCHOR_PART_2 = "nfr-part-2";
const ANCHOR_PART_3 = "nfr-part-3";
const ANCHOR_PART_4 = "nfr-part-4";

function StartHereHint({ outcome, daysUntilInterview }: { outcome: NegotiationOutcome; daysUntilInterview?: number }) {
  let body: React.ReactNode = null;
  if (typeof daysUntilInterview === "number" && daysUntilInterview <= 7) {
    body = (
      <>
        Real round in {daysUntilInterview} day{daysUntilInterview === 1 ? "" : "s"}. Skip to{" "}
        <a href={`#${ANCHOR_PART_2}`} className="nfr-anchor" style={anchorStyle}>Part 2</a> for the email draft you can send.
      </>
    );
  } else if (outcome.outcome === "accepted") {
    body = (
      <>
        You accepted. The most useful section here is{" "}
        <a href={`#${ANCHOR_PART_4}`} className="nfr-anchor" style={anchorStyle}>Part 4</a>: what to take into your next negotiation.
      </>
    );
  } else if (outcome.outcome === "walked_away") {
    body = (
      <>
        You walked away.{" "}
        <a href={`#${ANCHOR_PART_3}`} className="nfr-anchor" style={anchorStyle}>Parts 3</a> and{" "}
        <a href={`#${ANCHOR_PART_4}`} className="nfr-anchor" style={anchorStyle}>4</a> (rupees + pattern) are the most useful for your next round.
      </>
    );
  }
  if (body === null) return null;
  return (
    <div className="nfr-start-here">
      {/* SVG arrow — Unicode → renders inconsistently across browsers and font stacks */}
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden style={{ flexShrink: 0 }}>
        <path d="M2 7h9M7 3l4 4-4 4" stroke={t.copper} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span><strong>Start here:</strong> {body}</span>
    </div>
  );
}
const anchorStyle: React.CSSProperties = {
  color: t.copper,
  textDecoration: "underline",
  textUnderlineOffset: 2,
  fontWeight: 600,
};

function TLDRHero({
  outcome, role, company,
}: { outcome: NegotiationOutcome; role: string; company: string }) {
  const offers = outcome.offers ?? [];
  const opening = offers[0]?.total ?? null;
  const closing = outcome.finalTotal ?? (offers[offers.length - 1]?.total ?? null);
  const delta = (opening !== null && closing !== null) ? closing - opening : null;
  const askGap = (outcome.candidateAsk !== null && opening !== null && closing !== null && outcome.candidateAsk > opening)
    ? Math.round(((closing - opening) / (outcome.candidateAsk - opening)) * 100)
    : null;

  const phaseCount = derivePhases(outcome).filter(p => p.reached).length;
  const TOTAL_PHASES = 5;

  /* Verdict copy — the actual payload of the TL;DR. Reads like a
     pull-quote (serif, 30px) above the metric lockup. Punctuation
     uses commas and periods, no em dashes. */
  let verdict: string;
  if (outcome.outcome === "accepted" && delta !== null && delta > 0) {
    verdict = `You moved the offer from ₹${opening} LPA up to ₹${closing} LPA, ₹${delta * 4}L extra over four years before tax.${askGap !== null ? ` You closed ${askGap}% of the gap to your stated ask.` : ""}`;
  } else if (outcome.outcome === "accepted" && delta === 0) {
    verdict = `You accepted at ₹${closing} LPA, the same as their first offer. No counter, no movement. Comparable candidates typically push 15 to 35% above the opening number.`;
  } else if (outcome.outcome === "walked_away") {
    verdict = `You walked away from a ₹${closing} LPA offer for ${role} at ${company}. The panels below help you decide whether the next round of this role (or a similar one) is worth a counter-anchor.`;
  } else {
    verdict = `You explored ${offers.length} offer point${offers.length !== 1 ? "s" : ""} but didn't close. Part 2 has the email draft you can send to keep the conversation alive.`;
  }

  type StatTone = "good" | "bad" | "warn" | "neutral";
  const stats: Array<{ label: string; value: string; hint?: string; tone: StatTone }> = [];

  /* Detect the "sparse no-counter" pattern — phaseCount=1, no counter,
     no delta. Without this branch, three of four TL;DR stats would
     render in the bad-tone (red on dark), reading as uniform failure
     to a first-time negotiator. Replace one red stat with a neutral
     "first session — here's where you are" framing tile. */
  const isSparseFirstSession =
    delta === 0 &&
    outcome.candidateAsk === null &&
    phaseCount <= 1 &&
    typeof outcome.percentileWithinBand !== "number";

  if (isSparseFirstSession) {
    stats.push({
      label: "Where you are now",
      value: "Session 1",
      hint: "first negotiation. Part 2 below has the email draft to start from",
      tone: "neutral",
    });
  } else if (delta !== null) {
    /* Honest semantics for delta = 0: the candidate accepted the first
       offer and "left money on the table" relative to a typical 15–35%
       counter. Don't label this as "What you won" — it isn't. */
    if (delta > 0) {
      stats.push({
        label: "What you won",
        value: `+₹${delta * 4}L`,
        hint: "extra rupees over 4 years, before tax",
        tone: "good",
      });
    } else if (delta < 0) {
      stats.push({
        label: "What it cost you",
        value: `−₹${Math.abs(delta * 4)}L`,
        hint: "rupees lost over 4 years, before tax",
        tone: "bad",
      });
    } else {
      stats.push({
        label: "Money you left on the table",
        value: "—",
        hint: "you accepted at the first number; no counter named",
        tone: "bad",
      });
    }
  }
  if (typeof outcome.percentileWithinBand === "number") {
    const p = outcome.percentileWithinBand;
    /* Avoid the awkward "Middle 50% of candidates" phrasing — for the
       p40–p60 band, frame as "Around the middle" instead of a percentile
       (every candidate is in some "middle" by definition). */
    let phrase: string;
    if (p < 30) phrase = `Bottom ${p}%`;
    else if (p > 70) phrase = `Top ${100 - p}%`;
    else phrase = "Around the middle";
    stats.push({
      label: "How you ranked",
      value: phrase,
      hint: "vs others who got offers in this band",
      tone: p < 30 ? "bad" : p > 70 ? "good" : "warn",
    });
  }
  stats.push({
    label: "How far you got",
    value: `${phaseCount} of ${TOTAL_PHASES} stages`,
    hint:
      phaseCount === TOTAL_PHASES ? "you closed the deal" :
      phaseCount >= 4 ? "one short of the close" :
      phaseCount >= 2 ? "made it past the counter" :
      phaseCount === 1 ? "you named a counter. Part 2 below shows the next move" :
      "you didn't push past the first offer. Part 2 has the email draft",
    tone: phaseCount >= 4 ? "good" : phaseCount >= 2 ? "warn" : "bad",
  });
  if (delta !== null && opening !== null) {
    const askedFor = outcome.candidateAsk;
    if (askedFor !== null && askedFor > opening) {
      const askPct = Math.round(((askedFor - opening) / opening) * 100);
      stats.push({
        label: "How much you pushed back",
        value: `+${askPct}%`,
        hint: "above their first offer",
        tone: askPct >= 25 ? "good" : askPct >= 10 ? "warn" : "bad",
      });
    } else {
      stats.push({
        label: "How much you pushed back",
        value: "0%",
        hint: "you didn't name a counter-number",
        tone: "bad",
      });
    }
  }

  return (
    <section className="nfr-tldr" aria-labelledby="nfr-tldr-eyebrow">
      <div id="nfr-tldr-eyebrow" className="nfr-tldr-eyebrow">
        The 30-second read
      </div>
      <p className="nfr-tldr-verdict">{verdict}</p>
      {stats.length > 0 && (
        <div className="nfr-tldr-evidence">
          {stats.map((s, i) => (
            <div key={i} className="nfr-tldr-evidence-row">
              <div className="nfr-tldr-evidence-label">{s.label}</div>
              <div className={`nfr-tldr-evidence-value nfr-tldr-tone-${s.tone}`}>
                {s.value}
              </div>
              {s.hint && <div className="nfr-tldr-evidence-hint">{s.hint}</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PhaseLadderPanel({ outcome }: { outcome: NegotiationOutcome }) {
  const phases = derivePhases(outcome);
  const reached = phases.filter(p => p.reached).length;
  const total = phases.length;
  const reachedColor = reached >= 4 ? t.success : reached >= 2 ? t.copper : t.error;
  return (
    <PanelShell
      index="01"
      title="How far you got in the negotiation"
      subtitle={`A strong negotiation moves through ${total} stages, from naming a counter all the way to closing.`}
      aside={
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 32, fontWeight: 800, fontFamily: f.mono, color: reachedColor, lineHeight: 1 }}>
            {reached}<span style={{ color: t.inkFaint, fontWeight: 500 }}> / {total}</span>
          </div>
          <EyebrowLabel marginBottom={0} marginTop={4}>Stages</EyebrowLabel>
        </div>
      }
    >
      <div className="nfr-phase-rail" style={{ display: "flex", gap: space.xs, marginBottom: space.block, marginTop: space.xs }}>
        {phases.map((p) => (
          <div key={p.num} style={{ flex: 1, height: 8, borderRadius: radius.sm, background: p.reached ? t.success : t.line }} />
        ))}
      </div>
      {/* Find the index of the first unreached stage — that's the
          "next move" we highlight with a copper "← Try this next"
          pill instead of the same neutral "Not reached" pill the
          other unreached stages get. Turns one of the failures into
          a forward arrow rather than five greyed-out rows. */}
      {(() => {
        const nextIdx = phases.findIndex(p => !p.reached);
        return (
          <div className="nfr-vstack-md">
            {phases.map((p, i) => {
              const isNext = i === nextIdx;
              const bg = p.reached ? t.success100 : isNext ? t.copperWash : t.creamSoft;
              const border = p.reached ? t.success : isNext ? t.copper : t.line;
              return (
                <div
                  key={p.num}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "12px 14px",
                    background: bg,
                    border: `1px solid ${border}`,
                    borderRadius: radius.xl,
                    opacity: p.reached || isNext ? 1 : 0.6,
                  }}
                >
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: p.reached ? t.success : isNext ? t.copper : "#FFFFFF",
                      color: p.reached || isNext ? "#FFFFFF" : t.inkFaint,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 13, fontFamily: f.mono,
                      border: p.reached || isNext ? "none" : `1px solid ${t.lineStrong}`,
                      flexShrink: 0,
                    }}
                  >
                    {p.reached ? "✓" : p.num}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.coal }}>{p.name}</div>
                    {p.note && <div style={{ fontSize: 12, color: t.inkSoft, marginTop: 2 }}>{p.note}</div>}
                  </div>
                  <span className={`nfr-pill ${p.reached ? "nfr-pill-good" : isNext ? "nfr-pill-warn" : "nfr-pill-neutral"}`}>
                    {p.reached ? "Reached" : isNext ? "Try this next" : "Not reached"}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}
    </PanelShell>
  );
}

function ConcessionAnalysisPanel({ outcome }: { outcome: NegotiationOutcome }) {
  const events = outcome.pushbacks ?? deriveConcessionsFromOffers(outcome);
  const offerRounds = (outcome.offers ?? []).length;
  /* PDF#45 audit (2026-05-26) — honest empty state.
   *
   * When the classifier hasn't produced grounded pushback events
   * but offers DID move (≥2 rounds), render a transparent "we
   * tracked the rupee trajectory but didn't classify your verbal
   * responses" tile instead of fabricating verdicts from delta
   * sign. When there were <2 rounds, hide the panel entirely
   * (nothing happened worth analysing). */
  if (events.length === 0) {
    if (offerRounds < 2) return null;
    return (
      <PanelEmptyState
        index="02"
        title="When they pushed back, did you fold?"
        subtitle={`${offerRounds} offer rounds tracked.`}
      >
        We tracked the rupee trajectory across {offerRounds} rounds (see the
        outcome record above), but we don't have a transcript-grounded
        read on how you responded to each pushback in this session.
        Next round: name a defended range up front so each recruiter
        counter has something specific to push against.
      </PanelEmptyState>
    );
  }
  const held = events.filter(e => e.outcome === "held").length;
  return (
    <PanelShell
      index="02"
      title="When they pushed back, did you fold?"
      subtitle={`You held ${held} of ${events.length} pushbacks.`}
    >
      <div className="nfr-vstack">
        {events.map((e, i) => {
          const tone: "good" | "warn" | "bad" =
            e.outcome === "held" ? "good" : e.outcome === "deflected" ? "warn" : "bad";
          return (
            <ToneCard
              key={i}
              tone={tone}
              pill={<span className={`nfr-pill nfr-pill-${tone}`}>{e.outcome}</span>}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: t.coal, marginBottom: 3 }}>
                "{e.pushback}"
              </div>
              <div style={{ fontSize: 12, color: t.inkSoft, lineHeight: 1.5 }}>{e.detail}</div>
            </ToneCard>
          );
        })}
      </div>
    </PanelShell>
  );
}

function AnchorBracketPanel({ outcome }: { outcome: NegotiationOutcome }) {
  const bracket = deriveAnchorBracket(outcome);
  /* PDF#45 audit (2026-05-26) — when the candidate DID name a
   * counter but the classifier hasn't produced grounded
   * anchorBracket data, render a transparent "we recorded ₹X but
   * don't have a read on how you defended it" tile instead of
   * inventing a "you named a single number" verdict. */
  if (!bracket) {
    if (outcome.candidateAsk === null) return null;
    return (
      <PanelEmptyState
        index="03"
        title="The way you named your number"
        subtitle={`You countered with ₹${outcome.candidateAsk} LPA.`}
      >
        We logged your counter but don't have a transcript-grounded
        read on how you framed it (single number, range, or range
        with justification). The strongest move next round: name a
        defended range, e.g. "I was anchoring at ₹X-Y based on what
        I'm seeing in the market and where I am in other
        conversations", so the recruiter has to produce a
        counter-justification rather than just naming a lower number.
      </PanelEmptyState>
    );
  }
  const map = {
    single: { label: "Single number", tone: "warn" as const, ladder: 1 },
    range: { label: "Range only", tone: "warn" as const, ladder: 2 },
    range_with_justification: { label: "Range + justification", tone: "good" as const, ladder: 3 },
    none: { label: "No counter named", tone: "bad" as const, ladder: 0 },
  };
  const m = map[bracket.type];
  const toneColor = toneToColor(m.tone);
  return (
    <PanelShell
      index="03"
      title="The way you named your number"
      subtitle="There are 4 ways to counter an offer, from weakest to strongest."
    >
      <div style={{ marginBottom: space.xl }}>
        <span className={`nfr-pill nfr-pill-${m.tone}`}>{m.label}</span>
      </div>
      {bracket.quote && (
        <div style={{ marginBottom: space.xl }}>
          <QuoteBlock>{bracket.quote}</QuoteBlock>
        </div>
      )}
      <div style={{ fontSize: 13, color: t.inkSoft, lineHeight: 1.55 }}>{bracket.verdict}</div>
      <div style={{ marginTop: space.block, display: "flex", gap: space.sm }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1, height: 6, borderRadius: radius.rail,
              background: i <= m.ladder ? toneColor : t.line,
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex", justifyContent: "space-between",
          marginTop: space.sm, fontSize: 10, color: t.inkFaint, letterSpacing: 0.4,
        }}
      >
        <span>NONE</span><span>SINGLE</span><span>RANGE</span><span>RANGE + JUSTIFY</span>
      </div>
    </PanelShell>
  );
}

function VerbalHabitsPanel({ outcome }: { outcome: NegotiationOutcome }) {
  if (!outcome.verbalHabits || outcome.verbalHabits.length === 0) return null;
  const leaks = outcome.disclosureLeaks ?? [];
  return (
    <PanelShell
      index="04"
      title="Words you said that hurt your offer"
      subtitle="Phrases like 'I think', 'kind of', or 'sounds fair' make recruiters lower their offer. Click the timestamp to listen back."
    >
      <div style={{ marginBottom: leaks.length > 0 ? space.panel : 0 }}>
        <EyebrowLabel>TOP COSTLY PHRASES</EyebrowLabel>
        <div className="nfr-vstack-md">
          {outcome.verbalHabits.map((h, i) => (
            <EventRow
              key={i}
              tone="neutral"
              leading={
                <div style={{ fontFamily: f.mono, fontSize: 14, fontWeight: 700, color: t.error, minWidth: 32 }}>
                  ×{h.count}
                </div>
              }
              primary={
                <div style={{ fontSize: 13, fontWeight: 500, color: t.coal, fontFamily: f.mono }}>
                  "{h.phrase}"
                </div>
              }
              secondary={<span style={{ fontSize: 11 }}>{h.cost}</span>}
              trailing={
                h.timestamps && h.timestamps.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end", maxWidth: 180 }}>
                    {h.timestamps.map((ts, j) => <PlayableTime key={j} at={ts} />)}
                  </div>
                ) : undefined
              }
            />
          ))}
        </div>
      </div>
      {leaks.length > 0 && (
        <div>
          <EyebrowLabel color={t.error}>DISCLOSURE LEAKS · {leaks.length}</EyebrowLabel>
          {/* Migrated to EventRow tone="bad" — was hand-rolling the same
              error100-bg + tile-radius + leading-time pattern that
              EventRow already owns. Visual: identical (paddingX=12 matches
              the prior 10px 12px; the extra 2px on Y is intentional —
              EventRow's default 10px brings the leak rows into the same
              vertical rhythm as the costly-phrases rows above). */}
          <div className="nfr-vstack-sm">
            {leaks.map((l, i) => (
              <EventRow
                key={i}
                tone="bad"
                leading={<PlayableTime at={l.at} />}
                primary={
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.error, fontFamily: f.mono }}>
                    · {l.leak}
                  </div>
                }
                secondary={<span style={{ fontSize: 11 }}>{l.cost}</span>}
              />
            ))}
          </div>
        </div>
      )}
    </PanelShell>
  );
}

function SilenceMapPanel({ outcome }: { outcome: NegotiationOutcome }) {
  if (!outcome.silenceMoments || outcome.silenceMoments.length === 0) return null;
  return (
    <PanelShell
      index="05"
      title="When you went quiet, and whether it helped"
      subtitle="Silence after you name a number is your friend. Silence when you should be pushing back is your enemy."
    >
      <div className="nfr-vstack">
        {outcome.silenceMoments.map((s, i) => (
          <EventRow
            key={i}
            tone={s.healthy ? "good" : "bad"}
            paddingX={14}
            leading={<PlayableTime at={s.at} />}
            primary={<div style={{ fontSize: 13, fontWeight: 600, color: t.coal }}>{s.duration} silence</div>}
            secondary={s.context}
            trailing={
              <span className={`nfr-pill ${s.healthy ? "nfr-pill-good" : "nfr-pill-bad"}`}>
                {s.healthy ? "Served you" : "Filled too fast"}
              </span>
            }
          />
        ))}
      </div>
    </PanelShell>
  );
}

function UnaskedLeversPanel({ outcome }: { outcome: NegotiationOutcome }) {
  if (!outcome.unaskedLevers || outcome.unaskedLevers.length === 0) return null;
  return (
    <PanelShell
      index="06"
      title="Questions you should have asked but didn't"
      subtitle="Each of these would likely have unlocked more money. We explain what each is worth."
    >
      {/* Side-stripe replaced with a leading numbered marker — the
          set is a SHORTLIST of N specific questions, so numbering
          carries the visual rhythm honestly (a stripe was just
          chrome). */}
      <ol
        className="nfr-vstack-lg"
        style={{ listStyle: "none", padding: 0, margin: 0 }}
      >
        {outcome.unaskedLevers.map((l, i) => (
          <li key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 14 }}>
            <span
              style={{
                fontFamily: f.mono, fontSize: 13, fontWeight: 700,
                color: t.copper, paddingTop: 1,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.coal, fontFamily: f.mono, marginBottom: 4 }}>
                {l.question}
              </div>
              <div style={{ fontSize: 12, color: t.inkSoft, lineHeight: 1.5 }}>{l.whyItMatters}</div>
            </div>
          </li>
        ))}
      </ol>
    </PanelShell>
  );
}

/* Inline glossary — terms in the counter-offer letter that first-time
   negotiators (especially first-job-in-family) won't know. The browser's
   native title attribute is used for the tooltip so it works on
   touch devices via long-press without a JS dependency. */
const GLOSSARY: Record<string, string> = {
  "variable pay":
    "The portion of your salary tied to performance: bonus, profit-share, or commission. 'Target with upside' means it can exceed the target; 'hard cap' means the target is the maximum.",
  "stock-option grant":
    "Shares of the company you can buy at a fixed price after a waiting period. The grant is the total number of shares promised; vesting is how they unlock over time.",
  "front-loaded":
    "An ESOP grant that vests faster in the early years (e.g. 40% in year 1). Better for you than even vesting because you get value faster.",
  "refresh policy":
    "Whether the company gives you additional stock-option grants each year (typically year 2 onwards) to keep your total package competitive.",
  "signing component":
    "An upfront one-time bonus paid when you sign. Usually used to offset unvested ESOPs you're leaving behind at your current employer.",
};

/* PlaceholderPill — the yellow `<Recruiter>` / `<Your name>` tag the
 * counter-offer letter renders for every `<...>` token. Semantic, not
 * decorative: the tag signals "you MUST replace this before sending".
 * Inline yellow background + dashed warning border carries the
 * affordance without copy. */
function PlaceholderPill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        background: t.warning100,
        border: `1px dashed ${t.warning}`,
        color: t.coal,
        fontFamily: f.mono,
        fontSize: 12,
        fontWeight: 600,
        borderRadius: radius.sm,
        margin: "0 1px",
      }}
    >
      {children}
    </span>
  );
}

/* GlossaryTerm — dotted-underline + native `title` tooltip. Used by
 * decorateGlossary to mark terms a first-time negotiator may not know
 * (variable pay, refresh policy, signing component, …). `cursor: help`
 * is the browser-standard affordance for "definition available on
 * hover". The native title attribute works on touch via long-press
 * without a JS dependency. */
function GlossaryTerm({ definition, children }: { definition: string; children: React.ReactNode }) {
  return (
    <span
      title={definition}
      style={{
        borderBottom: `1px dotted ${t.inkFaint}`,
        cursor: "help",
      }}
    >
      {children}
    </span>
  );
}

/* Splits a letter body on `<Anything>` placeholder tokens AND on
   glossary terms. Placeholders become yellow pills (must-replace);
   glossary terms become dotted-underlined hover-tooltipped phrases. */
function renderLetterWithPlaceholders(letter: string): React.ReactNode {
  // First split on placeholders.
  const parts = letter.split(/(<[^>]+>)/g);
  return parts.map((part, i) => {
    if (/^<[^>]+>$/.test(part)) {
      return <PlaceholderPill key={i}>{part}</PlaceholderPill>;
    }
    // For non-placeholder runs, decorate glossary terms.
    return <React.Fragment key={i}>{decorateGlossary(part)}</React.Fragment>;
  });
}

function decorateGlossary(text: string): React.ReactNode {
  const terms = Object.keys(GLOSSARY);
  if (terms.length === 0) return text;
  // Build a regex that matches any glossary term, case-insensitive.
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const segments = text.split(pattern);
  return segments.map((seg, j) => {
    const def = GLOSSARY[seg.toLowerCase()];
    if (def) {
      return (
        <GlossaryTerm key={j} definition={def}>
          {seg}
        </GlossaryTerm>
      );
    }
    return seg;
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function CounterOfferLetterPanel({
  outcome, role, company,
}: { outcome: NegotiationOutcome; role: string; company: string }) {
  const closing = outcome.finalTotal ?? (outcome.offers[outcome.offers.length - 1]?.total ?? null);
  const [copied, setCopied] = useState(false);

  if (closing === null) return null;

  /* Three letter shapes — none of them invent a counter number. The
     fallback case (no candidateAsk yet) emits a "you didn't name a
     counter — here's how to open" template that asks the user to fill
     in the bracket, rather than fabricating a +15% number that may be
     way off-band for some roles. */
  let letter: string;
  let commentary: string[];

  if (outcome.outcome === "accepted") {
    letter = `Hi <Recruiter>,

Thank you for the offer for the ${role} role at ${company}. I'm happy to formally accept the package at ₹${closing} LPA total CTC.

Could you send the formal offer letter at your convenience? Happy to confirm notice period and start date once that's in hand.

Best,
<Your name>`;
    commentary = [
      "Confirms acceptance in plain language, no ambiguity for the recruiter",
      "Asks for the formal letter without making it adversarial",
      "Closes with notice period, surfaces the next concrete step",
    ];
  } else if (outcome.candidateAsk !== null) {
    /* Re-anchor with the user's actual stated number — never fabricated. */
    letter = `Hi <Recruiter>,

Thanks for the productive call. I want to keep the conversation alive, I'm genuinely interested in the ${role} role at ${company}.

Where I think we are: you're at ₹${closing} LPA, I'm anchored at ₹${outcome.candidateAsk} LPA. A few questions that might help us close the gap:

  · Is the variable pay a target with upside, or a hard cap?
  · What's the standard stock-option grant at this level, front-loaded or evenly vested?
  · Is a signing component a lever you have at this band?

Happy to jump on a call. Looking forward to closing this together.

Best,
<Your name>`;
    commentary = [
      `Re-anchors with the specific number you named (₹${outcome.candidateAsk} LPA), so the recruiter can't reset the conversation`,
      "Asks 3 specific lever questions, opening 3 negotiation surfaces at once",
      "Stays collaborative: 'looking forward to closing this together' invites a counter, not a refusal",
    ];
  } else {
    /* No counter named yet — emit a template with placeholders for the
       user to fill in, not a fabricated number. The bracket below is
       a SHAPE, not a recommendation: we explicitly tell the user to
       research before naming a number. */
    letter = `Hi <Recruiter>,

Thanks for the offer for the ${role} role at ${company}. I'd like to take a moment to think it through against the market for this band before responding fully.

A few questions that would help me put together a thoughtful response:

  · Is the variable pay a target with upside, or a hard cap?
  · What's the standard stock-option grant at this level, and the refresh policy at year 2?
  · Is a signing component a lever you have at this band?
  · What flexibility is there on work-from-home days?

Once I have a clearer picture, I'd like to come back with a specific number. Could we set up a follow-up call this week?

Best,
<Your name>

— — —
Before you send: name a specific counter number in your follow-up call. Look up the band on Levels.fyi or
Glassdoor for "${role}" at companies similar to ${company} this quarter. A defended range
("I was anchoring at ₹X–Y based on what I'm seeing") is stronger than a single number.`;
    commentary = [
      "Buys time without committing to a number you haven't researched yet",
      "Asks 4 specific lever questions, keeping the conversation alive on multiple fronts",
      "Sets up a follow-up where you can name a specific counter, once you've done the research",
      "The footer reminds you to research the market band before naming a number. Strong anchors are defended ranges, not single numbers",
    ];
  }

  return (
    <div className="nfr-panel">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <span className="nfr-pill nfr-pill-good">MOST ACTIONABLE</span>
      </div>
      <SectionHeader
        index="07"
        title="Your counter-offer email, ready to send"
        subtitle="We wrote this from your call. Replace the highlighted placeholders, then copy and send."
      />
      {/* Reminder banner above the letter — placeholders are highlighted
          inline below but a top-of-frame reminder catches users who
          scan-and-copy before reading. */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px", marginBottom: 10,
          background: "#FEF3C7", border: `1px solid ${t.warning}`,
          borderRadius: radius.lg, fontSize: 12, color: t.coal,
        }}
      >
        <span style={{ fontWeight: 600, color: t.warning }}>Heads up</span>
        <span>Replace the yellow placeholders before you press send.</span>
      </div>
      {/* Switched from <pre> to <div> with white-space: pre-line so long
          lines soft-wrap cleanly on phones. <pre> kept lines rigid and
          forced horizontal scroll on narrow screens. The body is
          rendered via renderLetterWithPlaceholders so `<Recruiter>` and
          `<Your name>` (etc.) appear as highlighted yellow pills, not
          plain text easy to overlook. */}
      <div
        style={{
          margin: "0 0 16px",
          padding: space.panelPad, background: t.cream, border: `1px solid ${t.lineStrong}`,
          borderRadius: radius.xl, fontFamily: f.sans, fontSize: 14,
          color: t.coal, lineHeight: 1.65, whiteSpace: "pre-line",
          wordBreak: "break-word", overflow: "auto",
        }}
      >
        {renderLetterWithPlaceholders(letter)}
      </div>
      <div>
        <EyebrowLabel>WHY THIS DRAFT</EyebrowLabel>
        {commentary.map((c, i) => (
          <div key={i} style={{ fontSize: 13, color: t.coal, marginBottom: 6, paddingLeft: 16, position: "relative" }}>
            <span style={{ position: "absolute", left: 0, color: t.indigo }}>·</span>
            {c}
          </div>
        ))}
      </div>
      <div className="nfr-letter-actions">
        <button
          className="nfr-btn-primary"
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.clipboard) {
              navigator.clipboard.writeText(letter).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              });
            }
          }}
          aria-live="polite"
        >
          {copied ? "✓ Copied" : "Copy as email"}
        </button>
        {/* Other action buttons (Edit-in-voice, Show alternatives,
            Translate to Hindi) intentionally NOT rendered — they're
            spec hooks for unbuilt features. Showing non-functional
            buttons erodes trust. Add them back when wired. */}
      </div>
    </div>
  );
}

function CohortPlacementPanel({ outcome }: { outcome: NegotiationOutcome }) {
  if (typeof outcome.percentileWithinBand !== "number") return null;
  const p = outcome.percentileWithinBand;
  const tone = p < 30 ? t.error : p > 70 ? t.success : t.copper;
  /* Avoid the awkward "Middle 50%" phrasing — every candidate is in
     some "middle" by definition. For p30–p70 say "around the middle"
     instead, which reads as honest rather than uselessly precise. */
  const phrase = p < 30 ? `Bottom ${p}% of candidates` : p > 70 ? `Top ${100 - p}% of candidates` : "Around the middle of the band";
  /* Trust threshold — show the percentile only when the backend has
     actually wired the cohort attribution. Without n + freshness,
     the percentile reads as "trust me" math; with them, users can
     calibrate how much to weigh it. */
  const hasAttribution = typeof outcome.cohortN === "number" && !!outcome.cohortFreshness;
  return (
    <PanelShell
      index="08"
      title="Where your offer sits vs others like you"
      subtitle={outcome.cohortLabel ?? "Compared to candidates with the same role + level + company tier."}
      aside={
        hasAttribution ? (
          <FreshnessChip
            source="Cohort data"
            n={outcome.cohortN}
            asOf={outcome.cohortFreshness}
            methodologyUrl={outcome.cohortMethodologyUrl}
          />
        ) : (
          <span
            className="nfr-pill nfr-pill-neutral"
            title="Cohort attribution not yet available; treat the placement as an early estimate."
          >
            Early estimate
          </span>
        )
      }
    >
      {/* When attribution is wired (n + freshness), show the big
          authoritative percentile + bar. When it isn't, the percentile
          is an internal estimate — we render a verbal phrase only,
          so the soft "Early estimate" pill isn't competing against a
          56px number for the user's eye. */}
      {hasAttribution ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 6, flexWrap: "wrap" }}>
            <div
              style={{
                fontSize: 56, fontWeight: 700, fontFamily: f.mono,
                color: tone, letterSpacing: -2, lineHeight: 1,
              }}
            >
              p{p}
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, color: tone, lineHeight: 1.2 }}>{phrase}</div>
          </div>
          <div
            style={{
              height: 12, background: t.line, borderRadius: radius.tile,
              position: "relative", marginBottom: 8, marginTop: 16,
            }}
          >
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "25%", background: t.error100, borderRadius: "6px 0 0 6px" }} />
            <div style={{ position: "absolute", left: "25%", top: 0, bottom: 0, width: "50%", background: t.copperMid }} />
            <div style={{ position: "absolute", left: "75%", top: 0, bottom: 0, right: 0, background: t.success100, borderRadius: "0 6px 6px 0" }} />
            <div style={{ position: "absolute", left: `${p}%`, top: -4, bottom: -4, width: 4, background: t.coal, borderRadius: radius.rail, transform: "translateX(-2px)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: t.inkFaint, fontFamily: f.mono, letterSpacing: 0.4 }}>
            <span>p25</span><span>p50</span><span>p75</span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 15, color: t.coal, lineHeight: 1.55, marginTop: 4 }}>
          {p < 30
            ? "Your offer looks below the typical band for this role and level."
            : p > 70
            ? "Your offer looks above the typical band for this role and level."
            : "Your offer looks around the typical band for this role and level."}{" "}
          <span style={{ color: t.inkSoft }}>
            We'll show exactly where it sits once we have enough cohort data to compare.
          </span>
        </div>
      )}
    </PanelShell>
  );
}

function NPVMathPanel({ outcome }: { outcome: NegotiationOutcome }) {
  const rows = computeNpvRows(outcome);
  if (rows.length === 0) return null;
  return (
    <PanelShell
      index="09"
      title="What this offer is really worth, after tax"
      subtitle="The headline rupee number minus tax and inflation: the actual rupees that hit your bank account."
    >
      {/* Chrome lives on `.nfr-table` (width/border-collapse/font-size)
          and `.nfr-table-total` (cream wash + bold label) so the row
          rhythm matches the rest of the report's tables. The tone color
          on the value cell stays inline since it's per-row data, not
          chrome. */}
      <table className="nfr-table">
        <tbody>
          {rows.map((r, i) => {
            const tone = toneToColor(r.tone);
            const isLast = i === rows.length - 1;
            return (
              <tr key={i} className={isLast ? "nfr-table-total" : undefined}>
                <td>{r.label}</td>
                <td
                  className={isLast ? "nfr-table-total-value" : undefined}
                  style={{
                    textAlign: "right", fontFamily: f.mono,
                    fontWeight: isLast ? 800 : 600, color: tone,
                  }}
                >
                  {r.value}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* Honest footnote — the "true cost" panel is a model, not a quote.
          Users in different tax slabs or with different inflation
          expectations should know the assumptions. */}
      <div style={{ fontSize: 11, color: t.inkFaint, fontStyle: "italic", marginTop: 12, lineHeight: 1.5 }}>
        Assumes the {Math.round(NPV_MODEL.incomeTaxRate * 100)}% Indian income-tax slab + {Math.round(NPV_MODEL.annualInflation * 100)}% annual inflation over a {NPV_MODEL.horizonYears}-year horizon. If your slab or inflation expectations differ, the take-home and today's-rupees rows will shift accordingly.
      </div>
    </PanelShell>
  );
}

function CounterpartyPanel({ outcome }: { outcome: NegotiationOutcome }) {
  if (!outcome.counterpartyFacts || outcome.counterpartyFacts.length === 0) return null;
  return (
    <PanelShell
      index="10"
      title="How this company usually negotiates"
      subtitle="What we've learned about this employer specifically: where they're flexible, where they're not."
      aside={
        outcome.counterpartySource ? (
          <FreshnessChip source={outcome.counterpartySource} asOf="last 30d" />
        ) : undefined
      }
    >
      <div className="nfr-vstack">
        {outcome.counterpartyFacts.map((cf, i) => {
          const tone: "good" | "warn" | "bad" =
            cf.tone === "good" ? "good" : cf.tone === "bad" ? "bad" : "warn";
          return (
            <ToneCard key={i} tone={tone}>
              <div style={{ fontSize: 13, color: t.coal, lineHeight: 1.55 }}>{cf.fact}</div>
            </ToneCard>
          );
        })}
      </div>
    </PanelShell>
  );
}

function ArchetypePanel({ outcome, priorSessionCount }: { outcome: NegotiationOutcome; priorSessionCount?: number }) {
  if (!outcome.archetype) {
    if ((priorSessionCount ?? 0) < 2) {
      return (
        <PanelEmptyState
          index="11"
          title="The pattern across your sessions"
          subtitle="We need at least two negotiation sessions to spot a pattern."
          infoSize="roomy"
        >
          Run one more negotiation session and we'll show you the habit
          you keep repeating, and the single move that breaks the pattern.
        </PanelEmptyState>
      );
    }
    return null;
  }
  const a = outcome.archetype;
  return (
    <PanelShell
      index="11"
      title="The pattern we see across all your sessions"
      subtitle="What you keep getting right, and the one habit that keeps holding you back."
    >
      <div style={{ marginBottom: space.xl }}>
        <span className="nfr-pill nfr-pill-warn">REPEATED PATTERN</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: t.coal, marginBottom: space.lg, letterSpacing: -0.2, fontFamily: f.serif }}>
        {a.title}
      </div>
      <div style={{ fontSize: 13, color: t.inkSoft, lineHeight: 1.6, marginBottom: space.panel }}>{a.body}</div>

      {a.arc && a.arc.length > 0 && (
        <div style={{ marginBottom: space.panel }}>
          <EyebrowLabel marginBottom={space.lg}>{(a.arcMetric ?? "TREND").toUpperCase()} ACROSS SESSIONS</EyebrowLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${a.arc.length}, 1fr)`,
              gap: space.lg, alignItems: "end", height: 110,
            }}
          >
            {a.arc.map((p, i) => {
              const max = Math.max(...a.arc!.map(x => x.score));
              const color = p.score < 35 ? t.error : p.score > 70 ? t.success : t.copper;
              const bg = p.score < 35 ? t.error100 : p.score > 70 ? t.success100 : t.copperSoft;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: space.sm }}>
                  <div style={{ fontSize: 11, fontFamily: f.mono, fontWeight: 700, color }}>
                    {p.score}
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: `${(p.score / max) * 70 + 8}px`,
                      background: bg, border: `1px solid ${color}`,
                      borderRadius: "6px 6px 2px 2px",
                    }}
                  />
                  <div style={{ fontSize: 10, color: t.inkSoft, fontFamily: f.mono, marginTop: 2 }}>
                    {p.label}
                  </div>
                  {p.highlight && (
                    <div style={{ fontSize: 9, color: t.inkFaint, fontStyle: "italic", textAlign: "center", lineHeight: 1.3 }}>
                      {p.highlight}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ padding: space.row, background: t.success100, borderRadius: radius.lg, fontSize: 13, color: t.coal }}>
        <EyebrowLabel color={t.success} marginBottom={space.xs}>THE FIX</EyebrowLabel>
        {a.fix}
      </div>
    </PanelShell>
  );
}

function DrillPlanPanel({ outcome, onLaunchDrill }: { outcome: NegotiationOutcome; onLaunchDrill?: (slug: string) => void }) {
  if (!outcome.drills || outcome.drills.length === 0) return null;
  return (
    <PanelShell
      index="12"
      title="Drills for the next 5 days"
      subtitle="Each drill targets one specific habit you can fix this week."
    >
      <div className="nfr-grid-3up">
        {outcome.drills.map((d, i) => (
          /* Chrome (padding/bg/border/radius) lives on .nfr-info-tile-roomy
           * so it matches the cream-callout shape used elsewhere in the
           * report. The flex-column + gap is the only drill-card-specific
           * layout, kept inline. */
          <div
            key={i}
            className="nfr-info-tile-roomy nfr-info-tile nfr-vstack"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <EyebrowLabel color={t.indigo} marginBottom={0}>DRILL {i + 1}</EyebrowLabel>
              <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: f.mono, letterSpacing: 0.4 }}>
                {d.effort}
              </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.coal, lineHeight: 1.3, fontFamily: f.serif }}>
              {d.title}
            </div>
            <div style={{ fontSize: 12, color: t.inkSoft, lineHeight: 1.5, flex: 1 }}>{d.goal}</div>
            {/* Button hidden unless the parent wired onLaunchDrill +
                the drill itself has a slug. Avoids non-functional CTAs. */}
            {onLaunchDrill && d.slug && (
              <button
                className="nfr-btn-primary"
                style={{ marginTop: 4, width: "100%" }}
                onClick={() => onLaunchDrill(d.slug!)}
              >
                Start drill →
              </button>
            )}
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

/* ─── Phase 1 — In-hand monthly card ────────────────────────────
   Wires computeOldRegimeTaxLpa + computeNewRegimeTaxLpa (run on the
   server in salary-negotiation analyzer v5) into the report so the
   candidate sees what actually hits the bank account for the closing
   offer — under both old and new regimes. Side-by-side because
   regime selection is the single largest ₹/month delta most Indian
   candidates miss. */
/* One side of the two-column take-home stat lockup. Was two identical
 * 18-line inline blocks differing only by label + which `salaryMeta`
 * field flowed in. Local to InHandMonthlyCard — not exported because
 * the shape (label / big mono number with /mo suffix / tax footnote)
 * is specific to this card. */
function RegimeTile({
  label, monthly, taxFootnote,
}: { label: string; monthly: string; taxFootnote: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: t.inkSoft, marginBottom: 4, fontFamily: f.sans }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 22, fontWeight: 700, fontFamily: f.mono,
          color: t.coal, lineHeight: 1.1,
        }}
      >
        {monthly}
        <span style={{ fontSize: 12, fontWeight: 500, color: t.inkSoft, marginLeft: 6 }}>/mo</span>
      </div>
      <div style={{ fontSize: 10, color: t.inkSoft, marginTop: 4, fontFamily: f.mono }}>
        {taxFootnote}
      </div>
    </div>
  );
}

function InHandMonthlyCard({
  salaryMeta,
}: {
  salaryMeta: NonNullable<Props["salaryMeta"]>;
}) {
  const fmtInr = (v: number | null | undefined) =>
    typeof v === "number" && v > 0
      ? `₹${Math.round(v).toLocaleString("en-IN")}`
      : "—";
  const fmtTaxLpa = (v: number | null | undefined) =>
    typeof v === "number" && v >= 0 ? `₹${v.toFixed(1)} LPA tax/yr` : "";
  return (
    <div
      style={{
        margin: "8px 0 4px",
        padding: "14px 16px",
        background: t.creamSoft,
        border: `1px solid ${t.line}`,
        borderRadius: radius.bar,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          color: t.inkSoft,
          marginBottom: 8,
          fontFamily: f.mono,
        }}
      >
        Take-home on closing offer · ₹{salaryMeta.closingTotalLpa?.toFixed(1)} LPA
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <RegimeTile
          label="New regime (FY 2025-26)"
          monthly={fmtInr(salaryMeta.monthlyTakeHomeNewRegimeInr)}
          taxFootnote={fmtTaxLpa(salaryMeta.annualTaxNewRegimeLpa)}
        />
        <RegimeTile
          label="Old regime"
          monthly={fmtInr(salaryMeta.monthlyTakeHomeOldRegimeInr)}
          taxFootnote={fmtTaxLpa(salaryMeta.annualTaxOldRegimeLpa)}
        />
      </div>
      <div
        style={{
          fontSize: 11,
          color: t.inkSoft,
          marginTop: 10,
          fontFamily: f.sans,
          lineHeight: 1.5,
        }}
      >
        Heuristic. Assumes 12% variable, 18% employer benefits loading, 12% employee EPF on 50% basic. HRA / 80C deductions NOT netted (depend on rent / investments). Most candidates &lt; ₹15L taxable do better under new regime; HRA-heavy + 80C-active candidates &gt; ₹20L often beat new regime under old.
      </div>
    </div>
  );
}

/* ─── Top-level component ────────────────────────────────────── */

export function NegotiationFullReport({
  outcome, role, company, questions, daysUntilInterview, priorSessionCount, onLaunchDrill, salaryMeta,
}: Props) {
  const offers = outcome.offers ?? [];
  const finalTotal = outcome.finalTotal ?? offers[offers.length - 1]?.total ?? null;

  return (
    <section
      aria-labelledby="ir-section-negotiation"
      style={{
        background: t.white, border: `1px solid ${t.line}`, borderRadius: radius.shell,
        padding: "28px clamp(16px, 4vw, 32px)", boxShadow: shadows.card,
        scrollMarginTop: 72,
      }}
    >
      <div style={{ marginBottom: space.panel }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <HeaderChip variant="accent">Salary Negotiation · Full Report</HeaderChip>
          {salaryMeta?.tierBucketLabel && (
            <HeaderChip title="Compensation band the analyzer scored you against (Phase 1 of SCORE_IMPROVEMENT_PLAN).">
              Tier · {salaryMeta.tierBucketLabel}
            </HeaderChip>
          )}
          {salaryMeta?.recruiterPersonaLabel && salaryMeta.recruiterPersona !== "default" && (
            <HeaderChip title="Indian recruiter sector archetype the analyzer scored against (Phase 3 of SCORE_IMPROVEMENT_PLAN).">
              {salaryMeta.recruiterPersonaLabel}
            </HeaderChip>
          )}
        </div>
        <h2
          id="ir-section-negotiation"
          style={{ fontFamily: f.serif, fontSize: 26, margin: "10px 0 6px", color: t.coal, letterSpacing: -0.4 }}
        >
          The full breakdown of your negotiation
        </h2>
        <div style={{ fontSize: 13, color: t.inkSoft, marginBottom: space.block, maxWidth: 720 }}>
          Each panel below turns one negotiation skill into something you can act on, not a score.
        </div>
        <StartHereHint outcome={outcome} daysUntilInterview={daysUntilInterview} />
      </div>

      {/* TL;DR — single-glance summary */}
      <TLDRHero outcome={outcome} role={role} company={company} />

      {/* PART 1 — DIAGNOSIS · indigo (analytical / cool tone) */}
      <SectionBand
        label="Part 1 of 4"
        title="What happened in this call"
        subtitle="Every moment that mattered: what you said, what you missed, what it cost."
        accent={t.indigo}
        bg={t.indigo100}
      />

      {/* Offer trajectory pill row — preserved from legacy section */}
      {offers.length > 0 && <OfferTrajectory outcome={outcome} />}

      {/* Phase 1.1 — in-hand monthly under both tax regimes for the
          closing offer. Rendered only when the analyzer extracted a
          closing offer + computed take-home; silent otherwise so
          first-time / no-offer sessions don't show a ₹0 card. */}
      {salaryMeta?.closingTotalLpa != null
        && (salaryMeta.monthlyTakeHomeNewRegimeInr != null
            || salaryMeta.monthlyTakeHomeOldRegimeInr != null)
        && (
        <InHandMonthlyCard salaryMeta={salaryMeta} />
      )}

      <div className="nfr-vstack-xl">
        <PhaseLadderPanel outcome={outcome} />
        <div className="nfr-grid-2up">
          <ConcessionAnalysisPanel outcome={outcome} />
          <AnchorBracketPanel outcome={outcome} />
        </div>
        {(outcome.verbalHabits || outcome.silenceMoments) && (
          <div className="nfr-grid-2up">
            <VerbalHabitsPanel outcome={outcome} />
            <SilenceMapPanel outcome={outcome} />
          </div>
        )}
      </div>

      {/* PART 2 — ACTION */}
      <SectionBand
        anchorId={ANCHOR_PART_2}
        label="Part 2 of 4"
        title="What to do before your real round"
        subtitle="A draft email you can send, the questions to ask next time, and the things to prepare."
        accent={t.copper}
        bg={t.copperTint}
      />
      <div className="nfr-vstack-xl">
        <UnaskedLeversPanel outcome={outcome} />
        <CounterOfferLetterPanel outcome={outcome} role={role} company={company} />
      </div>

      {/* PART 3 — COHORT & MATH · warning gold (money / market value framing).
          Render the band ONLY when at least one child panel will actually
          render — the previous gate let the band appear with nothing
          under it for sessions with finalTotal but delta=0 + no
          percentile + no counterparty facts. */}
      {(() => {
        const willRenderCohort = typeof outcome.percentileWithinBand === "number";
        const willRenderNpv = computeNpvRows(outcome).length > 0;
        const willRenderCounterparty = !!(outcome.counterpartyFacts && outcome.counterpartyFacts.length > 0);
        const showPart3 = willRenderCohort || willRenderNpv || willRenderCounterparty;
        if (!showPart3) return null;
        return (
          <>
            <SectionBand
              anchorId={ANCHOR_PART_3}
              label="Part 3 of 4"
              title="What this offer is worth in rupees"
              subtitle="Where your offer sits vs others, and what accepting really costs after tax."
              accent={t.warning}
              bg={t.warning100}
            />
            <div className="nfr-vstack-xl">
              {willRenderCohort && <CohortPlacementPanel outcome={outcome} />}
              {(willRenderNpv || willRenderCounterparty) && (
                <div className="nfr-grid-2up">
                  {willRenderNpv && <NPVMathPanel outcome={outcome} />}
                  {willRenderCounterparty && <CounterpartyPanel outcome={outcome} />}
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* PART 4 — SKILL ARC · indigoDeep (introspective; distinct from
          Part 1 indigo). Empty state only renders for users with
          ≥1 prior session — first-session users get the band hidden
          entirely, since "run another session to see your pattern" is
          not a useful add for someone who hasn't even completed their
          first one yet. */}
      {(() => {
        const willRenderArchetype = !!outcome.archetype || ((priorSessionCount ?? 0) >= 1 && (priorSessionCount ?? 0) < 2);
        const willRenderDrills = !!(outcome.drills && outcome.drills.length > 0);
        const showPart4 = willRenderArchetype || willRenderDrills;
        if (!showPart4) return null;
        return (
          <>
            <SectionBand
              anchorId={ANCHOR_PART_4}
              label="Part 4 of 4"
              title="Your pattern across sessions"
              subtitle="What you keep doing right (and wrong), and the drills to break the pattern."
              accent={t.indigoDeep}
              bg={t.indigo100}
            />
            <div className="nfr-vstack-xl">
              {willRenderArchetype && <ArchetypePanel outcome={outcome} priorSessionCount={priorSessionCount} />}
              {willRenderDrills && <DrillPlanPanel outcome={outcome} onLaunchDrill={onLaunchDrill} />}
            </div>
          </>
        );
      })()}

      {/* Transcript export — preserved from legacy section */}
      <details style={{ marginTop: 28 }}>
        <summary style={{ cursor: "pointer", fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>
          Conversation transcript: copy for your records
        </summary>
        <pre
          style={{
            marginTop: 10, padding: 14, borderRadius: radius.xl,
            background: t.cream, border: `1px solid ${t.line}`,
            fontFamily: f.mono, fontSize: 11, lineHeight: 1.55,
            whiteSpace: "pre-wrap", wordBreak: "break-word",
            color: t.coal, overflow: "auto", maxWidth: "100%", maxHeight: 360,
          }}
        >
          {(() => {
            const lines: string[] = [
              `Salary negotiation: ${role} at ${company}`,
              `Outcome: ${
                outcome.outcome === "accepted" ? `Accepted at ₹${finalTotal} LPA` :
                outcome.outcome === "walked_away" ? "Walked away" :
                "No agreement"
              }`,
              "",
            ];
            questions.forEach((q, i) => {
              lines.push(`— Turn ${i + 1} —`);
              if (q.text) lines.push(`AI: ${q.text}`);
              const answerText = (q.answer || []).map(s => s.text).join(" ").trim();
              if (answerText) lines.push(`You: ${answerText}`);
              lines.push("");
            });
            return lines.join("\n");
          })()}
        </pre>
      </details>

      {/* Bottom CTA — moved BELOW the transcript so it's the literal
          last element on the page. Previously sat above the transcript
          which made the transcript the actual end-of-report. */}
      <NextRoundCTA outcome={outcome} role={role} company={company} />
    </section>
  );
}

/* ─── Bottom CTA — closes the report with a clear next move ────
   The previous version of the report ended on the transcript
   collapsible. Users finished scrolling and had nowhere to go. This
   panel turns the end of the page into the start of the next move. */
function NextRoundCTA({
  outcome, role, company,
}: { outcome: NegotiationOutcome; role: string; company: string }) {
  let title: string;
  let body: string;
  let primaryLabel: string;
  if (outcome.outcome === "accepted") {
    title = "Take this into your next negotiation";
    body = `You closed the deal on ${role} at ${company}. Run a session for the next role you're targeting, and practise the moves you missed before they cost you on the real one.`;
    primaryLabel = "Practise next round →";
  } else if (outcome.outcome === "walked_away") {
    title = "Run the next round";
    body = "You walked away. The right call needs a clear walk-away point. Practise a session for the same band with a stronger anchor + BATNA prepared.";
    primaryLabel = "Run a stronger session →";
  } else if (outcome.candidateAsk === null) {
    title = "Practise naming a counter";
    body = "You didn't name a counter-anchor in this session. Run the same scenario again, this time walking in with a specific number + bracket prepared.";
    primaryLabel = "Practise the counter →";
  } else {
    title = "Push past where you stalled";
    body = `You named ₹${outcome.candidateAsk} LPA but didn't close. Run another round and practise the lever-exploration phase where this session ended.`;
    primaryLabel = "Practise the next phase →";
  }
  return (
    <div
      style={{
        marginTop: 24, padding: "24px 26px",
        background: t.indigo, color: "#FFFFFF",
        borderRadius: radius.card, display: "flex",
        alignItems: "center", justifyContent: "space-between",
        gap: 20, flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, fontFamily: f.serif, letterSpacing: -0.2 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.78)", lineHeight: 1.5 }}>
          {body}
        </div>
      </div>
      <button
        style={{
          padding: "12px 22px",
          background: "#FFFFFF",
          color: t.indigo,
          border: "none",
          borderRadius: radius.lg,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: f.sans,
          flexShrink: 0,
        }}
      >
        {primaryLabel}
      </button>
    </div>
  );
}

/* ─── Legacy offer trajectory pill row ─────────────────────────
   Preserved from the original NegotiationOutcomeSection — still
   the single most legible visualisation of the call's actual
   movement. Lives at the top of Part 1 to anchor the rest of
   the breakdown. */
/* Big rupee-amount pill — used inside OfferTrajectory for both the
 * recruiter offer chain and the candidate's stated ask. Same shape;
 * the `ask` variant swaps cream→copper-soft to read as the candidate's
 * counter-anchor against the recruiter's offers. */
function AmountPill({
  variant,
  children,
}: { variant: "offer" | "ask"; children: React.ReactNode }) {
  const isAsk = variant === "ask";
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: f.serif, fontSize: 16, fontWeight: 600,
        color: isAsk ? t.copper : t.coal,
        padding: "6px 12px",
        background: isAsk ? t.copperSoft : t.cream,
        border: `1px solid ${isAsk ? t.copperBorder : t.line}`,
        borderRadius: radius.pill,
      }}
    >
      {children}
    </span>
  );
}

function OfferTrajectory({ outcome }: { outcome: NegotiationOutcome }) {
  const offers = outcome.offers ?? [];
  if (offers.length === 0) return null;
  const initial = offers[0].total;
  const final = outcome.finalTotal !== null && outcome.finalTotal > initial
    ? Math.round((outcome.finalTotal - initial) * 10) / 10
    : null;
  /* Single-offer state — explanatory copy instead of a lonely pill that
     looks like an unfinished design. Prevents users from wondering
     whether the report is broken. */
  if (offers.length === 1 && outcome.candidateAsk === null) {
    return (
      <OutlinedCard marginBottom={space.panel}>
        <EyebrowLabel marginBottom={10}>What happened</EyebrowLabel>
        <div style={{ fontSize: 14, color: t.coal, lineHeight: 1.6 }}>
          They opened at <strong style={{ fontFamily: f.serif }}>₹{initial} LPA</strong>. You didn't name a counter, so this became the final number. The conversation never moved past the offer-reaction stage.
        </div>
      </OutlinedCard>
    );
  }
  return (
    <OutlinedCard marginBottom={space.panel}>
      <EyebrowLabel marginBottom={10}>Offer progression</EyebrowLabel>
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {offers.map((o, i) => (
          <li key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <AmountPill variant="offer">₹{o.total} LPA</AmountPill>
            {i < offers.length - 1 && <span aria-hidden style={{ color: t.inkFaint, fontSize: 14 }}>→</span>}
          </li>
        ))}
        {outcome.candidateAsk !== null && (
          <>
            <span aria-hidden style={{ color: t.inkFaint, fontSize: 14, marginLeft: 4 }}>•</span>
            <li style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, textTransform: "uppercase", letterSpacing: 0.6 }}>
                your ask
              </span>
              <AmountPill variant="ask">₹{outcome.candidateAsk} LPA</AmountPill>
            </li>
          </>
        )}
      </ol>
      {final !== null && (
        <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 10 }}>
          You moved the offer up by <strong style={{ color: t.coal }}>₹{final} LPA</strong> from the opening number.
          {typeof outcome.percentileWithinBand === "number" && (
            <> {" "}You closed <strong style={{ color: t.coal }}>{outcome.percentileWithinBand}%</strong> of the gap to your stated ask.</>
          )}
        </div>
      )}
    </OutlinedCard>
  );
}
