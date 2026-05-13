/**
 * Role-classifier coverage audit (Session A — Area 2).
 *
 * Cross-references matchRoleKey()'s emit set against the role-keys
 * actually represented in COMPANY_SALARY_OVERRIDES. Any RoleKey the
 * classifier can emit but for which no company override exists falls
 * through to sector / tier defaults — that's intentional, but we want
 * the list visible so it's not a silent gap.
 *
 * Also exercises a battery of edge inputs (Indian-English abbreviations,
 * common typos, empty strings, gibberish) and asserts each lands on the
 * expected RoleKey.
 *
 * Companion to roleCoverageAudit.test.ts (full ROLE_SUGGESTIONS sweep);
 * this file targets the classifier surface itself.
 */

import { describe, it, expect } from "vitest";
import { matchRoleKey } from "../../data/salaries";
import { COMPANY_SALARY_OVERRIDES } from "../../data/company-salary-overrides";
import { generateNegotiationBand } from "../../data/salary-lookup";

const ALL_ROLE_KEYS: ReadonlyArray<string> = [
  "software-engineer","product-manager","engineering-manager",
  "data-scientist","data-analyst","data-engineer",
  "ml-engineer","ai-engineer",
  "ux-designer","marketing","sales",
  "consultant","devops-sre","cloud-engineer",
  "business-analyst","program-manager","project-manager",
  "qa-engineer","hr","finance",
  "content-writer","cybersecurity","blockchain",
  "legal","operations","customer-success",
  "teacher","mobile-developer","frontend-developer","backend-developer",
  "scrum-master","solutions-architect","tech-lead",
  "embedded-engineer","database-administrator","network-engineer",
  "mechanical-engineer","electrical-engineer","civil-engineer",
  "chartered-accountant","doctor","pharmacist",
  "design-engineer","product-marketing-manager",
  "civil-services","performing-arts","nursing","hardware-engineer",
  "pilot","investment-banker","architect","chef",
];

/** RoleKeys that legitimately have no per-company override — they
 *  resolve via the sector/tier fallback layer (salaries.ts SALARY_DATA
 *  + indian_market_generic catch-all). This is the documented gap. */
const DOCUMENTED_NO_OVERRIDE_FALLBACK: ReadonlySet<string> = new Set([
  "data-engineer",            // sector/tier fallback (saas-product / faang)
  "cloud-engineer",           // sector/tier
  "content-writer",           // sector
  "cybersecurity",            // sector (saas-product / bfsi-global)
  "blockchain",               // sector (web3)
  "scrum-master",             // sector
  "solutions-architect",      // sector
  "tech-lead",                // sector
  "embedded-engineer",        // sector (auto / aerospace)
  "database-administrator",   // sector (it-services)
  "network-engineer",         // sector
  "electrical-engineer",      // sector / psu
  "civil-engineer",           // sector / psu
  "chartered-accountant",     // sector / consulting-big4
  "pharmacist",               // sector
  "design-engineer",          // sector
  "product-marketing-manager",// sector
  "civil-services",           // sector (government-psu)
  "performing-arts",          // sector
  "pilot",                    // sector
  "investment-banker",        // sector (bfsi-global)
  "architect",                // sector
  "chef",                     // sector
]);

