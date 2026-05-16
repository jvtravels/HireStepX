/* Fact pack for off-script candidate questions (2026-05-16).
 *
 * When the candidate asks something the bot wasn't planning to address
 * (e.g. "What's the WFH policy?", "How does gratuity work here?"), the
 * LLM cannot be allowed to invent an answer — that's the canonical
 * hallucination path. Instead the kernel assembles a FactPack: a
 * curated, conservative bundle of facts pulled from state (what the
 * candidate has disclosed) plus a fixed Indian-market reference table
 * (gratuity, PF, RSU vest, BFSI cycle). The LLM may answer ONLY from
 * the factPack. If a fact is missing, it must defer gracefully and
 * the kernel resumes the planned action.
 *
 * Pure. No clock, no IO, no LLM.
 */

import type {
  NegotiationState,
  MarketMode,
  NegotiationPhase,
} from "./_negotiation-kernel";

/** Static Indian-market reference facts. Always available in the
 *  factPack — these are general knowledge any competent recruiter
 *  should be able to surface on request. Conservative phrasing so
 *  the LLM can't extrapolate to a number it shouldn't. */
export const INDIAN_MARKET_FACTS = Object.freeze({
  /* ─── Compensation mechanics ─── */
  gratuityRule: "15 days × years of service, paid after 5-year cliff (Payment of Gratuity Act).",
  pfRule: "12% employer + 12% employee contribution on basic salary (EPF).",
  joiningBonusClawback: "Joining bonus typically carries a 12-month clawback — full recovery if you exit before 12 months, prorated thereafter.",
  retentionBonusStandard: "Retention bonuses are normally split across 12-24 months and forfeit on early exit, separate from the joining-bonus clawback.",
  rsuCliffMnc: "MNC RSU schedule: 4-year vest, 1-year cliff, quarterly thereafter; refresh grants land at the annual cycle.",
  rsuStartup: "Indian startup ESOPs: typically 4-year vest, 1-year cliff, exercise window of 90 days to 10 years depending on policy.",
  variableSplitNorms: "Indian variable splits: IT services ~10-15%, product cos ~20-30%, sales/BFSI ~30-40% of CTC.",
  rsuStandard: "Standard RSU schedule: 4-year vest, 1-year cliff, quarterly thereafter.",
  /* ─── Benefits ─── */
  groupMedicalFloater: "Group medical: ₹5L family floater is the standard for product cos; ₹3L floater is the IT-services baseline.",
  parentalInsurance: "Parental insurance is usually a top-up the candidate co-pays (₹2-4L sum insured, premium split 50-50 with employer).",
  esicCoverage: "ESIC applies up to ₹21,000/month gross — most knowledge-worker offers fall above the ceiling and rely on group medical instead.",
  mealVouchers: "Meal vouchers (Sodexo/Zeta): up to ₹2,200/month tax-free under the food-coupon FBP head.",
  /* ─── Process ─── */
  bgvTimeline: "Background verification runs through FirstAdvantage or AuthBridge — typical clear in 2-4 weeks.",
  bgvScope: "BGV scope: education, employment (last 2-3 employers), address, criminal, and a database check; comp-history flagged only for last employer.",
  relievingLetterRisk: "Relieving letter from the immediate prior employer is a hard requirement at most IT/services/BFSI cos — affidavit + payslips accepted only as an exception.",
  form16Requirement: "Form-16 of the last completed financial year is asked alongside payslips for income / CTC validation.",
  pfUanTransfer: "UAN stays constant across jobs; PF transfer takes 30-45 days through the EPFO unified portal.",
  joiningDateConvention: "Joining dates are typically the 1st, 15th, or the first Monday — payroll systems align with these slots.",
  noticeBuyoutPolicy: "Notice buyout: IT services rarely allow buyout (60-90 day lock), product cos and BFSI commonly accept buyout funded by the joining bonus.",
  bondPolicy: "Service bonds: 1-2 years standard at IT services / training-heavy roles; break clause typically ₹50K-₹2L. Most product cos do not enforce bonds.",
  /* ─── Tax (new regime, applicable defaults) ─── */
  taxRegimeNew7L: "New tax regime: Section 87A rebate makes income up to ₹7L effectively zero tax.",
  taxRegimeAt15L: "New regime at ₹15L CTC: effective tax ~₹1.2-1.5L depending on standard-deduction and structure.",
  taxRegimeAt25L: "New regime at ₹25L CTC: effective tax ~₹4.5-5L; little benefit from old-regime exemptions at this band.",
  sec87aRebate: "Section 87A rebate up to ₹25,000 (income up to ₹7L taxable under the new regime).",
  /* ─── Leverage / market context ─── */
  appraisalAnchor: "Most Indian appraisal cycles anchor in March-April; mid-year corrections at top product cos in September-October.",
  marchCycle: "BFSI/IT-services follow a March performance cycle with hikes effective April; bonus is locked till March payout.",
  variablePayoutCadence: "Variable payout cadence: BFSI/sales quarterly, IT services half-yearly, product cos annual at appraisal.",
  bfsiCycle: "BFSI follows a March performance cycle with hikes typically effective April.",
}) satisfies Readonly<Record<string, string>>;

