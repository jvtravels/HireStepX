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
import { CandidateAside } from "./CandidateAside";
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
      <Skeleton className="h-44 w-full" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

export default function CandidateDetail({ requirementId, matchId }: { requirementId: string; matchId: string }) {
  const { suspended } = useEmployerData();
  const d = useCandidateDetail(requirementId, matchId);
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

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Tabs defaultValue="overview" className="min-w-0 gap-4 lg:col-span-2">
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="practice">Practice evidence</TabsTrigger>
            <TabsTrigger value="resume">Resume</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <OverviewTab
              candidate={candidate}
              fitReasons={fitReasons}
              requirementTitle={requirement.title}
              matched={matched}
              unmatched={unmatched}
              state={evidenceState}
            />
          </TabsContent>
          <TabsContent value="practice">
            <PracticeTab evidence={d.evidence} unlocked={candidate.unlocked} shortlistHref={shortlistHref} state={evidenceState} />
          </TabsContent>
          <TabsContent value="resume">
            <ResumeTab candidate={candidate} shortlistHref={shortlistHref} />
          </TabsContent>
        </Tabs>
        <aside aria-label="Candidate details" className="min-w-0 lg:sticky lg:top-4">
          <CandidateAside candidate={candidate} shortlistHref={shortlistHref} />
        </aside>
      </div>
    </div>
  );
}
