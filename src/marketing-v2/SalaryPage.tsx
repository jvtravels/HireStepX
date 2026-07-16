/**
 * Salary page UI — /salary/[company].
 *
 * Pure presentational component; all data arrives as props.
 * Server-side only (no "use client") — safe for ISR.
 */
import type { CSSProperties } from "react";
import { tokens as t, fonts } from "../auth/_tokens";
import {
  editorialCSS,
  edSansLead,
  ED_PADDING,
  DarkBand,
  ctaPrimaryStyle,
  ctaGhostStyle,
} from "./_editorial";

/* ─── Types ─────────────────────────────────────────────────────── */

export interface SalaryBandRow {
  level: "entry" | "mid" | "senior" | "lead" | "executive";
  levelLabel: string;
  totalMin: number;
  totalMax: number;
  baseMin?: number;
  baseMax?: number;
  equityType?: string;
  equityMin?: number;
  equityMax?: number;
  notes?: string;
  source: string;
  lastVerified: string;
}

export interface SalaryRoleSection {
  roleKey: string;
  roleLabel: string;
  bands: SalaryBandRow[];
}

export interface SalaryPageProps {
  companySlug: string;
  companyLabel: string;
  companyDescription: string;
  roles: SalaryRoleSection[];
  questionPageSlug?: string;
  blogPostSlug?: string;
  noticePeriodDays?: number;
  bondPenaltyLpa?: number;
  calibrationDate: string;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

const LEVEL_ORDER = ["entry", "mid", "senior", "lead", "executive"] as const;
const LEVEL_LABEL: Record<string, string> = {
  entry: "Fresher / 0–2 yrs",
  mid: "Mid-level / 3–5 yrs",
  senior: "Senior / 6–9 yrs",
  lead: "Lead / 10–12 yrs",
  executive: "Manager / 12+ yrs",
};

function fmt(n: number): string {
  if (n >= 100) return `₹${n}L`;
  return `₹${n.toFixed(n % 1 === 0 ? 0 : 1)}L`;
}

/* ─── Styles ─────────────────────────────────────────────────────── */

const wrap: CSSProperties = {
  background: t.cream,
  minHeight: "100vh",
  paddingBottom: 80,
};

const container: CSSProperties = {
  maxWidth: 1080,
  margin: "0 auto",
  padding: "0 40px",
};

const containerNarrow: CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "0 40px",
};

const eyebrow: CSSProperties = {
  fontFamily: fonts.mono,
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  color: t.copper,
  marginBottom: 12,
};

const h1Style: CSSProperties = {
  fontFamily: fonts.serif,
  fontSize: "clamp(28px, 4vw, 42px)",
  fontWeight: 700,
  lineHeight: 1.1,
  letterSpacing: "-0.02em",
  color: t.coal,
  textWrap: "balance" as never,
  marginBottom: 16,
};

const leadStyle: CSSProperties = {
  ...edSansLead,
  maxWidth: "58ch",
  marginBottom: 0,
};

const sectionTitle: CSSProperties = {
  fontFamily: fonts.serif,
  fontSize: 20,
  fontWeight: 700,
  color: t.coal,
  marginBottom: 4,
  letterSpacing: "-0.01em",
};

/* Table styles */
const tableWrap: CSSProperties = {
  overflowX: "auto",
  marginBottom: 24,
  borderRadius: 8,
  border: `1px solid ${t.line}`,
  background: t.white,
};

const thStyle: CSSProperties = {
  fontFamily: fonts.mono,
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: t.inkFaint,
  padding: "10px 16px",
  textAlign: "left" as const,
  borderBottom: `2px solid ${t.coal}`,
  whiteSpace: "nowrap" as const,
  background: t.creamSoft,
  fontWeight: 700,
};

const tdStyle: CSSProperties = {
  padding: "12px 16px",
  borderBottom: `1px solid ${t.line}`,
  verticalAlign: "top",
  fontSize: 14,
  color: t.coal,
  lineHeight: 1.5,
};

