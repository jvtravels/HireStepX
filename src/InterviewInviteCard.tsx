"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateICS } from "./dashboardHelpers";
import type { JobMatch } from "./DashboardJobs";
import { inviteEvent, invitePracticeHref, stashInviteJd } from "./interviewInvite";
import { formatInterviewWhen, isDateOnlyInstant, isInterviewPast } from "./interviewWhen";

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

/* A functional status band: the one place on the page that asks the candidate to act. */
export default function InterviewInviteCard({ job, className }: { job: JobMatch; className?: string }) {
  const router = useRouter();
  const iso = job.interviewScheduledAt;
  const hasTime = !!iso && !Number.isNaN(new Date(iso).getTime());
  const past = hasTime && isInterviewPast(iso);
  const dateOnly = hasTime && isDateOnlyInstant(iso);
  let body = "Reply in messages to agree a time.";
  if (hasTime) {
    const when = formatInterviewWhen(iso, "full");
    body = past
      ? `The suggested time, ${when}, has passed.`
      : dateOnly
        ? `Suggested ${when}. No time is set yet, so reply in messages to agree one.`
        : `Suggested ${when}. Reply in messages to confirm or propose another time.`;
  }
  const messages = () => router.push(`/messages?matchId=${encodeURIComponent(job.id)}`);
  return (
    <section aria-labelledby="job-invite-heading" className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-hx-indigo-100/60 ${className ?? ""}`}>
      <div className="min-w-0 flex-1 basis-64">
        <h2 id="job-invite-heading" className="m-0 text-[15px] font-semibold leading-6 text-hx-coal">
          {past ? "Interview date has passed" : "You're invited to interview"}
        </h2>
        <p className="m-0 mt-0.5 text-[14px] leading-[22px] text-hx-neutral-ink">{body}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {!past && <Button type="button" onClick={() => { stashInviteJd(job); router.push(invitePracticeHref(job)); }}>Practise for this interview</Button>}
        {hasTime && !past && <Button type="button" variant="outline" onClick={() => downloadIcs(job)}>Add to calendar</Button>}
        <Button type="button" variant={past ? "default" : "outline"} onClick={messages}>{past ? "Ask for a new time" : "Open messages"}</Button>
      </div>
    </section>
  );
}
