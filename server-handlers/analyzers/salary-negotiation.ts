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
import { SALARY_DATA, CALIBRATION_DATE, type SalaryEntry, type ExperienceLevel } from "../../data/salaries";
/* PDF#29 Bug 7 (2026-05-18) — frustration regex moved to a shared
 * module so the live planner and the post-session analyzer agree on
 * the subset of cues that promote acknowledge-and-recover. The
 * analyzer's own USER_CONFUSION_RE is a SUPERSET (it also covers
 * "i'm confused", "wait what", etc. that don't necessarily mean the
 * candidate is being looped); the imported regex is the narrower
 * looping-on-topic subset. */
import { USER_FRUSTRATION_RE } from "../_user-signals";
import { generateNegotiationBand, getReferenceBand } from "../../data/salary-lookup";
import { getCompanyBandOverride } from "../../data/company-salary-overrides";
import { matchRoleKey } from "../../data/salaries";
import { askPositioning, landingZone, type CompanyTierBucket } from "../../src/_negotiation-math";
import { getCompanyTier } from "../../data/company-tiers";
import { detectRoleCompanyFit } from "../../src/_role-company-fit";

/** Local tier mapper. Mirrors the one in salary-lookup.ts. Kept here to
 *  avoid circular imports between data/ and src/ helpers. */
function tierBucket(co: string | undefined): CompanyTierBucket | undefined {
  const t = getCompanyTier(co ?? "");
  switch (t) {
    case "faang": case "big-tech": case "gcc":          return "listed_big_tech";
    case "indian-unicorn": case "saas-product":         return "mature_unicorn";
    case "edtech": case "startup-growth":               return "growth_startup";
    case "startup-early":                                return "early_startup";
    case "it-services":                                  return "it_services";
    case "bfsi-global": case "bfsi-domestic":           return "bfsi";
    case "fmcg-mnc":                                     return "fmcg";
    case "government-psu":                               return "psu";
    default:                                             return undefined;
  }
}

/** Plausibility bounds across the entire Indian market (LPA).
 *  Anything outside these is almost certainly hallucinated for any
 *  realistic role/tier/level combination.
 */
const GLOBAL_LPA_MIN = 2;
const GLOBAL_LPA_MAX = 300;

/** US-isms that should never appear in an Indian-market salary-neg.
 *  Hitting any of these means the LLM drifted out of character —
 *  the candidate's coaching is grounded in the wrong market then.
 *  Each pattern → human-readable label for the rubric gap. */
