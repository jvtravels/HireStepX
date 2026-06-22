/* HireStepX — Readiness Index analytics / shared types.
 *
 * The payload shape is owned by the scoring core
 * (server-handlers/_readiness-core.ts) and consumed verbatim by the UI.
 * These are TYPE-ONLY re-exports (erased at build), so importing from a
 * server-handler here adds no runtime dependency and pulls none of the
 * core's logic (or the company-tier data it imports) into the client
 * bundle. `Fixture` is the historical view name the section components
 * use; it aliases the canonical ReadinessPayload. */

export type {
  ReadinessPayload,
  Band,
  HireBand,
  Tone,
  PillarKey,
  Meter,
  PillarDriver,
  Pillar,
  Skill,
  TargetMeta,
  RegisterSignal,
  FocusRollup,
  CrossInsight,
  TypedFlag,
  BlindSpot,
  WeakAnswer,
  Attention,
  FollowUp,
  Snapshot,
  RangeKey,
} from "../../server-handlers/_readiness-core";

import type { ReadinessPayload } from "../../server-handlers/_readiness-core";
export type Fixture = ReadinessPayload;

/* Range-scoping for client-side series slices. Re-implemented here (rather
   than imported from the core) so the client bundle stays free of any
   server-handler runtime code. Kept identical to the core's helper. */
export type RangeKeyLocal = "7d" | "1m" | "all";
export const RANGE_LABEL: Record<RangeKeyLocal, string> = { "7d": "7 days", "1m": "1 month", all: "all time" };
export function rangeSlice<T>(series: T[], range: RangeKeyLocal): T[] {
  if (range === "all" || series.length <= 2) return series;
  const keep = range === "7d" ? Math.min(7, series.length) : Math.min(30, series.length);
  return series.slice(series.length - keep);
}

/* Date-based windowing — the truthful version for the 7-day / 1-month / all
   toggle. Kept byte-identical in behaviour to the core's rangeSliceDated /
   rangeStartIndex (a parity test guards the duplication) so the client pulls
   no server-handler runtime. */
export const RANGE_DAYS: Record<RangeKeyLocal, number | null> = { "7d": 7, "1m": 30, all: null };
export function rangeStartIndex(stamps: number[], range: RangeKeyLocal, nowMs: number): number {
  const days = RANGE_DAYS[range];
  if (days == null || stamps.length === 0) return 0;
  const cutoff = nowMs - days * 86_400_000;
  for (let i = 0; i < stamps.length; i++) if (stamps[i] >= cutoff) return i;
  return Math.max(0, stamps.length - 1);
}
export function rangeSliceDated<T>(series: T[], stamps: number[], range: RangeKeyLocal, nowMs: number): T[] {
  if (range === "all" || stamps.length !== series.length || series.length === 0) return series;
  return series.slice(rangeStartIndex(stamps, range, nowMs));
}
