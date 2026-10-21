"use client";

/* Dashboard "Employer Interest" section — the candidate-facing half of the
   employer talent-roster feature. A flat list of the most recent matches
   (role, company, employment type, relative time) behind a "N Matches" pill,
   driven by the real shortlisted/recent counts. Fetches
   /api/candidate-hiring-activity. */

import Link from "next/link";
import { ArrowRightIcon, LockIcon } from "lucide-react";
import { hoursOrDaysAgo, EMPLOYMENT_TYPE_LABEL } from "./hiringMatchFormat";
import { useHiringActivity } from "./useHiringActivity";
import { PANEL, PANEL_H2, Tag } from "./DashboardHomeSections";

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
  const data = useHiringActivity();

  const shortlisted = data?.shortlistedCount ?? 0;
  if (!data || shortlisted === 0) return null;

  const matches = (data.recent || []).slice(0, 4);

  return (
    <section aria-labelledby="employer-interest-heading" className={PANEL}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 id="employer-interest-heading" className={PANEL_H2}>Employer interest</h2>
          <Tag tone="indigo" label={`${shortlisted} ${shortlisted === 1 ? "Match" : "Matches"}`} />
        </div>
        <Link
          href="/jobs"
          className="inline-flex min-h-6 items-center gap-1 whitespace-nowrap rounded-sm py-1 text-[13px] font-semibold text-hx-indigo no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          View all
          <ArrowRightIcon size={14} aria-hidden="true" />
        </Link>
      </div>

      <ul className="m-0 list-none divide-y divide-hx-line p-0">
        {matches.map((m) => {
          const empLabel = employmentLabel(m.employmentType);
          return (
            <li key={m.id}>
              <Link
                href={`/jobs/${encodeURIComponent(m.id)}`}
                aria-label={`View details for ${m.roleTitle} at ${m.companyName}`}
                className="flex items-center gap-3 rounded-md py-2.5 text-hx-coal no-underline transition-colors hover:bg-hx-soft focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-hx-indigo-100 text-[12px] font-bold text-hx-indigo-deep">
                  {m.unlocked === false ? <LockIcon size={14} /> : initials(m.companyName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{m.roleTitle}</span>
                  <span className="block truncate text-[12px] text-hx-ink-soft">{m.companyName}{empLabel ? ` · ${empLabel}` : ""}</span>
                </span>
                <span className="shrink-0 text-[12px] text-hx-ink-soft">{hoursOrDaysAgo(m.matchedAt)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