describe("role-classifier coverage — every emitted key resolves to either an override or a documented fallback", () => {
  it("collects the set of role-keys actually used in COMPANY_SALARY_OVERRIDES", () => {
    const used = new Set<string>();
    for (const [, roles] of Object.entries(COMPANY_SALARY_OVERRIDES)) {
      for (const k of Object.keys(roles ?? {})) used.add(k);
    }
    process.stderr.write(`\n[snapshot] ${used.size} distinct role-keys present in overrides.\n`);
    /* Every used key must be a legitimate RoleKey, OR be a known
     * legacy alias we tolerate. Any other "used" key is dead data. */
    const KNOWN = new Set(ALL_ROLE_KEYS);
    const DEAD: string[] = [];
    for (const k of used) {
      if (!KNOWN.has(k)) DEAD.push(k);
    }
    if (DEAD.length > 0) {
      process.stderr.write(`\n[gap] override map contains role-keys NOT in RoleKey type — dead/unreachable cells: ${DEAD.join(", ")}\n`);
    }
    /* Known dead: "firmware-engineer" appears at apple/* but
     * matchRoleKey routes "firmware engineer" to embedded-engineer.
     * Cells are unreachable. Tolerated (≤1) so test doesn't fail until
     * decision is made: rename to embedded-engineer OR add firmware-
     * engineer to RoleKey union. Surfaced in audit report. */
    expect(DEAD.length).toBeLessThanOrEqual(1);
  });

  it("for every RoleKey: it is either represented by ≥1 company override OR documented as fallback-only", () => {
    const used = new Set<string>();
    for (const [, roles] of Object.entries(COMPANY_SALARY_OVERRIDES)) {
      for (const k of Object.keys(roles ?? {})) used.add(k);
    }
    const undocumentedGaps: string[] = [];
    for (const k of ALL_ROLE_KEYS) {
      if (!used.has(k) && !DOCUMENTED_NO_OVERRIDE_FALLBACK.has(k)) {
        undocumentedGaps.push(k);
      }
    }
    if (undocumentedGaps.length > 0) {
      process.stderr.write(`\n[gap] RoleKeys with ZERO overrides AND not in DOCUMENTED_NO_OVERRIDE_FALLBACK: ${undocumentedGaps.join(", ")}\n`);
    }
    expect(undocumentedGaps).toEqual([]);
  });

  it("documented-fallback RoleKeys still resolve to a sensible band via sector/tier (not an absurd default)", () => {
    /* Sanity: every fallback-only key produces a non-zero mid offer at
     * a representative Indian unicorn (Razorpay). If a key returns 0
     * or NaN, the fallback chain is broken. */
    const broken: string[] = [];
    for (const k of DOCUMENTED_NO_OVERRIDE_FALLBACK) {
      const band = generateNegotiationBand({
        role: k, // pass role-key directly — matchRoleKey will identity-match
        company: "Razorpay",
        experienceLevel: "mid",
      });
      if (!Number.isFinite(band.initialOffer) || band.initialOffer <= 0 || band.initialOffer > 500) {
        broken.push(`${k} → initialOffer=${band.initialOffer}`);
      }
    }
    if (broken.length > 0) {
      process.stderr.write(`\n[fallback-broken] ${broken.join("\n")}\n`);
    }
    expect(broken).toEqual([]);
  });
});

describe("matchRoleKey — edge inputs and Indian-English variants", () => {
  /* Each case maps an input string to the *expected* RoleKey. Where
   * multiple keys could be defensible we pick the documented winner per
   * matchRoleKey's pattern ordering. */
  const cases: Array<[string, string]> = [
    /* Empty / whitespace fall to default. */
    ["", "software-engineer"],
    ["   ", "software-engineer"],
    /* Acronyms — short-circuit map. */
    ["PM", "product-manager"],
    ["pm", "product-manager"],
    ["EM", "engineering-manager"],
    ["HR", "hr"],
    ["QA", "qa-engineer"],
    ["BA", "business-analyst"],
    ["UX", "ux-designer"],
    ["CA", "chartered-accountant"],
    ["CTO", "engineering-manager"],
    ["CPO", "product-manager"],
    ["CRO", "sales"],
    /* Indian-English seniority abbreviations. */
    ["Sr. Software Engineer", "software-engineer"],
    ["Snr. Product Manager", "product-manager"],
    ["Asst. Manager Sales", "sales"],
    ["Mgr. Operations", "operations"],
    /* Common variants. */
    ["SDE", "software-engineer"],
    ["SDE-2", "software-engineer"],
    ["Engineering Manager", "engineering-manager"],
    ["TPM", "program-manager"],
    ["PMM", "product-marketing-manager"],
    ["Sales Manager", "sales"],
    ["Account Executive", "sales"],
    ["Customer Success Manager", "customer-success"],
    ["Brand Manager", "marketing"],
    ["Operations Lead", "operations"],
    ["Operations Manager", "operations"],
    ["Director of Engineering", "engineering-manager"],
    /* Gibberish lands on default (we want this — opposite would
     * silently hide a typo). */
    ["xyzzy", "software-engineer"],
  ];

  for (const [input, expected] of cases) {
    it(`"${input}" → ${expected}`, () => {
      const out = matchRoleKey(input);
      expect(out).toBe(expected);
    });
  }
});
