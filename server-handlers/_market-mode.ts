/**
 * Market-mode toggle helpers.
 *
 * The kernel already carries a `marketMode: "soft" | "neutral" | "hot"`
 * field that biases the concession curve. This module exposes the pure
 * helpers the kernel uses (so non-kernel callers — prompts, audits,
 * tests — can reason about market mode without re-implementing the math)
 * and adds a sector × role inference for 2025-26 Indian-market defaults.
 *
 * Pure; no I/O. */

import type { MarketMode } from "./_negotiation-kernel";
import type { CompanySector } from "./_company-band-tiers";

/** Concession-curve multiplier applied to the AI's step-up split at each
 *  counter. Soft markets compress what the AI will give up; hot markets
 *  expand it. Defaults preserve legacy behaviour (neutral = 1.0×). */
export function getConcessionMultiplier(mode: MarketMode | undefined | null): number {
  switch (mode) {
    case "soft": return 0.85;
    case "hot":  return 1.10;
    case "neutral":
    default:     return 1.0;
  }
}

/** Walk-away threshold multiplier. Soft markets pull the AI's walk-away
 *  floor up (less willing to chase low); hot markets push it down (more
 *  willing to flex). Default 1.0× preserves legacy behaviour. */
export function getWalkAwayThresholdMultiplier(mode: MarketMode | undefined | null): number {
  switch (mode) {
    case "soft": return 1.05;
    case "hot":  return 0.95;
    case "neutral":
    default:     return 1.0;
  }
}

export interface InferMarketModeInput {
  roleFamily?: string | null;
  sector?: CompanySector | string | null;
  /** ISO-ish year-month string, e.g. "2026-05". Not currently used by the
   *  rule set but accepted so callers can carry the freshness signal. */
  yearMonth?: string | null;
  /** Free-form target role title. Used to detect AI/ML/data specialization
   *  which forces hot regardless of tier (Tier-3 item 9). */
  role?: string | null;
  /** Optional tier the candidate is interviewing at. */
  tier?: string | null;
}

/** 2025-26 Indian market defaults inferred from (role-family, sector, role).
 *  Tier-3 extension: data/ML/AI roles force hot regardless of tier. */
export function inferMarketMode(input: InferMarketModeInput): MarketMode {
  const role = (input.role ?? "").toLowerCase();
  const family = (input.roleFamily ?? "").toLowerCase();
  const sector = (input.sector ?? "") as string;

  // Tier-3 (item 9): role-specialization asymmetry — AI/ML/data engineering
  // / MLE / NLP / LLM keywords force hot regardless of sector or tier.
  if (
    /\b(ai|ml|machine\s+learning|data\s+(scientist|engineer)|mle|nlp|llm|gen\s*ai|generative\s*ai|deep\s+learning|computer\s+vision|cv\s+engineer)\b/.test(role) ||
    family === "data"
  ) {
    return "hot";
  }

  // Engineering + IT-services = soft (services pricing has tightened in
  // 2025-26 with onsite-rate compression).
  if (family === "engineering" && /it-services|services/.test(sector)) {
    return "soft";
  }

  // Engineering + GCC = neutral.
  if (family === "engineering" && /gcc/.test(sector)) {
    return "neutral";
  }

  // Sales + early-stage / startup = soft (funding-winter).
  if (family === "sales" && /startup|seed|early|venture/.test(sector)) {
    return "soft";
  }

  return "neutral";
}

/* ─── Company-mode auto-inference (ITEM 2, 2026-05-15) ─────────────────
 *
 * Infers the company's market segment from the job role and company name.
 * Used during session initialisation when marketMode is not explicitly set,
 * so hike caps, equity norms, and bonus structures use the right defaults.
 *
 * Priority order: GCC > BFSI > STARTUP > MNC > IT_SERVICES (default).
 * GCC must outrank MNC because JPMC India / Wells Fargo India are both GCC
 * and MNC-parent — the GCC pattern is the more specific context.
 *
 * Pure; no I/O. */

/** Company-type market segment. Distinct from MarketMode ("soft"/"neutral"/"hot")
 *  which is the concession-curve bias; CompanyMode is the structural context
 *  that gates hike caps, equity norms, and bonus structure defaults. */
export type CompanyMode = "IT_SERVICES" | "STARTUP" | "GCC" | "BFSI" | "MNC" | "PRODUCT_INDIA" | "CONSULTING";

const BFSI_RE =
  /(bank|insurance|nbfc|mutual\s+fund|hdfc|icici|kotak|axis|sbi|bajaj\s+finserv|lic|life\s+insurance\s+corp)/i;

