/* HireStepX — Readiness Index analytics surface (router + shell).
   This is the deep, exploratory reference layer (NOT the dashboard):
   completeness is the value. The shell adds a pinned RI + range scrubber
   + zone navigation so the depth stays navigable. Section bodies live in
   _sections; atoms in _ui; fixtures and types in _data. */

import React from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
import { READY, BUILDING, type Fixture, type Variant, type RangeKey, type Pillar } from "./_data";
import { SHEET, BAND_META } from "./_ui";
import {
  HeroRow, BandMix, PillarGrid, PillarEvidence, SessionDiff, CompetenceCoverage,
  BlindSpots, DeliveryPanel, AttentionTimeline, CulturalRegister, AnswerCraft,
  FocusMetrics, PatternsOverTime, RefreshAndFlags, FollowUpPrep, ClosingAndResume,
  Coaching, NegotiationCard, PracticeCadence,
} from "./_sections";

const NAV: { id: string; label: string }[] = [
  { id: "zone-readiness", label: "Readiness" },
  { id: "zone-pillars", label: "Pillars" },
  { id: "zone-competence", label: "Competence" },
  { id: "zone-delivery", label: "Delivery" },
  { id: "zone-craft", label: "Answer craft" },
  { id: "zone-signature", label: "Signature" },
  { id: "zone-patterns", label: "Patterns" },
  { id: "zone-closing", label: "Closing" },
  { id: "zone-negotiation", label: "Negotiation" },
  { id: "zone-practice", label: "Practice" },
];

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "4w", label: "4 wks" },
  { key: "12w", label: "12 wks" },
  { key: "all", label: "All time" },
];

function SegControl({ range, onChange }: { range: RangeKey; onChange: (r: RangeKey) => void }) {
  return (
    <div role="group" aria-label="History range" style={{ display: "inline-flex", padding: 3, gap: 2, background: t.creamSoft, borderRadius: 999, border: `1px solid ${t.line}` }}>
      {RANGES.map((r) => {
        const on = r.key === range;
        return (
          <button key={r.key} type="button" onClick={() => onChange(r.key)} aria-pressed={on} className="rix-btn rix-seg rix-focus rix-tap"
            style={{ padding: "5px 12px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: f.sans, fontSize: 12, fontWeight: 600,
              background: on ? t.white : "transparent", color: on ? t.coal : t.inkSoft, boxShadow: on ? shadows.card : "none" }}>
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function ExportButtons() {
  const copyLink = () => { try { void navigator.clipboard?.writeText(window.location.href); } catch { /* canvas sandbox */ } };
  const print = () => { try { window.print(); } catch { /* canvas sandbox */ } };
  return (
    <div style={{ display: "inline-flex", gap: 8 }}>
      <button type="button" onClick={print} className="rix-btn rix-ghost rix-focus rix-tap"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9, border: `1px solid ${t.line}`, background: t.white, color: t.coal, fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
        <span aria-hidden="true">↓</span> Download PDF
      </button>
      <button type="button" onClick={copyLink} className="rix-btn rix-ghost rix-focus rix-tap"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9, border: `1px solid ${t.line}`, background: t.white, color: t.coal, fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
        <span aria-hidden="true">⎘</span> Copy link
      </button>
    </div>
  );
}

/* Pinned header — RI summary that stays put as the page scrolls, plus the
   range scrubber and export controls. The "always know your number" anchor. */
function StickyHeader({ d, range, onRange, showControls }: { d: Fixture; range: RangeKey; onRange: (r: RangeKey) => void; showControls: boolean }) {
  const band = BAND_META[d.band];
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(250,247,240,0.86)", backdropFilter: "saturate(140%) blur(8px)", WebkitBackdropFilter: "saturate(140%) blur(8px)", borderBottom: `1px solid ${t.line}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "12px 22px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 7 }}>
            <span style={{ fontFamily: f.serif, fontSize: 30, lineHeight: 1, color: t.coal }}>{d.ri}</span>
            <span style={{ fontFamily: f.mono, fontSize: 10, color: t.inkSoft }}>RI</span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 11px", borderRadius: 999, background: band.bg, color: band.fg, fontFamily: f.sans, fontSize: 12, fontWeight: 600 }}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: band.fg }} />{band.label}
          </span>
          <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft }}>
            {d.target.role} · {d.target.company} · bar <strong style={{ color: t.coal }}>{d.threshold}</strong>
          </span>
        </div>
        {showControls && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <SegControl range={range} onChange={onRange} />
            <ExportButtons />
          </div>
        )}
      </div>
    </header>
  );
}

function NavRail({ active }: { active: string }) {
  return (
    <nav aria-label="Analytics sections" style={{ position: "sticky", top: 76, alignSelf: "start", display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontFamily: f.mono, fontSize: 10, color: t.inkFaint, letterSpacing: 0.6, textTransform: "uppercase", padding: "0 0 8px 12px" }}>On this page</span>
      {NAV.map((n) => {
        const on = n.id === active;
        return (
          <a key={n.id} href={`#${n.id}`} className="rix-nav-link rix-focus"
            style={{ display: "block", padding: "6px 12px", borderLeft: `2px solid ${on ? t.indigo : t.line}`, fontFamily: f.sans, fontSize: 13, fontWeight: on ? 600 : 400, color: on ? t.coal : t.inkSoft, textDecoration: "none" }}>
            {n.label}
          </a>
        );
      })}
    </nav>
  );
}