const tdFaint: CSSProperties = {
  ...tdStyle,
  color: t.inkSoft,
  fontSize: 13,
};

const tdMono: CSSProperties = {
  ...tdStyle,
  fontFamily: fonts.mono,
  fontSize: 13,
  fontVariantNumeric: "tabular-nums",
};

const disclaimer: CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 12,
  color: t.inkFaint,
  lineHeight: 1.6,
  padding: "12px 16px",
  background: t.creamSoft,
  borderRadius: 6,
  border: `1px solid ${t.line}`,
  marginTop: 24,
};

const chipStyle: CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 4,
  fontSize: 11,
  fontFamily: fonts.mono,
  letterSpacing: "0.04em",
  fontWeight: 600,
};

/* ─── Component ──────────────────────────────────────────────────── */

export function SalaryCompanyPage({
  companyLabel,
  companyDescription,
  roles,
  questionPageSlug,
  blogPostSlug,
  noticePeriodDays,
  bondPenaltyLpa,
  calibrationDate,
}: SalaryPageProps) {
  const hasRoles = roles.length > 0;
  const questionHref = questionPageSlug
    ? `/questions/${questionPageSlug}`
    : "/questions";

  return (
    <>
      <style>{editorialCSS}</style>
      <style>{`
        .sal-table { width: 100%; border-collapse: collapse; }
        .sal-table tr:last-child td { border-bottom: none; }
        .sal-table tr:hover td { background: ${t.creamSoft}; }

        @media (max-width: 640px) {
          .sal-container { padding: 0 16px !important; }
          .sal-header { padding: 40px 16px 32px !important; }
          .sal-hide-sm { display: none !important; }
        }
      `}</style>

      <div style={wrap}>
        {/* ── Hero ── */}
        <div
          className="sal-header"
          style={{
            paddingTop: ED_PADDING.heroTop,
            paddingBottom: ED_PADDING.heroBottom,
            borderBottom: `1px solid ${t.line}`,
            background: t.creamRaised,
          }}
        >
          <div className="sal-container" style={containerNarrow}>
            <p className="ed-rise" style={eyebrow}>
              Salary Guide · India 2026
            </p>
            <h1 className="ed-rise ed-d1" style={h1Style}>
              {companyLabel} Salary Guide India 2026
            </h1>
            <p className="ed-rise ed-d2" style={leadStyle}>
              {companyDescription} Salary ranges below are sourced from
              AmbitionBox, Glassdoor, and Levels.fyi and reflect total CTC
              (base + variable + equity) at the 25th–90th percentile of reported
              offers in India.
            </p>

            {/* Quick meta chips */}
            <div
              className="ed-rise ed-d3"
              style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}
            >
              <span
                style={{
                  ...chipStyle,
                  background: t.copperWash,
                  color: t.copper,
                  border: `1px solid ${t.copperBorder}`,
                }}
              >
                Total CTC in LPA
              </span>
              <span
                style={{
                  ...chipStyle,
                  background: t.creamSoft,
                  color: t.inkSoft,
                  border: `1px solid ${t.line}`,
                }}
              >
                Data verified {calibrationDate}
              </span>
              {noticePeriodDays && (
                <span
                  style={{
                    ...chipStyle,
                    background: t.creamSoft,
                    color: t.inkSoft,
                    border: `1px solid ${t.line}`,
                  }}
                >
                  {noticePeriodDays}-day notice period
                </span>
              )}
              {bondPenaltyLpa && bondPenaltyLpa > 0 && (
                <span
                  style={{
                    ...chipStyle,
                    background: t.error100,
                    color: t.error,
                    border: "1px solid rgba(185,28,28,0.15)",
                  }}
                >
                  ₹{bondPenaltyLpa}L service bond
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Salary tables ── */}
        <div
          className="sal-container"
          style={{ ...container, paddingTop: 48 }}
        >
          {hasRoles ? (
            roles.map((role) => (
              <section
                key={role.roleKey}
                style={{ marginBottom: 48 }}
                aria-label={`${role.roleLabel} salary`}
              >
                <p style={eyebrow}>Role</p>
                <h2 style={sectionTitle}>{role.roleLabel}</h2>
                <p
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 14,
                    color: t.inkSoft,
                    marginBottom: 20,
                  }}
                >
                  Total CTC ranges for {role.roleLabel}s at {companyLabel} India — from fresher to
                  senior level.
                </p>

                <div style={tableWrap}>
                  <table className="sal-table" role="table">
                    <thead>
                      <tr>
                        <th style={thStyle}>Experience Level</th>
                        <th style={thStyle}>Total CTC (LPA)</th>
                        <th style={{ ...thStyle }} className="sal-hide-sm">
                          Base CTC
                        </th>
                        <th style={thStyle}>Equity</th>
                        <th style={{ ...thStyle }} className="sal-hide-sm">
                          Last Verified
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {LEVEL_ORDER.filter((lvl) =>
                        role.bands.some((b) => b.level === lvl),
                      ).map((lvl) => {
                        const band = role.bands.find((b) => b.level === lvl);
                        if (!band) return null;
                        return (
                          <tr key={lvl}>
                            <td style={{ ...tdStyle, fontWeight: 600 }}>
                              {LEVEL_LABEL[lvl]}
                            </td>
                            <td style={{ ...tdMono, fontWeight: 700, color: t.coal }}>
                              {fmt(band.totalMin)} – {fmt(band.totalMax)}
                            </td>
                            <td style={tdMono} className="sal-hide-sm">
                              {band.baseMin != null && band.baseMax != null
                                ? `${fmt(band.baseMin)} – ${fmt(band.baseMax)}`
                                : "—"}
                            </td>
                            <td style={tdFaint}>
                              {band.equityType && band.equityType !== "none" ? (
                                <>
                                  {band.equityType.toUpperCase()}
                                  {band.equityMin != null && band.equityMax != null && (
                                    <span
                                      style={{
                                        display: "block",
                                        fontFamily: fonts.mono,
                                        fontSize: 12,
                                        marginTop: 2,
                                      }}
                                    >
                                      {fmt(band.equityMin)} – {fmt(band.equityMax)}/yr
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span style={{ color: t.inkFaint }}>None</span>
                              )}
                            </td>
                            <td style={tdFaint} className="sal-hide-sm">
                              {band.lastVerified}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Notes for the role — show first band's notes as a tip */}
                {role.bands[0]?.notes && (
                  <div
                    style={{
                      borderLeft: `3px solid ${t.copper}`,
                      paddingLeft: 16,
                      marginTop: 8,
                      marginBottom: 24,
                    }}
                  >
                    <p
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 13,
                        color: t.inkSoft,
                        lineHeight: 1.6,
                      }}
                    >
                      {role.bands[0].notes}
                    </p>
                  </div>
                )}
              </section>
            ))
          ) : (
            <p style={{ color: t.inkSoft, fontSize: 15 }}>
              Salary data not yet available for this company.
            </p>
          )}

          {/* Disclaimer */}
          <p style={disclaimer}>
            <strong>Data sources:</strong> AmbitionBox, Glassdoor India, Levels.fyi,
            and public DRHP/IPO filings where applicable. Ranges represent the 25th–90th
            percentile of reported total CTC (base + variable + annual equity value) in
            Indian cities. Individual offers vary by negotiation, team, location, and
            joining year. These figures are market reference data, not a guarantee of any
            specific offer. Verify with current offer letters and recruiter disclosures.
          </p>

          {/* Cross-links */}
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 40,
              paddingTop: 40,
              borderTop: `1px solid ${t.line}`,
            }}
          >
            <a
              href={questionHref}
              style={ctaPrimaryStyle("md")}
            >
              Practice {companyLabel} Interview Questions →
            </a>
            {blogPostSlug && (
              <a href={`/blog/${blogPostSlug}`} style={ctaGhostStyle("md")}>
                {companyLabel} Interview Guide
              </a>
            )}
            <a href="/salary" style={ctaGhostStyle("md")}>
              All Company Salaries
            </a>
          </div>
        </div>

        {/* ── CTA band ── */}
        <div style={{ marginTop: 64 }}>
          <DarkBand
            eyebrow="Practice rounds"
            title={`Prepare for your ${companyLabel} interview`}
            videoSrc="/cta.mp4"
          >
            <p
              style={{
                fontFamily: fonts.sans,
                fontSize: 16,
                lineHeight: 1.7,
                color: "rgba(245,242,237,0.8)",
                marginBottom: 28,
                maxWidth: "52ch",
              }}
            >
              HireStepX gives you AI voice mock interviews scored on the STAR
              framework. Know what the interviewer is actually evaluating before
              you walk in.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a href="/signup" style={ctaPrimaryStyle("md")}>
                Start free practice
              </a>
              <a href="/how-it-works" style={ctaGhostStyle("md")}>
                See how it works
              </a>
            </div>
          </DarkBand>
        </div>
      </div>
    </>
  );
}

