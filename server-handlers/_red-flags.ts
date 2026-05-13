/* Salary-negotiation red-flag detector — Phase 18 (2026-05-13).
 *
 * The 19-scenario audit produced a 14-item list of recruiter red
 * flags. We split them into three families:
 *
 *   1. State-derived — derivable from existing NegotiationState
 *      (e.g. "doesn't know current CTC" = `candidateCurrentCtc === null`
 *      after the candidate has been asked).
 *
 *   2. Stance-derived — fired by `_candidate-stance.ts` (badmouth,
 *      desperation, confidential overshare, treats-equity-as-cash,
 *      salary-only-factor).
 *
 *   3. Composite — require correlating multiple kernel fields
 *      (e.g. "huge hike without rationale" = hike > 40% AND
 *      no rationale, "confuses CTC with in-hand" = candidate stated
 *      a monthly figure inside an annual context).
 *
 * Each red flag has a SEVERITY:
 *   - "info"     — worth noting in the brief
 *   - "concern"  — recruiter should probe / soften
 *   - "blocker"  — recruiter should pause and verify (lies, etc.)
 *
 * Red flags are NOT folded into state. They're computed fresh each
 * turn so the brief always reflects the current view; if a flag is
 * resolved (e.g. candidate later supplies the missing breakup), the
 * flag silently disappears. */

import type { NegotiationState } from "./_negotiation-kernel";
import type { CandidateStanceResult } from "./_candidate-stance";
import { extractSalesOTE, extractContractRate } from "./_comp-structure";

export type RedFlagCode =
  | "no-current-ctc"
  | "no-fixed-variable-breakup"
  | "ctc-inhand-confusion"
  | "huge-hike-no-rationale"
  | "salary-only-factor"
  | "lies-about-offer"
  | "overcommits-joining"
  | "sounds-desperate"
  | "badmouths-current"
  | "shares-confidential"
  | "demands-no-flex"
  | "treats-equity-as-cash"
  | "ignores-variable-risk"
  | "verbal-accept-no-breakup"
  /* Phase 19 — corpus-derived red flags. */
  | "avoids-anchor"
  | "personal-expense-justification"
  | "offer-shopping"
  /* Phase 22 — comp-structure red flags (sales OTE + contract rate). */
  | "ote-as-guaranteed"
  | "no-attainment-history"
  | "day-rate-fte-confusion"
  /* Phase 25 — drift / pivot / disclosure / rigidity. */
  | "target-drifted-upward"
  | "domain-pivot-full-rate"
  | "compensation-history-issue"
  | "rigid-no-range"
  | "offer-no-company-disclosure";

export type RedFlagSeverity = "info" | "concern" | "blocker";

export interface RedFlag {
  code: RedFlagCode;
  severity: RedFlagSeverity;
  /** Short human-readable rationale for the brief. */
  detail: string;
  /** Phase 20 — pedagogical "say this instead" example. Concrete
   *  candidate-side rewrite that turns the red-flag utterance into a
   *  stronger framing. The LLM uses this for in-conversation coaching
   *  and the report layer renders it in post-session feedback. */
  rewriteSuggestion: string;
}

/* Per-code rewrite suggestions. Each is a SHORT exemplar the candidate
 * could have said instead — quotable, not abstract advice. Kept tight
 * (~25 words) so the brief doesn't bloat the prompt. India-market
 * grounded (₹, LPA, notice). */
