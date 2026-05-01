/* HireStepX — Design System / Data Visualization
   Charts, scores, progress. Copper for the headline number. Indigo
   for interaction. Editorial restraint over dashboard maximalism. */
import React from "react";
import { tokens as t, fonts as f, shadows } from "./_tokens";
import { MonoLabel, SectionHead, Footer } from "./_atoms";
function Card({
  title,
  children,
  height,
}: {
  title: string;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        padding: "28px 32px",
        boxShadow: shadows.card,
        height,
      }}
    >
      <MonoLabel color={t.copper}>{title}</MonoLabel>
      <div style={{ marginTop: 20 }}>{children}</div>
    </div>
  );
}

/* ─── Score arc (gauge) ─── */
function ScoreArc({ value, max = 100, size = 200, label = "Clarity Score" }: { value: number; max?: number; size?: number; label?: string }) {
  const W = size,
    H = size * 0.65;
  const r = size * 0.42;
  const cx = W / 2;
  const cy = H * 0.95;
  const startAngle = Math.PI;
  const endAngle = 0;
  const arcLen = Math.PI * r; // half-circle length
  const dash = (value / max) * arcLen;
  const pathD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <div style={{ position: "relative", width: W, height: H + 20, margin: "0 auto" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <path d={pathD} fill="none" stroke={t.creamSoft} strokeWidth={size * 0.05} strokeLinecap="round" />
        <path
          d={pathD}
          fill="none"
          stroke={t.copper}
          strokeWidth={size * 0.05}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${arcLen}`}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: H * 0.3,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <MonoLabel>{label}</MonoLabel>
        <div
          style={{
            fontFamily: f.serif,
            fontSize: size * 0.32,
            fontWeight: 500,
            lineHeight: 1,
            color: t.copper,
            marginTop: 6,
            letterSpacing: "-0.02em",
          }}
        >
          {value}
          <small style={{ fontSize: size * 0.1, color: t.inkFaint, marginLeft: 4 }}>/{max}</small>
        </div>
      </div>
    </div>
  );
}

/* ─── Skill radar chart ─── */
function SkillRadar({
  skills,
}: {
  skills: { label: string; value: number }[];
}) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.4;
  const n = skills.length;

  const point = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (value / 100) * maxR;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  };

  const polygonPoints = skills
    .map((s, i) => {
      const [x, y] = point(i, s.value);
      return `${x},${y}`;
    })
    .join(" ");

  // Background grid (3 levels)
  const gridLevels = [0.33, 0.66, 1.0];

  return (
    <div style={{ width: size, height: size, margin: "0 auto", position: "relative" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {gridLevels.map((lvl, i) => {
          const points = skills
            .map((_, j) => {
              const angle = (Math.PI * 2 * j) / n - Math.PI / 2;
              const r = lvl * maxR;
              return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
            })
            .join(" ");
          return (
            <polygon
              key={i}
              points={points}
              fill="none"
              stroke={t.line}
              strokeWidth={1}
            />
          );
        })}
        {skills.map((_, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + Math.cos(angle) * maxR}
              y2={cy + Math.sin(angle) * maxR}
              stroke={t.line}
              strokeWidth={1}
            />
          );
        })}
        <polygon
          points={polygonPoints}
          fill={t.copperSoft}
          stroke={t.copper}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {skills.map((s, i) => {
          const [px, py] = point(i, s.value);
          return <circle key={i} cx={px} cy={py} r={3} fill={t.copper} />;
        })}
        {skills.map((s, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
          const lr = maxR + 24;
          const lx = cx + Math.cos(angle) * lr;
          const ly = cy + Math.sin(angle) * lr;
          return (
            <text
              key={s.label}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily={f.sans}
              fontSize={11}
              fontWeight={500}
              fill={t.coal}
            >
              {s.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Trend line chart ─── */
function TrendChart({ data }: { data: number[] }) {
  const W = 480;
  const H = 180;
  const pad = 24;
  const max = Math.max(...data, 100);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = (W - pad * 2) / (data.length - 1);

  const points = data.map((v, i) => {
    const x = pad + i * step;
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return [x, y];
  });

  const path = points
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(" ");

  const area = `${path} L ${points[points.length - 1][0]} ${H - pad} L ${pad} ${H - pad} Z`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {/* Y axis grid */}
      {[0, 25, 50, 75, 100].map((v) => {
        const y = H - pad - (v / 100) * (H - pad * 2);
        return (
          <g key={v}>
            <line x1={pad} y1={y} x2={W - pad} y2={y} stroke={t.line} strokeDasharray="2 4" />
            <text
              x={pad - 8}
              y={y + 4}
              textAnchor="end"
              fontFamily={f.mono}
              fontSize={10}
              fill={t.inkSoft}
            >
              {v}
            </text>
          </g>
        );
      })}
      {/* Area fill */}
      <path d={area} fill={t.copperSoft} />
      {/* Line */}
      <path d={path} fill="none" stroke={t.copper} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {points.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === points.length - 1 ? 5 : 3}
          fill={i === points.length - 1 ? t.copper : t.white}
          stroke={t.copper}
          strokeWidth={2}
        />
      ))}
      {/* Last value label */}
      <text
        x={points[points.length - 1][0]}
        y={points[points.length - 1][1] - 14}
        textAnchor="middle"
        fontFamily={f.serif}
        fontSize={16}
        fontWeight={500}
        fill={t.copper}
      >
        {data[data.length - 1]}
      </text>
    </svg>
  );
}

/* ─── Bar comparison ─── */
function BarChart({ rows }: { rows: { label: string; value: number; max?: number; isYou?: boolean }[] }) {
  const max = Math.max(...rows.map((r) => r.max || r.value));
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {rows.map((row, i) => (
        <div key={i}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              marginBottom: 6,
            }}
          >
            <span style={{ color: row.isYou ? t.copper : t.coal, fontWeight: row.isYou ? 600 : 500 }}>
              {row.isYou && "★ "}
              {row.label}
            </span>
            <span style={{ color: t.inkSoft, fontFamily: f.mono }}>{row.value}</span>
          </div>
          <div
            style={{
              height: 8,
              background: t.creamSoft,
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(row.value / max) * 100}%`,
                height: "100%",
                background: row.isYou ? t.copper : t.indigo,
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Calendar heatmap (streak) ─── */
function StreakHeatmap() {
  // Generate 12 weeks of dummy intensity data (0-3)
  const weeks = 12;
  const days = 7;
  const data: number[][] = [];
  for (let w = 0; w < weeks; w++) {
    data.push([]);
    for (let d = 0; d < days; d++) {
      // Simulate higher activity recently
      const recencyBoost = (w / weeks) * 1.2;
      const intensity = Math.max(0, Math.floor(Math.random() * 3 - 1 + recencyBoost));
      data[w].push(Math.min(3, intensity));
    }
  }

  const colors = ["#F0EAE0", "#F4D8B4", "#E8AE7A", "#B45309"];
  const cell = 14;
  const gap = 3;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap }}>
        {data.map((week, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap }}>
            {week.map((intensity, di) => (
              <div
                key={di}
                style={{
                  width: cell,
                  height: cell,
                  background: colors[intensity],
                  borderRadius: 2,
                }}
                title={`Week ${wi + 1}, Day ${di + 1}: ${intensity} sessions`}
              />
            ))}
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          color: t.inkSoft,
          fontFamily: f.mono,
          marginTop: 4,
        }}
      >
        <span>12 weeks ago</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          Less
          {colors.map((c, i) => (
            <span
              key={i}
              style={{
                width: 12,
                height: 12,
                background: c,
                borderRadius: 2,
                display: "inline-block",
              }}
            />
          ))}
          More
        </span>
      </div>
    </div>
  );
}

