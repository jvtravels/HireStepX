"use client";
/* HireStepX — Readiness Index analytics / zone sections.
   Pure-view section components. State for local disclosure (evidence
   quotes, session-diff selectors) lives here via useState; cross-cutting
   state (range, active pillar) is owned by ReadinessIndex and passed in.
   Ported from the design canvas; retokened to src/auth/_tokens and made
   null/empty-safe against the real (sometimes sparse) payload. */

import React from "react";
import { useRouter } from "next/navigation";
import { tokens as t, fonts as f, shadows } from "../auth/_tokens";
import type { Fixture, Pillar, CrossInsight, TypedFlag, RangeKeyLocal as RangeKey, Attention } from "./types";
import { rangeSlice, RANGE_LABEL } from "./types";
import {
  Card, Eyebrow, Title, DeltaTag, MetricStat, StackBar,
  RiGauge, Trajectory, Spark, SkillBar, StarChips, EvidenceQuote,
  scoreColor, TONE_FG, HIRE_META, BAND_META, COPPER_LINE, SUCCESS_LINE,
} from "./ui";

/* ── shared small bits ─────────────────────────────────────────── */

export function EmptyState({ title, need }: { title: string; need: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 16px", border: `1px dashed ${t.lineStrong}`, borderRadius: 12, background: t.cream }}>
      <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 8, background: t.creamSoft, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: f.mono, fontSize: 13, color: t.inkSoft, flexShrink: 0 }}>+</span>
      <div>
        <div style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: 600, color: t.coal }}>{title}</div>
        <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, marginTop: 1 }}>{need}</div>
      </div>
    </div>
  );
}

function DisclosureBtn({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={open} className="rix-btn rix-focus rix-tap"
      style={{ padding: "4px 2px", background: "none", border: "none", cursor: "pointer", fontFamily: f.sans, fontSize: 12, fontWeight: 600, color: t.indigo }}>
      {open ? "Hide evidence" : label} <span aria-hidden="true">{open ? "▲" : "→"}</span>
    </button>
  );
}

/* ── Zone 1 — Readiness hero + compare frames ──────────────────── */

