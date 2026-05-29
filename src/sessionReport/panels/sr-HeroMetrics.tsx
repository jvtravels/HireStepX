/* Hero gauge / sparkline / readiness helpers — extracted from
 * sr-HeroSection.tsx 2026-05-29 to keep the HeroSection file under
 * ~200 LOC. These are all internal to the hero's gauge + readiness
 * rendering; no external consumer outside sr-HeroSection. Kept as
 * named exports (not default) so each can be tree-shaken if the hero
 * ever stops using one. Pure presentation. */

import { t, f, radius } from "../tokens";
import type { Calibration } from "../types";

export function ScoreGauge({ score, color }: { score: number; color: string }) {
  /* Half-doughnut with the score number rendered INSIDE the SVG so
     positioning is bulletproof across viewport widths. The previous
     version positioned the score with absolute CSS over the SVG
     parent — scaling and overflow caused the number to drift above
     the arc on narrow screens (user-reported #7). Now everything is
     in the same SVG coordinate system. */
  const r = 110;
  const cx = 140;
  const cy = 140;
  const len = Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const filled = len * pct;
  return (
    <svg
      width="280"
      height="170"
      viewBox="0 0 280 170"
      role="img"
      aria-label={`Score ${score} out of 100`}
    >
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke={t.line}
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${len}`}
        fill="none"
      />
      {/* Score number — anchored in SVG coords so it can never
          drift outside the arc regardless of CSS scaling. */}
      <text
        x={cx}
        y={cy - 14}
        textAnchor="middle"
        fontFamily={f.serif}
        fontSize="60"
        fill={t.coal}
        style={{ letterSpacing: "-0.02em" }}
      >
        {score}
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        fontFamily={f.mono}
        fontSize="14"
        fill={t.inkFaint}
      >
        / 100
      </text>
    </svg>
  );
}

export function Sparkline({ points }: { points: number[] }) {
  if (!points || points.length < 2) return null;
  const w = 96;
  const h = 28;
  const pad = 3;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const min = Math.min(...points, 30);
  const max = Math.max(...points, 90);
  const range = Math.max(1, max - min);
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * innerW);
  const ys = points.map((p) => pad + innerH - ((p - min) / range) * innerH);
  const path = points.map((_, i) => `${i === 0 ? "M" : "L"} ${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
  const area = `${path} L ${xs[xs.length - 1].toFixed(1)} ${(h - pad).toFixed(1)} L ${xs[0].toFixed(1)} ${(h - pad).toFixed(1)} Z`;
  const trend = points[points.length - 1] - points[0];
  const trendVerb = trend > 0 ? "trending up" : trend < 0 ? "trending down" : "flat";
  const a11y = `Recent session scores: ${points.join(", ")}. Currently ${points[points.length - 1]}, ${trendVerb} from ${points[0]}.`;
  return (
    <svg
      className="ir-spark"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={a11y}
    >
      <title>{a11y}</title>
      <path className="ir-spark-area" d={area} />
      <path className="ir-spark-line" d={path} />
      {points.map((_, i) => (
        <circle
          key={i}
          className={i === points.length - 1 ? "ir-spark-dot-current" : "ir-spark-dot"}
          cx={xs[i]}
          cy={ys[i]}
          r={i === points.length - 1 ? 2.5 : 1.6}
        />
      ))}
    </svg>
  );
}

export function ReadinessHeadline({
  readiness,
  daysUntil,
  role,
  level,
  company,
}: {
  readiness: { pct: number; etaWeeks: number };
  daysUntil?: number;
  role: string;
  level: string;
  company: string;
}) {
  const color =
    readiness.pct >= 80 ? t.success : readiness.pct >= 60 ? t.copper : t.error;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 18px",
        borderRadius: radius.bar,
        background: `linear-gradient(135deg, ${t.leanHireWash}, ${t.indigoWash})`,
        border: `1px solid ${t.line}`,
        marginBottom: 18,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 600 }}>
          Readiness
        </span>
        <span style={{ fontFamily: f.serif, fontSize: 28, color, lineHeight: 1, letterSpacing: "-0.01em" }}>
          {readiness.pct}%
        </span>
      </div>
      <span style={{ height: 22, width: 1, background: t.line }} aria-hidden="true" />
      <p style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, margin: 0, flex: 1, minWidth: 240, lineHeight: 1.45 }}>
        For <strong style={{ color: t.coal, fontWeight: 600 }}>{level} {role}</strong> at <strong>{company}</strong>.
        {readiness.pct >= 80 ? (
          <> You&apos;re interview-ready — focus on consistency.</>
        ) : (
          <> ~{readiness.etaWeeks} {readiness.etaWeeks === 1 ? "week" : "weeks"} of focused prep to close the gap.</>
        )}
      </p>
      {typeof daysUntil === "number" && daysUntil > 0 && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: radius.pill,
            background: t.copperSoft,
            color: t.copper,
            fontFamily: f.mono,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          INTERVIEW IN {daysUntil}D
        </span>
      )}
    </div>
  );
}

export function CalibrationBanner({ calibration }: { calibration: Calibration }) {
  return (
    <span className="ir-calibration" role="note" aria-label="Calibration context">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2v20M2 12h20" />
      </svg>
      <span>
        Calibrated to <strong style={{ fontWeight: 600 }}>{calibration.companyLabel}</strong>
      </span>
      <span className="ir-calibration-bands">
        {calibration.bands.map((b, i) => (
          <span key={b.label}>
            {i > 0 ? " · " : " — "}
            {b.label} ≥ {b.minScore}
          </span>
        ))}
      </span>
    </span>
  );
}

export function ScoreConfidenceChip({ level, note }: { level: "medium" | "low"; note?: string }) {
  return (
    <span className="ir-confidence-chip" title={note} aria-label={`Score confidence: ${level}${note ? ". " + note : ""}`}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="13" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      {level === "low" ? "Low confidence" : "Medium confidence"}
    </span>
  );
}
