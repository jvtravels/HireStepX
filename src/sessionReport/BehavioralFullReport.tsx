/* BehavioralFullReport — diagnostic-first behavioral interview report.
   Ported from `tempo/designs/canvases/behavioral-interview-result/
   VariantADiagnosticFirst.tsx`. The canvas was a fixture; this is the
   production render against the analyzer's `meta.behavioral` payload.

   Visual structure (top → bottom):
     persona ribbon → compact hero (score ring + verdict + one-habit)
       → STAR matrix → 3 diagnostic cards (Failure / Conflict / Delivery)
       → Radar → Evidence audit → AI accountability strip
       → Transcript replay → sticky CTA

   Edge states (all gated in JSX, never silently mocked):
     - score < 40 → copper hero accent + softened CTA
     - score > 85 → emerald hero accent (verdict still names one gap)
     - failure card hidden when no failure question asked
     - conflict card hidden when no conflict question asked
     - STAR matrix collapses to a one-line note when < 3 substantive
     - first-ever session → no delta chip, no ghost polygon on radar

   Colors come from `./tokens` — do NOT reintroduce canvas hex literals.
   Ticks pair color with ✓ / ✗ glyph so the signal is never color-only. */

"use client";

import * as React from "react";
import { t, f } from "./tokens";
import type {
  BehavioralFullReportData,
  BehavioralStarRow,
  BehavioralTranscriptRow,
} from "./types";

/* ─── Small primitives ────────────────────────────────────────────────── */

function ScoreRing({
  score,
  size = 132,
  stroke = 10,
  color,
}: {
  score: number;
  size?: number;
  stroke?: number;
  color: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Score ${score} out of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.line} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dy="0.05em"
        dominantBaseline="middle"
        style={{
          fontFamily: f.sans,
          fontWeight: 600,
          fontSize: 38,
          fill: t.coal,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {score}
      </text>
      <text
        x="50%"
        y="72%"
        textAnchor="middle"
        style={{
          fontFamily: f.sans,
          fontWeight: 500,
          fontSize: 11,
          fill: t.inkFaint,
          letterSpacing: 0.4,
        }}
      >
        /100
      </text>
    </svg>
  );
}

function Tick({ ok }: { ok: boolean }) {
  return (
    <span
      aria-label={ok ? "present" : "missing"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: 6,
        background: ok ? t.success100 : t.copper100,
        color: ok ? t.success : t.copper,
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {ok ? "✓" : "✗"}
    </span>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "gap" | "neutral";
}) {
  const fg = tone === "ok" ? t.success : tone === "gap" ? t.copper : t.inkSoft;
  const bg = tone === "ok" ? t.success100 : tone === "gap" ? t.copper100 : t.creamSoft;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.4,
        padding: "3px 8px",
        borderRadius: 999,
        background: bg,
        color: fg,
      }}
    >
      {label}
    </span>
  );
}

function Card({
  title,
  status,
  children,
}: {
  title: string;
  status?: { label: string; tone: "ok" | "gap" | "neutral" };
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 12,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: t.inkSoft,
          }}
        >
          {title}
        </div>
        {status && <StatusPill label={status.label} tone={status.tone} />}
      </div>
      {children}
    </div>
  );
}

/* ─── STAR matrix ─────────────────────────────────────────────────────── */

