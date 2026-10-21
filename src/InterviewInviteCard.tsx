"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { tokens as t, fonts as f } from "./auth/_tokens";
import { generateICS } from "./dashboardHelpers";
import type { JobMatch } from "./DashboardJobs";
import { inviteEvent, invitePracticeHref, stashInviteJd } from "./interviewInvite";
import { formatInterviewWhen, isDateOnlyInstant, isInterviewPast } from "./interviewWhen";

const HEADING_STYLE = { fontFamily: f.sans, fontSize: 15, fontWeight: 600, color: t.coal, margin: 0 } as const;
const BODY_STYLE = { fontFamily: f.sans, fontSize: 14, color: t.coal, margin: "10px 0 0", lineHeight: 1.6 } as const;
const ACTIONS_STYLE = { display: "flex", flexDirection: "column", gap: 8, marginTop: 12 } as const;

function downloadIcs(job: JobMatch) {
  const event = inviteEvent(job);
  const ics = event ? generateICS(event) : "";
  if (!ics) return;
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `interview-${job.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InterviewInviteCard({ job, className }: { job: JobMatch; className?: string }) {
  const router = useRouter();
  const iso = job.interviewScheduledAt;
  const hasTime = !!iso && !Number.isNaN(new Date(iso).getTime());
  const past = hasTime && isInterviewPast(iso);
  const dateOnly = hasTime && isDateOnlyInstant(iso);
  let body = `${job.companyName} wants to move forward. Reply in messages to agree a time.`;
  if (hasTime) {
    const when = formatInterviewWhen(iso, "full");
    body = past
      ? `${job.companyName} suggested ${when}, which has passed. Check your messages for a new time.`
      : dateOnly
        ? `${job.companyName} suggested ${when}. They have not set a time yet, so reply in messages to agree one.`
        : `${job.companyName} suggested ${when}. Reply in messages to confirm or propose another time.`;
  }
  return (
    <section aria-labelledby="job-invite-heading" className={className}>
      <h2 id="job-invite-heading" style={HEADING_STYLE}>{past ? "Interview date has passed" : "You're invited to interview"}</h2>
      <p style={BODY_STYLE}>{body}</p>
      <div style={ACTIONS_STYLE}>
        {!past && <Button type="button" onClick={() => { stashInviteJd(job); router.push(invitePracticeHref(job)); }}>Practise for this interview</Button>}
        {hasTime && !past && <Button type="button" variant="outline" onClick={() => downloadIcs(job)}>Add to calendar</Button>}
        <Button type="button" variant={past ? "default" : "outline"} onClick={() => router.push(`/messages?matchId=${encodeURIComponent(job.id)}`)}>Open messages</Button>
      </div>
    </section>
  );
}
