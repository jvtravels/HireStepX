"use client";

/* Dedicated Jobs tab — the full-detail counterpart to the dashboard's
   HiringActivityCard teaser. Companies pick candidates off the talent
   roster; there's no apply flow, so this page is a read-only, complete
   view of every match: full role detail, employer branding, and status,
   rather than the top-3 summary shown on the dashboard. Fetches
   /api/candidate-hiring-activity?full=1 to get the uncapped list plus
   the extra fields (notice period, responsibilities, perks, etc.) the
   dashboard card doesn't render. */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authHeaders } from "./supabase";
import { tokens as t, fonts as f } from "./auth/_tokens";
import { daysAgo, formatComp, formatExperience, WORK_MODE_LABEL } from "./hiringMatchFormat";

interface JobMatch {
  roleTitle: string;
  companyName: string;
  companyLogoPath: string | null;
  companyWebsite: string | null;
  location: string;
  workMode: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  experienceMin: number | null;
  experienceMax: number | null;
  skills: string[];
  noticePeriodPref: string | null;
  openPositions: number | null;
  responsibilities: string | null;
  niceToHave: string | null;
  perksAndBenefits: string[];
  preferredIndustry: string | null;
  status: string | null;
  matchScore: number;
  unlocked: boolean;
  matchedAt: string;
  unlockedAt: string | null;
}

interface HiringActivity {
  discoverable: boolean;
  shortlistedCount?: number;
  unlockedCount?: number;
  recent?: JobMatch[];
}

