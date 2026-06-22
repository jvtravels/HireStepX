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
