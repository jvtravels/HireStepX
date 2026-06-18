/* PDF #18 follow-up (2026-05-15) — hike-justification auto-probe.
 *
 * Problem the user flagged: when a candidate asks for a >30% jump
 * (13 → 21 = 61%) and `valueProofProvided` is still false, the
 * existing `HIKE-LOGIC AWARENESS` rule + `valueProofProvided` flag
 * surface the GAP but never auto-inject the PROBE itself. Real HR
 * never moves money on a 60% jump without first asking "what
 * justifies it — automation framework ownership, test coverage,
 * production wins?" — i.e. a role-specific impact probe.
 *
 * This module is the single source of truth for:
 *   1. Whether the probe should fire this turn
 *      (`shouldProbeHikeJustification`)
 *   2. What the role-specific probe text is
 *      (`getHikeJustificationProbe`)
 *
 * Wired into the compactTurnBrief as a bracketed `[HIKE JUSTIFICATION
 * REQUIRED]` directive AND into the move-picker as a forced `probe`
 * lever when the candidate is still in discovery. Pure / stateless. */

import type { RoleFamily } from "./_company-band-tiers";

/* Threshold: matches the 30% bar the user specified. Strictly greater
 * than — a 30% jump on the nose doesn't fire (deserved annual hike at
 * many Indian firms). */
export const HIKE_JUSTIFICATION_THRESHOLD = 0.3;

export interface HikeJustificationInputs {
  /** Candidate's disclosed current CTC (LPA). */
  currentCtcLpa: number | null;
  /** Candidate's disclosed expected / target CTC (LPA). */
  expectedCtcLpa: number | null;
  /** Whether the candidate has already provided role-specific impact
   *  proof (ARR, quota, scale wins, etc.). */
  valueProofProvided: boolean;
}

/** Compute the hike delta as a fraction. Returns null when either CTC
 *  is missing or non-positive. Pure. */
export function computeHikeDelta(
  currentCtc: number | null,
  expectedCtc: number | null,
): number | null {
  if (currentCtc == null || expectedCtc == null) return null;
  if (currentCtc <= 0 || expectedCtc <= 0) return null;
  return (expectedCtc - currentCtc) / currentCtc;
}

/** Returns true iff the candidate is asking for a >threshold jump and
 *  has NOT yet provided role-specific value proof. Pure.
 *
 *  `thresholdOverride` lets the planner pass a per-session jittered
 *  threshold (see `_session-jitter.ts`) so the trigger reads as a soft
 *  band (25%-35%) rather than a hard cliff at exactly 30%. When omitted,
 *  falls back to the canonical `HIKE_JUSTIFICATION_THRESHOLD`. */
export function shouldProbeHikeJustification(
  input: HikeJustificationInputs,
  thresholdOverride?: number,
): boolean {
  if (input.valueProofProvided) return false;
  const delta = computeHikeDelta(input.currentCtcLpa, input.expectedCtcLpa);
  if (delta == null) return false;
  const threshold = thresholdOverride ?? HIKE_JUSTIFICATION_THRESHOLD;
  return delta > threshold;
}

/* Role-agnostic justification probe. Works for ANY function — finance,
 * HR, legal, non-software engineering, teaching — without leaking domain
 * jargon. This is the safe default the catch-all lands on. */
const GENERIC_JUSTIFICATION_PROBE =
  "what justifies it — the scope you've owned, the measurable results " +
  "you've delivered, and where you've gone beyond what the role asked?";

/* Positive software-engineering signal. `classifyRoleFamily` returns
 * "engineering" both for genuine software roles AND as the CATCH-ALL for
 * any role it can't place (Finance Manager, HR Business Partner, Civil /
 * Mechanical Engineer, Lawyer, Teacher…). Shipping the "system design,
 * codebase ownership, scale wins" probe to those candidates is the
 * "static question for every role" bug. We gate the software probe on a
 * positive title signal; everything else falls back to the generic probe.
 * Deliberately does NOT match a bare "engineer" — that also covers
 * civil/mechanical/chemical, which are not software. */
