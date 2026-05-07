/* Salary-negotiation analyzer — deterministic v1.
 *
 * Uses data/salaries.ts as ground truth to flag AI hallucinations
 * (numbers outside any plausible Indian-market band) and to surface
 * coaching gaps the live evaluator misses:
 *   - AI quoted a salary band so far outside reality it must be invented
 *   - Salary data calibration is stale (>12mo old)
 *   - User never anchored first; only countered
 *   - User never articulated BATNA / walk-away
 *   - Equity / joining-bonus / notice-period never came up
 *   - AI accepted user's first low ask without pushing back
 */

import {
  AnalyzerInput,
  AnalyzerResult,
  FocusAnalyzer,
  Hallucination,
  RubricGap,
  TranscriptTurn,
  emptyResult,
} from "./_types";
import { SALARY_DATA, CALIBRATION_DATE, type SalaryEntry } from "../../data/salaries";

/** Plausibility bounds across the entire Indian market (LPA).
 *  Anything outside these is almost certainly hallucinated for any
 *  realistic role/tier/level combination.
 */
const GLOBAL_LPA_MIN = 2;
const GLOBAL_LPA_MAX = 300;

/* Extract any numeric compensation claim with unit. Examples matched:
 *   "32 LPA", "₹45 lakh", "1.2 crore", "INR 28L", "55-65 LPA"
 *   Returns the upper bound of any range as the canonical value.
 */
const COMP_RE = /(?:₹|inr\s*)?(\d{1,3}(?:\.\d{1,2})?)\s*(?:[-–to]+\s*(\d{1,3}(?:\.\d{1,2})?)\s*)?(lpa|lakhs?|l\b|cr|crores?)/gi;

function toLpa(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith("cr")) return value * 100;
  return value; // lakh/lpa/L all = 1 LPA
}

interface CompClaim {
  turn_idx: number;
  speaker: string;
  raw: string;
  lpa: number;       // upper bound of range, or single value
}

function extractCompClaims(transcript: TranscriptTurn[]): CompClaim[] {
  const out: CompClaim[] = [];
  for (let i = 0; i < transcript.length; i++) {
    const t = transcript[i];
    const text = t.text || "";
    COMP_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = COMP_RE.exec(text)) !== null) {
      const lo = parseFloat(m[1]);
      const hi = m[2] ? parseFloat(m[2]) : lo;
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue;
      out.push({
        turn_idx: i,
        speaker: t.speaker,
        raw: m[0],
        lpa: toLpa(hi, m[3]),
      });
    }
  }
  return out;
}

/** Walk SALARY_DATA and collect every total_max — used to compute the
 *  global plausibility ceiling on the fly. Cheap; runs once per session.
 */
function dataDrivenCeiling(): number {
  let max = 0;
  for (const role of Object.values(SALARY_DATA)) {
    if (!role) continue;
    for (const tier of Object.values(role)) {
      if (!tier) continue;
      for (const entry of Object.values(tier) as SalaryEntry[]) {
        if (entry && Number.isFinite(entry.total_max)) {
          max = Math.max(max, entry.total_max);
        }
      }
    }
  }
  return max;
}

function isAiTurn(t: TranscriptTurn): boolean {
  return t.speaker.toLowerCase().startsWith("a");
}
function isUserTurn(t: TranscriptTurn): boolean {
  return t.speaker.toLowerCase().startsWith("u");
}

const ANCHOR_USER_RE = /\b(my expectation is|i'?m looking for|target compensation|i'?m targeting|based on my research)\b/i;
const BATNA_RE = /\b(alternative offer|another offer|competing offer|batna|walk away|elsewhere|other company|other companies|other firm|i have|currently interviewing)\b/i;
const EQUITY_RE = /\b(equity|esop|rsu|stock|shares?|vesting|cliff)\b/i;
const JOINING_BONUS_RE = /\b(joining bonus|sign[- ]?on|signing bonus|relocation)\b/i;
const NOTICE_RE = /\b(notice period|buyout|buy[- ]?out|serve notice)\b/i;
const PUSHBACK_RE = /\b(can you (?:do|stretch|consider)|is there room|any flexibility|can we revisit|stretch goal|ceiling|upper end|top of the band)\b/i;

function monthsSince(yyyymm: string): number {
  const m = /^(\d{4})-(\d{2})$/.exec(yyyymm);
  if (!m) return 999;
  const then = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, 1);
  const now = new Date();
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
}