function StarMatrix({ rows }: { rows: BehavioralStarRow[] }) {
  const cols = ["S", "T", "A", "R"] as const;
  const rowName: Record<(typeof cols)[number], string> = {
    S: "Situation",
    T: "Task",
    A: "Action",
    R: "Result",
  };
  const counts: Record<(typeof cols)[number], number> = { S: 0, T: 0, A: 0, R: 0 };
  for (const row of rows) {
    if (row.s) counts.S += 1;
    if (row.t) counts.T += 1;
    if (row.a) counts.A += 1;
    if (row.r) counts.R += 1;
  }
  const totalPresent = counts.S + counts.T + counts.A + counts.R;
  const totalCells = rows.length * 4;
  const rowCoach: Record<(typeof cols)[number], string> = {
    S: `Set the scene fast; opened in ${counts.S}/${rows.length}.`,
    T: `Task framed in ${counts.T}/${rows.length}. Three seconds of framing fixes the misses.`,
    A: `Action in ${counts.A}/${rows.length}.`,
    R: `Result in ${counts.R}/${rows.length}. Quantify even soft outcomes.`,
  };

  return (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            color: t.coal,
            letterSpacing: -0.2,
          }}
        >
          STAR completeness across the round
        </h2>
        <span style={{ fontSize: 13, color: t.inkSoft }}>
          {totalPresent} / {totalCells} elements present
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `84px repeat(${rows.length}, minmax(0, 1fr)) 1.4fr`,
          gap: "10px 14px",
          alignItems: "center",
        }}
      >
        <div />
        {rows.map((row) => (
          <div
            key={row.questionId}
            title={row.topic}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: t.inkSoft,
              textAlign: "center",
              letterSpacing: 0.4,
            }}
          >
            {row.questionId}
          </div>
        ))}
        <div />
        {cols.map((k) => (
          <React.Fragment key={k}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: t.coal,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span>{rowName[k]}</span>
              <span style={{ fontSize: 11, color: t.inkFaint, fontWeight: 500 }}>
                {counts[k]}/{rows.length}
              </span>
            </div>
            {rows.map((row) => {
              const present =
                k === "S" ? row.s : k === "T" ? row.t : k === "A" ? row.a : row.r;
              return (
                <div
                  key={`${k}-${row.questionId}`}
                  style={{ display: "flex", justifyContent: "center" }}
                >
                  <Tick ok={present} />
                </div>
              );
            })}
            <div style={{ fontSize: 12.5, color: t.inkSoft, lineHeight: 1.45 }}>
              {rowCoach[k]}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ─── Delivery timeline ───────────────────────────────────────────────── */

function DeliveryTimeline({
  delivery,
}: {
  delivery: BehavioralFullReportData["delivery"];
}) {
  const colorFor = (tone: "crisp" | "hedged" | "ramble"): string =>
    tone === "crisp" ? t.success : tone === "hedged" ? t.warning : t.copper;
  const segs = delivery.segments;
  const widthPct = segs.length > 0 ? 100 / segs.length : 0;
  const counts = segs.reduce(
    (acc, s) => {
      acc[s.tone] += 1;
      return acc;
    },
    { crisp: 0, hedged: 0, ramble: 0 },
  );
  return (
    <Card title="Delivery rhythm" status={{ label: delivery.statusLabel, tone: delivery.statusTone }}>
      {segs.length > 0 ? (
        <div
          style={{
            display: "flex",
            height: 38,
            borderRadius: 8,
            overflow: "hidden",
            border: `1px solid ${t.line}`,
          }}
        >
          {segs.map((s) => (
            <div
              key={s.questionId}
              style={{
                width: `${widthPct}%`,
                background: colorFor(s.tone),
                color: t.white,
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title={`${s.questionId}: ${s.tone}`}
            >
              {s.questionId}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: t.inkSoft }}>
          Not enough substantive answers to chart delivery rhythm.
        </div>
      )}
      <div style={{ display: "flex", gap: 14, fontSize: 12, color: t.inkSoft, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: t.success }} /> crisp {counts.crisp}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: t.warning }} /> hedged {counts.hedged}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: t.copper }} /> rambling {counts.ramble}
        </span>
      </div>
      <div style={{ fontSize: 13, color: t.coal, lineHeight: 1.5 }}>{delivery.coachLine}</div>
    </Card>
  );
}

/* ─── Radar ───────────────────────────────────────────────────────────── */

function Radar({
  radar,
  isFirstSession,
}: {
  radar: BehavioralFullReportData["radar"];
  isFirstSession: boolean;
}) {
  const axes = radar.axes;
  const max = 10;
  const cx = 200;
  const cy = 200;
  const R = 150;
  const pt = (i: number, v: number): readonly [number, number] => {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    const r = (v / max) * R;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const poly = (vs: number[]): string =>
    vs.map((v, i) => pt(i, v).join(",")).join(" ");

  return (
    <Card
      title={`Competency strength · ${radar.track}`}
      status={{ label: radar.statusLabel, tone: radar.statusTone }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: 24, alignItems: "center" }}>
        <svg width={400} height={400} viewBox="0 0 400 400">
          {[0.25, 0.5, 0.75, 1].map((frac, idx) => (
            <polygon
              key={idx}
              points={axes.map((_, i) => pt(i, max * frac).join(",")).join(" ")}
              fill="none"
              stroke={t.line}
            />
          ))}
          {axes.map((_, i) => {
            const [x, y] = pt(i, max);
            return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={t.line} />;
          })}
          {/* Ghost polygon hidden on first-ever session per spec. */}
          {!isFirstSession && radar.prev && (
            <polygon
              points={poly(radar.prev)}
              fill="rgba(110,103,89,0.10)"
              stroke={t.lineStrong}
              strokeDasharray="4 3"
            />
          )}
          <polygon
            points={poly(radar.you)}
            fill={t.indigoTint}
            stroke={t.indigo}
            strokeWidth={2}
          />
          {axes.map((label, i) => {
            const [x, y] = pt(i, max + 0.8);
            return (
              <text
                key={label}
                x={x}
                y={y}
                textAnchor={x < cx - 4 ? "end" : x > cx + 4 ? "start" : "middle"}
                dominantBaseline={y < cy ? "auto" : "hanging"}
                style={{ fontFamily: f.sans, fontSize: 11, fontWeight: 600, fill: t.inkSoft }}
              >
                {label}
              </text>
            );
          })}
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: t.inkSoft, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 3, background: t.indigo, borderRadius: 2 }} /> this session
            </span>
            {!isFirstSession && radar.prev && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 14, height: 3, background: t.lineStrong, borderRadius: 2 }} /> prior baseline
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, color: t.coal, lineHeight: 1.5, fontWeight: 500 }}>
            {radar.summary}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {radar.ups.map((c) => (
              <span
                key={`up-${c}`}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: t.success100,
                  color: t.success,
                }}
              >
                ↑ {c}
              </span>
            ))}
            {radar.downs.map((c) => (
              <span
                key={`down-${c}`}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: t.copper100,
                  color: t.copper,
                }}
              >
                ↓ {c}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ─── Transcript row ──────────────────────────────────────────────────── */

function TranscriptRow({ row }: { row: BehavioralTranscriptRow }) {
  return (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 10,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: t.inkFaint,
          width: 28,
          letterSpacing: 0.4,
        }}
      >
        {row.questionId}
      </span>
      <span style={{ flex: 1, fontSize: 13.5, color: t.coal }}>{row.topic}</span>
      <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {row.pills.map((pill) => (
          <StatusPill key={pill.label} label={pill.label} tone={pill.tone} />
        ))}
      </span>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────── */

export default function BehavioralFullReport({
  data,
}: {
  data: BehavioralFullReportData;
}) {
  // Score-driven hero accent — copper on low scores, emerald on high,
  // default indigo otherwise. Paired with a label so it's never color-
  // only. The verdict still names one gap on the high branch (per spec
  // — "great rounds still surface the next thing to work on").
  const heroAccent: string =
    data.score < 40 ? t.copper : data.score > 85 ? t.success : t.indigo;
  const oneHabitBgAccent: string =
    data.score < 40 ? t.copper100 : data.score > 85 ? t.success100 : t.copper100;
  const oneHabitFgAccent: string =
    data.score < 40 ? t.copper : data.score > 85 ? t.success : t.copper;

  return (
    <div
      style={{
        fontFamily: f.sans,
        background: t.cream,
        color: t.coal,
        minHeight: "100vh",
        paddingBottom: 120,
      }}
    >
      {/* Persona ribbon */}
      <div
        style={{
          background: t.indigo,
          color: t.white,
          padding: "10px 40px",
          fontSize: 13,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span>
          You just interviewed with a <strong>{data.persona.voice}</strong> at a{" "}
          <strong>{data.persona.tier}</strong> · {data.persona.role}, {data.persona.lpaBand} band
        </span>
        <span style={{ opacity: 0.85, fontSize: 12 }}>
          Session {String(data.sessionMeta.number).padStart(2, "0")} · {data.sessionMeta.dateISO} ·{" "}
          {data.sessionMeta.durationMin}&nbsp;min · {data.sessionMeta.substantiveAnswers} substantive answers
        </span>
      </div>

      <div style={{ padding: "32px 40px 0", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Compact hero */}
        <div
          style={{
            background: t.white,
            border: `1px solid ${t.line}`,
            borderRadius: 16,
            padding: 24,
            display: "grid",
            gridTemplateColumns: "150px 1fr 360px",
            gap: 28,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <ScoreRing score={data.score} color={heroAccent} />
            {/* No delta chip on first-ever session — explicit edge state. */}
            {!data.isFirstSession && data.scoreDelta !== null && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: data.scoreDelta >= 0 ? t.success : t.copper,
                  background: data.scoreDelta >= 0 ? t.success100 : t.copper100,
                  padding: "3px 8px",
                  borderRadius: 999,
                }}
              >
                {data.scoreDelta >= 0 ? "▲" : "▼"} {Math.abs(data.scoreDelta)} vs last session
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: t.inkFaint }}>
              BEHAVIORAL VERDICT
            </span>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                lineHeight: 1.35,
                color: t.coal,
                letterSpacing: -0.3,
              }}
            >
              {data.verdict}
            </h1>
            <div
              style={{
                fontSize: 13,
                color: t.inkSoft,
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              {data.percentile !== null && (
                <>
                  <span>
                    {data.percentile}
                    {ordinalSuffix(data.percentile)} percentile · {data.track}
                  </span>
                  <span>·</span>
                </>
              )}
              <span>{data.persona.voice} confidence: {confidenceLabel(data.score)}</span>
            </div>
          </div>
          <div
            style={{
              background: oneHabitBgAccent,
              borderRadius: 12,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.2,
                color: oneHabitFgAccent,
              }}
            >
              ONE HABIT TO FIX
            </span>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.coal, lineHeight: 1.4 }}>
              {data.oneHabit.headline}
            </div>
            <div style={{ fontSize: 12.5, color: t.inkSoft, lineHeight: 1.5 }}>
              {data.oneHabit.rationale}
            </div>
          </div>
        </div>

        {/* STAR matrix or collapsed note */}
        {data.starBreakdown.length >= 3 ? (
          <StarMatrix rows={data.starBreakdown} />
        ) : (
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 12,
              padding: "14px 20px",
              fontSize: 13,
              color: t.inkSoft,
            }}
          >
            STAR matrix needs at least 3 substantive answers. This round had{" "}
            {data.starBreakdown.length}. Run a full round to see per-question
            structure.
          </div>
        )}

        {/* Three diagnostic cards — failure / conflict hidden when not asked */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              data.failure && data.conflict
                ? "1fr 1fr 1fr"
                : data.failure || data.conflict
                ? "1fr 1fr"
                : "1fr",
            gap: 20,
          }}
        >
          {data.failure && (
            <Card
              title="Failure story"
              status={{ label: data.failure.statusLabel, tone: data.failure.statusTone }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { k: "Ownership", v: data.failure.ownership, note: data.failure.ownershipNote },
                  { k: "Specific miss", v: data.failure.concreteMiss, note: data.failure.concreteMissNote },
                  { k: "Learning", v: data.failure.learning, note: data.failure.learningNote },
                ].map((row) => (
                  <div key={row.k} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Tick ok={row.v} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.coal }}>{row.k}</div>
                      <div style={{ fontSize: 12, color: t.inkSoft }}>{row.note}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  background: t.creamSoft,
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 12.5,
                  color: t.inkSoft,
                  lineHeight: 1.5,
                  fontStyle: "italic",
                }}
              >
                {data.failure.coachQuote}
              </div>
            </Card>
          )}

          {data.conflict && (
            <Card
              title="Conflict narration"
              status={{ label: data.conflict.statusLabel, tone: data.conflict.statusTone }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { n: data.conflict.asked, l: "Asked", color: t.coal },
                  { n: data.conflict.oneSided, l: "One-sided", color: t.copper },
                  { n: data.conflict.balanced, l: "Balanced", color: t.success },
                ].map((tile) => (
                  <div
                    key={tile.l}
                    style={{
                      background: t.creamSoft,
                      borderRadius: 8,
                      padding: "10px 12px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: tile.color,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {tile.n}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: t.inkSoft,
                        letterSpacing: 0.4,
                      }}
                    >
                      {tile.l}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 13, color: t.coal, lineHeight: 1.55 }}>
                {data.conflict.coachLine}
              </div>
              {data.conflict.jumpToQuestionIds.length > 0 && (
                <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
                  {data.conflict.jumpToQuestionIds.map((q) => (
                    <span
                      key={q}
                      style={{
                        color: t.indigo,
                        fontWeight: 600,
                        borderBottom: `1px dashed ${t.indigo}`,
                        paddingBottom: 1,
                      }}
                    >
                      Jump to {q}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          )}

          <DeliveryTimeline delivery={data.delivery} />
        </div>

        {/* Radar */}
        <Radar radar={data.radar} isFirstSession={data.isFirstSession} />

        {/* Evidence audit */}
        <Card
          title="Evidence quality"
          status={{ label: data.evidence.statusLabel, tone: data.evidence.statusTone }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, alignItems: "start" }}>
            <div style={{ display: "grid", gridTemplateRows: "repeat(3, auto)", gap: 8 }}>
              {[
                { l: "Metric claims", n: data.evidence.metricClaims, color: t.coal },
                { l: "Evidenced", n: data.evidence.evidenced, color: t.success },
                { l: "Floating", n: data.evidence.floating, color: t.copper },
              ].map((row) => (
                <div
                  key={row.l}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    paddingBottom: 8,
                    borderBottom: `1px solid ${t.line}`,
                  }}
                >
                  <span style={{ fontSize: 13, color: t.inkSoft }}>{row.l}</span>
                  <span
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: row.color,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {row.n}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.evidence.unevidencedQuotes.length > 0 ? (
                <>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: t.inkFaint,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                    }}
                  >
                    Your unevidenced quotes
                  </div>
                  <blockquote
                    style={{
                      margin: 0,
                      padding: "10px 14px",
                      borderLeft: `3px solid ${t.copper}`,
                      background: t.copper100,
                      fontStyle: "italic",
                      fontSize: 13.5,
                      color: t.coal,
                      lineHeight: 1.5,
                    }}
                  >
                    {data.evidence.unevidencedQuotes.map((q, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <br />}&ldquo;{q}&rdquo;
                      </React.Fragment>
                    ))}
                  </blockquote>
                </>
              ) : (
                <div style={{ fontSize: 13, color: t.inkSoft }}>
                  No floating claims this round.
                </div>
              )}
              <div style={{ fontSize: 13, color: t.coal, lineHeight: 1.5 }}>
                <strong>Fix-technique:</strong> {data.evidence.fixTechnique}
              </div>
            </div>
          </div>
        </Card>

        {/* AI accountability strip */}
        <div
          style={{
            background: t.creamSoft,
            border: `1px solid ${t.line}`,
            borderRadius: 10,
            padding: "12px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12.5,
            color: t.inkSoft,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span style={{ fontWeight: 600, color: t.coal }}>How hard the AI pushed you</span>
          <span style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <span>
              Depth probes{" "}
              <strong style={{ color: t.coal }}>{data.aiAccountability.depthProbes}</strong>
            </span>
            <span>
              Vague accepted{" "}
              <strong style={{ color: t.copper }}>{data.aiAccountability.vagueAccepted}</strong>
            </span>
            <span>
              Ownership probes{" "}
              <strong style={{ color: t.coal }}>{data.aiAccountability.ownershipProbes}</strong>
            </span>
            <span>
              Deflected{" "}
              <strong style={{ color: t.success }}>{data.aiAccountability.deflected}</strong>
            </span>
          </span>
        </div>

        {/* Transcript replay */}
        {data.transcript.length > 0 && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 12,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: t.coal }}>
                Transcript replay
              </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.transcript.map((row) => (
                <TranscriptRow key={row.questionId} row={row} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          background: t.white,
          borderTop: `1px solid ${t.line}`,
          padding: "14px 40px",
          marginTop: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 -8px 24px -16px rgba(15, 23, 42, 0.18)",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 13, color: t.inkSoft }}>{data.ctaSubcopy}</div>
        <button
          type="button"
          style={{
            background: t.indigo,
            color: t.white,
            border: "none",
            borderRadius: 10,
            padding: "12px 22px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {data.ctaPrimaryLabel}
        </button>
      </div>
    </div>
  );
}

/* ─── Small helpers ───────────────────────────────────────────────────── */

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function confidenceLabel(score: number): string {
  if (score >= 80) return "high";
  if (score >= 60) return "moderate";
  return "low";
}
