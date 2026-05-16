/* HireStepX — Indian regional register detector
 *
 * Indian behavioural interviews are NOT monolithic. The same answer in
 * Bangalore reads differently in Delhi NCR vs. Mumbai/Pune vs.
 * Hyderabad vs. Chennai. The regional register shifts on three axes:
 *
 *   1. Hinglish density — Bangalore tech crowd code-switches mid-clause
 *      ("the deploy was completely thrown off, na"), Mumbai keeps
 *      English clean in formal settings ("with all due respect, the
 *      timeline was tight"), Delhi NCR leans transactional and direct
 *      ("yaar, the team was just not aligned"), Hyderabad blends
 *      English with services-track formality ("sir, the rollout had
 *      some challenges"), Chennai keeps a polite, qualifier-heavy
 *      English register ("kindly note, there were a few delays").
 *
 *   2. Operational anchors — each metro has its own real-world
 *      pressure tells. Bangalore: peak hour ORR / Bellandur outage /
 *      bandhs. Delhi NCR: smog / Gurgaon-Noida commute / DLF Cyber
 *      Hub. Mumbai/Pune: monsoon / local-train cancellations / BKC
 *      vs. Hinjewadi. Hyderabad: HITEC City / financial year close /
 *      cyclone Phailin-class events. Chennai: monsoon flooding / OMR
 *      corridor / IT-park power cuts.
 *
 *   3. Discourse tics — region-specific filler / softeners that the
 *      Western rubric mis-grades as low-confidence: "na" (Bangalore),
 *      "yaar" (Delhi NCR), "haan" (Mumbai-North), "I mean to say"
 *      (Hyderabad / Andhra), "kindly" (Chennai).
 *
 * This module is a pure helper. The follow-up handler and the
 * evaluator feed a city string (job city OR current city; preference
 * order set by the caller) and get back a typed RegionalRegister
 * record that downstream prompts can use to:
 *   - mirror lightly in the in-character interviewer reply
 *   - whitelist the regional tics so they're not penalised
 *   - reference the right operational anchors when probing for
 *     specificity
 *
 * Conservative: returns "unknown" for any city we don't recognise.
 * The downstream prompts gate on `region !== "unknown"` before
 * injecting region-specific text — so a wrong region is impossible,
 * and unknown cities just get the default neutral register.
 */

export type IndianRegion =
  | "bangalore"
  | "delhi-ncr"
  | "mumbai-pune"
  | "hyderabad"
  | "chennai"
  | "kolkata"
  | "unknown";

export interface RegionalRegister {
  region: IndianRegion;
  /** Human-readable label for prompt inclusion. */
  label: string;
  /** Discourse markers/tics native to this region — whitelist these,
   *  do NOT penalise as low-confidence filler. */
  discourseTics: string[];
  /** Real-world operational anchors the candidate is likely to
   *  reference. The evaluator can credit specificity when it sees
   *  these; the interviewer can use them to probe deeper. */
  operationalAnchors: string[];
  /** Coarse 0-3 Hinglish-density hint. 0 = formal English only;
   *  3 = heavy code-switching expected. Used to set the live coach's
   *  mirroring budget. */
  hinglishDensity: 0 | 1 | 2 | 3;
}

const BANGALORE_RE = /\b(?:bangalore|bengaluru|blr|whitefield|koramangala|indiranagar|electronic\s+city|orr|outer\s+ring\s+road|marathahalli|hebbal|bellandur|sarjapur|hsr\s+layout|jp\s+nagar|btm|bommanahalli)\b/i;
const DELHI_RE = /\b(?:delhi|new\s+delhi|ncr|gurgaon|gurugram|noida|greater\s+noida|faridabad|ghaziabad|dlf\s+cyber\s+hub|cyber\s+city|sohna\s+road)\b/i;
const MUMBAI_RE = /\b(?:mumbai|bombay|pune|navi\s+mumbai|thane|bkc|bandra(?:\s+kurla)?|powai|andheri|hinjewadi|hinjawadi|kharadi|magarpatta|baner|viman\s+nagar)\b/i;
const HYDERABAD_RE = /\b(?:hyderabad|hyd|secunderabad|hitec\s+city|hitech\s+city|gachibowli|madhapur|kondapur|kukatpally|financial\s+district)\b/i;
const CHENNAI_RE = /\b(?:chennai|madras|omr|old\s+mahabalipuram\s+road|sholinganallur|tidel\s+park|t\.?\s*nagar|guindy|porur|tambaram|siruseri)\b/i;
const KOLKATA_RE = /\b(?:kolkata|calcutta|salt\s+lake|sector\s+v|new\s+town|rajarhat)\b/i;