export const salaryNegotiationAnalyzer: FocusAnalyzer = {
  focus: "salary-negotiation",
  version: "salary-negotiation-v1",

  async analyze({ session }: AnalyzerInput): Promise<AnalyzerResult> {
    const result = emptyResult();
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    if (transcript.length === 0) {
      result.flags.push("empty_transcript");
      return result;
    }

    const flags = new Set<string>();
    const hallucinations: Hallucination[] = [];
    const gaps: RubricGap[] = [];

    // --- 1. Stale market data ---
    const calMonths = monthsSince(CALIBRATION_DATE);
    if (calMonths > 12) {
      flags.add("stale_market_calibration");
      gaps.push({
        dimension: "market_data_freshness",
        expected: "Salary calibration ≤12 months old",
        observed: `data/salaries.ts CALIBRATION_DATE is ${CALIBRATION_DATE} (${calMonths}mo old)`,
        severity: "high",
      });
    }

    // --- 2. Implausible AI compensation claims ---
    const dataCeiling = dataDrivenCeiling();
    const ceiling = Math.max(GLOBAL_LPA_MAX, dataCeiling);
    const claims = extractCompClaims(transcript);
    for (const c of claims) {
      if (!isAiTurn(transcript[c.turn_idx])) continue;
      if (c.lpa < GLOBAL_LPA_MIN || c.lpa > ceiling) {
        hallucinations.push({
          turn_idx: c.turn_idx,
          type: "implausible_salary_claim",
          evidence: `AI quoted ${c.raw} (${c.lpa.toFixed(1)} LPA) — outside market range [${GLOBAL_LPA_MIN}, ${ceiling}]`,
          severity: "high",
        });
        flags.add("implausible_salary_claim");
      }
    }

    // --- 3. Conversation-quality checks (per-session, cheap regex) ---
    const userText = transcript.filter(isUserTurn).map((t) => t.text || "").join(" ");
    const aiText = transcript.filter(isAiTurn).map((t) => t.text || "").join(" ");
    const userTurnCount = transcript.filter(isUserTurn).filter((t) => (t.text || "").length > 30).length;

    if (userTurnCount >= 2) {
      if (!ANCHOR_USER_RE.test(userText)) {
        flags.add("user_never_anchored");
        gaps.push({
          dimension: "anchoring",
          expected: "User states a researched target number first",
          observed: "No anchoring phrase detected in user turns",
          severity: "medium",
        });
      }
      if (!BATNA_RE.test(userText)) {
        flags.add("no_batna_articulated");
        gaps.push({
          dimension: "batna",
          expected: "User references walk-away point or alternative offer",
          observed: "No BATNA / alternative-offer language in transcript",
          severity: "medium",
        });
      }
      if (!EQUITY_RE.test(`${userText} ${aiText}`)) {
        flags.add("equity_never_discussed");
      }
      if (!JOINING_BONUS_RE.test(`${userText} ${aiText}`)) {
        flags.add("joining_bonus_never_discussed");
      }
      if (!NOTICE_RE.test(`${userText} ${aiText}`)) {
        flags.add("notice_period_never_discussed");
      }
    }

    // --- 4. AI accepted first ask without pushing back ---
    const userClaims = claims.filter((c) => isUserTurn(transcript[c.turn_idx]));
    if (userClaims.length > 0) {
      const first = userClaims[0];
      const aiAfter = transcript
        .slice(first.turn_idx + 1, first.turn_idx + 4)
        .filter(isAiTurn)
        .map((t) => t.text || "")
        .join(" ");
      if (aiAfter.length > 0 && !PUSHBACK_RE.test(aiAfter)) {
        const accepted = /\b(deal|done|agreed|accept|that works|sounds (?:good|fair)|we can do that)\b/i.test(aiAfter);
        if (accepted) {
          flags.add("ai_accepted_without_pushback");
          gaps.push({
            dimension: "negotiation_realism",
            expected: "AI hiring manager probes/counter-offers before accepting",
            observed: "AI accepted first user number without any pushback",
            severity: "high",
          });
        }
      }
    }

    // --- 5. Coaching summary ---
    const tips: string[] = [];
    if (flags.has("user_never_anchored")) {
      tips.push("Open with a researched target range — letting the recruiter quote first costs you leverage.");
    }
    if (flags.has("no_batna_articulated")) {
      tips.push("Reference an alternative offer or clear walk-away point. BATNA is what makes negotiation real.");
    }
    if (flags.has("equity_never_discussed")) {
      tips.push("Equity is often the largest lever at senior levels — bring it up explicitly.");
    }
    if (flags.has("joining_bonus_never_discussed")) {
      tips.push("Joining bonus / sign-on can recover gap when base is capped. Always ask.");
    }

    result.hallucinations = hallucinations;
    result.rubricGaps = gaps;
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    return result;
  },
};
