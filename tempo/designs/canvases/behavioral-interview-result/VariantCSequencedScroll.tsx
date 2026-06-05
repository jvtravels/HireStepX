/* Variant C — Sequenced single-column scroll.
 * Focused, coachy. Each region a full-bleed band, progressive narrative.
 * Mobile-first 760-wide, no 2-col anywhere. */

import * as React from "react";

const C = {
  indigo: "#4F46E5",
  indigoDeep: "#3730A3",
  indigoSoft: "#EEF0FF",
  emerald: "#10B981",
  emeraldSoft: "#ECFDF5",
  copper: "#EA580C",
  copperSoft: "#FFF1EA",
  amber: "#FBBF24",
  slate900: "#0F172A",
  slate800: "#1E293B",
  slate700: "#334155",
  slate500: "#64748B",
  slate400: "#94A3B8",
  slate300: "#CBD5E1",
  slate200: "#E2E8F0",
  slate100: "#F1F5F9",
  paper: "#FAFAFB",
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

function SectionMarker({ n, label }: { n: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <div
        style={{
          fontFamily: SERIF,
          fontSize: 28,
          color: C.indigo,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {n}
      </div>
      <div style={{ flex: 1, height: 1, background: C.slate200 }} />
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 2,
          color: C.slate500,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function VariantCSequencedScroll() {
  return (
    <div style={{ fontFamily: FONT, background: C.paper, color: C.slate900, minHeight: 3200 }}>
      {/* Persona ribbon */}
      <div
        style={{
          background: C.indigoDeep,
          color: C.white,
          padding: "12px 28px",
          fontSize: 12,
          fontWeight: 500,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span>
          Just interviewed with a <strong>Hiring Manager</strong> · Razorpay-tier fintech · Senior PM, ₹38&nbsp;LPA
        </span>
        <span style={{ opacity: 0.75, fontSize: 11 }}>Session 04 · 02 Jun · 28 min · 6 substantive answers</span>
      </div>

      {/* 1. Verdict — full-bleed cream band */}
      <div
        style={{
          background: "linear-gradient(180deg, #FBF7EE 0%, #F8F4E8 100%)",
          padding: "48px 28px 56px",
          borderBottom: `1px solid ${C.slate200}`,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: C.copper, marginBottom: 18 }}>
          BEHAVIORAL VERDICT · SESSION 04
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontSize: 42,
            fontWeight: 400,
            lineHeight: 1.12,
            letterSpacing: -1.1,
            color: C.slate900,
          }}
        >
          You own failures, name competencies, and narrate conflicts one-sided.
        </h1>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 28 }}>
          <span
            style={{
              fontFamily: SERIF,
              fontSize: 92,
              lineHeight: 1,
              color: C.slate900,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: -2,
            }}
          >
            72
          </span>
          <span style={{ fontSize: 16, color: C.slate500 }}>/ 100</span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.emerald,
              background: C.emeraldSoft,
              padding: "5px 12px",
              borderRadius: 999,
              marginLeft: "auto",
            }}
          >
            ▲ +8 vs last session
          </span>
        </div>
        <div style={{ fontSize: 13, color: C.slate500, marginTop: 8 }}>
          62nd percentile · Indian Product track · Bar-Raiser confidence: moderate
        </div>
      </div>

      <div style={{ padding: "0 28px" }}>
        {/* 2. One habit */}
        <div style={{ padding: "44px 0 32px" }}>
          <SectionMarker n="01" label="Your one habit to fix" />
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.slate200}`,
              borderRadius: 14,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: C.copper }}>
              CONFLICT COUNTERPARTY-POV
            </div>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 30,
                lineHeight: 1.2,
                color: C.slate900,
                letterSpacing: -0.6,
              }}
            >
              Name the counterparty's view first.
            </div>
            <div style={{ fontSize: 14, color: C.slate700, lineHeight: 1.6 }}>
              In Q2 (engineering roadmap) and Q5 (design vs growth) you described what you wanted before what they wanted. Bar-Raiser expects the counterparty frame inside the first 15 seconds. Indian HMs read its absence as low stakeholder savvy, even when your outcome was strong.
            </div>
            <button
              style={{
                marginTop: 6,
                alignSelf: "flex-start",
                background: C.copper,
                color: C.white,
                border: "none",
                borderRadius: 10,
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Practice this pattern →
            </button>
          </div>
        </div>

        {/* 3. STAR matrix */}
        <div style={{ padding: "12px 0 32px" }}>
          <SectionMarker n="02" label="STAR completeness across the round" />
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.slate200}`,
              borderRadius: 14,
              padding: 20,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "76px repeat(6, 1fr)",
                gap: "8px 6px",
                alignItems: "center",
              }}
            >
              <div />
              {QUESTIONS.map((q) => (
                <div key={q} style={{ fontSize: 11, fontWeight: 700, color: C.slate700, textAlign: "center" }}>
                  {q}
                </div>
              ))}
              {(["S", "T", "A", "R"] as const).map((k) => {
                const fullName = { S: "Situation", T: "Task", A: "Action", R: "Result" }[k];
                return (
                  <React.Fragment key={k}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: C.slate900 }}>{fullName}</div>
                    {QUESTIONS.map((q) => (
                      <div key={`${k}-${q}`} style={{ display: "flex", justifyContent: "center" }}>
                        <Tick ok={STAR[q][k.toLowerCase() as keyof Star]} size={20} />
                      </div>
                    ))}
                  </React.Fragment>
                );
              })}
            </div>
            <div
              style={{
                marginTop: 16,
                fontSize: 13,
                color: C.slate700,
                lineHeight: 1.55,
                paddingTop: 14,
                borderTop: `1px solid ${C.slate200}`,
              }}
            >
              <strong style={{ color: C.slate900 }}>Result missed in 4 of 6 (67%).</strong> Quantify the close even on soft metrics; Bar-Raiser hears "no number, no outcome."
            </div>
          </div>
        </div>

        {/* 4. Failure */}
        <div style={{ padding: "12px 0 32px" }}>
          <SectionMarker n="03" label="Failure story" />
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.slate200}`,
              borderRadius: 14,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", gap: 18 }}>
              {[
                { k: "Ownership", v: true },
                { k: "Specific", v: false },
                { k: "Learning", v: true },
              ].map((r) => (
                <div key={r.k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
                  <Tick ok={r.v} size={28} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.slate900 }}>{r.k}</span>
                </div>
              ))}
            </div>
            <blockquote
              style={{
                margin: 0,
                padding: "12px 16px",
                background: C.slate100,
                fontStyle: "italic",
                fontSize: 14,
                color: C.slate900,
                lineHeight: 1.55,
                borderRadius: 8,
              }}
            >
              "I missed an edge case there, I think."
            </blockquote>
            <div style={{ fontSize: 13.5, color: C.slate700, lineHeight: 1.6 }}>
              Hindsight theatre. Try: <strong style={{ color: C.slate900 }}>"I underestimated the rollback path on the migration; we sat in a 40-minute outage."</strong> Specific miss + concrete consequence = the Indian HM stops probing.
            </div>
          </div>
        </div>

        {/* 5. Conflict */}
        <div style={{ padding: "12px 0 32px" }}>
          <SectionMarker n="04" label="Conflict narration" />
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.slate200}`,
              borderRadius: 14,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { n: 2, l: "Asked", c: C.slate900 },
                { n: 2, l: "One-sided", c: C.copper },
                { n: 0, l: "Balanced", c: C.slate400 },
              ].map((s) => (
                <div key={s.l} style={{ flex: 1, background: C.slate100, borderRadius: 10, padding: "14px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: s.c, fontVariantNumeric: "tabular-nums" }}>{s.n}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.slate500, letterSpacing: 0.5 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13.5, color: C.slate700, lineHeight: 1.6 }}>
              Name what <em>they</em> wanted before what you did. "The engineering lead wanted to ship the migration in Q3 because of capacity. I wanted Q2 because…" Then the disagreement reads as informed, not stubborn.
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {["Jump to Q2", "Jump to Q5"].map((j) => (
                <span
                  key={j}
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: C.indigo,
                    borderBottom: `1px dashed ${C.indigo}`,
                    paddingBottom: 1,
                    cursor: "pointer",
                  }}
                >
                  {j}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 6. Delivery */}
        <div style={{ padding: "12px 0 32px" }}>
          <SectionMarker n="05" label="Delivery rhythm" />
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.slate200}`,
              borderRadius: 14,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", height: 44, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.slate200}` }}>
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
                    background: s.t === "crisp" ? C.emerald : s.t === "hedged" ? C.amber : C.copper,
                    color: C.white,
                    fontSize: 12,
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
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: C.slate500 }}>
              <span>● crisp 3</span>
              <span style={{ color: "#B45309" }}>● hedged 2</span>
              <span style={{ color: C.copper }}>● rambling 1</span>
            </div>
            <div style={{ fontSize: 13.5, color: C.slate700, lineHeight: 1.6 }}>
              <strong style={{ color: C.slate900 }}>Stamina gap.</strong> Crisp early, loose late. By Q5 you crossed 3 minutes; Bar-Raiser loses the thread past 90 seconds. Cap STAR at 90s: 20s S+T, 50s A, 20s R.
            </div>
          </div>
        </div>

        {/* 7. Radar */}
        <div style={{ padding: "12px 0 32px" }}>
          <SectionMarker n="06" label="Competency strength" />
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.slate200}`,
              borderRadius: 14,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              alignItems: "center",
            }}
          >
            <CompactRadar />
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: C.slate500 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 14, height: 3, background: C.indigo }} /> this session
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 14, height: 3, background: C.slate300 }} /> 3 weeks ago
              </span>
            </div>
            <div style={{ fontSize: 13.5, color: C.slate700, lineHeight: 1.6, alignSelf: "stretch" }}>
              Customer obsession +1.4, ownership +1.0; <strong style={{ color: C.copper }}>conflict navigation -0.8</strong>. The Indian Product rubric weighs conflict ≥ 18%, so one weak axis pulls the score down.
            </div>
          </div>
        </div>

        {/* 8. Evidence */}
        <div style={{ padding: "12px 0 32px" }}>
          <SectionMarker n="07" label="Evidence quality" />
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.slate200}`,
              borderRadius: 14,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { n: 3, l: "Metric claims", c: C.slate900 },
                { n: 1, l: "Evidenced", c: C.emerald },
                { n: 2, l: "Floating", c: C.copper },
              ].map((s, i) => (
                <div key={s.l} style={{ flex: 1, padding: "12px 8px", borderRight: i < 2 ? `1px solid ${C.slate200}` : "none" }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: s.c, fontVariantNumeric: "tabular-nums" }}>{s.n}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.slate500, letterSpacing: 0.4 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <blockquote
              style={{
                margin: 0,
                padding: "12px 14px",
                background: C.copperSoft,
                fontStyle: "italic",
                fontSize: 13.5,
                color: C.slate900,
                lineHeight: 1.55,
                borderRadius: 8,
              }}
            >
              "We moved the needle on activation; conversion improved meaningfully."<br />
              "Roughly tripled the weekly engaged user count, I think."
            </blockquote>
            <div style={{ fontSize: 13, color: C.slate700, lineHeight: 1.6 }}>
              Fix-technique: <strong style={{ color: C.slate900 }}>anchor before percent</strong>. "From 8.4% to 11.1% activation in the 30-day window after the redesign." Bar-Raisers stop probing once the anchor is real.
            </div>
          </div>
        </div>

        {/* 9. AI accountability */}
        <div style={{ padding: "12px 0 32px" }}>
          <SectionMarker n="08" label="How hard the AI pushed you" />
          <div
            style={{
              background: C.slate100,
              borderRadius: 12,
              padding: "16px 20px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px 20px",
              fontSize: 13,
              color: C.slate700,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Depth probes</span>
              <strong style={{ color: C.slate900 }}>3</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Ownership probes</span>
              <strong style={{ color: C.slate900 }}>2</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Vague accepted</span>
              <strong style={{ color: C.copper }}>1</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Deflected</span>
              <strong style={{ color: C.emerald }}>0</strong>
            </div>
          </div>
        </div>

        {/* 10. Transcript replay */}
        <div style={{ padding: "12px 0 120px" }}>
          <SectionMarker n="09" label="Transcript replay" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { q: "Q1", t: "Failure: rollout you'd take back", pills: [["✓ ownership", "ok"]] as [string, string][] },
              { q: "Q2", t: "Conflict: engineering roadmap", pills: [["✗ counterparty POV", "gap"], ["✗ result", "gap"]] as [string, string][] },
              { q: "Q3", t: "Influence: two PMs on a metric", pills: [["✓ quantified", "ok"], ["⚠ rehearsed open", "warn"]] as [string, string][] },
              { q: "Q4", t: "Customer obsession: low-NPS recovery", pills: [["✓ specific", "ok"], ["✗ result", "gap"]] as [string, string][] },
              { q: "Q5", t: "Conflict: design vs growth CTA fight", pills: [["✗ counterparty POV", "gap"], ["⚠ rambling", "warn"]] as [string, string][] },
              { q: "Q6", t: "Trade-off: shipping vs tech debt", pills: [["✓ quantified", "ok"]] as [string, string][] },
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
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: C.slate500, width: 28 }}>{r.q}</span>
                <span style={{ flex: 1, fontSize: 13, color: C.slate900, lineHeight: 1.35 }}>{r.t}</span>
                <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {r.pills.map(([l, tone]) => {
                    const bg = tone === "ok" ? C.emeraldSoft : tone === "gap" ? C.copperSoft : C.slate100;
                    const fg = tone === "ok" ? C.emerald : tone === "gap" ? C.copper : C.slate700;
                    return (
                      <span
                        key={l}
                        style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, background: bg, color: fg }}
                      >
                        {l}
                      </span>
                    );
                  })}
                </span>
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
          padding: "16px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          boxShadow: "0 -10px 30px -16px rgba(15,23,42,0.2)",
        }}
      >
        <div style={{ fontSize: 12.5, color: C.slate500 }}>
          Next session biased toward <strong style={{ color: C.slate900 }}>conflict counterparty-POV</strong>.
        </div>
        <button
          style={{
            background: C.indigo,
            color: C.white,
            border: "none",
            borderRadius: 12,
            padding: "14px 22px",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Start next session →
        </button>
      </div>
    </div>
  );
}

function CompactRadar() {
  const axes = ["Customer", "Ownership", "Stakeholder", "Data", "Roadmap", "Conflict", "Outcomes"];
  const you = [8.2, 7.4, 5.1, 7.0, 6.1, 4.2, 6.0];
  const prev = [6.8, 6.4, 5.6, 6.4, 5.8, 5.0, 5.5];
  const max = 10;
  const cx = 175, cy = 175, R = 120;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    const r = (v / max) * R;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  return (
    <svg width={350} height={350} viewBox="0 0 350 350">
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
        const [x, y] = pt(i, max + 0.6);
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
  );
}

export default VariantCSequencedScroll;
