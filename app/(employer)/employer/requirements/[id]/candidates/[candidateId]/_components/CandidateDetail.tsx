"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import StatusTabs from "@/components/StatusTabs";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { useEmployerBreadcrumb } from "@/employer/EmployerShell";
import { useToast } from "@/Toast";
import { markProfileOpened } from "@/employer/onboardingSteps";
import { useEmployerAccess } from "@/employer/_useEmployerAccess";
import { ErrorRetry, EmptyNote, LinkCta, PageSkeleton, SuspendedBanner } from "@/employer/_requirementAtoms";
import UnlockDialog from "../../../_components/UnlockDialog";
import { CandidateDialogsHost } from "./CandidateDialogsHost";
import { CandidateHeader } from "./CandidateHeader";
import { buildCandidateSummary, buildEvidenceSummary, buildRoleFit, dedupeQuestions, maskedName, matchedSkillCount, rankCandidates, shortlistPosition, summarizeFit } from "./helpers";
import { CandidateNav } from "./CandidateNav";
import { PrimaryCandidateAction } from "./PrimaryCandidateAction";
import { useCandidateShortcuts } from "./useCandidateShortcuts";
import { useShortcutsEnabled } from "@/employer/keyboardShortcutsPref";
import { ActionNoticeAlert } from "./Notices";
import { OverviewTab } from "./OverviewTab";
import { PracticeTab } from "./PracticeTab";
import { ResumeTab } from "./ResumeTab";
import { useCandidateDetail } from "./useCandidateDetail";
import { useCandidateRequests } from "./useCandidateRequests";
import type { RequestUi } from "./RequestPopover";

type CandidateTabKey = "overview" | "practice" | "resume";
const TAB_ORDER: CandidateTabKey[] = ["overview", "practice", "resume"];
const TAB_HASH: Record<CandidateTabKey, string> = { overview: "overview", practice: "evidence", resume: "resume" };

/** True once the element has scrolled up past the sticky bar, so the bar can take over the header's job. */
function useScrolledPast(ref: React.RefObject<HTMLElement | null>, active: boolean): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!active || !el || typeof IntersectionObserver === "undefined") return;
    // The observer fires only when visibility flips, so "scrolled out the top" must hold at that
    // instant: compare against the root's midline, not a pixel offset that depends on the page chrome.
    const io = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting && entry.boundingClientRect.bottom < (entry.rootBounds?.height ?? window.innerHeight) / 2), { rootMargin: "-56px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, active]);
  return past;
}

