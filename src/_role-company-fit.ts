/* HireStepX — Role × Company sector-fit detector
 *
 * Today the salary-neg lookup chain silently produces a band even for
 * impossible role × company combinations (e.g. "Pilot @ Razorpay" returns
 * ₹49-65L from the indian-unicorn × pilot tier-default — but Razorpay
 * doesn't hire pilots). The candidate gets coached against the wrong
 * negotiation reality.
 *
 * This helper flags combos where the role's natural sector doesn't
 * overlap with the company's tier. Tech roles (SE, PM, UX, ML, etc.)
 * are universal — they hire across every sector — and never flag.
 * Domain-bound roles (pilot, chef, doctor, civil-services) flag when
 * the company isn't in their natural sector.
 *
 * Tested in src/__tests__/roleCompanyFit.test.ts.
 */

import type { CompanyTier } from "../data/company-tiers";

/** Roles that exist across every company tier — never flag for these. */
const UNIVERSAL_ROLES = new Set([
  "software-engineer", "product-manager", "ux-designer", "ml-engineer",
  "ai-engineer", "data-scientist", "data-analyst", "devops-sre",
  "business-analyst", "program-manager", "project-manager", "qa-engineer",
  "engineering-manager", "frontend-developer", "backend-developer",
  "mobile-developer", "solutions-architect", "architect", "cloud-engineer",
  "blockchain", "cybersecurity", "embedded-engineer", "data-engineer",
  "database-administrator", "network-engineer", "scrum-master",
  "product-marketing-manager", "design-engineer", "hardware-engineer",
  // Generic non-tech roles that exist everywhere too:
  "sales", "marketing", "finance", "hr", "operations", "customer-success",
  "consultant", "content-writer", "performing-arts",
]);

/** Domain-bound roles → which tier(s) they actually exist in.
 *  Anything outside this set for the role gets flagged. */
const ROLE_TIER_AFFINITY: Record<string, Array<CompanyTier | "_psu_or_research" | "_aviation_or_hospitality" | "_healthcare" | "_finance_industry">> = {
  pilot: ["_aviation_or_hospitality"],
  chef: ["_aviation_or_hospitality"],
  doctor: ["_healthcare"],
  nursing: ["_healthcare"],
  pharmacist: ["_healthcare"],
  "chartered-accountant": ["_finance_industry", "consulting-big4", "bfsi-global", "bfsi-domestic"],
  "investment-banker": ["bfsi-global", "consulting-mbb"],
  "civil-services": ["_psu_or_research"],
  "mechanical-engineer": ["_psu_or_research", "fmcg-mnc"], // industrials, auto, FMCG mfg
  "civil-engineer": ["_psu_or_research"],
  "electrical-engineer": ["_psu_or_research"],
  "consulting-mbb": ["consulting-mbb"],
};

/** Map a CompanyTier to a fuzzy sector bucket so role affinity can match
 *  against more than the literal CompanyTier enum. */
function fuzzySectorOf(t: CompanyTier | null | undefined): Array<string> {
  if (!t) return [];
  const buckets: string[] = [t];
  if (t === "government-psu") buckets.push("_psu_or_research");
  if (t === "bfsi-global" || t === "bfsi-domestic") buckets.push("_finance_industry");
  return buckets;
}

export interface RoleCompanyFit {
  fit: "ok" | "soft_mismatch" | "hard_mismatch";
  reason: string;
}

/** Classify the (role, company) pair. Hard mismatches should reject the
 *  setup or warn loudly; soft mismatches add a flag. */
export function detectRoleCompanyFit(
  roleKey: string | null | undefined,
  companyTier: CompanyTier | null | undefined,
  companyName: string | undefined,
): RoleCompanyFit {
  if (!roleKey) {
    return { fit: "soft_mismatch", reason: "Role couldn't be matched to a known key — coaching may be generic." };
  }
  if (UNIVERSAL_ROLES.has(roleKey)) {
    return { fit: "ok", reason: "Role exists across all company tiers." };
  }
  const allowed = ROLE_TIER_AFFINITY[roleKey];
  if (!allowed) {
    // Unknown domain-bound role — soft warning, no hard reject.
    return { fit: "soft_mismatch", reason: `Role "${roleKey}" is domain-bound but its tier-affinity isn't documented; verify the company actually hires for it.` };
  }
  const companyBuckets = new Set(fuzzySectorOf(companyTier));
  const overlap = allowed.some(a => companyBuckets.has(a));
  if (overlap) {
    return { fit: "ok", reason: "Role and company sector match." };
  }
  const coLabel = companyName ?? "this company";
  return {
    fit: "hard_mismatch",
    reason: `${roleKey} is a domain-bound role (${allowed.join(", ")}); ${coLabel} is classified as ${companyTier ?? "an unrelated sector"}. The system will quote a synthetic band — verify the role actually exists at this company before relying on the numbers.`,
  };
}