export function HeroRow({ d, narrow, range }: { d: Fixture; narrow: boolean; range: RangeKey }) {
  const band = BAND_META[d.band];
  const traj = rangeSlice(d.trajectory, range);
  const vsCohort = d.ri - d.cohort.ri;
  const vsBaseline = d.ri - d.baseline.ri;
  return (
    <Card as="section" pad={narrow ? 18 : 26} id="zone-readiness">
      <h1 style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 }}>
        Readiness Index for {d.target.role} at {d.target.company}, {d.target.round}
      </h1>
      <div style={{ display: "flex", flexDirection: narrow ? "column" : "row", gap: narrow ? 18 : 30, alignItems: narrow ? "stretch" : "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <RiGauge ri={d.ri} threshold={d.threshold} band={d.band} cohort={d.cohort.ri} size={narrow ? 190 : 220} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <Eyebrow>Readiness Index · target-specific</Eyebrow>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              <Title as="h2" size={narrow ? 26 : 30}>{d.target.role} · {d.target.company}</Title>
              <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, background: t.creamSoft, padding: "3px 10px", borderRadius: 999 }}>{d.target.round}</span>
            </div>
            <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 6 }}>
              Interview {d.target.date}. Calibrated to {d.target.company}'s bar. Showing {RANGE_LABEL[range]}.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 999, background: band.bg, color: band.fg, fontFamily: f.sans, fontSize: 13, fontWeight: 600 }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: band.fg }} />{band.label}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, background: t.creamSoft, fontFamily: f.sans, fontSize: 13, color: t.coal }}>
              <DeltaTag value={d.delta14d} /> <span style={{ color: t.inkSoft }}>last 14 days</span>
            </span>
            <span style={{ padding: "7px 14px", borderRadius: 999, background: t.indigo100, fontFamily: f.sans, fontSize: 13, color: t.indigoDeep, fontWeight: 600 }}>
              {vsCohort >= 0 ? "+" : ""}{vsCohort} vs the {d.cohort.label}
            </span>
            <span style={{ padding: "7px 14px", borderRadius: 999, background: t.creamSoft, fontFamily: f.sans, fontSize: 13, color: t.coal }}>
              {Math.round(d.confidence * 100)}% confidence
            </span>
          </div>

          {/* Comparison frames — cohort + own baseline give the number a reference */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180, padding: "10px 14px", background: t.creamSoft, borderRadius: 10 }}>
              <div style={{ fontFamily: f.mono, fontSize: 10, color: t.inkSoft, letterSpacing: 0.5, textTransform: "uppercase" }}>vs the {d.cohort.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <span style={{ fontFamily: f.serif, fontSize: 22, color: vsCohort >= 0 ? t.success : t.copper }}>{vsCohort >= 0 ? "+" : ""}{vsCohort}</span>
                <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>RI (bar at {d.cohort.ri})</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 180, padding: "10px 14px", background: t.creamSoft, borderRadius: 10 }}>
              <div style={{ fontFamily: f.mono, fontSize: 10, color: t.inkSoft, letterSpacing: 0.5, textTransform: "uppercase" }}>vs your baseline</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <span style={{ fontFamily: f.serif, fontSize: 22, color: t.success }}>{vsBaseline >= 0 ? "+" : ""}{vsBaseline}</span>
                <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>since {d.baseline.label}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", borderTop: `1px solid ${t.line}`, paddingTop: 14 }}>
            <div style={{ flex: narrow ? "1 1 100%" : "0 0 auto" }}>
              <div style={{ fontFamily: f.mono, fontSize: 10, color: t.inkSoft, letterSpacing: 0.5, textTransform: "uppercase" }}>Trajectory + projection</div>
              <div style={{ marginTop: 8 }}>
                <Trajectory points={traj} projTarget={d.projection.targetRi} threshold={d.threshold} width={narrow ? 240 : 200} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <p style={{ margin: 0, fontFamily: f.sans, fontSize: 14, color: t.coal, lineHeight: 1.5 }}>
                {d.band === "ready" ? (
                  <>You're <strong style={{ color: t.success }}>above {d.target.company}'s bar</strong> with margin to spare. About{" "}
                    <strong>{d.projection.sessions} more sessions</strong> lifts you to RI {d.projection.targetRi} and a comfortable margin.</>
                ) : (
                  <>About <strong>{d.projection.sessions} focused sessions</strong> (~{d.projection.hours} hrs) puts you over{" "}
                    {d.target.company}'s bar of <strong>{d.threshold}</strong>. The pillars below show where the points are.</>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* Real hiring-band distribution across sessions. */
export function BandMix({ d }: { d: Fixture }) {
  const segs = d.bandMix.map((b) => ({ label: HIRE_META[b.band].label, n: b.n, color: HIRE_META[b.band].color }));
  const hasBands = segs.some((s) => s.n > 0);
  return (
    <Card as="section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <Eyebrow as="h2">Verdict mix · session band</Eyebrow>
          <Title as="h3" size={20}>How your sessions would be called</Title>
        </div>
        <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
          Latest: <strong style={{ color: HIRE_META[d.hireBand].color }}>{HIRE_META[d.hireBand].label}</strong> · {d.sessions} sessions
        </span>
      </div>
      {hasBands ? (
        <StackBar segments={segs} label="Hiring verdict across sessions" />
      ) : (
        <EmptyState title="No graded sessions yet" need="Complete one evaluated session to see how your answers would be called." />
      )}
    </Card>
  );
}

/* ── Zone 2 — pillars (with per-pillar sparkline + open evidence) ── */

const PILLAR_HINT: Record<Pillar["key"], string> = {
  competence: "skill scores", consistency: "variance", coverage: "breadth · STAR", currency: "skill-decay", composure: "fillers · pace",
};

function PillarCard({ p, lever, active, onOpen, range }: { p: Pillar; lever: boolean; active: boolean; onOpen: () => void; range: RangeKey }) {
  return (
    <Card as="article" className="rix-pillar" pad={18}
      style={{
        display: "flex", flexDirection: "column", gap: 8, minHeight: 196,
        border: active ? `1px solid ${t.indigo}` : lever ? `1px solid ${COPPER_LINE}` : "none",
        boxShadow: active ? `0 0 0 3px ${t.indigo100}, ${shadows.card}` : lever ? `0 0 0 3px ${t.copperSoft}, ${shadows.card}` : shadows.card,
      }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <Title as="h3" size={14}>{p.label}</Title>
          <div style={{ fontFamily: f.mono, fontSize: 9.5, color: t.inkSoft, marginTop: 3 }}>{PILLAR_HINT[p.key]}</div>
        </div>
        <span style={{ fontFamily: f.mono, fontSize: 10, color: t.inkSoft, background: t.creamSoft, padding: "2px 7px", borderRadius: 999 }}>{Math.round(p.weight * 100)}%</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: f.serif, fontSize: 38, lineHeight: 1, color: scoreColor(p.score) }}>{p.score}</span>
          <DeltaTag value={p.delta} suffix=" this fortnight" />
        </span>
        <Spark points={rangeSlice(p.trend, range)} color={scoreColor(p.score)} width={70} height={26} />
      </div>
      <div role="img" aria-label={`${p.label} pillar: ${p.score} out of 100`} style={{ height: 6, background: t.creamSoft, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${p.score}%`, height: "100%", background: scoreColor(p.score), borderRadius: 999 }} />
      </div>
      <p style={{ margin: 0, fontFamily: f.sans, fontSize: 12, color: t.inkSoft, lineHeight: 1.45 }}>{p.blurb}</p>
      {lever && <span style={{ fontFamily: f.mono, fontSize: 10, fontWeight: 600, color: t.copper, letterSpacing: 0.4, textTransform: "uppercase" }}>◆ Biggest lever</span>}
      <button type="button" onClick={onOpen} aria-expanded={active} className="rix-btn rix-focus rix-tap"
        style={{ marginTop: "auto", alignSelf: "flex-start", padding: "4px 2px", background: "none", border: "none", cursor: "pointer", fontFamily: f.sans, fontSize: 12, fontWeight: 600, color: t.indigo }}>
        {active ? "Hide evidence ▲" : "Open evidence →"}
      </button>
    </Card>
  );
}

export function PillarGrid({ d, narrow, activeKey, onOpen, range }: { d: Fixture; narrow: boolean; activeKey: Pillar["key"] | null; onOpen: (k: Pillar["key"]) => void; range: RangeKey }) {
  const leverKey = d.pillars.length ? [...d.pillars].sort((a, b) => a.score - b.score)[0].key : null;
  return (
    <section aria-labelledby="rix-pillars" id="zone-pillars" style={{ scrollMarginTop: 88 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <Eyebrow as="h2" tone="indigo"><span id="rix-pillars">The five pillars · weighted into RI</span></Eyebrow>
        <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>open any pillar for its drivers and the one fix</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "repeat(5, 1fr)", gap: 14 }}>
        {d.pillars.map((p) => (
          <PillarCard key={p.key} p={p} lever={p.key === leverKey} active={p.key === activeKey} onOpen={() => onOpen(p.key)} range={range} />
        ))}
      </div>
    </section>
  );
}

/* Generalized pillar evidence — works for ALL five pillars, not just one.
   Renders drivers (each with a comfort-band meter where defined) + a
   hold/fix narration. The inline drill target for the pillar grid. */
export function PillarEvidence({ p }: { p: Pillar }) {
  return (
    <Card as="section" pad={22} style={{ border: `1px solid ${t.indigo}`, boxShadow: `0 0 0 3px ${t.indigo100}, ${shadows.card}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <Eyebrow as="h2" tone="indigo">Pillar evidence</Eyebrow>
          <Title as="h3" size={24}>{p.label}</Title>
        </div>
        <span style={{ textAlign: "right" }}>
          <span style={{ fontFamily: f.serif, fontSize: 40, color: scoreColor(p.score), lineHeight: 1 }}>{p.score}</span>
          <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft }}> / 100</span>
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, p.drivers.length))}, 1fr)`, gap: 14 }}>
        {p.drivers.map((dr) => (
          <MetricStat key={dr.label} label={dr.label} value={dr.value}
            tone={dr.tone === "good" ? "good" : dr.tone === "watch" ? "warn" : dr.tone === "miss" ? "bad" : "ink"}
            hint={dr.hint} meter={dr.meter} />
        ))}
      </div>
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ padding: "14px 16px", background: t.success100, borderRadius: 12 }}>
          <Eyebrow tone="ink"><span style={{ color: t.success }}>Holding well</span></Eyebrow>
          <p style={{ margin: "6px 0 0", fontFamily: f.sans, fontSize: 13.5, color: t.coal, lineHeight: 1.5 }}>{p.hold}</p>
        </div>
        <div style={{ padding: "14px 16px", background: t.copperSoft, borderRadius: 12 }}>
          <Eyebrow tone="ink"><span style={{ color: t.copper }}>The one fix</span></Eyebrow>
          <p style={{ margin: "6px 0 0", fontFamily: f.sans, fontSize: 13.5, color: t.coal, lineHeight: 1.5 }}>{p.fix}</p>
        </div>
      </div>
    </Card>
  );
}

/* Session-over-session diff — pick any two snapshots, see what moved. */
export function SessionDiff({ d, narrow }: { d: Fixture; narrow: boolean }) {
  const first = d.snapshots[0];
  const lastSnap = d.snapshots[d.snapshots.length - 1];
  const [aId, setA] = React.useState(first?.id ?? "");
  const [bId, setB] = React.useState(lastSnap?.id ?? "");
  if (d.snapshots.length < 2) {
    return (
      <Card as="section">
        <Eyebrow as="h2" tone="indigo">Compare sessions</Eyebrow>
        <div style={{ marginTop: 12 }}><EmptyState title="Not enough sessions to compare yet" need="Complete at least 2 sessions to unlock session-over-session diffs." /></div>
      </Card>
    );
  }
  const a = d.snapshots.find((s) => s.id === aId) ?? d.snapshots[0];
  const b = d.snapshots.find((s) => s.id === bId) ?? d.snapshots[d.snapshots.length - 1];
  const selStyle: React.CSSProperties = { fontFamily: f.sans, fontSize: 12.5, color: t.coal, background: t.white, border: `1px solid ${t.line}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer" };
  return (
    <Card as="section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <Eyebrow as="h2" tone="indigo">Compare sessions</Eyebrow>
          <Title as="h3" size={20}>What moved between two points</Title>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label htmlFor="rix-compare-from" style={{ display: "inline-flex", gap: 6, alignItems: "center", fontFamily: f.mono, fontSize: 10, color: t.inkSoft, textTransform: "uppercase" }}>
            From
            <select id="rix-compare-from" name="rix-compare-from" aria-label="Compare from session" className="rix-focus" value={aId} onChange={(e) => setA(e.target.value)} style={selStyle}>
              {d.snapshots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <span aria-hidden="true" style={{ color: t.inkFaint }}>→</span>
          <label htmlFor="rix-compare-to" style={{ display: "inline-flex", gap: 6, alignItems: "center", fontFamily: f.mono, fontSize: 10, color: t.inkSoft, textTransform: "uppercase" }}>
            To
            <select id="rix-compare-to" name="rix-compare-to" aria-label="Compare to session" className="rix-focus" value={bId} onChange={(e) => setB(e.target.value)} style={selStyle}>
              {d.snapshots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
        <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>RI</span>
        <span style={{ fontFamily: f.serif, fontSize: 22, color: t.inkSoft }}>{a.ri}</span>
        <span aria-hidden="true" style={{ color: t.inkFaint }}>→</span>
        <span style={{ fontFamily: f.serif, fontSize: 22, color: t.coal }}>{b.ri}</span>
        <DeltaTag value={b.ri - a.ri} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr 1fr" : "repeat(5, 1fr)", gap: 10 }}>
        {d.pillarLabels.map((label, i) => {
          const delta = b.pillars[i] - a.pillars[i];
          const col = delta > 0 ? t.success : delta < 0 ? t.error : t.inkSoft;
          return (
            <div key={label} style={{ padding: "10px 12px", background: t.creamSoft, borderRadius: 10 }}>
              <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>{label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                <span style={{ fontFamily: f.mono, fontSize: 14, color: t.coal }}>{b.pillars[i]}</span>
                <span style={{ fontFamily: f.mono, fontSize: 11.5, fontWeight: 600, color: col }}>{delta > 0 ? "+" : ""}{delta}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Zone 3 — competence, coverage, blind spots ────────────────── */

export function CompetenceCoverage({ d, narrow }: { d: Fixture; narrow: boolean }) {
  const weakest = [...d.skills].sort((a, b) => a.score - b.score)[0];
  const lowSample = d.sessions < 8;
  return (
    <div id="zone-competence" style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1.4fr 1fr", gap: 16, scrollMarginTop: 88 }}>
      <Card as="section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, gap: 12 }}>
          <div>
            <Eyebrow as="h2">Competence</Eyebrow>
            <Title as="h3" size={20}>Skill profile vs {d.target.company}</Title>
          </div>
          <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>score · percentile · delta</span>
        </div>
        {d.skills.length ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {d.skills.map((s) => <SkillBar key={s.name} s={s} />)}
            </div>
            {weakest && (
              <p style={{ marginTop: 16, marginBottom: 0, padding: "10px 14px", background: t.creamSoft, borderRadius: 10, fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft }}>
                Weakest lever: <strong style={{ color: t.coal }}>{weakest.name}</strong> (p{weakest.percentile}). The biggest single RI gain comes from closing this gap.
              </p>
            )}
          </>
        ) : (
          <EmptyState title="No skill scores yet" need="Run one full evaluated session to populate your per-skill profile." />
        )}
      </Card>

      <Card as="section">
        <Eyebrow as="h2">Coverage + Consistency</Eyebrow>
        <Title as="h3" size={20}>How complete, how stable</Title>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: f.sans, fontSize: 13, color: t.coal, marginBottom: 8 }}>
              <span>Round types practiced</span>
              <span style={{ fontFamily: f.mono }}>{d.coverage.focusDone}/{d.coverage.focusTotal}</span>
            </div>
            <div role="img" aria-label={`${d.coverage.focusDone} of ${d.coverage.focusTotal} round types practiced`} style={{ display: "flex", gap: 5 }}>
              {Array.from({ length: d.coverage.focusTotal }).map((_, i) => (
                <div key={i} style={{ flex: 1, height: 8, borderRadius: 999, background: i < d.coverage.focusDone ? t.indigo : t.creamSoft }} />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, marginBottom: 8 }}>STAR completeness</div>
            <StarChips star={d.coverage.star} />
            <div style={{ fontFamily: f.sans, fontSize: 11.5, color: t.inkSoft, marginTop: 9 }}>
              {(() => {
                const labels: Array<[keyof typeof d.coverage.star, string]> = [["S", "Situation"], ["T", "Task"], ["A", "Action"], ["R", "Result"], ["L", "Learning"]];
                const missing = labels.filter(([k]) => !d.coverage.star[k]).map(([k, name]) => `${name} (${k})`);
                if (!missing.length) return "All five elements are landing.";
                return `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} most often dropped. A coached fix is queued.`;
              })()}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><MetricStat label="Common-Q coverage" value={`${d.coverage.commonPct}`} unit="%" tone={d.coverage.commonPct >= 70 ? "good" : "warn"} meter={{ min: 0, max: 100, lo: 70, hi: 100, value: d.coverage.commonPct }} hint="freq-weighted pool" /></div>
            <div style={{ flex: 1 }}><MetricStat label="Score spread σ" value={`${d.scoreSpread.sigma}`} tone={d.scoreSpread.sigma <= 8 ? "good" : "warn"} meter={{ min: 0, max: 20, lo: 0, hi: 8, value: d.scoreSpread.sigma, lowerBetter: true }} hint={`range ${d.scoreSpread.min}–${d.scoreSpread.max}`} /></div>
          </div>
          {lowSample && <EmptyState title="Consistency is still an estimate" need={`Based on ${d.sessions} sessions. The σ stabilises at 8 or more.`} />}
        </div>
      </Card>
    </div>
  );
}

export function BlindSpots({ d }: { d: Fixture }) {
  const router = useRouter();
  return (
    <Card as="section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <Eyebrow as="h2" tone="copper">Blind spots · commonly tested, untested by you</Eyebrow>
          <Title as="h3" size={20}>What the loop will ask that you haven't rehearsed</Title>
        </div>
        <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>% = frequency at {d.target.company}</span>
      </div>
      {d.blindSpots.length ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          {d.blindSpots.map((b) => (
            <li key={b.competency} style={{ display: "flex", gap: 14, alignItems: "center", padding: "12px 14px", background: t.creamSoft, borderRadius: 12 }}>
              <span style={{ fontFamily: f.serif, fontSize: 24, color: t.copper, width: 52, flexShrink: 0 }}>{b.frequencyPct}%</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal }}>{b.competency}</div>
                <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, marginTop: 2 }}>{b.note}</div>
              </div>
              <button type="button" onClick={() => router.push("/session/new")} className="rix-btn rix-ghost rix-focus rix-tap" aria-label={`Practice ${b.competency}`}
                style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${COPPER_LINE}`, background: t.white, color: t.copper, fontFamily: f.sans, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Practice
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No blind spots flagged yet" need="As you practice more round types, commonly-tested competencies you have skipped surface here." />
      )}
    </Card>
  );
}

/* ── Zone 4 — delivery + register ──────────────────────────────── */

export function DeliveryPanel({ d, narrow }: { d: Fixture; narrow: boolean }) {
  const c = d.composure;
  // Voice metrics only exist for sessions run in voice mode. A text-only
  // history leaves every field at 0, which would otherwise render as a wall
  // of green "perfect" cards. Treat an all-zero composure as "no data".
  const hasVoice = c.fillerPerMin > 0 || c.paceWpm > 0 || c.silenceRatio > 0 ||
    c.hedgingPerMin > 0 || c.firstPersonRatio > 0 || c.lexicalDiversity > 0 ||
    c.medianLatencyMs > 0 || c.selfCorrectionRate > 0 || c.energy > 0;
  return (
    <Card as="section" id="zone-delivery" style={{ scrollMarginTop: 88 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <Eyebrow as="h2">Delivery · voice and language</Eyebrow>
          <Title as="h3" size={20}>How you sound under pressure</Title>
        </div>
        <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>the green band on each is the interviewer-comfort range</span>
      </div>
      {!hasVoice ? (
        <EmptyState title="No voice delivery read yet" need="Run a session in voice mode so we can measure pace, fillers, latency and energy." />
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr 1fr" : "repeat(3, 1fr)", gap: 14 }}>
        <MetricStat label="Filler / min" value={`${c.fillerPerMin}`} tone={c.fillerPerMin <= 5 ? "good" : "warn"} meter={{ min: 0, max: 12, lo: 0, hi: 5, value: c.fillerPerMin, lowerBetter: true }} hint="comfortable ≤ 5" />
        <MetricStat label="Pace" value={`${c.paceWpm}`} unit="wpm" tone={c.paceWpm <= 160 ? "good" : "warn"} meter={{ min: 90, max: 200, lo: 120, hi: 160, value: c.paceWpm }} hint="120–160 ideal" />
        <MetricStat label="Silence ratio" value={`${c.silenceRatio}`} unit="%" tone={c.silenceRatio <= 15 ? "good" : "warn"} meter={{ min: 0, max: 40, lo: 0, hi: 15, value: c.silenceRatio, lowerBetter: true }} hint="dead air" />
        <MetricStat label="Hedging / min" value={`${c.hedgingPerMin}`} tone={c.hedgingPerMin <= 3 ? "good" : "warn"} meter={{ min: 0, max: 8, lo: 0, hi: 3, value: c.hedgingPerMin, lowerBetter: true }} hint="“sort of”, “maybe”" />
        <MetricStat label="Ownership (I vs we)" value={`${Math.round(c.firstPersonRatio * 100)}`} unit="%" tone={c.firstPersonRatio >= 0.6 ? "good" : "warn"} meter={{ min: 0, max: 100, lo: 60, hi: 100, value: c.firstPersonRatio * 100 }} hint="first-person ratio" />
        <MetricStat label="Word variety" value={`${c.lexicalDiversity.toFixed(2)}`} tone={c.lexicalDiversity >= 0.5 ? "good" : "warn"} meter={{ min: 0, max: 1, lo: 0.5, hi: 1, value: c.lexicalDiversity }} hint="lexical diversity" />
        <MetricStat label="Median latency" value={`${(c.medianLatencyMs / 1000).toFixed(1)}`} unit="s" tone={c.medianLatencyMs <= 2200 ? "good" : "warn"} meter={{ min: 0, max: 5, lo: 0, hi: 2.2, value: c.medianLatencyMs / 1000, lowerBetter: true }} hint="think-time" />
        <MetricStat label="Self-corrections / min" value={`${c.selfCorrectionRate.toFixed(1)}`} tone={c.selfCorrectionRate <= 1.5 ? "good" : "warn"} meter={{ min: 0, max: 4, lo: 0, hi: 1.5, value: c.selfCorrectionRate, lowerBetter: true }} hint="“actually, scratch that”" />
        <MetricStat label="Energy" value={`${c.energy}`} unit="/100" tone={c.energy >= 70 ? "good" : "warn"} meter={{ min: 0, max: 100, lo: 70, hi: 100, value: c.energy }} hint="vocal dynamism" />
      </div>
      )}
    </Card>
  );
}

/* Interviewer attention timeline — derived from per-answer thought states. */
const ATTN_META: Record<Attention["state"], { color: string; label: string }> = {
  tracking: { color: t.success, label: "Tracking" },
  impressed: { color: t.success, label: "Impressed" },
  probingForScope: { color: t.warning, label: "Probing" },
  readyToMoveOn: { color: t.inkSoft, label: "Wrapping" },
  losingThread: { color: t.error, label: "Losing thread" },
  concerned: { color: t.error, label: "Concerned" },
};

export function AttentionTimeline({ d }: { d: Fixture }) {
  if (d.attention.length === 0) {
    return (
      <Card as="section">
        <Eyebrow as="h2" tone="indigo">Interviewer attention</Eyebrow>
        <div style={{ marginTop: 12 }}><EmptyState title="No attention read yet" need="The interviewer-attention model needs one full voice session to populate." /></div>
      </Card>
    );
  }
  return (
    <Card as="section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <Eyebrow as="h2" tone="indigo">Interviewer attention</Eyebrow>
          <Title as="h3" size={20}>Where you held the room, where you lost it</Title>
        </div>
        <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>last session, by answer progress</span>
      </div>
      <div role="img" aria-label={`Attention timeline: ${d.attention.map((a) => `${ATTN_META[a.state].label} at ${a.atPct}%`).join(", ")}`}
        style={{ position: "relative", height: 10, borderRadius: 999, background: t.creamSoft, marginBottom: 14 }}>
        {d.attention.map((a, i) => {
          const next = d.attention[i + 1];
          const w = next ? next.atPct - a.atPct : 100 - a.atPct;
          return <span key={i} aria-hidden="true" style={{ position: "absolute", left: `${a.atPct}%`, width: `${w}%`, top: 0, bottom: 0, background: ATTN_META[a.state].color, opacity: 0.7, borderRadius: 999 }} />;
        })}
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {d.attention.map((a, i) => (
          <li key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, width: 38, flexShrink: 0 }}>{a.atPct}%</span>
            <span style={{ fontFamily: f.mono, fontSize: 9.5, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", color: ATTN_META[a.state].color, width: 96, flexShrink: 0 }}>{ATTN_META[a.state].label}</span>
            <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>{a.note}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function CulturalRegister({ d }: { d: Fixture }) {
  if (!d.cultural.length) return null;
  return (
    <Card as="section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <Eyebrow as="h2" tone="indigo">Cultural register · India-calibrated</Eyebrow>
          <Title as="h3" size={20}>How your style reads to the panel</Title>
        </div>
        <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, maxWidth: 320, textAlign: "right" }}>
          Indian-register markers are recognised as strengths, not penalised. Two can cost ownership perception.
        </span>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
        {d.cultural.map((s) => (
          <li key={s.key} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 12px", background: s.tone === "asset" ? t.success100 : t.warning100, borderRadius: 10 }}>
            <span aria-hidden="true" style={{ fontFamily: f.mono, fontSize: 12, fontWeight: 700, color: s.tone === "asset" ? t.success : t.warning, width: 18 }}>{s.tone === "asset" ? "✓" : "!"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: 600, color: t.coal }}>
                {s.label} <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, fontWeight: 400 }}>· {s.ratePct}% of answers</span>
              </div>
              <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 1 }}>{s.note}</div>
            </div>
            <span style={{ fontFamily: f.mono, fontSize: 9.5, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: s.tone === "asset" ? t.success : t.warning }}>{s.tone === "asset" ? "asset" : "watch"}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ── Zone 5 — answer craft + evidence ──────────────────────────── */

export function AnswerCraft({ d, narrow }: { d: Fixture; narrow: boolean }) {
  const [open, setOpen] = React.useState(false);
  const ac = d.answerCraft;
  const vSeg = ac.verdictMix.map((v) => ({ label: v.label, n: v.n, color: TONE_FG[v.tone] }));
  const lenTotal = ac.lengthMix.tooBrief + ac.lengthMix.right + ac.lengthMix.tooLong || 1;
  const lenSeg = [
    { label: "Too brief", n: ac.lengthMix.tooBrief, color: t.warning },
    { label: "On target", n: ac.lengthMix.right, color: t.success },
    { label: "Too long", n: ac.lengthMix.tooLong, color: t.error },
  ];
  return (
    <div id="zone-craft" style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1.3fr 1fr", gap: 16, scrollMarginTop: 88 }}>
      <Card as="section">
        <Eyebrow as="h2">Answer craft · per-question verdicts</Eyebrow>
        <Title as="h3" size={20}>Quality across every answer</Title>
        <div style={{ marginTop: 16 }}><StackBar segments={vSeg} label="Answer verdict distribution" /></div>
        <div style={{ marginTop: 18 }}>
          <div style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, marginBottom: 8 }}>Answer length vs target range</div>
          <div role="img" aria-label={`Length: ${ac.lengthMix.right} on target, ${ac.lengthMix.tooBrief} too brief, ${ac.lengthMix.tooLong} too long`}
            style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", background: t.creamSoft }}>
            {lenSeg.map((s) => s.n > 0 && <div key={s.label} style={{ width: `${(s.n / lenTotal) * 100}%`, background: s.color }} />)}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
            {lenSeg.map((s) => (
              <span key={s.label} style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, display: "inline-flex", gap: 6, alignItems: "center" }}>
                <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />{s.label} <strong style={{ color: t.coal, fontFamily: f.mono, fontSize: 11.5 }}>{s.n}</strong>
              </span>
            ))}
          </div>
        </div>
        {ac.weakAnswers.length > 0 && (
          <div style={{ marginTop: 18, borderTop: `1px solid ${t.line}`, paddingTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>Your weakest answers, in your words</span>
              <DisclosureBtn open={open} onClick={() => setOpen((v) => !v)} label="Show evidence" />
            </div>
            {open && (
              <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {ac.weakAnswers.map((w, i) => (
                  <li key={i} className="rix-evi" style={{ padding: "10px 12px", borderRadius: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: f.mono, fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", color: t.error, background: t.error100, padding: "2px 6px", borderRadius: 5 }}>{w.verdict}</span>
                      <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal }}>{w.question}</span>
                    </div>
                    {w.quote && <EvidenceQuote quote={w.quote} />}
                    <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.copper, marginTop: 6 }}>Fix · {w.fix}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
      <Card as="section" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <Eyebrow as="h2">Substance signals</Eyebrow>
          <Title as="h3" size={20}>Numbers and ownership</Title>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}><MetricStat label="Quantified answers" value={`${ac.quantifiedPct}`} unit="%" tone={ac.quantifiedPct >= 60 ? "good" : "warn"} meter={{ min: 0, max: 100, lo: 60, hi: 100, value: ac.quantifiedPct }} hint="answers with a metric" /></div>
          <div style={{ flex: 1 }}><MetricStat label="Clear ownership" value={`${ac.ownershipPct}`} unit="%" tone={ac.ownershipPct >= 65 ? "good" : "warn"} meter={{ min: 0, max: 100, lo: 65, hi: 100, value: ac.ownershipPct }} hint="“I” vs we-heavy" /></div>
        </div>
        <p style={{ margin: 0, padding: "10px 14px", background: t.indigo100, borderRadius: 10, fontFamily: f.sans, fontSize: 12.5, color: t.indigoDeep, lineHeight: 1.5 }}>
          {ac.quantifiedPct < 60
            ? "Putting a number on the result is the fastest answer-craft win. It moves Partial answers to Complete."
            : "Strong on numbers. Keep first-person ownership high and you convert Complete answers to Strong."}
        </p>
      </Card>
    </div>
  );
}

/* ── Zone 6 — per-type signature metrics ───────────────────────── */

export function FocusMetrics({ d, narrow }: { d: Fixture; narrow: boolean }) {
  return (
    <Card as="section" id="zone-signature" style={{ scrollMarginTop: 88 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <Eyebrow as="h2" tone="copper">Signature metrics · by interview type</Eyebrow>
          <Title as="h3" size={20}>The numbers that define quality in each round</Title>
        </div>
        <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>pinned per type</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
        {d.focusMetrics.map((fm) => (
          <div key={fm.type} style={{ border: `1px solid ${t.line}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal }}>{fm.type}</span>
              <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft }}>{fm.sessions} {fm.sessions === 1 ? "session" : "sessions"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {fm.metrics.map((m) => (
                <div key={m.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft }}>{m.label}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: TONE_FG[m.tone] }} />
                    <span style={{ fontFamily: f.mono, fontSize: 12.5, fontWeight: 600, color: TONE_FG[m.tone] }}>{m.value}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {d.coverage.focusTotal - d.coverage.focusDone > 0 && (
          <div style={{ gridColumn: narrow ? "auto" : "1 / -1" }}>
            <EmptyState title={`${d.coverage.focusTotal - d.coverage.focusDone} round types not yet practiced`} need="Each unpracticed type unlocks its own signature metrics once you run one session." />
          </div>
        )}
      </div>
    </Card>
  );
}

/* ── Zone 7 — patterns, currency, red flags, follow-ups ────────── */

const KIND_META: Record<CrossInsight["kind"], { glyph: string; color: string; label: string }> = {
  improvement: { glyph: "▲", color: t.success, label: "Improving" },
  regression:  { glyph: "▼", color: t.error,   label: "Slipping" },
  persistent:  { glyph: "●", color: t.warning, label: "Persistent" },
};

export function PatternsOverTime({ d, narrow }: { d: Fixture; narrow: boolean }) {
  return (
    <div id="zone-patterns" style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1.4fr 1fr", gap: 16, scrollMarginTop: 88 }}>
      <Card as="section">
        <Eyebrow as="h2" tone="indigo">Patterns over time · across sessions</Eyebrow>
        <Title as="h3" size={20}>What's moving, session to session</Title>
        {d.crossSession.length ? (
          <ul style={{ listStyle: "none", margin: "16px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {d.crossSession.map((ci, i) => {
              const k = KIND_META[ci.kind];
              return (
                <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span aria-hidden="true" style={{ fontFamily: f.mono, fontSize: 12, color: k.color, marginTop: 2, width: 14, flexShrink: 0 }}>{k.glyph}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: f.mono, fontSize: 9.5, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: k.color }}>{k.label}</span>
                      <span style={{ fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, color: t.coal }}>{ci.metric}</span>
                      {typeof ci.delta === "number" && <DeltaTag value={ci.delta} />}
                    </div>
                    <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 2, lineHeight: 1.45 }}>{ci.text}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div style={{ marginTop: 16 }}><EmptyState title="No cross-session patterns yet" need="Complete a few more sessions and recurring trends in your delivery and craft appear here." /></div>
        )}
      </Card>
      <Card as="section">
        <Eyebrow as="h2" tone="copper">Story reuse</Eyebrow>
        <Title as="h3" size={20}>Is your portfolio thin?</Title>
        {d.storyReuse.length ? (
          <ul style={{ listStyle: "none", margin: "16px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {d.storyReuse.map((s) => (
              <li key={s.label} style={{ padding: "12px 14px", background: t.creamSoft, borderRadius: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal }}>“{s.label}”</span>
                  <span style={{ fontFamily: f.mono, fontSize: 11, color: t.copper, background: t.copperSoft, padding: "2px 8px", borderRadius: 999 }}>{s.count}× reused</span>
                </div>
                <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, marginTop: 6, lineHeight: 1.45 }}>{s.concern}</div>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ marginTop: 16 }}><EmptyState title="No over-used stories" need="You are drawing on a healthy spread of examples. Keep it varied." /></div>
        )}
      </Card>
    </div>
  );
}

