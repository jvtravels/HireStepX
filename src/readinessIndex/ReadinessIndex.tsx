"use client";
/* HireStepX — Readiness Index analytics surface (data-connected shell).
   The deep, exploratory analytics layer (not the dashboard summary):
   completeness is the value. Fetches the server-computed ReadinessPayload
   from /api/readiness-index and renders it through the ported sections.
   A pinned RI header + range scrubber + zone nav keep the depth navigable.
   Atoms live in ./ui, section bodies in ./sections, types in ./types. */

import React from "react";
import { tokens as t, fonts as f, shadows } from "../auth/_tokens";
import { useDashboardSubscription, useDashboardUI } from "../DashboardContext";
import { ProGate } from "../dashboardComponents";
import { authHeaders } from "../supabase";
import type { Fixture, RangeKeyLocal as RangeKey, Pillar } from "./types";
import { SHEET, BAND_META } from "./ui";
import {
  HeroRow, BandMix, PillarGrid, PillarEvidence, SessionDiff, CompetenceCoverage,
  BlindSpots, DeliveryPanel, AttentionTimeline, CulturalRegister, AnswerCraft,
  FocusMetrics, PatternsOverTime, RefreshAndFlags, FollowUpPrep, ClosingAndResume,
  Coaching, NegotiationCard, PracticeCadence,
} from "./sections";

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
  const copyLink = () => { try { void navigator.clipboard?.writeText(window.location.href); } catch { /* clipboard unavailable */ } };
  const print = () => { try { window.print(); } catch { /* print unavailable */ } };
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
/* `stickTop` cancels the dashboard <main> scroll container's top padding
   (44px desktop / 20px mobile in DashboardLayout). A sticky child stuck at
   top:0 would pin to main's content edge — below its padding — leaving a
   strip above the header through which scrolling content shows. A negative
   top equal to that padding pins the header flush to the real viewport top.
   Keep these in sync with DashboardLayout's <main> padding. */
function StickyHeader({ d, range, onRange, showControls, stickTop = 0 }: { d: Fixture; range: RangeKey; onRange: (r: RangeKey) => void; showControls: boolean; stickTop?: number }) {
  const band = BAND_META[d.band];
  return (
    <header style={{ position: "sticky", top: stickTop, zIndex: 20, background: t.cream, borderBottom: `1px solid ${t.line}` }}>
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

function Stack({ children, gap = 18 }: { children: React.ReactNode; gap?: number }) {
  return <div style={{ display: "flex", flexDirection: "column", gap }}>{children}</div>;
}

/* Two-up row for the wide desktop layout — pairs adjacent full-width
   sections side by side to cut vertical height. Collapses to a single
   column on narrow (mobile) so nothing is squeezed. Top-aligned, so a
   shorter card simply leaves space below rather than stretching. */
function Row({ narrow, children, gap = 18 }: { narrow: boolean; children: React.ReactNode; gap?: number }) {
  return <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap, alignItems: "start" }}>{children}</div>;
}

/* A soft, non-blocking note that some figures are modelled estimates while
   the session count is still low. Honest about what is measured vs inferred. */
function SparseNote({ sessions }: { sessions: number }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 15px", background: t.warning100, border: `1px solid ${t.line}`, borderRadius: 12, fontFamily: f.sans }}>
      <span aria-hidden="true" style={{ color: t.warning, fontWeight: 700 }}>!</span>
      <span style={{ fontSize: 12.5, color: t.coal, lineHeight: 1.5 }}>
        Early read. With {sessions} {sessions === 1 ? "session" : "sessions"} logged, some figures (percentiles, consistency) are modelled estimates. They sharpen as you complete more sessions.
      </span>
    </div>
  );
}

/* The full analytics body — every zone, in reading order. Shared by the
   desktop and mobile variants; `narrow` reflows it. */
function AnalyticsBody({ d, narrow, range, activePillar, onPillar }: {
  d: Fixture; narrow: boolean; range: RangeKey; activePillar: Pillar["key"] | null; onPillar: (k: Pillar["key"]) => void;
}) {
  const active = activePillar ? d.pillars.find((p) => p.key === activePillar) ?? null : null;
  return (
    <Stack>
      {d.meta.sparse && <SparseNote sessions={d.sessions} />}
      <HeroRow d={d} narrow={narrow} range={range} />
      <BandMix d={d} />
      <PillarGrid d={d} narrow={narrow} activeKey={activePillar} onOpen={onPillar} range={range} />
      {active && <PillarEvidence p={active} />}
      <SessionDiff d={d} narrow={narrow} />
      <CompetenceCoverage d={d} narrow={narrow} />
      <BlindSpots d={d} />
      <DeliveryPanel d={d} narrow={narrow} />
      {d.cultural.length ? (
        <Row narrow={narrow}>
          <AttentionTimeline d={d} />
          <CulturalRegister d={d} />
        </Row>
      ) : (
        <AttentionTimeline d={d} />
      )}
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
  const onPillar = (k: Pillar["key"]) => setActivePillar((cur) => (cur === k ? null : k));
  return (
    <div style={{ minHeight: "100%", background: t.cream, color: t.coal }}>
      <style dangerouslySetInnerHTML={{ __html: SHEET }} />
      <StickyHeader d={d} range={range} onRange={setRange} showControls stickTop={-44} />
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "22px 28px 64px" }}>
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
      <StickyHeader d={d} range={range} onRange={setRange} showControls={false} stickTop={-20} />
      <div style={{ padding: "14px 14px 48px" }}>
        <div style={{ marginBottom: 16 }}><SegControl range={range} onChange={setRange} /></div>
        <AnalyticsBody d={d} narrow range={range} activePillar={activePillar} onPillar={onPillar} />
      </div>
    </div>
  );
}