export type IndianMarketFacts = typeof INDIAN_MARKET_FACTS;

export interface FactPack {
  role: string;
  company: string;
  marketMode: MarketMode;
  phase: NegotiationPhase;
  /* Facts only present if disclosed in state. */
  candidateCurrentCtc?: number;
  candidateExpectedCtc?: number;
  budgetBand?: { low: number; high: number; walk: number };
  /* Indian-market reference facts (always available). */
  marketFacts: IndianMarketFacts;
  /* Role-specific facts (when known). Most sessions won't have these
   * — the LLM is instructed to defer when absent. */
  workMode?: "remote" | "hybrid" | "office";
  joiningWindow?: string;
  reportingTo?: string;
  teamSize?: number;
}

/** Build a factPack from current kernel state. Pure. */
export function buildFactPack(
  state: NegotiationState,
  _candidateQuestion?: string,
): FactPack {
  const pack: FactPack = {
    role: state.role || "",
    company: state.company || "",
    marketMode: state.marketMode,
    phase: state.phase,
    marketFacts: INDIAN_MARKET_FACTS,
  };

  if (state.candidateCurrentCtc != null && state.candidateCurrentCtc > 0) {
    pack.candidateCurrentCtc = state.candidateCurrentCtc;
  }
  if (state.candidateTarget != null && state.candidateTarget > 0) {
    pack.candidateExpectedCtc = state.candidateTarget;
  }
  if (state.band) {
    pack.budgetBand = {
      low: state.band.initialOffer,
      high: state.band.maxStretch,
      walk: state.band.walkAway,
    };
  }

  /* Role-specific facts: first-class typed fields on NegotiationState
   * (kernel-first cleanup 2026-05-16). Absent (null) → factPack omits
   * them and the LLM is instructed to defer. */
  if (state.workMode) pack.workMode = state.workMode;
  if (state.joiningWindow) pack.joiningWindow = state.joiningWindow;
  if (state.reportingTo) pack.reportingTo = state.reportingTo;
  if (typeof state.teamSize === "number") pack.teamSize = state.teamSize;

  return pack;
}

/* ─── candidate-question detection ──────────────────────────────────
 *
 * Conservative heuristic. Triggers on:
 *   - trailing "?"
 *   - leading wh-word ("what", "how", "when", "where", "who", "why")
 *   - leading "can you", "could you", "do you", "is the", "are you",
 *     "tell me about"
 *
 * Filters out rhetorical / embedded constructions ("I was thinking,
 * what if...") via a soft check: if a question word is preceded by
 * "thinking", "wondering", "guess", "suppose", "imagine", "wonder if"
 * we don't treat it as a direct question.
 */
const Q_LEAD_RE =
  /^\s*(?:what|how|when|where|who|why|can you|could you|do you|is the|are you|tell me about)\b/i;

const RHETORICAL_BEFORE_RE =
  /\b(thinking|wondering|wonder|guess|suppose|imagine|just|maybe)\b[^.?!]*?\b(what|how|when|where|who|why)\b/i;

export function detectCandidateAskedQuestion(reply: string): {
  asked: boolean;
  raw?: string;
  intent?: string;
} {
  if (!reply) return { asked: false };
  const trimmed = reply.trim();
  if (!trimmed) return { asked: false };

  /* Rhetorical filter — fire BEFORE the positive checks. */
  if (RHETORICAL_BEFORE_RE.test(trimmed) && !/\?\s*$/.test(trimmed)) {
    return { asked: false };
  }

  const trailingQ = /\?\s*$/.test(trimmed);
  const leadingQ = Q_LEAD_RE.test(trimmed);
  if (!trailingQ && !leadingQ) return { asked: false };

  /* Best-effort intent tag — coarse buckets the answer pipeline can
   * branch on without needing an LLM classifier. */
  const lower = trimmed.toLowerCase();
  let intent: string | undefined;
  if (/\b(wfh|work from home|remote|hybrid|office)\b/.test(lower)) intent = "work-mode";
  else if (/\b(clawback|prorat|prorated)\b/.test(lower)) intent = "clawback";
  else if (/\b(retention\s*bonus|retention)\b/.test(lower)) intent = "retention";
  else if (/\b(bgv|background\s*verif|relieving|form\s*-?\s*16)\b/.test(lower)) intent = "bgv";
  else if (/\b(medical|insurance|floater|esic|parental\s*insurance)\b/.test(lower)) intent = "insurance";
  else if (/\b(meal\s*voucher|sodexo|fbp)\b/.test(lower)) intent = "fbp";
  else if (/\b(pf|epf|uan|provident)\b/.test(lower)) intent = "pf";
  else if (/\b(notice|join|joining|buyout|last working day)\b/.test(lower)) intent = "joining";
  else if (/\b(team|report|manager|reporting to|hierarchy)\b/.test(lower)) intent = "team";
  else if (/\b(tax|87a|rebate|regime)\b/.test(lower)) intent = "tax";
  else if (/\b(gratuity)\b/.test(lower)) intent = "policy";
  else if (/\b(equity|rsu|esop|vesting|stock)\b/.test(lower)) intent = "equity";
  else if (/\b(perk|benefit|leave|wellness)\b/.test(lower)) intent = "benefits";
  else if (/\b(appraisal|march\s*cycle|hike\s*cycle)\b/.test(lower)) intent = "appraisal";
  else if (/\b(hike|raise|cycle)\b/.test(lower)) intent = "hike";

  return { asked: true, raw: trimmed.slice(0, 240), intent };
}

