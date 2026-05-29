/* HireStepX — Indian salary-negotiation recruiter personas.
 *
 * Phase 3 of Salary-Negotiation track + Realism-Audit Fixes 1/2/3/4
 * (2026-05-22):
 *
 *   Fix 1 — adds three sector archetypes (PSU, Big-4 consulting,
 *           FMCG-management rotational) so the `tierBucket` values
 *           `psu` and `fmcg` stop falling through to default and
 *           `consulting-big4` can be carried by callers who classify
 *           Deloitte / EY / PwC / KPMG / BCG / McKinsey / Bain.
 *   Fix 2 — expands `idiomBias` from 3 phrases per persona to a 15-20
 *           phrase bank per sector (real Indian recruiter register).
 *           Consumed by canonical-prose / restyle-prompt to colour
 *           pushback. Consumers MUST NOT assume a fixed length.
 *   Fix 3 — exposes `stallProbability` (0..1) so the next-action
 *           planner can fire `manager-consult-stall` more often for
 *           sectors where multi-turn "let me check with leadership"
 *           is the dominant leverage move (PSU + Big-4).
 *   Fix 4 — `hikeCap` becomes a function of currentCtc, with
 *           `hikeCapByCtc(currentCtcLpa)`. The scalar `hikeCap`
 *           remains as a fallback for callers that don't know
 *           currentCtc (back-compat with serialized state + analyzer
 *           snapshots). PSU pins the cap flat across all CTC tiers.
 *
 * Distinct from `src/_indian-hr-personas.ts` (HR-round archetypes) and
 * from the legacy `RecruiterPersona` tone-axis in `_negotiation-kernel.ts`
 * (hardline / consultative / founder / agency — modulates the BAND
 * economics).
 *
 * Selected once per session from `tierBucket` + band shape. Constant
 * module — no I/O. Safe to import from server-handlers (Edge runtime).
 */

import type { CompanyTierBucket } from "../src/_negotiation-math";

export type RecruiterSectorPersona =
  | "it-services"
  | "gcc"
  | "indian-unicorn"
  | "early-startup"
  | "bfsi"
  | "psu"
  | "consulting-big4"
  | "fmcg-management"
  | "edtech"
  | "consulting-mbb"
  | "default";

/** Realism-Audit Fix 4 — pushback shape vocabulary extended. */
export type RecruiterSectorPushbackStyle =
  | "rigid-band"          // services
  | "global-benchmark"    // gcc
  | "equity-pivot"        // unicorn
  | "cash-constrained"    // startup
  | "variable-bump"       // bfsi
  | "cadre-pay-rigid"     // psu — Pay-Commission driven, base un-movable
  | "internal-equity-cap" // big-4 consulting — fitment-to-level, internal-equity policed
  | "ldp-trajectory"      // fmcg-management — leadership-development-program framing
  | "sector-correction-defensive" // edtech — post-2023 reset, ESOPs underwater, growth math reset
  | "cohort-band-rigid"   // consulting-mbb — pre-MBA intake cohort band, base un-negotiable
  | "consultative";       // default

/** Realism-Audit Fix 4 — tiered cap by current CTC.
 *  Real services-co caps scale inversely with currentCtc (absolute
 *  number compresses as you climb). PSU pins flat across all tiers
 *  (Pay-Commission rigidity); see `psuFlatCap`. */
export interface HikeCapByCtc {
  /** Cap when currentCtc <= thresholdLow (typically ₹8 LPA). */
  ltLow: number;
  /** Cap when thresholdLow < currentCtc <= thresholdMid (₹20 LPA). */
  midLow: number;
  /** Cap when thresholdMid < currentCtc <= thresholdHigh (₹50 LPA). */
  midHigh: number;
  /** Cap when currentCtc > thresholdHigh. */
  high: number;
  /** Three breakpoints in LPA: [low, mid, high]. */
  thresholds: readonly [number, number, number];
}

