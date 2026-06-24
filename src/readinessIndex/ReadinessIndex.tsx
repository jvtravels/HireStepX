"use client";
/* HireStepX — Readiness Index analytics surface (data-connected shell).
   The deep, exploratory analytics layer (not the dashboard summary):
   completeness is the value. Fetches the server-computed ReadinessPayload
   from /api/readiness-index and renders it through the ported sections.
   A pinned RI header + range scrubber + zone nav keep the depth navigable.
   Atoms live in ./ui, section bodies in ./sections, types in ./types. */

import React from "react";
import { useRouter } from "next/navigation";
import { tokens as t, fonts as f, shadows } from "../auth/_tokens";
import { useDashboardSubscription, useDashboardUI } from "../DashboardContext";
import { ProGate } from "../dashboardComponents";
import { authHeaders } from "../supabase";
import { captureClientEvent } from "../posthogClient";
import type { Fixture, RangeKeyLocal as RangeKey, Pillar } from "./types";
import { SHEET, BAND_META } from "./ui";
import {
  HeroRow, BandMix, PillarGrid, PillarEvidence, SessionDiff, CompetenceCoverage,
  BlindSpots, DeliveryPanel, AttentionTimeline, CulturalRegister, AnswerCraft,
  FocusMetrics, PatternsOverTime, RefreshAndFlags, FollowUpPrep, ClosingAndResume,
  Coaching, NegotiationCard, PracticeCadence,
} from "./sections";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "1m", label: "1 month" },
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

/* In-page navigation for the long exploratory surface. Each entry targets a
   zone anchor rendered by the sections (id="zone-…"); the active one is lit by
   useActiveZone. Restored because the surface is ~18 stacked sections — without
   a jump rail the only way to reach Negotiation or Practice is a full scroll. */
const NAV: { id: string; label: string }[] = [
  { id: "zone-readiness", label: "Readiness" },
  { id: "zone-pillars", label: "Pillars" },
  { id: "zone-actions", label: "What to practice" },
  { id: "zone-competence", label: "Competence" },
  { id: "zone-delivery", label: "Delivery" },
  { id: "zone-craft", label: "Answer craft" },
  { id: "zone-signature", label: "By round type" },
  { id: "zone-patterns", label: "Patterns" },
  { id: "zone-closing", label: "Closing" },
  { id: "zone-negotiation", label: "Negotiation" },
  { id: "zone-practice", label: "Practice" },
];

