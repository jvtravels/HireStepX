/* Variant B — Hero-first.
 * Outcome-celebratory but NOT the SaaS hero-metric cliché. We commit to
 * an indigo-drenched hero band with a serif verdict treatment, then the
 * diagnostic body follows in a calmer page. */

import * as React from "react";

const C = {
  indigo: "#4F46E5",
  indigoDeep: "#3730A3",
  indigoSoft: "#EEF0FF",
  emerald: "#10B981",
  emeraldSoft: "#ECFDF5",
  copper: "#EA580C",
  copperSoft: "#FFF1EA",
  slate900: "#0F172A",
  slate800: "#1E293B",
  slate700: "#334155",
  slate500: "#64748B",
  slate300: "#CBD5E1",
  slate200: "#E2E8F0",
  slate100: "#F1F5F9",
  paper: "#F8F9FC",
  white: "#FFFFFF",
};
const FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const SERIF = "'Instrument Serif', 'Source Serif Pro', Georgia, serif";

const QUESTIONS = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"];
type Star = { s: boolean; t: boolean; a: boolean; r: boolean };
const STAR: Record<string, Star> = {
  Q1: { s: true, t: true, a: true, r: false },
  Q2: { s: true, t: false, a: true, r: false },
  Q3: { s: true, t: true, a: true, r: true },
  Q4: { s: true, t: true, a: true, r: false },
  Q5: { s: true, t: false, a: true, r: false },
  Q6: { s: true, t: true, a: true, r: true },
};

function Tick({ ok, size = 22 }: { ok: boolean; size?: number }) {
  return (
    <span
      aria-label={ok ? "present" : "missing"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 6,
        background: ok ? C.emeraldSoft : C.copperSoft,
        color: ok ? C.emerald : C.copper,
        fontSize: size * 0.6,
        fontWeight: 700,
      }}
    >
      {ok ? "✓" : "✗"}
    </span>
  );
}

function BigRing({ score }: { score: number }) {
  const size = 280;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={C.white}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="49%"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontFamily: SERIF,
          fontSize: 110,
          fill: C.white,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: -2,
        }}
      >
        {score}
      </text>
      <text
        x="50%"
        y="76%"
        textAnchor="middle"
        style={{
          fontFamily: FONT,
          fontSize: 12,
          fill: "rgba(255,255,255,0.7)",
          letterSpacing: 2,
          fontWeight: 600,
        }}
      >
        OUT OF 100
      </text>
    </svg>
  );
}

