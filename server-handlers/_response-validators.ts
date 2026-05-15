/* Response validators — architectural bug-prevention (2026-05-15).
 *
 * Promotes NUMBER DISCIPLINE and BUDGET DISCIPLINE from prompt-only
 * advisories to post-generation state validators. The prompt layer
 * still carries the rules (they coach the LLM on what to emit) but
 * enforcement no longer relies on the LLM honouring them. Both
 * validators are pure — input is the candidate-facing reply text plus
 * kernel state; output is `{ok}` or `{ok: false, reason, violations}`.
 *
 * Called from negotiate-turn.ts's reroll path so a single mis-emitted
 * number triggers exactly one reroll with the violation reason
 * appended to the prompt. After the reroll cap is hit (1), a fall-
 * through entry is logged to state.decisionLog with picker
 * "validator-reject-fallthrough" and the original reply is returned
 * (no user-facing hard fail — coverage is best-effort enforcement, not
 * a circuit breaker).
 */
import type { NegotiationState } from "./_negotiation-kernel";
import { getCompanyHikeCap, classifyRoleFamily } from "./_company-band-tiers";
import {
  getNextDiscoveryQuestion,
  isDiscoveryComplete,
} from "./_discovery-stage";
import { pruneAcknowledged } from "./_candidate-disclosure-tracker";
import { shouldProbeHikeJustification } from "./_hike-justification-probe";

/** Anchor deviation tolerance — 5% of locked anchor. */
const ANCHOR_DEVIATION_TOLERANCE = 0.05;
/** Above-ceiling tolerance — allow a 1% rounding fudge so "₹24.0L" against
 *  a ₹23.9L ceiling doesn't trip on numeric rounding. */
const CEILING_TOLERANCE = 0.01;

export interface ValidatorOk {
  ok: true;
}
export interface ValidatorReject {
  ok: false;
  reason: string;
  violations: string[];
}
export type ValidatorResult = ValidatorOk | ValidatorReject;

/** Extract every salary number (LPA / lakh / crore) emitted in the
 *  reply. Returns the normalized LPA value per match. Crore values
 *  convert ×100. */
function extractEmittedNumbers(reply: string): number[] {
  if (!reply) return [];
  const out: number[] = [];
  /* Match patterns like "18 LPA", "18.5L", "18 lakh", "1.5 crore". */
  const re = /(\d+(?:\.\d+)?)\s*(LPA|L|lakhs?|crores?|cr)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(reply)) !== null) {
    const v = parseFloat(m[1]);
    if (!Number.isFinite(v)) continue;
    const unit = m[2].toLowerCase();
    if (unit === "crore" || unit === "crores" || unit === "cr") {
      out.push(v * 100); // 1 cr = 100 LPA
    } else {
      out.push(v);
    }
  }
  return out;
}

/** NUMBER DISCIPLINE: every number the bot emits MUST be consistent with
 *  the locked anchor (if any) and the band ceiling. Rationale: PDF #18
 *  real session had the bot drift from a ₹54L anchor to a ₹28L follow-up;
 *  prompt-only rules failed to prevent it. */
export function validateNumberDiscipline(
  reply: string,
  state: NegotiationState,
): ValidatorResult {
  const nums = extractEmittedNumbers(reply);
  if (nums.length === 0) return { ok: true };
  const violations: string[] = [];

  /* Locked-anchor consistency (>5% deviation). */
  if (state.anchorLocked && state.lockedAnchorLpa != null && state.lockedAnchorLpa > 0) {
    const anchor = state.lockedAnchorLpa;
    const lo = anchor * (1 - ANCHOR_DEVIATION_TOLERANCE);
    /* Upward drift is bounded by the band ceiling check, not the anchor
     * tolerance — recruiters CAN concede upward within band. The anchor
     * lock is a floor against silent downward jumps. */
    for (const n of nums) {
      if (n < lo) {
        violations.push(
          `emitted ₹${n}L is ${((1 - n / anchor) * 100).toFixed(0)}% below locked anchor ₹${anchor}L (>5% downward drift)`,
        );
      }
    }
  }

  /* Band ceiling. */
  const ceiling = state.band?.maxStretch;
  if (ceiling != null && Number.isFinite(ceiling) && ceiling > 0) {
    const ceilingPlus = ceiling * (1 + CEILING_TOLERANCE);
    for (const n of nums) {
      if (n > ceilingPlus) {
        violations.push(
          `emitted ₹${n}L exceeds band ceiling (maxStretch ₹${ceiling}L)`,
        );
      }
    }
  }

  if (violations.length === 0) return { ok: true };
  return {
    ok: false,
    reason: `NUMBER DISCIPLINE — emitted numbers violate anchor/band invariants: ${violations.join("; ")}`,
    violations,
  };
}

