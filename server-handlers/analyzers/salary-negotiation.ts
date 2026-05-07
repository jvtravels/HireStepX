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
import { generateNegotiationBand } from "../../data/salary-lookup";
import { getCompanyBandOverride } from "../../data/company-salary-overrides";
import { matchRoleKey } from "../../data/salaries";

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
          // 25% tolerance above the company-specific totalMax — captures
          // bonus / equity scenarios without flagging clearly inflated offers.
          roleAwareCeiling = override.totalMax * 1.25;
          bandContextLabel = `${session.target_role} at ${session.target_company} — verified band caps at ${override.totalMax.toFixed(1)} LPA (${override.source})`;
        } else {
          const band = generateNegotiationBand({
            role: session.target_role,
            company: session.target_company || undefined,
            experienceLevel: session.difficulty || undefined,
          });
          // Without a verified override, use maxStretch (the manager's true
          // upper bound) instead of walkAway (which is what they'd let the
          // candidate walk before — much higher and far too lenient).
          roleAwareCeiling = band.maxStretch * 1.15;
          bandContextLabel = `${session.target_role}${session.target_company ? ` at ${session.target_company}` : ""} — tier-default max at ${band.maxStretch.toFixed(1)} LPA`;
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
    // The Yellow Slice case: "that's the absolute top of what I can approve"
    // repeated 4 times in a single AI turn. LLM generation loop. Catastrophic.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!isAiTurn(t)) continue;
      const text = t.text || "";
      // Find any 5-word window that repeats ≥3 times in the same turn.
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length < 15) continue;
      const seen = new Map<string, number>();
      const WINDOW = 5;
      for (let j = 0; j + WINDOW <= words.length; j++) {
        const phrase = words.slice(j, j + WINDOW).join(" ").toLowerCase();
        if (phrase.length < 18) continue;
        seen.set(phrase, (seen.get(phrase) || 0) + 1);
      }
      const repeated = Array.from(seen.entries()).find(([_, count]) => count >= 3);
      if (repeated) {
        hallucinations.push({
          turn_idx: i,
          type: "ai_phrase_repetition",
          evidence: `AI repeated phrase "${repeated[0]}" ${repeated[1]} times in one turn — generation loop`,
          severity: "high",
        });
        flags.add("ai_phrase_repetition");
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
    const USER_CONFUSION_RE = /\b(i'?m confused|i don'?t (?:understand|know what)|what (?:are you saying|do you mean)|why are you confusing|this (?:doesn'?t make|isn'?t making) sense|you'?re confusing me|can you clarify|wait what)\b/i;
    const PREMATURE_CLOSE_RE = /\b(thanks?\s+\w*[,.!]?\s*(?:i'?ll connect|i'?ll send|formal offer|expect the (?:formal|final) offer|hr will|rest of your day|joining the team|welcome (?:aboard|to))|excited about (?:the possibility of you|having you))\b/i;
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!isUserTurn(t)) continue;
      if (!USER_CONFUSION_RE.test(t.text || "")) continue;
      const nextAi = transcript.slice(i + 1, i + 3).find(isAiTurn);
      if (nextAi && PREMATURE_CLOSE_RE.test(nextAi.text || "")) {
        flags.add("ai_ignored_user_complaint");
        gaps.push({
          dimension: "conversation_repair",
          expected: "When user expresses confusion, AI must stop and clarify the offer with explicit numbers — not close the deal",
          observed: "User said they were confused; AI moved straight to closing language",
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
