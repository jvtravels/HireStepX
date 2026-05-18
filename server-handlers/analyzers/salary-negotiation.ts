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
import { askPositioning, batnaStrength, landingZone, type CompanyTierBucket, type CompetingOffer } from "../../src/_negotiation-math";
import { getCompanyTier } from "../../data/company-tiers";
import { detectRoleCompanyFit } from "../../src/_role-company-fit";
import {
  computeNewRegimeTaxLpa,
  computeOldRegimeTaxLpa,
  variablePayoutFactorForTier,
} from "../../src/_ctc-breakdown";
import { computeEquityGrant } from "../../src/_equity-literacy";
import {
  selectRecruiterSectorPersona,
  getRecruiterSectorPersona,
  type RecruiterSectorPersona,
} from "../_indian-recruiter-personas";

/** Human-readable label per CompanyTierBucket. Surfaced in the report
 *  header so the candidate sees which band they were scored against
 *  (FAANG vs. early-stage startup grade salary moves very differently). */
const TIER_BUCKET_LABEL: Record<CompanyTierBucket, string> = {
  listed_big_tech: "FAANG / Big-Tech / GCC",
  listed_unicorn: "Listed Indian unicorn",
  mature_unicorn: "Indian unicorn",
  growth_startup: "Growth-stage startup",
  early_startup: "Early-stage startup",
  it_services: "IT services",
  bfsi: "BFSI",
  fmcg: "FMCG",
  psu: "Government / PSU",
};

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

/* US-ism patterns and the scanner that walks AI turns moved to
 * `_usism-patterns.ts` so the behavioral analyzer (and future Indian-
 * register foci) can reuse the same set. Re-exporting the scanner
 * under its original local name keeps the call-sites below unchanged. */
import { findUsismDrift } from "./_usism-patterns";

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

/* Phase 2.1 — Equity literacy. ESOP / RSU mention + probe vocabulary.
 *   ESOP_MENTION_RE   → equity grant came up in transcript (any speaker)
 *   EQUITY_PROBE_RE   → candidate asked the questions a literate
 *                       candidate must ask: vesting cliff, FMV / strike,
 *                       dilution / refresh / exercise window.
 *   EQUITY_GRANT_RE   → extract grant face value when AI quotes it,
 *                       e.g. "₹20 LPA equity vesting 4 years". Conservative
 *                       — drops to undefined when no explicit equity number. */
const ESOP_MENTION_RE = /\b(esop|rsu|stock option|stock options|equity grant|equity component|equity at|equity of)\b/i;
const RSU_HINT_RE = /\b(rsu|listed (?:stock|equity)|public stock)\b/i;
const EQUITY_PROBE_RE = /\b(cliff|vesting cliff|fmv|fair market value|strike (?:price|rate)|dilution|refresh (?:grant|cycle)|exercise window|post[- ]?exercise|post[- ]?termination|409a|409 ?a|liquidity (?:event|window)|secondary (?:sale|buyback)|buyback program)\b/i;
const EQUITY_GRANT_RE = /\b(?:equity|esop|rsu|stock(?: option)?s?)\s+(?:(?:component|grant|of|at|worth|valued at|portion|per year|annually)\s+)*(?:₹|inr\s*)?(\d{1,3}(?:\.\d{1,2})?)\s*(?:LPA|lakhs?|cr|crores?)/i;

/* Phase 2.3 — Joining-bonus clawback awareness. Fires only when joining
 * bonus was mentioned but no probe of clawback / pro-rate / repayment. */
const CLAWBACK_PROBE_RE = /\b(clawback|claw[- ]?back|pro[- ]?rate(?:d)?|pro[- ]?rata|repay(?:ment)?|forfeit|paid back|return the bonus|return the joining|early exit|hold period|tenure (?:requirement|condition)|recovery clause|recovered if)\b/i;

/* Phase 2.4 — Variable-pay realism. Fires when variable / performance
 * pay was mentioned but candidate never asked about payout history,
 * payout %, target vs. actual, last year's pay-out. */
const VARIABLE_MENTION_RE = /\b(variable (?:pay|component|comp|portion|bonus)|performance (?:bonus|pay|comp)|target bonus|target variable|incentive (?:pay|comp))\b/i;
const VARIABLE_PROBE_RE = /\b(payout (?:history|percentage|%|ratio|record|rate)|paid out|pay[- ]?out (?:last|previous|history|%)|% of target|target (?:bonus )?paid|hit rate|achievement (?:%|rate|history)|actual variable|actual payout|past year|last year|previous year|how much (?:was|did) (?:variable|payout|the bonus|the variable) (?:pay|hit|paid)|on[- ]?target earnings|ote\b)\b/i;