const REWRITES: Record<RedFlagCode, string> = {
  "no-current-ctc":
    "Say: \"My current fixed CTC is ₹X, with variable of ~₹Y at typical payout — happy to walk through the breakup.\"",
  "no-fixed-variable-breakup":
    "Say: \"Of the ₹X total, ₹Y is fixed base and ₹Z is variable / performance pay. Joining bonus is separate.\"",
  "ctc-inhand-confusion":
    "Say: \"My annual CTC is ₹X LPA, fixed component ₹Y LPA. In-hand monthly is ~₹Z post-tax — keeping the conversation in annual fixed.\"",
  "huge-hike-no-rationale":
    "Say: \"I know it's a steep hike — it reflects (a) level/scope change to <role>, (b) my last cycle's underpayment, and (c) recent peer offers at ₹X.\"",
  "salary-only-factor":
    "Say: \"Comp is one factor, but I'm also weighing role scope, manager, growth runway, and stack. Salary alone won't decide it.\"",
  "lies-about-offer":
    "Say: \"I have a competing offer at ₹X from <stage>. I can share the offer letter under NDA if helpful for your benchmarking.\"",
  "overcommits-joining":
    "Say: \"My notice is N days. I can request early release or fund a buyout of ₹X if joining sooner is critical — let's discuss what works.\"",
  "sounds-desperate":
    "Say: \"I'm evaluating this alongside other conversations. I'm excited about the role and want to make sure the comp lands fairly.\"",
  "badmouths-current":
    "Say: \"My current role has plateaued on <specific dimension>. I'm looking for <forward-looking thing>, which is what drew me here.\"",
  "shares-confidential":
    "Say: \"I'd rather not share specifics from my current company. Happy to talk about my own numbers and what I'm targeting.\"",
  "demands-no-flex":
    "Say: \"₹X is my strong preference based on <reason>. I'm open on structure — fixed/variable mix, joining bonus, equity — if it helps land there.\"",
  "treats-equity-as-cash":
    "Say: \"I'd value the ESOP at ~30–50% of face given vesting and liquidity risk. Could we discuss the strike, vest schedule, and last 409A?\"",
  "ignores-variable-risk":
    "Say: \"On variable, can we ground the discussion in last year's actual payout %? I'd like to risk-adjust the total rather than count the headline.\"",
  "verbal-accept-no-breakup":
    "Say: \"I'm verbally aligned at ₹X total. Before I formally accept, can we lock the fixed/variable/joining-bonus/ESOP split in writing?\"",
  "avoids-anchor":
    "Say: \"Based on my research for <role> at <tier>, I'm targeting ₹X–₹Y LPA fixed. Where does the band sit?\"",
  "personal-expense-justification":
    "Say: \"My target of ₹X is grounded in market data for <role> at <tier> and recent peer offers — happy to share the benchmarks I'm using.\"",
  "offer-shopping":
    "Say: \"I have other conversations in flight, but I'm not auctioning. I want to land at a fair number on both sides — what's the band here?\"",
  /* Phase 22 — comp-structure rewrites. */
  "ote-as-guaranteed":
    "Say: \"My OTE is ₹X — that's ₹Y base + ₹Z at-target variable. Last cycle I hit N% attainment, so realised was ~₹W.\"",
  "no-attainment-history":
    "Say: \"My last 3-year quota attainment was N%, M%, P% — happy to share W2/Form-16 + manager letters to back it up.\"",
  "day-rate-fte-confusion":
    "Say: \"At ₹X/day I billed ~D days last year for ~₹Y realised. For an FTE conversation, I'd target ₹Z LPA accounting for benefits, leave, and bench risk on my side.\"",
  /* Phase 25 — drift / pivot / disclosure / rigidity. */
  "target-drifted-upward":
    "Say: \"To clarify — my target has been ₹X LPA since we started; I shouldn't have moved the number mid-process. Let's stick with ₹X.\"",
  "domain-pivot-full-rate":
    "Say: \"I'm pivoting from <prior> to <new domain>, so I'm anchoring on a ramp-friendly ₹X — below my prior peak but fair for first-year-in-domain.\"",
  "compensation-history-issue":
    "Say: \"My last cycle was delayed/unpaid for N months — I'm using market data, not last-drawn, to anchor: ₹X LPA based on peer offers.\"",
  "rigid-no-range":
    "Say: \"I'm targeting ₹X-Y LPA fixed based on market for <role> at <tier>. I'm flexible on structure if we land in that range.\"",
  "offer-no-company-disclosure":
    "Say: \"My competing offer is from <Company> at <stage> — I can share the offer letter under NDA if useful for your benchmarking.\"",
};

interface DetectorInput {
  state: NegotiationState;
  stance: CandidateStanceResult;
  /** The candidate's current-turn answer text. Required for the few
   *  red flags that need fresh utterance text (CTC/in-hand confusion,
   *  "lies about offer" surface form). */
  utterance: string;
}

/* Threshold mirroring the follow-up router. */
const HUGE_HIKE_THRESHOLD = 40;

/* "I'm earning 80k per month" / "in-hand is 65000 monthly" inside a
 * conversation where the recruiter is asking annual CTC. We pattern-
 * match the monthly figure; the composite check pairs it with the
 * absence of an annual figure on the same turn. */
const MONTHLY_FIGURE = /\b(\d{2,3}(?:[.,]\d+)?)\s*k?\s*(?:per\s+month|\/\s*month|monthly|p\.?m\.?)\b/i;
const ANNUAL_CONTEXT = /\b(lpa|lakhs?\s+per\s+(?:year|annum)|annual|per\s+annum|p\.?a\.?|cr|crore)\b/i;