export interface RecruiterSectorPersonaConfig {
  id: RecruiterSectorPersona;
  displayName: string;
  /** Scalar hike-cap fallback for callers that don't know currentCtc
   *  (analyzer snapshots, serialized partial state, telemetry). The
   *  authoritative value is `hikeCapByCtc(currentCtcLpa)`. */
  hikeCap: number;
  /** Tiered cap definition. Pass `currentCtcLpa` to `hikeCapByCtc`. */
  hikeCapTiers: HikeCapByCtc;
  /** Width of the in-grade band the persona quotes (% above the
   *  initial anchor). 0.15 = tight (services / BFSI); 0.30 = open
   *  (unicorn / startup). Surfaced in anchor-with-band prose. */
  bandSpread: number;
  /** Shape of pushback on counter-offers. */
  pushbackStyle: RecruiterSectorPushbackStyle;
  /** Whether ESOP is the lever this persona will trade against cash. */
  prefersEsop: boolean;
  /** Realism-Audit Fix 3 — probability (0..1) that the planner picks
   *  `manager-consult-stall` when the candidate over-asks vs band.
   *  Real Indian recruiter behaviour: PSU + Big-4 = high; IT-services
   *  = moderate (one stall, then rigid); unicorn / startup = low
   *  (founders rarely defer to a comp committee). */
  stallProbability: number;
  /** Vocabulary bias for canonical prose. 15-20 sector-true idioms per
   *  persona (Realism-Audit Fix 2). Consumers may sample without
   *  assuming a fixed length. */
  idiomBias: ReadonlyArray<string>;
}

/** Realism-Audit Fix 4 — IT-services default tiers used as the
 *  inverse-scaling baseline. Other sectors widen/narrow off this. */
const IT_SERVICES_TIERS: HikeCapByCtc = {
  ltLow: 0.55,
  midLow: 0.35,
  midHigh: 0.25,
  high: 0.18,
  thresholds: [8, 20, 50],
} as const;

