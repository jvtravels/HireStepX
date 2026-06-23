/* India HR-round norms, keyed by employer sector.
 *
 * The scored HR report cites these so notice-period / BGV / comp guidance is
 * grounded in how the candidate's actual sector behaves — not a single generic
 * paragraph. They are deterministic FACTS we encode (not LLM output), so the
 * render can state them with confidence and the prompt can hand them to the LLM
 * as grounding for its prose.
 *
 * Sector keys mirror HrSectorOverlay in server-handlers/_hr-round-overlays.ts.
 * Kept here (data layer, no server import) so this stays a dependency leaf; the
 * server-side resolver in _hr-round-overlays.ts maps a company -> sector -> norms.
 *
 * Sources: standard Indian IT-services / product / BFSI hiring practice as of
 * 2025–26 (notice norms, BGV vendor prevalence, moonlighting/dual-employment
 * scrutiny). Ranges are typical, not contractual — the copy says "typically".
 */

export type HrNormSector = "services-tier1" | "product-unicorn" | "bfsi" | "none";

export interface HrCompanyNorms {
  sector: HrNormSector;
  /** Human label for the sector, e.g. "IT services". */
  sectorLabel: string;
  /** Typical notice-period expectation in this sector, e.g. "60–90 days". */
  noticeNorm: string;
  /** One line on whether buyouts are realistic here. */
  buyoutNote: string;
  /** Documents Indian BGV firms in this sector almost always pull. */
  bgvDocs: string[];
  /** BGV vendors common in this sector (so the candidate recognises the names). */
  bgvFirms: string[];
  /** One line on comp-negotiation reality in this sector. */
  compNote: string;
  /** One line on dual-employment / moonlighting scrutiny. */
  dualEmploymentNote: string;
}

const SERVICES_T1: HrCompanyNorms = {
  sector: "services-tier1",
  sectorLabel: "IT services",
  noticeNorm: "60–90 days",
  buyoutNote: "Buyouts are uncommon and often disallowed — plan to serve the full notice.",
  bgvDocs: [
    "3 months' payslips",
    "Form-16 / Form-26AS",
    "relieving letter from each employer",
    "10th / 12th / degree marksheets",
    "PAN + Aadhaar",
    "UAN / PF passbook",
  ],
  bgvFirms: ["AuthBridge", "First Advantage", "OnGrid"],
  compNote: "Bands are largely grade-fixed; expect limited room — anchor on a realistic hike (often capped near 30–40% over current CTC).",
  dualEmploymentNote: "Dual employment is a hard red flag — overlapping UAN/PF activity surfaces in checks. Disclose any concurrent work.",
};

const PRODUCT_UNICORN: HrCompanyNorms = {
  sector: "product-unicorn",
  sectorLabel: "product / startup",
  noticeNorm: "30–60 days",
  buyoutNote: "Buyouts are common for in-demand roles — you can negotiate the company covering a notice shortfall.",
  bgvDocs: [
    "3 months' payslips",
    "offer + relieving letters",
    "UAN / PF passbook",
    "PAN + Aadhaar",
    "degree certificate",
  ],
  bgvFirms: ["AuthBridge", "First Advantage", "SpringVerify"],
  compNote: "ESOP/RSU literacy matters — know the 1-year cliff, 4-year vest, and buyback cadence. Cash-vs-equity split is negotiable.",
  dualEmploymentNote: "Moonlighting is scrutinised post-2022 — disclose any side income or concurrent contracts up front.",
};

const BFSI: HrCompanyNorms = {
  sector: "bfsi",
  sectorLabel: "banking / financial services",
  noticeNorm: "30–90 days",
  buyoutNote: "Buyouts vary by grade — some banks allow them, many don't. Confirm early.",
  bgvDocs: [
    "3 months' payslips",
    "Form-16",
    "relieving letters",
    "education marksheets",
    "CIBIL / credit check",
    "prior-disciplinary / dismissal disclosure",
  ],
  bgvFirms: ["AuthBridge", "First Advantage", "in-house compliance"],
  compNote: "Comp upside is capped vs product; fixed-heavy. Negotiate grade, joining bonus, and variable rather than base alone.",
  dualEmploymentNote: "Regulatory conduct rules apply — conflicts of interest and outside directorships are checked. Disclose everything.",
};

const NONE: HrCompanyNorms = {
  sector: "none",
  sectorLabel: "",
  noticeNorm: "",
  buyoutNote: "",
  bgvDocs: [],
  bgvFirms: [],
  compNote: "",
  dualEmploymentNote: "",
};

const NORMS_BY_SECTOR: Record<HrNormSector, HrCompanyNorms> = {
  "services-tier1": SERVICES_T1,
  "product-unicorn": PRODUCT_UNICORN,
  bfsi: BFSI,
  none: NONE,
};

/** Map an already-resolved sector to its norms. Returns null for "none" so
 *  callers can fall back to generic copy when no company / unknown sector. */
export function hrCompanyNorms(sector: HrNormSector): HrCompanyNorms | null {
  const norms = NORMS_BY_SECTOR[sector] ?? NONE;
  return norms.sector === "none" ? null : norms;
}
