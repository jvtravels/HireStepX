"use client";

/* Full-detail dialog opened by clicking a row in the Jobs tab table
   (DashboardJobs.tsx). Built on the shared shadcn Dialog (Radix) instead
   of a hand-rolled backdrop/focus-trap, so Escape, outside-click, and
   focus trapping come from the same primitive every other dialog in the
   app uses. */

import { useRouter } from "next/navigation";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GlobeIcon, LockIcon, SendIcon, XIcon } from "lucide-react";
import { useMaxWidth } from "./hooks/useMaxWidth";
import { tokens as t, fonts as f, textSize } from "./auth/_tokens";
import { daysAgo, formatComp, formatExperience, WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "./hiringMatchFormat";
import { CompanyAvatar } from "./CompanyAvatar";
import type { JobMatch } from "./DashboardJobs";

/* Who the employer is stays hidden until they've contacted the candidate
   (unlocked) — otherwise candidates could go around the platform. The server
   already redacts these fields for matched-only rows; the locked branch just
   explains why. */
function CompanyCard({ job, stacked, onMessage }: { job: JobMatch; stacked: boolean; onMessage: () => void }) {
  const websiteHost = job.companyWebsite ? job.companyWebsite.replace(/^https?:\/\//i, "").replace(/\/$/, "") : null;
  const websiteHref = job.companyWebsite && /^https?:\/\//i.test(job.companyWebsite) ? job.companyWebsite : job.companyWebsite ? `https://${job.companyWebsite}` : null;
  return (
    <aside
      aria-label="Company profile"
      style={{
        width: stacked ? "100%" : 280, flexShrink: 0, border: `1px solid ${t.line}`, borderRadius: 12,
        background: t.white, padding: 18, display: "flex", flexDirection: "column", gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <CompanyAvatar job={job} size={48} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 700, color: t.coal, wordBreak: "break-word" }}>{job.companyName}</div>
          {job.preferredIndustry && (
            <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint, marginTop: 2 }}>{job.preferredIndustry}</div>
          )}
        </div>
      </div>
      {job.unlocked ? (
        <>
          {websiteHref && websiteHost && (
            <a
              href={websiteHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: 13, color: t.indigo, textDecoration: "none", minWidth: 0, wordBreak: "break-all" }}
              onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
              onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
            >
              <GlobeIcon size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
              {websiteHost}
            </a>
          )}
          <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, margin: 0, lineHeight: 1.5 }}>
            This employer has viewed your profile and can reach you directly.
          </p>
          <Button variant="outline" size="sm" onClick={onMessage} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SendIcon size={13} aria-hidden="true" /> Message employer
          </Button>
        </>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <LockIcon size={14} color={t.inkFaint} aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
          <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, margin: 0, lineHeight: 1.5 }}>
            Company details are shared once this employer contacts you. Keep practising to rank higher in their search.
          </p>
        </div>
      )}
    </aside>
  );
}

