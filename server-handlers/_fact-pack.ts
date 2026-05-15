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
  gratuityRule: "15 days × years of service, paid after 5-year cliff (Payment of Gratuity Act).",
  pfRule: "12% employer + 12% employee contribution on basic salary (EPF).",
  sec87aRebate: "Section 87A rebate up to ₹25,000 (income up to ₹7L taxable under the new regime).",
  rsuStandard: "Standard RSU schedule: 4-year vest, 1-year cliff, quarterly thereafter.",
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
  else if (/\b(notice|join|joining|buyout|last working day)\b/.test(lower)) intent = "joining";
  else if (/\b(team|report|manager|reporting to|hierarchy)\b/.test(lower)) intent = "team";
  else if (/\b(gratuity|pf|epf|tax|87a|rebate)\b/.test(lower)) intent = "policy";
  else if (/\b(equity|rsu|esop|vesting|stock)\b/.test(lower)) intent = "equity";
  else if (/\b(perk|benefit|insurance|leave|wellness)\b/.test(lower)) intent = "benefits";
  else if (/\b(hike|raise|cycle|appraisal)\b/.test(lower)) intent = "hike";

  return { asked: true, raw: trimmed.slice(0, 240), intent };
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
