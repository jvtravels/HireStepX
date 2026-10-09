"use client";

/* Full-page detail view for a single employer match, opened from a row in
   the Jobs table (DashboardJobs.tsx) or the dashboard's Employer Interest
   card. Mirrors the employer console's /employer/requirements/[id] page
   (back link, breadcrumb, header, content) with the candidate-relevant
   fields only. */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, GlobeIcon, LockIcon, SendIcon } from "lucide-react";
import { useMaxWidth } from "./hooks/useMaxWidth";
import { useAuth } from "./AuthContext";
import { authHeaders } from "./supabase";
import { useDashboardBreadcrumb } from "./DashboardLayout";
import { tokens as t, fonts as f, textSize } from "./auth/_tokens";
import { daysAgo, formatComp, formatExperience, WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "./hiringMatchFormat";
import { JobDetailRouteSkeleton } from "./routeSkeletons";
import { CompanyAvatar } from "./CompanyAvatar";
import type { JobMatch } from "./DashboardJobs";

const BACK_LINK_STYLE = { display: "inline-flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: 13, fontWeight: 500, color: t.inkSoft, textDecoration: "none" } as const;

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
              className="hover:underline underline-offset-4"
              style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: 13, color: t.indigo, minWidth: 0, wordBreak: "break-all" }}
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

function StateScreen({ title, message, children }: { title: string; message: string; children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 560, margin: "80px auto 0", textAlign: "center", padding: "0 16px", fontFamily: f.sans }}>
      <h1 style={{ fontSize: 28, color: t.coal, margin: "0 0 12px", fontWeight: 600 }}>{title}</h1>
      <p style={{ fontSize: 14, color: t.inkSoft, margin: "0 0 24px", lineHeight: 1.55 }}>{message}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>{children}</div>
    </div>
  );
}

export default function JobDetailPage() {
  const router = useRouter();
  const { id } = useParams() as { id?: string };
  const { user: authUser } = useAuth();
  const cacheKey = authUser?.id ? `hirestepx_cache_hiring_activity_full_${authUser.id}` : null;
  const [matches, setMatches] = useState<JobMatch[] | null>(() => {
    if (!cacheKey) return null;
    try {
      const cached = localStorage.getItem(cacheKey);
      return cached ? (JSON.parse(cached).recent ?? null) : null;
    } catch { return null; }
  });
  const [fetched, setFetched] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const load = useCallback(async (signal: { cancelled: boolean }) => {
    if (!cacheKey) return;
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/candidate-hiring-activity?full=1", { headers });
      const json = await res.json().catch(() => null);
      if (signal.cancelled) return;
      if (res.ok && json) {
        setMatches((json.recent as JobMatch[]) ?? []);
        try { localStorage.setItem(cacheKey, JSON.stringify(json)); } catch { /* expected: localStorage may be unavailable */ }
        setFetchError(false);
      } else {
        setFetchError(true);
      }
    } catch {
      if (!signal.cancelled) setFetchError(true);
    }
    if (!signal.cancelled) setFetched(true);
  }, [cacheKey]);

  useEffect(() => {
    const signal = { cancelled: false };
    load(signal);
    return () => { signal.cancelled = true; };
  }, [load]);

  const job = useMemo(() => matches?.find((m) => m.id === id) ?? null, [matches, id]);
  const stacked = useMaxWidth(820);

  useDashboardBreadcrumb(job ? [{ label: job.roleTitle }] : null);

  const backToJobs = () => router.push("/jobs");

  if (!job) {
    if (!fetched) return <JobDetailRouteSkeleton />;
    if (fetchError && !matches) {
      return (
        <StateScreen title="Couldn't load this job" message="Something went wrong fetching the details. This is usually temporary.">
          <Button type="button" size="lg" onClick={() => { setFetched(false); setFetchError(false); load({ cancelled: false }); }}>Try again</Button>
          <Button type="button" variant="outline" onClick={backToJobs}>Back to Jobs</Button>
        </StateScreen>
      );
    }
    return (
      <StateScreen title="Job not found" message="This opportunity may have been removed or is no longer available to you.">
        <Button type="button" size="lg" onClick={backToJobs}>Back to Jobs</Button>
      </StateScreen>
    );
  }

  const comp = formatComp(job.budgetMin, job.budgetMax, job.salaryType);
  const exp = formatExperience(job.experienceMin, job.experienceMax);
  const mode = job.workMode ? WORK_MODE_LABEL[job.workMode] || job.workMode : null;
  const jobType = job.employmentType ? EMPLOYMENT_TYPE_LABEL[job.employmentType] || job.employmentType : null;
  const closed = job.status === "closed" || job.status === "failed";

  const statLabel = (value: string | null, fallback: string) => (
    <span style={{ color: t.inkFaint, fontStyle: value ? "normal" : "italic" }}>{value || fallback}</span>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", width: "100%", padding: stacked ? "16px" : "20px 24px", fontFamily: f.sans }}>
      <Link href="/jobs" className="hover:underline underline-offset-4" style={BACK_LINK_STYLE}>
        <ArrowLeftIcon size={14} aria-hidden="true" /> Back to Jobs
      </Link>

      <div style={{ margin: "14px 0 12px" }}>
        <h1 style={{ fontFamily: f.sans, fontSize: 24, fontWeight: 700, color: t.coal, margin: 0 }}>{job.roleTitle}</h1>
        <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, marginTop: 4 }}>
          {job.location || "Location not specified"}{mode ? ` · ${mode}` : ""}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
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
    </div>
  );
}