/* S53-B3/S52-WL-B2 (2026-07-24): expanded to match _hr-round-overlays.ts GCC list.
 * Original only covered financial-sector MNC captives; missing Walmart, Adobe, Cisco
 * etc. caused consulting/GCC companies to fall to IT_SERVICES → "soft" market. */
const GCC_RE =
  /(gcc|global\s+capability|captive|walmart|target\s+corp|lowe'?s|tesco|american\s+express|\bamex\b|optum|unitedhealth|wells\s+fargo|jpmorgan|jp\s+morgan|jpmc|goldman(\s+sachs)?|morgan\s+stanley|deutsche(\s+bank)?|hsbc(\s+tech)?|bank\s+of\s+america|bofa|barclays|standard\s+chartered|nomura|ubs|credit\s+suisse|citibank|citi\b|nvidia|\bintel\b|qualcomm|adobe|cisco|vmware|\bdell\b|\bhp\b|\bhpe\b|shell\b|mastercard|\bvisa\b|paypal|expedia|booking\.com|uber\b|linkedin)/i;

/* S53-B3 (2026-07-24): consulting firms get "neutral" market mode, not "soft".
 * Strategy + Big-4 + MBB: structured comp bands, independent of IT-services
 * pricing compression. Mirrors CONSULTING regex in _hr-round-overlays.ts. */
const CONSULTING_RE =
  /(mckinsey|bcg|boston\s+consulting|\bbain\b|deloitte|\bey\b|ernst\s+(?:&|and)\s+young|\bkpmg\b|\bpwc\b|pricewaterhouse|kearney|oliver\s+wyman|\bzs\b|zs\s+associates|roland\s+berger|alvarez|grant\s+thornton|accenture)/i;

const STARTUP_RE_COMPANY =
  /(zomato|swiggy|zepto|meesho|razorpay|cred\b|groww|slice\b|navi\b|jupiter\b|open\b|niyo|jar\b|fi\s+money|smallcase|zetwerk|moglix|ofbusiness|spinny|cars24|droom|ola\b|rapido|dunzo|blinkit)/i;

const STARTUP_RE_ROLE =
  /series\s+[abc]|seed\s+stage|early\s+stage/i;

const MNC_RE =
  /(google|microsoft|amazon|meta\b|apple|netflix|salesforce|oracle|sap\b|ibm)/i;

/* B5 (2026-07-23) — Indian product companies that are NOT IT-services tier
 * and NOT startups. They have healthy salary budgets, competitive hike norms,
 * and global product portfolios — neutral market mode is the correct default,
 * not the soft mode IT-services vendors get. Placed before the IT_SERVICES
 * fallback so Freshworks / Zoho / Postman etc. resolve "neutral" correctly. */
const PRODUCT_INDIA_RE =
  /(freshworks|zoho\b|chargebee|postman\b|browserstack|hasura\b|clevertap|eka\b|druva\b|icertis|uniphore|kissflow|sprinklr|capillary(\s+tech(?:nologies)?)?|salto\b|mindtickle|whatfix|saastr\b|razorpayx\b|perfios|darwinbox)/i;

/** Infer the company-type market segment from (role, company) strings.
 *  Pure. Call during session init if marketMode is not explicitly set. */
export function inferCompanyMode(role: string, company: string): CompanyMode {
  const r = role ?? "";
  const c = company ?? "";

  /* GCC first — more specific than MNC when the company matches both
   * (e.g. JPMC India, Wells Fargo, Walmart Labs, Deutsche Bank). */
  if (GCC_RE.test(c) || GCC_RE.test(r)) return "GCC";

  /* BFSI — domestic Indian banking / insurance / NBFC. */
  if (BFSI_RE.test(c) || BFSI_RE.test(r)) return "BFSI";

  /* STARTUP — known Indian unicorns / startups, OR role mentions funding stage. */
  if (STARTUP_RE_COMPANY.test(c) || STARTUP_RE_ROLE.test(r)) return "STARTUP";

  /* MNC — global big-tech that isn't GCC. */
  if (MNC_RE.test(c)) return "MNC";

  /* CONSULTING — strategy/Big-4/MBB; neutral market, not soft (S53-B3/2026-07-24). */
  if (CONSULTING_RE.test(c)) return "CONSULTING";

  /* PRODUCT_INDIA — Indian-headquartered product companies. Healthy salary
   * budgets + global product positioning; neutral, not soft. Must sit before
   * the IT_SERVICES default so e.g. Freshworks / Zoho aren't mis-classified. */
  if (PRODUCT_INDIA_RE.test(c)) return "PRODUCT_INDIA";

  /* IT_SERVICES — default for Indian IT vendors and anything unclassified. */
  return "IT_SERVICES";
}