/** BUDGET DISCIPLINE: numbers must not exceed the company's hike-cap-
 *  implied ceiling given current CTC. Uses the same COMPANY_HIKE_CAP_PCT
 *  the kernel already consults during counter-offer sizing. */
export function validateBudgetDiscipline(
  reply: string,
  state: NegotiationState,
): ValidatorResult {
  const nums = extractEmittedNumbers(reply);
  if (nums.length === 0) return { ok: true };
  const currentCtc = state.candidateCurrentCtc;
  if (currentCtc == null || currentCtc <= 0) return { ok: true };
  const cap = getCompanyHikeCap(state.company);
  if (cap == null) return { ok: true };
  const budgetCeiling = currentCtc * (1 + cap / 100);
  const budgetCeilingPlus = budgetCeiling * (1 + CEILING_TOLERANCE);
  const violations: string[] = [];
  for (const n of nums) {
    if (n > budgetCeilingPlus) {
      violations.push(
        `emitted ₹${n}L exceeds hike-cap budget ₹${budgetCeiling.toFixed(1)}L ` +
          `(currentCtc ₹${currentCtc}L × ${1 + cap / 100} for ${state.company})`,
      );
    }
  }
  if (violations.length === 0) return { ok: true };
  return {
    ok: false,
    reason: `BUDGET DISCIPLINE — hike-cap exceeded: ${violations.join("; ")}`,
    violations,
  };
}

/* ─── Negotiation-flow redesign commit 5 (2026-05-15) — 4 more validators ─
 *
 * Per audit section E row 5: promote four more prompt-only rules to
 * deterministic post-generation validators.
 *
 *   validateRangeDiscipline    — phase=range-disclosure but reply emits
 *                                a specific number (audit D3 table row).
 *   validateAcknowledgement    — pendingCandidateAcks were live on state
 *                                pre-generation and the reply doesn't
 *                                acknowledge them all (audit D3 row 4).
 *   validateNextActionEmitted  — [NEXT REQUIRED ACTION] tag was on the
 *                                brief AND the reply lacks both the
 *                                action prompt content and any "?".
 *   validateHikeProbe          — hike-justification probe was required
 *                                AND reply lacks any probe vocabulary.
 *
 * All four follow the same shape as validateNumberDiscipline /
 * validateBudgetDiscipline so the negotiate-turn reroll path can call
 * them uniformly. Pure.
 */

/** Matches a specific salary number in any unit: "18 LPA", "18.5L",
 *  "18 lakh", "1.5 crore". Does NOT match ranges like "18-22 LPA" — a
 *  range is the intended emission during the range-disclosure phase.
 *  We strip range patterns first so a draft like "₹18-22L band" passes. */
