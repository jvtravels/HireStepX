"use client";

import { Button } from "@/components/ui/button";
import { KeyValueList, KeyValueRow, Panel } from "@/employer/_panelParts";
import type { JobMatch } from "../DashboardJobs";
import { daysAgo } from "../hiringMatchFormat";
import { recommendedFocusFor } from "../interviewInvite";
import { BODY_TIGHT, H2_FLUSH, PANEL_H2, SEC } from "./styles";

export function RoleDetails({ job }: { job: JobMatch }) {
  const postedLabel = job.postedAt ? daysAgo(job.postedAt) : null;
  const matchedLabel = daysAgo(job.matchedAt);
  return (
    <Panel id="job-details-heading" title="Role details" className={SEC} headingClassName={PANEL_H2}>
      <KeyValueList>
        {postedLabel && <KeyValueRow label="Posted">{postedLabel}</KeyValueRow>}
        {matchedLabel !== postedLabel && <KeyValueRow label="Matched">{matchedLabel}</KeyValueRow>}
        {job.openPositions != null && <KeyValueRow label="Openings" tip="How many people the employer plans to hire for this role.">{`${job.openPositions} opening${job.openPositions === 1 ? "" : "s"}`}</KeyValueRow>}
        {job.department && <KeyValueRow label="Department">{job.department}</KeyValueRow>}
        {job.durationWeeks != null && <KeyValueRow label="Duration">{`${job.durationWeeks} week${job.durationWeeks === 1 ? "" : "s"}`}</KeyValueRow>}
        {job.hoursPerWeek != null && <KeyValueRow label="Hours per week">{`${job.hoursPerWeek} hours`}</KeyValueRow>}
        {job.noticePeriodPref && !/^any$/i.test(job.noticePeriodPref) && <KeyValueRow label="Notice period" tip="The notice period the employer prefers.">{job.noticePeriodPref}</KeyValueRow>}
        {job.availability && job.availability !== "Any" && <KeyValueRow label="Availability" tip="The availability the employer prefers.">{job.availability}</KeyValueRow>}
        {job.preferredDomain && <KeyValueRow label="Domain">{job.preferredDomain}</KeyValueRow>}
        {job.portfolioPreferred && <KeyValueRow label="Portfolio / GitHub" tip="The employer would like to see work samples or public code.">Preferred</KeyValueRow>}
        {job.dueDate && <KeyValueRow label="Hiring by" tip="The date the employer wants to fill this role by.">{job.dueDate}</KeyValueRow>}
      </KeyValueList>
    </Panel>
  );
}

export function ClosedNotice({ onBack }: { onBack: () => void }) {
  return (
    <section aria-labelledby="job-closed-heading" className={SEC}>
      <h2 id="job-closed-heading" className={H2_FLUSH}>This role is closed</h2>
      <p className={BODY_TIGHT}>Your profile stays visible to other employers.</p>
      <Button type="button" variant="outline" className="mt-3" onClick={onBack}>See other matches</Button>
    </section>
  );
}

export function PrepareForRole({ job, onPractise }: { job: JobMatch; onPractise: () => void }) {
  const { focus, reason } = recommendedFocusFor(job);
  return (
    <section aria-labelledby="job-prepare-heading" className={SEC}>
      <h2 id="job-prepare-heading" className={H2_FLUSH}>Prepare for this role</h2>
      <p className={`${BODY_TIGHT} font-medium text-hx-coal`}>{focus}</p>
      <p className="m-0 mt-0.5 text-[13px] leading-5 text-hx-ink-soft">{reason}</p>
      <Button type="button" variant="outline" className="mt-3" onClick={onPractise}>Practise {focus}</Button>
    </section>
  );
}

export function StrengthenMatch({ onResume }: { onResume: () => void }) {
  return (
    <section aria-labelledby="job-strengthen-heading" className={SEC}>
      <h2 id="job-strengthen-heading" className={H2_FLUSH}>Strengthen your match</h2>
      <p className={BODY_TIGHT}>
        You can't apply to this role. Employers reach out when a profile stands out, so a stronger profile helps.
      </p>
      <Button type="button" variant="outline" className="mt-3" onClick={onResume}>Update your resume</Button>
    </section>
  );
}