/* ─── Hub / index page ───────────────────────────────────────────── */

export interface SalaryHubEntry {
  slug: string;
  label: string;
  hubNote: string;
  topRoleLabel: string;
  entryMin?: number;
  entryMax?: number;
}

/* Derive a tier badge from the entry-level max CTC */
function tierBadge(entryMax?: number): { label: string; color: string; bg: string; border: string } {
  if (entryMax == null) return { label: "–", color: t.inkFaint, bg: t.creamSoft, border: t.line };
  if (entryMax >= 30) return { label: "FAANG", color: "#1d4ed8", bg: "#EEF3FF", border: "rgba(29,78,216,0.20)" };
  if (entryMax >= 15) return { label: "Startup", color: t.copper, bg: t.copperWash, border: t.copperBorder };
  return { label: "Service", color: t.inkFaint, bg: t.creamSoft, border: t.line };
}

const MAX_CTC_SCALE = 50; // LPA — bar fills at ₹50L+

export function SalaryHubPage({ entries }: { entries: SalaryHubEntry[] }) {
  /* Highest-paid first so the grid reads top-to-bottom by compensation */
  const sorted = [...entries].sort((a, b) => (b.entryMax ?? 0) - (a.entryMax ?? 0));

  return (
    <>
      <style>{editorialCSS}</style>
      <style>{`
        .sal-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 14px;
        }
        .sal-card {
          display: block;
          background: #FFFFFF;
          border: 1px solid ${t.line};
          border-radius: 10px;
          padding: 18px 20px 16px;
          text-decoration: none;
          transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
        }
        .sal-card:hover {
          border-color: ${t.copper};
          box-shadow: 0 2px 16px rgba(180,83,9,0.09);
          transform: translateY(-1px);
        }
        .sal-range-track {
          height: 3px;
          background: ${t.line};
          border-radius: 2px;
          margin-top: 10px;
          position: relative;
          overflow: visible;
        }
        .sal-range-fill {
          position: absolute;
          top: 0;
          height: 100%;
          border-radius: 2px;
          background: ${t.copper};
          opacity: 0.65;
        }
        @media (max-width: 640px) {
          .sal-grid { grid-template-columns: 1fr !important; }
          .sal-hub-header { padding: 44px 16px 28px !important; }
          .sal-hub-container { padding: 0 16px !important; }
        }
      `}</style>

      <div style={{ ...wrap, paddingBottom: 80 }}>
        {/* ── Hero ── */}
        <div
          className="sal-hub-header"
          style={{
            paddingTop: ED_PADDING.heroTop,
            paddingBottom: 52,
            borderBottom: `1px solid ${t.line}`,
            background: t.creamRaised,
          }}
        >
          <div style={{ ...container, textAlign: "center" }}>
            <p className="ed-rise" style={{ ...eyebrow, marginBottom: 16 }}>
              Salary Guides · India 2026
            </p>
            <h1 className="ed-rise ed-d1" style={{
              fontFamily: fonts.serif,
              fontSize: "clamp(36px, 4.8vw, 64px)",
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              color: t.coal,
              margin: "0 0 20px",
            }}>
              What 23 Indian companies{" "}
              <em style={{ fontStyle: "italic", color: t.copper }}>actually pay.</em>
            </h1>
            <p className="ed-rise ed-d2" style={{ ...leadStyle, margin: "0 auto", textAlign: "center" }}>
              Total CTC from TCS freshers to Goldman Sachs — sourced from AmbitionBox,
              Glassdoor, and Levels.fyi. Updated July 2026.
            </p>
          </div>
        </div>

        {/* ── Company grid ── */}
        <div
          className="sal-hub-container"
          style={{ ...container, paddingTop: 32 }}
        >
          <div className="sal-grid">
            {sorted.map((entry) => {
              const badge = tierBadge(entry.entryMax);
              const barMin = entry.entryMin != null
                ? Math.min((entry.entryMin / MAX_CTC_SCALE) * 100, 100)
                : 0;
              const barMax = entry.entryMax != null
                ? Math.min((entry.entryMax / MAX_CTC_SCALE) * 100, 100)
                : 0;
              const hasBar = entry.entryMax != null;

              return (
                <a key={entry.slug} href={`/salary/${entry.slug}`} className="sal-card">
                  {/* Company name + tier badge */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <p style={{ fontFamily: fonts.sans, fontWeight: 700, fontSize: 16, color: t.coal, margin: 0, lineHeight: 1.2 }}>
                      {entry.label}
                    </p>
                    <span style={{
                      fontFamily: fonts.mono, fontSize: 9, fontWeight: 700,
                      letterSpacing: "0.10em", textTransform: "uppercase" as const,
                      color: badge.color, background: badge.bg, border: `1px solid ${badge.border}`,
                      borderRadius: 4, padding: "2px 7px", flexShrink: 0, marginTop: 1,
                    }}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Role + salary range */}
                  <p style={{
                    fontFamily: fonts.mono, fontSize: 10, letterSpacing: "0.07em",
                    textTransform: "uppercase" as const, color: t.copper, margin: "6px 0 0",
                  }}>
                    {entry.topRoleLabel}
                    {entry.entryMin != null && entry.entryMax != null && (
                      <> · {fmt(entry.entryMin)}–{fmt(entry.entryMax)}</>
                    )}
                  </p>

                  {/* Range bar — visual salary encoding */}
                  {hasBar && (
                    <div className="sal-range-track">
                      <div
                        className="sal-range-fill"
                        style={{ left: `${barMin}%`, width: `${Math.max(barMax - barMin, 3)}%` }}
                      />
                    </div>
                  )}

                  {/* Hub note */}
                  <p style={{
                    fontFamily: fonts.sans, fontSize: 12, color: t.inkSoft,
                    lineHeight: 1.55, margin: "12px 0 0",
                  }}>
                    {entry.hubNote}
                  </p>
                </a>
              );
            })}
          </div>

          {/* Bottom cross-links */}
          <div style={{
            marginTop: 48, paddingTop: 40,
            borderTop: `1px solid ${t.line}`,
            display: "flex", gap: 12, flexWrap: "wrap",
          }}>
            <a href="/questions" style={ctaPrimaryStyle("md")}>
              Browse Interview Questions →
            </a>
            <a href="/for-students" style={ctaGhostStyle("md")}>
              Campus Placement Guide
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
