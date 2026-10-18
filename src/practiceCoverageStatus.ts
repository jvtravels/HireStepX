import type { PracticeCoverage } from "./dashboardData";

/* One status vocabulary for practice coverage so every surface that shows
 * it (dashboard stat card, resume page card) reads the same number and the
 * same chip. */
export type PracticeCoverageStatus = "not_started" | "in_progress" | "complete";

export function practiceCoverageStatus(cov: Pick<PracticeCoverage, "practicedCount" | "totalAreas">): {
  status: PracticeCoverageStatus;
  label: string;
} {
  if (cov.practicedCount <= 0) return { status: "not_started", label: "Not started" };
  if (cov.practicedCount >= cov.totalAreas) return { status: "complete", label: "Complete" };
  return { status: "in_progress", label: "In progress" };
}
