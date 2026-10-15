"use client";

import { useState } from "react";
import StatusTabs from "@/components/StatusTabs";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { useEmployerBreadcrumb } from "@/employer/EmployerShell";
import { useEmployerAccess } from "@/employer/_useEmployerAccess";
import { ErrorRetry, EmptyNote, LinkCta, PageSkeleton, SuspendedBanner } from "@/employer/_requirementAtoms";
import UnlockDialog from "../../../_components/UnlockDialog";
import { CandidateDialogsHost } from "./CandidateDialogsHost";
import { CandidateHeader } from "./CandidateHeader";
import { CandidateRail } from "./CandidateRail";
import { maskedName, matchedSkillCount } from "./helpers";
import { ActionNoticeAlert } from "./Notices";
import { OverviewTab } from "./OverviewTab";
import { PracticeTab } from "./PracticeTab";
import { ResumeTab } from "./ResumeTab";
import { useCandidateDetail } from "./useCandidateDetail";

type CandidateTabKey = "overview" | "practice" | "resume";
const TABS: ReadonlyArray<{ key: CandidateTabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "practice", label: "Evidence" },
  { key: "resume", label: "Resume" },
];

export default function CandidateDetail({ requirementId, matchId }: { requirementId: string; matchId: string }) {
  const { suspended } = useEmployerData();
  const d = useCandidateDetail(requirementId, matchId);
  const [tab, setTab] = useState<CandidateTabKey>("overview");
  const [dialog, setDialog] = useState<"invite" | "reject" | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const access = useEmployerAccess();

  const { requirement, candidate } = d;
  const shortlistHref = `/employer/requirements/${requirementId}`;

  useEmployerBreadcrumb(
    requirement && candidate && !d.unavailable
      ? [{ label: requirement.title, path: shortlistHref }, { label: maskedName(candidate) }]
      : null,
  );

  const back = <LinkCta href={shortlistHref} variant="outline">Back to shortlist</LinkCta>;

  if (d.loading) return <PageSkeleton label="Loading candidate…" />;

  if (d.loadFailed || !requirement) {
    return (
      <ErrorRetry title="We couldn't load this candidate" message="Check your connection and try again." onRetry={() => void d.reload()}>
        {back}
      </ErrorRetry>
    );
  }

  if (!candidate || d.unavailable) {
    return (
      <EmptyNote title={d.unavailable ? "This candidate is no longer available" : "Candidate not found"} action={back}>
        They may have withdrawn or been removed from this shortlist.
      </EmptyNote>
    );
  }

  const evidenceState = { evidence: d.evidence, loading: d.evidenceLoading, failed: d.evidenceFailed, onRetry: d.reloadEvidence };
  const matched = matchedSkillCount(requirement.skills, candidate.skills);
  const unmatched = requirement.skills.filter((s) => !matched.some((m) => m.toLowerCase() === s.toLowerCase()));
  const resumeFileName = candidate.unlocked ? (d.evidence?.resumeFile?.fileName ?? null) : null;
  const openUnlock = () => {
    d.clearNotice();
    setUnlockOpen(true);
  };

  return (
    <div className="flex min-w-0 flex-[1_0_auto] flex-col pb-6">
      {suspended && <div className="mb-4"><SuspendedBanner /></div>}
      {d.notice && !dialog && <div className="mb-4"><ActionNoticeAlert notice={d.notice} shortlistHref={shortlistHref} /></div>}

      <CandidateDialogsHost
        dialog={dialog}
        onClose={() => setDialog(null)}
        displayName={maskedName(candidate)}
        requirementTitle={requirement.title}
        notice={d.notice}
        shortlistHref={shortlistHref}
        changeStatus={d.changeStatus}
      />

      <UnlockDialog
        target={unlockOpen ? { mode: "single", matchId: candidate.id } : null}
        access={access}
        onClose={() => setUnlockOpen(false)}
        onUnlocked={() => void d.refresh()}
      />

      <div className="grid min-w-0 gap-5 min-[1440px]:grid-cols-[minmax(0,1fr)_300px] min-[1440px]:items-start">
        <div className="flex min-w-0 flex-col">
          <CandidateHeader
            candidate={candidate}
            declined={d.declinedLocally}
            suspended={suspended}
            resumeFileName={resumeFileName}
            onUnlock={openUnlock}
            onInvite={() => {
              d.clearNotice();
              setDialog("invite");
            }}
            onReject={() => {
              d.clearNotice();
              setDialog("reject");
            }}
          />

          <section aria-labelledby="candidate-sections-heading" className="mt-5 flex min-w-0 flex-col">
            <h2 id="candidate-sections-heading" className="sr-only">Candidate details</h2>
            <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3">
              <StatusTabs tabs={TABS} value={tab} onChange={setTab} label="Candidate sections" idPrefix="candtab" panelId="candtab-panel" className="shrink-0" />
            </div>
            <div id="candtab-panel" role="tabpanel" aria-labelledby={`candtab-tab-${tab}`}>
              {tab === "overview" && (
                <OverviewTab
                  candidate={candidate}
                  requirement={requirement}
                  matched={matched}
                  unmatched={unmatched}
                  state={evidenceState}
                  onOpenPractice={() => setTab("practice")}
                  onOpenResume={() => setTab("resume")}
                  onUnlock={openUnlock}
                />
              )}
              {tab === "practice" && <PracticeTab evidence={d.evidence} candidate={candidate} state={evidenceState} onUnlock={openUnlock} />}
              {tab === "resume" && <ResumeTab candidate={candidate} onUnlock={openUnlock} />}
            </div>
          </section>
        </div>

        <CandidateRail candidate={candidate} />
      </div>
    </div>
  );
}
