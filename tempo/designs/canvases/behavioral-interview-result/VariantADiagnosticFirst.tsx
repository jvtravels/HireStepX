/* Variant A — Diagnostic-first.
 * Clinical / analytical. Matrix + diagnostic cards lead; radar / evidence /
 * AI strip / transcript stack below. Compact hero so the data lands first. */

import * as React from "react";

const C = {
  indigo: "#4F46E5",
  indigoSoft: "#EEF0FF",
  emerald: "#10B981",
  emeraldSoft: "#ECFDF5",
  copper: "#EA580C",
  copperSoft: "#FFF1EA",
  slate900: "#0F172A",
  slate700: "#334155",
  slate500: "#64748B",
  slate300: "#CBD5E1",
  slate200: "#E2E8F0",
  slate100: "#F1F5F9",
  paper: "#FAFBFC",
  white: "#FFFFFF",
};

const FONT =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const QUESTIONS = [
  { q: "Q1", topic: "Failure: scaled rollout you'd take back" },
  { q: "Q2", topic: "Conflict: engineering wanted a different roadmap" },
  { q: "Q3", topic: "Influence: aligning two PMs on a shared metric" },
  { q: "Q4", topic: "Customer obsession: low-NPS segment recovery" },
  { q: "Q5", topic: "Conflict: design vs growth on a CTA copy fight" },
  { q: "Q6", topic: "Trade-off: shipping vs paying down tech debt" },
];

type Star = { s: boolean; t: boolean; a: boolean; r: boolean };
const STAR: Record<string, Star> = {
  Q1: { s: true, t: true, a: true, r: false },
  Q2: { s: true, t: false, a: true, r: false },
  Q3: { s: true, t: true, a: true, r: true },
  Q4: { s: true, t: true, a: true, r: false },
  Q5: { s: true, t: false, a: true, r: false },
  Q6: { s: true, t: true, a: true, r: true },
};

