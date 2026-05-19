/* Candidate archetype classifier (BUG-002 scaffold, QA v3 round 2, 2026-05-19).
 *
 * Surfaces the workbook's P01–P20 candidate archetypes as a typed enum
 * with deterministic per-archetype detection. The classifier is a single
 * function `classifyCandidateArchetype(utterance, profile?)` that returns
 * the highest-confidence archetype (or `null` if none match).
 *
 * SCOPE OF THIS SCAFFOLD:
 *  - Defines the typed `CandidateArchetype` union.
 *  - Defines `ArchetypeSignal` per archetype with regex + scoring weight.
 *  - Implements `classifyCandidateArchetype` using greedy max-score
 *    selection. No external dependencies; safe to call from the kernel
 *    or the analyzer.
 *  - Does NOT yet thread the classification into planner routing or
 *    canonical-prose. That belongs to the FULL impl (~2 days): wire
 *    `state.candidateArchetype` through `applyCandidateAnswer`, expose
 *    it on `NegotiationState`, and add archetype-aware branches in
 *    `planReactiveFollowup`. The scaffold keeps the surface area minimal
 *    so the planner integration can land in a follow-up patch without
 *    re-litigating the taxonomy.
 *
 * P01–P20 mapping is taken verbatim from the QA workbook (PDF#37 P-Codes
 * sheet). Some codes are intentionally absent (P08, P16) — those were
 * collapsed into adjacent archetypes during workbook redesign.
 */

import type { CandidateProfileResult } from "./_candidate-profile";

export type CandidateArchetype =
  | "P01_INDIFFERENT"           // "as per company standard / salary not priority"
  | "P02_UNDERPAID_TODAY"       // current is below market; refuses lowball
  | "P03_DIRECT_DISCLOSER"      // states current CTC openly
  | "P04_COMPETING_OFFER"       // has another offer in hand
  | "P05_LONG_NOTICE"           // 90-day notice, exploring buyout
  | "P06_EQUITY_PROBER"         // ESOP / RSU / vesting questions
  | "P07_STRUCTURE_PROBER"      // fixed vs variable / breakup questions
  | "P09_NON_CASH_FOCUS"        // values learning / product / brand over pay
  | "P10_RETENTION_RISK"        // current employer may counter
  | "P11_FREELANCER"            // no standard CTC anchor
  | "P12_IMMEDIATE_JOINER"      // can join immediately
  | "P13_CAREER_BREAK"          // had a break; refuses discount
  | "P14_HIGH_EARNER"           // already at high CTC; role is the pull
  | "P15_HARD_ANCHOR"           // states an explicit target number
  | "P17_REMOTE_LOCATION"       // remote / different city questions
  | "P18_BREAKUP_PUSHBACK"      // saw offer breakup, wants fixed up
  | "P19_IN_HAND_FOCUS"         // asks monthly in-hand / take-home math
  | "P20_ROLE_PREFERENCE";      // company is preference but won't lowball

interface ArchetypeSignal {
  archetype: CandidateArchetype;
  /** Regex patterns; each match adds `weight` to the archetype's score. */
  patterns: RegExp[];
  /** Optional profile-flag boost — adds `profileBoost` if the named flag
   *  is true on the passed `CandidateProfileResult`. */
  profileFlag?: keyof CandidateProfileResult;
  weight: number;
  profileBoost: number;
}

