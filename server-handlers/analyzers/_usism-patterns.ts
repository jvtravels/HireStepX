/* US-ism patterns — shared across Indian-register analyzers.
 *
 * Why shared:
 *   Plan principle #2 (SCORE_IMPROVEMENT_PLAN.md) — the US-ism drift
 *   detector should run against AI turns in every Indian-register
 *   focus. Salary-negotiation owned the original copy; behavioral and
 *   HR-round need the same set. Keeping one source of truth avoids
 *   pattern drift across analyzers (one focus loosens "$X" to allow
 *   "$5k stipend" while another keeps it strict — exactly the kind
 *   of inconsistency that erodes signal credibility).
 *
 * What this catches:
 *   AI turns that drift out of the Indian market — USD comp figures,
 *   401(k), PTO, H1B / green-card, "sign-on package", IRA. Each hit
 *   is grounded coaching in the wrong market, and the candidate's
 *   live mock turns into prep for a US interview they're not having.
 *
 * Detection bar:
 *   Patterns are intentionally narrow — bare "$" is too noisy ("$0
 *   downtime"), but `\$[\d,]+(?:[KkMm]|thousand|million)` is a
 *   compensation figure. Same discipline as the rest of the analyzer
 *   regex set: conservative beats clever. */

import type { TranscriptTurn } from "./_types";

export interface UsismHit {
  turn_idx: number;
  phrase: string;
  label: string;
}

export const USISM_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\$[\d,]+(?:[KkMm]|\s*(?:thousand|million|k\b|m\b))?/, label: "USD figure ($) instead of ₹ / LPA" },
  { re: /\b401\s*[-(]?\s*[Kk]\b/, label: "401(k) reference (US-only retirement plan)" },
  { re: /\bPTO\b/, label: "'PTO' (US term; India uses 'leave' or 'PL/CL')" },
  { re: /\bvacation\s+days\b/i, label: "'vacation days' (US phrasing; India uses 'leave')" },
  { re: /\bseverance\s+package\b/i, label: "'severance package' (rare in India; use 'notice pay' / 'gardening leave')" },
  { re: /\bmedical\s+(?:insurance|coverage)\s+at\s+\$/i, label: "USD-denominated medical coverage" },
  { re: /\b(?:H1B|H-1B|green\s*card|GC\b)/i, label: "US visa terminology in an India-domestic offer" },
  { re: /\bIRA\b(?!\s*(?:role|score|rating|context))/, label: "'IRA' (US retirement account; India uses 'EPF/PPF')" },
  { re: /\bsign[\s-]*on\s+package\b/i, label: "'sign-on package' (US phrasing; India uses 'joining bonus')" },
  { re: /\bnegotiate\s+up\b/i, label: "'negotiate up' (US idiom; India uses 'stretch / push for more')" },
];

/** Scan AI turns for US-ism leakage. Each hit is a rubric gap because
 *  the AI is grounding coaching in the wrong market. */
export function findUsismDrift(transcript: TranscriptTurn[]): UsismHit[] {
  const out: UsismHit[] = [];
  for (let i = 0; i < transcript.length; i++) {
    const t = transcript[i];
    if (!t || !t.speaker || !t.speaker.toLowerCase().startsWith("a")) continue;
    const text = t.text || "";
    for (const { re, label } of USISM_PATTERNS) {
      const m = text.match(re);
      if (m) {
        out.push({ turn_idx: i, phrase: m[0], label });
      }
    }
  }
  return out;
}