const PERSONAS: Record<RecruiterSectorPersona, RecruiterSectorPersonaConfig> = {
  "it-services": {
    id: "it-services",
    displayName: "IT Services recruiter",
    hikeCap: 0.30,
    hikeCapTiers: IT_SERVICES_TIERS,
    bandSpread: 0.10,
    pushbackStyle: "rigid-band",
    prefersEsop: false,
    stallProbability: 0.45,
    idiomBias: [
      "as per company policy",
      "as per band",
      "fitment to the grade",
      "your number is on the higher side",
      "we have a structure for this",
      "let me check with the HR head",
      "the cap for this level is fixed",
      "ratings-linked variable",
      "joining bonus is the lever we have",
      "notice period buy-out we can consider",
      "salary correction in the 6-month window",
      "your last hike was in single digits",
      "internal parity matters here",
      "industry benchmark for this band",
      "we'll revert by end of week",
      "kindly share the documents",
      "grade fitment",
      "band ceiling",
    ],
  },
  "gcc": {
    id: "gcc",
    displayName: "GCC recruiter",
    hikeCap: 0.45,
    hikeCapTiers: {
      ltLow: 0.60,
      midLow: 0.45,
      midHigh: 0.32,
      high: 0.22,
      thresholds: [10, 25, 55],
    },
    bandSpread: 0.18,
    pushbackStyle: "global-benchmark",
    prefersEsop: true,
    stallProbability: 0.30,
    idiomBias: [
      "global band for this level",
      "globally this level lands at",
      "we benchmark to the Bay Area minus 20%",
      "internal equity is the constraint",
      "compa-ratio for this grade",
      "RSU grant on top of base",
      "structured comp at this level",
      "stock refresh in the second cycle",
      "the level rubric drives the fitment",
      "the global comp committee approves",
      "this is the India band for the global level",
      "talent grid sign-off pending",
      "we move on stock, not base",
      "P3 / P4 / P5 banding",
      "vest is a 4-year cliff-and-quarterly",
      "let me check with the global TA partner",
    ],
  },
  "indian-unicorn": {
    id: "indian-unicorn",
    displayName: "Indian unicorn recruiter",
    hikeCap: 0.50,
    hikeCapTiers: {
      ltLow: 0.70,
      midLow: 0.50,
      midHigh: 0.35,
      high: 0.25,
      thresholds: [10, 25, 60],
    },
    bandSpread: 0.25,
    pushbackStyle: "equity-pivot",
    prefersEsop: true,
    stallProbability: 0.20,
    idiomBias: [
      "we can move on the ESOP side",
      "fair-market-value pool",
      "vest is 4 years with a 1-year cliff",
      "buyback windows happen annually",
      "if you stay for the full 4-year cycle",
      "talent-dense team",
      "growth trajectory matters more than cash",
      "wealth creation on the equity side",
      "we cap cash, we stretch on equity",
      "ESOP grant on top",
      "exercise price is at FMV",
      "next round will reprice the grant",
      "the founders signed this off",
      "let me see what we can do on the grant",
      "vest schedule",
      "secondary in the next round",
    ],
  },
  "early-startup": {
    id: "early-startup",
    displayName: "Early-stage startup recruiter",
    hikeCap: 0.40,
    hikeCapTiers: {
      ltLow: 0.65,
      midLow: 0.45,
      midHigh: 0.30,
      high: 0.22,
      thresholds: [10, 25, 55],
    },
    bandSpread: 0.30,
    pushbackStyle: "cash-constrained",
    prefersEsop: true,
    stallProbability: 0.15,
    idiomBias: [
      "runway considerations",
      "founder cap",
      "we're not series-C yet",
      "let me see what I can do",
      "your number is aggressive for our stage",
      "we can stretch on equity if you take lower base",
      "founding-team grant",
      "cash runway is tight",
      "we're optimising for ownership, not cash",
      "early-employee pool",
      "wear multiple hats",
      "scope is much bigger than the title",
      "the founders want to meet you again",
      "stretch on equity %",
      "we'll revisit at the next round",
      "the cap table is being optimised",
    ],
  },
  "bfsi": {
    id: "bfsi",
    displayName: "BFSI recruiter",
    hikeCap: 0.35,
    hikeCapTiers: {
      ltLow: 0.50,
      midLow: 0.35,
      midHigh: 0.25,
      high: 0.18,
      thresholds: [9, 22, 50],
    },
    bandSpread: 0.12,
    pushbackStyle: "variable-bump",
    prefersEsop: false,
    stallProbability: 0.35,
    idiomBias: [
      "regulatory band",
      "variable component",
      "performance pay",
      "fixed sits at sub-band",
      "variable is where we land it",
      "comp committee approval is needed",
      "RBI guidelines apply on the deferred portion",
      "performance bonus is the lever",
      "joining bonus has a 1-year clawback",
      "ESOP is not on the table for this level",
      "let me check with the business head",
      "the band is set by HR policy",
      "annual bonus typically 15-25% of fixed",
      "deferred comp clawback applies",
      "in-hand vs CTC is the right framing",
    ],
  },
  /* Realism-Audit Fix 1 — PSU (BHEL / NTPC / ONGC / BSNL / SBI / RBI).
   * Pay set by Pay Commission (7th CPC currently). Negotiation lever
   * is essentially zero on base — only HRA / DA / LTC, grade-jump,
   * or posting location move. */
  "psu": {
    id: "psu",
    displayName: "PSU recruiter",
    hikeCap: 0.10,
    /* PSU pins the cap flat: Pay-Commission rigidity means the
     * inverse-CTC scaling other sectors use doesn't apply. All four
     * tiers carry the same low cap. */
    hikeCapTiers: {
      ltLow: 0.12,
      midLow: 0.10,
      midHigh: 0.08,
      high: 0.06,
      thresholds: [8, 20, 50],
    },
    bandSpread: 0.05,
    pushbackStyle: "cadre-pay-rigid",
    prefersEsop: false,
    stallProbability: 0.65,
    idiomBias: [
      "as per government norms",
      "pay scale is fixed",
      "grade-based fitment",
      "HRA classification",
      "DA component",
      "leave encashment",
      "LTC entitlement",
      "as per the rule book",
      "pay commission has set this",
      "officer-grade vs assistant-grade",
      "posting location is the variable",
      "kindly note this is non-negotiable",
      "we follow the 7th CPC matrix",
      "cadre rules apply",
      "you'll get gratuity and pension on top",
      "the joining grade is fixed",
      "let me check with the establishment section",
    ],
  },
  /* Realism-Audit Fix 1 — Big-4 / tier-1 consulting (Deloitte / EY /
   * PwC / KPMG / BCG India / McKinsey India / Bain India / A.T.
   * Kearney). Up-or-out, partner-track signaling, internal-equity
   * cap drives tight hikes. */
  "consulting-big4": {
    id: "consulting-big4",
    displayName: "Big-4 / tier-1 consulting recruiter",
    hikeCap: 0.28,
    hikeCapTiers: {
      ltLow: 0.45,
      midLow: 0.30,
      midHigh: 0.22,
      high: 0.16,
      thresholds: [10, 25, 60],
    },
    bandSpread: 0.10,
    pushbackStyle: "internal-equity-cap",
    prefersEsop: false,
    stallProbability: 0.55,
    idiomBias: [
      "fitment to the level",
      "manager track",
      "senior-manager pipeline",
      "partner track signaling",
      "global mobility programme",
      "billable utilization target",
      "year-of-graduation cohort",
      "MBA-vs-non-MBA banding",
      "up-or-out culture",
      "your batch typically sits at",
      "we'll put you on the X account",
      "project allocation is the lever",
      "internal equity is non-negotiable at this level",
      "the comp committee meets monthly",
      "your business school batch matters",
      "let me check with the people-team partner",
      "this is the M1 / M2 / SM band",
    ],
  },
  /* Realism-Audit Fix 1 — FMCG-management rotational programs (HUL
   * UFLP / ITC YMP / Nestlé MT / P&G / Britannia / Asian Paints).
   * Campus-brand premium, rotational-program oriented, hikes
   * internal-band policed. */
  "fmcg-management": {
    id: "fmcg-management",
    displayName: "FMCG management recruiter",
    hikeCap: 0.25,
    hikeCapTiers: {
      ltLow: 0.40,
      midLow: 0.28,
      midHigh: 0.20,
      high: 0.15,
      thresholds: [9, 22, 50],
    },
    bandSpread: 0.10,
    pushbackStyle: "ldp-trajectory",
    prefersEsop: false,
    stallProbability: 0.40,
    idiomBias: [
      "leadership development program",
      "the rotation track",
      "P&L exposure early on",
      "general management trajectory",
      "ABM to BM to senior BM ladder",
      "trade-marketing rotation",
      "manufacturing-stint rotation",
      "campus-brand premium",
      "we hire from a select campus list",
      "structured career path",
      "your batch from IIM-A typically sits at",
      "the band is internal-policy driven",
      "long-term career, not short-term cash",
      "joining the LDP this cycle",
      "your mentor will be from the leadership team",
      "we move people across categories",
      "the talent council reviews fitment",
    ],
  },
  /* Realism-Audit (2026-05-29) — Edtech (Byju's / Vedantu / UpGrad /
   * Unacademy / Physics Wallah / WhiteHat Jr). Post-2023 sector
   * correction: ESOPs deeply underwater, joining bonuses gone, bands
   * re-cut, recruiters defensive about growth-math. */
  "edtech": {
    id: "edtech",
    displayName: "Edtech recruiter",
    hikeCap: 0.20,
    hikeCapTiers: {
      ltLow: 0.32,
      midLow: 0.22,
      midHigh: 0.16,
      high: 0.12,
      thresholds: [9, 22, 50],
    },
    bandSpread: 0.10,
    pushbackStyle: "sector-correction-defensive",
    prefersEsop: true,
    stallProbability: 0.50,
    idiomBias: [
      "sector correction",
      "ESOPs are underwater",
      "growth math has reset",
      "we're being conservative",
      "joining bonus is rare these days",
      "burn-rate discipline",
      "post-COVID realism",
      "the bands got re-cut",
      "we're not 2021 anymore",
      "BU-level P&L matters now",
      "let me be straight with you on the package",
      "strike vs FMV side by side",
      "long bet on the next up-round",
      "unit economics first",
      "we're not in growth-at-all-costs mode",
      "let me check with the BU head",
    ],
  },
  /* Realism-Audit (2026-05-29) — Consulting MBB tier-1 strategy
   * (McKinsey / BCG / Bain / A.T. Kearney). Pre-MBA intake-cohort
   * banding is rigid — base set by intake year, no negotiation lane
   * on fixed. Bonus + study-leave + B-school sponsorship are the
   * levers. */
  "consulting-mbb": {
    id: "consulting-mbb",
    displayName: "MBB / tier-1 strategy consulting recruiter",
    hikeCap: 0.18,
    hikeCapTiers: {
      ltLow: 0.30,
      midLow: 0.22,
      midHigh: 0.16,
      high: 0.12,
      thresholds: [12, 28, 65],
    },
    bandSpread: 0.08,
    pushbackStyle: "cohort-band-rigid",
    prefersEsop: false,
    stallProbability: 0.60,
    idiomBias: [
      "pre-MBA cohort band",
      "the band is set by intake year",
      "study leave for the GMAT window",
      "performance bonus is the lever",
      "global comp committee",
      "up-or-out clock",
      "regional partnership sets the band",
      "B-school sponsorship clause",
      "year-end ranking drives the bonus",
      "intake-cohort fitment",
      "People & Capabilities owns the fitment",
      "annexure for sponsorship terms",
      "no negotiation lane on base",
      "associate to consultant to project leader ladder",
      "global mobility programme",
      "let me check with the regional partner",
    ],
  },
  "default": {
    id: "default",
    displayName: "Recruiter",
    hikeCap: 0.40,
    hikeCapTiers: {
      ltLow: 0.55,
      midLow: 0.38,
      midHigh: 0.28,
      high: 0.20,
      thresholds: [8, 20, 50],
    },
    bandSpread: 0.20,
    pushbackStyle: "consultative",
    prefersEsop: false,
    stallProbability: 0.20,
    idiomBias: [],
  },
};

