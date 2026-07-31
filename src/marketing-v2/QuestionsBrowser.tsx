"use client";

/* Client-side island for the /questions index page: search + focus filter
 * + a "Popular companies" quick jump driven by SeoPage.sitemapPriority
 * (previously computed but never surfaced anywhere). Renders full markup
 * for every question set on first paint (SSR), then filters in place on
 * the client — crawlers still see every link, visitors get instant
 * combinable filtering with no page reload or lost scroll position. */

import { useMemo, useState } from "react";
import Link from "next/link";
import { tokens as t, fonts } from "../auth/_tokens";
import { COMPANY_LABEL } from "../../data/company-labels";

export interface QuestionsBrowserPage {
  slug: string;
  searchPhrase: string;
  company: string;
  focus: string;
  intro: string;
  sitemapPriority?: number;
}

const FOCUS_DISPLAY: Record<string, string> = {
  behavioral: "Behavioural", technical: "Technical", "system-design": "System Design",
  "case-study": "Case Study", "campus-placement": "Campus Placement",
  hr: "HR Round", "salary-negotiation": "Salary Negotiation",
  leadership: "Leadership", general: "General", management: "Management",
  "government-psu": "Government / PSU", strategic: "Strategic",
};

const CHIP_ORDER = [
  "campus-placement", "hr", "behavioral", "technical",
  "system-design", "case-study", "salary-negotiation",
];

function companyLabel(company: string) {
  return COMPANY_LABEL[company] ?? company.charAt(0).toUpperCase() + company.slice(1);
}