const REGIONAL_REGISTRY: Record<Exclude<IndianRegion, "unknown">, Omit<RegionalRegister, "region">> = {
  "bangalore": {
    label: "Bangalore / Bengaluru tech corridor",
    discourseTics: ["na", "only", "off-only", "itself", "anna"],
    operationalAnchors: [
      "ORR / Outer Ring Road peak-hour commute",
      "Bellandur / Whitefield power-cut or outage",
      "Bangalore bandh / IT-corridor shutdown",
      "Diwali / Dussehra release-freeze window",
    ],
    hinglishDensity: 2,
  },
  "delhi-ncr": {
    label: "Delhi / NCR (Gurgaon-Noida)",
    discourseTics: ["yaar", "matlab", "actually", "no?", "haina"],
    operationalAnchors: [
      "NCR smog / AQI shutdown of physical offices",
      "Gurgaon-Noida commute (DND / Yamuna Expy)",
      "DLF Cyber Hub / Cyber City client visits",
      "FY-close / March 31 freeze",
    ],
    hinglishDensity: 3,
  },
  "mumbai-pune": {
    label: "Mumbai / Pune corridor",
    discourseTics: ["haan", "no?", "I mean", "see"],
    operationalAnchors: [
      "Mumbai monsoon / local-train cancellation",
      "BKC / Lower Parel client-onsite",
      "Hinjewadi-Kharadi Pune-tech commute",
      "Diwali / Ganpati week ops freeze",
    ],
    hinglishDensity: 1,
  },
  "hyderabad": {
    label: "Hyderabad / HITEC City",
    discourseTics: ["sir", "ma'am", "I mean to say", "kindly", "what say"],
    operationalAnchors: [
      "HITEC City / Gachibowli onsite cadence",
      "Cyclone / monsoon-window deployment freeze",
      "Bonalu / Bathukamma local festival ops",
      "Financial-district client-bank windows",
    ],
    hinglishDensity: 1,
  },
  "chennai": {
    label: "Chennai / OMR tech corridor",
    discourseTics: ["kindly", "please", "no?", "is it", "shall we"],
    operationalAnchors: [
      "Chennai monsoon / North-East monsoon flooding",
      "OMR / Sholinganallur power-cut window",
      "Pongal / Tamil New Year release freeze",
      "Tidel Park / Siruseri client onsite",
    ],
    hinglishDensity: 1,
  },
  "kolkata": {
    label: "Kolkata / Salt Lake Sector V",
    discourseTics: ["na", "no?", "you see", "actually"],
    operationalAnchors: [
      "Salt Lake Sector V / New Town onsite",
      "Durga Puja week ops freeze",
      "Cyclone-window (Amphan-class) deployment hold",
      "Kolkata bandh / general-strike day",
    ],
    hinglishDensity: 2,
  },
};

/** Detect Indian region from a free-form city string. Conservative:
 *  unrecognised input returns the neutral default. Caller decides
 *  preference (job city vs. candidate's current city). */
export function detectRegionFromCity(
  city: string | null | undefined,
): RegionalRegister {
  const t = (city || "").trim();
  if (!t) return makeUnknown();
  if (BANGALORE_RE.test(t)) return enrich("bangalore");
  if (DELHI_RE.test(t)) return enrich("delhi-ncr");
  if (MUMBAI_RE.test(t)) return enrich("mumbai-pune");
  if (HYDERABAD_RE.test(t)) return enrich("hyderabad");
  if (CHENNAI_RE.test(t)) return enrich("chennai");
  if (KOLKATA_RE.test(t)) return enrich("kolkata");
  return makeUnknown();
}

/** Best-effort detection from raw transcript text — used when caller
 *  doesn't have a structured city field. We scan once and take the
 *  first match in deterministic order. Returns "unknown" on no match. */
export function detectRegionFromText(text: string | null | undefined): RegionalRegister {
  return detectRegionFromCity(text);
}

function enrich(region: Exclude<IndianRegion, "unknown">): RegionalRegister {
  return { region, ...REGIONAL_REGISTRY[region] };
}

function makeUnknown(): RegionalRegister {
  return {
    region: "unknown",
    label: "neutral / unspecified Indian English",
    discourseTics: [],
    operationalAnchors: [],
    hinglishDensity: 0,
  };
}

/** True iff we got a real region (not the unknown default). Cheap
 *  gate for prompt-injection — callers only inject region-specific
 *  text when this is true. */
export function hasRegionalSignal(reg: RegionalRegister): boolean {
  return reg.region !== "unknown";
}