/** Realism-Audit Fix 4 — resolve the persona's hike cap against a
 *  candidate's current CTC. Falls back to the scalar `hikeCap` when
 *  `currentCtcLpa` is unknown or non-positive. Pure / deterministic. */
export function hikeCapByCtc(
  persona: RecruiterSectorPersonaConfig,
  currentCtcLpa: number | null | undefined,
): number {
  if (currentCtcLpa == null || !isFinite(currentCtcLpa) || currentCtcLpa <= 0) {
    return persona.hikeCap;
  }
  const t = persona.hikeCapTiers;
  if (currentCtcLpa <= t.thresholds[0]) return t.ltLow;
  if (currentCtcLpa <= t.thresholds[1]) return t.midLow;
  if (currentCtcLpa <= t.thresholds[2]) return t.midHigh;
  return t.high;
}

/** Lookup helper — returns the persona config or the default. */
export function getRecruiterSectorPersona(
  id: RecruiterSectorPersona | string | null | undefined,
): RecruiterSectorPersonaConfig {
  if (!id) return PERSONAS["default"];
  const norm = String(id).toLowerCase().trim();
  if (norm in PERSONAS) return PERSONAS[norm as RecruiterSectorPersona];
  return PERSONAS["default"];
}

/** Shape of the band passed to the selector. Loose so the selector
 *  can run from the kernel side (NegotiationBand) and from the
 *  analyzer side (raw numbers). All fields optional. */