export function QuestionsBrowser({
  pages,
  initialFocus,
}: {
  pages: QuestionsBrowserPage[];
  initialFocus?: string;
}) {
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(initialFocus ?? "");

  const focusCounts = useMemo(
    () =>
      pages.reduce<Record<string, number>>((acc, p) => {
        acc[p.focus] = (acc[p.focus] ?? 0) + 1;
        return acc;
      }, {}),
    [pages],
  );

  /* Highest sitemapPriority per company — a proxy for how much curation
     weight a company already carries, surfaced as a quick-jump rail. */
  const popularCompanies = useMemo(() => {
    const byCompany = new Map<string, number>();
    for (const p of pages) {
      const prev = byCompany.get(p.company) ?? 0;
      byCompany.set(p.company, Math.max(prev, p.sitemapPriority ?? 0));
    }
    return [...byCompany.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([company]) => company);
  }, [pages]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    return pages.filter((p) => {
      if (focus && p.focus !== focus) return false;
      if (!q) return true;
      return (
        companyLabel(p.company).toLowerCase().includes(q) ||
        p.searchPhrase.toLowerCase().includes(q)
      );
    });
  }, [pages, focus, q]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => a.company.localeCompare(b.company)),
    [filtered],
  );

  const grouped = useMemo(
    () =>
      sorted.reduce<Record<string, QuestionsBrowserPage[]>>((acc, p) => {
        (acc[p.company] ??= []).push(p);
        return acc;
      }, {}),
    [sorted],
  );

  const companies = Object.keys(grouped);

  return (
    <div>
      {/* Search */}
      <div style={{ marginBottom: 28 }}>
        <label htmlFor="questions-search" style={{ display: "block", fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.inkFaint, marginBottom: 10 }}>
          Find a company
        </label>
        <input
          id="questions-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company or role, e.g. TCS, Amazon SDE…"
          style={{
            width: "100%",
            maxWidth: 420,
            fontFamily: fonts.sans,
            fontSize: 15,
            padding: "12px 16px",
            borderRadius: 10,
            border: `1.5px solid ${t.line}`,
            background: "#fff",
            color: t.coal,
          }}
        />
      </div>

      {/* Popular companies quick jump */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.inkFaint, margin: "0 0 14px" }}>
          Popular companies
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {popularCompanies.map((company) => (
            <button
              key={company}
              type="button"
              onClick={() => setQuery(companyLabel(company))}
              style={{
                fontFamily: fonts.sans, fontSize: 13, fontWeight: 600,
                padding: "9px 14px", borderRadius: 999, cursor: "pointer",
                border: `1px solid ${t.line}`, background: "transparent",
                color: t.inkSoft,
              }}
            >
              {companyLabel(company)}
            </button>
          ))}
        </div>
      </div>

      {/* Focus filter chips */}
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: t.inkFaint, margin: "0 0 14px" }}>
          Browse by type
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            onClick={() => setFocus("")}
            style={{
              fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, cursor: "pointer",
              padding: "12px 14px", borderRadius: 999,
              border: `1px solid ${!focus ? t.copper : t.line}`,
              background: !focus ? t.copper : "transparent",
              color: !focus ? "#fff" : t.inkSoft,
              whiteSpace: "nowrap",
            }}
          >
            All · {pages.length}
          </button>
          {CHIP_ORDER.filter((f) => focusCounts[f]).map((f) => {
            const isActive = focus === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFocus(isActive ? "" : f)}
                style={{
                  fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  padding: "12px 14px", borderRadius: 999,
                  border: `1px solid ${isActive ? t.copper : t.line}`,
                  background: isActive ? t.copper : "transparent",
                  color: isActive ? "#fff" : t.inkSoft,
                  whiteSpace: "nowrap",
                }}
              >
                {FOCUS_DISPLAY[f] ?? f} · {focusCounts[f]}
              </button>
            );
          })}
        </div>
      </div>

      <p style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint, margin: "0 0 8px" }}>
        {sorted.length} question {sorted.length === 1 ? "set" : "sets"}
        {focus ? ` · ${FOCUS_DISPLAY[focus] ?? focus}` : ""}
        {q ? ` · matching "${query.trim()}"` : ""}
      </p>

      {companies.length === 0 && (
        <div style={{ padding: "40px 0", borderTop: `1px solid ${t.line}` }}>
          <p style={{ fontFamily: fonts.serif, fontSize: 20, color: t.coal, margin: "0 0 8px" }}>
            No question sets match “{query.trim()}”.
          </p>
          <p style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkFaint, margin: 0 }}>
            Try a different company name, or{" "}
            <button
              type="button"
              onClick={() => { setQuery(""); setFocus(""); }}
              style={{ font: "inherit", color: t.copper, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
            >
              clear filters
            </button>{" "}
            to see all 245 sets.
          </p>
        </div>
      )}

      {companies.map((company) => {
        const rows = grouped[company];
        const condensed = rows.length === 1;
        return (
          <section key={company} className="ed-reveal" style={{ marginBottom: condensed ? 4 : 40 }}>
            {!condensed && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4, paddingTop: 16 }}>
                <span style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: t.coal, whiteSpace: "nowrap" }}>
                  {companyLabel(company)}
                </span>
                <span style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 600, color: t.inkFaint, whiteSpace: "nowrap" }}>
                  · {rows.length} sets
                </span>
                <div style={{ flex: 1, height: 1, background: t.line }} />
              </div>
            )}
            <ol role="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {rows.map((p, i) => (
                <li key={p.slug}>
                  <Link
                    href={`/questions/${p.slug}`}
                    className="ed-cta ed-row"
                    style={{
                      display: "flex",
                      gap: 22,
                      padding: condensed ? "14px 8px" : "18px 8px",
                      borderBottom: `1px solid ${t.line}`,
                      textDecoration: "none",
                      alignItems: "flex-start",
                      margin: "0 -8px",
                    }}
                  >
                    {condensed ? (
                      <span style={{ fontFamily: fonts.sans, fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: t.inkFaint, flexShrink: 0, minWidth: 84 }}>
                        {companyLabel(company)}
                      </span>
                    ) : (
                      <span style={{ fontFamily: fonts.serif, fontSize: 22, fontStyle: "italic", color: t.copperDark, lineHeight: 1, flexShrink: 0, minWidth: 34 }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontFamily: fonts.sans, fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: t.inkFaint }}>
                        {p.focus.replace(/-/g, " ")}
                      </span>
                      <p style={{ fontFamily: fonts.serif, fontSize: 18, lineHeight: 1.32, color: t.coal, margin: "5px 0 0", letterSpacing: "-0.01em" }}>
                        {p.searchPhrase}
                      </p>
                    </div>
                    <span style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: t.copper, flexShrink: 0, paddingTop: 3, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      View <span className="ed-cta-arrow" aria-hidden>→</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