/* Tracks which zone is in view, to light the matching nav entry. */
function useActiveZone(enabled: boolean): string {
  const [active, setActive] = React.useState(NAV[0].id);
  React.useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px", threshold: 0 },
    );
    NAV.forEach((n) => { const el = document.getElementById(n.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [enabled]);
  return active;
}

function Stack({ children, gap = 18 }: { children: React.ReactNode; gap?: number }) {
  return <div style={{ display: "flex", flexDirection: "column", gap }}>{children}</div>;
}

/* The full analytics body — every zone, in reading order. Shared by the
   desktop (ready/building) and mobile variants; `narrow` reflows it. */
function AnalyticsBody({ d, narrow, range, activePillar, onPillar }: {
  d: Fixture; narrow: boolean; range: RangeKey; activePillar: Pillar["key"] | null; onPillar: (k: Pillar["key"]) => void;
}) {
  const active = activePillar ? d.pillars.find((p) => p.key === activePillar) ?? null : null;
  return (
    <Stack>
      <HeroRow d={d} narrow={narrow} range={range} />
      <BandMix d={d} />
      <PillarGrid d={d} narrow={narrow} activeKey={activePillar} onOpen={onPillar} range={range} />
      {active && <PillarEvidence p={active} />}
      <SessionDiff d={d} narrow={narrow} />
      <CompetenceCoverage d={d} narrow={narrow} />
      <BlindSpots d={d} />
      <DeliveryPanel d={d} narrow={narrow} />
      <AttentionTimeline d={d} />
      <CulturalRegister d={d} />
      <AnswerCraft d={d} narrow={narrow} />
      <FocusMetrics d={d} narrow={narrow} />
      <PatternsOverTime d={d} narrow={narrow} />
      <RefreshAndFlags d={d} narrow={narrow} />
      <FollowUpPrep d={d} />
      <ClosingAndResume d={d} narrow={narrow} />
      <Coaching d={d} narrow={narrow} />
      <NegotiationCard d={d} narrow={narrow} />
      <PracticeCadence d={d} narrow={narrow} />
    </Stack>
  );
}

function DesktopShell({ d }: { d: Fixture }) {
  const [range, setRange] = React.useState<RangeKey>("12w");
  const [activePillar, setActivePillar] = React.useState<Pillar["key"] | null>(null);
  const activeZone = useActiveZone(true);
  const onPillar = (k: Pillar["key"]) => setActivePillar((cur) => (cur === k ? null : k));
  return (
    <div style={{ minHeight: "100%", background: t.cream, color: t.coal }}>
      <style dangerouslySetInnerHTML={{ __html: SHEET }} />
      <StickyHeader d={d} range={range} onRange={setRange} showControls />
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "22px 22px 64px", display: "grid", gridTemplateColumns: "168px 1fr", gap: 28, alignItems: "start" }}>
        <NavRail active={activeZone} />
        <AnalyticsBody d={d} narrow={false} range={range} activePillar={activePillar} onPillar={onPillar} />
      </div>
    </div>
  );
}

function MobileShell({ d }: { d: Fixture }) {
  const [range, setRange] = React.useState<RangeKey>("12w");
  const [activePillar, setActivePillar] = React.useState<Pillar["key"] | null>(null);
  const onPillar = (k: Pillar["key"]) => setActivePillar((cur) => (cur === k ? null : k));
  return (
    <div style={{ minHeight: "100%", background: t.cream, color: t.coal }}>
      <style dangerouslySetInnerHTML={{ __html: SHEET }} />
      <StickyHeader d={d} range={range} onRange={setRange} showControls={false} />
      <div style={{ padding: "14px 14px 48px" }}>
        <div style={{ marginBottom: 16 }}><SegControl range={range} onChange={setRange} /></div>
        <AnalyticsBody d={d} narrow range={range} activePillar={activePillar} onPillar={onPillar} />
      </div>
    </div>
  );
}

/* Drill-down variant — entering the surface focused on one pillar
   (Composure here). Demonstrates the generalized PillarEvidence that any
   pillar can open, with its delivery context alongside. */
function DrilldownShell({ d }: { d: Fixture }) {
  const composure = d.pillars.find((p) => p.key === "composure") ?? d.pillars[0];
  return (
    <div style={{ minHeight: "100%", background: t.cream, color: t.coal }}>
      <style dangerouslySetInnerHTML={{ __html: SHEET }} />
      <StickyHeader d={d} range="all" onRange={() => {}} showControls={false} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "22px 22px 56px" }}>
        <a href="#zone-pillars" className="rix-nav-link rix-focus" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: 13, color: t.indigo, textDecoration: "none", marginBottom: 16 }}>
          <span aria-hidden="true">←</span> All five pillars
        </a>
        <Stack>
          <PillarEvidence p={composure} />
          <DeliveryPanel d={d} narrow={false} />
          <AttentionTimeline d={d} />
        </Stack>
      </div>
    </div>
  );
}

export function ReadinessIndex({ variant = "ready" }: { variant?: Variant }) {
  const d = variant === "building" ? BUILDING : READY;
  if (variant === "mobile") return <MobileShell d={d} />;
  if (variant === "drilldown") return <DrilldownShell d={d} />;
  return <DesktopShell d={d} />;
}

export default ReadinessIndex;
