"use client";
/**
 * Indian Startup Engineer Salary Report 2026 — /salary-report-2026.
 *
 * A citable, chart-led aggregate of the per-company /salary/[company]
 * pages: headline median CTC, an emerging-startup highlight table (the
 * data no one else has — the digital-PR angle), the full company table
 * linking every salary page, and a stated methodology. Built as a
 * linkable reference asset, not a product page. Data flows in from the
 * server route via props.
 */
import type { CSSProperties } from "react";
import { tokens as t, fonts } from "../auth/_tokens";
import { editorialCSS, ED_PADDING, DarkBand, ctaPrimaryStyle } from "./_editorial";
import type { ReportRow, ReportStats, BandMedian } from "../../data/_salary-report";

export interface SalaryReport2026Props {
  rows: ReportRow[];
  stats: ReportStats;
  /** Human date for the "last verified" line, e.g. "July 2026". */
  updatedLabel: string;
}

/* ── formatting ─────────────────────────────────────────────────── */

function lpa(n: number): string {
  return `₹${Math.round(n)}`;
}
function range(min?: number, max?: number): string {
  if (min == null || max == null) return "—";
  return `${lpa(min)}–${lpa(max)}`;
}
function medianText(m: BandMedian | null): string {
  return m ? `${lpa(m.min)}–${lpa(m.max)} LPA` : "—";
}

/* ── layout tokens ──────────────────────────────────────────────── */

const shell: CSSProperties = {
  background: t.cream,
  paddingLeft: 24,
  paddingRight: 24,
};
const wrap: CSSProperties = { maxWidth: 1080, margin: "0 auto" };
const eyebrow: CSSProperties = {
  fontFamily: fonts.mono,
  fontSize: 12,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: t.copper,
  margin: "0 0 14px",
};
const h2: CSSProperties = {
  fontFamily: fonts.serif,
  fontSize: "clamp(26px, 3vw, 36px)",
  fontWeight: 700,
  color: t.coal,
  letterSpacing: "-0.02em",
  margin: "0 0 8px",
};
const lead: CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 17,
  lineHeight: 1.6,
  color: t.inkSoft,
  maxWidth: "62ch",
  margin: "0 0 28px",
};

/* ── small pieces ───────────────────────────────────────────────── */

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        background: t.creamRaised,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        padding: "22px 20px",
      }}
    >
      <p
        style={{
          fontFamily: fonts.mono,
          fontSize: "clamp(20px, 2.4vw, 27px)",
          fontWeight: 700,
          color: t.coal,
          margin: "0 0 6px",
        }}
      >
        {value}
      </p>
      <p style={{ fontFamily: fonts.sans, fontSize: 13.5, color: t.inkSoft, margin: 0, lineHeight: 1.45 }}>
        {label}
      </p>
    </div>
  );
}

/* Shared grid so the axis, gridlines, and every bar line up in the same column. */
const tierGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "84px 1fr", alignItems: "center", gap: 14 };

/** Round a raw axis max down to a "nice" step (1/2/5/10 × a power of ten). */
function niceTicks(scaleMax: number): number[] {
  const rawStep = scaleMax / 4;
  const pow10 = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / pow10;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * pow10;
  const ticks: number[] = [];
  for (let v = 0; v <= scaleMax; v += step) ticks.push(Math.round(v));
  return ticks;
}

/* Axis + gridlines shared by all three bars, so the reader can read an absolute
 * LPA scale instead of guessing what an unlabeled floating bar means. */
function TierAxis({ scaleMax }: { scaleMax: number }) {
  const ticks = niceTicks(scaleMax);
  return (
    <div style={{ ...tierGridStyle, marginBottom: 6 }}>
      <span />
      <div style={{ position: "relative", height: 16 }}>
        {ticks.map((tick) => (
          <span
            key={tick}
            style={{
              position: "absolute",
              left: `${(tick / scaleMax) * 100}%`,
              transform: tick === 0 ? "translateX(0)" : "translateX(-50%)",
              fontFamily: fonts.mono,
              fontSize: 11,
              color: t.inkFaint,
              whiteSpace: "nowrap",
            }}
          >
            ₹{tick} LPA
          </span>
        ))}
      </div>
    </div>
  );
}

function TierGridlines({ scaleMax }: { scaleMax: number }) {
  const ticks = niceTicks(scaleMax);
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {ticks.map((tick) => (
        <div
          key={tick}
          style={{ position: "absolute", left: `${(tick / scaleMax) * 100}%`, top: 0, bottom: 0, width: 1, background: t.line }}
        />
      ))}
    </div>
  );
}

/* Pure-CSS horizontal bar — no chart library (CSP-safe, self-contained).
 * The value label lives centered inside the filled bar (white-on-copper) so it
 * always tracks the bar and can never overlap the track or get clipped at the
 * edge the way a fixed-position overlay label would. */
