"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateICS } from "./dashboardHelpers";
import { useFocusRounds } from "./DashboardContext";
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
  const focusRounds = useFocusRounds();
  const iso = job.interviewScheduledAt;
  const hasTime = !!iso && !Number.isNaN(new Date(iso).getTime());
  const past = hasTime && isInterviewPast(iso);
  const dateOnly = hasTime && isDateOnlyInstant(iso);
  const when = hasTime ? formatInterviewWhen(iso, "full") : null;
  const body = past
    ? "Ask the employer for a new time in messages."
    : dateOnly
      ? "No time is set yet. Reply in messages to agree one."
      : hasTime
        ? "Reply in messages to confirm or propose another time."
        : "Reply in messages to agree a time.";
  const messages = () => router.push(`/messages?matchId=${encodeURIComponent(job.id)}`);
  return (
    <section aria-labelledby="job-invite-heading" className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-4 bg-hx-indigo-100/60 ${className ?? ""}`}>
      <div className="min-w-0 flex-1 basis-64">
        <h2 id="job-invite-heading" className="m-0 text-[16px] font-semibold leading-6 text-hx-coal">
          {past ? "Interview date has passed" : "You're invited to interview"}
        </h2>
        {when && <p className="m-0 mt-1 text-[13px] font-medium leading-5 text-hx-coal">{past ? `Was ${when}` : when}</p>}
        <p className="m-0 mt-1 text-[14px] leading-[22px] text-hx-neutral-ink">{body}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!past && <Button type="button" variant="ghost" onClick={() => { stashInviteJd(job); router.push(invitePracticeHref(job, focusRounds)); }}>Practise</Button>}
        {hasTime && !past && <Button type="button" variant="outline" onClick={() => downloadIcs(job)}>Add to calendar</Button>}
        <Button type="button" onClick={messages}>{past ? "Ask for a new time" : "Open messages"}</Button>
      </div>
    </section>
  );
}
