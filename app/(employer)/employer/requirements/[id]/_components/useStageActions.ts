"use client";

import { useCallback } from "react";
import type { EmployerApiError, EmployerApiResult } from "@/employer/EmployerDataContext";
import { statusErrorCopy } from "@/employer/InterviewInviteDialog";
import type { Candidate, CandidateStatus } from "@/employer/mockData";
import type { ToastOptions, ToastType } from "@/Toast";
import { candidateDisplayName } from "./requirementFormat";
import { BULK_CONCURRENCY, bulkSummary, mapWithConcurrency, planBulkMove, reverse, singleSummary, undoable, type BulkTarget, type StageChange } from "./shortlistSelection";

interface Options {
  candidates: readonly Candidate[];
  patchCandidates: (apply: (c: Candidate) => Candidate) => void;
  update: (matchId: string, payload: { candidateStatus: CandidateStatus }) => Promise<EmployerApiResult<null>>;
  toast: (message: string, type?: ToastType, options?: ToastOptions) => void;
}

const RATE_LIMIT_RETRY_MS = 3000;

interface RunResult {
  done: StageChange[];
  failed: StageChange[];
  firstError: EmployerApiError | null;
}

/** Single and bulk stage changes with an optimistic patch, a rollback for what the server refused, and an Undo
    toast for the moves the pipeline allows to be taken back. */
export function useStageActions({ candidates, patchCandidates, update, toast }: Options) {
  const patchStatuses = useCallback(
    (byId: Map<string, CandidateStatus>) => patchCandidates((x) => {
      const status = byId.get(x.id);
      return status ? { ...x, candidateStatus: status } : x;
    }),
    [patchCandidates],
  );

  const run = useCallback(async (changes: StageChange[]): Promise<RunResult> => {
    patchStatuses(new Map(changes.map((c) => [c.id, c.to])));
    const done: StageChange[] = [];
    const failed: StageChange[] = [];
    let firstError: EmployerApiError | null = null;
    await mapWithConcurrency(changes, BULK_CONCURRENCY, async (c) => {
      let res = await update(c.id, { candidateStatus: c.to });
      if (!res.ok && res.error.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_RETRY_MS));
        res = await update(c.id, { candidateStatus: c.to });
      }
      if (res.ok) done.push(c);
      else {
        failed.push(c);
        firstError ??= res.error;
      }
    });
    if (failed.length > 0) patchStatuses(new Map(failed.map((c) => [c.id, c.from])));
    return { done, failed, firstError };
  }, [patchStatuses, update]);

  const undo = useCallback(async (done: StageChange[]) => {
    const back = reverse(undoable(done));
    const result = await run(back);
    const noun = result.done.length === 1 ? "candidate" : "candidates";
    if (result.failed.length > 0) {
      const retry: ToastOptions = { action: { label: "Retry", onClick: () => void undo(result.failed.map((c) => ({ id: c.id, from: c.to, to: c.from }))) } };
      toast(result.done.length > 0 ? `Restored ${result.done.length} ${noun}. ${result.failed.length} couldn't be restored.` : "Couldn't undo that. Please try again.", "error", retry);
    } else toast(`Restored ${result.done.length} ${noun}.`, "success");
  }, [run, toast]);

  const undoOption = useCallback(
    (done: StageChange[]): ToastOptions | undefined => (undoable(done).length > 0 ? { action: { label: "Undo", onClick: () => void undo(done) } } : undefined),
    [undo],
  );

  const applyStage = useCallback(async (c: Candidate, status: CandidateStatus): Promise<boolean> => {
    const result = await run([{ id: c.id, from: c.candidateStatus, to: status }]);
    if (result.failed.length > 0) {
      toast(result.firstError ? statusErrorCopy(result.firstError) : "Couldn't update the candidate. Please try again.", "error");
      return false;
    }
    toast(singleSummary(candidateDisplayName(c), status), "success", undoOption(result.done));
    return true;
  }, [run, toast, undoOption]);

  /** Returns the ids that changed, so the caller can drop them from its selection. */
  const bulkMove = useCallback(async (ids: ReadonlySet<string>, target: BulkTarget): Promise<string[]> => {
    const { changes, skipped } = planBulkMove(candidates, ids, target);
    if (changes.length === 0) {
      toast(bulkSummary(target, 0, 0, skipped), "error");
      return [];
    }
    const result = await run(changes);
    if (result.done.length === 0 && result.firstError) toast(statusErrorCopy(result.firstError), "error");
    else toast(bulkSummary(target, result.done.length, result.failed.length, skipped), result.done.length > 0 ? "success" : "error", undoOption(result.done));
    return result.done.map((c) => c.id);
  }, [candidates, run, toast, undoOption]);

  return { applyStage, bulkMove };
}
