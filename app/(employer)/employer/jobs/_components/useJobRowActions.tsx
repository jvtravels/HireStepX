"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/Toast";
import { useEmployerData } from "@/employer/EmployerDataContext";
import type { RequirementActivity } from "@/employer/EmployerDataContext";
import type { RequirementSummary, ArchiveDisposition } from "@/employer/mockData";
import type { DashboardJobPipeline } from "@/employer/dashboardData";
import { archiveDoneMessage, archiveUndoneMessage } from "./jobsHelpers";
import JobRowActions from "./JobRowActions";
import JobHistoryDialog from "./JobHistoryDialog";
import JobArchiveDialog from "./JobArchiveDialog";

/** Archive/reopen/history behaviour for a job row, shared by the jobs console
 *  and the dashboard's Active jobs table so both stay identical. Render
 *  `dialogs` once; call `rowActions(job)` per row. */
export function useJobRowActions(pipeline?: readonly DashboardJobPipeline[] | null) {
  const { toast } = useToast();
  const { archiveRequirementResult, restoreArchivedMatches, reopenRequirement, fetchRequirementActivity, fetchDashboard, suspended } = useEmployerData();

  const [archiveTarget, setArchiveTarget] = useState<RequirementSummary | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveDisposition, setArchiveDisposition] = useState<ArchiveDisposition>("keep_candidates");
  const [fetchedPipeline, setFetchedPipeline] = useState<readonly DashboardJobPipeline[] | null>(null);
  const [historyTarget, setHistoryTarget] = useState<RequirementSummary | null>(null);
  const [historyItems, setHistoryItems] = useState<RequirementActivity[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async (r: RequirementSummary) => {
    setHistoryTarget(r);
    setHistoryItems(null);
    setHistoryLoading(true);
    const activity = await fetchRequirementActivity(r.id);
    setHistoryItems(activity ?? []);
    setHistoryLoading(false);
  };

  // The jobs page has no dashboard data, and the interviewing count only matters once the employer picks "reject".
  const needsPipeline = !!archiveTarget && archiveTarget.status !== "closed" && archiveDisposition === "reject_remaining" && !pipeline && !fetchedPipeline;
  useEffect(() => {
    if (!needsPipeline) return;
    let cancelled = false;
    fetchDashboard(30).then((data) => { if (!cancelled && data) setFetchedPipeline(data.jobs); });
    return () => { cancelled = true; };
  }, [needsPipeline, fetchDashboard]);
  const knownPipeline = pipeline ?? fetchedPipeline;
  const interviewingCount = archiveTarget && knownPipeline ? (knownPipeline.find((p) => p.requirementId === archiveTarget.id)?.interviewing ?? 0) : null;

  const openArchive = (r: RequirementSummary) => {
    setArchiveReason("");
    setArchiveDisposition("keep_candidates");
    setArchiveTarget(r);
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiveBusy(true);
    const isClosed = archiveTarget.status === "closed";
    const jobId = archiveTarget.id;
    let ok: boolean;
    let rejected: Awaited<ReturnType<typeof archiveRequirementResult>>["rejectedMatches"] = [];
    if (isClosed) {
      ok = await reopenRequirement(jobId);
    } else {
      const result = await archiveRequirementResult(jobId, { archiveReason: archiveReason || undefined, archiveDisposition });
      ok = result.ok;
      rejected = result.rejectedMatches;
    }
    setArchiveBusy(false);
    if (ok) {
      setArchiveTarget(null);
      if (isClosed) {
        toast("Job reopened.", "success");
      } else {
        toast(archiveDoneMessage(rejected.length), "success", {
          action: {
            label: "Undo",
            onClick: async () => {
              const reopened = await reopenRequirement(jobId);
              if (!reopened) {
                toast("Couldn't reopen this job. Please try again.", "error");
                return;
              }
              if (rejected.length === 0) {
                toast("Job reopened.", "success");
                return;
              }
              const restored = await restoreArchivedMatches(jobId, rejected);
              toast(restored === null ? "Job reopened, but we couldn't restore its candidates. Please try again." : `Job reopened. ${archiveUndoneMessage(restored)}`, restored === null ? "error" : "success");
            },
          },
        });
      }
    } else {
      toast(isClosed ? "Couldn't reopen this job. Please try again." : "Couldn't archive this job. Please try again.", "error");
    }
  };

  const rowActions = (r: RequirementSummary) => (
    <JobRowActions requirement={r} readOnly={suspended} onArchive={openArchive} onHistory={openHistory} />
  );

  const dialogs = (
    <>
      <JobHistoryDialog target={historyTarget} items={historyItems} loading={historyLoading} onClose={() => setHistoryTarget(null)} />
      <JobArchiveDialog
        target={archiveTarget}
        busy={archiveBusy}
        candidateCount={archiveTarget?.candidateCount ?? 0}
        interviewingCount={interviewingCount}
        reason={archiveReason}
        onReasonChange={setArchiveReason}
        disposition={archiveDisposition}
        onDispositionChange={setArchiveDisposition}
        onConfirm={confirmArchive}
        onClose={() => setArchiveTarget(null)}
      />
    </>
  );

  return { rowActions, dialogs };
}