/* ─── Sparkline ─── */
function Sparkline({ data, width = 120, height = 36 }: { data: number[]; width?: number; height?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke={t.copper}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Segmented progress ─── */
function SegmentedProgress({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div>
      <div
        style={{
          height: 12,
          background: t.creamSoft,
          borderRadius: 999,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {segments.map((seg, i) => (
          <div
            key={i}
            style={{
              width: `${(seg.value / total) * 100}%`,
              background: seg.color,
            }}
          />
        ))}
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: seg.color,
              }}
            />
            <span style={{ fontSize: 12, color: t.coal, fontWeight: 500 }}>{seg.label}</span>
            <span style={{ fontSize: 12, color: t.inkSoft, fontFamily: f.mono }}>
              {Math.round((seg.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main ─── */
export default function DesignSystemDataViz() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
        @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap');
      `}</style>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "80px 56px 120px",
          fontFamily: f.sans,
          color: t.coal,
          background: t.cream,
        }}
      >
        {/* MASTHEAD */}
        <header style={{ borderBottom: `1px solid ${t.line}`, paddingBottom: 40, marginBottom: 64 }}>
          <MonoLabel>Design System · v1.0</MonoLabel>
          <h1
            style={{
              fontFamily: f.serif,
              fontSize: 56,
              fontWeight: 400,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              margin: "12px 0 0",
            }}
          >
            Data, by{" "}
            <em style={{ fontStyle: "italic", color: t.copper }}>restraint</em>.
          </h1>
          <p
            style={{
              color: t.indigoGray,
              fontSize: 15,
              margin: "16px 0 0",
              maxWidth: 540,
              lineHeight: 1.6,
            }}
          >
            Charts that read like editorial graphs in The Economist, not like
            a cluttered Power BI dashboard. Copper for the headline number,
            indigo for interaction, defaults for status. Every pixel earns
            its ink.
          </p>
        </header>

        {/* 01 — COLOR RULES */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="01"
            title="Data colors"
            desc="Six roles. Strict mapping. Never use a 7th color in a chart."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: "32px 40px",
              boxShadow: shadows.card,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
              {[
                { name: "Copper", hex: "#B45309", role: "The headline number. Score, primary metric, current value.", c: t.copper },
                { name: "Indigo", hex: "#312E81", role: "Comparison · benchmark · cohort average · 'others like you'.", c: t.indigo },
                { name: "Sage", hex: "#15803D", role: "Improvement · positive delta · 'gained 6 points'.", c: t.success },
                { name: "Ember", hex: "#B91C1C", role: "Decline · negative delta · alert thresholds.", c: t.error },
                { name: "Warning", hex: "#A16207", role: "Caution zone · between healthy and alert.", c: t.warning },
                { name: "Cream-soft", hex: "#F4EFE3", role: "Background bars · empty track · gridlines.", c: t.creamSoft },
              ].map((c) => (
                <div
                  key={c.name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px 1fr",
                    gap: 14,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      background: c.c,
                      borderRadius: 8,
                      border: `1px solid ${t.line}`,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontFamily: f.mono,
                        fontSize: 11,
                        fontWeight: 600,
                        color: t.coal,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {c.name}
                    </div>
                    <div
                      style={{
                        fontFamily: f.mono,
                        fontSize: 10,
                        color: t.inkSoft,
                        marginTop: 2,
                      }}
                    >
                      {c.hex}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: t.indigoGray,
                        marginTop: 4,
                        lineHeight: 1.5,
                      }}
                    >
                      {c.role}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 24, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
              <b style={{ color: t.coal, fontWeight: 600 }}>Rule:</b> a chart
              with three colors is allowed. Four colors must be justified.
              Five colors means you should be making two charts.
            </p>
          </div>
        </section>

        {/* 02 — SCORE GAUGES */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="02"
            title="Score gauges"
            desc="The arc. The signature data viz of HireStepX. Three sizes for three contexts."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <Card title="Hero · result page">
              <ScoreArc value={62} size={240} />
              <p style={{ fontSize: 12, color: t.indigoGray, marginTop: 16, textAlign: "center" }}>
                240px · result reveal moment
              </p>
            </Card>
            <Card title="Card · dashboard">
              <ScoreArc value={62} size={160} />
              <p style={{ fontSize: 12, color: t.indigoGray, marginTop: 16, textAlign: "center" }}>
                160px · KPI panel
              </p>
            </Card>
            <Card title="Inline · session row">
              <ScoreArc value={78} size={120} label="This session" />
              <p style={{ fontSize: 12, color: t.indigoGray, marginTop: 16, textAlign: "center" }}>
                120px · per-session
              </p>
            </Card>
          </div>
        </section>

        {/* 03 — TREND CHART */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="03"
            title="Trend over time"
            desc="A line chart with one job: show direction. Soft area fill. Dot on the latest value."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: "28px 32px",
              boxShadow: shadows.card,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 24,
              }}
            >
              <div>
                <MonoLabel color={t.copper}>Score history · last 30 days</MonoLabel>
                <h3
                  style={{
                    fontFamily: f.serif,
                    fontSize: 28,
                    fontWeight: 500,
                    color: t.coal,
                    margin: "8px 0 0",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Up{" "}
                  <em style={{ color: t.copper, fontStyle: "italic" }}>
                    14 points
                  </em>{" "}
                  this month
                </h3>
              </div>
              <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
                <div>
                  <MonoLabel>Current</MonoLabel>
                  <div
                    style={{
                      fontFamily: f.serif,
                      fontSize: 22,
                      fontWeight: 500,
                      color: t.copper,
                      marginTop: 2,
                    }}
                  >
                    78
                  </div>
                </div>
                <div>
                  <MonoLabel>Best</MonoLabel>
                  <div
                    style={{
                      fontFamily: f.serif,
                      fontSize: 22,
                      fontWeight: 500,
                      color: t.coal,
                      marginTop: 2,
                    }}
                  >
                    82
                  </div>
                </div>
                <div>
                  <MonoLabel>Sessions</MonoLabel>
                  <div
                    style={{
                      fontFamily: f.serif,
                      fontSize: 22,
                      fontWeight: 500,
                      color: t.coal,
                      marginTop: 2,
                    }}
                  >
                    12
                  </div>
                </div>
              </div>
            </div>
            <TrendChart data={[42, 51, 58, 56, 64, 71, 68, 73, 74, 78, 82, 78]} />
          </div>
        </section>

        {/* 04 — RADAR + BARS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="04"
            title="Skill radar · peer comparison"
            desc="When you need to show shape (radar) or rank (bars). Pick one — never both for the same data."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Card title="Skill radar · 6 axes">
              <SkillRadar
                skills={[
                  { label: "Structure", value: 75 },
                  { label: "Clarity", value: 82 },
                  { label: "Specificity", value: 60 },
                  { label: "Impact", value: 55 },
                  { label: "Confidence", value: 88 },
                  { label: "Tone", value: 70 },
                ]}
              />
              <p style={{ fontSize: 12, color: t.indigoGray, marginTop: 16, lineHeight: 1.6 }}>
                Use when the user needs to see <i>shape</i> — a balanced
                profile or a lopsided one. Not for ranking.
              </p>
            </Card>
            <Card title="Peer comparison · ranked">
              <div style={{ marginTop: 12 }}>
                <BarChart
                  rows={[
                    { label: "Top 10%", value: 88 },
                    { label: "Top 25%", value: 78 },
                    { label: "You", value: 72, isYou: true },
                    { label: "Median", value: 60 },
                    { label: "Bottom 25%", value: 45 },
                  ]}
                />
              </div>
              <p style={{ fontSize: 12, color: t.indigoGray, marginTop: 20, lineHeight: 1.6 }}>
                Bars show rank. The user's own bar is{" "}
                <b style={{ color: t.copper }}>copper · marked with ★</b>.
                Everyone else is indigo. Never reverse this.
              </p>
            </Card>
          </div>
        </section>

        {/* 05 — STREAK HEATMAP */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="05"
            title="Streak heatmap"
            desc="The calendar of practice. Copper intensity. Cream surface stays visible for empty cells."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: "32px 40px",
              boxShadow: shadows.card,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 24,
              }}
            >
              <div>
                <MonoLabel color={t.copper}>Practice streak</MonoLabel>
                <h3
                  style={{
                    fontFamily: f.serif,
                    fontSize: 24,
                    fontWeight: 500,
                    margin: "8px 0 0",
                    letterSpacing: "-0.01em",
                  }}
                >
                  <em style={{ color: t.copper, fontStyle: "italic" }}>5</em>{" "}
                  day streak · keep it alive
                </h3>
              </div>
              <span
                style={{
                  background: t.copperSoft,
                  color: t.copper,
                  padding: "4px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                Current best · 12 days
              </span>
            </div>
            <StreakHeatmap />
          </div>
        </section>

        {/* 06 — SEGMENTED + SPARKLINE */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="06"
            title="Composition · sparkline"
            desc="Stacked progress when 100% is the question. Sparkline when space is precious."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Card title="Time spent · per interview type">
              <SegmentedProgress
                segments={[
                  { label: "Behavioral", value: 45, color: t.copper },
                  { label: "Technical", value: 25, color: t.indigo },
                  { label: "Salary", value: 20, color: t.success },
                  { label: "Other", value: 10, color: t.indigoGray },
                ]}
              />
              <p style={{ fontSize: 12, color: t.indigoGray, marginTop: 20, lineHeight: 1.6 }}>
                Stacked when total = 100%. Use copper for the largest
                segment to anchor the eye.
              </p>
            </Card>
            <Card title="Inline metrics · sparklines">
              <div style={{ display: "grid", gap: 18 }}>
                {[
                  { label: "Behavioral", val: 78, data: [50, 55, 62, 60, 68, 72, 75, 78] },
                  { label: "Technical", val: 64, data: [55, 58, 62, 60, 64, 66, 65, 64] },
                  { label: "Salary", val: 52, data: [40, 42, 45, 48, 50, 51, 52, 52] },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "120px 1fr 60px",
                      alignItems: "center",
                      gap: 16,
                    }}
                  >
                    <span style={{ fontSize: 13, color: t.coal, fontWeight: 500 }}>{row.label}</span>
                    <Sparkline data={row.data} />
                    <span
                      style={{
                        fontFamily: f.serif,
                        fontSize: 18,
                        fontWeight: 500,
                        color: t.copper,
                        textAlign: "right",
                      }}
                    >
                      {row.val}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        {/* 07 — STATES */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="07"
            title="States · empty · loading · error"
            desc="Charts must handle three states gracefully. Don't ship without all three designed."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <Card title="Empty">
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    background: t.copper100,
                    borderRadius: "50%",
                    margin: "0 auto 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: t.copper,
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 3v18h18" />
                    <path d="M7 14l3-3 4 4 5-5" />
                  </svg>
                </div>
                <p style={{ fontFamily: f.serif, fontSize: 18, fontWeight: 500, margin: "0 0 6px" }}>
                  No data yet
                </p>
                <p style={{ fontSize: 12, color: t.indigoGray, margin: 0, lineHeight: 1.5 }}>
                  Complete one interview to start the chart.
                </p>
              </div>
            </Card>
            <Card title="Loading · skeleton">
              <div style={{ padding: "8px 0" }}>
                <div style={{ height: 14, width: "60%", background: t.creamSoft, borderRadius: 6, marginBottom: 12, animation: "viz-pulse 1.4s ease-in-out infinite" }} />
                <div
                  style={{
                    height: 100,
                    background: t.creamSoft,
                    borderRadius: 8,
                    animation: "viz-pulse 1.4s ease-in-out infinite",
                    animationDelay: "0.1s",
                  }}
                />
                <div style={{ height: 10, width: "30%", background: t.creamSoft, borderRadius: 6, marginTop: 12, animation: "viz-pulse 1.4s ease-in-out infinite", animationDelay: "0.2s" }} />
                <style>{`
                  @keyframes viz-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                  }
                `}</style>
              </div>
            </Card>
            <Card title="Error · recoverable">
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    background: t.error100,
                    borderRadius: "50%",
                    margin: "0 auto 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: t.error,
                    fontWeight: 700,
                    fontSize: 22,
                  }}
                >
                  !
                </div>
                <p style={{ fontFamily: f.serif, fontSize: 18, fontWeight: 500, margin: "0 0 6px" }}>
                  Couldn't load
                </p>
                <p style={{ fontSize: 12, color: t.indigoGray, margin: "0 0 16px", lineHeight: 1.5 }}>
                  Network error. Your data is safe.
                </p>
                <button
                  style={{
                    background: t.indigo,
                    color: t.white,
                    border: "none",
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: f.sans,
                  }}
                >
                  Retry
                </button>
              </div>
            </Card>
          </div>
        </section>

        {/* 08 — RULES */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="08"
            title="Rules of data viz"
            desc="The discipline. Chart-junk is the enemy. Editorial restraint always wins."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: "32px 40px",
              boxShadow: shadows.card,
            }}
          >
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 18 }}>
              {[
                {
                  k: "One copper number",
                  v: "Per chart, exactly one number gets copper. The headline. Everything else is coal, indigo, or muted.",
                },
                {
                  k: "Soft gridlines",
                  v: "Dashed at 0.5px opacity, never solid black. The eye should follow the data, not the scaffolding.",
                },
                {
                  k: "No 3D, no shadows on bars",
                  v: "Flat charts. Editorial. No gradient fills inside bars. No drop-shadows on data points.",
                },
                {
                  k: "Annotations as words",
                  v: "Use a Instrument Serif 18px italic to call out the headline insight ('Up 14 points this month'), not floating numbers next to dots.",
                },
                {
                  k: "Animate on first paint only",
                  v: "Lines draw, bars fill, arcs sweep — once, on mount, 600ms ease-out-expo. Never on every re-render.",
                },
                {
                  k: "Empty states sell practice",
                  v: "Every chart starts empty. The empty state should make the user want to fill it. CTA-first, not apology-first.",
                },
                {
                  k: "Respect screen size",
                  v: "Charts must work at 320px wide. If a chart needs 600px to be legible, redesign it — don't horizontal-scroll.",
                },
              ].map((row) => (
                <li
                  key={row.k}
                  style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, fontSize: 14, lineHeight: 1.6 }}
                >
                  <span
                    style={{
                      fontFamily: f.mono,
                      fontSize: 11,
                      color: t.copper,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      paddingTop: 2,
                    }}
                  >
                    {row.k}
                  </span>
                  <span style={{ color: t.indigoGray }}>{row.v}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FOOTER */}
        <Footer section="Section" tagline="One copper number per chart. The rest earns its ink." />
      </div>
    </>
  );
}