const SPECIFIC_NUMBER_RE = /(\d+(?:\.\d+)?)\s*(LPA|L|lakhs?|crores?|cr)\b/gi;
const RANGE_RE = /(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*(LPA|L|lakhs?|crores?|cr)\b/gi;

function hasSpecificNumberOutsideRange(reply: string): boolean {
  if (!reply) return false;
  /* Strip every detected range first so leftover specific-number
   * matches genuinely indicate a non-range anchor. */
  const stripped = reply.replace(RANGE_RE, " <RANGE> ");
  return SPECIFIC_NUMBER_RE.test(stripped);
}

/** RANGE DISCIPLINE: when the kernel is in `range-disclosure` phase,
 *  the bot MUST emit a range, not a specific number. Prompt rule
 *  `[PHASE RULE: disclose RANGE]` previously enforced this only as an
 *  advisory; the validator rejects drafts that name a single number
 *  during this phase. */
export function validateRangeDiscipline(
  reply: string,
  state: NegotiationState,
): ValidatorResult {
  if (state.phase !== "range-disclosure") return { ok: true };
  if (!hasSpecificNumberOutsideRange(reply)) return { ok: true };
  return {
    ok: false,
    reason:
      "RANGE DISCIPLINE — phase=range-disclosure requires a band emission (e.g. ₹18–22L), not a specific anchor",
    violations: ["specific-number-in-range-phase"],
  };
}

/** ACKNOWLEDGEMENT: candidate disclosures (notice / current CTC /
 *  competing offer / joining date) pending pre-generation must be
 *  addressed by the reply. We simulate pruneAcknowledged against the
 *  draft text and fail if anything pre-existing remains unaddressed.
 *
 *  Scope note: the audit spec called for an "age > 1 turn" check, but
 *  CandidateDisclosureEntry doesn't carry an atTurn field — adding one
 *  is a structural shift. The validator therefore reads the post-state
 *  pre-generation acks (which are themselves carried from prior turns
 *  via applyCandidateAnswer) and fails on any unaddressed entry. */
export function validateAcknowledgement(
  reply: string,
  state: NegotiationState,
): ValidatorResult {
  const pending = state.pendingCandidateAcks;
  if (!pending || pending.length === 0) return { ok: true };
  const remaining = pruneAcknowledged(pending, reply);
  if (remaining.length === 0) return { ok: true };
  const labels = remaining.map((e) => e.label).join("; ");
  return {
    ok: false,
    reason: `ACKNOWLEDGEMENT — reply must acknowledge candidate disclosure(s): ${labels}`,
    violations: remaining.map((e) => e.kind),
  };
}

/** Tokenise content words for overlap computation. Strips punctuation,
 *  lowercases, drops < 3-char filler tokens. */
function contentTokens(s: string): Set<string> {
  if (!s) return new Set();
  const out = new Set<string>();
  for (const raw of s.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length >= 4) out.add(raw);
  }
  return out;
}

/** Jaccard overlap between two content-token sets. */
function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

const NEXT_ACTION_TAG = "NEXT REQUIRED ACTION";
const NEXT_ACTION_OVERLAP_THRESHOLD = 0.4;

/** NEXT ACTION EMITTED: when [NEXT REQUIRED ACTION] was on the brief
 *  this turn AND the reply neither contains a `?` nor overlaps
 *  meaningfully with the action prompt, the bot drifted off task.
 *
 *  Scope-down (commit 5, awaiting commit 3 planNextAction): we re-
 *  read the required ask directly off state.plannedNextAction (commit 3
 *  registered the planner so applyCandidateAnswer stamps the planned
 *  action onto state before the brief / validator stage). When the
 *  planned action is not a discovery-probe — or, for back-compat with
 *  pre-commit-3 serialized sessions, when plannedNextAction is absent —
 *  fall back to the legacy getNextDiscoveryQuestion lookup so in-flight
 *  validation behavior is preserved. */
