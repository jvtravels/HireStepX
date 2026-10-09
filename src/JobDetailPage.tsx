"use client";

/* Full-page detail view for a single employer match, opened from a row in
   the Jobs table (DashboardJobs.tsx) or the dashboard's Employer Interest
   card. Mirrors the employer console's /employer/requirements/[id] page:
   a header card (icon tile, title, icon meta row) beside a details card,
   with the breadcrumb (not a back link) as the way up. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  BriefcaseIcon, Building2Icon, CalendarIcon, ClockIcon, GlobeIcon, GraduationCapIcon,
  HourglassIcon, IndianRupeeIcon, LockIcon, MapPinIcon, SendIcon, UsersIcon,
} from "lucide-react";
import { useMaxWidth } from "./hooks/useMaxWidth";
import { useAuth } from "./AuthContext";
import { authHeaders } from "./supabase";
import { useDashboardBreadcrumb } from "./DashboardLayout";
import { tokens as t, fonts as f, textSize } from "./auth/_tokens";
import { daysAgo, formatComp, formatExperience, WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "./hiringMatchFormat";
import { JobDetailRouteSkeleton } from "./routeSkeletons";
import { CompanyAvatar } from "./CompanyAvatar";
import type { JobMatch } from "./DashboardJobs";

/* Same surface as the employer console's <Card> (white, 1px line, 16px
   radius, 24px padding, flat) so the two detail screens read as one product. */
const PANEL_STYLE = { background: t.white, border: `1px solid ${t.line}`, borderRadius: 16, padding: 24, minWidth: 0 } as const;
const SECTION_HEADING_STYLE = { fontFamily: f.sans, fontSize: 15, fontWeight: 600, color: t.coal, margin: "0 0 8px" } as const;
const BODY_TEXT_STYLE = { fontFamily: f.sans, fontSize: 14, color: t.coal, margin: 0, lineHeight: 1.6, whiteSpace: "pre-line", overflowWrap: "anywhere" } as const;
const EMPTY_TEXT_STYLE = { fontFamily: f.sans, fontSize: 13, color: t.inkFaint, fontStyle: "italic", margin: 0 } as const;

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 28, height: 28, borderRadius: 8, background: t.creamSoft, color: t.inkFaint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {children}
    </div>
  );
}

function Detail({ icon, label, value, muted }: { icon: React.ReactNode; label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
      <IconTile>{icon}</IconTile>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint }}>{label}</span>
        <span style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: 500, color: muted ? t.inkFaint : t.coal, fontStyle: muted ? "italic" : "normal", overflowWrap: "anywhere" }}>{value}</span>
      </div>
    </div>
  );
}

function StatusChip({ label, color, background }: { label: string; color: string; background: string }) {
  return (
    <span style={{ fontFamily: f.sans, fontSize: textSize.xs, fontWeight: 600, color, background, padding: "4px 10px", borderRadius: 999 }}>
      {label}
    </span>
  );
}

/* Who the employer is stays hidden until they've contacted the candidate
   (unlocked) — otherwise candidates could go around the platform. The server
   already redacts these fields for matched-only rows; the locked branch just
   explains why. */
