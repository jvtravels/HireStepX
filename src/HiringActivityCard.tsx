"use client";

/* Dashboard "Employer Interest" card — the candidate-facing half of the
   employer talent-roster feature. A 4-up grid of the most recent matches
   (role, company, employment type, relative time) behind an indigo "N
   Invites" pill, driven by the real shortlisted/recent counts. Fetches
   /api/candidate-hiring-activity. */

import { useRouter } from "next/navigation";
import { tokens as t, fonts as f, textSize } from "./auth/_tokens";
import { dur, ease } from "./_motion";
import { hoursOrDaysAgo, EMPLOYMENT_TYPE_LABEL } from "./hiringMatchFormat";
import { useHiringActivity } from "./useHiringActivity";
import { Button } from "@/components/ui/button";

// Cycles through 4 existing status tokens so every badge is sourced from
// the design system rather than a one-off hex literal.
const BADGE_COLORS = [
  { bg: t.info100, fg: t.info },
  { bg: t.success100, fg: t.success },
  { bg: t.violet100, fg: t.violet },
  { bg: t.error100, fg: t.error },
];

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function employmentLabel(type: string | null): string | null {
  if (!type) return null;
  return EMPLOYMENT_TYPE_LABEL[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

export default function HiringActivityCard() {
  const router = useRouter();
  const data = useHiringActivity();

  const shortlisted = data?.shortlistedCount ?? 0;
  if (!data || shortlisted === 0) return null;

  const matches = (data.recent || []).slice(0, 4);

  return (
    <section
      aria-labelledby="employer-interest-heading"
      style={{ padding: "20px", background: t.cream, border: `1px solid ${t.line}`, borderRadius: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.coal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <h2 id="employer-interest-heading" style={{ fontFamily: f.sans, fontSize: textSize.lg, fontWeight: 700, color: t.coal, margin: 0 }}>
            Employer Interest
          </h2>
          <span style={{
            fontFamily: f.sans, fontSize: textSize.xs, fontWeight: 600, color: t.indigo,
            background: t.indigo100, padding: "3px 10px", borderRadius: 999,
          }}>
            {shortlisted} {shortlisted === 1 ? "Invite" : "Invites"}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/jobs")}
          style={{
            fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, color: t.indigo,
            background: "none", border: "none", padding: 0, height: "auto", cursor: "pointer",
          }}
        >
          View All →
        </Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {matches.map((m, i) => {
          const color = BADGE_COLORS[i % BADGE_COLORS.length];
          const empLabel = employmentLabel(m.employmentType);
          return (
            <div
              key={m.id}
              role="button"
              tabIndex={0}
              aria-label={`View details for ${m.roleTitle} at ${m.companyName}`}
              onClick={() => router.push(`/jobs?open=${encodeURIComponent(m.id)}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/jobs?open=${encodeURIComponent(m.id)}`);
                }
              }}
              style={{ padding: "14px", borderRadius: 10, background: t.cream, border: `1px solid ${t.line}`, cursor: "pointer", transition: `background ${dur.instant} ${ease.snap}` }}
              onMouseEnter={(e) => { e.currentTarget.style.background = t.creamSoft; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = t.cream; }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: color.bg, color: color.fg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 700, marginBottom: 10,
              }}>
                {initials(m.companyName)}
              </div>
              <div style={{ fontFamily: f.sans, fontSize: textSize.base, fontWeight: 700, color: t.coal, marginBottom: 4 }}>
                {m.roleTitle}
              </div>
              <div style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkSoft, marginBottom: 8 }}>
                {m.companyName}{empLabel ? ` · ${empLabel}` : ""}
              </div>
              <div style={{ fontFamily: f.sans, fontSize: textSize.xs, color: t.inkFaint }}>
                {hoursOrDaysAgo(m.matchedAt)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