function ScoreRing({
  score,
  size = 132,
  stroke = 10,
  color = C.indigo,
}: {
  score: number;
  size?: number;
  stroke?: number;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.slate200} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dy="0.05em"
        dominantBaseline="middle"
        style={{
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: 38,
          fill: C.slate900,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        72
      </text>
      <text
        x="50%"
        y="72%"
        textAnchor="middle"
        style={{
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: 11,
          fill: C.slate500,
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
        background: ok ? C.emeraldSoft : C.copperSoft,
        color: ok ? C.emerald : C.copper,
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {ok ? "✓" : "✗"}
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
  const toneColor =
    status?.tone === "ok"
      ? C.emerald
      : status?.tone === "gap"
        ? C.copper
        : C.slate500;
  const toneBg =
    status?.tone === "ok"
      ? C.emeraldSoft
      : status?.tone === "gap"
        ? C.copperSoft
        : C.slate100;
  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${C.slate200}`,
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
            color: C.slate700,
          }}
        >
          {title}
        </div>
        {status && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.4,
              padding: "3px 8px",
              borderRadius: 999,
              background: toneBg,
              color: toneColor,
            }}
          >
            {status.label}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function StarMatrix() {
  const cols = ["S", "T", "A", "R"] as const;
  const rowCoach: Record<string, string> = {
    S: "Set the scene fast; you opened well across 6/6.",
    T: "Task skipped in 2/6 (33%). 3-second framing fixes this.",
    A: "Strong in 6/6: your default strength.",
    R: "Result missed in 4/6 (67%). Quantify even soft metrics.",
  };
  const rowName: Record<string, string> = {
    S: "Situation",
    T: "Task",
    A: "Action",
    R: "Result",
  };
  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${C.slate200}`,
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
            fontSize: 17,
            fontWeight: 600,
            color: C.slate900,
            letterSpacing: -0.2,
          }}
        >
          STAR completeness across the round
        </h2>
        <span style={{ fontSize: 13, color: C.slate500 }}>
          16 / 24 elements present
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "84px repeat(6, minmax(0, 1fr)) 1.4fr",
          gap: "10px 14px",
          alignItems: "center",
        }}
      >
        <div />
        {QUESTIONS.map((qq) => (
          <div
            key={qq.q}
            title={qq.topic}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: C.slate700,
              textAlign: "center",
              letterSpacing: 0.4,
            }}
          >
            {qq.q}
          </div>
        ))}
        <div />
        {cols.map((k) => {
          const counts = QUESTIONS.reduce(
            (a, q) => a + (STAR[q.q][k.toLowerCase() as keyof Star] ? 1 : 0),
            0,
          );
          return (
            <React.Fragment key={k}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.slate900,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <span>{rowName[k]}</span>
                <span style={{ fontSize: 11, color: C.slate500, fontWeight: 500 }}>
                  {counts}/6
                </span>
              </div>
              {QUESTIONS.map((qq) => (
                <div
                  key={`${k}-${qq.q}`}
                  style={{ display: "flex", justifyContent: "center" }}
                >
                  <Tick ok={STAR[qq.q][k.toLowerCase() as keyof Star]} />
                </div>
              ))}
              <div style={{ fontSize: 12.5, color: C.slate500, lineHeight: 1.45 }}>
                {rowCoach[k]}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function DeliveryTimeline() {
  const segs: { tone: "crisp" | "hedged" | "ramble"; label: string; w: number }[] = [
    { tone: "crisp", label: "Q1", w: 14 },
    { tone: "crisp", label: "Q2", w: 18 },
    { tone: "hedged", label: "Q3", w: 14 },
    { tone: "crisp", label: "Q4", w: 16 },
    { tone: "ramble", label: "Q5", w: 22 },
    { tone: "hedged", label: "Q6", w: 16 },
  ];
  const color = (t: "crisp" | "hedged" | "ramble") =>
    t === "crisp" ? C.emerald : t === "hedged" ? "#FBBF24" : C.copper;
  return (
    <Card title="Delivery rhythm" status={{ label: "Stamina gap", tone: "gap" }}>
      <div style={{ display: "flex", height: 38, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.slate200}` }}>
        {segs.map((s, i) => (
          <div
            key={i}
            style={{
              width: `${s.w}%`,
              background: color(s.tone),
              color: C.white,
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title={`${s.label}: ${s.tone}`}
          >
            {s.label}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 12, color: C.slate500 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: C.emerald }} /> crisp 3
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: "#FBBF24" }} /> hedged 2
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: C.copper }} /> rambling 1
        </span>
      </div>
      <div style={{ fontSize: 13, color: C.slate700, lineHeight: 1.5 }}>
        Crisp early, loose late. By Q5 your answers crossed 3 minutes; Bar-Raiser loses the thread past 90s. Compress S/T to 20s combined.
      </div>
    </Card>
  );
}

function Radar() {
  const axes = [
    "Customer obsession",
    "Ownership",
    "Stakeholder mgmt",
    "Data fluency",
    "Roadmap clarity",
    "Conflict navigation",
    "Outcome quantification",
  ];
  const you = [8.2, 7.4, 5.1, 7.0, 6.1, 4.2, 6.0];
  const prev = [6.8, 6.4, 5.6, 6.4, 5.8, 5.0, 5.5];
  const max = 10;
  const cx = 200;
  const cy = 200;
  const R = 150;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    const r = (v / max) * R;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const poly = (vs: number[]) => vs.map((v, i) => pt(i, v).join(",")).join(" ");
  return (
    <Card
      title="Competency strength · Indian Product track"
      status={{ label: "Conflict navigation cooling", tone: "gap" }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: 24, alignItems: "center" }}>
        <svg width={400} height={400} viewBox="0 0 400 400">
          {[0.25, 0.5, 0.75, 1].map((f, idx) => (
            <polygon
              key={idx}
              points={axes.map((_, i) => pt(i, max * f).join(",")).join(" ")}
              fill="none"
              stroke={C.slate200}
            />
          ))}
          {axes.map((_, i) => {
            const [x, y] = pt(i, max);
            return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={C.slate200} />;
          })}
          <polygon points={poly(prev)} fill="rgba(100,116,139,0.10)" stroke={C.slate300} strokeDasharray="4 3" />
          <polygon points={poly(you)} fill="rgba(79,70,229,0.18)" stroke={C.indigo} strokeWidth={2} />
          {axes.map((label, i) => {
            const [x, y] = pt(i, max + 0.8);
            return (
              <text
                key={label}
                x={x}
                y={y}
                textAnchor={x < cx - 4 ? "end" : x > cx + 4 ? "start" : "middle"}
                dominantBaseline={y < cy ? "auto" : "hanging"}
                style={{
                  fontFamily: FONT,
                  fontSize: 11,
                  fontWeight: 600,
                  fill: C.slate700,
                }}
              >
                {label}
              </text>
            );
          })}
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: C.slate500 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 3, background: C.indigo, borderRadius: 2 }} /> this session
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 3, background: C.slate300, borderRadius: 2 }} /> 3 weeks ago
            </span>
          </div>
          <div style={{ fontSize: 14, color: C.slate900, lineHeight: 1.5, fontWeight: 500 }}>
            Customer obsession + ownership grew; conflict navigation dropped 0.8 points. Track-anchor: Indian Product rubric weighs conflict ≥ 18%.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {["Customer obsession", "Ownership", "Data fluency"].map((c) => (
              <span
                key={c}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: C.emeraldSoft,
                  color: C.emerald,
                }}
              >
                ↑ {c}
              </span>
            ))}
            {["Conflict navigation", "Stakeholder mgmt"].map((c) => (
              <span
                key={c}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: C.copperSoft,
                  color: C.copper,
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

export function VariantADiagnosticFirst() {
  return (
    <div
      style={{
        fontFamily: FONT,
        background: C.paper,
        color: C.slate900,
        minHeight: 2400,
        padding: "0 0 120px",
      }}
    >
      {/* Persona ribbon */}
      <div
        style={{
          background: C.indigo,
          color: C.white,
          padding: "10px 40px",
          fontSize: 13,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>
          You just interviewed with a <strong>Hiring Manager</strong> at a{" "}
          <strong>Razorpay-tier fintech</strong> · Senior PM, ₹38&nbsp;LPA band
        </span>
        <span style={{ opacity: 0.85, fontSize: 12 }}>
          Session 04 · 02 June 2026 · 28&nbsp;min · 6 substantive answers
        </span>
      </div>

      <div style={{ padding: "32px 40px 0", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Compact hero — diagnostic-first */}
        <div
          style={{
            background: C.white,
            border: `1px solid ${C.slate200}`,
            borderRadius: 16,
            padding: 24,
            display: "grid",
            gridTemplateColumns: "150px 1fr 360px",
            gap: 28,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <ScoreRing score={72} />
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.emerald,
                background: C.emeraldSoft,
                padding: "3px 8px",
                borderRadius: 999,
              }}
            >
              ▲ +8 vs last session
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: C.slate500 }}>
              BEHAVIORAL VERDICT
            </span>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                lineHeight: 1.35,
                color: C.slate900,
                letterSpacing: -0.3,
                maxWidth: 36,
                width: "32ch",
              }}
            >
              Owns failures, names competencies, narrates conflicts one-sided.
            </h1>
            <div style={{ fontSize: 13, color: C.slate500, display: "flex", gap: 14, flexWrap: "wrap" }}>
              <span>62nd percentile · Indian Product track</span>
              <span>·</span>
              <span>Bar-Raiser confidence: moderate</span>
            </div>
          </div>
          <div
            style={{
              background: C.copperSoft,
              borderRadius: 12,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: C.copper }}>
              ONE HABIT TO FIX
            </span>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.slate900, lineHeight: 1.4 }}>
              Name the counterparty's view first.
            </div>
            <div style={{ fontSize: 12.5, color: C.slate700, lineHeight: 1.5 }}>
              In Q2 and Q5 you skipped what engineering / design wanted before what you did. Bar-Raiser expects that frame inside the first 15 seconds.
            </div>
            <button
              style={{
                marginTop: 4,
                background: C.copper,
                color: C.white,
                border: "none",
                borderRadius: 8,
                padding: "9px 14px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                alignSelf: "flex-start",
              }}
            >
              Practice this pattern →
            </button>
          </div>
        </div>

        {/* STAR matrix — top billing for diagnostic-first */}
        <StarMatrix />

        {/* Three diagnostic cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
          <Card title="Failure story" status={{ label: "Owns, not specific", tone: "gap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { k: "Ownership", v: true, note: "'My call, not the team's'" },
                { k: "Specific miss", v: false, note: "Named 'an edge case' only" },
                { k: "Learning", v: true, note: "Drew a clear forward principle" },
              ].map((row) => (
                <div key={row.k} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Tick ok={row.v} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.slate900 }}>{row.k}</div>
                    <div style={{ fontSize: 12, color: C.slate500 }}>{row.note}</div>
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                background: C.slate100,
                borderRadius: 8,
                padding: 12,
                fontSize: 12.5,
                color: C.slate700,
                lineHeight: 1.5,
                fontStyle: "italic",
              }}
            >
              "I missed an edge case" reads as hindsight theatre. Try: "I underestimated the rollback path on the migration; we sat in a 40-minute outage."
            </div>
          </Card>

          <Card title="Conflict narration" status={{ label: "One-sided 2/2", tone: "gap" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { n: 2, l: "Asked", tone: C.slate900 },
                { n: 2, l: "One-sided", tone: C.copper },
                { n: 0, l: "Balanced", tone: C.slate500 },
              ].map((s) => (
                <div
                  key={s.l}
                  style={{
                    background: C.slate100,
                    borderRadius: 8,
                    padding: "10px 12px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.tone, fontVariantNumeric: "tabular-nums" }}>
                    {s.n}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.slate500, letterSpacing: 0.4 }}>
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, color: C.slate700, lineHeight: 1.55 }}>
              Name what <em>they</em> wanted before what you did. Indian HM hears the counterparty frame first or marks you down on stakeholder savvy.
            </div>
            <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
              {["Jump to Q2", "Jump to Q5"].map((j) => (
                <span
                  key={j}
                  style={{
                    color: C.indigo,
                    fontWeight: 600,
                    borderBottom: `1px dashed ${C.indigo}`,
                    paddingBottom: 1,
                    cursor: "pointer",
                  }}
                >
                  {j}
                </span>
              ))}
            </div>
          </Card>

          <DeliveryTimeline />
        </div>

        {/* Radar */}
        <Radar />

        {/* Evidence-quality audit */}
        <Card
          title="Evidence quality"
          status={{ label: "2 floating claims", tone: "gap" }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, alignItems: "start" }}>
            <div
              style={{
                display: "grid",
                gridTemplateRows: "repeat(3, auto)",
                gap: 8,
              }}
            >
              {[
                { l: "Metric claims", n: 3, tone: C.slate900 },
                { l: "Evidenced", n: 1, tone: C.emerald },
                { l: "Floating", n: 2, tone: C.copper },
              ].map((r) => (
                <div
                  key={r.l}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    paddingBottom: 8,
                    borderBottom: `1px solid ${C.slate200}`,
                  }}
                >
                  <span style={{ fontSize: 13, color: C.slate700 }}>{r.l}</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: r.tone, fontVariantNumeric: "tabular-nums" }}>
                    {r.n}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.slate500, letterSpacing: 0.4, textTransform: "uppercase" }}>
                Your unevidenced quotes
              </div>
              <blockquote
                style={{
                  margin: 0,
                  padding: "10px 14px",
                  borderLeft: `3px solid ${C.copper}`,
                  background: C.copperSoft,
                  fontStyle: "italic",
                  fontSize: 13.5,
                  color: C.slate900,
                  lineHeight: 1.5,
                }}
              >
                "We moved the needle on activation; conversion improved meaningfully."
                <br />
                "Roughly tripled the weekly engaged user count, I think."
              </blockquote>
              <div style={{ fontSize: 13, color: C.slate700, lineHeight: 1.5 }}>
                Fix-technique: <strong>anchor before percent</strong>. "From 8.4% to 11.1% activation in the 30-day window after the redesign." Bar-Raisers stop probing once the anchor lands.
              </div>
            </div>
          </div>
        </Card>

        {/* AI accountability strip */}
        <div
          style={{
            background: C.slate100,
            border: `1px solid ${C.slate200}`,
            borderRadius: 10,
            padding: "12px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12.5,
            color: C.slate700,
          }}
        >
          <span style={{ fontWeight: 600, color: C.slate900 }}>
            How hard the AI pushed you
          </span>
          <span style={{ display: "flex", gap: 18 }}>
            <span>Depth probes <strong style={{ color: C.slate900 }}>3</strong></span>
            <span>Vague accepted <strong style={{ color: C.copper }}>1</strong></span>
            <span>Ownership probes <strong style={{ color: C.slate900 }}>2</strong></span>
            <span>Deflected <strong style={{ color: C.emerald }}>0</strong></span>
          </span>
        </div>

        {/* Transcript replay — collapsed */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: C.slate900 }}>
              Transcript replay
            </h2>
            <span style={{ fontSize: 12, color: C.slate500, cursor: "pointer", fontWeight: 500 }}>
              expand all
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {QUESTIONS.map((qq, i) => {
              const pills = [
                i === 0 ? { l: "✓ ownership", tone: "ok" as const } : null,
                i === 1 || i === 4 ? { l: "✗ counterparty POV", tone: "gap" as const } : null,
                i === 2 ? { l: "⚠ rehearsed open", tone: "neutral" as const } : null,
                i === 4 ? { l: "✗ result missing", tone: "gap" as const } : null,
                STAR[qq.q].r ? { l: "✓ quantified", tone: "ok" as const } : null,
              ].filter((p): p is { l: string; tone: "ok" | "gap" | "neutral" } => Boolean(p));
              return (
                <div
                  key={qq.q}
                  style={{
                    background: C.white,
                    border: `1px solid ${C.slate200}`,
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
                      color: C.slate500,
                      width: 28,
                      letterSpacing: 0.4,
                    }}
                  >
                    {qq.q}
                  </span>
                  <span style={{ flex: 1, fontSize: 13.5, color: C.slate900 }}>{qq.topic}</span>
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {pills.map((p) => {
                      const bg =
                        p.tone === "ok" ? C.emeraldSoft : p.tone === "gap" ? C.copperSoft : C.slate100;
                      const fg =
                        p.tone === "ok" ? C.emerald : p.tone === "gap" ? C.copper : C.slate700;
                      return (
                        <span
                          key={p.l}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: bg,
                            color: fg,
                          }}
                        >
                          {p.l}
                        </span>
                      );
                    })}
                  </span>
                  <span style={{ color: C.slate300, fontSize: 18, fontWeight: 400 }}>›</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky footer CTA */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          background: C.white,
          borderTop: `1px solid ${C.slate200}`,
          padding: "14px 40px",
          marginTop: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 -8px 24px -16px rgba(15, 23, 42, 0.18)",
        }}
      >
        <div style={{ fontSize: 13, color: C.slate500 }}>
          Next session biased toward <strong style={{ color: C.slate900 }}>conflict counterparty-POV</strong>. Practice when you have 25 quiet minutes.
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: C.slate500, cursor: "pointer" }}>more</span>
          <button
            style={{
              background: C.indigo,
              color: C.white,
              border: "none",
              borderRadius: 10,
              padding: "12px 22px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Start next session
          </button>
        </div>
      </div>
    </div>
  );
}

export default VariantADiagnosticFirst;