/* ── Non-content states ────────────────────────────────────────── */

function CenterPane({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: 480, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 22px", background: t.cream }}>
      <div style={{ maxWidth: 460, textAlign: "center" }}>{children}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ minHeight: "100%", background: t.cream }}>
      <style dangerouslySetInnerHTML={{ __html: SHEET }} />
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "22px 22px 64px", display: "flex", flexDirection: "column", gap: 16 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rix-skel" aria-hidden="true"
            style={{ height: i === 0 ? 220 : 150, borderRadius: 16, background: t.creamSoft, border: `1px solid ${t.line}` }} />
        ))}
        <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Loading your Readiness Index</span>
      </div>
    </div>
  );
}

function EmptyAnalytics() {
  return (
    <CenterPane>
      <h2 style={{ fontFamily: f.serif, fontSize: 26, color: t.coal, margin: 0 }}>Your Readiness Index is waiting</h2>
      <p style={{ fontFamily: f.sans, fontSize: 14.5, color: t.inkSoft, lineHeight: 1.6, margin: "12px 0 22px" }}>
        Complete your first evaluated mock interview and this page fills with your target-specific readiness score, five pillars, blind spots, and a refresh queue.
      </p>
      <a href="/interview" className="rix-focus"
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 999, background: t.indigo, color: t.white, fontFamily: f.sans, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
        Start a mock interview <span aria-hidden="true">→</span>
      </a>
    </CenterPane>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <CenterPane>
      <h2 style={{ fontFamily: f.serif, fontSize: 24, color: t.coal, margin: 0 }}>Could not load your analytics</h2>
      <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, lineHeight: 1.6, margin: "12px 0 22px" }}>
        Something went wrong fetching your Readiness Index. This is usually transient. Try again in a moment.
      </p>
      <button type="button" onClick={onRetry} className="rix-btn rix-focus rix-tap"
        style={{ padding: "10px 20px", borderRadius: 999, border: "none", background: t.indigo, color: t.white, fontFamily: f.sans, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
        Retry
      </button>
    </CenterPane>
  );
}

/* ── Data fetch ────────────────────────────────────────────────── */

type FetchState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "empty" }
  | { status: "ready"; payload: Fixture };

function useReadinessPayload(): { state: FetchState; reload: () => void } {
  const [state, setState] = React.useState<FetchState>({ status: "loading" });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setState({ status: "loading" });
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch("/api/readiness-index", { method: "GET", headers, signal: ctrl.signal });
        if (!alive) return;
        if (!res.ok) { setState({ status: "error" }); return; }
        const json: unknown = await res.json().catch(() => null);
        if (!alive) return;
        const payload = json && typeof json === "object" && "payload" in json
          ? (json as { payload: Fixture | null }).payload
          : null;
        if (!payload) { setState({ status: "empty" }); return; }
        setState({ status: "ready", payload });
      } catch (err) {
        if (!alive || (err instanceof DOMException && err.name === "AbortError")) return;
        console.error(`[readiness-index] fetch failed: ${err instanceof Error ? err.message : String(err)}`);
        setState({ status: "error" });
      }
    })();
    return () => { alive = false; ctrl.abort(); };
  }, [nonce]);

  return { state, reload: () => setNonce((n) => n + 1) };
}

/* ── Public surface ────────────────────────────────────────────── */

export function ReadinessIndex() {
  const { isFree } = useDashboardSubscription();
  const { setShowUpgradeModal, isMobile } = useDashboardUI();
  const { state, reload } = useReadinessPayload();

  if (isFree) return <ProGate feature="The Readiness Index" onUpgrade={() => setShowUpgradeModal(true)} />;
  if (state.status === "loading") return <LoadingState />;
  if (state.status === "error") return <ErrorState onRetry={reload} />;
  if (state.status === "empty") return <EmptyAnalytics />;
  return isMobile ? <MobileShell d={state.payload} /> : <DesktopShell d={state.payload} />;
}

export default ReadinessIndex;
