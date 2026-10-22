"use client";

import { LockIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { JobMatch } from "./DashboardJobs";

/* Until an employer has contacted the candidate (unlocked), the company's
   identity stays hidden — the server already redacts name/logo/website, this
   just renders a neutral placeholder instead of a "C" initial for the
   redacted name. */
export function CompanyAvatar({ job, size }: { job: Pick<JobMatch, "unlocked" | "companyName" | "companyLogoPath">; size: number }) {
  return (
    <Avatar style={{ width: size, height: size }}>
      {job.unlocked && job.companyLogoPath && <AvatarImage src={job.companyLogoPath} alt={`${job.companyName} logo`} loading="lazy" />}
      <AvatarFallback aria-hidden="true" className={`bg-hx-soft font-semibold text-hx-ink-soft ${size >= 40 ? "text-[16px]" : "text-[13px]"}`}>
        {job.unlocked ? job.companyName.charAt(0).toUpperCase() : <LockIcon size={Math.round(size * 0.4)} />}
      </AvatarFallback>
    </Avatar>
  );
}