const USISM_PATTERNS: Array<{ re: RegExp; label: string }> = [
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

/** Scan AI hiring-manager turns for US-ism leakage. Each hit is a
 *  rubric gap because the AI is grounding coaching in the wrong market. */
function findUsismDrift(transcript: TranscriptTurn[]): Array<{ turn_idx: number; phrase: string; label: string }> {
  const out: Array<{ turn_idx: number; phrase: string; label: string }> = [];
  for (let i = 0; i < transcript.length; i++) {
    const t = transcript[i];
    if (!t || t.speaker !== "ai") continue;
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

/* Extract any numeric compensation claim with unit. Examples matched:
 *   "32 LPA", "₹45 lakh", "1.2 crore", "INR 28L", "55-65 LPA"
 *   Returns the upper bound of any range as the canonical value.
 */
// Allow up to 4-digit values so we can flag "1500 LPA" / "9999 LPA" as
// implausible. Capping at 3 digits silently dropped absurd claims because
// the regex didn't match them in the first place.
const COMP_RE = /(?:₹|inr\s*)?(\d{1,4}(?:\.\d{1,2})?)\s*(?:[-–to]+\s*(\d{1,4}(?:\.\d{1,2})?)\s*)?(lpa|lakhs?|l\b|cr|crores?)/gi;

// Compact crore: "1.5cr", "2cr+". Same shape as COMP_RE but without
// requiring an LPA-style suffix word.
const COMPACT_CR_RE = /(?:₹|inr\s*)?(\d{1,3}(?:\.\d{1,2})?)\s*cr\b/gi;

// Word-number salary phrases: "fifteen lakhs", "twenty-five LPA",
// "two crore". Maps the most common 1-99 word forms to numbers.
const WORD_NUM_MAP: Record<string, number> = {
  one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
  eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,
  twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,
};
const WORD_NUM_RE = /\b((?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\s-](?:one|two|three|four|five|six|seven|eight|nine))?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\s+(lakhs?|crores?|lpa)\b/gi;
function wordToNumber(word: string): number | null {
  const norm = word.toLowerCase().trim();
  if (WORD_NUM_MAP[norm] !== undefined) return WORD_NUM_MAP[norm]!;
  const m = norm.match(/^(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-](\w+)$/);
  if (m && WORD_NUM_MAP[m[1]!] !== undefined && WORD_NUM_MAP[m[2]!] !== undefined) {
    return WORD_NUM_MAP[m[1]!]! + WORD_NUM_MAP[m[2]!]!;
  }
  return null;
}

// USD currency switch: "$120,000", "USD 60K". The analyzer flags via the
// USISM rubric gap, but extraction here lets us still capture the magnitude
// for hallucination/band-comparison logic. Conservative INR conversion at
// 1 USD = 84 INR (mid-2026 rate); rounding to LPA.
const USD_RE = /(?:\$|usd\s*)(\d{1,3}(?:[,]\d{3})*|\d{4,7})\s*(?:k|thousand)?/gi;

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

    // Standard "₹X LPA / X lakhs / X cr" pattern.
    COMP_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = COMP_RE.exec(text)) !== null) {
      const lo = parseFloat(m[1]);
      const hi = m[2] ? parseFloat(m[2]) : lo;
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue;
      out.push({ turn_idx: i, speaker: t.speaker, raw: m[0], lpa: toLpa(hi, m[3]) });
    }

    // Compact crore: "1.5cr" without surrounding LPA suffix. Skip if the
    // standard regex already captured it (we check by raw substring).
    COMPACT_CR_RE.lastIndex = 0;
    while ((m = COMPACT_CR_RE.exec(text)) !== null) {
      const v = parseFloat(m[1]);
      if (!Number.isFinite(v)) continue;
      const raw = m[0];
      if (out.some(c => c.turn_idx === i && c.raw.includes(raw))) continue;
      out.push({ turn_idx: i, speaker: t.speaker, raw, lpa: v * 100 });
    }

    // Word numbers: "fifteen lakhs", "twenty-five LPA".
    WORD_NUM_RE.lastIndex = 0;
    while ((m = WORD_NUM_RE.exec(text)) !== null) {
      const num = wordToNumber(m[1]!);
      if (num === null) continue;
      const lpa = /crore/i.test(m[2]!) ? num * 100 : num;
      out.push({ turn_idx: i, speaker: t.speaker, raw: m[0], lpa });
    }

    // USD figures: "$120,000". Conservative ₹84/USD conversion.
    USD_RE.lastIndex = 0;
    while ((m = USD_RE.exec(text)) !== null) {
      const cleaned = m[1]!.replace(/,/g, "");
      const usd = parseFloat(cleaned);
      if (!Number.isFinite(usd)) continue;
      // Detect "$60K" form
      const isK = /k|thousand/i.test(m[0]);
      const usdActual = isK ? usd * 1000 : usd;
      const lpa = (usdActual * 84) / 100000;
      out.push({ turn_idx: i, speaker: t.speaker, raw: m[0], lpa });
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

/** Detect AI offers where the stated total doesn't match the sum of components.
 *  Returns evidence string when inconsistent, null otherwise. */
function detectInconsistentOffer(text: string): string | null {
  // Look for: "total CTC of X LPA" + "base of A LPA" + "variable... B LPA" + optional "bonus C LPA"
  const totalMatch = /\btotal (?:ctc|compensation)?\s*(?:of)?\s*(?:₹|inr\s*)?(\d{1,3}(?:\.\d+)?)\s*(?:LPA|lakhs?|cr|crores?)/i.exec(text);
  const baseMatch = /\bbase (?:salary|of)?\s*(?:₹|inr\s*)?(\d{1,3}(?:\.\d+)?)\s*(?:LPA|lakhs?|cr|crores?)/i.exec(text);
  const varMatch = /\bvariable (?:component|pay)?\s*(?:of)?\s*(?:₹|inr\s*)?(\d{1,3}(?:\.\d+)?)\s*(?:LPA|lakhs?|cr|crores?)/i.exec(text);
  const bonusMatch = /\b(?:joining|sign[- ]?on|signing) bonus (?:of)?\s*(?:₹|inr\s*)?(\d{1,3}(?:\.\d+)?)\s*(?:LPA|lakhs?|cr|crores?)/i.exec(text);

  if (!totalMatch) return null;
  const total = parseFloat(totalMatch[1]);
  const base = baseMatch ? parseFloat(baseMatch[1]) : null;
  const variable = varMatch ? parseFloat(varMatch[1]) : null;
  const bonus = bonusMatch ? parseFloat(bonusMatch[1]) : null;

  // Need at least base + one other component to do the math.
  if (base === null) return null;
  const components: number[] = [base];
  if (variable !== null) components.push(variable);
  if (bonus !== null) components.push(bonus);
  if (components.length < 2) return null;

  const sum = components.reduce((a, b) => a + b, 0);
  // Tolerance: 15% — covers rounding, gratuity, benefits not itemized.
  const tolerance = total * 0.15;
  if (Math.abs(sum - total) > tolerance) {
    return `AI stated total ${total} LPA but components (base ${base}${variable !== null ? ` + variable ${variable}` : ""}${bonus !== null ? ` + bonus ${bonus}` : ""}) sum to ${sum.toFixed(1)} LPA`;
  }
  return null;
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
  // v4 (2026-05-07 night): Accenture fixes — broader DIRECT_ASK regex,
  // ai_no_counter_offered also fires when AI never quoted any number,
  // ai_ignored_user_complaint fires on no-acknowledge as well as
  // premature-close. Plus code-level guards in follow-up.ts (LLM dedup
  // retry) and generate-questions.ts (initial-offer fallback inject).
  version: "salary-negotiation-v4",

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
    // Two layers of plausibility:
    // (a) Global ceiling — catches absurd numbers (1000 LPA, etc).
    // (b) Role+company-aware ceiling — catches role-specific inflation
    //     (e.g. ₹18 LPA for Senior UX at Thence whose actual band is ~10 LPA).
    const dataCeiling = dataDrivenCeiling();
    const ceiling = Math.max(GLOBAL_LPA_MAX, dataCeiling);
    const claims = extractCompClaims(transcript);

    // Compute role/company band when target_role is known. Tolerance: 25%
    // above the band's walkAway (max stretch) before we flag. AI offers
    // a bit above market are realistic; egregious overages aren't.
    let roleAwareCeiling: number | null = null;
    let bandContextLabel = "";
    if (session.target_role) {
      // Prefer the per-company override (authoritative) over the
      // tier-default band, which over-estimates for non-unicorn employers.
      try {
        const expLevel = (session.difficulty || "mid") as ExperienceLevel;
        const roleKey = matchRoleKey(session.target_role);
        const override = getCompanyBandOverride(session.target_company || undefined, roleKey, expLevel);
        if (override) {
          // Tighter tolerance for verified company data — multi-source bands
          // (sourceCount ≥ 2) cap at 20% above totalMax; single-source at 30%.
          // This reduces false-positive hallucination flags when the band
          // itself is low-confidence. Previously a flat 25% across both.
          const sourceCount = override.sourceVerifiedAt
            ? Object.values(override.sourceVerifiedAt).filter(Boolean).length
            : 1;
          const tolerance = sourceCount >= 2 ? 1.20 : 1.30;
          roleAwareCeiling = override.totalMax * tolerance;
          bandContextLabel = `${session.target_role} at ${session.target_company} — ${sourceCount >= 2 ? "verified" : "single-source"} band caps at ${override.totalMax.toFixed(1)} LPA (${override.source}, ${tolerance.toFixed(2)}x tolerance)`;
        } else {
          const band = generateNegotiationBand({
            role: session.target_role,
            company: session.target_company || undefined,
            experienceLevel: session.difficulty || undefined,
          });
          // Without a verified override, use maxStretch (the manager's true
          // upper bound) instead of walkAway (which is what they'd let the
          // candidate walk before — much higher and far too lenient). Use
          // softer tolerance (1.30x) when the band itself is a tier-default
          // approximation — flagging an LLM offer 25% above an approximation
          // produces too many false positives.
          const tolerance = band.bandSource === "tier-default" || band.bandSource === "fallback" ? 1.30 : 1.15;
          roleAwareCeiling = band.maxStretch * tolerance;
          bandContextLabel = `${session.target_role}${session.target_company ? ` at ${session.target_company}` : ""} — ${band.bandSource ?? "tier-default"} max at ${band.maxStretch.toFixed(1)} LPA (${tolerance.toFixed(2)}x tolerance)`;
        }
      } catch {
        /* lookup failure — fall back to global ceiling only */
      }
    }

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
      } else if (roleAwareCeiling !== null && c.lpa > roleAwareCeiling) {
        hallucinations.push({
          turn_idx: c.turn_idx,
          type: "above_role_band",
          evidence: `AI quoted ${c.raw} (${c.lpa.toFixed(1)} LPA) — above realistic band for ${bandContextLabel}`,
          severity: "high",
        });
        flags.add("above_role_band");
      }
    }

    // --- 2b. Internal consistency: when AI says "total CTC of X" and
    // breaks into components (base + variable + bonus) that don't sum
    // to X, that's a structural hallucination. Caught the Thence case
    // where AI said "total ₹18 LPA = base ₹18 + variable ₹18 + bonus ₹18".
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!isAiTurn(t)) continue;
      const text = t.text || "";
      const inconsistency = detectInconsistentOffer(text);
      if (inconsistency) {
        hallucinations.push({
          turn_idx: i,
          type: "offer_components_inconsistent",
          evidence: inconsistency.slice(0, 280),
          severity: "high",
        });
        flags.add("offer_components_inconsistent");
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

    // --- 3a. Phrase repetition stutter ---
    // Yellow Slice: 'that's the absolute top of what I can approve' x4.
    // Spinny:       same phrase x2 (less severe but still wrong — long
    // 8+-word phrases shouldn't repeat at all in a hiring-manager turn).
    // Detection thresholds:
    //   8+ word phrases → flag at 2+ repetitions
    //   5-7 word phrases → flag at 3+ repetitions (existing behavior)
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!isAiTurn(t)) continue;
      const text = t.text || "";
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length < 15) continue;
      const checkWindow = (window: number, minRepeats: number): { phrase: string; count: number } | null => {
        const seen = new Map<string, number>();
        for (let j = 0; j + window <= words.length; j++) {
          const phrase = words.slice(j, j + window).join(" ").toLowerCase();
          if (phrase.length < 24) continue;
          seen.set(phrase, (seen.get(phrase) || 0) + 1);
        }
        for (const [phrase, count] of seen.entries()) {
          if (count >= minRepeats) return { phrase, count };
        }
        return null;
      };
      const longRepeat = checkWindow(8, 2);  // 8-word phrase × 2+
      const midRepeat = checkWindow(5, 3);   // 5-word phrase × 3+
      const found = longRepeat || midRepeat;
      if (found) {
        hallucinations.push({
          turn_idx: i,
          type: "ai_phrase_repetition",
          evidence: `AI repeated phrase "${found.phrase}" ${found.count} times in one turn — generation loop`,
          severity: "high",
        });
        flags.add("ai_phrase_repetition");
      }
    }

    // --- 3a-iv. Consecutive duplicate question ---
    // Spinny case: AI asked the EXACT same "What's most important to you?"
    // question word-for-word in two consecutive AI turns, after the user
    // had already answered it. Different from `duplicate_question` which
    // looks across the whole session — this catches adjacent loops.
    const aiTurnsList: { idx: number; text: string }[] = transcript
      .map((t, idx) => ({ idx, t }))
      .filter(({ t }) => isAiTurn(t))
      .map(({ idx, t }) => ({ idx, text: (t.text || "").trim() }));
    for (let i = 1; i < aiTurnsList.length; i++) {
      const prev = aiTurnsList[i - 1].text.toLowerCase();
      const curr = aiTurnsList[i].text.toLowerCase();
      if (prev.length < 60 || curr.length < 60) continue;
      // Use rough Jaccard-by-word for similarity.
      const prevWords = new Set(prev.split(/\s+/));
      const currWords = new Set(curr.split(/\s+/));
      const intersection = Array.from(prevWords).filter((w) => currWords.has(w)).length;
      const union = new Set([...prevWords, ...currWords]).size;
      const similarity = union > 0 ? intersection / union : 0;
      if (similarity >= 0.85) {
        flags.add("ai_consecutive_duplicate_question");
        gaps.push({
          dimension: "conversation_progression",
          expected: "Each AI turn should advance the conversation, not repeat the previous one verbatim",
          observed: `AI turns ${aiTurnsList[i - 1].idx} and ${aiTurnsList[i].idx} are ${(similarity * 100).toFixed(0)}% identical`,
          severity: "high",
        });
        break;
      }
    }

    // --- 3a-v. AI didn't address a direct user question ---
    // Spinny case: user asked "Can you help me understand what exactly
    // you're offering?" — AI replied with "What's most important to
    // you?" instead of giving an answer.
    // Heuristic: user turn ends with "?", contains words like
    // "what/how/can/could you...offer/show/explain", and AI's next turn
    // doesn't share the question's key noun.
    const DIRECT_ASK = /\b(what (?:are|is) you (?:offer|paying)|what (?:exactly )?(?:is|are) you offering|can you (?:help me understand|explain|clarify|tell me)|what'?s (?:your|the) (?:counter|number|offer)|give me (?:a number|your best|the (?:initial )?offer|the number)|share (?:the|your) (?:offer|number)|tell me (?:the|your) (?:offer|number)|i(?:'d| would) like to (?:know|hear|see|discuss) (?:the|your|more about) (?:offer|number|salary)|once you give me)\b/i;
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!isUserTurn(t)) continue;
      const text = t.text || "";
      if (!DIRECT_ASK.test(text)) continue;
      const nextAi = transcript.slice(i + 1, i + 3).find(isAiTurn);
      if (!nextAi) continue;
      const aiText = (nextAi.text || "").toLowerCase();
      // Has the AI given a number or specific offer detail?
      const aiGaveNumber = /(?:₹|inr\s*)?\d{1,3}(?:\.\d+)?\s*(?:LPA|lakhs?|cr|crores?)/i.test(nextAi.text || "");
      const aiAcknowledgedAnswering = /\b(here'?s what|the offer is|i can offer|let me clarify|to be clear|specifically)\b/i.test(aiText);
      if (!aiGaveNumber && !aiAcknowledgedAnswering) {
        flags.add("ai_didnt_answer_direct_question");
        gaps.push({
          dimension: "conversation_repair",
          expected: "When user explicitly asks 'what are you offering?', AI must answer with a number, not pivot to another question",
          observed: "AI dodged a direct ask with another question",
          severity: "high",
        });
        break;
      }
    }

    // --- 3a-vi. No numeric counter throughout the session ---
    // Spinny case: user asked ₹25 LPA. AI never made a single numeric
    // counter — just mirrored back user's number and recapped its own
    // initial offer. To detect this we look for COUNTER LANGUAGE +
    // a number > initial offer in the same AI turn, AFTER user's ask.
    {
      const userClaimsLocal = claims.filter((c) => isUserTurn(transcript[c.turn_idx]));
      const aiClaimsLocal = claims.filter((c) => isAiTurn(transcript[c.turn_idx]));
      const aiTurnCount = transcript.filter(isAiTurn).length;

      // Worst case first: AI never quoted any number across a 4+-turn session.
      // Accenture case — opener was vague ("we put together an offer") with no
      // ₹ amount, and follow-ups never produced numbers either. The whole
      // session is a salary-neg with zero numeric content.
      if (aiTurnCount >= 4 && aiClaimsLocal.length === 0) {
        flags.add("ai_no_counter_offered");
        gaps.push({
          dimension: "negotiation_progression",
          expected: "Salary-neg session must contain at least one specific ₹ figure from the AI",
          observed: `${aiTurnCount} AI turns, zero ₹ amounts mentioned anywhere — opener didn't present an offer either`,
          severity: "high",
        });
      } else if (aiTurnCount >= 4 && userClaimsLocal.length > 0 && aiClaimsLocal.length > 0) {
        const userFirstAskIdx = userClaimsLocal[0].turn_idx;
        const initialOfferLpa = aiClaimsLocal[0].lpa;
        // Counter language must commit to an offer, not just discuss limits.
        // "absolute top of what I can approve" mentions 'approve' but is the
        // ceiling phrasing, not a counter — excluded by requiring verbs that
        // commit to action (offer / stretch / land / meet) and dropping
        // 'approve' which appears in ceiling-language.
        const COUNTER_LANG = /\b(i can (?:offer|stretch|do|come up to|go up to|land at|meet you at)|let me offer|i'?ll offer|we can (?:do|offer|go up to|stretch to)|revised (?:offer|total|ctc)|updated (?:offer|total|ctc)|new offer|my best (?:is|offer)|stretch to ₹|come up to ₹|happy to (?:do|offer))\b/i;
        // A real counter = AI turn that (a) comes after user's first ask,
        // (b) contains counter-offer language, AND (c) names a number
        // strictly higher than the initial offer.
        const counterTurn = aiClaimsLocal.find((c) => {
          if (c.turn_idx <= userFirstAskIdx) return false;
          if (c.lpa <= initialOfferLpa * 1.01) return false; // not a stretch
          const turnText = transcript[c.turn_idx]?.text || "";
          return COUNTER_LANG.test(turnText);
        });
        if (!counterTurn) {
          flags.add("ai_no_counter_offered");
          gaps.push({
            dimension: "negotiation_progression",
            expected: "After user states a target, AI must produce a numeric counter (e.g. 'I can stretch to ₹X')",
            observed: `Across ${aiTurnCount} AI turns, no counter language + number above initial offer (₹${initialOfferLpa.toFixed(1)} LPA) was found`,
            severity: "high",
          });
        }
      }
    }

    // --- 3a-ii. Reversed range "X to Y" where X > Y ---
    // Yellow Slice case: "₹12 to ₹8.5 LPA". Ranges should always be low-to-high.
    const REVERSED_RANGE = /(?:₹|inr\s*)?(\d{1,3}(?:\.\d+)?)\s*(?:LPA|lakhs?|cr|crores?)?\s*(?:to|–|-)\s*(?:₹|inr\s*)?(\d{1,3}(?:\.\d+)?)\s*(LPA|lakhs?|cr|crores?)/gi;
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!isAiTurn(t)) continue;
      const text = t.text || "";
      REVERSED_RANGE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = REVERSED_RANGE.exec(text)) !== null) {
        const lo = parseFloat(m[1]);
        const hi = parseFloat(m[2]);
        if (Number.isFinite(lo) && Number.isFinite(hi) && lo > hi) {
          hallucinations.push({
            turn_idx: i,
            type: "ai_reversed_range",
            evidence: `AI quoted reversed range "${m[0]}" — ${lo} > ${hi}`,
            severity: "medium",
          });
          flags.add("ai_reversed_range");
          break;
        }
      }
    }

    // --- 3a-iii. AI ignored user complaint ---
    // User says "I'm confused" / "what are you saying" / "you're confusing me"
    // and AI's next turn is celebration / closing language without addressing.
    const USER_CONFUSION_RE = /\b(i'?m confused|i don'?t (?:understand|know what)|why don'?t you understand|what (?:are you saying|do you mean)|why are you (?:confusing|asking (?:again|the same|me the same))|this (?:doesn'?t make|isn'?t making) sense|you'?re confusing me|can you clarify|wait what|already (?:mentioned|told you|said)|i (?:told|mentioned) you (?:already|multiple times|before))\b/i;
    const PREMATURE_CLOSE_RE = /\b(thanks?\s+\w*[,.!]?\s*(?:i'?ll connect|i'?ll send|formal offer|expect the (?:formal|final) offer|hr will|rest of your day|joining the team|welcome (?:aboard|to))|excited about (?:the possibility of you|having you))\b/i;
    const HEARD_ACK_RE = /\b(you'?re right|i hear you|i apologi[sz]e|apologies|let me clarify|let me recap|to be clear|here'?s what i can|to summari[sz]e|let me try again)\b/i;
    const HAS_RUPEE = /(?:₹|inr\s*)?\d{1,3}(?:\.\d+)?\s*(?:LPA|lpa|lakhs?|cr|crores?)/i;
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!isUserTurn(t)) continue;
      if (!USER_CONFUSION_RE.test(t.text || "")) continue;
      const nextAi = transcript.slice(i + 1, i + 3).find(isAiTurn);
      if (!nextAi) continue;
      const nextText = nextAi.text || "";
      // Two ways AI can fail a complaint:
      // (a) Premature close (Yellow Slice / Spinny case)
      // (b) Continue without addressing — no acknowledgement, no recap, no
      //     numbers. This is the Accenture case where AI just asked the
      //     same question again.
      const isClose = PREMATURE_CLOSE_RE.test(nextText);
      const acknowledged = HEARD_ACK_RE.test(nextText);
      const recappedNumbers = HAS_RUPEE.test(nextText);
      if (isClose) {
        flags.add("ai_ignored_user_complaint");
        gaps.push({
          dimension: "conversation_repair",
          expected: "When user expresses confusion, AI must stop and clarify the offer with explicit numbers — not close the deal",
          observed: "User said they were confused; AI moved straight to closing language",
          severity: "high",
        });
        break;
      } else if (!acknowledged && !recappedNumbers) {
        flags.add("ai_ignored_user_complaint");
        gaps.push({
          dimension: "conversation_repair",
          expected: "When user expresses confusion, AI must acknowledge ('I hear you'), recap with numbers, or apologize — not continue as if nothing happened",
          observed: "User expressed confusion; AI's next turn neither acknowledged nor clarified — likely repeated the same question",
          severity: "high",
        });
        break;
      }
    }

    // --- 3b. AI self-contradiction in a single turn ---
    // Pattern: AI says "I can't [meet|reach|offer|match] ₹X" and then in
    // the same message offers ₹X. The Thence case: "I can't quite meet
    // ₹18 LPA directly. However, I can offer a revised total CTC of ₹18 LPA".
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!isAiTurn(t)) continue;
      const text = t.text || "";
      const cannotMatch = /\bcan(?:'t|not)\s+(?:quite\s+)?(?:meet|reach|offer|match|do|make|approve|justify)\s+(?:₹|inr\s*)?(\d{1,3}(?:\.\d+)?)\s*(?:LPA|lakhs?|cr|crores?)/i.exec(text);
      if (!cannotMatch) continue;
      const declinedAmount = parseFloat(cannotMatch[1]);
      // Look for an offer of an equivalent or higher amount in the same turn.
      COMP_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      let offered: number | null = null;
      while ((m = COMP_RE.exec(text)) !== null) {
        const lo = parseFloat(m[1]);
        const hi = m[2] ? parseFloat(m[2]) : lo;
        const lpa = toLpa(hi, m[3]);
        // Only count amounts AFTER the "can't meet" position
        if ((m.index || 0) > (cannotMatch.index || 0) && lpa >= declinedAmount * 0.95) {
          offered = lpa;
          break;
        }
      }
      if (offered !== null) {
        hallucinations.push({
          turn_idx: i,
          type: "ai_self_contradiction",
          evidence: `AI said it cannot meet ₹${declinedAmount} LPA, then in the same turn offered ₹${offered.toFixed(1)} LPA`,
          severity: "high",
        });
        flags.add("ai_self_contradiction");
      }
    }

    // --- 3c. AI misread a conditional as acceptance ---
    // User says "if you can [do X], [I'd accept]" — that's conditional, not
    // acceptance. AI replying with celebration language ("glad you're excited",
    // "happy to have you on board") is misreading the conversation.
    const CONDITIONAL_RE = /\b(if you can|if you (?:could|would)|provided that|as long as|on condition|only if|will (?:take|accept) it if)\b/i;
    const CELEBRATION_RE = /\b(glad to hear you'?re excited|happy to (?:have|hear)|excited to have you|welcome (?:aboard|to the team)|so glad you'?re on board)\b/i;
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!isUserTurn(t)) continue;
      if (!CONDITIONAL_RE.test(t.text || "")) continue;
      const nextAi = transcript.slice(i + 1, i + 3).find(isAiTurn);
      if (nextAi && CELEBRATION_RE.test(nextAi.text || "")) {
        flags.add("ai_misread_conditional_as_acceptance");
        gaps.push({
          dimension: "conversation_comprehension",
          expected: "Conditional acceptance ('if you can do X, I'd take it') is not the same as acceptance",
          observed: `User said something conditional; AI treated it as a definite yes`,
          severity: "high",
        });
        break;
      }
    }

    // --- 4. AI accepted first ask without pushing back ---
    // Pattern A: AI used acceptance language right after user's first number
    // Pattern B: AI later offered ≥ user's ask without ever mentioning the
    //   ask is above market — silent capitulation. This was the Thence case:
    //   user asked 18, AI said "I can't quite meet 18" and then offered 18.
    const userClaims = claims.filter((c) => isUserTurn(transcript[c.turn_idx]));
    const aiClaims = claims.filter((c) => isAiTurn(transcript[c.turn_idx]));
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

      // Pattern B: AI eventually offered >= user's first ask. If AI never
      // said the ask was above market, that's silent capitulation.
      const userAsk = first.lpa;

      // Ask-positioning vs band — flag underask (below band-min) and
      // unsupported moonshot (above band-max with no BATNA mentioned).
      if (session.target_role) {
        const expLevel = (session.difficulty || "mid") as ExperienceLevel;
        // Use the same getReferenceBand the LLM prompt sees, so the analyzer's
        // verdict matches what the AI hiring manager was working from.
        const bandRef = getReferenceBand({
          role: session.target_role,
          company: session.target_company || undefined,
          experienceLevel: expLevel,
        });
        const positioning = askPositioning(userAsk, bandRef);
        if (positioning.position === "below_band") {
          flags.add("user_below_band_underask");
          gaps.push({
            dimension: "negotiation_strategy",
            expected: `Ask should be at least band-min (₹${bandRef.totalMin.toFixed(1)} LPA) for this role/company`,
            observed: `User opened at ₹${userAsk.toFixed(1)} LPA — below documented band. Leaving money on the table.`,
            severity: "high",
          });
        } else if (positioning.position === "moonshot") {
          // Above band — only ok if BATNA was articulated.
          const batnaMentioned = transcript.some(t => isUserTurn(t) && BATNA_RE.test(t.text || ""));
          if (!batnaMentioned) {
            flags.add("user_moonshot_no_batna");
            gaps.push({
              dimension: "negotiation_strategy",
              expected: `Ask above band-max (₹${bandRef.totalMax.toFixed(1)} LPA) requires articulated BATNA or scope justification`,
              observed: `User asked ₹${userAsk.toFixed(1)} LPA (moonshot) without mentioning competing offer or scope rationale. Risks credibility.`,
              severity: "medium",
            });
          }
        }

        // Predicted-vs-actual close — did the AI close meaningfully outside
        // the predicted landing zone for this tier?
        const aiInitial = aiClaims.find(c => c.turn_idx < first.turn_idx);
        const aiFinal = aiClaims[aiClaims.length - 1];
        if (aiInitial && aiFinal && aiFinal.lpa > 0) {
          const tier = tierBucket(session.target_company || undefined);
          const zone = landingZone(aiInitial.lpa, userAsk, tier);
          // Allow 20% tolerance around the zone before flagging.
          const tooHigh = aiFinal.lpa > zone.highLpa * 1.20;
          const tooLow = aiFinal.lpa < zone.lowLpa * 0.80 && aiFinal.lpa < userAsk;
          if (tooHigh) {
            flags.add("ai_unrealistic_close_above_predicted");
            gaps.push({
              dimension: "negotiation_realism",
              expected: `Realistic close for this tier: ₹${zone.lowLpa}-${zone.highLpa} LPA (recruiter flex ${Math.round(zone.flexibility * 100)}% of gap)`,
              observed: `AI closed at ₹${aiFinal.lpa.toFixed(1)} LPA — meaningfully above predicted zone for ${tier ?? "this tier"}.`,
              severity: "medium",
            });
          } else if (tooLow) {
            flags.add("ai_under_close_below_predicted");
            gaps.push({
              dimension: "negotiation_realism",
              expected: `Realistic close for this tier: ₹${zone.lowLpa}-${zone.highLpa} LPA`,
              observed: `AI closed at ₹${aiFinal.lpa.toFixed(1)} LPA — below predicted zone, harming candidate.`,
              severity: "low",
            });
          }
        }
      }

      const aiMatched = aiClaims.find((c) => c.turn_idx > first.turn_idx && c.lpa >= userAsk * 0.95);
      if (aiMatched) {
        const allAiText = transcript.filter(isAiTurn).map((t) => t.text || "").join(" ");
        const mentionedAboveMarket = /\b(above (?:our|the) (?:band|range|budget|market)|outside (?:our|the) range|exceed(?:s)? (?:our|the) band|stretch beyond|cannot match|can'?t justify|out of band)\b/i.test(allAiText);
        if (!mentionedAboveMarket) {
          flags.add("ai_silent_capitulation");
          gaps.push({
            dimension: "negotiation_realism",
            expected: "AI should explicitly say if user's ask is above market before matching it",
            observed: `AI matched user's ${userAsk.toFixed(1)} LPA ask without ever pushing back on whether it was realistic`,
            severity: "high",
          });
        }
      }
    }

    // --- 4-pre. Role × company sector-fit. Flags impossible combos like
    //     Pilot @ Razorpay before they propagate as a wrong band ---
    if (session.target_role) {
      const tier = getCompanyTier(session.target_company || "");
      const roleKey = matchRoleKey(session.target_role);
      const fit = detectRoleCompanyFit(roleKey, tier, session.target_company || undefined);
      if (fit.fit === "hard_mismatch") {
        flags.add("role_company_mismatch");
        gaps.push({
          dimension: "session_setup",
          expected: "Selected role exists at the selected company (or at least its tier)",
          observed: fit.reason,
          severity: "high",
        });
      }
    }

    // --- 4·. Numerical-claim consistency: AI said "₹X LPA = ₹Yk/month".
    //         Verify Y is within ±25% of our canonical CTC-breakdown
    //         monthly take-home. LLMs do arithmetic wrong frequently. ---
    {
      // Pattern: number followed by LPA/lakhs/cr ... "= ₹Yk per month" or
      // "around ₹Yk/month take-home" within ~120 chars.
      const monthRe = /(\d{1,3}(?:\.\d{1,2})?)\s*(?:lpa|lakhs?|l\b|cr|crores?)[\s\S]{0,120}?(?:₹|inr\s*)?(\d{2,3}(?:[,]\d{3})?)\s*(?:k|thousand)?\s*(?:per\s*month|\/?\s*month|\/?\s*mo\b|monthly)/gi;
      for (let i = 0; i < transcript.length; i++) {
        const t = transcript[i];
        if (!t || !isAiTurn(t)) continue;
        const text = t.text || "";
        let m: RegExpExecArray | null;
        monthRe.lastIndex = 0;
        while ((m = monthRe.exec(text)) !== null) {
          const ctcLpa = parseFloat(m[1]!);
          const isCr = /cr/i.test(m[0]);
          const ctcLpaActual = isCr ? ctcLpa * 100 : ctcLpa;
          const monthlyClaimedK = parseFloat((m[2] ?? "0").replace(/,/g, ""));
          if (!Number.isFinite(ctcLpaActual) || !Number.isFinite(monthlyClaimedK)) continue;
          if (ctcLpaActual <= 0 || monthlyClaimedK <= 0) continue;
          // Naive but useful sanity floor: monthly take-home is roughly
          // CTC × 0.55 / 12 in LPA terms = CTC × 4583 in ₹/month, i.e.
          // 4.58k per LPA of stated CTC. Range candidate: 3.5k-5.5k.
          const expectedKLow = ctcLpaActual * 3.5;
          const expectedKHigh = ctcLpaActual * 5.5;
          if (monthlyClaimedK < expectedKLow * 0.6 || monthlyClaimedK > expectedKHigh * 1.4) {
            flags.add("ai_arithmetic_error");
            gaps.push({
              dimension: "numerical_correctness",
              expected: `Monthly take-home for ₹${ctcLpaActual.toFixed(1)} LPA stated CTC ≈ ₹${Math.round(expectedKLow)}k-${Math.round(expectedKHigh)}k (after tax + EPF, new regime FY 2025-26)`,
              observed: `AI claimed ₹${monthlyClaimedK}k/month for ₹${ctcLpaActual.toFixed(1)} LPA — outside plausible take-home range. Likely arithmetic hallucination.`,
              severity: "high",
            });
            break;
          }
        }
        if (flags.has("ai_arithmetic_error")) break;
      }
    }

    // --- 4a. Offer regression: AI quoted a higher number then walked it
    //         back without explicit "I made a mistake / let me revise"
    //         language. Real recruiters never do this — it's an LLM bug. ---
    {
      const aiClaimsByTurn = claims
        .filter(c => isAiTurn(transcript[c.turn_idx]))
        .filter(c => c.lpa > 0);
      for (let k = 1; k < aiClaimsByTurn.length; k++) {
        const prev = aiClaimsByTurn[k - 1]!;
        const curr = aiClaimsByTurn[k]!;
        // Only flag drops >5% to avoid noise from "we offered 32 LPA total"
        // → "32 LPA — 24 LPA base" decompositions.
        if (curr.lpa < prev.lpa * 0.95) {
          // Check the surrounding AI text for revision language.
          const between = transcript
            .slice(prev.turn_idx, curr.turn_idx + 1)
            .filter(isAiTurn)
            .map(t => t.text || "")
            .join(" ");
          const revised = /\b(let me revise|i made (?:a |an )?(?:mistake|error)|correction|misspoke|to clarify|that should (?:be|have been)|i mis(?:quoted|spoke))\b/i.test(between);
          // Also ignore decomposition explanations ("of which X is base").
          const decomposition = /\b(of which|that(?:'s| is) (?:base|fixed)|breaks down (?:to|into)|comprised of|breakdown is)\b/i.test(between);
          if (!revised && !decomposition) {
            flags.add("ai_offer_regression");
            gaps.push({
              dimension: "negotiation_realism",
              expected: "AI hiring manager's later offer should be ≥ earlier offer (recruiters never silently walk back numbers)",
              observed: `AI quoted ₹${prev.lpa.toFixed(1)} LPA at turn ${prev.turn_idx + 1}, then ₹${curr.lpa.toFixed(1)} LPA at turn ${curr.turn_idx + 1} — ${(((prev.lpa - curr.lpa) / prev.lpa) * 100).toFixed(0)}% lower without revision language.`,
              severity: "high",
            });
            break; // flag once per session
          }
        }
      }
    }

    // --- 4b. Voice/language drift: AI slipped into US-isms ---
    const usismHits = findUsismDrift(transcript);
    if (usismHits.length > 0) {
      flags.add("ai_usism_drift");
      // Group by label (de-dup repeated hits across turns).
      const byLabel = new Map<string, string[]>();
      for (const hit of usismHits) {
        if (!byLabel.has(hit.label)) byLabel.set(hit.label, []);
        byLabel.get(hit.label)!.push(`"${hit.phrase}"`);
      }
      const labelList = Array.from(byLabel.entries())
        .map(([label, phrases]) => `${label} (${phrases.slice(0, 2).join(", ")})`)
        .join("; ");
      gaps.push({
        dimension: "voice_authenticity",
        expected: "AI hiring manager stays in Indian-market vocabulary throughout (₹ / LPA / EPF / joining bonus / leave)",
        observed: `AI slipped into US-ism phrasing: ${labelList}. Coaching is grounded in the wrong market.`,
        severity: "high",
      });
    }

    // --- 5. Coaching summary ---
    const tips: string[] = [];
    if (flags.has("ai_usism_drift")) {
      tips.push("AI hiring-manager voice slipped into US phrasing during the call — flag this as a quality issue if reviewing the transcript.");
    }
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
