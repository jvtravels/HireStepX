/* Pure drift analysis over report scores. A model swap, a silent provider
 * downgrade or a prompt regression shows up as a shifted score distribution
 * long before a user complains, so scores are compared across time (recent vs
 * baseline) and across providers (same period). */

export interface ScoredSession { model: string; score: number; at: number }

export interface DriftThresholds {
  minSamples: number;
  shiftPoints: number;
  providerGapPoints: number;
  fallbackShare: number;
}

export const DEFAULT_DRIFT_THRESHOLDS: DriftThresholds = { minSamples: 15, shiftPoints: 8, providerGapPoints: 12, fallbackShare: 0.6 };

export interface DriftFinding { kind: "shift" | "provider-gap" | "fallback-share"; message: string }

/** "gemini-2.5-flash" -> "gemini", "cloudflare-@cf/..." -> "cloudflare", "openai/gpt-oss-120b" -> "groq". */
export function providerOfModel(model: string): string {
  const m = model.toLowerCase();
  if (m.startsWith("gemini")) return "gemini";
  if (m.startsWith("cloudflare")) return "cloudflare";
  if (m.startsWith("cerebras")) return "cerebras";
  if (m.startsWith("openai/") || m.startsWith("llama") || m.startsWith("groq")) return "groq";
  return "other";
}

export function parseSessionRows(rows: unknown): ScoredSession[] {
  if (!Array.isArray(rows)) return [];
  const out: ScoredSession[] = [];
  for (const r of rows as Array<Record<string, unknown>>) {
    const model = typeof r.model === "string" ? r.model : "";
    const score = Number(r.score);
    const at = Date.parse(String(r.created_at ?? ""));
    // 0 is the "report failed" placeholder, not a real score.
    if (!model || !Number.isFinite(score) || score <= 0 || score > 100 || !Number.isFinite(at)) continue;
    out.push({ model, score, at });
  }
  return out;
}

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

export function analyzeDrift(sessions: ScoredSession[], now: number, recentMs: number, t: DriftThresholds = DEFAULT_DRIFT_THRESHOLDS): DriftFinding[] {
  const findings: DriftFinding[] = [];
  const recent = sessions.filter((s) => s.at >= now - recentMs);
  const baseline = sessions.filter((s) => s.at < now - recentMs);

  if (recent.length >= t.minSamples && baseline.length >= t.minSamples) {
    const delta = mean(recent.map((s) => s.score)) - mean(baseline.map((s) => s.score));
    if (Math.abs(delta) >= t.shiftPoints) {
      findings.push({ kind: "shift", message: `Mean report score moved ${delta > 0 ? "+" : ""}${delta.toFixed(1)} points (recent ${mean(recent.map((s) => s.score)).toFixed(1)} over ${recent.length} sessions vs baseline ${mean(baseline.map((s) => s.score)).toFixed(1)} over ${baseline.length}).` });
    }
  }

  const byProvider = new Map<string, number[]>();
  for (const s of recent) {
    const p = providerOfModel(s.model);
    byProvider.set(p, [...(byProvider.get(p) ?? []), s.score]);
  }
  const eligible = [...byProvider.entries()].filter(([, v]) => v.length >= t.minSamples).map(([p, v]) => ({ p, avg: mean(v), n: v.length }));
  if (eligible.length >= 2) {
    eligible.sort((a, b) => a.avg - b.avg);
    const lo = eligible[0];
    const hi = eligible[eligible.length - 1];
    if (hi.avg - lo.avg >= t.providerGapPoints) {
      findings.push({ kind: "provider-gap", message: `${lo.p} scores ${(hi.avg - lo.avg).toFixed(1)} points lower than ${hi.p} on the same period (${lo.avg.toFixed(1)} over ${lo.n} vs ${hi.avg.toFixed(1)} over ${hi.n}); fallback grading is not equivalent.` });
    }
  }

  if (recent.length >= t.minSamples) {
    const counts = new Map<string, number>();
    for (const s of recent) counts.set(providerOfModel(s.model), (counts.get(providerOfModel(s.model)) ?? 0) + 1);
    const [topProvider, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topProvider !== "gemini" && topCount / recent.length >= t.fallbackShare) {
      findings.push({ kind: "fallback-share", message: `${Math.round((topCount / recent.length) * 100)}% of recent reports were graded by ${topProvider}, a fallback rather than the primary; check primary quota and health.` });
    }
  }
  return findings;
}