const SOFTWARE_ENG_SIGNAL =
  /\b(software|backend|back-end|frontend|front-end|full[\s-]?stack|sde|swe|sdet|web\s+developer|app\s+developer|mobile\s+(?:engineer|developer)|android|ios\b|developer|programmer|devops|sre|site\s+reliability|platform\s+engineer|infrastructure\s+engineer|cloud\s+engineer|security\s+engineer|systems?\s+engineer|qa\s+(?:engineer|automation)|test\s+engineer|automation\s+engineer|tech(?:nical)?\s+lead|engineering\s+manager|software\s+architect|solutions?\s+architect)\b/i;

/* Resume-achievement-aware probe. When the candidate's resume surfaced a
 * concrete, quantified win, real HR names it before pushing on the hike —
 * "you've led the GST automation that saved ₹2 Cr — what else justifies
 * the jump?" — which beats any role-family template because it proves the
 * recruiter actually read the CV. `achievement` is a verb-initial clause
 * pre-cleaned by `extractTopAchievement` (lowercased leading verb, no
 * trailing punctuation), so it slots into "you've <clause>" grammatically. */
function buildResumeAwareProbe(achievement: string): string {
  return `you've ${achievement} — what else justifies the kind of jump you're after?`;
}

/** Role-family-specific probe template. Pure.
 *
 * `role` (the raw title) disambiguates the engineering CATCH-ALL: when the
 * family is "engineering" but the title carries no software signal, the
 * generic probe ships instead of software jargon.
 *
 * `achievement` (optional) is a resume-derived, verb-initial impact clause.
 * When present it takes precedence over every role-family template — the
 * probe names the candidate's actual win instead of a generic bucket. */
export function getHikeJustificationProbe(
  roleFamily: RoleFamily,
  role?: string | null,
  achievement?: string | null,
): string {
  const ach = (achievement ?? "").trim();
  if (ach) return buildResumeAwareProbe(ach);
  if (roleFamily === "engineering" && !SOFTWARE_ENG_SIGNAL.test(role || "")) {
    return GENERIC_JUSTIFICATION_PROBE;
  }
  switch (roleFamily) {
    case "engineering":
      return (
        'what justifies it — what\'s your impact in system design, ' +
        "codebase ownership, performance / scale wins?"
      );
    case "product":
      return (
        "what justifies it — features shipped, metrics moved, scope of " +
        "ownership?"
      );
    case "design":
      return (
        "what justifies it — design system ownership, user-research " +
        "depth, conversion / retention impact?"
      );
    case "sales":
      return "what justifies it — quota attainment, deal size, account growth?";
    case "csm-cs":
      return (
        "what justifies it — retention rate, expansion revenue, " +
        "account complexity?"
      );
    case "data":
      return (
        "what justifies it — model deployment, business metrics moved, " +
        "infra / platform ownership?"
      );
    case "marketing":
      return (
        "what justifies it — campaigns owned, growth / CAC / LTV " +
        "metrics moved, channel ownership?"
      );
    case "ops":
      return (
        "what justifies it — process / system ownership, efficiency / " +
        "cost metrics moved?"
      );
    default:
      /* Niche families not modeled explicitly — role-agnostic probe, no
       * domain jargon. */
      return GENERIC_JUSTIFICATION_PROBE;
  }
}

/** Convenience: produce the bracketed brief line the LLM consumes,
 *  e.g. `[HIKE JUSTIFICATION REQUIRED: 61% jump — ask "what justifies
 *  it — …"]`. Returns null when the probe should not fire. Pure. */
export function buildHikeJustificationBrief(
  input: HikeJustificationInputs,
  roleFamily: RoleFamily,
  role?: string | null,
  achievement?: string | null,
): string | null {
  if (!shouldProbeHikeJustification(input)) return null;
  const delta = computeHikeDelta(input.currentCtcLpa, input.expectedCtcLpa);
  if (delta == null) return null;
  const pct = Math.round(delta * 100);
  return `[HIKE JUSTIFICATION REQUIRED: ${pct}% jump — ask "${getHikeJustificationProbe(roleFamily, role, achievement)}"]`;
}