export default function DashboardJobs() {
  const router = useRouter();
  const [data, setData] = useState<HiringActivity | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch("/api/candidate-hiring-activity?full=1", { headers });
        const json = await res.json().catch(() => null);
        if (!cancelled) {
          if (res.ok && json) setData(json as HiringActivity);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const heading = (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{ fontFamily: f.serif, fontSize: 28, color: t.coal, margin: "0 0 6px" }}>Jobs</h1>
      <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, margin: 0, lineHeight: 1.5 }}>
        Employers on our talent roster match to your profile and reach out directly — there's nothing to apply to here.
      </p>
    </div>
  );

  if (!loaded) {
    return <div style={{ maxWidth: 760 }}>{heading}</div>;
  }

  if (!data || !data.discoverable) {
    return (
      <div style={{ maxWidth: 760 }}>
        {heading}
        <div style={{ padding: 20, background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 10 }}>
          <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.coal, margin: "0 0 8px", lineHeight: 1.5 }}>
            Turn on "Visible to employers" in Settings to let companies on our talent roster match you to open roles.
          </p>
          <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, margin: "0 0 14px", lineHeight: 1.5 }}>
            Once on, employers with a matching role see your resume, skills, and practice history — and can unlock your
            contact details to reach out directly. You can turn it back off anytime.
          </p>
          <button
            type="button"
            onClick={() => router.push("/settings")}
            style={{
              padding: "8px 14px", borderRadius: 8, border: `1px solid ${t.lineStrong}`,
              background: "transparent", color: t.coal, fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}
          >
            Open Settings
          </button>
        </div>
      </div>
    );
  }

  const shortlisted = data.shortlistedCount ?? 0;
  const unlocked = data.unlockedCount ?? 0;
  const matches = data.recent || [];

  return (
    <div style={{ maxWidth: 760 }}>
      {heading}

      {shortlisted === 0 ? (
        <div style={{ padding: 20, background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: 10 }}>
          <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, margin: 0, lineHeight: 1.5 }}>
            You're visible to employers. No matches yet — we'll surface this the moment a role fits your profile.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 28, marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${t.line}` }}>
            <div>
              <div style={{ fontFamily: f.serif, fontSize: 30, color: t.coal, lineHeight: 1 }}>{shortlisted}</div>
              <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 3 }}>Shortlisted for</div>
            </div>
            <div>
              <div style={{ fontFamily: f.serif, fontSize: 30, color: t.coal, lineHeight: 1 }}>{unlocked}</div>
              <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 3 }}>Contacted you</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {matches.map((r, i) => {
              const comp = formatComp(r.budgetMin, r.budgetMax);
              const exp = formatExperience(r.experienceMin, r.experienceMax);
              const mode = r.workMode ? WORK_MODE_LABEL[r.workMode] || r.workMode : null;
              const closed = r.status === "closed" || r.status === "failed";
              return (
                <div
                  key={i}
                  style={{
                    padding: "18px", borderRadius: 10,
                    background: r.unlocked ? t.indigo100 : t.creamSoft,
                    border: `1px solid ${r.unlocked ? t.indigoDeep : t.line}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: f.sans, fontSize: 16, fontWeight: 700, color: t.coal }}>
                        {r.roleTitle}
                      </div>
                      <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 2 }}>
                        {r.companyWebsite ? (
                          <a href={r.companyWebsite} target="_blank" rel="noopener noreferrer" style={{ color: t.inkSoft, textDecoration: "underline" }}>
                            {r.companyName}
                          </a>
                        ) : r.companyName}
                        {r.location ? ` · ${r.location}` : ""}{mode ? ` · ${mode}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                      {r.unlocked ? (
                        <span style={{
                          fontFamily: f.mono, fontSize: 10.5, letterSpacing: 0.4, color: t.indigoDeep,
                          background: t.cream, padding: "3px 9px", borderRadius: 999,
                        }}>
                          CONTACTED
                        </span>
                      ) : (
                        <span style={{
                          fontFamily: f.mono, fontSize: 10.5, letterSpacing: 0.4, color: t.inkSoft,
                          background: t.cream, padding: "3px 9px", borderRadius: 999,
                        }}>
                          {r.matchScore}% MATCH
                        </span>
                      )}
                      {closed && !r.unlocked && (
                        <span style={{
                          fontFamily: f.mono, fontSize: 10, letterSpacing: 0.4, color: t.inkFaint,
                          background: t.cream, padding: "2px 8px", borderRadius: 999,
                        }}>
                          ROLE CLOSED
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontFamily: f.sans, fontSize: 12, color: t.inkFaint, marginBottom: 10 }}>
                    {comp && <span>{comp}</span>}
                    {exp && <span>{exp} exp</span>}
                    {r.openPositions != null && <span>{r.openPositions} opening{r.openPositions === 1 ? "" : "s"}</span>}
                    {r.noticePeriodPref && <span>Notice: {r.noticePeriodPref}</span>}
                    {r.preferredIndustry && <span>{r.preferredIndustry}</span>}
                  </div>

                  {r.skills.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                      {r.skills.map((s, si) => (
                        <span key={si} style={{
                          fontFamily: f.sans, fontSize: 11, color: t.coal, background: t.cream,
                          border: `1px solid ${t.line}`, padding: "3px 8px", borderRadius: 999,
                        }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {r.responsibilities && (
                    <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.coal, margin: "0 0 8px", lineHeight: 1.55 }}>
                      {r.responsibilities}
                    </p>
                  )}

                  {r.niceToHave && (
                    <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, margin: "0 0 8px", lineHeight: 1.5 }}>
                      <strong style={{ color: t.coal }}>Nice to have: </strong>{r.niceToHave}
                    </p>
                  )}

                  {r.perksAndBenefits.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      {r.perksAndBenefits.map((p, pi) => (
                        <span key={pi} style={{
                          fontFamily: f.sans, fontSize: 10.5, color: t.inkSoft, background: "transparent",
                          border: `1px solid ${t.line}`, padding: "2px 8px", borderRadius: 999,
                        }}>
                          {p}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ fontFamily: f.sans, fontSize: 10.5, color: t.inkFaint, marginTop: 4 }}>
                    {r.unlocked && r.unlockedAt
                      ? `Contacted ${daysAgo(r.unlockedAt)} · matched ${daysAgo(r.matchedAt)}`
                      : `Matched ${daysAgo(r.matchedAt)}`}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
