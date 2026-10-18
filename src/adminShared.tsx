import { memo } from "react";
import type { CSSProperties } from "react";
import { c, font, radius } from "./tokens";
import { tokens as T } from "./auth/_tokens";

export interface CostWindow { llmInr: number; ttsInr: number; sttInr: number; totalInr: number; sessions: number; perSessionInr: number }

export interface CostData {
  totalLlmInr: number;
  avgCostPerSession: number;
  highestSessionCostInr: number;
  sessionCount: number;
  totalSessions30d: number;
  nullCostCount: number;
  dataCoveragePercent: number;
  thisWeekInr: number;
  lastWeekInr: number;
  wowDeltaPct: number | null;
  todayCostInr: number;
  dailyAvgInr: number;
  isCostSpike: boolean;
  byFocus: Record<string, { totalInr: number; sessions: number; avgInr: number }>;
  perDay: Record<string, number>;
  byEndpoint: Record<string, { estimatedInr: number; tokens: number; calls: number }>;
  topUsersByCost: Array<{ userId: string; name: string; email: string; totalLlmInr: number; voiceInr: number; totalInr: number; sessions: number; avgInr: number }>;
  today: CostWindow & { date: string };
  last7d: CostWindow;
  last30d: CostWindow;
  attributedLlmPct: number;
  unattributedLlmInr: number;
  byModel: Record<string, { estimatedInr: number; tokens: number; calls: number; failed: number }>;
  byModelToday: Record<string, { estimatedInr: number; tokens: number; calls: number; failed: number }>;
  topExpensiveSessions: Array<{
    id: string; userId: string; focus: string; score: number; duration: number;
    llmCostInr: number; promptTokens: number; completionTokens: number; date: string;
  }>;
  ratesLastVerifiedAt: string;
  rateCardAgeDays: number;
  rateCardIsStale: boolean;
  costReconciliations: Array<{
    month: string; actualInvoiceInr: number; modeledInr: number; variancePct: number | null; note: string | null;
  }>;
}

export function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

export function formatDateTime(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Export an array of objects as a CSV download. Quotes cells containing
 * commas/quotes/newlines per RFC 4180. Browser-only — no-op on SSR.
 */
export function exportCsv<T extends object>(filename: string, rows: T[]): void {
  if (typeof window === "undefined" || rows.length === 0) return;
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // T is a caller-supplied shape, not a Record<string, unknown> — keys are
  // derived from Object.keys() at runtime, so an index-signature cast at
  // every call site would otherwise be required just to read r[k] here.
  const lines = [keys.join(","), ...rows.map((r) => keys.map((k) => escape((r as Record<string, unknown>)[k])).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export const card = {
  background: c.graphite,
  border: `1px solid ${c.border}`,
  borderRadius: radius.lg,
  padding: "20px 24px",
} as const;

export const statCard = {
  ...card,
  flex: "1 1 200px",
  minWidth: 180,
} as const;

export const labelStyle = {
  fontSize: 11,
  fontWeight: 600 as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: c.stone,
  margin: "0 0 6px",
} as const;

export const bigNum = {
  fontSize: 28,
  fontWeight: 700 as const,
  color: c.ivory,
  fontFamily: font.mono,
  margin: 0,
  lineHeight: 1.2,
} as const;

export const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const,
  fontSize: 13,
} as const;

export const thStyle = {
  textAlign: "left" as const,
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 600 as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: c.stone,
  borderBottom: `1px solid ${c.border}`,
} as const;

export const tdStyle = {
  padding: "10px 12px",
  color: c.chalk,
  borderBottom: `1px solid ${c.borderSubtle}`,
} as const;

function barRowStyle(height: number): CSSProperties {
  return { display: "flex", alignItems: "flex-end", gap: 2, width: "100%", height };
}

function barStyle(maxWidthPct: number, heightPct: number, color: string): CSSProperties {
  return {
    flex: 1,
    maxWidth: maxWidthPct + "%",
    height: `${heightPct}%`,
    background: color,
    borderRadius: "3px 3px 0 0",
    opacity: 0.8,
    transition: "height 0.3s ease",
  };
}

export const MiniBarChart = memo(function MiniBarChart({ data, color = T.indigo, height = 80 }: { data: Record<string, number>; color?: string; height?: number }) {
  const entries = Object.entries(data);
  const values = entries.map(([, v]) => v);
  const max = Math.max(...values, 1);
  const barW = Math.max(4, Math.floor(100 / values.length) - 1);

  return (
    <div style={barRowStyle(height)}>
      {entries.map(([key, v], i) => (
        <div
          key={i}
          title={`${key}: ${v.toLocaleString()}`}
          style={barStyle(barW, Math.max(2, (v / max) * 100), color)}
        />
      ))}
    </div>
  );
});