function Card({
  title,
  status,
  children,
  pad = 22,
}: {
  title: string;
  status?: { label: string; tone: "ok" | "gap" | "neutral" };
  children: React.ReactNode;
  pad?: number;
}) {
  const fg =
    status?.tone === "ok"
      ? C.emerald
      : status?.tone === "gap"
        ? C.copper
        : C.slate500;
  const bg =
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
        borderRadius: 14,
        padding: pad,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
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
              padding: "3px 8px",
              borderRadius: 999,
              background: bg,
              color: fg,
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

export function VariantBHeroFirst() {
  return (
    <div style={{ fontFamily: FONT, background: C.paper, color: C.slate900, minHeight: 2400 }}>
      {/* Persona ribbon */}
      <div
        style={{
          background: C.indigoDeep,
          color: C.white,
          padding: "10px 48px",
          fontSize: 13,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>
          Interviewed by a <strong>Hiring Manager</strong> · Razorpay-tier fintech · Senior PM, ₹38&nbsp;LPA band
        </span>
        <span style={{ opacity: 0.85 }}>Session 04 · 02 Jun · 28 min</span>
      </div>

      {/* Drenched indigo hero */}
      <div
        style={{
          background: `linear-gradient(180deg, ${C.indigo} 0%, ${C.indigoDeep} 100%)`,
          color: C.white,
          padding: "56px 48px 64px",
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 56,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <BigRing score={72} />
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.white,
              background: "rgba(255,255,255,0.16)",
              padding: "6px 14px",
              borderRadius: 999,
            }}
          >
            ▲ +8 vs your last session
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", letterSpacing: 0.4 }}>
            62nd percentile, Indian Product track
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: "rgba(255,255,255,0.7)", marginBottom: 14 }}>
              BEHAVIORAL VERDICT
            </div>
            <h1
              style={{
                margin: 0,
                fontFamily: SERIF,
                fontSize: 56,
                fontWeight: 400,
                lineHeight: 1.08,
                letterSpacing: -1.4,
                maxWidth: "20ch",
              }}
            >
              You own failures, name competencies, narrate conflicts one-sided.
            </h1>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.10)",
              borderRadius: 14,
              padding: "20px 24px",
              border: "1px solid rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "flex-start",
              gap: 20,
            }}
          >
            <div
              style={{
                background: C.copper,
                color: C.white,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.2,
                padding: "5px 9px",
                borderRadius: 6,
                whiteSpace: "nowrap",
              }}
            >
              ONE HABIT
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.3, marginBottom: 6 }}>
                Name the counterparty's view first.
              </div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.78)", lineHeight: 1.55 }}>
                In Q2 and Q5 you skipped what engineering wanted before what you did. Bar-Raiser expects that frame inside 15 seconds.
              </div>
            </div>
            <button
              style={{
                background: C.white,
                color: C.indigoDeep,
                border: "none",
                borderRadius: 10,
                padding: "11px 18px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Practice this →
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "36px 48px 120px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* STAR matrix */}
        <Card title="STAR completeness" status={{ label: "16/24 elements", tone: "neutral" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "92px repeat(6, minmax(0, 1fr)) 1.4fr",
              gap: "10px 14px",
              alignItems: "center",
              marginTop: 4,
            }}
          >
            <div />
            {QUESTIONS.map((q) => (
              <div key={q} style={{ fontSize: 12, fontWeight: 700, color: C.slate700, textAlign: "center" }}>
                {q}
              </div>
            ))}
            <div />
            {(["S", "T", "A", "R"] as const).map((k) => {
              const fullName = { S: "Situation", T: "Task", A: "Action", R: "Result" }[k];
              const coach = {
                S: "Strong opening across the round.",
                T: "Skipped twice; 3-second frame fixes it.",
                A: "Default strength.",
                R: "Missed 4 of 6; quantify even soft.",
              }[k];
              return (
                <React.Fragment key={k}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.slate900 }}>{fullName}</div>
                  {QUESTIONS.map((q) => (
                    <div key={`${k}-${q}`} style={{ display: "flex", justifyContent: "center" }}>
                      <Tick ok={STAR[q][k.toLowerCase() as keyof Star]} />
                    </div>
                  ))}
                  <div style={{ fontSize: 12.5, color: C.slate500, lineHeight: 1.5 }}>{coach}</div>
                </React.Fragment>
              );
            })}
          </div>
        </Card>

        {/* Three cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr 1.05fr", gap: 20 }}>
          <Card title="Failure story" status={{ label: "Owns, vague", tone: "gap" }}>
            {[
              { k: "Ownership", v: true, note: "Said 'my call', not 'we'" },
              { k: "Specific miss", v: false, note: "'An edge case' only" },
              { k: "Learning", v: true, note: "Clear forward principle" },
            ].map((r) => (
              <div key={r.k} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Tick ok={r.v} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.k}</div>
                  <div style={{ fontSize: 12, color: C.slate500 }}>{r.note}</div>
                </div>
              </div>
            ))}
            <div
              style={{
                background: C.slate100,
                borderRadius: 8,
                padding: 12,
                fontSize: 12.5,
                color: C.slate700,
                fontStyle: "italic",
                lineHeight: 1.5,
              }}
            >
              "I missed an edge case" reads as hindsight theatre. Try: "I underestimated the rollback path; we sat in a 40-minute outage."
            </div>
          </Card>

          <Card title="Conflict narration" status={{ label: "0/2 balanced", tone: "gap" }}>
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { n: 2, l: "Asked", c: C.slate900 },
                { n: 2, l: "One-sided", c: C.copper },
                { n: 0, l: "Balanced", c: C.slate500 },
              ].map((s) => (
                <div key={s.l} style={{ flex: 1, background: C.slate100, borderRadius: 8, padding: "12px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: s.c, fontVariantNumeric: "tabular-nums" }}>
                    {s.n}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.slate500, letterSpacing: 0.4 }}>
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, color: C.slate700, lineHeight: 1.55 }}>
              Name what <em>they</em> wanted before what you did. Indian HMs mark you down on stakeholder savvy when the counterparty frame is missing.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {["Jump to Q2", "Jump to Q5"].map((j) => (
                <span
                  key={j}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.indigo,
                    borderBottom: `1px dashed ${C.indigo}`,
                    cursor: "pointer",
                  }}
                >
                  {j}
                </span>
              ))}
            </div>
          </Card>

          <Card title="Delivery rhythm" status={{ label: "Stamina gap", tone: "gap" }}>
            <div style={{ display: "flex", height: 36, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.slate200}` }}>
              {[
                { t: "crisp", w: 14, l: "Q1" },
                { t: "crisp", w: 18, l: "Q2" },
                { t: "hedged", w: 14, l: "Q3" },
                { t: "crisp", w: 16, l: "Q4" },
                { t: "ramble", w: 22, l: "Q5" },
                { t: "hedged", w: 16, l: "Q6" },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    width: `${s.w}%`,
                    background: s.t === "crisp" ? C.emerald : s.t === "hedged" ? "#FBBF24" : C.copper,
                    color: C.white,
                    fontSize: 11,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {s.l}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: C.slate500, display: "flex", gap: 12 }}>
              <span>● crisp 3</span>
              <span style={{ color: "#B45309" }}>● hedged 2</span>
              <span style={{ color: C.copper }}>● rambling 1</span>
            </div>
            <div style={{ fontSize: 13, color: C.slate700, lineHeight: 1.55 }}>
              Crisp early, loose late. By Q5 you crossed 3 minutes; Bar-Raiser loses the thread past 90s. Compress S/T to 20s.
            </div>
          </Card>
        </div>

        {/* Radar + Evidence in a row */}
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 }}>
          <Card title="Competency radar · Indian Product track" status={{ label: "Conflict cooling", tone: "gap" }}>
            <RadarSvg />
          </Card>
          <Card title="Evidence quality" status={{ label: "2 floating", tone: "gap" }}>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 10, borderBottom: `1px solid ${C.slate200}` }}>
              <span style={{ fontSize: 13, color: C.slate700 }}>Metric claims</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: C.slate900, fontVariantNumeric: "tabular-nums" }}>3</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 10, borderBottom: `1px solid ${C.slate200}` }}>
              <span style={{ fontSize: 13, color: C.slate700 }}>Evidenced</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: C.emerald, fontVariantNumeric: "tabular-nums" }}>1</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: C.slate700 }}>Floating</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: C.copper, fontVariantNumeric: "tabular-nums" }}>2</span>
            </div>
            <blockquote
              style={{
                margin: 0,
                padding: "10px 12px",
                background: C.copperSoft,
                fontStyle: "italic",
                fontSize: 13,
                color: C.slate900,
                lineHeight: 1.5,
                borderRadius: 6,
              }}
            >
              "Roughly tripled the weekly engaged user count, I think."
            </blockquote>
            <div style={{ fontSize: 12.5, color: C.slate700, lineHeight: 1.5 }}>
              Fix-technique: <strong>anchor before percent</strong>. "From 8.4% to 11.1% in the 30 days after launch."
            </div>
          </Card>
        </div>

        {/* AI accountability */}
        <div
          style={{
            background: C.slate100,
            border: `1px solid ${C.slate200}`,
            borderRadius: 10,
            padding: "12px 18px",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12.5,
            color: C.slate700,
          }}
        >
          <span style={{ fontWeight: 600, color: C.slate900 }}>How hard the AI pushed you</span>
          <span style={{ display: "flex", gap: 20 }}>
            <span>Depth probes <strong style={{ color: C.slate900 }}>3</strong></span>
            <span>Vague accepted <strong style={{ color: C.copper }}>1</strong></span>
            <span>Ownership probes <strong style={{ color: C.slate900 }}>2</strong></span>
            <span>Deflected <strong style={{ color: C.emerald }}>0</strong></span>
          </span>
        </div>

        {/* Transcript replay */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Transcript replay</h2>
            <span style={{ fontSize: 12, color: C.slate500, fontWeight: 500 }}>expand all</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { q: "Q1", t: "Failure: scaled rollout you'd take back", pills: ["✓ ownership"] },
              { q: "Q2", t: "Conflict: engineering wanted a different roadmap", pills: ["✗ counterparty POV", "✗ result"] },
              { q: "Q3", t: "Influence: aligning two PMs on a shared metric", pills: ["✓ quantified", "⚠ rehearsed open"] },
              { q: "Q4", t: "Customer obsession: low-NPS segment recovery", pills: ["✓ specific", "✗ result"] },
              { q: "Q5", t: "Conflict: design vs growth on a CTA fight", pills: ["✗ counterparty POV", "✗ result", "⚠ rambling"] },
              { q: "Q6", t: "Trade-off: shipping vs paying down tech debt", pills: ["✓ quantified"] },
            ].map((r) => (
              <div
                key={r.q}
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
                <span style={{ fontSize: 12, fontWeight: 700, color: C.slate500, width: 28 }}>{r.q}</span>
                <span style={{ flex: 1, fontSize: 13.5, color: C.slate900 }}>{r.t}</span>
                <span style={{ display: "flex", gap: 6 }}>
                  {r.pills.map((p) => {
                    const ok = p.startsWith("✓");
                    const warn = p.startsWith("⚠");
                    const bg = ok ? C.emeraldSoft : warn ? C.slate100 : C.copperSoft;
                    const fg = ok ? C.emerald : warn ? C.slate700 : C.copper;
                    return (
                      <span
                        key={p}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: bg,
                          color: fg,
                        }}
                      >
                        {p}
                      </span>
                    );
                  })}
                </span>
                <span style={{ color: C.slate300, fontSize: 18 }}>›</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          background: C.white,
          borderTop: `1px solid ${C.slate200}`,
          padding: "14px 48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 -10px 30px -16px rgba(15,23,42,0.18)",
        }}
      >
        <div style={{ fontSize: 13, color: C.slate500 }}>
          Next session biased toward <strong style={{ color: C.slate900 }}>conflict counterparty-POV</strong>.
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