function FlagRow({ flag }: { flag: TypedFlag }) {
  const [open, setOpen] = React.useState(false);
  const SEV: Record<TypedFlag["severity"], { color: string; bg: string; label: string }> = {
    high:   { color: t.error,   bg: t.error100,   label: "High" },
    medium: { color: t.warning, bg: t.warning100, label: "Medium" },
    low:    { color: t.inkSoft, bg: t.creamSoft,  label: "Low" },
  };
  const sev = SEV[flag.severity];
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ fontFamily: f.mono, fontSize: 9, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: sev.color, background: sev.bg, padding: "2px 6px", borderRadius: 5, flexShrink: 0 }}>{sev.label}</span>
          <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal }}>{flag.title}</span>
        </span>
        <span style={{ display: "inline-flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: f.mono, fontSize: 11.5, color: t.inkSoft }}>{flag.hits}/{flag.of}</span>
          {flag.quote && <DisclosureBtn open={open} onClick={() => setOpen((v) => !v)} label="Evidence" />}
        </span>
      </div>
      <div role="img" aria-label={`${flag.title}: ${flag.hits} of ${flag.of} sessions, ${sev.label} severity`} style={{ height: 6, background: t.creamSoft, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${(flag.hits / flag.of) * 100}%`, height: "100%", background: sev.color, borderRadius: 999, opacity: 0.82 }} />
      </div>
      {open && flag.quote && <EvidenceQuote quote={flag.quote} />}
    </div>
  );
}

export function RefreshAndFlags({ d, narrow }: { d: Fixture; narrow: boolean }) {
  const router = useRouter();
  return (
    <div style={{ display: "grid", gridTemplateColumns: narrow ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)", gap: 16 }}>
      <Card as="section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <Eyebrow as="h2" tone="copper">Currency · refresh queue</Eyebrow>
            <Title as="h3" size={20}>Skills going cold</Title>
          </div>
          <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>spaced-repetition</span>
        </div>
        {d.refresh.length ? (
          <ul style={{ marginTop: 16, marginBottom: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {d.refresh.map((r) => (
              <li key={r.skill} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "10px 12px", background: t.creamSoft, borderRadius: 10 }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: r.decay <= -5 ? t.error : t.copper, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontFamily: f.sans, fontSize: 13.5, color: t.coal }}>{r.skill}</span>
                <span style={{ fontFamily: f.mono, fontSize: 11.5, color: t.inkSoft }}>{r.days}d idle</span>
                <span style={{ fontFamily: f.mono, fontSize: 11.5, fontWeight: 600, color: t.error, width: 30, textAlign: "right" }} aria-label={`decayed ${Math.abs(r.decay)} points`}>{r.decay}</span>
                <button type="button" onClick={() => router.push("/session/new")} className="rix-btn rix-ghost rix-focus rix-tap" aria-label={`Refresh ${r.skill}`}
                  style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${COPPER_LINE}`, background: t.white, color: t.copper, fontFamily: f.sans, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Refresh</button>
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ marginTop: 16 }}><EmptyState title="Everything is fresh" need="No skill has gone past its decay window. Keep your cadence steady to hold it." /></div>
        )}
      </Card>
      <Card as="section">
        <Eyebrow as="h2" tone="ink">Recurring red flags</Eyebrow>
        <Title as="h3" size={20}>Rejection-grade patterns</Title>
        {d.redFlags.length ? (
          <>
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              {d.redFlags.map((flag) => <FlagRow key={flag.title} flag={flag} />)}
            </div>
            <p style={{ marginTop: 16, marginBottom: 0, padding: "10px 14px", background: t.indigo100, borderRadius: 10, fontFamily: f.sans, fontSize: 12.5, color: t.indigoDeep }}>
              Clearing the top flag is your fastest RI gain: it shows up in {d.redFlags[0].hits} of your last {d.redFlags[0].of} sessions.
            </p>
          </>
        ) : (
          <div style={{ marginTop: 16 }}><EmptyState title="No recurring red flags" need="Nothing rejection-grade is repeating across your sessions. Keep it that way." /></div>
        )}
      </Card>
    </div>
  );
}

