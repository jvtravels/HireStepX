/* Hero gauge / sparkline / readiness helpers — extracted from
 * sr-HeroSection.tsx 2026-05-29 to keep the HeroSection file under
 * ~200 LOC. These are all internal to the hero's gauge + readiness
 * rendering; no external consumer outside sr-HeroSection. Kept as
 * named exports (not default) so each can be tree-shaken if the hero
 * ever stops using one. Pure presentation. */

import { t, f, radius, size } from "../tokens";
import { formatRoleWithLevel } from "../roleLabel";
import type { Calibration } from "../types";

export function ScoreGauge({ score, color }: { score: number; color: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`Score ${score} out of 100`}>
      <circle cx="66" cy="66" r={r} stroke={t.line} strokeWidth="10" fill="none" />
      <circle
        cx="66"
        cy="66"
        r={r}
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform="rotate(-90 66 66)"
        fill="none"
      />
      <text x="66" y="68" textAnchor="middle" fontFamily={f.sans} fontSize="38" fontWeight="700" fill={t.coal} style={{ letterSpacing: "-0.02em" }}>
        {score}
      </text>
      <text x="66" y="88" textAnchor="middle" fontFamily={f.sans} fontSize="12" fill={t.inkFaint}>
        out of 100
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
  /* I-11 (2026-07-10) — the trend verb must describe the SAME comparison as the
   * session-delta arrow rendered beside it (current vs the immediately prior
   * session), not a full-window first→last span. When the window trended down
   * long-term but this session ticked up, a "trending down from {first}" label
   * contradicted a green "↑" arrow. The full window is still visible in the
   * plot; the words now agree with the arrow. */
  const prev = points[points.length - 2];
  const current = points[points.length - 1];
  const trend = current - prev;
  const trendVerb = trend > 0 ? "up" : trend < 0 ? "down" : "flat";
  const a11y = `Recent session scores: ${points.join(", ")}. Currently ${current}, ${trendVerb} from last session's ${prev}.`;
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
    readiness.pct >= 80 ? t.success : readiness.pct >= 60 ? t.warning : t.error;
  const status = readiness.pct >= 80 ? "Interview-ready" : readiness.pct >= 60 ? "Getting close" : "Needs prep";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 16px",
        borderRadius: radius.bar,
        background: t.creamSoft,
        border: `1px solid ${t.line}`,
        marginBottom: 20,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontFamily: f.sans, fontSize: size.sm, fontWeight: 600, color, padding: "3px 10px", borderRadius: radius.pill, border: `1px solid ${t.line}`, background: t.white }}>
        {status}
      </span>
      <span style={{ height: 22, width: 1, background: t.line }} aria-hidden="true" />
      <p style={{ fontFamily: f.sans, fontSize: size.base, color: t.coal, margin: 0, flex: 1, minWidth: 240, lineHeight: 1.45 }}>
        For <strong style={{ color: t.coal, fontWeight: 600 }}>{formatRoleWithLevel(level, role)}</strong>{company ? <> at <strong>{company}</strong></> : null}.
        {readiness.pct >= 80 ? (
          <> You&apos;re interview-ready. Focus on consistency.</>
        ) : (
          <> About {readiness.etaWeeks} {readiness.etaWeeks === 1 ? "week" : "weeks"} of focused prep to close the gap.</>
        )}
      </p>
      {typeof daysUntil === "number" && daysUntil > 0 && (
        <span
          style={{
            padding: "3px 10px",
            borderRadius: radius.pill,
            background: t.indigoWash,
            color: t.indigo,
            fontFamily: f.sans,
            fontSize: size.sm,
            fontWeight: 600,
          }}
        >
          Interview in {daysUntil} {daysUntil === 1 ? "day" : "days"}
        </span>
      )}
    </div>
  );
}

export function CalibrationBanner({ calibration }: { calibration: Calibration }) {
  return (
    <span className="ir-calibration" role="region" aria-label="Calibration context">
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
