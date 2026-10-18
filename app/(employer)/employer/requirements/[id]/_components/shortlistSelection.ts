/* Pure pieces of shortlist selection, bulk stage moves and undo, so the page,
   the selection bar and the tests share one definition. */

import type { Candidate, CandidateStatus } from "@/employer/mockData";
import { CANDIDATE_STATUS_LABEL } from "@/employer/_atoms";
import { isValidCandidateStatusTransition, nextCandidateStatuses } from "../../../../../../server-handlers/_employer-candidate-status-helpers";

export const MIN_COMPARE = 2;
export const MAX_COMPARE = 3;
/** How many status calls run at once. Low enough to stay inside the per-user rate limit. */
export const BULK_CONCURRENCY = 3;

export function toggleId(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Selection never keeps an id whose candidate has left the shortlist. */
export function pruneSelection(selected: Set<string>, candidates: ReadonlyArray<Pick<Candidate, "id">>): Set<string> {
  const live = new Set(candidates.map((c) => c.id));
  const next = new Set<string>();
  for (const id of selected) if (live.has(id)) next.add(id);
  return next.size === selected.size ? selected : next;
}

export function canCompare(count: number): boolean {
  return count >= MIN_COMPARE && count <= MAX_COMPARE;
}

/** Why Compare is off, in words the bar can show; null when it is on. */
export function compareHint(count: number): string | null {
  if (count < MIN_COMPARE) return `Select ${MIN_COMPARE - count} more to compare`;
  if (count > MAX_COMPARE) return `Compare up to ${MAX_COMPARE} candidates`;
  return null;
}

export function compareHref(requirementId: string, ids: readonly string[]): string {
  return `/employer/requirements/${requirementId}/compare?ids=${ids.map(encodeURIComponent).join(",")}`;
}

/** Candidate ids for the compare page: `ids=a,b,c`, or the older `a` and `b` pair, de-duplicated and capped. */
export function parseCompareIds(params: { get: (key: string) => string | null }): string[] {
  const raw = params.get("ids");
  const list = raw ? raw.split(",") : [params.get("a"), params.get("b")];
  const out: string[] = [];
  for (const id of list) {
    const clean = id?.trim();
    if (clean && !out.includes(clean)) out.push(clean);
  }
  return out.slice(0, MAX_COMPARE);
}

export interface StageChange {
  id: string;
  from: CandidateStatus;
  to: CandidateStatus;
}

export type BulkTarget = Extract<CandidateStatus, "rejected" | "shortlisted">;

export const BULK_COPY: Record<BulkTarget, { action: string; done: string }> = {
  rejected: { action: "Reject", done: "Rejected" },
  shortlisted: { action: "Back to To review", done: "Moved back to To review" },
};

/** Who a bulk move applies to. The server only allows some transitions, so the rest are skipped, never forced. */
export function planBulkMove(candidates: readonly Candidate[], ids: ReadonlySet<string>, to: CandidateStatus): { changes: StageChange[]; skipped: number } {
  const changes: StageChange[] = [];
  let skipped = 0;
  for (const c of candidates) {
    if (!ids.has(c.id)) continue;
    if (c.candidateStatus !== to && nextCandidateStatuses(c.candidateStatus).includes(to)) changes.push({ id: c.id, from: c.candidateStatus, to });
    else skipped += 1;
  }
  return { changes, skipped };
}

/** The server has a one-way pipeline, so only some moves can be taken back (a rejection can be reopened; an interview invite cannot). */
export function undoable(changes: readonly StageChange[]): StageChange[] {
  return changes.filter((c) => c.from !== c.to && isValidCandidateStatusTransition(c.to, c.from));
}

export function reverse(changes: readonly StageChange[]): StageChange[] {
  return changes.map((c) => ({ id: c.id, from: c.to, to: c.from }));
}

export function bulkSummary(target: BulkTarget, done: number, failed: number, skipped: number): string {
  const noun = done === 1 ? "candidate" : "candidates";
  const parts = [done > 0 ? `${BULK_COPY[target].done} ${done} ${noun}.` : `Couldn't update any candidates.`];
  if (failed > 0 && done > 0) parts.push(`${failed} didn't save.`);
  if (skipped > 0) parts.push(`${skipped} skipped because ${target === "rejected" ? "they can't be rejected from their stage" : "they are not rejected"}.`);
  return parts.join(" ");
}

export function singleSummary(name: string, to: CandidateStatus): string {
  return `${name} moved to ${CANDIDATE_STATUS_LABEL[to]}`;
}

/** Runs `fn` over `items` with at most `limit` in flight, keeping result order. */
export async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
