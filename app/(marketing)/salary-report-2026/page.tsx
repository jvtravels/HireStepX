import type { Metadata } from "next";
import Script from "next/script";
import { SalaryReport2026 } from "@/marketing-v2/SalaryReport2026";
import { NavV2, MobileStickyCTA } from "@/marketing-v2/HomepageV2";
import { FooterDome } from "@/marketing-v2/FooterDome";
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

  return (
    <>
      {buildSalaryReport2026JsonLd().map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7810403590527236"
        crossOrigin="anonymous"
        strategy="lazyOnload"
      />
      <NavV2 />
      <SalaryReport2026 rows={rows} stats={stats} updatedLabel={updatedLabel} />
      <FooterDome />
      <MobileStickyCTA />
    </>
  );
}