function RadarSvg() {
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
  const cx = 200,
    cy = 200,
    R = 150;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    const r = (v / max) * R;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: 24, alignItems: "center" }}>
      <svg width={400} height={400} viewBox="0 0 400 400">
        {[0.25, 0.5, 0.75, 1].map((f, i) => (
          <polygon
            key={i}
            points={axes.map((_, j) => pt(j, max * f).join(",")).join(" ")}
            fill="none"
            stroke={C.slate200}
          />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, max);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={C.slate200} />;
        })}
        <polygon points={prev.map((v, i) => pt(i, v).join(",")).join(" ")} fill="rgba(100,116,139,0.10)" stroke={C.slate300} strokeDasharray="4 3" />
        <polygon points={you.map((v, i) => pt(i, v).join(",")).join(" ")} fill="rgba(79,70,229,0.20)" stroke={C.indigo} strokeWidth={2} />
        {axes.map((label, i) => {
          const [x, y] = pt(i, max + 0.8);
          return (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor={x < cx - 4 ? "end" : x > cx + 4 ? "start" : "middle"}
              dominantBaseline={y < cy ? "auto" : "hanging"}
              style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, fill: C.slate700 }}
            >
              {label}
            </text>
          );
        })}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: C.slate500 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 3, background: C.indigo }} /> this session
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 3, background: C.slate300 }} /> 3 weeks ago
          </span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.slate900, lineHeight: 1.5 }}>
          Customer obsession and ownership grew; conflict navigation dropped 0.8. Indian Product rubric weighs conflict ≥ 18%.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          {["Customer obsession", "Ownership", "Data fluency"].map((c) => (
            <span key={c} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: C.emeraldSoft, color: C.emerald }}>
              ↑ {c}
            </span>
          ))}
          {["Conflict navigation", "Stakeholder mgmt"].map((c) => (
            <span key={c} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: C.copperSoft, color: C.copper }}>
              ↓ {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default VariantBHeroFirst;
