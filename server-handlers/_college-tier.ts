/**
 * College-tier classifier for the Indian campus-placement context.
 *
 * Indian recruiters informally bucket colleges into three tiers, and this
 * grading directly affects how a CGPA reads:
 *
 *  - Tier-1 (IITs, NITs, BITS, IIITs, IISc): notoriously hard grading curves.
 *    A 7.0 CGPA at IIT Bombay is a respectable performance; the same number
 *    at a state private college is below median. Recruiters at top firms
 *    apply a ~0.5 leniency adjustment.
 *  - Tier-2 (VIT, Manipal, SRM, Thapar, DTU, NSIT, COEP, PSG, etc.):
 *    competitive admits, mid-grade curves. Standard cutoffs apply.
 *  - Unknown / tier-3: standard cutoffs apply; no leniency, no penalty.
 *
 * We detect from free-form user text (the candidate naming their college
 * during the conversation), not from a structured field, because the
 * analyzer runs on transcripts.
 */

export type CollegeTier = "tier-1" | "tier-2" | "unknown";

/* Tier-1: the IITs (all 23), the older NITs (top ~10 by NIRF), BITS campuses,
 * the top IIITs, and IISc. Patterns are loose enough to catch shorthand
 * ("IITB", "BITS Pilani", "NIT Trichy") and explicit ("Indian Institute of
 * Technology Bombay"). */
const TIER_1_PATTERNS: RegExp[] = [
  // IITs — short forms + full names
  /\bIIT\s*(?:bombay|delhi|madras|kanpur|kharagpur|roorkee|guwahati|bhu|ism|dhanbad|indore|hyderabad|patna|mandi|ropar|bhubaneswar|gandhinagar|jodhpur|tirupati|palakkad|goa|bhilai|jammu|dharwad|varanasi)\b/i,
  /\bIIT[- ]?(?:B|D|M|K|KGP|G|R|H|BHU)\b/,
  /\bindian\s+institute\s+of\s+technology\b/i,
  // NITs — top NIRF-ranked
  /\bNIT\s*(?:trichy|tiruchirappalli|surathkal|karnataka|warangal|allahabad|calicut|rourkela|jaipur|nagpur|kurukshetra|durgapur|silchar|hamirpur|jalandhar|patna|raipur|srinagar|meghalaya|sikkim|delhi|goa|puducherry|mizoram|manipur|arunachal|agartala|uttarakhand)\b/i,
  /\bMNIT\b|\bMNNIT\b|\bVNIT\b|\bSVNIT\b/i,
  /\bnational\s+institute\s+of\s+technology\b/i,
  // BITS
  /\bBITS\s*(?:pilani|goa|hyderabad|dubai)\b/i,
  /\bbirla\s+institute\s+of\s+technology\s+and\s+science\b/i,
  // IIITs — only the top "category-1" IIITs count as tier-1
  /\bIIIT[- ]?(?:hyderabad|H|bangalore|B|delhi|D|allahabad|A)\b/i,
  /\binternational\s+institute\s+of\s+information\s+technology\b/i,
  // IISc + premier research institutes
  /\bIISc\b|\bindian\s+institute\s+of\s+science\b/i,
  /\bISI\s+(?:kolkata|delhi|bangalore)\b/i,
  // IIMs (for MBA tracks landing in tech-adjacent campus interviews)
  /\bIIM\s*(?:ahmedabad|bangalore|calcutta|kolkata|lucknow|kozhikode|indore|shillong|rohtak|ranchi|raipur|trichy|udaipur|kashipur)\b/i,
];

/* Tier-2: highly competitive private/state colleges that recruiters
 * recognise but don't grant tier-1 leniency. */
