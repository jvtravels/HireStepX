"use client";

import { useState } from "react";
import Link from "next/link";
import { SearchX, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { useEmployerBreadcrumb } from "@/employer/EmployerShell";
import { CandidateDialogsHost } from "./CandidateDialogsHost";
import { CandidateHeader } from "./CandidateHeader";
import { buildFitReasons, maskedName, matchedSkillCount } from "./helpers";
import { ActionNoticeAlert, SuspendedBanner } from "./Notices";
import { OverviewTab } from "./OverviewTab";
import { PracticeTab } from "./PracticeTab";
import { ResumeTab } from "./ResumeTab";
import { useCandidateDetail } from "./useCandidateDetail";

function LoadingSkeleton() {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">Loading candidate…</span>
      <Skeleton className="h-52 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export default function CandidateDetail({ requirementId, matchId }: { requirementId: string; matchId: string }) {
  const { suspended } = useEmployerData();
  const d = useCandidateDetail(requirementId, matchId);
  const [tab, setTab] = useState("overview");
  const [dialog, setDialog] = useState<"invite" | "reject" | null>(null);

  const { requirement, candidate } = d;
  const shortlistHref = `/employer/requirements/${requirementId}`;

  useEmployerBreadcrumb(
    requirement && candidate && !d.unavailable
      ? [{ label: requirement.title, path: shortlistHref }, { label: maskedName(candidate) }]
      : null,
  );

  const back = (
    <Button asChild variant="link">
      <Link href={shortlistHref}>Back to shortlist</Link>
    </Button>
  );

  if (d.loading) return <LoadingSkeleton />;

  if (d.loadFailed || !requirement) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon"><TriangleAlert /></EmptyMedia>
          <EmptyTitle>We couldn't load this candidate</EmptyTitle>
          <EmptyDescription>Check your connection and try again.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button onClick={() => void d.reload()}>Try again</Button>
          {back}
        </EmptyContent>
      </Empty>
    );
  }

  if (!candidate || d.unavailable) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
          <EmptyTitle>{d.unavailable ? "This candidate is no longer available" : "Candidate not found"}</EmptyTitle>
          <EmptyDescription>They may have withdrawn or been removed from this shortlist.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>{back}</EmptyContent>
      </Empty>
    );
  }

  const evidenceState = { evidence: d.evidence, loading: d.evidenceLoading, failed: d.evidenceFailed, onRetry: d.reloadEvidence };
  const matched = matchedSkillCount(requirement.skills, candidate.skills);
  const unmatched = requirement.skills.filter((s) => !matched.some((m) => m.toLowerCase() === s.toLowerCase()));
  const resumeFileName = candidate.unlocked ? (d.evidence?.resumeFile?.fileName ?? null) : null;
  const fitReasons = buildFitReasons(candidate, requirement, matched);

  return (
    <div className="flex flex-col gap-4">
      {suspended && <SuspendedBanner />}
      {d.notice && !dialog && <ActionNoticeAlert notice={d.notice} shortlistHref={shortlistHref} />}

      <CandidateHeader
        candidate={candidate}
        suspended={suspended}
        declined={d.declinedLocally}
        shortlistHref={shortlistHref}
        resumeFileName={resumeFileName}
        matchedCount={matched.length}
        requiredCount={requirement.skills.length}
        onInvite={() => {
          d.clearNotice();
          setDialog("invite");
        }}
        onReject={() => {
          d.clearNotice();
          setDialog("reject");
        }}
      />

      <CandidateDialogsHost
        dialog={dialog}
        onClose={() => setDialog(null)}
        displayName={maskedName(candidate)}
        requirementTitle={requirement.title}
        notice={d.notice}
        shortlistHref={shortlistHref}
        changeStatus={d.changeStatus}
      />

      <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-4">
        <TabsList variant="line" aria-label="Candidate sections" className="h-10 w-full justify-start gap-2 overflow-x-auto border-b border-border pb-0">
          <TabsTrigger value="overview" className="flex-none px-3 after:bottom-0">Overview</TabsTrigger>
          <TabsTrigger value="resume" className="flex-none px-3 after:bottom-0">Resume</TabsTrigger>
          <TabsTrigger value="practice" className="flex-none px-3 after:bottom-0">Practice evidence</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab
            candidate={candidate}
            requirement={requirement}
            fitReasons={fitReasons}
            matched={matched}
            unmatched={unmatched}
            shortlistHref={shortlistHref}
            state={evidenceState}
            onOpenPractice={() => setTab("practice")}
          />
        </TabsContent>
        <TabsContent value="resume">
          <ResumeTab candidate={candidate} shortlistHref={shortlistHref} resumeFileName={resumeFileName} />
        </TabsContent>
        <TabsContent value="practice">
          <PracticeTab evidence={d.evidence} candidate={candidate} shortlistHref={shortlistHref} state={evidenceState} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
