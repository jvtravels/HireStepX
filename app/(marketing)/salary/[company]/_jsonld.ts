import {
  getSalaryPage,
  salaryCompanyLabel,
} from "../../../../data/salary-seo";
import { COMPANY_SALARY_OVERRIDES } from "../../../../data/company-salary-overrides";
import { IMPORTED_SALARY_OVERRIDES } from "../../../../data/_imported-salary-overrides.generated";
import { getCsvDerivedBandOverride } from "../../../../data/csv-derived-fallbacks";
import { CALIBRATION_DATE } from "../../../../data/salaries";
import type { SalaryRoleSection, SalaryBandRow } from "@/marketing-v2/SalaryPage";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";
import { humanizeSalarySource } from "../../../../data/_salary-source-helpers";
import { pickVariant } from "../../../../data/_content-variants";

/* Shared source of truth for /salary/[company]'s role/FAQ/JSON-LD data,
 * used by both the page (renders it) and scripts/generate-jsonld-csp-hashes.mts
 * (hashes the JSON-LD for the CSP header). Keeping this in one place
 * guarantees the hash always matches what the page actually renders. */

const LEVEL_KEYS = ["entry", "mid", "senior", "lead", "executive"] as const;

const FAQ_LEVEL_PHRASE: Record<string, string> = {
  entry: "fresher / entry-level (SDE-1)",
  mid: "mid-level (SDE-2)",
  senior: "senior (SDE-3+)",
  lead: "lead",
  executive: "manager",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* Some data-source keys diverge from the salary-seo slug by more than a
   hyphen/space swap (brand renames, punctuation, abbreviations). Without
   this map, an entire company's imported/curated/CSV data is unreachable
   even though it exists in the underlying dataset. */
const COMPANY_KEY_ALIASES: Record<string, string> = {
  techmahindra: "tech mahindra",
  "wells-fargo": "wells fargo india",
  "apollo-247": "apollo hospitals",
  curefit: "cure.fit",
  "tata-1mg": "1mg",
  "procter-gamble": "p&g",
  goldman: "goldman sachs",
  jpmc: "jpmorgan",
  kotak: "kotak mahindra bank",
  paypal: "paypal india",
  "american-express": "american express india",
  airbnb: "airbnb india",
  "twitter-x": "twitter/x india",
};

function resolveOverrides(slug: string) {
  const alias = COMPANY_KEY_ALIASES[slug];
  return (
    COMPANY_SALARY_OVERRIDES[slug] ??
    COMPANY_SALARY_OVERRIDES[slug.replace(/-/g, " ")] ??
    (alias ? COMPANY_SALARY_OVERRIDES[alias] : undefined)
  );
}

function resolveImportedOverrides(slug: string) {
  const alias = COMPANY_KEY_ALIASES[slug];
  return (
    IMPORTED_SALARY_OVERRIDES[slug] ??
    IMPORTED_SALARY_OVERRIDES[slug.replace(/-/g, " ")] ??
    (alias ? IMPORTED_SALARY_OVERRIDES[alias] : undefined)
  );
}

export function buildRoleSections(
  companySlug: string,
  roles: Array<{ roleKey: string; label: string }>,
): SalaryRoleSection[] {
  const overrides = resolveOverrides(companySlug);
  const importedOverrides = resolveImportedOverrides(companySlug);

  return roles.flatMap(({ roleKey, label }) => {
    const roleData = overrides?.[roleKey] ?? importedOverrides?.[roleKey];

    let runningMax = -Infinity;
    let prevCsvFallbackSource: string | undefined;
    const bands: SalaryBandRow[] = LEVEL_KEYS.flatMap((lvl) => {
      const direct = roleData?.[lvl];
      const csvLookupKey = COMPANY_KEY_ALIASES[companySlug] ?? companySlug.replace(/-/g, " ");
      const band = direct ?? getCsvDerivedBandOverride(csvLookupKey, roleKey, lvl);
      if (!band) return [];
      if (band.totalMax < runningMax) return [];
      if (!direct && band.source && band.source === prevCsvFallbackSource) return [];
      runningMax = band.totalMax;
      prevCsvFallbackSource = direct ? undefined : band.source;
      return [
        {
          level: lvl,
          levelLabel: lvl,
          totalMin: band.totalMin,
          totalMax: band.totalMax,
          baseMin: band.baseMin,
          baseMax: band.baseMax,
          equityType: band.equityType,
          equityMin: band.equityMin,
          equityMax: band.equityMax,
          notes: band.notes,
          source: humanizeSalarySource(band.source, band.dataConfidenceTier),
          dataConfidenceTier: band.dataConfidenceTier,
          lastVerified: band.lastVerified,
        } satisfies SalaryBandRow,
      ];
    });

    if (bands.length === 0) return [];

    return [{ roleKey, roleLabel: label, bands }];
  });
}

export type SalaryFaq = { q: string; a: string };

/* PRI-150: several phrasings per slot, rotated deterministically per
   company+role (see data/_content-variants.ts) so 224 pages built from the
   same skeleton don't read as verbatim duplicates to Google. */
const HEADLINE_Q_VARIANTS = [
  (role: string, label: string) => `What is the ${role} salary at ${label} India 2026?`,
  (role: string, label: string) => `How much does ${label} pay a ${role} in India?`,
  (role: string, label: string) => `${label} ${role} salary — what's the 2026 range?`,
] as const;

const HEADLINE_A_VARIANTS = [
  (role: string, label: string, min: number, max: number, lo: string, hi: string) =>
    `${role}s at ${label} in India earn between ₹${min}L and ₹${max}L total CTC (2026, ${lo} to ${hi}, 25th–90th percentile).`,
  (role: string, label: string, min: number, max: number, lo: string, hi: string) =>
    `${label} pays ${role}s in India ₹${min}L–₹${max}L total CTC as of 2026, spanning ${lo} through ${hi} level (25th–90th percentile of reported offers).`,
  (role: string, label: string, min: number, max: number, lo: string, hi: string) =>
    `Total CTC for a ${role} at ${label} ranges ₹${min}L to ₹${max}L in 2026 (${lo}–${hi}, 25th–90th percentile).`,
] as const;

const PER_LEVEL_Q_VARIANTS = [
  (phrase: string, role: string, label: string) => `What is the ${phrase} ${role} salary at ${label}?`,
  (phrase: string, role: string, label: string) => `How much does a ${phrase} ${role} earn at ${label}?`,
  (phrase: string, role: string, label: string) => `${label} ${phrase} ${role}: what's the pay in 2026?`,
] as const;

const PER_LEVEL_A_VARIANTS = [
  (phraseCap: string, role: string, label: string, min: number, max: number, source: string) =>
    `${phraseCap} ${role}s at ${label} earn ₹${min}L–₹${max}L total CTC in India (2026). Source: ${source}.`,
  (phraseCap: string, role: string, label: string, min: number, max: number, source: string) =>
    `At the ${phraseCap.toLowerCase()} band, ${label} ${role}s in India take home ₹${min}L–₹${max}L total CTC (2026 data, ${source}).`,
  (phraseCap: string, role: string, label: string, min: number, max: number, source: string) =>
    `${label}'s ${phraseCap.toLowerCase()} ${role}s see ₹${min}L–₹${max}L total CTC in 2026, per ${source}.`,
] as const;

/* Built once and reused for both the visible FAQ section and the FAQPage
   JSON-LD, so structured data always matches what's actually on the page.
   Capped at 12 total so a broad-roster page (many roles) can't balloon
   into an unreadable wall of accordion items. */
export function buildSalaryFaqs(
  roles: SalaryRoleSection[],
  label: string,
  companySlug: string,
): SalaryFaq[] {
  return roles
    .flatMap((role) => {
      if (role.bands.length === 0) return [];
      const allMin = Math.min(...role.bands.map((b) => b.totalMin));
      const allMax = Math.max(...role.bands.map((b) => b.totalMax));
      const loLevel = role.bands[0].level;
      const hiLevel = role.bands[role.bands.length - 1].level;
      const headlineSeed = `${companySlug}:${role.roleKey}:headline`;
      const headline = {
        q: pickVariant(headlineSeed, HEADLINE_Q_VARIANTS)(role.roleLabel, label),
        a: pickVariant(headlineSeed, HEADLINE_A_VARIANTS)(role.roleLabel, label, allMin, allMax, loLevel, hiLevel),
      };
      const perLevel = role.bands.map((band) => {
        const phrase = FAQ_LEVEL_PHRASE[band.level] ?? band.level;
        const levelSeed = `${companySlug}:${role.roleKey}:${band.level}`;
        return {
          q: pickVariant(levelSeed, PER_LEVEL_Q_VARIANTS)(phrase, role.roleLabel, label),
          a: pickVariant(levelSeed, PER_LEVEL_A_VARIANTS)(
            capitalize(phrase),
            role.roleLabel,
            label,
            band.totalMin,
            band.totalMax,
            band.source,
          ),
        };
      });
      return [headline, ...perLevel];
    })
    .slice(0, 12);
}

/* Full page model: role sections + FAQs + JSON-LD, computed once and shared
   between the rendered page and the generator that hashes the JSON-LD for CSP. */
export function buildSalaryPageModel(company: string) {
  const page = getSalaryPage(company);
  if (!page) return null;

  const label = salaryCompanyLabel(company);
  const roles = buildRoleSections(company, page.roles);
  const faqs = buildSalaryFaqs(roles, label, company);

  const faqSchema = faqs.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${label} Salary Guide India 2026`,
    description: page.metaDescription,
    image: "https://hirestepx.com/opengraph-image",
    author: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    publisher: {
      "@type": "Organization",
      name: "HireStepX",
      logo: { "@type": "ImageObject", url: "https://hirestepx.com/wordmark.png" },
    },
    datePublished: "2026-06-01",
    dateModified: `${CALIBRATION_DATE}-01`,
    inLanguage: "en-IN",
    url: `https://hirestepx.com/salary/${company}`,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://hirestepx.com/salary/${company}`,
    },
  };

  const breadcrumbSchema = breadcrumb([
    { name: "Salary Guides", path: "/salary" },
    { name: `${label} Salary 2026`, path: `/salary/${company}` },
  ]);

  const jsonLdScripts: { __html: string }[] = [];
  if (faqSchema) jsonLdScripts.push(ldJson(faqSchema));
  jsonLdScripts.push(ldJson(articleSchema));
  jsonLdScripts.push(ldJson(breadcrumbSchema));

  return { page, label, roles, faqs, jsonLdScripts };
}
