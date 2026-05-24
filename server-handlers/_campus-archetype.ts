/**
 * Campus-placement archetype classifier — finer than `classifyCompanyTier`.
 *
 * The Indian campus-hiring market is dominated by a handful of named
 * tracks, each with a distinct rubric the recruiter is grading against.
 * "TCS" alone isn't enough — TCS NQT Ninja (6.0 CGPA bar, basic coding)
 * and TCS Digital (7.5 CGPA bar, deep DSA, ~3x compensation) are
 * different interviews entirely. We resolve to one of these archetypes
 * so the analyzer can apply the right cutoff + the right rubric weight.
 *
 *   - `tcs-ninja`        — TCS NQT base track. CGPA 6.0+, basic coding.
 *   - `tcs-digital`      — TCS Digital + Infosys Power Programmer /
 *                          Specialist + Wipro Elite. CGPA 7.5+, DSA depth.
 *   - `wipro-nlth`       — Wipro NLTH base + Cognizant GenC + Capgemini
 *                          Exceller. Bond + location-flex critical.
 *                          CGPA floor moved to 6.0 in 2025 (was 6.5);
 *                          internal college gatekeeping often enforces
 *                          7.0+ regardless of firm cutoff.
 *   - `top-tier-campus`  — Google/Amazon/Microsoft/Adobe/Flipkart/Razorpay
 *                          on-campus. Project depth + system-design lite.
 *   - `unknown`          — no specialized track detected; fall back to
 *                          the coarser `classifyCompanyTier`.
 *
 * Resolution order: explicit transcript hint > company-string match.
 * Transcript hints win because a candidate saying "I was shortlisted
 * for TCS Digital" is more precise than the bare target_company "TCS".
 */

export type CampusArchetype =
  | "tcs-ninja"
  | "tcs-digital"
  | "wipro-nlth"
  | "cognizant-genc"
  | "top-tier-campus"
  | "unknown";

/* Explicit track-name hints in the transcript. Highest-precedence signal —
 * a candidate saying "Digital track" / "Power Programmer" tells us which
 * variant of the parent company applies. */
const HINT_TCS_DIGITAL = /\b(?:tcs\s+digital|digital\s+track|power\s+programmer|infy(?:tq)?\s+(?:power\s+programmer|specialist)|infosys\s+(?:specialist|power\s+programmer)|wipro\s+elite|elite\s+track)\b/i;
const HINT_TCS_NINJA = /\b(?:tcs\s+(?:ninja|nqt|national\s+qualifier)|nqt\s+(?:ninja|base|track)|ninja\s+track|infosys\s+systems?\s+engineer|infy\s+systems?\s+engineer|se\s+track\s+at\s+infosys)\b/i;
const HINT_WIPRO_NLTH = /\b(?:wipro\s+nlth|wipro\s+turbo|nlth\s+track|hcl\s+techbee)\b/i;
const HINT_COGNIZANT_GENC = /\b(?:cognizant\s+genc(?:\s+next)?|genc\s+next|genc\s+pro|capgemini\s+exceller|exceller\s+track)\b/i;
const HINT_TOP_TIER = /\b(?:google\s+step|amazon\s+future\s+engineer|microsoft\s+engage|microsoft\s+aspire|adobe\s+women[- ]?in[- ]?tech|flipkart\s+gold|razorpay\s+road|day[- ]?1\s+slot|day\s+one\s+(?:slot|company))\b/i;

/* Pure company-string buckets (no transcript context). Conservative —
 * only assigns an archetype when the company strongly implies one. */
const COMPANY_TOP_TIER = [
  "google", "amazon", "microsoft", "meta", "facebook", "apple", "netflix",
  "adobe", "linkedin", "atlassian", "stripe", "salesforce", "nvidia",
  "uber", "doordash", "intuit", "databricks", "snowflake", "mongodb",
  "flipkart", "razorpay", "phonepe", "swiggy", "zomato", "cred", "zerodha",
  "myntra", "paytm", "freshworks", "browserstack", "postman",
];
const COMPANY_TCS = ["tcs", "tata consultancy"];
const COMPANY_COGNIZANT = ["cognizant", "capgemini"];
const COMPANY_WIPRO_NLTH = ["wipro", "hcl", "tech mahindra"];
const COMPANY_INFOSYS = ["infosys", "infy"];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function wordMatch(n: string, term: string): boolean {
  return ` ${n} `.includes(` ${term} `);
}

export function classifyCampusArchetype(
  company: string | null | undefined,
  transcriptText: string = "",
): CampusArchetype {
  /* 1. Transcript hints override company-name buckets. */
  if (HINT_TCS_DIGITAL.test(transcriptText)) return "tcs-digital";
  if (HINT_TOP_TIER.test(transcriptText)) return "top-tier-campus";
  if (HINT_COGNIZANT_GENC.test(transcriptText)) return "cognizant-genc";
  if (HINT_WIPRO_NLTH.test(transcriptText)) return "wipro-nlth";
  if (HINT_TCS_NINJA.test(transcriptText)) return "tcs-ninja";

  /* 2. Company-name fallback. */
  if (!company) return "unknown";
  const n = normalize(company);
  if (!n) return "unknown";

  for (const term of COMPANY_TOP_TIER) if (wordMatch(n, term)) return "top-tier-campus";
  // For TCS / Infosys, default to the base/ninja track when the
  // transcript didn't disambiguate. The Digital variant is the
  // exception, not the rule, by candidate volume.
  for (const term of COMPANY_TCS) if (wordMatch(n, term)) return "tcs-ninja";
  for (const term of COMPANY_INFOSYS) if (wordMatch(n, term)) return "tcs-ninja";
  for (const term of COMPANY_COGNIZANT) if (wordMatch(n, term)) return "cognizant-genc";
  for (const term of COMPANY_WIPRO_NLTH) if (wordMatch(n, term)) return "wipro-nlth";

  return "unknown";
}

/**
 * Archetype-specific CGPA cutoff. Overrides the coarse `companyTier`-
 * derived cutoff in `campus-placement.ts`. Returns `null` when the
 * archetype is `unknown` (callers fall back to the tier default).
 */
export function archetypeCgpaCutoff(arch: CampusArchetype): number | null {
  switch (arch) {
    case "tcs-ninja":      return 6.0;
    case "tcs-digital":    return 7.5;
    case "wipro-nlth":     return 6.0;
    case "cognizant-genc": return 6.0;
    case "top-tier-campus": return 7.5;
    case "unknown":        return null;
  }
}

/**
 * Human-readable label for the report chip + meta payload. Stable —
 * downstream consumers (sessionReport, evaluator prompt) read this.
 */
export function archetypeLabel(arch: CampusArchetype): string {
  switch (arch) {
    case "tcs-ninja":       return "TCS NQT (Ninja) / Infosys SE";
    case "tcs-digital":     return "TCS Digital / Infosys Power Programmer";
    case "wipro-nlth":      return "Wipro NLTH / HCL TechBee";
    case "cognizant-genc":  return "Cognizant GenC / Capgemini Exceller";
    case "top-tier-campus": return "Top-tier campus (product)";
    case "unknown":         return "Generic campus";
  }
}