/* Likely follow-ups — aggregated to a prep list. */
export function FollowUpPrep({ d }: { d: Fixture }) {
  const router = useRouter();
  if (!d.followUps.length) return null;
  return (
    <Card as="section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <Eyebrow as="h2" tone="indigo">Likely follow-ups · prep list</Eyebrow>
          <Title as="h3" size={20}>Questions you'd most likely get next</Title>
        </div>
        <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>derived from your gaps · % = frequency</span>
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {d.followUps.map((q, i) => (
          <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", background: t.creamSoft, borderRadius: 12 }}>
            <span style={{ fontFamily: f.serif, fontSize: 18, color: t.indigo, width: 40, flexShrink: 0 }}>{q.freqPct}%</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: f.sans, fontSize: 14, color: t.coal, lineHeight: 1.45 }}>{q.question}</div>
              <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 3 }}>Why you · {q.why}</div>
            </div>
            <button type="button" onClick={() => router.push("/session/new")} className="rix-btn rix-ghost rix-focus rix-tap" aria-label={`Drill: ${q.question}`}
              style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${COPPER_LINE}`, background: t.white, color: t.copper, fontFamily: f.sans, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Drill</button>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* ── Zone 8 — closing, resume, coaching ────────────────────────── */

export function ClosingAndResume({ d, narrow }: { d: Fixture; narrow: boolean }) {
  const rv = d.reverse;
  const total = rv.green + rv.yellow + rv.red || 1;
  const segs = [
    { label: "Strong", n: rv.green, color: t.success },
    { label: "Neutral", n: rv.yellow, color: t.warning },
    { label: "Risky", n: rv.red, color: t.error },
  ];
  const vColor = rv.verdict === "strong" ? t.success : rv.verdict === "weak" || rv.verdict === "red flags" ? t.error : t.warning;
  return (
    <div id="zone-closing" style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: 16, scrollMarginTop: 88 }}>
      <Card as="section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
          <div>
            <Eyebrow as="h2" tone="indigo">Closing turn · your questions back</Eyebrow>
            <Title as="h3" size={20}>The questions you ask back</Title>
          </div>
          <span style={{ fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, color: vColor, textTransform: "capitalize" }}>{rv.verdict}</span>
        </div>
        <div role="img" aria-label={`Closing questions: ${rv.green} strong, ${rv.yellow} neutral, ${rv.red} risky`} style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", background: t.creamSoft }}>
          {segs.map((s) => s.n > 0 && <div key={s.label} style={{ width: `${(s.n / total) * 100}%`, background: s.color }} />)}
        </div>
        <ul style={{ display: "flex", gap: 14, listStyle: "none", margin: "10px 0 0", padding: 0, flexWrap: "wrap" }}>
          {segs.map((s) => (
            <li key={s.label} style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />{s.label} <strong style={{ color: t.coal, fontFamily: f.mono, fontSize: 11.5 }}>{s.n}</strong>
            </li>
          ))}
        </ul>
        <p style={{ margin: "14px 0 0", fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, lineHeight: 1.5 }}>
          {rv.red > 0
            ? "One question read as a rejection trigger (salary or leave too early). Save those for the recruiter, not the panel."
            : "Your closing questions engage the role itself. Keep asking about success in 90 days and team structure."}
        </p>
      </Card>
      {d.resume ? (
        <Card as="section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div>
              <Eyebrow as="h2" tone="copper">Resume grounding</Eyebrow>
              <Title as="h3" size={20}>Answers anchored in your resume</Title>
            </div>
            {d.resume.trend.length > 1 && <Spark points={d.resume.trend} color={t.copper} />}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: f.serif, fontSize: 44, lineHeight: 1, color: scoreColor(d.resume.score) }}>{d.resume.score}</span>
            <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft }}>/ 100</span>
          </div>
          <div role="img" aria-label={`Resume grounding ${d.resume.score} of 100`} style={{ height: 8, background: t.creamSoft, borderRadius: 999, overflow: "hidden", marginTop: 10 }}>
            <div style={{ width: `${d.resume.score}%`, height: "100%", background: scoreColor(d.resume.score), borderRadius: 999 }} />
          </div>
          <p style={{ margin: "12px 0 0", fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, lineHeight: 1.5 }}>{d.resume.rationale}</p>
        </Card>
      ) : (
        <Card as="section">
          <Eyebrow as="h2" tone="copper">Resume grounding</Eyebrow>
          <Title as="h3" size={20}>Answers anchored in your resume</Title>
          <div style={{ marginTop: 14 }}><EmptyState title="No resume-grounding read yet" need="Add your resume and run a session so we can score how well your answers cite it." /></div>
        </Card>
      )}
    </div>
  );
}

/* Coaching strength + gap. */
export function Coaching({ d, narrow }: { d: Fixture; narrow: boolean }) {
  if (!d.coaching) return null;
  const co = d.coaching;
  return (
    <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: 16 }}>
      <Card as="section" style={{ background: t.success100, border: `1px solid ${SUCCESS_LINE}` }}>
        <Eyebrow as="h2" tone="ink"><span style={{ color: t.success }}>Your edge</span></Eyebrow>
        <Title as="h3" size={20}>{co.strength.headline}</Title>
        <p style={{ margin: "10px 0 0", fontFamily: f.sans, fontSize: 13.5, color: t.coal, lineHeight: 1.55 }}>{co.strength.meaning}</p>
      </Card>
      <Card as="section" style={{ background: t.copperSoft, border: `1px solid ${COPPER_LINE}` }}>
        <Eyebrow as="h2" tone="ink"><span style={{ color: t.copper }}>Your one gap</span></Eyebrow>
        <Title as="h3" size={20}>{co.gap.headline}</Title>
        <p style={{ margin: "10px 0 0", fontFamily: f.sans, fontSize: 13.5, color: t.coal, lineHeight: 1.55 }}>{co.gap.meaning}</p>
        <div style={{ marginTop: 10, padding: "10px 12px", background: t.white, borderRadius: 10, fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, lineHeight: 1.5 }}>
          <span style={{ fontFamily: f.mono, fontSize: 10, color: t.copper, textTransform: "uppercase", letterSpacing: 0.4 }}>Try this</span><br />{co.gap.example}
        </div>
      </Card>
    </div>
  );
}

/* ── Zone 9 — negotiation ──────────────────────────────────────── */

export function NegotiationCard({ d, narrow }: { d: Fixture; narrow: boolean }) {
  if (!d.negotiation) return null;
  const n = d.negotiation;
  const oColor = n.outcome === "accepted" ? t.success : n.outcome === "walked-away" || n.outcome === "stalemate" ? t.warning : t.inkSoft;
  return (
    <Card as="section" id="zone-negotiation" style={{ scrollMarginTop: 88 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <Eyebrow as="h2" tone="indigo">Salary negotiation</Eyebrow>
          <Title as="h3" size={20}>Your negotiation behaviour</Title>
        </div>
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: f.serif, fontSize: 34, lineHeight: 1, color: scoreColor(n.score) }}>{n.score}</span>
          <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft }}>/ 100</span>
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
        <MetricStat label="Outcome" value={n.outcome === "walked-away" ? "Walked" : n.outcome.charAt(0).toUpperCase() + n.outcome.slice(1)} tone={n.outcome === "accepted" ? "good" : "warn"} />
        <MetricStat label="Anchored at turn" value={`${n.anchorTurn}`} tone={n.anchorTurn <= 1 ? "good" : "warn"} hint="earlier is stronger" />
        <MetricStat label="Band traversed" value={`${n.bandTraversalPct}`} unit="%" tone={n.bandTraversalPct >= 60 ? "good" : "warn"} meter={{ min: 0, max: 100, lo: 60, hi: 100, value: n.bandTraversalPct }} hint="of negotiable band" />
        <MetricStat label="Levers used" value={`${n.leverDiversity}`} unit="/ 8" tone={n.leverDiversity >= 4 ? "good" : "warn"} meter={{ min: 0, max: 8, lo: 4, hi: 8, value: n.leverDiversity }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "10px 14px", background: t.creamSoft, borderRadius: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: f.mono, fontSize: 11, color: oColor, fontWeight: 600 }}>+{n.lpaGained} LPA gained</span>
        <span aria-hidden="true" style={{ width: 4, height: 4, borderRadius: 999, background: t.inkFaint }} />
        <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft }}>{n.archetype}</span>
      </div>
    </Card>
  );
}

/* ── Zone 10 — practice cadence ────────────────────────────────── */

export function PracticeCadence({ d, narrow }: { d: Fixture; narrow: boolean }) {
  const HEAT = [t.creamSoft, "rgba(49,46,129,0.30)", "rgba(49,46,129,0.58)", t.indigo];
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const typeTotal = d.cadence.typeMix.reduce((a, x) => a + x.n, 0) || 1;
  const diff = d.cadence.difficulty;
  const diffTotal = diff.warmup + diff.standard + diff.hard || 1;
  const heatActiveDays = d.cadence.heat.filter((x) => x > 0).length;
  const heatPeak = d.cadence.heat.length ? Math.max(...d.cadence.heat) : 0;
  const heatLabel = `Practice heatmap, last ${d.cadence.weeks} weeks. ${heatActiveDays} of ${d.cadence.weeks * 7} days had a session${heatPeak > 1 ? `, up to ${heatPeak} on the busiest day` : ""}.`;
  return (
    <Card as="section" id="zone-practice" style={{ scrollMarginTop: 88 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <Eyebrow as="h2" tone="copper">Practice · cadence and mix</Eyebrow>
          <Title as="h3" size={20}>How much, how often, on what</Title>
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft }}><strong style={{ color: t.coal, fontFamily: f.serif, fontSize: 18 }}>{d.cadence.totalSessions}</strong> sessions</span>
          <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft }}><strong style={{ color: t.coal, fontFamily: f.serif, fontSize: 18 }}>{d.cadence.totalHours}</strong> hrs</span>
          <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft }}><strong style={{ color: t.coal, fontFamily: f.serif, fontSize: 18 }}>{d.cadence.questions}</strong> questions</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "auto 1fr 1fr", gap: 22, alignItems: "start" }}>
        <div>
          <div style={{ fontFamily: f.mono, fontSize: 10, color: t.inkSoft, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>Last {d.cadence.weeks} weeks</div>
          <div role="img" aria-label={heatLabel} style={{ display: "grid", gridTemplateColumns: `14px repeat(${d.cadence.weeks}, 14px)`, gap: 4 }}>
            <span aria-hidden="true" />
            {Array.from({ length: d.cadence.weeks }).map((_, w) => (
              <span key={w} aria-hidden="true" style={{ fontFamily: f.mono, fontSize: 8, color: t.inkFaint, textAlign: "center" }}>{w + 1}</span>
            ))}
            {days.map((dy, r) => (
              <React.Fragment key={r}>
                <span aria-hidden="true" style={{ fontFamily: f.mono, fontSize: 8, color: t.inkFaint, lineHeight: "14px" }}>{dy}</span>
                {Array.from({ length: d.cadence.weeks }).map((_, w) => {
                  const raw = d.cadence.heat[w * 7 + r] ?? 0;
                  const v = Math.min(3, raw);
                  return <span key={w} title={raw > 0 ? `${raw} session${raw === 1 ? "" : "s"}` : "no practice"} style={{ width: 14, height: 14, borderRadius: 4, background: HEAT[v] }} />;
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: f.mono, fontSize: 10, color: t.inkSoft, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>By interview type</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {d.cadence.typeMix.map((tm) => (
              <div key={tm.type} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.coal, width: 96, flexShrink: 0 }}>{tm.type}</span>
                <div style={{ flex: 1, height: 7, background: t.creamSoft, borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${(tm.n / typeTotal) * 100}%`, height: "100%", background: t.indigo, borderRadius: 999 }} />
                </div>
                <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, width: 16, textAlign: "right" }}>{tm.n}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: f.mono, fontSize: 10, color: t.inkSoft, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>By difficulty</div>
          <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", background: t.creamSoft }}
            role="img" aria-label={`Difficulty mix: ${diff.warmup} warmup, ${diff.standard} standard, ${diff.hard} hard`}>
            {diff.warmup > 0 && <div style={{ width: `${(diff.warmup / diffTotal) * 100}%`, background: "rgba(49,46,129,0.30)" }} />}
            {diff.standard > 0 && <div style={{ width: `${(diff.standard / diffTotal) * 100}%`, background: "rgba(49,46,129,0.58)" }} />}
            {diff.hard > 0 && <div style={{ width: `${(diff.hard / diffTotal) * 100}%`, background: t.indigo }} />}
          </div>
          <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 5 }}>
            {([["Warmup", diff.warmup, "rgba(49,46,129,0.30)"], ["Standard", diff.standard, "rgba(49,46,129,0.58)"], ["Hard", diff.hard, t.indigo]] as [string, number, string][]).map(([label, n, col]) => (
              <li key={label} style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, display: "flex", justifyContent: "space-between" }}>
                <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 3, background: col }} />{label}</span>
                <strong style={{ color: t.coal, fontFamily: f.mono, fontSize: 11.5 }}>{n}</strong>
              </li>
            ))}
          </ul>
          {diff.hard === 0 && d.cadence.totalSessions > 0 && <p style={{ margin: "10px 0 0", fontFamily: f.sans, fontSize: 11.5, color: t.warning }}>No hard sessions yet. The loop will be hard; practice at that level.</p>}
        </div>
      </div>
    </Card>
  );
}
