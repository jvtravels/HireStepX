/* Computes a SHA-256 CSP hash for every inline JSON-LD <script> rendered by
 * the static/ISR SEO routes (/blog/[slug], /salary/[company], /questions/[slug]),
 * and writes a pathname -> hash[] manifest that proxy.ts's buildCsp() reads to
 * allowlist them without a live per-request nonce (which would force these
 * routes fully dynamic and defeat ISR caching).
 *
 * Calls the SAME builder functions the pages render with, so the hash can
 * never drift from what's actually served. Run via `npm run generate:jsonld-hashes`;
 * wired into `prebuild` so the manifest can't go stale.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getAllBlogSlugs } from "../src/blog-meta";
import { buildBlogJsonLd } from "../app/(marketing)/blog/[slug]/_jsonld";
import { getAllSalarySlugs } from "../data/salary-seo";
import { buildSalaryPageModel } from "../app/(marketing)/salary/[company]/_jsonld";
import { getAllSeoSlugs } from "../data/seo-pages";
import { buildQuestionsPageModel } from "../app/(marketing)/questions/[slug]/_jsonld";
import { getAllBlogCategorySlugs, buildBlogCategoryJsonLd } from "../app/(marketing)/blog/category/[category]/_jsonld";
import { getAllBlogCompanySlugs, buildBlogCompanyJsonLd } from "../app/(marketing)/blog/company/[slug]/_jsonld";
import { getAllCitySlugs } from "../data/city-pages";
import { buildInterviewPrepCityJsonLd } from "../app/(marketing)/interview-prep/[city]/_jsonld";
import { buildAboutJsonLd } from "../app/(marketing)/about/_jsonld";
import { buildContactJsonLd } from "../app/(marketing)/contact/_jsonld";
import { buildEnglishInterviewPracticeJsonLd } from "../app/(marketing)/english-interview-practice/_jsonld";
import { buildForStudentsJsonLd } from "../app/(marketing)/for-students/_jsonld";
import { buildGrievanceJsonLd } from "../app/(marketing)/grievance/_jsonld";
import { buildHowItWorksJsonLd } from "../app/(marketing)/how-it-works/_jsonld";
import { buildInterviewAnxietyJsonLd } from "../app/(marketing)/interview-anxiety/_jsonld";
import { buildPricingJsonLd } from "../app/(marketing)/pricing/_jsonld";
import { buildPrivacyJsonLd } from "../app/(marketing)/privacy/_jsonld";
import { buildReferralJsonLd } from "../app/(marketing)/referral/_jsonld";
import { buildRefundJsonLd } from "../app/(marketing)/refund/_jsonld";
import { buildSalaryReport2026JsonLd } from "../app/(marketing)/salary-report-2026/_jsonld";
import { buildTelephonicInterviewJsonLd } from "../app/(marketing)/telephonic-interview-questions/_jsonld";
import { buildTermsJsonLd } from "../app/(marketing)/terms/_jsonld";
import { buildAiMockInterviewJsonLd, FAQ_ENTRIES as AI_MOCK_FAQ_ENTRIES, HOW_IT_WORKS as AI_MOCK_HOW_IT_WORKS } from "../app/(marketing)/ai-mock-interview/_jsonld";
import { buildWalkInInterviewJsonLd, FAQ_ENTRIES as WALK_IN_FAQ_ENTRIES } from "../app/(marketing)/walk-in-interview-preparation/_jsonld";
import { buildBpoInterviewJsonLd, FAQ_ENTRIES as BPO_FAQ_ENTRIES } from "../app/(marketing)/bpo-interview-questions/_jsonld";
import { buildOneWayVideoInterviewJsonLd, FAQ_ENTRIES as ONE_WAY_VIDEO_FAQ_ENTRIES } from "../app/(marketing)/one-way-video-interview-practice/_jsonld";
import { buildBankPoInterviewJsonLd, FAQ_ENTRIES as BANK_PO_FAQ_ENTRIES } from "../app/(marketing)/bank-po-interview-questions/_jsonld";
import { buildMbaPersonalInterviewJsonLd, FAQ_ENTRIES as MBA_PI_FAQ_ENTRIES } from "../app/(marketing)/mba-personal-interview-preparation/_jsonld";
import { buildGa4InitScript } from "../app/_ga4-script";

function hashScript(html: string): string {
  const digest = createHash("sha256").update(html, "utf8").digest("base64");
  return `sha256-${digest}`;
}

const manifest: Record<string, string[]> = {};

// Global (route-independent) hashes applied to every hash-based (marketing)
// CSP — currently just the ga4-init inline script MarketingAnalytics renders
// on every marketing page. Only computed when GA_ID is actually set, since
// MarketingAnalytics doesn't render the script at all otherwise.
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
if (GA_ID) {
  manifest.__global__ = [hashScript(buildGa4InitScript(GA_ID))];
}

for (const slug of getAllBlogSlugs()) {
  const scripts = buildBlogJsonLd(slug);
  manifest[`/blog/${slug}`] = scripts.map((s) => hashScript(s.__html));
}

for (const slug of getAllSalarySlugs()) {
  const model = buildSalaryPageModel(slug);
  if (!model) continue;
  manifest[`/salary/${slug}`] = model.jsonLdScripts.map((s) => hashScript(s.__html));
}

for (const slug of getAllSeoSlugs()) {
  const model = buildQuestionsPageModel(slug);
  if (!model) continue;
  manifest[`/questions/${slug}`] = model.jsonLdScripts.map((s) => hashScript(s.__html));
}

for (const slug of getAllBlogCategorySlugs()) {
  const scripts = buildBlogCategoryJsonLd(slug);
  if (!scripts) continue;
  manifest[`/blog/category/${slug}`] = scripts.map((s) => hashScript(s.__html));
}

for (const slug of getAllBlogCompanySlugs()) {
  const scripts = buildBlogCompanyJsonLd(slug);
  if (!scripts) continue;
  manifest[`/blog/company/${slug}`] = scripts.map((s) => hashScript(s.__html));
}

for (const slug of getAllCitySlugs()) {
  const scripts = buildInterviewPrepCityJsonLd(slug);
  if (!scripts) continue;
  manifest[`/interview-prep/${slug}`] = scripts.map((s) => hashScript(s.__html));
}

const staticRoutes: Record<string, { __html: string }[]> = {
  "/about": buildAboutJsonLd(),
  "/contact": buildContactJsonLd(),
  "/english-interview-practice": buildEnglishInterviewPracticeJsonLd(),
  "/for-students": buildForStudentsJsonLd(),
  "/grievance": buildGrievanceJsonLd(),
  "/how-it-works": buildHowItWorksJsonLd(),
  "/interview-anxiety": buildInterviewAnxietyJsonLd(),
  "/pricing": buildPricingJsonLd(),
  "/privacy": buildPrivacyJsonLd(),
  "/referral": buildReferralJsonLd(),
  "/refund": buildRefundJsonLd(),
  "/salary-report-2026": buildSalaryReport2026JsonLd(),
  "/telephonic-interview-questions": buildTelephonicInterviewJsonLd(),
  "/terms": buildTermsJsonLd(),
  "/ai-mock-interview": buildAiMockInterviewJsonLd(AI_MOCK_FAQ_ENTRIES, AI_MOCK_HOW_IT_WORKS),
  "/walk-in-interview-preparation": buildWalkInInterviewJsonLd(WALK_IN_FAQ_ENTRIES),
  "/bpo-interview-questions": buildBpoInterviewJsonLd(BPO_FAQ_ENTRIES),
  "/one-way-video-interview-practice": buildOneWayVideoInterviewJsonLd(ONE_WAY_VIDEO_FAQ_ENTRIES),
  "/bank-po-interview-questions": buildBankPoInterviewJsonLd(BANK_PO_FAQ_ENTRIES),
  "/mba-personal-interview-preparation": buildMbaPersonalInterviewJsonLd(MBA_PI_FAQ_ENTRIES),
};

for (const [route, scripts] of Object.entries(staticRoutes)) {
  manifest[route] = scripts.map((s) => hashScript(s.__html));
}

const outDir = path.join(process.cwd(), "data", "generated");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "jsonld-csp-hashes.json");
writeFileSync(outFile, JSON.stringify(manifest, null, 2) + "\n");

const routeCount = Object.keys(manifest).length;
const hashCount = Object.values(manifest).reduce((n, arr) => n + arr.length, 0);
console.log(`Wrote ${hashCount} CSP hashes across ${routeCount} routes to ${path.relative(process.cwd(), outFile)}`);