function NavRail({ active }: { active: string }) {
  return (
    <nav aria-label="Analytics sections" style={{ position: "sticky", top: 76, alignSelf: "start", display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontFamily: f.mono, fontSize: 10, color: t.inkFaint, letterSpacing: 0.6, textTransform: "uppercase", padding: "0 0 8px 12px" }}>On this page</span>
      {NAV.map((n) => {
        const on = n.id === active;
        return (
          /* Matches the sidebar nav pattern used in the interview result screen:
             coal dot + weight shift on active, no fill, no border-left accent.
             Border-left / background-chip variants are reserved for filter pills. */
          <a key={n.id} href={`#${n.id}`} className="rix-nav-link rix-focus"
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", textDecoration: "none", background: "transparent", borderRadius: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: on ? t.coal : "transparent", flexShrink: 0, display: "inline-block" }} />
            <span style={{ fontFamily: f.sans, fontSize: 13, fontWeight: on ? 700 : 500, color: on ? t.coal : t.inkSoft }}>{n.label}</span>
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

/* Pinned header — RI summary that stays put as the page scrolls, plus the
   range scrubber. The "always know your number" anchor. */
/* `stickTop` cancels the dashboard <main> scroll container's top padding
   (44px desktop / 20px mobile in DashboardLayout). A sticky child stuck at
   top:0 would pin to main's content edge — below its padding — leaving a
   strip above the header through which scrolling content shows. A negative
   top equal to that padding pins the header flush to the real viewport top.
   Keep these in sync with DashboardLayout's <main> padding. */
function StickyHeader({ d, range, onRange, showControls, stickTop = 0 }: { d: Fixture; range: RangeKey; onRange: (r: RangeKey) => void; showControls: boolean; stickTop?: number }) {
  const band = BAND_META[d.band];
  return (
    <header style={{ position: "sticky", top: stickTop, zIndex: 10, background: t.cream, borderBottom: `1px solid ${t.line}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "20px 22px 16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 7 }}>
            <span style={{ fontFamily: f.serif, fontSize: 30, lineHeight: 1, color: t.coal }}>{d.ri}</span>
            <span style={{ fontFamily: f.mono, fontSize: 10, color: t.inkSoft }}>RI</span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 11px", borderRadius: 999, background: band.bg, color: band.fg, fontFamily: f.sans, fontSize: 12, fontWeight: 600 }}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: band.fg }} />{band.label}
          </span>
          <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft }}>
            {d.target.role}{d.target.hasCompany ? ` · ${d.target.company}` : ""} · bar <strong style={{ color: t.coal }}>{d.threshold}</strong>
            {d.ri < d.threshold && <> · <span style={{ color: t.copper, fontWeight: 600 }}>need {d.threshold - d.ri} more</span></>}
          </span>
        </div>
        {showControls && <SegControl range={range} onChange={onRange} />}
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
  // minmax(0, 1fr) rather than bare 1fr: a 1fr track is implicitly
  // minmax(auto, 1fr), so a child with a wide min-content (a long skill row,
  // an unbreakable label) blows the track past the container and clips on the
  // right edge at phone widths. minmax(0, …) lets the track shrink and the
  // child wrap instead.
  return <div style={{ display: "grid", gridTemplateColumns: narrow ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)", gap, alignItems: "start" }}>{children}</div>;
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
      {/* 1. Am I ready? */}
      <HeroRow d={d} narrow={narrow} range={range} />
      {/* 2. Why this score? — pillars before verdict mix so the "why" comes before the "what" */}
      <PillarGrid d={d} narrow={narrow} activeKey={activePillar} onOpen={onPillar} range={range} />
      {active && <PillarEvidence p={active} />}
      {/* 3. What do I do today? — highest-ROI actions surfaced immediately after the score */}
      <BlindSpots d={d} />
      <RefreshAndFlags d={d} narrow={narrow} />
      {/* 4. What will they ask me? — most valuable section for a candidate days before their interview */}
      <FollowUpPrep d={d} />
      {/* 5. How are my sessions being scored? */}
      <BandMix d={d} />
      <SessionDiff d={d} narrow={narrow} />
      {/* 6. Detailed competence breakdown */}
      <CompetenceCoverage d={d} narrow={narrow} />
      {/* 7. Delivery and communication style */}
      <DeliveryPanel d={d} narrow={narrow} />
      {d.cultural.length ? (
        <Row narrow={narrow}>
          <AttentionTimeline d={d} />
          <CulturalRegister d={d} />
        </Row>
      ) : (
        <AttentionTimeline d={d} />
      )}
      {/* 8. Answer quality and substance signals */}
      <AnswerCraft d={d} narrow={narrow} />
      <FocusMetrics d={d} narrow={narrow} />
      {/* 9. Trends */}
      <PatternsOverTime d={d} narrow={narrow} />
      {/* 10. Closing + coaching + negotiation */}
      <ClosingAndResume d={d} narrow={narrow} />
      <Coaching d={d} narrow={narrow} />
      <NegotiationCard d={d} narrow={narrow} />
      {/* 11. Practice history */}
      <PracticeCadence d={d} narrow={narrow} />
    </Stack>
  );
}

function DesktopShell({ d }: { d: Fixture }) {
  const [range, setRange] = React.useState<RangeKey>("1m");
  const [activePillar, setActivePillar] = React.useState<Pillar["key"] | null>(null);
  const activeZone = useActiveZone(true);
  const onPillar = (k: Pillar["key"]) => setActivePillar((cur) => (cur === k ? null : k));
  return (
    <div style={{ minHeight: "100%", background: t.cream, color: t.coal }}>
      <style dangerouslySetInnerHTML={{ __html: SHEET }} />
      <StickyHeader d={d} range={range} onRange={setRange} showControls stickTop={-44} />
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "22px 28px 64px", display: "grid", gridTemplateColumns: "168px minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
        <NavRail active={activeZone} />
        <AnalyticsBody d={d} narrow={false} range={range} activePillar={activePillar} onPillar={onPillar} />
      </div>
    </div>
  );
}

function MobileShell({ d }: { d: Fixture }) {
  const [range, setRange] = React.useState<RangeKey>("1m");
  const [activePillar, setActivePillar] = React.useState<Pillar["key"] | null>(null);
  const onPillar = (k: Pillar["key"]) => setActivePillar((cur) => (cur === k ? null : k));
  return (
    <div style={{ minHeight: "100%", background: t.cream, color: t.coal }}>
      <style dangerouslySetInnerHTML={{ __html: SHEET }} />
      <StickyHeader d={d} range={range} onRange={setRange} showControls={false} stickTop={-20} />
      <div style={{ padding: "14px 0 48px" }}>
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
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "22px 28px 64px", display: "flex", flexDirection: "column", gap: 16 }}>
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
  const router = useRouter();
  return (
    <CenterPane>
      <h2 style={{ fontFamily: f.serif, fontSize: 28, color: t.coal, margin: 0 }}>Your Readiness Index is waiting</h2>
      <p style={{ fontFamily: f.sans, fontSize: 14.5, color: t.inkSoft, lineHeight: 1.6, margin: "12px 0 22px" }}>
        Complete your first evaluated mock interview and this page fills with your target-specific readiness score, five pillars, blind spots, and a refresh queue.
      </p>
      <button type="button" onClick={() => router.push("/session/new")} className="rix-btn rix-focus rix-tap"
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 999, border: "none", cursor: "pointer", background: t.indigo, color: t.white, fontFamily: f.sans, fontSize: 14, fontWeight: 600 }}>
        Start a mock interview <span aria-hidden="true">→</span>
      </button>
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
        if (!res.ok) { captureClientEvent("ri_fetch_error", { status: res.status }); setState({ status: "error" }); return; }
        const json: unknown = await res.json().catch(() => null);
        if (!alive) return;
        const payload = json && typeof json === "object" && "payload" in json
          ? (json as { payload: Fixture | null }).payload
          : null;
        if (!payload) { captureClientEvent("analytics_empty"); setState({ status: "empty" }); return; }
        captureClientEvent("analytics_viewed", { sessions: payload.sessions, sparse: payload.meta?.sparse ?? false, ri: payload.ri });
        /* North-Star retention input: exposure of the skill-decay refresh
           queue. Measuring 7-day return for users who saw a non-empty queue
           vs. those who didn't is how we validate the spaced-repetition loop.
           Fires once per successful load, only when the queue has entries. */
        if (payload.refresh && payload.refresh.length > 0) {
          captureClientEvent("readiness:refresh_queue_shown", {
            idle_skill_count: payload.refresh.length,
            top_idle_days: Math.max(...payload.refresh.map((r) => r.days)),
          });
        }
        setState({ status: "ready", payload });
      } catch (err) {
        if (!alive || (err instanceof DOMException && err.name === "AbortError")) return;
        console.error(`[readiness-index] fetch failed: ${err instanceof Error ? err.message : String(err)}`);
        captureClientEvent("ri_fetch_error", { reason: err instanceof Error ? err.message : String(err) });
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

  React.useEffect(() => { if (isFree) captureClientEvent("analytics_progate"); }, [isFree]);

  if (isFree) return <ProGate feature="The Readiness Index" onUpgrade={() => setShowUpgradeModal(true)} />;
  if (state.status === "loading") return <LoadingState />;
  if (state.status === "error") return <ErrorState onRetry={reload} />;
  if (state.status === "empty") return <EmptyAnalytics />;
  return isMobile ? <MobileShell d={state.payload} /> : <DesktopShell d={state.payload} />;
}

export default ReadinessIndex;
