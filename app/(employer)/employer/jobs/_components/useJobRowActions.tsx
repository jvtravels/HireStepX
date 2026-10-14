"use client";

import { useState } from "react";
import { useToast } from "@/Toast";
import { useEmployerData } from "@/employer/EmployerDataContext";
import type { RequirementActivity } from "@/employer/EmployerDataContext";
import type { RequirementSummary, ArchiveDisposition } from "@/employer/mockData";
import JobRowActions from "./JobRowActions";
import JobHistoryDialog from "./JobHistoryDialog";
import JobArchiveDialog from "./JobArchiveDialog";

/** Archive/reopen/history behaviour for a job row, shared by the jobs console
 *  and the dashboard's Active Jobs table so both stay identical. Render
 *  `dialogs` once; call `rowActions(job)` per row. */
export function useJobRowActions() {
  const { toast } = useToast();
  const { archiveRequirement, reopenRequirement, fetchRequirementActivity, suspended } = useEmployerData();

  const [archiveTarget, setArchiveTarget] = useState<RequirementSummary | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveDisposition, setArchiveDisposition] = useState<ArchiveDisposition>("keep_candidates");
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

  const openArchive = (r: RequirementSummary) => {
    setArchiveReason("");
    setArchiveDisposition("keep_candidates");
    setArchiveTarget(r);
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiveBusy(true);
    const isClosed = archiveTarget.status === "closed";
    const ok = isClosed
      ? await reopenRequirement(archiveTarget.id)
      : await archiveRequirement(archiveTarget.id, { archiveReason: archiveReason || undefined, archiveDisposition });
    setArchiveBusy(false);
    if (ok) {
      setArchiveTarget(null);
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