/* Phase 2 bonus — kernel-derived signal proxies from the transcript:
 *   VERBAL_ACCEPT_RE  → candidate said yes ("I'll take it", "sounds good
 *                       let's go", "I accept", "deal", "I'm in"). Pairs
 *                       with `closed_too_fast` when no counter was
 *                       extracted before this turn.
 *   OFFER_RECAP_REQ_RE → user asked the AI to recap the offer
 *                       AFTER it was on the table. Proxies
 *                       `lastAnswerOfferRecapAtTurn` from the kernel. */
const VERBAL_ACCEPT_RE = /\b(i(?:'ll| will) take (?:it|the offer)|i accept(?:\b| the offer)|i'?m (?:in|on board)|let'?s (?:do it|go ahead|move (?:forward|ahead))|that works for me|that(?:'s| is) (?:a deal|acceptable|fine|good)|deal\b|done deal|sounds (?:good|great), (?:i(?:'ll| will)|let'?s)|happy to (?:accept|join|sign))\b/i;
const OFFER_RECAP_REQ_RE = /\b(can you (?:recap|summari[sz]e|repeat|walk me through)|could you (?:recap|summari[sz]e|repeat|walk me through)|(?:please )?(?:recap|summari[sz]e) (?:the offer|the numbers|the package|what'?s on the table)|what'?s on the table|what (?:are|is) the (?:total|final) (?:offer|number|ctc)|run me through the offer|let me re[- ]?confirm|i(?:'?ve)? lost track|i(?:'?m)? confused about the (?:numbers|offer)|where did we land)\b/i;

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
  // v5 (Phase 1 of SCORE_IMPROVEMENT_PLAN section 2):
  //   - Wires CTC take-home (computeNewRegimeTaxLpa / computeOldRegimeTaxLpa)
  //     into a `meta.salaryNegotiation` block so the report can render
  //     in-hand monthly under both regimes on the offer card.
  //   - Surfaces `tierBucket` (+ label) on meta for header chip.
  //   - Coaching catalog expanded 5 → ~20 tips via CLUSTERS pattern
  //     (mirrors hr-round v4.5 / commit 06881b8).
  // v6 (Phase 2 of SCORE_IMPROVEMENT_PLAN section 2):
  //   - Wires `computeEquityGrant` from src/_equity-literacy.ts: when
  //     ESOP / RSU mentioned, computes vesting / cliff value / perq tax
  //     and surfaces on `meta.salaryNegotiation.equityLiteracy`. Flags
  //     `equity_terms_not_probed` when candidate didn't probe terms.
  //   - Wires `batnaStrength` from src/_negotiation-math.ts. Replaces
  //     binary BATNA detection with a 0..1 score + label (weak/moderate/
  //     strong). Drives `batna_weak_unsupported` flag.
  //   - Joining-bonus clawback detector. `joining_bonus_clawback_not_probed`
  //     fires when joining bonus mentioned + clawback / pro-rate /
  //     repayment never asked.
  //   - Variable-pay realism. `variable_pay_face_value_accepted` fires
  //     when candidate accepted variable comp without probing payout %.
  //   - Transcript-derived bonus detectors mapped to Phase-2 themes:
  //     `closed_too_fast` (verbal yes before any counter / pushback),
  //     `lost_track_of_offer` (candidate asks AI to recap the offer
  //     after it's already on the table — kernel-pair for
  //     lastAnswerOfferRecapAtTurn).
  //   - Skipped: `jargon_literacy_gap` + `variable_not_owned` from the
  //     kernel-bonus list — they require the negotiation kernel state
  //     (`lastAnswerClarificationAtTurn` / `variableInferred`) which
  //     isn't carried on SessionRowForAnalysis. Re-evaluate once kernel
  //     state is persisted onto the session row.
  version: "salary-negotiation-v7",

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
    /* Compose the analyzer's superset from the shared frustration subset
     * (single source of truth — the live planner uses the same subset
     * via USER_FRUSTRATION_RE). The analyzer-only cues ("i'm confused",
     * "wait what", "can you clarify") stay scoped here because they're
     * not necessarily looping signals — they merit post-session review
     * but shouldn't interrupt the live negotiation. */
    const USER_CONFUSION_RE = new RegExp(
      `${USER_FRUSTRATION_RE.source}|\\b(?:i'?m confused|i don'?t (?:understand|know what)|why don'?t you understand|what (?:are you saying|do you mean)|why are you (?:confusing|asking (?:again|the same|me the same))|this (?:doesn'?t make|isn'?t making) sense|you'?re confusing me|can you clarify|wait what|already (?:mentioned|told you|said)|i (?:told|mentioned) you (?:already|multiple times|before))\\b`,
      "i",
    );
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

    // --- 4c. Phase 2 — equity literacy, BATNA strength, joining-bonus
    //         clawback probe, variable-pay realism, transcript-derived
    //         kernel-state proxies (closed_too_fast / lost_track_of_offer).
    //
    //         Each block computes ONCE off the full userText / aiText /
    //         combined text and adds a flag + optional rubric gap +
    //         optional meta sub-field. Coaching tips live in section 5.
    const combinedText = `${userText} ${aiText}`;

    /* 2.1 — Equity grant literacy. Run iff equity vocabulary appears
     * anywhere (any speaker). Extract the largest face value seen in
     * an AI turn so we score the recruiter's quoted grant, not a
     * candidate's hypothetical. Classify rsu vs esop on the same text
     * window where the grant was named. */
    let equityLiteracyMeta: NonNullable<NonNullable<typeof result.meta>["salaryNegotiation"]>["equityLiteracy"] | undefined = undefined;
    const esopMentionedInSession = ESOP_MENTION_RE.test(combinedText) || /\b(equity|esop|rsu|stock|shares?|vesting|cliff)\b/i.test(combinedText);
    if (esopMentionedInSession) {
      // Find largest equity-grant face value across AI turns.
      let largestGrantLpa = 0;
      let grantTurnText = "";
      for (const turn of transcript) {
        if (!isAiTurn(turn)) continue;
        const text = turn.text || "";
        const m = EQUITY_GRANT_RE.exec(text);
        if (!m) continue;
        const v = parseFloat(m[1]!);
        const isCr = /cr/i.test(m[0]);
        const lpa = isCr ? v * 100 : v;
        if (lpa > largestGrantLpa) {
          largestGrantLpa = lpa;
          grantTurnText = text;
        }
      }
      if (largestGrantLpa > 0) {
        // Pick equity type from the turn where grant was named. Default
        // to esop unless RSU-specific tokens appear (covers Indian
        // unicorn / pre-IPO default — most common case).
        const equityType: "rsu" | "esop" = RSU_HINT_RE.test(grantTurnText) ? "rsu" : "esop";
        const grant = computeEquityGrant({
          totalGrantLpa: largestGrantLpa,
          equityType,
        });
        equityLiteracyMeta = {
          grantTotalLpa: Math.round(largestGrantLpa * 10) / 10,
          equityType,
          cliffRealisticLpa: grant.cliffRealisticLpa,
          halfVestRealisticLpa: grant.halfVestRealisticLpa,
          fullVestRealisticLpa: grant.fullVestRealisticLpa,
          perquisiteTaxAtFullVestLpa: grant.perquisiteTaxAtFullVestLpa,
          netAfterTaxLpa: grant.netAfterTaxLpa,
          realisticPctOfFace: grant.realisticPctOfFace,
        };
      }

      // equity_terms_not_probed — equity mentioned, but no probe of
      // cliff / FMV / strike / dilution / refresh / exercise window
      // anywhere in the user's turns. Only the candidate's probes count.
      const userProbedEquity = EQUITY_PROBE_RE.test(userText);
      if (!userProbedEquity && userTurnCount >= 2) {
        flags.add("equity_terms_not_probed");
        gaps.push({
          dimension: "equity_literacy",
          expected: "When equity grant is named, candidate probes vesting cliff, FMV vs. strike, dilution / refresh, post-exit exercise window",
          observed: "Equity / ESOP / RSU mentioned in session; candidate never asked about cliff, FMV, strike, dilution, refresh, or exercise window",
          severity: "medium",
        });
      }
    }

    /* 2.2 — BATNA strength. Parse the candidate's BATNA mentions into
     * CompetingOffer records and pass through batnaStrength(). Heuristics:
     *   inWriting   → "offer letter", "written offer", "in writing"
     *   peerTier    → mention of a peer-tier company name OR explicit
     *                 LPA figure (a verbal LPA without naming a company
     *                 already implies "moderate" — recruiter still has
     *                 to test it). Conservative default: false.
     *   ageDays     → 30 unless candidate says "stale", "old", "months
     *                 ago"; then 120. Fresh ("yesterday", "last week"):
     *                 7. Verbal "interview" with no offer → ageDays
     *                 doesn't matter because the offer is dropped.
     *   totalCtcLpa → first LPA extracted from a user turn that also
     *                 matched BATNA_RE; falls back to 0 if none. */
    let batnaMeta: NonNullable<NonNullable<typeof result.meta>["salaryNegotiation"]>["batnaStrength"] | undefined = undefined;
    if (userTurnCount >= 2) {
      const competing: CompetingOffer[] = [];
      const WRITTEN_RE = /\b(offer letter|written offer|in writing|sent (?:me )?the (?:offer|letter)|signed offer|formal offer in)\b/i;
      const FRESH_RE = /\b(yesterday|today|this week|last week|just got|just received|past few days)\b/i;
      const STALE_RE = /\b(months? ago|earlier this year|few months back|three months|four months|five months|six months)\b/i;
      // Per-user-turn parse: each user turn matching BATNA_RE counts
      // as a single competing-offer signal. Multiple distinct turns
      // → multiple offers (escalates the score).
      // Only treat an LPA as a competing-offer LPA when it appears
      // in a clause attached to BATNA vocabulary — not when the
      // candidate is naming their own target in the same turn. The
      // shape we want: "another offer at 32 LPA", "competing offer 35
      // LPA", "30 LPA at Company X". The shape we DON'T want:
      // "my target is 30 LPA, I'm also interviewing elsewhere" —
      // the 30 is the ask, not the BATNA.
      const BATNA_LPA_RE = /\b(?:(?:another|competing|other|alternative) offer (?:at |of |is |for )?|elsewhere (?:at |of |for |is )?|offer letter (?:at |of |for |is )?|written offer (?:at |of |for |is )?)(?:₹|inr\s*)?(\d{1,3}(?:\.\d{1,2})?)\s*(?:LPA|lakhs?|cr|crores?)/i;
      for (const turn of transcript) {
        if (!isUserTurn(turn)) continue;
        const text = turn.text || "";
        if (!BATNA_RE.test(text)) continue;
        // Pull an LPA figure ONLY when it's adjacent to BATNA vocab.
        let ctcLpa = 0;
        const lm = BATNA_LPA_RE.exec(text);
        if (lm) {
          const v = parseFloat(lm[1]!);
          const isCr = /cr/i.test(lm[0]);
          ctcLpa = isCr ? v * 100 : v;
        }
        const inWriting = WRITTEN_RE.test(text);
        // Peer-tier inferred when LPA was named AND looks plausible
        // (≥5 LPA, ≤500 LPA). Verbal-only without LPA stays false.
        const peerTier = ctcLpa >= 5 && ctcLpa <= 500;
        const ageDays = STALE_RE.test(text) ? 120 : FRESH_RE.test(text) ? 7 : 30;
        competing.push({ totalCtcLpa: ctcLpa, inWriting, peerTier, ageDays });
      }
      // Compute batna strength even when offers is empty — the helper
      // returns label "none" / score 0 and we surface a coaching anchor.
      const bs = batnaStrength(competing);
      batnaMeta = {
        score: bs.score,
        label: bs.label,
        rationale: bs.rationale,
        offerCount: competing.length,
      };

      // batna_weak_unsupported — fires when there IS some BATNA signal
      // in transcript but the strength is "weak" (verbal-only, no LPA,
      // no peer-tier name). Replaces binary detection of past versions.
      if (competing.length > 0 && bs.label === "weak") {
        flags.add("batna_weak_unsupported");
        gaps.push({
          dimension: "batna_quality",
          expected: "BATNA grounded in a written, peer-tier, recent competing offer (named company + LPA)",
          observed: `Detected ${competing.length} BATNA mention(s) but strength scored "${bs.label}" (${bs.score.toFixed(2)}). Verbal-only / unnamed offers don't move recruiters.`,
          severity: "medium",
        });
      }
    }

    /* 2.3 — Joining-bonus clawback. Fires only when joining bonus was
     * mentioned AND the candidate never asked about clawback / pro-rate
     * / repayment / hold period. Symmetric to HR-round's
     * `comp_breakup_probe_missing` but scoped to the joining-bonus
     * lever specifically. */
    if (JOINING_BONUS_RE.test(combinedText)) {
      const userAskedClawback = CLAWBACK_PROBE_RE.test(userText);
      if (!userAskedClawback && userTurnCount >= 2) {
        flags.add("joining_bonus_clawback_not_probed");
        gaps.push({
          dimension: "joining_bonus_literacy",
          expected: "Candidate asks about clawback period, pro-rate vs. cliff, and exit conditions before accepting a joining bonus",
          observed: "Joining / signing bonus mentioned; candidate never asked about clawback, pro-rate, repayment, or hold period",
          severity: "medium",
        });
      }
    }

    /* 2.4 — Variable-pay realism. Fires when variable / performance pay
     * was mentioned AND the candidate never probed payout history /
     * target-vs-actual / past year's hit rate. Indian candidates
     * routinely sign offers with 20-30% variable and discover later
     * that the team consistently pays out at 60-70% of target. */
    if (VARIABLE_MENTION_RE.test(combinedText)) {
      const userProbedVariable = VARIABLE_PROBE_RE.test(userText);
      if (!userProbedVariable && userTurnCount >= 2) {
        flags.add("variable_pay_face_value_accepted");
        gaps.push({
          dimension: "variable_pay_literacy",
          expected: "Candidate probes payout history (% of target paid last year, this team's hit rate) before accepting variable comp at face value",
          observed: "Variable / performance pay mentioned; candidate never asked about payout history, % of target paid, or hit rate",
          severity: "medium",
        });
      }
    }

    /* Bonus — closed_too_fast. Transcript-side proxy for
     * `verbalAcceptanceTurn` arriving before any meaningful counter
     * has been extracted. Fires when:
     *   - Candidate said an acceptance phrase (VERBAL_ACCEPT_RE) AND
     *   - No PUSHBACK_RE language from candidate ANYWHERE before that
     *     turn AND
     *   - At most one numeric AI claim before the acceptance (i.e. the
     *     candidate accepted the FIRST offer with no negotiation
     *     round-trip).
     * Pairs with the close cluster.  */
    {
      const acceptanceTurnIdx = transcript.findIndex(t => isUserTurn(t) && VERBAL_ACCEPT_RE.test(t.text || ""));
      if (acceptanceTurnIdx >= 0) {
        const userBefore = transcript.slice(0, acceptanceTurnIdx).filter(isUserTurn).map(t => t.text || "").join(" ");
        const aiClaimsBefore = claims.filter(c => isAiTurn(transcript[c.turn_idx]) && c.turn_idx < acceptanceTurnIdx);
        const pushbackBefore = PUSHBACK_RE.test(userBefore);
        if (!pushbackBefore && aiClaimsBefore.length <= 1 && userTurnCount >= 2) {
          flags.add("closed_too_fast");
          gaps.push({
            dimension: "close_pacing",
            expected: "Candidate runs at least one counter / pushback round before verbally accepting",
            observed: `Verbal acceptance at turn ${acceptanceTurnIdx + 1} after ${aiClaimsBefore.length} AI number(s) with no pushback language earlier in session — closed on the first offer.`,
            severity: "medium",
          });
        }
      }
    }

    /* Bonus — lost_track_of_offer. Transcript-side proxy for
     * `lastAnswerOfferRecapAtTurn`: user explicitly asks the AI to
     * recap / summarise / repeat the offer AFTER at least one AI
     * number has been put on the table. Signals candidate lost
     * the thread of the negotiation — pair with close cluster. */
    {
      const firstAiClaimIdx = claims.find(c => isAiTurn(transcript[c.turn_idx]))?.turn_idx ?? -1;
      if (firstAiClaimIdx >= 0) {
        const recapAt = transcript.findIndex((t, idx) =>
          idx > firstAiClaimIdx && isUserTurn(t) && OFFER_RECAP_REQ_RE.test(t.text || ""),
        );
        if (recapAt >= 0) {
          flags.add("lost_track_of_offer");
          gaps.push({
            dimension: "offer_tracking",
            expected: "Candidate tracks each component of the offer (base / variable / equity / joining / total) as it's quoted",
            observed: `User asked AI to recap the offer at turn ${recapAt + 1}, after numbers were already on the table at turn ${firstAiClaimIdx + 1}. Candidate lost track of components mid-negotiation.`,
            severity: "low",
          });
        }
      }
    }

    // --- 5. Coaching summary ---
    // v5: grouped into narrative clusters (discovery / anchoring /
    // counter / close). When ≥2 members of a cluster fire, lead with a
    // "Pattern, not isolated" line so the candidate sees the cluster
    // signal before the per-flag tips. Mirrors hr-round v4.5 pattern
    // (commit 06881b8).
    const tips: string[] = [];

    /* ── Coaching clusters (v5) ──
       Each cluster groups flags by negotiation phase so the report
       leads with phase framing when ≥2 flags in the same phase fire.
       Salary negotiation is scored as a sequence of moves, not as a
       bag of points — telling the candidate "two anchoring failures
       in one session" lands harder than two isolated one-liners. */
    const CLUSTERS: Array<{ label: string; theme: string; members: string[] }> = [
      {
        label: "discovery",
        theme: "discovery + comp-component awareness",
        members: [
          "equity_never_discussed",
          "joining_bonus_never_discussed",
          "notice_period_never_discussed",
          "equity_terms_not_probed",
          "joining_bonus_clawback_not_probed",
          "variable_pay_face_value_accepted",
        ],
      },
      {
        label: "anchoring",
        theme: "anchoring + opener",
        members: [
          "user_never_anchored",
          "user_below_band_underask",
          "user_moonshot_no_batna",
          "no_batna_articulated",
          "batna_weak_unsupported",
        ],
      },
      {
        label: "counter",
        theme: "counter quality + recruiter pushback",
        members: [
          "ai_accepted_without_pushback",
          "ai_silent_capitulation",
          "ai_no_counter_offered",
          "ai_offer_regression",
          "ai_unrealistic_close_above_predicted",
          "ai_under_close_below_predicted",
        ],
      },
      {
        label: "close",
        theme: "close + conversation repair",
        members: [
          "ai_misread_conditional_as_acceptance",
          "ai_ignored_user_complaint",
          "ai_didnt_answer_direct_question",
          "ai_consecutive_duplicate_question",
          "closed_too_fast",
          "lost_track_of_offer",
        ],
      },
    ];
    for (const cluster of CLUSTERS) {
      const hits = cluster.members.filter((m) => flags.has(m));
      if (hits.length >= 2) {
        tips.push(
          `Pattern, not isolated: ${hits.length} signals across ${cluster.theme} (${hits.slice(0, 4).join(", ")}). Indian recruiters read salary negotiation as a sequence — fix the ${cluster.label} phase as a whole, not the loudest single flag.`,
        );
      }
    }

    /* Per-flag tips. Order: voice / setup → anchoring → discovery →
       counter quality → conversation repair → hallucinations. Each
       reads as a single actionable line; together they cover the top
       ~20 flag clusters the analyzer emits today. */
    if (flags.has("ai_usism_drift")) {
      tips.push("AI hiring-manager voice slipped into US phrasing during the call — flag this as a quality issue if reviewing the transcript. Indian recruiters say 'leave' not 'PTO', 'joining bonus' not 'sign-on package'.");
    }
    if (flags.has("role_company_mismatch")) {
      tips.push("Role × company sector mismatch — the role you picked doesn't usually exist at this company tier. Re-pick before the real round, or your ask will be benchmarked against the wrong band.");
    }
    if (flags.has("stale_market_calibration")) {
      tips.push("Coaching benchmark is over 12 months stale — treat the numbers in this session as directional, not gospel. Pull a fresh band from Levels.fyi / AmbitionBox before your real call.");
    }
    if (flags.has("user_never_anchored")) {
      tips.push("Open with a researched target range — letting the recruiter quote first costs you 10–20% leverage. Indian template: 'Based on my research for this level / location, I'm targeting ₹X-Y total.'");
    }
    if (flags.has("user_below_band_underask")) {
      tips.push("Your ask was below the documented band-min — that's leaving 15–30% on the table. The recruiter will close at-or-below your number; they never raise you above your stated ask.");
    }
    if (flags.has("user_moonshot_no_batna")) {
      tips.push("Asking above band-max without articulating a competing offer or scope rationale reads as anchored-on-a-whim. Either name the BATNA (₹X at Company Y, hard deadline) or pin the moonshot to a concrete scope expansion.");
    }
    if (flags.has("no_batna_articulated")) {
      tips.push("Reference an alternative offer or clear walk-away point. BATNA is what makes negotiation real — without one, every 'I'd need a stretch' reads as wish, not constraint.");
    }
    if (flags.has("equity_never_discussed")) {
      tips.push("Equity is often the largest lever at senior levels. Ask: vesting cliff (1-yr standard), grant face value vs. FMV, refresh policy, post-exit exercise window. Pre-IPO ESOP at face value is a ~70% paper number.");
    }
    if (flags.has("joining_bonus_never_discussed")) {
      tips.push("Joining bonus / sign-on can recover gap when base is capped. Always ask: amount, clawback period (1-yr or 2-yr is common), pro-rated or cliff. A ₹5L joining bonus with 2-yr cliff is ₹0 if you leave in 18 months.");
    }
    if (flags.has("notice_period_never_discussed")) {
      tips.push("Notice period costs real money — most Indian roles are 60-90 days. Ask about buyout, gardening leave, partial early release. A 90-day buyout at your current CTC can be ₹6-15L the new company eats.");
    }
    if (flags.has("ai_accepted_without_pushback")) {
      tips.push("Recruiter accepted your first number with no probe — in a real call this almost never happens. Treat the simulated outcome as artificially friendly; in reality expect 'let me check with the panel' + a counter 8-15% below your ask.");
    }
    if (flags.has("ai_silent_capitulation")) {
      tips.push("Recruiter matched your ask without ever saying it was above market. That's an LLM artifact — a real Indian recruiter pushes back at least once ('the band tops at ₹X'). Don't take the simulated close as proof your ask was reasonable.");
    }
    if (flags.has("ai_no_counter_offered")) {
      tips.push("Across the whole session the recruiter never produced a numeric counter — that means YOU never extracted a real number. Block on 'Give me your best within the band' early, or you'll get coached against a phantom offer.");
    }
    if (flags.has("ai_offer_regression")) {
      tips.push("Recruiter walked back an earlier higher number without saying 'I misspoke / let me revise' — that's an LLM bug, real recruiters never silently regress. In a real call, anchor on the FIRST number they name and treat any drop as bad faith.");
    }
    if (flags.has("ai_unrealistic_close_above_predicted") || flags.has("ai_under_close_below_predicted")) {
      tips.push("The simulated close landed outside the predicted realistic zone for this tier. Take the headline number with skepticism — focus on the moves you made (anchoring, BATNA, lever exploration), not the dollar outcome.");
    }
    if (flags.has("ai_self_contradiction") || flags.has("offer_components_inconsistent")) {
      tips.push("Recruiter contradicted itself within a turn (different numbers, components that don't sum). In a real call this is your cue: 'Help me reconcile — earlier you said ₹X, now ₹Y. Which is the firm number?' Forces the recruiter to commit.");
    }
    if (flags.has("ai_misread_conditional_as_acceptance")) {
      tips.push("You said 'IF you can do X, I'd take it' — the simulated recruiter treated that as a definite yes. In a real call, conditionals get probed ('which condition is most important?'). Be ready: don't drop a conditional unless you mean to commit on it.");
    }
    if (flags.has("ai_ignored_user_complaint") || flags.has("ai_didnt_answer_direct_question")) {
      tips.push("You asked a direct question or expressed confusion and the recruiter pivoted away. In a real call, repeat the ask once more, then drop the silence — 'I want to understand the offer before going further' forces a recap.");
    }
    if (flags.has("ai_phrase_repetition") || flags.has("ai_consecutive_duplicate_question")) {
      tips.push("Recruiter looped — same phrase / same question twice. That's an LLM stutter, not a real-world signal. In a real call, an interviewer repeating the same line means you missed something; here it just means re-run the session for a clean scoring.");
    }
    if (flags.has("ai_reversed_range")) {
      tips.push("Recruiter quoted a reversed range (₹12 to ₹8.5 LPA) — that's an LLM artifact. Read it as the corrected band ₹8.5-₹12 LPA and price your ask accordingly.");
    }
    if (flags.has("ai_arithmetic_error")) {
      tips.push("Recruiter's monthly take-home math was outside the plausible range for the stated CTC. Sanity check: for new regime FY 2025-26, expect ~₹3.5-5.5k monthly per LPA of CTC. Verify the recruiter's monthly figure in any real call before signing.");
    }
    if (flags.has("implausible_salary_claim") || flags.has("above_role_band")) {
      tips.push("Recruiter quoted a number outside the realistic band for this role + company. That's hallucination — don't anchor on it. Use Levels.fyi / company override data, not the simulated ceiling.");
    }
    // Phase 2 per-flag tips.
    if (flags.has("equity_terms_not_probed")) {
      tips.push("Equity was on the table but you didn't probe the terms that determine its real value: vesting cliff (1-yr standard, 0 if you exit early), strike vs. FMV (zero-strike ESOP is fully taxable as perq at exercise), refresh cycle, and post-exit exercise window. A pre-IPO ESOP at face value is roughly 30% real — ask the questions before signing.");
    }
    if (flags.has("batna_weak_unsupported")) {
      tips.push("You hinted at a BATNA but it scored 'weak' — verbal-only, no LPA, no named peer-tier company. Recruiters test weak BATNAs first. Either upgrade your reference (written peer-tier offer + LPA + decision deadline) or drop the BATNA framing and lead with role-fit + market data instead.");
    }
    if (flags.has("joining_bonus_clawback_not_probed")) {
      tips.push("Joining bonus came up but you didn't ask about clawback terms. Indian standard is 1-yr or 2-yr cliff with full repayment if you exit early — a ₹5L joining bonus is ₹0 if you leave in 18 months on a 2-yr cliff. Always ask: clawback period, pro-rate vs. cliff, what triggers repayment (resignation vs. termination-for-cause).");
    }
    if (flags.has("variable_pay_face_value_accepted")) {
      tips.push("You accepted variable comp at face value without asking how much actually pays out. Indian product teams routinely pay out variable at 60-80% of target; some BFSI / consulting practices hit 100-120%. The right question: 'What's the average % of target paid out across this team in the last two cycles?' — face value is a marketing number.");
    }
    if (flags.has("closed_too_fast")) {
      tips.push("You verbally accepted on the first offer with no counter round. In Indian recruiting that signals you were under-prepped — recruiters always have 8-15% headroom they only release when asked. Even if the offer looks good, ask 'Is there room on the joining bonus / signing / equity refresh?' before saying yes.");
    }
    if (flags.has("lost_track_of_offer")) {
      tips.push("You asked the recruiter to recap the offer mid-negotiation — that signals you lost the thread. Before the call, write down a 5-line table: base / variable / joining / equity / total. Update it live as numbers move. Walking into a real call with that table on screen is the single highest-leverage prep step.");
    }

    /* ── Phase 1.1 — CTC take-home breakdown ──
       Wire computeNewRegimeTaxLpa + computeOldRegimeTaxLpa into a
       meta block so the report can render in-hand monthly under
       both regimes on the offer card. Computed off the closing AI
       offer (most-recent AI claim); skipped when no offer exists. */
    const aiClaimsForMeta = claims.filter((c) => isAiTurn(transcript[c.turn_idx]));
    const closingClaim = aiClaimsForMeta.length > 0 ? aiClaimsForMeta[aiClaimsForMeta.length - 1] : null;
    const tier = tierBucket(session.target_company || undefined);
    const tierLabel = tier ? TIER_BUCKET_LABEL[tier] : undefined;

    let monthlyNew: number | null = null;
    let monthlyOld: number | null = null;
    let annualTaxNew: number | null = null;
    let annualTaxOld: number | null = null;
    let closingTotalLpa: number | null = null;
    if (closingClaim && closingClaim.lpa >= GLOBAL_LPA_MIN && closingClaim.lpa <= GLOBAL_LPA_MAX) {
      closingTotalLpa = Math.round(closingClaim.lpa * 10) / 10;
      // Cash CTC ≈ stated minus equity (assume cash-only for the offer-card
      // line since transcript regex doesn't reliably split equity), minus
      // the 18% benefits loading the helper bakes in. Variable defaults to
      // 12% with tier-aware payout factor.
      const benefitsLoading = 0.18;
      const variablePct = 0.12;
      const payoutFactor = variablePayoutFactorForTier(
        // Map analyzer tier to the helper's tier enum. Listed/big-tech →
        // listed; mature_unicorn → mature_unicorn; etc.
        tier === "listed_big_tech" ? "listed"
        : tier === "listed_unicorn" ? "listed"
        : tier === "mature_unicorn" ? "mature_unicorn"
        : tier === "growth_startup" ? "growth_startup"
        : tier === "early_startup" ? "early_startup"
        : tier === "it_services" ? "it_services"
        : tier === "bfsi" ? "bfsi"
        : tier === "fmcg" ? "fmcg"
        : tier === "psu" ? "psu"
        : undefined,
      );
      const cashCtc = closingTotalLpa / (1 + benefitsLoading);
      const variableTarget = cashCtc * variablePct;
      const variableRealistic = variableTarget * payoutFactor;
      const fixedCash = cashCtc - variableTarget;
      const employeeEpf = fixedCash * 0.50 * 0.12;

      // New regime
      const taxableNew = Math.max(0, fixedCash + variableRealistic - 0.75 - employeeEpf);
      annualTaxNew = Math.round(computeNewRegimeTaxLpa(taxableNew) * 10) / 10;
      const takeHomeNew = Math.max(0, fixedCash + variableRealistic - employeeEpf - annualTaxNew);
      monthlyNew = Math.round(((takeHomeNew * 100000) / 12) / 100) * 100;

      // Old regime
      const taxableOld = Math.max(0, fixedCash + variableRealistic - 0.50 - employeeEpf);
      annualTaxOld = Math.round(computeOldRegimeTaxLpa(taxableOld) * 10) / 10;
      const takeHomeOld = Math.max(0, fixedCash + variableRealistic - employeeEpf - annualTaxOld);
      monthlyOld = Math.round(((takeHomeOld * 100000) / 12) / 100) * 100;
    }

    result.hallucinations = hallucinations;
    result.rubricGaps = gaps;
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    // Always emit a meta block (even partial) so the report's header
    // chip can render the tier band the session was scored against —
    // independent of whether a closing offer was extracted.
    // v6 — emit meta when ANY of tier / closing / equity / batna populated.
    // Earlier versions skipped meta on unknown-tier sessions; with v6 we
    // still want to surface equity literacy or batna strength if those
    // ran, so the report's batna / equity cards have something to show.
    /* Phase 3 — surface the Indian recruiter sector persona for this
     * session (derived purely from tierBucket; no band shape on the
     * analyzer side, since the analyzer doesn't carry NegotiationBand).
     * Always computed — falls through to "default" when the tier isn't
     * recognised. Surfaced as a small chip next to the tier-band chip
     * in NegotiationFullReport. */
    const recruiterPersonaId: RecruiterSectorPersona = selectRecruiterSectorPersona({
      tierBucket: tier ?? null,
      company: session.target_company ?? null,
    });
    const recruiterPersonaLabel = getRecruiterSectorPersona(recruiterPersonaId).displayName;

    if (tier || closingTotalLpa !== null || equityLiteracyMeta || batnaMeta) {
      result.meta = {
        ...(result.meta ?? {}),
        salaryNegotiation: {
          tierBucket: tier,
          tierBucketLabel: tierLabel,
          closingTotalLpa,
          monthlyTakeHomeNewRegimeInr: monthlyNew,
          monthlyTakeHomeOldRegimeInr: monthlyOld,
          annualTaxNewRegimeLpa: annualTaxNew,
          annualTaxOldRegimeLpa: annualTaxOld,
          equityLiteracy: equityLiteracyMeta ?? null,
          batnaStrength: batnaMeta ?? null,
          recruiterPersona: recruiterPersonaId,
          recruiterPersonaLabel,
        },
      };
    }
    return result;
  },
};
