/* Table-driven coverage for the number-role classifier.
 *
 * Each row is a candidate utterance + an expected role binding. New
 * phrasings are added as new rows — not as new RegExp alternatives in
 * the kernel. This is the contract enforced by the architectural
 * refactor: a fix is a row, not a regex. */

import { describe, it, expect } from "vitest";
import {
  classifyNumberRoles,
  type NumberRoleContext,
  type NumberRoleResult,
} from "../../server-handlers/_number-role-classifier";

interface Row {
  /** Short label shown in test output. */
  label: string;
  /** Candidate utterance. */
  text: string;
  /** Optional context. */
  ctx?: NumberRoleContext;
  /** Expected subset of result fields. Fields omitted are not asserted. */
  expect: Partial<NumberRoleResult>;
}

const ROWS: Row[] = [
  /* ── Current-CTC cues ──────────────────────────────────────────── */
  { label: "currently earning N",        text: "I am currently earning 18 LPA",         expect: { currentCtc: 18 } },
  { label: "my current CTC",             text: "My current CTC is 22 LPA",              expect: { currentCtc: 22 } },
  { label: "I make N",                   text: "I make 15 LPA right now",               expect: { currentCtc: 15 } },
  { label: "drawing N",                  text: "drawing 19 LPA at present",             expect: { currentCtc: 19 } },
  { label: "I'm at N",                   text: "I'm at 12 LPA",                         expect: { currentCtc: 12 } },
  { label: "told you N already",         text: "I told you, 24 LPA CTC overall",        expect: { currentCtc: 24 } },
  { label: "as I mentioned",             text: "as I mentioned, 17 LPA total CTC",      expect: { currentCtc: 17 } },
  { label: "take home N",                text: "I take home 14 LPA right now",          expect: { currentCtc: 14 } },
  /* PARSER-1 regression — bare "Total CTC is N LPA" without a possessive
   * pronoun was leaving current-ctc null. Surfaced by EVAL-6 long-
   * horizon-trajectory T2. */
  { label: "Total CTC is N LPA",         text: "Total CTC is 28 LPA — 24 fixed, 4 variable.", expect: { currentCtc: 28 } },
  { label: "Total package N",            text: "Total package 22 LPA right now",        expect: { currentCtc: 22 } },

  /* ── Compound clause: prior-clause cue must NOT leak forward (#67) ──
   * A unit-less earlier number ("22 fixed", "18") used to leave the
   * left-window clip dormant, so the prior clause's current cue
   * ("currently"/"current") leaked across the comma and mis-bound the
   * LATER target as current. The digit-guarded clause clip fixes it
   * while preserving bare lead-ins ("I told you, 24 LPA" above). */
  { label: "compound: current+target, both unit-bearing", text: "I'm at 22 LPA fixed currently, targeting 34 LPA total.", expect: { currentCtc: 22, target: 34 } },
  { label: "compound: unit-less current, target binds",    text: "I'm at 22 fixed currently, targeting 34 total.",        expect: { target: 34 } },
  { label: "compound: current is 18, expecting 26",         text: "current is 18, expecting 26",                          expect: { target: 26 } },
  /* #66 follow-up — a digit GLUED to letters (level token SE3 / L5 /
   * SDE2) is NOT a prior salary disclosure, so the clause clip must NOT
   * fire on it. Before the FREE_STANDING_NUMBER guard, the "3" in "SE3"
   * triggered a clip of "...at Myntra," and the 24 lost its current-CTC
   * binding (eval scenario role-mismatch-needs-clarify). */
  { label: "level token before comma keeps employer cue", text: "I'm a SE3 at Myntra, 24 LPA.",                          expect: { currentCtc: 24 } },
  { label: "L-prefixed level token before comma",          text: "I'm L5 at Google, currently 30 LPA.",                 expect: { currentCtc: 30 } },

  /* ── Lowered-counter / concession frames (live-staging 2026-06-19, #93) ──
   * A candidate conceding toward the offer names a new lower TARGET with a
   * verb-of-motion. These previously bound nothing, so the bot kept arguing
   * the stale opening anchor. Asserted in counter-offer phase (no AI-asked
   * context) to prove the cue — not the phase default — does the binding. */
  { label: "get to N (bare)",            text: "Can you get to 35?",                    ctx: { phase: "counter-offer" }, expect: { target: 35 } },
  { label: "get the fixed to N",         text: "Can you get the fixed to 28?",          ctx: { phase: "counter-offer" }, expect: { target: 28 } },
  { label: "stretch to N",               text: "If you stretch to 38 I'm interested.",  ctx: { phase: "counter-offer" }, expect: { target: 38 } },
  { label: "come up to N",               text: "Could you come up to 36?",              ctx: { phase: "counter-offer" }, expect: { target: 36 } },
  { label: "close at N",                 text: "Let's close at 35.",                    ctx: { phase: "counter-offer" }, expect: { target: 35 } },
  { label: "make it N",                  text: "Make it 38 and we have a deal.",        ctx: { phase: "counter-offer" }, expect: { target: 38 } },

  /* ── Target cues — English ─────────────────────────────────────── */
  { label: "expecting N",                text: "I'm expecting 30 LPA",                  expect: { target: 30 } },
  { label: "looking for N",              text: "looking for 28 LPA",                    expect: { target: 28 } },
  /* Live-staging (2026-06-19): "looking AT N for this move" is the more
   * common spoken target form. It carried no target cue, so it fell through
   * pickRole's Gricean default and bound to CURRENT whenever the bot's prior
   * turn mentioned "current package" (the equity probe), overwriting the real
   * CTC and firing a false "you're at ₹40 LPA right now" callback. */
  { label: "looking at N (equity probe ctx)", text: "I'm looking at around 40 LPA for this move.", ctx: { lastAiText: "On the equity side — does your current package include any ESOPs?" }, expect: { target: 40 } },
  { label: "looking at N (no ctx)",      text: "I'm looking at around 40 LPA for this move.", expect: { target: 40 } },
  /* Tie-break guard: when a stronger current/competing cue co-occurs with
   * "looking at", current>competing>target must still win — "looking at"
   * only decides the bind when it is the SOLE cue. */
  { label: "looking at + current cue → current", text: "Looking at my current CTC, it's 30 LPA.", expect: { currentCtc: 30, target: null } },
  { label: "looking at + offer cue → competing",  text: "I'm looking at an offer of 24 LPA from Razorpay.", expect: { competing: 24, target: null } },
  { label: "would like N",               text: "I would like 32 LPA",                   expect: { target: 32 } },
  { label: "I'd like N",                 text: "I'd like 35 LPA for this role",         expect: { target: 35 } },
  { label: "hoping for N",               text: "hoping for around 26 LPA",              expect: { target: 26 } },
  { label: "aiming for N",               text: "aiming for 40 LPA",                     expect: { target: 40 } },
  { label: "target is N",                text: "my target is 33 LPA",                   expect: { target: 33 } },
  /* QUALITY-1 regression: `\btarget\b` matched the noun but missed verb
   * forms — capstone PDF replay had "Targeting 28 LPA for this move."
   * land as target=null, looping the planner on probe-expectations. */
  { label: "targeting N",                text: "Targeting 28 LPA for this move.",       expect: { target: 28 } },
  { label: "targeted N",                 text: "I targeted 30 LPA in my last switch",   expect: { target: 30 } },
  { label: "targets N",                  text: "she targets 35 LPA roles",              expect: { target: 35 } },
  /* QUALITY-2 regression (EVAL-5): negated cue must not bind. Candidate
   * rejected the number — the parser was binding it as target via the
   * bare-number-in-probe default. */
  { label: "Not N, too high",            text: "Not 30 LPA, that's too high",           ctx: { phase: "probe-expectations" }, expect: { target: null } },
  { label: "wouldn't ask for N",         text: "I wouldn't ask for 32 LPA honestly",    ctx: { phase: "probe-expectations" }, expect: { target: null } },
  { label: "no N expected",              text: "no 35 LPA expectations here",           ctx: { phase: "probe-expectations" }, expect: { target: null } },
  /* Inverter case: 'not less than N' = 'at least N' → bindable. The
   * negation guard must not strip these. */
  { label: "not less than N",            text: "I'm targeting not less than 28 LPA",    expect: { target: 28 } },
  { label: "not below N",                text: "would not go below 26 LPA",             ctx: { phase: "probe-expectations" }, expect: { target: 26 } },
  { label: "anchor around N",            text: "anchoring around 32 LPA",               expect: { target: 32 } },
  { label: "bare anchor (no unit)",      text: "the anchor I had in mind was around 28", expect: { target: 28 } },
  { label: "settle for N",               text: "I'd settle for 25 LPA",                 expect: { target: 25 } },
  { label: "comfortable with N",         text: "comfortable with 27 LPA",               expect: { target: 27 } },

  /* ── Target cues — Hindi-mix ───────────────────────────────────── */
  { label: "N LPA chahiye",              text: "Mujhe 25 LPA chahiye",                  expect: { target: 25 } },
  { label: "N lakh chahiye",             text: "Honestly, 25 lakh chahiye for this role", expect: { target: 25 } },
  { label: "N LPA ka package",           text: "Sir, 30 LPA ka package chahiye",        expect: { target: 30 } },
  { label: "N lakh mil jaye",            text: "22 lakh mil jaye to bahut accha hoga",  expect: { target: 22 } },
  { label: "rupee-sign + expect karta",  text: "Main ₹35 LPA expect karta hu",          expect: { target: 35 } },

  /* ── Competing cues ────────────────────────────────────────────── */
  { label: "competing offer of N",       text: "I have a competing offer of 28 LPA",    expect: { competing: 28 } },
  { label: "another offer at N",         text: "another offer at 30 LPA",               expect: { competing: 30 } },
  { label: "in-hand offer of N",         text: "in-hand offer of 26 LPA",               expect: { competing: 26 } },
  { label: "received an offer of N",     text: "I received an offer of 32 LPA last week", expect: { competing: 32 } },
  { label: "got an offer at N",          text: "got an offer at 24 LPA",                expect: { competing: 24 } },

  /* ── Sentence-level defaults ───────────────────────────────────── */
  {
    label: "bare reply after bot asked CTC → current",
    text: "18 LPA",
    ctx: { lastAiText: "What's your current total annual CTC?" },
    expect: { currentCtc: 18 },
  },
  {
    label: "bare reply in probe-expectations → target",
    text: "30 LPA",
    ctx: { phase: "probe-expectations" },
    expect: { target: 30 },
  },
  {
    label: "no cue, no context → no bind",
    text: "30 LPA",
    expect: { currentCtc: null, target: null, competing: null },
  },

  /* ── Bare-integer CTC vs. non-salary trailing units (2026-06-19) ──
   * A bare integer answered right after the bot asked for CTC is the
   * candidate's number — even when a NON-salary figure trails it
   * ("30, 7 yrs", "26 LPA, team of 12"). The non-salary-unit guard is
   * anchored to the unit IMMEDIATELY trailing the integer, so it strips
   * experience / headcount / tenure / percentage figures WITHOUT
   * swallowing a genuine bare CTC. Conversely a number whose own trailing
   * unit is non-salary ("relocate in 30 days", "5 years experience",
   * "30% hike") must NOT bind as CTC. */
  {
    label: "bare CTC + trailing experience → current",
    text: "I'm at 30, 7 yrs.",
    ctx: { lastAiText: "What's your current total annual CTC?" },
    expect: { currentCtc: 30 },
  },
  {
    label: "CTC + trailing headcount → current",
    text: "26 LPA, team of 12",
    ctx: { lastAiText: "What's your current total annual CTC?" },
    expect: { currentCtc: 26 },
  },
  {
    label: "relocation-days integer → no CTC bind",
    text: "I can relocate in 30 days",
    ctx: { lastAiText: "What's your current total annual CTC?" },
    expect: { currentCtc: null },
  },
  {
    label: "years-experience integer → no CTC bind",
    text: "5 years experience",
    ctx: { lastAiText: "What's your current total annual CTC?" },
    expect: { currentCtc: null },
  },
  {
    label: "percentage-hike integer → no CTC bind",
    text: "30% hike please",
    ctx: { lastAiText: "What's your current total annual CTC?" },
    expect: { currentCtc: null },
  },

  /* ── Compound disclosures (same utterance, multiple roles) ─────── */
  {
    label: "current + target in one breath",
    text: "I'm currently at 18 LPA and expecting 30 LPA",
    expect: { currentCtc: 18, target: 30 },
  },
  {
    label: "current + competing",
    text: "drawing 20 LPA, but I have an offer at 28 LPA",
    expect: { currentCtc: 20, competing: 28 },
  },
  {
    label: "all three roles",
    text: "currently 18 LPA, competing offer of 25 LPA, looking for 32 LPA",
    expect: { currentCtc: 18, competing: 25, target: 32 },
  },

  /* ── Magnitudes / units ────────────────────────────────────────── */
  { label: "crore on target",            text: "expecting around 2 crore",              expect: { target: 200 } },
  { label: "crore on current",           text: "currently making 1.5 crore",            expect: { currentCtc: 150 } },
  { label: "lakhs spelt out",            text: "expecting 30 lakhs",                    expect: { target: 30 } },
  { label: "lacs (alt spelling)",        text: "I make 18 lacs",                        expect: { currentCtc: 18 } },
  { label: "USD-k → LPA via FX",         text: "competing offer of $150k from a US firm", expect: { competing: 124.5 } },

  /* ── Range upper-bound ────────────────────────────────────────── */
  {
    label: "target range upper",
    text: "expecting 28-35 LPA",
    expect: { target: 35, targetAsRange: true },
  },
  {
    label: "anchoring between range",
    text: "anchoring between 30-40 LPA",
    expect: { target: 40, targetAsRange: true },
  },

  /* ── Equity-scope guard (L1 / PRI-50, 2026-06-17) ──────────────────
   * An equity/RSU/ESOP/stock-framed number is an equity COMPONENT, not a
   * CTC/target/competing figure. It must NOT bind to currentCtc even when
   * the bot just asked for current CTC (the Gricean bare-number default) —
   * otherwise it overwrites the real currentCtc and fires a spurious
   * contradiction-callout. Captured separately by the component extractor. */
  {
    label: "RSU worth N → not currentCtc (bot asked current)",
    text: "RSUs worth roughly 3 LPA a year. My notice is 60 days.",
    ctx: { lastAiText: "What's your current CTC?" },
    expect: { currentCtc: null, target: null, competing: null },
  },
  {
    label: "ESOP N a year → not currentCtc",
    text: "My ESOPs are around 4 lakh a year.",
    ctx: { lastAiText: "What's your current CTC?" },
    expect: { currentCtc: null },
  },
  {
    label: "equity is N → not currentCtc",
    text: "Equity is about 3 LPA on top.",
    ctx: { lastAiText: "What's your current CTC?" },
    expect: { currentCtc: null },
  },
  {
    label: "I get stock worth N → equity beats scored current cue",
    text: "I get stock worth 5 LPA annually.",
    ctx: { lastAiText: "What's your current CTC?" },
    expect: { currentCtc: null },
  },
  /* Guard must NOT over-reach: a real currentCtc with a TRAILING equity
   * mention still binds the CTC number. */
  {
    label: "N LPA with equity on top → currentCtc still binds",
    text: "My current CTC is 24 LPA with equity on top.",
    ctx: { lastAiText: "What's your current CTC?" },
    expect: { currentCtc: 24 },
  },
  {
    label: "total CTC N including RSUs → currentCtc still binds",
    text: "I'm at 22 LPA total CTC, including RSUs.",
    ctx: { lastAiText: "What's your current CTC?" },
    expect: { currentCtc: 22 },
  },
  {
    label: "total CTC N of which M is RSU → binds total, not equity slice",
    text: "My total CTC is 30 LPA, of which 4 LPA is RSU.",
    ctx: { lastAiText: "What's your current CTC?" },
    expect: { currentCtc: 30 },
  },

  /* ── Counter-movement frames (live-staging, 2026-06-17) ─────────────
   * After the recruiter anchors, candidates counter by asking to MOVE a
   * component toward a number. These carry no classic target verb but are
   * unambiguous counters; the verb-of-motion + destination IS the ask.
   * Each must bind `target` AND scope to `fixed` when the moved component
   * is the fixed/base. Previously all returned target:null and the counter
   * fell through to a content-free deflection. */
  {
    label: "counter: 'get the fixed component closer to 28' → 28 fixed",
    text: "Can we get the fixed component closer to 28?",
    expect: { target: 28, targetComponent: "fixed" },
  },
  {
    label: "counter: 'push the fixed closer to 28' → 28 fixed",
    text: "Could we push the fixed closer to 28?",
    expect: { target: 28, targetComponent: "fixed" },
  },
  {
    label: "counter: 'hoping the base could be around 28' → 28 fixed",
    text: "I was hoping the base could be around 28.",
    expect: { target: 28, targetComponent: "fixed" },
  },
  {
    label: "counter: 'bring the base up to 30' → 30 fixed",
    text: "Can we bring the base up to 30?",
    expect: { target: 30, targetComponent: "fixed" },
  },
  {
    label: "counter: 'I'd like the fixed component to be 28' → 28 fixed",
    text: "I'd like the fixed component to be 28.",
    expect: { target: 28, targetComponent: "fixed" },
  },
  {
    // Inflection alignment: bare-integer "targeting" (no LPA unit) must
    // bind — the Pass-4 gate used to hardcode uninflected "target".
    label: "counter: 'I was really targeting 28 fixed though' → 28 fixed",
    text: "Appreciate that. I was really targeting 28 fixed though — can we get it closer to that?",
    expect: { target: 28, targetComponent: "fixed" },
  },
  {
    label: "copula: 'My expectations are 32' (bare) → 32 total",
    text: "My expectations are 32.",
    expect: { target: 32, targetComponent: "total" },
  },

  /* ── Compound current disclosure binds the TOTAL, not the leading
   *    component (live-staging 2026-06-19). "32 fixed plus 6 variable, so 38
   *    total" must yield currentCtc=38; the classifier processes spans
   *    left-to-right and the leading "32 fixed" used to grab the slot, so the
   *    explicit "38 total" was dropped and the bot under-counted current pay
   *    by the variable. An explicit total-scoped current span now overrides a
   *    component-scoped grab. */
  {
    label: "compound current: '32 fixed plus 6 variable, so 38 total' → current 38 (not 32)",
    text: "Current is 32 fixed plus 6 variable, so 38 total",
    ctx: { lastAiText: "what's the total CTC at present?" },
    expect: { currentCtc: 38, target: null },
  },

  /* ── Ask-anchor framing binds TARGET, never current; explicit walk-away
   *    FLOOR framing binds NEITHER (live-staging 2026-06-19).
   *
   *    Ask-anchor ("won't move for less than X, that's my number", "at least
   *    X", "X, non-negotiable") asserts the TARGET. The defect: when the
   *    bot's prior turn asked for the CURRENT package, the bare number fell
   *    through the Gricean "AI-asked-current → current" default and bound as
   *    currentCtc, overwriting the real current AND dropping the target.
   *
   *    A *walk-away floor* ("won't go below X", "my floor is X") is a DISTINCT
   *    concept from both current and target — the candidate's minimum, kept
   *    apart from their ask (see candidateFloor / extractFloor in
   *    _misc-signals.ts; the planner says "distinct from their target"). A
   *    floor must bind NEITHER role here: not current (the live bug) and not
   *    target (which would overwrite a separately-stated ask — see Gap B in
   *    negotiationLeverAndProbationValidation). Its value is captured as
   *    candidateFloor by the kernel, not by this classifier. */
  {
    label: "ask-anchor: 'won't move for less than 55 total, that's my number' (bot asked current) → target 55",
    text: "I won't move for less than 55 total, that's my number",
    ctx: { lastAiText: "And how is your current package structured?", phase: "probe-expectations" },
    expect: { target: 55, currentCtc: null, targetComponent: "total" },
  },
  {
    label: "ask-anchor: same, when bot asked current TOTAL CTC → target 55 (never current)",
    text: "I won't move for less than 55 total, that's my number",
    ctx: { lastAiText: "what's the total CTC at present?", phase: "probe-expectations" },
    expect: { target: 55, currentCtc: null },
  },
  {
    label: "walk-away floor: 'won't go below 55' binds NEITHER current nor target (→ candidateFloor)",
    text: "Honestly I won't go below 55.",
    ctx: { lastAiText: "your current package?" },
    expect: { target: null, currentCtc: null },
  },
  {
    label: "walk-away floor: 'my floor is 55' (bot asked current) binds NEITHER",
    text: "My floor is 55, I can't go below that.",
    ctx: { lastAiText: "what's your current CTC?" },
    expect: { target: null, currentCtc: null },
  },
  {
    label: "floor: 'at least 55 total' → target 55",
    text: "at least 55 total",
    expect: { target: 55, currentCtc: null },
  },
  {
    label: "floor: 'my number is 55, not a rupee less' → target 55",
    text: "my number is 55, not a rupee less",
    expect: { target: 55, currentCtc: null },
  },
  {
    label: "floor: '55, non-negotiable' (bot asked target) → target 55",
    text: "55, non-negotiable",
    ctx: { lastAiText: "And your target for this move?" },
    expect: { target: 55, currentCtc: null },
  },

  /* ── RIGHT-side target cue + unit-less competing (live-staging 2026-06-19) ──
   * Indian candidates put the target cue AFTER the number ("40 is my
   * number") and state competing offers unit-less ("competing offer at
   * 42"). Both previously emitted no bare-integer span and bound nothing.
   * Pass-4 now gates on a RIGHT-window target cue and a LEFT-window
   * competing cue in addition to the pre-existing left-target/current
   * gates. */
  {
    label: "RIGHT cue: '40 is my number' binds target",
    text: "40 is my number",
    expect: { target: 40, currentCtc: null },
  },
  {
    label: "two-number: 'competing offer at 42, so 40 is my number' splits competing+target",
    text: "I have a competing offer at 42, so 40 is my number.",
    ctx: { phase: "counter-offer" },
    expect: { target: 40, competing: 42 },
  },
  {
    label: "unit-less competing offer binds competing",
    text: "competing offer at 42",
    expect: { competing: 42, target: null },
  },
  {
    label: "'another offer at 38, but 45 is my ask' splits competing+target",
    text: "I have another offer at 38, but 45 is my ask.",
    ctx: { phase: "counter-offer" },
    expect: { target: 45, competing: 38 },
  },
  /* RIGHT-cue idiom coverage — candidates state the target as a "figure",
   * "expectation", or "bottom line" as often as "number/ask". */
  { label: "RIGHT cue: '42 is my final figure' binds target", text: "42 is my final figure", expect: { target: 42 } },
  { label: "RIGHT cue: '42 is my figure' binds target",       text: "42 is my figure",       expect: { target: 42 } },
  { label: "RIGHT cue: '45 is my expectation' binds target",  text: "45 is my expectation",  expect: { target: 45 } },
  { label: "RIGHT cue: '45 is my bottom line' binds target",  text: "45 is my bottom line",  expect: { target: 45 } },
  { label: "RIGHT-cue guard: 'I figure I'll need 30 days' binds nothing", text: "I figure I'll need 30 days", expect: { target: null, currentCtc: null } },

  /* ── Team / headcount LEFT-context guard (live-staging 2026-06-19) ──
   * A bare integer naming a team/group/headcount SIZE must never bind as
   * a salary figure. The collective noun sits BEFORE the number ("team of
   * 8") with nothing trailing, so the trailing NON_SALARY_UNIT guard can't
   * see it. In probe-expectations this leaked as target=8 and (8 ≤ offer)
   * false-closed the negotiation at turn 2. */
  { label: "team-of N in probe → no bind",      text: "I led the UPI roadmap, grew GMV 3x, and managed a team of 8.", ctx: { phase: "probe-expectations" }, expect: { currentCtc: null, target: null, competing: null } },
  { label: "group of N → no bind",              text: "I ran a group of 12 across two pods.", ctx: { phase: "probe-expectations" }, expect: { target: null } },
  { label: "headcount of N → no bind",          text: "My headcount of 30 spanned three teams.", ctx: { phase: "probe-expectations" }, expect: { target: null } },
  { label: "managed N engineers (trailing) → no bind", text: "I managed 20 engineers last year.", ctx: { phase: "probe-expectations" }, expect: { target: null } },
  { label: "team-size guard does NOT eat a real ₹N LPA target", text: "I managed a team of 8, and I'm targeting 40 LPA.", ctx: { phase: "probe-expectations" }, expect: { target: 40 } },

  /* ── Negative cases (must NOT bind) ────────────────────────────── */
  { label: "RIGHT-gate guard: '40 years old' binds nothing", text: "I'm 40 years old.",      expect: { currentCtc: null, target: null, competing: null } },
  { label: "RIGHT-gate guard: '40 people' binds nothing",     text: "My team has 40 people.", expect: { currentCtc: null, target: null, competing: null } },
  { label: "RIGHT-gate guard: '40 hours a week' binds nothing", text: "I work 40 hours a week.", expect: { currentCtc: null, target: null, competing: null } },
  { label: "rejects 100 crore (clamp)",  text: "I'm looking for 100 crore",             expect: { target: null } },
  { label: "rejects garbage commas",     text: "I'm expecting 30,00,000 lakhs",         expect: { target: null } },
  { label: "ignores N days",             text: "I need 30 days to decide",              expect: { currentCtc: null, target: null } },
  { label: "ignores N years YOE",        text: "I have 8 years of experience",          expect: { currentCtc: null, target: null } },
  { label: "ignores N% hike",            text: "looking for 30% hike",                  expect: { target: null } },
];

describe("number-role classifier — table-driven coverage", () => {
  for (const row of ROWS) {
    it(row.label, () => {
      const got = classifyNumberRoles(row.text, row.ctx ?? {});
      for (const [k, v] of Object.entries(row.expect) as Array<
        [keyof NumberRoleResult, NumberRoleResult[keyof NumberRoleResult]]
      >) {
        expect(got[k], `field=${k} text=${row.text!}`).toEqual(v);
      }
    });
  }
});