const SIGNALS: ArchetypeSignal[] = [
  {
    archetype: "P01_INDIFFERENT",
    patterns: [
      /\b(?:as per|whatever)\s+(?:company|your)\s+(?:standard|decide|policy)/i,
      /\bsalary\s+is\s+not\s+(?:the\s+)?(?:main\s+)?priority/i,
      /\bopen\s+to\s+(?:whatever|anything)/i,
    ],
    weight: 2,
    profileBoost: 1,
    profileFlag: "deflectedOnRange",
  },
  {
    archetype: "P02_UNDERPAID_TODAY",
    patterns: [
      /\bcurrent\s+(?:salary|ctc)\s+is\s+(?:lower|below)\s+(?:than\s+)?market/i,
      /\bdon'?t\s+want\s+the\s+offer\s+based\s+only\s+on\s+(?:my\s+)?current/i,
      /\bbelow\s+market\b/i,
    ],
    weight: 2,
    profileBoost: 0,
  },
  {
    archetype: "P03_DIRECT_DISCLOSER",
    patterns: [
      /\bmy\s+(?:current\s+)?(?:total\s+)?ctc\s+is\s+(?:around\s+)?₹?\s*\d/i,
      /\bi\s+(?:earn|make|get)\s+₹?\s*\d/i,
    ],
    weight: 2,
    profileBoost: 0,
  },
  {
    archetype: "P04_COMPETING_OFFER",
    patterns: [
      /\b(?:i\s+have|got|holding)\s+another\s+offer\b/i,
      /\bcompeting\s+offer\b/i,
      /\bin\s+hand\s+offer\b/i,
    ],
    weight: 3,
    profileBoost: 0,
  },
  {
    archetype: "P05_LONG_NOTICE",
    patterns: [
      /\bnotice\s+period\s+is\s+(?:90|three\s+months)/i,
      /\bbuy(?:[- ]?out|out)\b/i,
      /\bearly\s+release\b/i,
    ],
    weight: 2,
    profileBoost: 0,
  },
  {
    archetype: "P06_EQUITY_PROBER",
    patterns: [
      /\b(?:esop|rsu)\b/i,
      /\bvesting\s+(?:schedule|cliff)\b/i,
      /\bexercise\s+price\b/i,
    ],
    weight: 2,
    profileBoost: 0,
  },
  {
    archetype: "P07_STRUCTURE_PROBER",
    patterns: [
      /\bfixed\s+(?:and|vs|versus)\s+variable\b/i,
      /\bhow\s+much\s+is\s+fixed\b/i,
      /\bbreakup\b/i,
      /\bsplit\s+between\s+fixed/i,
    ],
    weight: 2,
    profileBoost: 0,
  },
  {
    archetype: "P09_NON_CASH_FOCUS",
    patterns: [
      /\bsalary\s+is\s+secondary\b/i,
      /\bcare\s+more\s+about\s+(?:learning|growth|brand|product|exposure)/i,
      /\blearning\s+(?:opportunity|over\s+(?:pay|money))/i,
    ],
    weight: 3,
    profileBoost: 0,
  },
  {
    archetype: "P10_RETENTION_RISK",
    patterns: [
      /\bcurrent\s+(?:company|employer)\s+(?:may|might|will)\s+(?:try\s+to\s+)?(?:retain|counter)/i,
      /\bretention\s+offer\b/i,
    ],
    weight: 3,
    profileBoost: 0,
  },
  {
    archetype: "P11_FREELANCER",
    patterns: [
      /\bfreelanc(?:ing|er)\b/i,
      /\bdon'?t\s+have\s+(?:a\s+)?standard\s+ctc\b/i,
      /\bconsulting\s+gig\b/i,
    ],
    weight: 3,
    profileBoost: 0,
  },
  {
    archetype: "P12_IMMEDIATE_JOINER",
    patterns: [
      /\bcan\s+join\s+immediately\b/i,
      /\bavailable\s+to\s+join\s+(?:right\s+away|now)/i,
      /\bzero\s+notice\b/i,
    ],
    weight: 3,
    profileBoost: 0,
  },
  {
    archetype: "P13_CAREER_BREAK",
    patterns: [
      /\bhad\s+a\s+(?:career\s+)?break\b/i,
      /\bdon'?t\s+want\s+(?:the\s+)?offer\s+(?:to\s+be\s+)?discounted/i,
      /\bgap\s+(?:in\s+)?(?:my\s+)?career\b/i,
    ],
    weight: 2,
    profileBoost: 0,
  },
  {
    archetype: "P14_HIGH_EARNER",
    patterns: [
      /\bcurrent\s+ctc\s+is\s+(?:already\s+)?₹?\s*(?:[5-9]\d|\d{3})\s*(?:l|lpa|lakh)/i,
      /\binterested\s+in\s+the\s+role\b.*\b(?:not\s+the\s+)?(?:money|salary|pay)/i,
    ],
    weight: 2,
    profileBoost: 0,
  },
  {
    archetype: "P15_HARD_ANCHOR",
    patterns: [
      /\b(?:i\s+am|i'?m)\s+expecting\s+₹?\s*\d/i,
      /\bmy\s+(?:expectation|target|ask)\s+is\s+₹?\s*\d/i,
      /\blooking\s+(?:for|at)\s+₹?\s*\d+\s*(?:l|lpa|lakh)/i,
    ],
    weight: 3,
    profileBoost: 0,
  },
  {
    archetype: "P17_REMOTE_LOCATION",
    patterns: [
      /\b(?:remote|wfh|work\s+from\s+home)\b/i,
      /\bdifferent\s+city\b/i,
      /\brelocat(?:e|ion)\b/i,
    ],
    weight: 2,
    profileBoost: 0,
  },
  {
    archetype: "P18_BREAKUP_PUSHBACK",
    patterns: [
      /\bfixed\s+is\s+(?:lower|less)\s+than\s+expected\b/i,
      /\b(?:can\s+we\s+)?revisit\s+(?:the\s+)?(?:fixed|breakup)\b/i,
      /\bstrengthen\s+(?:the\s+)?fixed\b/i,
    ],
    weight: 3,
    profileBoost: 1,
    profileFlag: "wantsHigherBase",
  },
  {
    archetype: "P19_IN_HAND_FOCUS",
    patterns: [
      /\bmonthly\s+in[- ]?hand\b/i,
      /\btake[- ]?home\b/i,
      /\bper\s+month\b/i,
      /\bp\.?m\.?\b/i,
    ],
    weight: 3,
    profileBoost: 0,
  },
  {
    archetype: "P20_ROLE_PREFERENCE",
    patterns: [
      /\b(?:is\s+)?my\s+first\s+preference\b/i,
      /\bdon'?t\s+want\s+to\s+compromise\s+(?:too\s+much\s+)?on\s+(?:fixed|base)/i,
      /\bdream\s+(?:role|company)\b/i,
    ],
    weight: 2,
    profileBoost: 0,
  },
];

/**
 * Score each archetype against the utterance and return the
 * highest-scoring match. Ties are broken by signal order (P01 wins over
 * P19 on equal score — the workbook lists low codes as priors).
 *
 * Returns `null` when no signal fires, which the caller should treat as
 * "no archetype confidently identified" — i.e., do not over-specialize
 * planner routing.
 */
export function classifyCandidateArchetype(
  utterance: string,
  profile?: CandidateProfileResult | null,
): { archetype: CandidateArchetype; score: number } | null {
  if (!utterance || utterance.trim().length === 0) return null;
  const u = utterance;
  let best: { archetype: CandidateArchetype; score: number } | null = null;
  for (const sig of SIGNALS) {
    let score = 0;
    for (const rx of sig.patterns) {
      if (rx.test(u)) score += sig.weight;
    }
    if (
      sig.profileFlag &&
      profile != null &&
      (profile as Record<string, unknown>)[sig.profileFlag] === true
    ) {
      score += sig.profileBoost;
    }
    if (score > 0 && (best == null || score > best.score)) {
      best = { archetype: sig.archetype, score };
    }
  }
  return best;
}
