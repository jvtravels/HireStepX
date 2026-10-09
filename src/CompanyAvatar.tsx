"use client";

import { LockIcon } from "lucide-react";
import { tokens as t, fonts as f, textSize } from "./auth/_tokens";
import type { JobMatch } from "./DashboardJobs";

/* Until an employer has contacted the candidate (unlocked), the company's
   identity stays hidden — the server already redacts name/logo/website, this
   just renders a neutral placeholder instead of a "C" initial for the
   redacted name. */
export function CompanyAvatar({ job, size }: { job: Pick<JobMatch, "unlocked" | "companyName" | "companyLogoPath">; size: number }) {
  const base: React.CSSProperties = { width: size, height: size, borderRadius: "50%", flexShrink: 0, border: `1px solid ${t.line}` };
  if (job.unlocked && job.companyLogoPath) {
    return <img src={job.companyLogoPath} alt={`${job.companyName} logo`} width={size} height={size} loading="lazy" style={{ ...base, objectFit: "cover" }} />;
  }
  return (
    <div
      aria-hidden="true"
      style={{
        ...base, background: t.creamSoft, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: f.sans, fontSize: size >= 40 ? textSize.lg : textSize.sm, fontWeight: 600, color: t.inkSoft,
      }}
    >
      {job.unlocked ? job.companyName.charAt(0).toUpperCase() : <LockIcon size={Math.round(size * 0.4)} />}
    </div>
  );
}
