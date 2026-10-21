"use client";

import { ClockIcon, GlobeIcon, IndianRupeeIcon, MapPinIcon, SendIcon, TrendingUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/employer/_atoms";
import { InfoTip, MetaLine, type MetaPart } from "@/employer/_panelParts";
import { CompanyAvatar } from "../CompanyAvatar";
import type { JobMatch } from "../DashboardJobs";
import { formatComp, formatExperience, WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "../hiringMatchFormat";
import { SEC } from "./styles";

/* Who the employer is stays hidden until they've contacted the candidate
   (unlocked) — otherwise candidates could go around the platform. The server
   already redacts these fields for matched-only rows; the locked branch just
   explains why. */
function CompanyLine({ job }: { job: JobMatch }) {
  const websiteHost = job.companyWebsite ? job.companyWebsite.replace(/^https?:\/\//i, "").replace(/\/$/, "") : null;
  const websiteHref = job.companyWebsite && /^https?:\/\//i.test(job.companyWebsite) ? job.companyWebsite : job.companyWebsite ? `https://${job.companyWebsite}` : null;
  return (
    <div role="group" aria-label="Company" className="flex min-w-0 items-center gap-3">
      <CompanyAvatar job={job} size={36} />
      <div className="min-w-0">
        <div className="break-words text-[14px] font-semibold leading-5 text-hx-coal">{job.companyName}</div>
        <div className="flex flex-wrap items-center gap-x-2 text-[12px] leading-[18px] text-hx-ink-soft">
          {job.unlocked ? (
            <>
              {job.preferredIndustry && <span>{job.preferredIndustry}</span>}
              {websiteHref && websiteHost && (
                <a href={websiteHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 break-all text-hx-indigo underline-offset-4 hover:underline">
                  <GlobeIcon size={12} aria-hidden="true" className="shrink-0" />
                  {websiteHost}
                </a>
              )}
            </>
          ) : (
            <>
              <span>Company hidden</span>
              <InfoTip label="Why the company is hidden">Company details are shared once this employer shows interest.</InfoTip>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function JobHeader({ job, closed, showMessage, onMessage, actions }: {
  job: JobMatch;
  closed: boolean;
  showMessage: boolean;
  onMessage: () => void;
  actions: React.ReactNode;
}) {
  const comp = formatComp(job.budgetMin, job.budgetMax, job.salaryType);
  const exp = formatExperience(job.experienceMin, job.experienceMax);
  const mode = job.workMode ? WORK_MODE_LABEL[job.workMode] || job.workMode : null;
  const jobType = job.employmentType ? EMPLOYMENT_TYPE_LABEL[job.employmentType] || job.employmentType : null;
  const hasFit = !!job.matchFactors && job.matchFactors.factors.length > 0;
  const meta: MetaPart[] = [
    { icon: MapPinIcon, text: `${job.location || "Location not specified"}${mode ? ` · ${mode}` : ""}` },
    ...(jobType ? [{ icon: ClockIcon, text: jobType }] : []),
    ...(exp ? [{ icon: TrendingUpIcon, text: `${exp} exp` }] : []),
    {
      icon: IndianRupeeIcon,
      text: comp
        ? <>{comp}{comp.includes("LPA") && <InfoTip label="What LPA means">LPA is lakhs per annum: the yearly salary, in lakhs of rupees.</InfoTip>}</>
        : <span className="text-hx-ink-soft">Compensation not disclosed</span>,
    },
  ];
  const status = closed
    ? { label: "Role closed", tone: "neutral" as const, tip: "The employer has closed this role. Your profile stays visible to other employers." }
    : job.unlocked
      ? { label: "Employer interested", tone: "brand" as const, tip: "This employer viewed your profile and can message you." }
      : { label: "Matched", tone: "success" as const, tip: "Your profile fits this role. The employer hasn't contacted you yet." };
  return (
    <section aria-labelledby="job-title" className={SEC}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <CompanyLine job={job} />
        <div className="flex shrink-0 items-center gap-2">
          {showMessage && (
            <Button size="sm" onClick={onMessage} className="flex items-center gap-1.5">
              <SendIcon size={13} aria-hidden="true" /> Message employer
            </Button>
          )}
          {actions}
        </div>
      </div>
      <div className="mt-5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <h1 id="job-title" className="m-0 text-[20px] font-semibold leading-tight text-hx-coal [overflow-wrap:anywhere]">
          {job.roleTitle}
        </h1>
        <Badge tone={status.tone}>
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
          {status.label}
        </Badge>
        <InfoTip label={`About ${status.label.toLowerCase()}`}>{status.tip}</InfoTip>
      </div>
      <MetaLine parts={meta} className="mt-3" />
      {!job.unlocked && job.matchReason && !hasFit && (
        <p className="m-0 mt-2 max-w-[75ch] text-[14px] leading-[22px] text-hx-ink-soft">{job.matchReason}</p>
      )}
    </section>
  );
}
