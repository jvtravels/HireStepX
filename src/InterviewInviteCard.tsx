"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { tokens as t, fonts as f } from "./auth/_tokens";
import { generateICS } from "./dashboardHelpers";
import type { JobMatch } from "./DashboardJobs";
import { inviteEvent, invitePracticeHref } from "./interviewInvite";

const CARD_STYLE = { background: t.white, border: `1px solid ${t.line}`, borderRadius: 16, padding: 24, minWidth: 0 } as const;
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

export default function InterviewInviteCard({ job }: { job: JobMatch }) {
  const router = useRouter();
  const when = job.interviewScheduledAt ? new Date(job.interviewScheduledAt) : null;
  const hasTime = when !== null && !Number.isNaN(when.getTime());
  return (
    <section aria-labelledby="job-invite-heading" style={CARD_STYLE}>
      <h2 id="job-invite-heading" style={HEADING_STYLE}>You're invited to interview</h2>
      <p style={BODY_STYLE}>
        {hasTime
          ? `${job.companyName} suggested ${when.toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })}. Reply in messages to confirm or propose another time.`
          : `${job.companyName} wants to move forward. Reply in messages to agree a time.`}
      </p>
      <div style={ACTIONS_STYLE}>
        <Button type="button" onClick={() => router.push(invitePracticeHref(job))}>Practise for this interview</Button>
        {hasTime && <Button type="button" variant="outline" onClick={() => downloadIcs(job)}>Add to calendar</Button>}
        <Button type="button" variant="outline" onClick={() => router.push(`/messages?matchId=${encodeURIComponent(job.id)}`)}>Open messages</Button>
      </div>
    </section>
  );
}
