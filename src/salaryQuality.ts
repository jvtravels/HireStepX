/* Companies with >=18 synthetic (tier-benchmark, not company-sourced) salary
   cells in data/_synthetic-cells-triage.generated.json. Google's "Crawled -
   currently not indexed" list (GSC, Oct 2026) held 4 salary pages (godrej,
   uber, cars24, paytm), all in this set; the 29 pages carry <1% of clicks. */
const SYNTHETIC_HEAVY_SALARY_SLUGS = new Set([
  "acko", "adobe", "amazon", "atlassian", "browserstack", "cars24", "freshworks",
  "godrej", "goldman", "groww", "hul", "jpmc", "mahindra", "meta", "microsoft",
  "myntra", "netflix", "nykaa", "paytm", "postman", "salesforce", "stripe",
  "swiggy", "tata-motors", "tata-steel", "uber", "walmart-global-tech", "zoho",
  "zomato",
]);

export function isSyntheticHeavySalaryPage(slug: string): boolean {
  return SYNTHETIC_HEAVY_SALARY_SLUGS.has(slug);
}