function CompanyCard({ job, onMessage }: { job: JobMatch; onMessage: () => void }) {
  const websiteHost = job.companyWebsite ? job.companyWebsite.replace(/^https?:\/\//i, "").replace(/\/$/, "") : null;
  const websiteHref = job.companyWebsite && /^https?:\/\//i.test(job.companyWebsite) ? job.companyWebsite : job.companyWebsite ? `https://${job.companyWebsite}` : null;
  return (
    <aside
      aria-label="Company profile"
      style={{ ...PANEL_STYLE, display: "flex", flexDirection: "column", gap: 14 }}
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
  const hasBody = !!(job.description || job.responsibilities || job.niceToHave);
  const metaItem: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6 };

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", width: "100%", padding: stacked ? "16px" : "20px 24px", fontFamily: f.sans }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <section aria-labelledby="job-title" style={{ ...PANEL_STYLE, flex: "3 1 min(560px, 100%)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: "1 1 280px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: t.indigo100, color: t.indigo, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <BriefcaseIcon size={22} aria-hidden="true" />
              </div>
              <div style={{ minWidth: 0 }}>
                <h1 id="job-title" style={{ overflowWrap: "anywhere", fontFamily: f.sans, fontSize: "clamp(22px, 6vw, 28px)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, color: t.coal, margin: 0 }}>
                  {job.roleTitle}
                </h1>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 4, marginTop: 8, fontFamily: f.sans, fontSize: 14, fontWeight: 500, color: t.coal }}>
                  <span style={metaItem}>
                    <IndianRupeeIcon size={14} color={t.inkFaint} aria-hidden="true" />
                    {comp ? comp : <span style={{ color: t.inkFaint, fontStyle: "italic", fontWeight: 400 }}>Compensation not disclosed</span>}
                  </span>
                  <span style={metaItem}>
                    <MapPinIcon size={14} color={t.inkFaint} aria-hidden="true" />
                    {job.location || "Location not specified"}{mode ? ` · ${mode}` : ""}
                  </span>
                  {exp && (
                    <span style={metaItem}>
                      <GraduationCapIcon size={14} color={t.inkFaint} aria-hidden="true" /> {exp} exp
                    </span>
                  )}
                  {jobType && (
                    <span style={metaItem}>
                      <ClockIcon size={14} color={t.inkFaint} aria-hidden="true" /> {jobType}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {job.unlocked
                ? <StatusChip label="Contacted" color={t.indigoDeep} background={t.indigo100} />
                : <StatusChip label="Matched" color={t.successInk} background={t.success100} />}
              {closed && <StatusChip label="Role closed" color={t.inkSoft} background={t.creamSoft} />}
            </div>
          </div>

          {!job.unlocked && job.matchReason && (
            <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, margin: "16px 0 0", lineHeight: 1.5 }}>{job.matchReason}</p>
          )}

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${t.line}`, display: "flex", flexDirection: "column", gap: 20 }}>
            <section aria-label="Skills">
              <h2 style={SECTION_HEADING_STYLE}>Skills</h2>
              {job.skills.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {job.skills.map((s, i) => (
                    <span key={i} style={{ fontFamily: f.sans, fontSize: 12.5, color: t.coal, background: t.cream, border: `1px solid ${t.line}`, padding: "4px 10px", borderRadius: 999 }}>
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={EMPTY_TEXT_STYLE}>No specific skills listed for this role.</p>
              )}
            </section>

            {job.description && (
              <section aria-label="About the role">
                <h2 style={SECTION_HEADING_STYLE}>About the role</h2>
                <p style={BODY_TEXT_STYLE}>{job.description}</p>
              </section>
            )}
            {job.responsibilities && (
              <section aria-label="Responsibilities">
                <h2 style={SECTION_HEADING_STYLE}>Responsibilities</h2>
                <p style={BODY_TEXT_STYLE}>{job.responsibilities}</p>
              </section>
            )}
            {job.niceToHave && (
              <section aria-label="Nice to have">
                <h2 style={SECTION_HEADING_STYLE}>Nice to have</h2>
                <p style={{ ...BODY_TEXT_STYLE, color: t.inkSoft }}>{job.niceToHave}</p>
              </section>
            )}
            {!hasBody && <p style={EMPTY_TEXT_STYLE}>This employer hasn't added a role description yet.</p>}

            <section aria-label="Perks and benefits">
              <h2 style={SECTION_HEADING_STYLE}>Perks &amp; benefits</h2>
              {job.perksAndBenefits.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {job.perksAndBenefits.map((p, i) => (
                    <span key={i} style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, border: `1px solid ${t.line}`, padding: "4px 10px", borderRadius: 999 }}>
                      {p}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={EMPTY_TEXT_STYLE}>No perks or benefits listed.</p>
              )}
            </section>
          </div>

          <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, marginTop: 20, paddingTop: 14, borderTop: `1px solid ${t.line}` }}>
            {job.unlocked && job.unlockedAt
              ? `Contacted ${daysAgo(job.unlockedAt)} · matched ${daysAgo(job.matchedAt)}`
              : `Matched ${daysAgo(job.matchedAt)}`}
          </div>
        </section>

        <div style={{ flex: "1 1 260px", minWidth: 260, maxWidth: stacked ? "none" : 340, display: "flex", flexDirection: "column", gap: 16 }}>
          <CompanyCard job={job} onMessage={() => router.push(`/messages?matchId=${job.id}`)} />
          <section aria-labelledby="job-details-heading" style={PANEL_STYLE}>
            <h2 id="job-details-heading" style={{ ...SECTION_HEADING_STYLE, margin: 0 }}>Role details</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
              <Detail
                icon={<UsersIcon size={14} aria-hidden="true" />}
                label="Openings"
                value={job.openPositions != null ? `${job.openPositions} opening${job.openPositions === 1 ? "" : "s"}` : "Not specified"}
                muted={job.openPositions == null}
              />
              <Detail
                icon={<HourglassIcon size={14} aria-hidden="true" />}
                label="Notice period"
                value={job.noticePeriodPref || "Not specified"}
                muted={!job.noticePeriodPref}
              />
              <Detail
                icon={<Building2Icon size={14} aria-hidden="true" />}
                label="Industry"
                value={job.preferredIndustry || "Any industry"}
                muted={!job.preferredIndustry}
              />
              <Detail
                icon={<CalendarIcon size={14} aria-hidden="true" />}
                label="Timeline"
                value={job.dueDate ? `Hiring by ${job.dueDate}` : "Open-ended timeline"}
                muted={!job.dueDate}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
