/* HireStepX — Indian salary-negotiation recruiter personas (Phase 3 of
 * Salary Negotiation track in SCORE_IMPROVEMENT_PLAN).
 *
 * Distinct from `src/_indian-hr-personas.ts` (HR-round archetypes) and
 * from the legacy `RecruiterPersona` tone-axis in `_negotiation-kernel.ts`
 * (hardline / consultative / founder / agency — modulates the BAND
 * economics). This file models the five Indian *sector* archetypes a
 * salary-negotiation conversation shows up as:
 *
 *   1. IT Services        — fixed bands, ~30% hike cap, services-track
 *                           register. "as per company policy", "grade
 *                           fitment", "L2/L3 band". Will not stretch on
 *                           cash; very limited equity.
 *   2. GCC (Indian MNC arm) — global pay benchmark, structured RSU
 *                           grants, anchors to "global band for this
 *                           level". Counter shape stays inside grade.
 *   3. Indian Unicorn     — ESOP-heavy, cash-light. Pushback pivots to
 *                           equity grant when candidate pushes on cash.
 *   4. Early Startup      — aggressive ESOP %, low base, high risk.
 *                           "We can stretch on equity if you take
 *                           lower base." Cash-constrained framing.
 *   5. BFSI               — variable-heavy, regulatory comp constraints.
 *                           "Fixed sits at sub-band, variable is where
 *                           we land it." Variable bumps, not fixed.
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
  | "default";

export interface RecruiterSectorPersonaConfig {
  id: RecruiterSectorPersona;
  displayName: string;
  /** Maximum hike-over-current the persona will entertain. IT-services
   *  caps at ~30%; GCC anchors to global band rather than hike; unicorn
   *  goes high on equity but caps cash hike; startup low; BFSI moderate
   *  on fixed and high on variable. Used by analyzer + telemetry. */
  hikeCap: number;
  /** Width of the in-grade band the persona quotes (% above the
   *  initial anchor). 0.15 = tight (services / BFSI); 0.30 = open
   *  (unicorn / startup). Surfaced in anchor-with-band prose. */
  bandSpread: number;
  /** Shape of pushback on counter-offers. */
  pushbackStyle:
    | "rigid-band"          // services
    | "global-benchmark"    // gcc
    | "equity-pivot"        // unicorn
    | "cash-constrained"    // startup
    | "variable-bump"       // bfsi
    | "consultative";       // default
  /** Whether ESOP is the lever this persona will trade against cash. */
  prefersEsop: boolean;
  /** Vocabulary bias for canonical prose. Strings here are surface
   *  tells the LLM-restyle layer keeps stable; they do not gate
   *  validation. */
  idiomBias: ReadonlyArray<string>;
}

const PERSONAS: Record<RecruiterSectorPersona, RecruiterSectorPersonaConfig> = {
  "it-services": {
    id: "it-services",
    displayName: "IT Services recruiter",
    hikeCap: 0.30,
    bandSpread: 0.10,
    pushbackStyle: "rigid-band",
    prefersEsop: false,
    idiomBias: ["as per company policy", "grade fitment", "band ceiling"],
  },
  "gcc": {
    id: "gcc",
    displayName: "GCC recruiter",
    hikeCap: 0.45,
    bandSpread: 0.18,
    pushbackStyle: "global-benchmark",
    prefersEsop: true,
    idiomBias: ["global band for this level", "RSU grant", "structured comp"],
  },
  "indian-unicorn": {
    id: "indian-unicorn",
    displayName: "Indian unicorn recruiter",
    hikeCap: 0.50,
    bandSpread: 0.25,
    pushbackStyle: "equity-pivot",
    prefersEsop: true,
    idiomBias: ["ESOP grant", "wealth-creation", "vest schedule"],
  },
  "early-startup": {
    id: "early-startup",
    displayName: "Early-stage startup recruiter",
    hikeCap: 0.40,
    bandSpread: 0.30,
    pushbackStyle: "cash-constrained",
    prefersEsop: true,
    idiomBias: ["cash runway", "stretch on equity", "founding-team grant"],
  },
  "bfsi": {
    id: "bfsi",
    displayName: "BFSI recruiter",
    hikeCap: 0.35,
    bandSpread: 0.12,
    pushbackStyle: "variable-bump",
    prefersEsop: false,
    idiomBias: ["regulatory band", "variable component", "performance pay"],
  },
  "default": {
    id: "default",
    displayName: "Recruiter",
    hikeCap: 0.40,
    bandSpread: 0.20,
    pushbackStyle: "consultative",
    prefersEsop: false,
    idiomBias: [],
  },
};

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
    case "fmcg":
    case "psu":
      return "default";
    case null:
    case undefined:
      break;
  }

  /* 2. Band-shape fallback when tier is unknown.
   *    - variableMax / initialOffer > 0.30 → BFSI (variable-heavy).
   *    - hasEquity true + low baseFloor (< 60% of initialOffer)
   *      → early-startup (cash-light).
   *    - hasEquity true + moderate baseFloor → indian-unicorn.
   *    - else default. */
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
  const idioms = persona.idiomBias.length
    ? ` Idioms commonly used: ${persona.idiomBias.join(", ")}.`
    : "";
  return `INDIAN RECRUITER SECTOR — ${persona.displayName}. Pushback style: ${persona.pushbackStyle}.${idioms}`;
}