export default function JobDetailModal({ job, onClose }: { job: JobMatch; onClose: () => void }) {
  const router = useRouter();
  const stacked = useMaxWidth(820);
  const comp = formatComp(job.budgetMin, job.budgetMax, job.salaryType);
  const exp = formatExperience(job.experienceMin, job.experienceMax);
  const mode = job.workMode ? WORK_MODE_LABEL[job.workMode] || job.workMode : null;
  const jobType = job.employmentType ? EMPLOYMENT_TYPE_LABEL[job.employmentType] || job.employmentType : null;
  const closed = job.status === "closed" || job.status === "failed";

  const statLabel = (value: string | null, fallback: string) => (
    <span style={{ color: t.inkFaint, fontStyle: value ? "normal" : "italic" }}>{value || fallback}</span>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        style={{
          display: "block",
          background: t.creamRaised, border: `1px solid ${t.line}`, borderRadius: 16,
          padding: "28px 26px", maxWidth: 920, width: "100%", maxHeight: "88vh", overflowY: "auto",
        }}
      >
        <DialogDescription className="sr-only">
          Full role details for {job.roleTitle}{job.unlocked ? ` at ${job.companyName}` : ""}
        </DialogDescription>
        <DialogClose asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Close dialog" style={{ position: "absolute", top: 14, right: 14 }}>
            <XIcon aria-hidden="true" />
          </Button>
        </DialogClose>

        <div style={{ marginBottom: 16, paddingRight: 32 }}>
          <DialogTitle style={{ fontFamily: f.sans, fontSize: 22, fontWeight: 700, color: t.coal, margin: 0 }}>
            {job.roleTitle}
          </DialogTitle>
          <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, marginTop: 4 }}>
            {job.location || "Location not specified"}{mode ? ` · ${mode}` : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          {job.unlocked ? (
            <span style={{ fontFamily: f.sans, fontSize: textSize.xs, fontWeight: 600, color: t.indigoDeep, background: t.indigo100, padding: "4px 10px", borderRadius: 999 }}>
              Contacted
            </span>
          ) : (
            <span style={{ fontFamily: f.sans, fontSize: textSize.xs, fontWeight: 600, color: t.successInk, background: t.success100, padding: "4px 10px", borderRadius: 999 }}>
              Matched
            </span>
          )}
          {closed && (
            <span style={{ fontFamily: f.sans, fontSize: textSize.xs, fontWeight: 600, color: t.inkSoft, background: t.creamSoft, padding: "4px 10px", borderRadius: 999 }}>
              Role closed
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: stacked ? "column-reverse" : "row", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0, width: "100%" }}>
        {!job.unlocked && (
          <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, margin: "0 0 16px", lineHeight: 1.5 }}>
            {job.matchReason}
          </p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", fontFamily: f.sans, fontSize: 13, marginBottom: 18, paddingBottom: 18, borderBottom: `1px solid ${t.line}` }}>
          <div>{statLabel(comp, "Compensation not disclosed")}</div>
          <div>{statLabel(exp ? `${exp} exp` : null, "Experience not specified")}</div>
          <div>{statLabel(jobType, "Employment type not specified")}</div>
          <div>{statLabel(job.openPositions != null ? `${job.openPositions} opening${job.openPositions === 1 ? "" : "s"}` : null, "Openings not specified")}</div>
          <div>
            <span style={{ color: t.inkFaint, fontStyle: job.noticePeriodPref ? "normal" : "italic" }}>
              Notice: {job.noticePeriodPref || "Not specified"}
            </span>
          </div>
          <div>{statLabel(job.preferredIndustry, "Any industry")}</div>
          <div>{statLabel(job.dueDate ? `Hiring by ${job.dueDate}` : null, "Open-ended timeline")}</div>
        </div>

        {job.skills.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {job.skills.map((s, i) => (
              <span key={i} style={{ fontFamily: f.sans, fontSize: 11.5, color: t.coal, background: t.cream, border: `1px solid ${t.line}`, padding: "3px 9px", borderRadius: 999 }}>
                {s}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, fontStyle: "italic", margin: "0 0 16px" }}>
            No specific skills listed for this role.
          </p>
        )}

        {job.description && (
          <p style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, margin: "0 0 12px", lineHeight: 1.6 }}>
            {job.description}
          </p>
        )}

        {job.responsibilities && (
          <p style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, margin: "0 0 12px", lineHeight: 1.6 }}>
            <strong>Responsibilities: </strong>{job.responsibilities}
          </p>
        )}

        {job.niceToHave && (
          <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, margin: "0 0 12px", lineHeight: 1.55 }}>
            <strong style={{ color: t.coal }}>Nice to have: </strong>{job.niceToHave}
          </p>
        )}

        {!job.description && !job.responsibilities && !job.niceToHave && (
          <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, fontStyle: "italic", margin: "0 0 12px" }}>
            This employer hasn't added a role description yet.
          </p>
        )}

        {job.perksAndBenefits.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {job.perksAndBenefits.map((p, i) => (
              <span key={i} style={{ fontFamily: f.sans, fontSize: 11, color: t.inkSoft, border: `1px solid ${t.line}`, padding: "2px 9px", borderRadius: 999 }}>
                {p}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ fontFamily: f.sans, fontSize: 11.5, color: t.inkFaint, fontStyle: "italic", margin: "0 0 14px" }}>
            No perks or benefits listed.
          </p>
        )}

        </div>
        <CompanyCard job={job} stacked={stacked} onMessage={() => router.push(`/messages?matchId=${job.id}`)} />
        </div>

        <div style={{ fontFamily: f.sans, fontSize: 11, color: t.inkFaint, paddingTop: 12, marginTop: 18, borderTop: `1px solid ${t.line}` }}>
          {job.unlocked && job.unlockedAt
            ? `Contacted ${daysAgo(job.unlockedAt)} · matched ${daysAgo(job.matchedAt)}`
            : `Matched ${daysAgo(job.matchedAt)}`}
        </div>
      </DialogContent>
    </Dialog>
  );
}