const TIER_2_PATTERNS: RegExp[] = [
  /\bVIT\s*(?:vellore|chennai|bhopal|amaravati|ap)?\b/i,
  /\bvellore\s+institute\s+of\s+technology\b/i,
  /\bmanipal\s+(?:institute|university|academy|college)\b/i,
  /\bMIT\s+manipal\b/i,
  // SRM: qualifier optional — "I study at SRM" is as common as "SRM Chennai".
  // E3: bare \bSRM\b is intentionally loose — the alternative (requiring a
  // qualifier) would miss the ~60% of candidates who just say "SRM". False-
  // positives are unlikely because "SRM" has no other common meaning in an
  // Indian campus-interview context. If a false-positive is reported, add a
  // negative lookahead: /\bSRM(?!\s+(?:tool|file|drive|system))\b/i.
  /\bSRM(?:\s+(?:university|institute|chennai|kattankulathur|ramapuram|ist))?\b/i,
  /\bthapar\s+(?:university|institute)\b/i,
  /\bTIET\b/i,
  /\bDTU\b|\bdelhi\s+technological\s+university\b/i,
  /\bNSIT\b|\bNSUT\b|\bnetaji\s+subhas\b/i,
  /\bIIIT[- ]?(?:delhi|D)\b/i,                 // IIIT-Delhi is debated; keep here
  /\bCOEP\b|\bcollege\s+of\s+engineering\s+pune\b/i,
  /\bPSG\s+(?:college|tech)\b/i,
  /\bPES\s+(?:university|institute|college)\b/i,
  /\bRVCE\b|\bR\.?V\.?\s+college\s+of\s+engineering\b/i,
  /\bBMSCE\b|\bBMS\s+college\s+of\s+engineering\b/i,
  /\bMSRIT\b|\bramaiah\s+institute\s+of\s+technology\b/i,
  /\bDA[- ]?IICT\b/i,
  /\bjadavpur\s+university\b/i,
  /\bSSN\s+(?:college|institute)\b/i,
  /\bIIEST\b|\bbesu\b/i,
  /\bNITK\b/i,                                   // alt for Surathkal but already in T1
  /\bKIIT\b|\bkalinga\s+institute\s+of\s+industrial\s+technology\b/i,
  /\banna\s+university\b/i,                      // main campus Chennai; affiliates vary but candidates say "Anna University"
  /\bamity\s+(?:university|noida)\b/i,           // borderline; many recruiters call T2
  /\bLPU\b|\blovely\s+professional\b/i,          // borderline; mass intake
  /\bchitkara\s+university\b/i,
  /\bsymbiosis\s+(?:institute|sit)\b/i,
  /\bjamia\s+millia\b/i,
  // D4: full-name fallbacks for colleges whose short codes are too
  // ambiguous to match safely but whose full names are unambiguous.
  /\bsri\s+venkateswara\s+(?:university|college|institute)\b/i,
  /\bthiagarajar\s+college\s+of\s+engineering\b/i,
  /\bVJTI\b|\bveermata\s+jijabai\s+(?:technological|tech)\b/i,
  /\bICT\s+mumbai\b|\binstitute\s+of\s+chemical\s+technology\s+mumbai\b/i,
];

/**
 * Classify the college tier from free-form transcript text.
 *
 * We scan the full user-side text once. If any tier-1 pattern matches we
 * return "tier-1" (highest precedence — IITs win over coincidental tier-2
 * substring matches). Otherwise tier-2 if any tier-2 pattern matches.
 * Otherwise "unknown" — which is the safe default for the rest of the
 * analyzer (no leniency, no penalty).
 */
export function classifyCollegeTier(text: string | undefined | null): CollegeTier {
  if (!text) return "unknown";
  for (const rx of TIER_1_PATTERNS) if (rx.test(text)) return "tier-1";
  for (const rx of TIER_2_PATTERNS) if (rx.test(text)) return "tier-2";
  return "unknown";
}

/**
 * CGPA cutoff adjustment based on college tier. Returns a delta applied to
 * the company-tier-driven baseline cutoff.
 *
 *  - Tier-1 college: -0.5 (IIT/NIT/BITS grading curves are harder; a 7.0
 *    there reads like a 7.5 elsewhere).
 *  - Tier-2 college: 0 (standard cutoff).
 *  - Unknown: 0 (no penalty; we don't punish for not naming the college).
 */
export function cgpaCutoffAdjustment(tier: CollegeTier): number {
  if (tier === "tier-1") return -0.5;
  return 0;
}