/** Coarse intent classifier for a candidate question. Returns one of
 *  the documented buckets ("wfh" | "team" | "reporting" | "growth-path"
 *  | "perf-cycle" | "equity" | "joining" | "perks" | "process" | "tax"
 *  | "documents") or null. Pure regex match — caller decides what to do
 *  with the bucket. Used both by `detectCandidateAskedQuestion` (above)
 *  and by `_negotiation-kernel.ts:computeTurnDelta` to tag the
 *  structured `candidateAskedQuestion` field on TurnDelta. */
export function classifyQuestionIntent(question: string): string | null {
  const q = (question || "").toLowerCase();
  if (/wfh|work.from.home|remote|hybrid|office/.test(q)) return "wfh";
  if (/team.size|how many|team structure|how big/.test(q)) return "team";
  if (/report|manager|who.*report|reporting to|hierarchy/.test(q)) return "reporting";
  if (/growth|career path|progression/.test(q)) return "growth-path";
  if (/clawback|prorat/.test(q)) return "clawback";
  if (/retention\s*bonus|retention/.test(q)) return "retention";
  if (/appraisal|march\s*cycle|hike\s*cycle/.test(q)) return "appraisal";
  if (/perf.*cycle|review.*cycle/.test(q)) return "perf-cycle";
  if (/esop|equity|rsu|stock|vesting/.test(q)) return "equity";
  if (/joining|notice|start.*date|when.*join|buyout|last working day/.test(q)) return "joining";
  if (/medical|insurance|floater|esic|parental.*insurance/.test(q)) return "insurance";
  if (/meal.*voucher|sodexo|fbp/.test(q)) return "fbp";
  if (/uan|pf\b|epf|provident/.test(q)) return "pf";
  if (/perk|benefit|gratuity|leave|wellness/.test(q)) return "perks";
  if (/process|interview|next.*round/.test(q)) return "process";
  if (/tax|87a|deduction|new.regime|old.regime|rebate|regime/.test(q)) return "tax";
  if (/bgv|background.*verif(?:y|ication)/.test(q)) return "bgv";
  if (/relieving|form.16|payslip|document/.test(q)) return "documents";
  return null;
}

/** Inspect the question + fact-pack and return which factPack keys are
 *  needed to answer. Returns canAnswer=true if all required keys are
 *  present, false if at least one is missing. The `missing` array
 *  lists the keys the LLM would need. */
export function detectFactGap(
  factPack: FactPack,
  candidateQuestion: string,
): { missing: string[]; canAnswer: boolean } {
  const q = (candidateQuestion || "").toLowerCase();
  /* Market-fact topics — always answerable from INDIAN_MARKET_FACTS, no
   * state-bound facts required. If the question matches any of these, we
   * short-circuit and skip the required-key check. */
  const MARKET_FACT_TOPICS = [
    /\bclawback\b/, /\bretention\s*bonus\b/, /\bmedical\b/, /\binsurance\b/,
    /\bfloater\b/, /\besic\b/, /\bmeal\s*voucher\b/, /\bsodexo\b/,
    /\bpf\b/, /\bepf\b/, /\buan\b/, /\bprovident\b/,
    /\bbgv\b/, /\bbackground\s*verif/, /\brelieving\b/, /\bform\s*-?\s*16\b/,
    /\bgratuity\b/, /\bbuyout\s*(policy|allowed|rule)?\b/, /\bbond\b/,
    /\btax\s*regime\b/, /\bnew\s*regime\b/, /\bold\s*regime\b/,
    /\b87a\b/, /\bappraisal\s*(cycle|anchor)\b/, /\bmarch\s*cycle\b/,
    /\brsu\s*(cliff|vest)\b/, /\bvariable\s*split\b/,
  ];
  if (MARKET_FACT_TOPICS.some((re) => re.test(q))) {
    return { missing: [], canAnswer: true };
  }
  const required: Array<{ pattern: RegExp; key: keyof FactPack }> = [
    { pattern: /\b(wfh|work from home|remote|hybrid|office)\b/, key: "workMode" },
    { pattern: /\b(join|joining|notice|when can you start|last working day)\b/, key: "joiningWindow" },
    { pattern: /\b(team|team size|how many|how big)\b/, key: "teamSize" },
    { pattern: /\b(report|reporting|manager|reporting to)\b/, key: "reportingTo" },
  ];
  const missing: string[] = [];
  for (const { pattern, key } of required) {
    if (pattern.test(q) && factPack[key] == null) {
      missing.push(key);
    }
  }
  return { missing, canAnswer: missing.length === 0 };
}