function TierBar({ level, m, scaleMax }: { level: string; m: BandMedian | null; scaleMax: number }) {
  const min = m?.min ?? 0;
  const max = m?.max ?? 0;
  const leftPct = (min / scaleMax) * 100;
  const widthPct = Math.max(((max - min) / scaleMax) * 100, 1.5);
  return (
    <div style={{ ...tierGridStyle, marginBottom: 14 }}>
      <span style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>{level}</span>
      <div style={{ height: 34, background: t.creamSoft, borderRadius: 8, position: "relative", overflow: "hidden" }}>
        <TierGridlines scaleMax={scaleMax} />
        <div
          style={{
            position: "absolute",
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            top: 0,
            bottom: 0,
            background: t.copper,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontFamily: fonts.mono, fontSize: 12.5, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", padding: "0 6px" }}>
            {medianText(m)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── table ──────────────────────────────────────────────────────── */

const thStyle: CSSProperties = {
  fontFamily: fonts.mono,
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: t.inkFaint,
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: `1px solid ${t.line}`,
  whiteSpace: "nowrap",
};
const tdStyle: CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 14,
  color: t.inkSoft,
  padding: "12px",
  borderBottom: `1px solid ${t.line}`,
  whiteSpace: "nowrap",
};

function CompanyTable({ rows, caption }: { rows: ReportRow[]; caption: string }) {
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${t.line}`, borderRadius: 14, background: t.creamRaised }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
        <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          {caption}
        </caption>
        <thead>
          <tr>
            <th scope="col" style={thStyle}>Company</th>
            <th scope="col" style={thStyle}>Entry (0–2 yr)</th>
            <th scope="col" style={thStyle}>Mid (2–5 yr)</th>
            <th scope="col" style={thStyle}>Senior (5+ yr)</th>
            <th scope="col" style={thStyle}>Equity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.slug}>
              <td style={{ ...tdStyle, fontWeight: 600 }}>
                <a href={`/salary/${r.slug}`} style={{ color: t.copper, textDecoration: "none" }}>
                  {r.label}
                </a>
              </td>
              <td style={{ ...tdStyle, fontFamily: fonts.mono, fontSize: 13 }}>{range(r.entryMin, r.entryMax)}</td>
              <td style={{ ...tdStyle, fontFamily: fonts.mono, fontSize: 13 }}>{range(r.midMin, r.midMax)}</td>
              <td style={{ ...tdStyle, fontFamily: fonts.mono, fontSize: 13 }}>{range(r.seniorMin, r.seniorMax)}</td>
              <td style={{ ...tdStyle, fontSize: 13, textTransform: "uppercase" as const }}>
                {r.equityType && r.equityType !== "none" ? r.equityType : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── page ───────────────────────────────────────────────────────── */

export function SalaryReport2026({ rows, stats, updatedLabel }: SalaryReport2026Props) {
  const emerging = rows.filter((r) => r.emerging);
  const sorted = [...rows].sort((a, b) => a.label.localeCompare(b.label));
  const scaleMax = stats.seniorMedian ? stats.seniorMedian.max * 1.1 : 100;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: editorialCSS }} />

      {/* Hero */}
      <header style={{ ...shell, paddingTop: ED_PADDING.heroTop, paddingBottom: 40 }}>
        <div style={wrap}>
          <p style={eyebrow}>Salary Data · Updated {updatedLabel}</p>
          <h1
            style={{
              fontFamily: fonts.serif,
              fontSize: "clamp(34px, 5vw, 60px)",
              fontWeight: 700,
              color: t.coal,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              margin: "0 0 18px",
              maxWidth: "16ch",
            }}
          >
            Indian Startup Engineer Salary Report 2026
          </h1>
          <p style={{ ...lead, fontSize: 19 }}>
            Total-CTC ranges for software engineers across{" "}
            <strong style={{ color: t.coal }}>{stats.companyCount} companies</strong> hiring in India — including{" "}
            <strong style={{ color: t.coal }}>{stats.emergingCount} emerging AI-native startups and new unicorns</strong>{" "}
            (Sarvam, Moglix, Navi, Zepto and more) that have almost no public compensation data anywhere else.
            Every band links to a full per-company breakdown with sources and a verification date.
          </p>
        </div>
      </header>

      {/* Headline stats */}
      <section style={{ ...shell, paddingTop: 8, paddingBottom: 48 }}>
        <div style={wrap}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 16,
            }}
          >
            <StatCard value={medianText(stats.entryMedian)} label="Median entry-level SWE total CTC (0–2 yr)" />
            <StatCard value={medianText(stats.midMedian)} label="Median mid-level total CTC (2–5 yr)" />
            <StatCard value={medianText(stats.seniorMedian)} label="Median senior total CTC (5+ yr)" />
            <StatCard value={`${stats.companyCount}`} label="Companies with a verified SWE band" />
            <StatCard value={`${stats.emergingCount}`} label="Emerging AI / new-economy startups tracked" />
            {stats.topPayer && (
              <StatCard
                value={`${lpa(stats.topPayer.seniorMax)} LPA`}
                label={`Highest senior band — ${stats.topPayer.label}`}
              />
            )}
          </div>
        </div>
      </section>

      {/* Tier chart */}
      <section style={{ ...shell, paddingBottom: 56 }}>
        <div style={wrap}>
          <p style={eyebrow}>By experience level</p>
          <h2 style={h2}>Median software-engineer CTC by level</h2>
          <p style={lead}>
            Median across all {stats.companyCount} companies. Bars show the median low-to-high total-CTC band, so a wider
            bar means a wider spread between the 25th and 75th percentile offers at that level.
          </p>
          <div style={{ background: t.creamRaised, border: `1px solid ${t.line}`, borderRadius: 14, padding: "26px 22px" }}>
            <TierAxis scaleMax={scaleMax} />
            <TierBar level="Entry" m={stats.entryMedian} scaleMax={scaleMax} />
            <TierBar level="Mid" m={stats.midMedian} scaleMax={scaleMax} />
            <TierBar level="Senior" m={stats.seniorMedian} scaleMax={scaleMax} />
          </div>
        </div>
      </section>

      {/* Emerging companies — the unique data */}
      {emerging.length > 0 && (
        <section style={{ ...shell, paddingBottom: 56 }}>
          <div style={wrap}>
            <p style={eyebrow}>The data no one else has</p>
            <h2 style={h2}>Emerging AI startups &amp; new unicorns</h2>
            <p style={lead}>
              Compensation for India&rsquo;s newest AI-native companies and recent unicorns is largely absent from
              AmbitionBox and Glassdoor. These bands are aggregated from public filings, Levels.fyi, and offer-letter
              research. This is the slice worth citing.
            </p>
            <CompanyTable rows={emerging} caption="Salary bands for emerging Indian AI startups and new unicorns, 2026" />
          </div>
        </section>
      )}

      {/* Full table */}
      <section style={{ ...shell, paddingBottom: 56 }}>
        <div style={wrap}>
          <p style={eyebrow}>Full dataset</p>
          <h2 style={h2}>All {stats.companyCount} companies</h2>
          <p style={lead}>
            Every company with a verified software-engineer band, A–Z. Click any name for the full CTC breakdown by role
            and level, with negotiation guidance and cited sources.
          </p>
          <CompanyTable rows={sorted} caption="Software-engineer total-CTC salary bands across Indian companies, 2026" />
        </div>
      </section>

      {/* Methodology */}
      <section style={{ ...shell, paddingBottom: 56 }}>
        <div style={wrap}>
          <p style={eyebrow}>How we built this</p>
          <h2 style={h2}>Methodology &amp; sources</h2>
          <div style={{ ...lead, maxWidth: "70ch" }}>
            <p style={{ margin: "0 0 14px" }}>
              Bands are <strong style={{ color: t.coal }}>total CTC in LPA</strong> (fixed + variable + annualised
              equity), not just base. Each company&rsquo;s band is cross-referenced from up to four sources:
            </p>
            <ul style={{ margin: "0 0 14px", paddingLeft: 22, lineHeight: 1.7 }}>
              <li><strong style={{ color: t.coal }}>Levels.fyi</strong> — self-reported total-comp for product companies.</li>
              <li><strong style={{ color: t.coal }}>AmbitionBox &amp; Glassdoor</strong> — India-specific self-reported ranges (directional; corrected for the known upward variable-pay bias).</li>
              <li><strong style={{ color: t.coal }}>DRHP / annual filings</strong> — for listed and recently-IPO&rsquo;d companies, the most authoritative source.</li>
              <li><strong style={{ color: t.coal }}>Offer-letter aggregation</strong> — for emerging startups with no public dataset yet.</li>
            </ul>
            <p style={{ margin: 0 }}>
              Every per-company page carries its own source list and a <em>last-verified</em> date. Figures are refreshed
              quarterly; the most recent verification in this dataset is {updatedLabel}. Treat emerging-startup bands as
              directional — anchor negotiations to the lower half and validate with a recruiter.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <DarkBand
        eyebrow="Practice before the offer call"
        title="Know the number."
        accent="Then earn it."
      >
        <p style={{ fontFamily: fonts.sans, fontSize: 17, lineHeight: 1.6, color: t.creamMuted, maxWidth: "52ch", margin: "0 auto 28px" }}>
          Knowing the band is half the battle — the other half is interviewing well enough to land the top of it. Practice
          a full voice mock interview with scored STAR feedback, free.
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <a href="/signup" style={ctaPrimaryStyle("lg")}>Start a free mock interview</a>
        </div>
      </DarkBand>
    </>
  );
}
