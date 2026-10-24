import { useLayoutEffect, useState } from "react";
import { tokens as t, fonts as f } from "../auth/_tokens";

/* Lightweight copies of the employer ScoreChip and report ScoreGauge. The
   originals live in modules that pull in motion, radix and server helpers,
   which the public pages should not ship. Thresholds mirror
   STRONG_MATCH_THRESHOLD (40) and FAIR_MATCH_SCORE (20) in
   server-handlers/_requirement-match-helpers.ts. */
const STRONG = 40;
const FAIR = 20;

const bandLabel = (s: number) => (s >= STRONG ? "Strong" : s >= FAIR ? "Good" : "Possible");
const palette = (s: number) =>
  s >= STRONG ? { bg: t.success100, fg: t.successInk } : s >= FAIR ? { bg: t.copper100, fg: t.copperDark } : { bg: t.creamSoft, fg: t.neutralInk };

export function ScoreChip({ score, label = "Match score" }: { score: number; label?: string }) {
  const p = palette(score);
  return (
    <div
      role="img"
      aria-label={`${label}: ${score} out of 100, ${bandLabel(score)} match`}
      style={{
        width: 44,
        height: 32,
        borderRadius: 8,
        background: p.bg,
        color: p.fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: f.sans,
        fontVariantNumeric: "tabular-nums",
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {score}
    </div>
  );
}

const reducedMotion = () => typeof window === "undefined" || typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(target);
  useLayoutEffect(() => {
    if (reducedMotion()) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      setValue(target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setValue(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

export function ScoreGauge({ score, color }: { score: number; color: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const shown = useCountUp(Math.max(0, Math.min(100, score)));
  const pct = shown / 100;
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`Score ${score} out of 100`}>
      <circle cx="66" cy="66" r={r} stroke="oklch(0.955 0.004 265)" strokeWidth="10" fill="none" />
      <circle cx="66" cy="66" r={r} stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 66 66)" fill="none" />
      <text x="66" y="68" textAnchor="middle" fontFamily={f.sans} fontSize="38" fontWeight="700" fill={t.coal} style={{ letterSpacing: "-0.02em" }}>
        {Math.round(shown)}
      </text>
      <text x="66" y="88" textAnchor="middle" fontFamily={f.sans} fontSize="12" fill={t.inkFaint}>
        out of 100
      </text>
    </svg>
  );
}