export default function CandidateDetail({ requirementId, matchId }: { requirementId: string; matchId: string }) {
  const { suspended } = useEmployerData();
  const d = useCandidateDetail(requirementId, matchId);
  const router = useRouter();
  const { toast, triggerToastAction } = useToast();
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<CandidateTabKey>("overview");
  const [dialog, setDialog] = useState<"invite" | "reject" | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const access = useEmployerAccess();
  const requests = useCandidateRequests(d.candidate?.id);

  const { requirement, candidate } = d;
  const shortlistHref = `/employer/requirements/${requirementId}`;
  const ready = !!candidate && !d.unavailable;
  useEffect(() => {
    if (ready) markProfileOpened();
  }, [ready]);

  // A link with #evidence or #resume opens on that tab.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const key = TAB_ORDER.find((k) => TAB_HASH[k] === hash);
    if (key) setTab(key);
  }, []);
  const selectTab = useCallback((next: CandidateTabKey) => {
    setTab(next);
    const { pathname, search } = window.location;
    window.history.replaceState(null, "", next === "overview" ? `${pathname}${search}` : `${pathname}${search}#${TAB_HASH[next]}`);
  }, []);

  const ranked = useMemo(() => rankCandidates(requirement?.candidates ?? []), [requirement]);
  const shortlist = useMemo(() => shortlistPosition(ranked, matchId), [ranked, matchId]);
  const hrefFor = useCallback(
    (c: { id: string }) => `${shortlistHref}/candidates/${c.id}${tab === "overview" ? "" : `#${TAB_HASH[tab]}`}`,
    [shortlistHref, tab],
  );
  const goNext = useCallback(() => { if (shortlist?.next) router.push(hrefFor(shortlist.next)); }, [shortlist, hrefFor, router]);
  const goPrev = useCallback(() => { if (shortlist?.prev) router.push(hrefFor(shortlist.prev)); }, [shortlist, hrefFor, router]);
  const goTab = useCallback((i: number) => selectTab(TAB_ORDER[i]), [selectTab]);
  const undoLast = useCallback(() => void triggerToastAction(), [triggerToastAction]);
  const shortcutsOn = useShortcutsEnabled();
  useCandidateShortcuts({ onNext: goNext, onPrev: goPrev, onTab: goTab, onUndo: undoLast }, ready && !dialog && !unlockOpen && shortcutsOn);
  const condensed = useScrolledPast(headerRef, ready);

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

  const answerCount = dedupeQuestions(d.evidence?.questions ?? []).length;
  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "practice" as const, label: "Evidence", count: answerCount > 0 ? answerCount : undefined },
    { key: "resume" as const, label: "Resume" },
  ];
  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(done, "success");
    } catch {
      toast("Couldn't copy to the clipboard", "error");
    }
  };
  const shareUrl = () => `${window.location.origin}${hrefFor(candidate)}`;
  const evidenceState = { evidence: d.evidence, loading: d.evidenceLoading, failed: d.evidenceFailed, onRetry: d.reloadEvidence };
  const matched = matchedSkillCount(requirement.skills, candidate);
  const unmatched = requirement.skills.filter((s) => !matched.includes(s));
  const fit = summarizeFit(buildRoleFit(candidate, requirement, matched, d.evidence));
  const reopen = async () => {
    d.clearNotice();
    if (await d.changeStatus({ status: "shortlisted" })) toast("Candidate reopened and moved back to review", "success");
  };
  const resumeFileName = candidate.unlocked ? (d.evidence?.resumeFile?.fileName ?? null) : null;
  const requestUi: RequestUi = {
    state: requests,
    disabled: suspended || d.declinedLocally,
    disabledReason: suspended ? "Actions are unavailable while your account is suspended." : d.declinedLocally ? "This candidate declined contact." : null,
  };
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
        candidateId={candidate.id}
        currentStatus={candidate.candidateStatus}
      />

      <UnlockDialog
        target={unlockOpen ? { mode: "single", matchId: candidate.id } : null}
        access={access}
        onClose={() => setUnlockOpen(false)}
        onUnlocked={() => void d.refresh()}
      />

      <div className="flex min-w-0 flex-col">
        {shortlist && (
          <CandidateNav
            candidate={candidate}
            shortlist={shortlist}
            hrefFor={hrefFor}
            others={ranked.filter((c) => c.id !== candidate.id)}
            onCompare={(otherId) => router.push(`${shortlistHref}/compare?a=${candidate.id}&b=${otherId}`)}
            onCopyLink={() => void copy(shareUrl(), "Link copied")}
            onCopySummary={() => void copy(buildCandidateSummary(candidate, requirement, matched, d.evidence, shareUrl()), "Summary copied")}
            condensed={condensed}
            action={
              <PrimaryCandidateAction
                candidate={candidate}
                declined={d.declinedLocally}
                suspended={suspended}
                onUnlock={openUnlock}
                onInvite={() => {
                  d.clearNotice();
                  setDialog("invite");
                }}
                onReopen={() => void reopen()}
              />
            }
          />
        )}
        <div ref={headerRef}>
        <CandidateHeader
          candidate={candidate}
          declined={d.declinedLocally}
          suspended={suspended}
          resumeFileName={resumeFileName}
          fit={fit}
          summary={buildEvidenceSummary(candidate, requirement, matched)}
          onUnlock={openUnlock}
          requests={requests}
          onInvite={() => {
            d.clearNotice();
            setDialog("invite");
          }}
          onReject={() => {
            d.clearNotice();
            setDialog("reject");
          }}
          onReopen={() => void reopen()}
        />
        </div>

        <section aria-labelledby="candidate-sections-heading" className="mt-5 flex min-w-0 flex-col">
          <h2 id="candidate-sections-heading" className="sr-only">Candidate details</h2>
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3">
            <StatusTabs tabs={tabs} value={tab} onChange={selectTab} label="Candidate sections" idPrefix="candtab" panelId="candtab-panel" className="shrink-0" />
          </div>
          <div key={tab} id="candtab-panel" role="tabpanel" aria-labelledby={`candtab-tab-${tab}`} className="mx-swap">
            {tab === "overview" && (
              <OverviewTab
                candidate={candidate}
                requirement={requirement}
                matched={matched}
                unmatched={unmatched}
                state={evidenceState}
                onOpenPractice={() => selectTab("practice")}
                onOpenResume={() => selectTab("resume")}
                requestUi={requestUi}
              />
            )}
            {tab === "practice" && <PracticeTab evidence={d.evidence} candidate={candidate} state={evidenceState} requestUi={requestUi} requirementTitle={requirement.title} />}
            {tab === "resume" && <ResumeTab candidate={candidate} />}
          </div>
        </section>
      </div>
    </div>
  );
}
