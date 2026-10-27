import type { Metadata } from "next";
import ConsentGatedAdSense from "../../ConsentGatedAdSense";
import { HubTemplate } from "@/home2/HubTemplate";
import type { BandMedian, ReportRow } from "../../../data/_salary-report";
import { report, buildSalaryReport2026JsonLd } from "./_jsonld";

export const revalidate = 86400;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** ISO "2026-07-15" → "July 2026" without touching Date (locale/tz-safe). */
function monthYear(iso: string | null): string {
  if (!iso) return "2026";
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return "2026";
  const monthIdx = Number(m[2]) - 1;
  return `${MONTHS[monthIdx] ?? ""} ${m[1]}`.trim();
}

const lpa = (n: number) => `₹${Math.round(n)}`;
const range = (min?: number, max?: number) => (min == null || max == null ? "n/a" : `${lpa(min)}–${lpa(max)}`);
const medianText = (m: BandMedian | null) => (m ? `${lpa(m.min)}–${lpa(m.max)} LPA` : "n/a");
const tableRow = (r: ReportRow) => [
  r.label,
  range(r.entryMin, r.entryMax),
  range(r.midMin, r.midMax),
  range(r.seniorMin, r.seniorMax),
  r.equityType && r.equityType !== "none" ? r.equityType : "n/a",
];
const TABLE_HEAD = ["Company", "Entry (0–2 yr)", "Mid (2–5 yr)", "Senior (5+ yr)", "Equity"];

export function generateMetadata(): Metadata {
  const { companyCount, emergingCount } = report.stats;
  const desc = `Total-CTC salary bands across ${companyCount} companies in India for 2026, including ${emergingCount} emerging AI startups. Median entry, mid, senior ranges with sources.`;
  return {
    title: "Indian Startup Engineer Salary Report 2026 | HireStepX",
    description: desc,
    keywords: [
      "Indian startup salary report 2026",
      "AI startup engineer salary India",
      "Sarvam salary",
      "Moglix salary",
      "Navi salary",
      "software engineer salary India 2026",
      "startup CTC India",
      "unicorn salary India 2026",
    ],
    alternates: { canonical: "/salary-report-2026" },
    openGraph: {
      type: "article",
      title: "Indian Startup Engineer Salary Report 2026 | HireStepX",
      description: desc,
      url: "https://hirestepx.com/salary-report-2026",
      siteName: "HireStepX",
      locale: "en_IN",
      images: [{ url: "https://hirestepx.com/opengraph-image", width: 1200, height: 630, alt: "Indian Startup Engineer Salary Report 2026" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Indian Startup Engineer Salary Report 2026 | HireStepX",
      description: desc,
      images: ["https://hirestepx.com/opengraph-image"],
    },
  };
}

export default async function SalaryReport2026Page() {
  const { rows, stats } = report;
  const updatedLabel = monthYear(stats.lastVerified);

  const emerging = rows.filter((r) => r.emerging);
  const sorted = [...rows].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <>
      {buildSalaryReport2026JsonLd().map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <ConsentGatedAdSense />
      <HubTemplate
        kicker={`Salary data · Updated ${updatedLabel}`}
        title="Indian Startup Engineer Salary Report 2026"
        dek={`Total-CTC ranges for software engineers across ${stats.companyCount} companies hiring in India, including ${stats.emergingCount} emerging AI-native startups and new unicorns (Sarvam, Moglix, Navi, Zepto and more) that have almost no public compensation data anywhere else. Every band links to a full per-company breakdown with sources and a verification date.`}
        crumbs={[{ label: "Salaries", href: "/salary" }, { label: "Salary report 2026" }]}
        stats={[
          { label: "Median entry (0–2 yr)", value: medianText(stats.entryMedian) },
          { label: "Median mid (2–5 yr)", value: medianText(stats.midMedian) },
          { label: "Median senior (5+ yr)", value: medianText(stats.seniorMedian) },
          { label: "Companies with a verified SWE band", value: String(stats.companyCount) },
          { label: "Emerging AI and new-economy startups", value: String(stats.emergingCount) },
          ...(stats.topPayer ? [{ label: `Highest senior band: ${stats.topPayer.label}`, value: `${lpa(stats.topPayer.seniorMax)} LPA` }] : []),
        ]}
        cta={["Start a free mock interview", "/signup"]}
        sections={[
          {
            kind: "table", id: "by-level", title: "Median software-engineer CTC by level",
            sub: `Median across all ${stats.companyCount} companies. Each row shows the median low-to-high total-CTC band at that level.`,
            head: ["Level", "Median total CTC"],
            rows: [["Entry", medianText(stats.entryMedian)], ["Mid", medianText(stats.midMedian)], ["Senior", medianText(stats.seniorMedian)]],
          },
          ...(emerging.length > 0 ? [{
            kind: "table" as const, id: "emerging", title: "Emerging AI startups & new unicorns",
            sub: "Compensation for India's newest AI-native companies and recent unicorns is largely absent from AmbitionBox and Glassdoor. These bands are aggregated from public filings, Levels.fyi, and offer-letter research. This is the slice worth citing.",
            head: TABLE_HEAD, rows: emerging.map(tableRow),
          }] : []),
          {
            kind: "table", id: "all-companies", title: `All ${stats.companyCount} companies`,
            sub: "Every company with a verified software-engineer band, A to Z.",
            head: TABLE_HEAD, rows: sorted.map(tableRow),
          },
          {
            kind: "grid", id: "salary-pages", title: "Full salary breakdown by company",
            sub: "Open any company for the full CTC breakdown by role and level, with negotiation guidance and cited sources.",
            items: sorted.map((r) => ({ label: r.label, href: `/salary/${r.slug}`, meta: `Entry ${range(r.entryMin, r.entryMax)} LPA` })),
            initial: 18, filter: true,
          },
          {
            kind: "text", id: "methodology", title: "Methodology & sources",
            paragraphs: [
              "Bands are total CTC in LPA (fixed + variable + annualised equity), not just base. Each company's band is cross-referenced from up to four sources.",
              "Levels.fyi: self-reported total-comp for product companies.",
              "AmbitionBox and Glassdoor: India-specific self-reported ranges (directional; corrected for the known upward variable-pay bias).",
              "DRHP and annual filings: for listed and recently IPO'd companies, the most authoritative source.",
              "Offer-letter aggregation: for emerging startups with no public dataset yet.",
              `Every per-company page carries its own source list and a last-verified date. Figures are refreshed quarterly; the most recent verification in this dataset is ${updatedLabel}. Treat emerging-startup bands as directional: anchor negotiations to the lower half and validate with a recruiter.`,
            ],
          },
        ]}
        close={{ kicker: "Practice before the offer call", title: "Know the number. Then earn it.", body: "Knowing the band is half the battle. The other half is interviewing well enough to land the top of it. Practice a full voice mock interview with scored STAR feedback, free.", primary: ["Start a free mock interview", "/signup"] }}
      />
    </>
  );
}
