"use client";

import { useState } from "react";
import Link from "next/link";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { useEmployerBreadcrumb } from "@/employer/EmployerShell";
import { Card, OutlineCta } from "@/employer/_atoms";
import { useMaxWidth } from "@/hooks/useMaxWidth";
import { CandidateBrief } from "./CandidateBrief";
import { CandidateDialogsHost } from "./CandidateDialogsHost";
import { CandidateHeader } from "./CandidateHeader";
import { CANDIDATE_TABS, CandidateTabs, panelId, tabId, type CandidateTabKey } from "./CandidateTabs";
import { buildFitReasons, evidenceAverage, maskedName, matchedSkillCount } from "./helpers";
import { ActionNoticeAlert, SuspendedBanner } from "./Notices";
import { OverviewTab } from "./OverviewTab";
import { PracticeTab } from "./PracticeTab";
import { ResumeTab } from "./ResumeTab";
import { SideRail } from "./SideRail";
import { useCandidateDetail } from "./useCandidateDetail";

function StateCard({ children }: { children: React.ReactNode }) {
  return <Card style={{ boxShadow: "none", textAlign: "center", padding: 48 }}>{children}</Card>;
}

const stateText = { fontFamily: f.sans, fontSize: 14, color: t.neutralInk, margin: "0 0 16px" } as const;

export default function CandidateDetail({ requirementId, matchId }: { requirementId: string; matchId: string }) {
  const phone = useMaxWidth(640);
  const narrow = useMaxWidth(900);
  const { suspended } = useEmployerData();
  const d = useCandidateDetail(requirementId, matchId);
  const [activeTab, setActiveTab] = useState<CandidateTabKey>("overview");
  const [dialog, setDialog] = useState<"invite" | "reject" | null>(null);

  const { requirement, candidate } = d;
  const shortlistHref = `/employer/requirements/${requirementId}`;

  useEmployerBreadcrumb(
    requirement && candidate && !d.unavailable
      ? [{ label: requirement.title, path: shortlistHref }, { label: maskedName(candidate) }]
      : null,
  );

  const back = (
    <Link href={shortlistHref} style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.indigoDeep }}>
      ← Back to shortlist
    </Link>
  );

  if (d.loading) {
    return (
      <StateCard>
        <p role="status" style={{ ...stateText, margin: 0 }}>Loading candidate…</p>
      </StateCard>
    );
  }

  if (d.loadFailed || !requirement) {
    return (
      <StateCard>
        <p role="alert" style={stateText}>We couldn't load this candidate. Check your connection and try again.</p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
          <OutlineCta onClick={() => void d.reload()}>Try again</OutlineCta>
          {back}
        </div>
      </StateCard>
    );
  }

  if (!candidate || d.unavailable) {
    return (
      <StateCard>
        <p style={stateText}>
          {d.unavailable ? "This candidate is no longer available." : "Candidate not found."}
        </p>
        {back}
      </StateCard>
    );
  }

  const declined = d.declinedLocally;
  const evidenceState = { evidence: d.evidence, loading: d.evidenceLoading, failed: d.evidenceFailed, onRetry: d.reloadEvidence };
  const matchedSkills = matchedSkillCount(requirement.skills, candidate.skills);
  const unmatchedSkills = requirement.skills.filter((s) => !matchedSkills.some((m) => m.toLowerCase() === s.toLowerCase()));
  const fitReasons = buildFitReasons(candidate, requirement, matchedSkills);
  const avg = evidenceAverage(d.evidence);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {suspended && <SuspendedBanner />}
      {d.notice && !dialog && <ActionNoticeAlert notice={d.notice} shortlistHref={shortlistHref} />}

      <Card style={{ boxShadow: "none" }}>
        <CandidateHeader
          candidate={candidate}
          phone={phone}
          suspended={suspended}
          declined={declined}
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
      </Card>

      <CandidateDialogsHost
        dialog={dialog}
        onClose={() => setDialog(null)}
        displayName={maskedName(candidate)}
        requirementTitle={requirement.title}
        notice={d.notice}
        shortlistHref={shortlistHref}
        changeStatus={d.changeStatus}
      />

      <CandidateBrief
        sessions={candidate.sessionsCompleted}
        evidence={d.evidence}
        evidenceLoading={d.evidenceLoading}
        evidenceFailed={d.evidenceFailed}
        avg={avg}
        matchedSkills={matchedSkills}
        unmatchedSkills={unmatchedSkills}
      />

      <CandidateTabs active={activeTab} onChange={setActiveTab} phone={phone} />

      <div style={{ display: "grid", gridTemplateColumns: narrow ? "minmax(0, 1fr)" : "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 16, alignItems: "start", marginTop: -4 }}>
        {CANDIDATE_TABS.map((tb) => (
          <div
            key={tb.key}
            id={panelId(tb.key)}
            role="tabpanel"
            aria-labelledby={tabId(tb.key)}
            hidden={activeTab !== tb.key}
            tabIndex={0}
            style={{ display: activeTab === tb.key ? "flex" : "none", flexDirection: "column", gap: 16, minWidth: 0 }}
          >
            {activeTab === tb.key && tb.key === "overview" && (
              <OverviewTab candidate={candidate} fitReasons={fitReasons} requirementTitle={requirement.title} state={evidenceState} />
            )}
            {activeTab === tb.key && tb.key === "practice" && (
              <PracticeTab evidence={d.evidence} unlocked={candidate.unlocked} shortlistHref={shortlistHref} state={evidenceState} />
            )}
            {activeTab === tb.key && tb.key === "resume" && <ResumeTab candidate={candidate} phone={phone} shortlistHref={shortlistHref} />}
          </div>
        ))}
        <aside aria-label="Candidate details" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <SideRail candidate={candidate} shortlistHref={shortlistHref} />
        </aside>
      </div>
    </div>
  );
}