export function validateNextActionEmitted(
  reply: string,
  state: NegotiationState,
): ValidatorResult {
  const tags = state.lastBriefTags ?? [];
  if (!tags.includes(NEXT_ACTION_TAG)) return { ok: true };

  /* Commit 3 (2026-05-15) — preferred path: consume the planner's
   * cached NextAction so the validator and the brief read THE SAME
   * "next ask" string. Eliminates the prior fragility where the
   * brief and the validator could disagree on which item to require. */
  const planned = (state.plannedNextAction ?? null) as
    | { kind: string; ask?: string; item?: string }
    | null;
  let requiredAsk: string | null = null;
  let requiredItem: string | null = null;
  if (planned && planned.kind === "discovery-probe" && planned.ask) {
    requiredAsk = planned.ask;
    requiredItem = planned.item ?? null;
  } else if (!planned) {
    /* Back-compat fallback for sessions deserialized before commit 3. */
    if (!state.discoveryChecklist) return { ok: true };
    const roleFamily = classifyRoleFamily(state.role);
    if (isDiscoveryComplete(state.discoveryChecklist, roleFamily)) return { ok: true };
    const nextQ = getNextDiscoveryQuestion(state.discoveryChecklist, roleFamily);
    if (!nextQ) return { ok: true };
    requiredAsk = nextQ.prompt;
    requiredItem = nextQ.item;
  }
  if (!requiredAsk) return { ok: true };

  /* Permissive pass conditions: either the reply asks a question OR
   * shares enough content-token overlap with the required prompt. */
  if (/\?/.test(reply)) return { ok: true };
  const overlap = tokenOverlap(contentTokens(reply), contentTokens(requiredAsk));
  if (overlap >= NEXT_ACTION_OVERLAP_THRESHOLD) return { ok: true };
  return {
    ok: false,
    reason: `NEXT ACTION — reply must ask the required discovery question (overlap ${(overlap * 100).toFixed(0)}% < ${(NEXT_ACTION_OVERLAP_THRESHOLD * 100).toFixed(0)}% AND no question mark): ${requiredAsk}`,
    violations: requiredItem ? [requiredItem] : [],
  };
}

const HIKE_TAG = "HIKE JUSTIFICATION REQUIRED";
/** Probe-vocabulary tokens that signal the LLM actually asked the
 *  justification question (vs. drifting to small talk). Conservative
 *  match — any of these counts; the LLM only needs to land one. */
const HIKE_PROBE_VOCAB = [
  "justif",
  "impact",
  "metric",
  "scope",
  "quota",
  "attainment",
  "ownership",
  "retention",
  "shipped",
  "delivered",
  "portfolio",
  "complex",
  "system design",
  "scale",
  "deal size",
  "growth",
];

/** HIKE PROBE: when the kernel set the [HIKE JUSTIFICATION REQUIRED]
 *  brief tag for this turn, the reply MUST land at least one
 *  justification-probe token. Prompt-only rule was being ignored on
 *  ~10% of generations.
 *
 *  Belt-and-suspenders: we also check the underlying shouldProbeHike-
 *  Justification predicate so a brief-tag absence (e.g. validator
 *  reroll on a turn where the brief wasn't rebuilt) still catches the
 *  rule when its precondition is satisfied. */
export function validateHikeProbe(
  reply: string,
  state: NegotiationState,
): ValidatorResult {
  const tagSet = state.lastBriefTags ?? [];
  const tagWasOn = tagSet.includes(HIKE_TAG);
  if (!tagWasOn) {
    /* Underlying predicate fallback. If the tag wasn't on the brief,
     * the rule doesn't fire (we only enforce when the kernel asked the
     * LLM to probe). */
    const wouldFire = shouldProbeHikeJustification({
      currentCtcLpa: state.candidateCurrentCtc,
      expectedCtcLpa: state.candidateTarget,
      valueProofProvided: state.candidateProfile?.valueProofProvided === true,
    });
    if (!wouldFire) return { ok: true };
  }
  const lower = (reply || "").toLowerCase();
  const found = HIKE_PROBE_VOCAB.some((tok) => lower.includes(tok));
  if (found) return { ok: true };
  return {
    ok: false,
    reason:
      "HIKE PROBE — hike-justification brief tag was set but reply lacks probe vocabulary (justif/impact/metrics/scope/ownership/...)",
    violations: ["no-probe-vocab"],
  };
}