/* Phase 25 — "nothing below ₹X" / "minimum ₹X" / "won't accept under ₹X"
 * surface a hard floor with no range. Distinct from `demands-no-flex`
 * which is the stance-derived posture; this catches the single-number
 * utterance form even when the candidate hasn't otherwise been rigid. */
const RIGID_NO_RANGE = /\b(?:nothing\s+below|won['']?t\s+(?:accept|consider|go)\s+(?:below|under)|minimum|at\s+least|floor\s+is)\s*[₹rs.]*\s*(\d+(?:[.,]\d+)?)\s*(?:l|lpa|lakhs?|cr|crore)?\b/i;
const RANGE_HINT = /\b(\d+(?:[.,]\d+)?)\s*(?:l|lpa|lakhs?|cr|crore)?\s*(?:-|to|–)\s*(\d+(?:[.,]\d+)?)\s*(?:l|lpa|lakhs?|cr|crore)?\b/i;

/* "Lies about offer" is unsafe to detect from text alone. We use a
 * narrow heuristic: candidate names a competing company + a number
 * that the kernel can't verify, AND has previously declined to share
 * the offer letter. That's the closest deterministic proxy. */

export function detectRedFlags(input: DetectorInput): RedFlag[] {
  const { state, stance, utterance } = input;
  /* Phase 20 — detectors push the raw triple; the rewrite is attached
   * uniformly at the end via the REWRITES table so we don't sprinkle
   * the same string literal across every detector. */
  type Raw = Omit<RedFlag, "rewriteSuggestion">;
  const out: Raw[] = [];
  const u = (utterance || "").trim();

  /* 1. Doesn't know current CTC — fires after turn 2 when the
   *    recruiter has had a chance to ask. */
  if (state.turnIndex >= 2 && state.candidateCurrentCtc == null) {
    out.push({
      code: "no-current-ctc",
      severity: "concern",
      detail: "current CTC not stated after 2+ recruiter turns",
    });
  }

  /* 2. No fixed-vs-variable breakup. Fires once a CTC magnitude is on
   *    the table but `candidateComponentBreakdown.hasAny === false`. */
  if (
    (state.candidateCurrentCtc != null || state.candidateTarget != null) &&
    !state.candidateComponentBreakdown.hasAny
  ) {
    out.push({
      code: "no-fixed-variable-breakup",
      severity: "info",
      detail: "CTC magnitude stated but fixed/variable split unstated",
    });
  }

  /* 3. CTC/in-hand confusion — monthly figure in an annual context,
   *    without a matching annual figure on the same turn. */
  if (u && MONTHLY_FIGURE.test(u) && !ANNUAL_CONTEXT.test(u)) {
    out.push({
      code: "ctc-inhand-confusion",
      severity: "concern",
      detail: "candidate quoted a monthly figure in an annual-comp discussion",
    });
  }

  /* 4. Huge hike with no rationale. */
  if (
    state.hikePercent != null &&
    state.hikePercent > HUGE_HIKE_THRESHOLD &&
    state.rationale == null
  ) {
    out.push({
      code: "huge-hike-no-rationale",
      severity: "concern",
      detail: `ask is +${Math.round(state.hikePercent)}% hike, no rationale cue detected`,
    });
  }

  /* 5. Salary is the only decision factor. */
  if (stance.salaryOnlyFactor) {
    out.push({
      code: "salary-only-factor",
      severity: "concern",
      detail: "candidate stated salary is the sole consideration",
    });
  }

  /* 6. Lies about offer (narrow heuristic). Candidate has stated a
   *    competing-offer NUMBER but explicitly refused to share the
   *    letter / proof. We mark "blocker" only when the refusal is
   *    explicit, otherwise no flag. */
  if (
    state.competingOffer != null &&
    state.competingOfferDetail.letterShareOffered === false &&
    state.miscSignals.proofOfCtcShareable === false
  ) {
    out.push({
      code: "lies-about-offer",
      severity: "blocker",
      detail: "competing offer claimed but candidate refuses to share documentation",
    });
  }

  /* 7. Overcommits joining date — two firing paths:
   *    a) Structural — early-join preference WITH a non-trivial notice
   *       period the candidate hasn't said is bought out.
   *    b) Text-side (Phase 19) — candidate explicitly said they can
   *       join "immediately even though my notice is N days". */
  const np = state.noticeJoining.noticePeriodDays;
  if (
    state.noticeJoining.earlyJoinPreferred &&
    np != null &&
    np > 30 &&
    !state.noticeJoining.buyoutRequested
  ) {
    out.push({
      code: "overcommits-joining",
      severity: "info",
      detail: `candidate wants early join with ${np}-day notice and no buyout discussion`,
    });
  } else if (stance.overpromisesJoining) {
    out.push({
      code: "overcommits-joining",
      severity: "concern",
      detail: "candidate verbally promised early joining despite stated notice period",
    });
  }

  /* 8. Desperation. */
  if (stance.soundsDesperate) {
    out.push({
      code: "sounds-desperate",
      severity: "concern",
      detail: "candidate signalled urgency/no-other-options — BATNA weakened",
    });
  }

  /* 9. Badmouths current employer. */
  if (stance.badmouthsCurrent) {
    out.push({
      code: "badmouths-current",
      severity: "concern",
      detail: "candidate disparaged current employer — culture risk",
    });
  }

  /* 10. Confidential overshare. */
  if (stance.confidentialOvershare) {
    out.push({
      code: "shares-confidential",
      severity: "concern",
      detail: "candidate shared confidential / privileged info — integrity risk",
    });
  }

  /* 11. Demands with no flexibility (hardline + no floor signal). */
  if (stance.flexibilityPosture === "rigid") {
    out.push({
      code: "demands-no-flex",
      severity: "concern",
      detail: "candidate signalled non-negotiable / take-it-or-leave-it stance",
    });
  }

  /* 12. Treats equity as guaranteed cash. */
  if (stance.treatsEquityAsCash) {
    out.push({
      code: "treats-equity-as-cash",
      severity: "concern",
      detail: "candidate is counting ESOP/equity at face value as guaranteed cash",
    });
  }

  /* 13. Ignores variable-pay risk. Two firing paths:
   *
   *     a) Structural — candidate has a stated breakdown WITH a non-
   *        trivial variable component AND a target that only makes
   *        sense if 100pct of variable is paid out (target equals
   *        base+variable sum, no haircut).
   *
   *     b) Text-side (Phase 19, corpus-derived) — candidate explicitly
   *        SAID "variable is fine, I only care about total CTC". The
   *        text signal fires even without a stated breakdown. */
  const cb = state.candidateComponentBreakdown;
  let ignoresVariable = false;
  let ignoresVariableDetail = "";
  if (
    cb.hasAny &&
    cb.base != null &&
    cb.variable != null &&
    cb.variable > 0 &&
    state.candidateTarget != null
  ) {
    const total = cb.base + cb.variable;
    const variablePct = total > 0 ? cb.variable / total : 0;
    const targetMatchesNoHaircut = Math.abs(state.candidateTarget - total) < 0.5;
    if (variablePct >= 0.15 && targetMatchesNoHaircut) {
      ignoresVariable = true;
      ignoresVariableDetail = "target equals base+variable sum with no payout-risk haircut";
    }
  }
  if (!ignoresVariable && stance.dismissesVariableRisk) {
    ignoresVariable = true;
    ignoresVariableDetail = "candidate explicitly dismissed variable-pay risk in dialogue";
  }
  if (ignoresVariable) {
    out.push({
      code: "ignores-variable-risk",
      severity: "info",
      detail: ignoresVariableDetail,
    });
  }

  /* Phase 19 — corpus-derived red flags. */

  /* 15. Avoids anchor — "as per company standards", "you decide". */
  if (stance.avoidsAnchor) {
    out.push({
      code: "avoids-anchor",
      severity: "concern",
      detail: "candidate refused to anchor on a number — no negotiation surface to work with",
    });
  }

  /* 16. Personal-expense justification — not a market-value argument. */
  if (stance.personalExpenseJustification) {
    out.push({
      code: "personal-expense-justification",
      severity: "concern",
      detail: "candidate justified ask via personal expenses, not market value",
    });
  }

  /* 17. Offer-shopping demand — transactional "match or I'll leave". */
  if (stance.offerShoppingDemand) {
    out.push({
      code: "offer-shopping",
      severity: "concern",
      detail: "candidate is using other offers as a demand, not as leverage data",
    });
  }

  /* Phase 22 — Sales / contract comp structure detectors. Utterance-
   * grade (run on the current turn's text), NOT folded into state.
   * Detection-only; the rewrite layer surfaces the coaching. */

  /* 18. OTE quoted as guaranteed. Sales candidate cites their OTE
   *     figure without naming base/variable split OR attainment history. */
  const sales = extractSalesOTE(u);
  if (sales.quotesOteAsGuaranteed) {
    out.push({
      code: "ote-as-guaranteed",
      severity: "concern",
      detail: `candidate quoted OTE (₹${sales.oteAmount}L) as if guaranteed — no base/variable split or attainment context`,
    });
  }
  /* 19. No attainment history. Candidate stated an OTE and a base
   *     (so they understand the structure) but never named their
   *     attainment %. Recruiter side cannot calibrate the OTE without it. */
  if (sales.hasAny && sales.oteAmount != null && sales.baseAmount != null && sales.attainmentPct == null) {
    out.push({
      code: "no-attainment-history",
      severity: "info",
      detail: "OTE + base stated but candidate did not share quota attainment history",
    });
  }

  /* 20. Day-rate ↔ FTE confusion. Contract candidate moving to FTE
   *     annualised their day rate × ~250 days without accounting for
   *     bench / leave / benefits / tax. */
  const contract = extractContractRate(u);
  if (contract.dayRateAsAnnualConfusion) {
    out.push({
      code: "day-rate-fte-confusion",
      severity: "concern",
      detail: `candidate annualised ₹${contract.dayRate}/day to FTE without discussing utilization / bench`,
    });
  }

  /* Phase 25 — drift / pivot / disclosure / rigidity. */

  /* 21. Target drifted upward mid-process. Compares the FIRST anchored
   *     number against the current target; a >10% upward drift signals
   *     the candidate is chasing the recruiter's reveals instead of
   *     holding an anchored position. */
  if (
    state.firstAnchoredTarget != null &&
    state.candidateTarget != null &&
    state.candidateTarget > state.firstAnchoredTarget * 1.1
  ) {
    out.push({
      code: "target-drifted-upward",
      severity: "concern",
      detail: `target drifted from ₹${state.firstAnchoredTarget}L to ₹${state.candidateTarget}L mid-process — anchor weakened`,
    });
  }

  /* 22. Domain pivot but asking full-rate hike. Candidate is moving
   *     into a new domain (where they'd typically ramp at a haircut)
   *     yet asking >30% hike like a same-domain move. */
  if (
    state.candidateProfile.domainPivot &&
    state.hikePercent != null &&
    state.hikePercent > 30
  ) {
    out.push({
      code: "domain-pivot-full-rate",
      severity: "concern",
      detail: `candidate is pivoting domains but asking +${Math.round(state.hikePercent)}% — pivot-typical haircut not acknowledged`,
    });
  }

  /* 23. Compensation history issue surfaced (delayed / unpaid salary).
   *     The recruiter needs to know last-drawn may not anchor cleanly. */
  if (state.candidateProfile.compensationHistoryIssue != null) {
    out.push({
      code: "compensation-history-issue",
      severity: "info",
      detail: `candidate disclosed ${state.candidateProfile.compensationHistoryIssue} salary at current/prior employer — last-drawn unreliable as anchor`,
    });
  }

  /* 24. Rigid single-number floor with no range. Fires on text form
   *     "nothing below ₹X" UNLESS a range is also present. */
  if (u && RIGID_NO_RANGE.test(u) && !RANGE_HINT.test(u)) {
    out.push({
      code: "rigid-no-range",
      severity: "concern",
      detail: "candidate stated a single hard floor with no range — leaves no negotiation surface",
    });
  }

  /* 25. Competing offer claimed without company disclosure. Fires
   *     after turn 2 (recruiter has had a chance to ask) when a
   *     competing-offer NUMBER is on the table but the COMPANY is not. */
  if (
    state.turnIndex >= 2 &&
    state.competingOffer != null &&
    state.competingOfferDetail.company == null
  ) {
    out.push({
      code: "offer-no-company-disclosure",
      severity: "concern",
      detail: "competing offer amount stated but counterparty company never disclosed — unverifiable",
    });
  }

  /* 14. Verbal accept without breakup. Candidate has signalled
   *     verbal acceptance (verbalAcceptanceTurn set) but the kernel
   *     has no component breakdown for them. */
  if (
    state.verbalAcceptanceTurn != null &&
    !state.candidateComponentBreakdown.hasAny
  ) {
    out.push({
      code: "verbal-accept-no-breakup",
      severity: "concern",
      detail: "candidate accepted verbally but offer breakup never recorded",
    });
  }

  return out.map((r) => ({ ...r, rewriteSuggestion: REWRITES[r.code] }));
}