export interface RecruiterSectorPersonaBandShape {
  initialOffer?: number | null;
  maxStretch?: number | null;
  walkAway?: number | null;
  hasEquity?: boolean | null;
  baseFloor?: number | null;
  variableMax?: number | null;
}

/** Map tierBucket → most likely sector persona.
 *  Falls through to band-shape heuristics when tierBucket isn't
 *  conclusive (e.g. unknown company). */
export function selectRecruiterSectorPersona(opts: {
  tierBucket?: CompanyTierBucket | null;
  band?: RecruiterSectorPersonaBandShape | null;
  company?: string | null;
}): RecruiterSectorPersona {
  const tier = opts.tierBucket ?? null;
  const band = opts.band ?? null;
  const company = (opts.company ?? "").toLowerCase().trim();

  /* 0. Company-name hint — wins over tier when the company is one of
   *    the known sector exemplars. Edtech + MBB are the strongest
   *    signals because they slot poorly into the tier-bucket lattice
   *    (edtech sits between unicorn / startup depending on stage;
   *    MBB sits adjacent to consulting-big4 but with rigid pre-MBA
   *    cohort bands the Big-4 sector wording doesn't capture). */
  if (company) {
    if (/\b(?:mckinsey|bcg|boston\s+consulting|bain|a\.?\s*t\.?\s*kearney|at\s+kearney|kearney)\b/.test(company)) {
      return "consulting-mbb";
    }
    if (/\b(?:byju'?s|byjus|vedantu|upgrad|unacademy|physics\s*wallah|pw|whitehat|cuemath|simplilearn|toppr|doubtnut|extramarks|lido)\b/.test(company)) {
      return "edtech";
    }
  }

  /* 1. Tier-bucket wins when unambiguous. */
  switch (tier) {
    case "it_services":
      return "it-services";
    case "listed_big_tech":
      /* GCC / FAANG India / big-tech all share the listed_big_tech
       * bucket in tierBucket(). GCCs (Indian arms of MNCs) dominate
       * the headcount under this bucket in India, so it's the
       * higher-prior default — the kernel still scores against the
       * global-band anchor, which is what GCC + FAANG-India both do. */
      return "gcc";
    case "mature_unicorn":
    case "listed_unicorn":
      return "indian-unicorn";
    case "growth_startup":
    case "early_startup":
      return "early-startup";
    case "bfsi":
      return "bfsi";
    /* Realism-Audit Fix 1 — fmcg / psu now map to their own personas. */
    case "fmcg":
      return "fmcg-management";
    case "psu":
      return "psu";
    case null:
    case undefined:
      break;
  }

  /* 2. Band-shape fallback when tier is unknown. */
  if (band) {
    const initial = band.initialOffer ?? 0;
    const variableMax = band.variableMax ?? 0;
    const baseFloor = band.baseFloor ?? 0;
    const hasEquity = band.hasEquity === true;
    if (initial > 0 && variableMax / initial > 0.30) {
      return "bfsi";
    }
    if (hasEquity && initial > 0 && baseFloor > 0 && baseFloor / initial < 0.60) {
      return "early-startup";
    }
    if (hasEquity) {
      return "indian-unicorn";
    }
  }

  return "default";
}

/** Build a one-line prompt fragment when the move-generator needs
 *  persona-coloured framing. Optional — most prose lives in
 *  `_canonical-prose.ts` switch arms. */
export function recruiterSectorPersonaPromptFragment(
  persona: RecruiterSectorPersonaConfig,
): string {
  if (persona.id === "default") return "";
  /* Cap to the first ~6 idioms in the prompt fragment to keep the
   * prompt cache prefix stable across turns — the full bank is large
   * (15-20 entries) but the LLM only needs a handful of representative
   * tells to colour pushback. */
  const sample = persona.idiomBias.slice(0, 6);
  const idioms = sample.length
    ? ` Idioms commonly used: ${sample.join(", ")}.`
    : "";
  return `INDIAN RECRUITER SECTOR — ${persona.displayName}. Pushback style: ${persona.pushbackStyle}.${idioms}`;
}

/** Realism-Audit Fix 2 — deterministic single-idiom pick for canonical
 *  prose. Hash-based selection keeps the same idiom for the same
 *  (persona, seed) pair across a session, so the prose surface doesn't
 *  flip every turn. Pure. */
export function pickIdiomDeterministic(
  persona: RecruiterSectorPersonaConfig,
  seed: number,
): string | null {
  if (persona.idiomBias.length === 0) return null;
  const idx = Math.abs(Math.floor(seed)) % persona.idiomBias.length;
  return persona.idiomBias[idx];
}
