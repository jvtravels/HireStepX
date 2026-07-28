/* Regenerates data/company-redirect-map.json from data/seo-pages.ts.
 * Run this whenever a company is added to or reordered in SEO_PAGES, so
 * /companies/<company> keeps redirecting to that company's first page.
 * Usage: node scripts/generate-company-redirect-map.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync(new URL("../data/seo-pages.ts", import.meta.url), "utf8");
const body = src.slice(src.indexOf("export const SEO_PAGES"));

const re = /slug:\s*"([^"]+)"[\s\S]*?company:\s*"([^"]+)"/g;
const seen = new Map();
let match;
while ((match = re.exec(body))) {
  const [, slug, company] = match;
  if (!seen.has(company)) seen.set(company, slug);
}

const outPath = new URL("../data/company-redirect-map.json", import.meta.url);
writeFileSync(outPath, JSON.stringify(Object.fromEntries(seen), null, 2) + "\n");
console.log(`Wrote ${seen.size} company redirects to data/company-redirect-map.json`);
