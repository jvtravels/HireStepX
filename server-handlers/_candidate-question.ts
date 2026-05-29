/* Candidate-question topic classification + response bank.
 *
 * Replaces the regex-ladder `answer-direct` branch in `_canonical-prose.ts`
 * with a typed two-stage architecture:
 *
 *   1. `classifyCandidateQuestion(raw)` → `CandidateQuestionTopic | null`
 *      Deterministic intent classification; one function, one return type,
 *      no embedded prose. Pure (string → enum).
 *
 *   2. `renderCandidateQuestionResponse(topic, sector, round)` →
 *      `string` Persona-overlaid recruiter prose. Lookups in a single
 *      `RESPONSE_BANK` table keyed by topic with optional sector/round
 *      overrides. Adding a new topic = one entry in the union + one row in
 *      the bank; no `if` branches to extend.
 *
 * The previous design (BUG-006 sub-classifier) interleaved classification
 * and prose generation inside a ~70-line `if (/regex/.test(r)) return "..."`
 * chain. That layout couples three concerns:
 *   (a) which question intent the candidate expressed,
 *   (b) which recruiter persona is replying,
 *   (c) the literal recruiter wording.
 * Co-locating them blocked persona overlays (no way to vary the ESOP
 * answer by sector), made testing impossible (you can only assert the
 * full string, not the detected intent), and made every new topic a copy-
 * paste edit. This module separates the concerns.
 *
 * Architectural QA v3 round 3 (2026-05-19) — "solid fix, no patchwork"
 * directive.
 */

import type { RecruiterSectorPersona } from "./_indian-recruiter-personas";
import type { NegotiationRoundPersona } from "./_negotiation-rounds";
import type { NegotiationPhase } from "./_negotiation-kernel";
import type { CandidateRegister } from "./_candidate-register";

/* ─── Topic taxonomy ────────────────────────────────────────────────── */

/**
 * Closed enumeration of candidate-question intents the deterministic
 * core can recognise without an LLM. Each value maps to exactly one
 * row in `RESPONSE_BANK`. Order is informational only — match priority
 * is encoded by `INTENT_PATTERNS` order below.
 *
 * If a new topic is needed: (1) add a union member here, (2) add a
 * `RESPONSE_BANK` row, (3) add an `INTENT_PATTERNS` entry. The classifier
 * and renderer pick it up automatically — no changes to call sites.
 */
export type CandidateQuestionTopic =
  | "esop-structure"          // ESOP/RSU/vesting/cliff/exercise questions
  | "fixed-variable-split"    // breakup / fixed-vs-variable / structure
  | "budget-disclosure"       // budget / range / final offer / room
  | "in-hand-monthly"         // monthly take-home / per-month math
  | "review-cycle"            // appraisal / next cycle / 6-month review
  | "location-remote"         // remote / WFH / different city / relocation
  | "verification-bgv"        // salary slip / BGV / proof / verification
  | "benefits-non-ctc"        // insurance / PF / gratuity / perks
  | "notice-buyout"           // notice period / buyout / early join
  | "variable-mechanics"      // variable guaranteed / KPI / payout formula
  | "range-grade-leverage"    // grade revisit / max offer / why lower
  | "tax-structuring"         // tax efficient / flexi plan / structuring
  | "channel-switch"          // take this on a call / email instead
  | "meta-coaching";          // candidate asking what to say (defensive)

interface IntentPattern {
  topic: CandidateQuestionTopic;
  /** Single regex describing the intent. Must match against
   *  lowercased input. Order in `INTENT_PATTERNS` defines priority on
   *  multi-match (first wins). */
  match: RegExp;
}

/* ─── Intent patterns (priority-ordered) ────────────────────────────── */

/* Priority rationale: more-specific topics first, so a question that
 * mentions both "ESOP" and "structure" classifies as `esop-structure`,
 * not `fixed-variable-split`. Channel/meta intents sit at the bottom —
 * they only fire when nothing substantive matches. */
const INTENT_PATTERNS: ReadonlyArray<IntentPattern> = [
  { topic: "esop-structure",        match: /\b(?:esop|rsu)\b|equity|exercise\s+price|vesting|cliff/ },
  { topic: "in-hand-monthly",       match: /\bmonthly\b|in[- ]?hand|take[- ]?home|per\s*month|\bp\.?m\.?\b/ },
  { topic: "review-cycle",          match: /\breview\b|appraisal|cycle|6[- ]?month|six[- ]?month|next\s+cycle/ },
  { topic: "location-remote",       match: /\bremote\b|\bwfh\b|work\s+from\s+home|different\s+city|relocat/ },
  { topic: "verification-bgv",      match: /salary\s+slip|payslip|verification|\bbgv\b|background|proof|document/ },
  { topic: "benefits-non-ctc",      match: /benefit|perk|apart\s+from\s+ctc|non[- ]?ctc|insurance|gratuity|\bpf\b|provident|allowance/ },
  { topic: "notice-buyout",         match: /\bnotice\b|buyout|early\s+join|early.*joining|\bserve\b/ },
  { topic: "variable-mechanics",    match: /variable.*guaranteed|guaranteed.*variable|performance[- ]?based|individual\s+or\s+company|individual\s+vs\s+company|payout\s+(?:formula|criteria)/ },
  { topic: "tax-structuring",       match: /tax\s+efficient|tax\s+optimised|tax\s+optimized|structuring|flexi\s+plan|flexible\s+benefit/ },
  { topic: "fixed-variable-split",  match: /(?:fixed.*variable|variable.*fixed|fixed\s+and\s+(?:the\s+)?variable|breakup|\bsplit\b).*(?:how\s+much|what(?:'s| is)|tell\s+me|help\s+me\s+understand|comfort)|(?:how\s+much|what(?:'s| is)|tell\s+me|help\s+me\s+understand|comfort).*(?:fixed.*variable|variable.*fixed|fixed\s+and\s+(?:the\s+)?variable|breakup|\bsplit\b)|(?:share|give|provide|walk\s+me\s+through|explain|tell\s+me|can\s+you|could\s+you|what(?:'?s| is)|need|want)\s+(?:me\s+|us\s+)?(?:the\s+|a\s+|an\s+)?(?:break(?:down|up)|split|structure|components?)\b|(?:break(?:down|up)|split|structure|components?)\s+of\s+(?:the\s+|this\s+|that\s+|\d)|summari[sz]e\s+(?:the\s+)?offer|recap\s+(?:the\s+)?offer|what\s+is\s+(?:the\s+)?base\b|base\s*,?\s*variable\s*,?\s*bonus/ },
  { topic: "budget-disclosure",     match: /\bbudget\b|what(?:'s| is)\s+(?:the\s+)?(?:range|band)|what\s+can\s+you\s+offer|what\s+number\s+can\s+you\s+give|final\s+offer|room\s+to\s+negotiate|any\s+room/ },
  { topic: "range-grade-leverage",  match: /broad\s+range|share.*range|range\s+(?:for|at)|\bgrade\b|\blevel\b|maximum.*offer|max.*offer|market\s+(?:salary|range)|why.*lower|revisit\s+(?:compensation|grade|level)/ },
  { topic: "channel-switch",        match: /over\s+a\s+call|on\s+a\s+call|on\s+the\s+phone|switch\s+to|email\s+instead|in\s+writing|in\s+person|face\s+to\s+face|\bf2f\b/ },
  { topic: "meta-coaching",         match: /what\s+should\s+i\s+say|what\s+do\s+i\s+say|should\s+i\s+say|help\s+me\s+phrase|how\s+do\s+i\s+answer/ },
];

/**
 * Canonical sample utterances per topic. One natural-language probe per
 * `CandidateQuestionTopic`. Used by the response-bank linter to assert
 * round-trip safety (classifier fires the topic → renderer ships prose).
 *
 * Co-located with `INTENT_PATTERNS` so adding a new topic forces a
 * sample probe via TypeScript's `Record<UnionType, T>` exhaustiveness
 * check — drift-resistant by construction. If a new topic lands without
 * an entry here, the typechecker fails before the linter even runs.
 *
 * 2026-05-29 audit pass — replaces the hand-rolled probe array in the
 * linter test that drifted from `INTENT_PATTERNS` (caught when a probe
 * matched no pattern). Probes must be sentences the corresponding
 * regex would actually match against lowercased input.
 */
export const TOPIC_PROBES: Record<CandidateQuestionTopic, string> = {
  "esop-structure":       "Can you walk me through the ESOP vesting?",
  "in-hand-monthly":      "What's the monthly in-hand?",
  "review-cycle":         "When is the next review cycle?",
  "location-remote":      "Is remote allowed?",
  "verification-bgv":     "Will you need a salary slip for BGV?",
  "benefits-non-ctc":     "What benefits apart from CTC?",
  "notice-buyout":        "Can you support a buyout on notice?",
  "variable-mechanics":   "Is the variable guaranteed?",
  "tax-structuring":      "Can the package be tax efficient?",
  "fixed-variable-split": "Can you share the breakdown of the offer?",
  "budget-disclosure":    "What's the budget for this role?",
  "range-grade-leverage": "What's the maximum offer at this grade?",
  "channel-switch":       "Can we take this on a call?",
  "meta-coaching":        "What should I say if I want more?",
};

/**
 * Pure intent classifier. Returns the first matching topic or `null` if
 * no pattern fires. Lowercases internally so callers can pass raw input.
 */
export function classifyCandidateQuestion(
  raw: string | null | undefined,
): CandidateQuestionTopic | null {
  if (!raw) return null;
  const r = raw.toLowerCase();
  /* PDF#37 BUG-F (2026-05-20) — disambiguate vesting+buyout compound.
   * The `esop-structure` pattern fires on bare `vesting|cliff`, which
   * captures a question like "what about buyout — does notice vesting
   * apply here?" as ESOP-structure even though the candidate is
   * asking about notice-period buyout. When the input mentions BOTH
   * an equity token AND a notice/buyout token, prefer `notice-buyout`
   * — buyout is the rarer, more specific intent and the equity word
   * is usually being borrowed metaphorically (or co-occurring as a
   * separate clause the reactive-followup layer will pick up next).
   * Pure precedence flip is wrong (would mis-route plain "what's the
   * vesting schedule"); the compound test runs ONLY when both signal
   * families are present. */
  const hasBuyout = /\bnotice\b|buyout|early\s+join|early.*joining|\bserve\b/.test(r);
  const hasEquity = /\b(?:esop|rsu)\b|equity|exercise\s+price|vesting|cliff/.test(r);
  if (hasBuyout && hasEquity) return "notice-buyout";
  for (const { topic, match } of INTENT_PATTERNS) {
    if (match.test(r)) return topic;
  }
  return null;
}

/* ─── Response bank ─────────────────────────────────────────────────── */

/**
 * Per-topic recruiter prose. The base string is the sector-neutral /
 * round-neutral default. Optional `sectorOverrides` and `roundOverrides`
 * tilt the prose for known persona combinations — e.g. a BFSI HR partner
 * answers ESOP differently from an early-startup hiring manager.
 *
 * Overrides are sparse on purpose: only override when the base wording
 * is materially wrong for that persona. Most topics need no override.
 */
/* 2026-05-29 sector-flavor pass — edtech + consulting-mbb were added
 * to the canonical RecruiterSectorPersona union (see
 * `_indian-recruiter-personas.ts`), so the response-bank entries for
 * those sectors now key directly off the canonical type. The
 * previously-local RecruiterSectorPersona widening is no longer needed. */

interface ResponseBankEntry {
  base: string;
  /* Sector overrides serve two distinct purposes (post 2026-05-29):
   *
   * (a) CONTENT correction — when the base wording is materially wrong
   *     for the persona. e.g. `bfsi` doesn't run ESOPs, so the
   *     esop-structure base ("you'll see the cash component as guaranteed
   *     and the ESOP as a 4-year grant on top") is factually misleading
   *     and the override flips to "we don't run ESOPs at this grade."
   *
   * (b) PERSONA TONE — when the base wording is *correct* but reads in
   *     a register that doesn't match the persona. e.g. an `early-startup`
   *     recruiter is unlikely to open a meta-coaching response with "I'll
   *     let you frame it the way you're comfortable" — a startup register
   *     opens with "no pressure on the framing, just talk normally." Same
   *     content, different voice.
   *
   * Both live in this slot. Content corrections are mandatory wherever the
   * base would mislead; tone overrides are sparse on purpose — only add
   * one when the base feels noticeably off-register for that persona. */
  sectorOverrides?: Partial<Record<RecruiterSectorPersona, string>>;
  roundOverrides?: Partial<Record<NegotiationRoundPersona, string>>;
  /** 2026-05-29 realism-pass — phase-tinted variants.
   *
   * The audit flagged "no tone modulation by phase" — the same wording
   * ships whether the recruiter is anchoring (guarded), counter-negotiating
   * (clinical), or closing (warmer). Real recruiters shift register
   * meaningfully between these. Phase-tinted variants are the same
   * content as `base` but re-voiced for the active phase. Picked
   * deterministically when present; falls back to neutral variant
   * rotation otherwise.
   *
   * Sparse on purpose — only set for topics where the phase shift is
   * meaningfully audible (budget / range / structure / notice during the
   * close, mostly). Adding one tints that surface during that phase;
   * leaving it null lets variant rotation handle the topic. */
  phaseTinted?: Partial<Record<NegotiationPhase, string>>;
  /** 2026-05-29 realism-pass P0-7 — sector × phase composition.
   *
   * Pre-P0-7 the precedence was a flat ladder (round → sector → phase →
   * variant); only one slot fired per render. That made it impossible
   * to say "PSU recruiter in closing-push" — the sector override won
   * and the closing-push warmth was lost, or vice-versa. Real
   * conversations need both: the persona stays PSU (formal, grade-pay
   * framing) but the cadence warms when we're close to a yes.
   *
   * `sectorPhaseOverrides[sector][phase]` is checked BEFORE the flat
   * `sectorOverrides` and `phaseTinted` slots — it's the most specific
   * combination, so it wins. Falls through to `sectorOverrides` if
   * sector matches but no phase entry exists; falls through to
   * `phaseTinted` if phase matches but the sector isn't enumerated.
   *
   * Sparse on purpose. Add an entry only when both signals are
   * audibly active and the flat overrides would lose meaning. */
  sectorPhaseOverrides?: Partial<Record<
    RecruiterSectorPersona,
    Partial<Record<NegotiationPhase, string>>
  >>;
  /** 2026-05-29 realism-pass P0-2 — register-mirrored variants.
   *
   * The candidate's inferred register (formal / casual / direct / neutral)
   * sets the air in the room. Real recruiters mirror it: a candidate who
   * says "just give me the number" doesn't get a four-sentence flexi-plan
   * explanation, and a candidate who says "kindly walk me through the
   * structure" doesn't get "yeah so basically".
   *
   * Same content, different voice — like phaseTinted but keyed off the
   * candidate's register instead of the negotiation phase. Sparse on
   * purpose: only populate where the register-mismatch is audible enough
   * to break realism (clipped/direct candidates on disclosure topics are
   * the prime case). Falls through to phaseTinted → variants → base when
   * unset for the active register. */
  registerVariants?: Partial<Record<CandidateRegister, string>>;
  /** 2026-05-29 realism-pass — paraphrase variants.
   *
   * Conversational-realism fix from the audit. Pre-2026-05-29 each
   * topic had ONE pre-written answer that shipped word-for-word every
   * time the topic matched. Repeat sessions surfaced the same prose
   * verbatim, which read as machine. Variants are alternative phrasings
   * of the SAME content (same facts, same stance, same persona register)
   * — never a different answer, just a different way to say it.
   *
   * Picked deterministically by `pickVariant(seed, candidates)` so a
   * given session is consistent within itself but two sessions asking
   * the same topic get different prose. Keeps the curated-prose
   * guarantee (no hallucination) while removing the recognisable
   * cadence. */
  variants?: readonly string[];
}

const RESPONSE_BANK: Record<CandidateQuestionTopic, ResponseBankEntry> = {
  "esop-structure": {
    base:
      "On the ESOP piece — equity is reported separately from cash CTC: the offer letter splits fixed, variable, and ESOPs with the vesting schedule and cliff. So you'll see the cash component as guaranteed and the ESOP as a 4-year grant on top.",
    variants: [
      "Quick on the ESOP — the offer letter keeps cash CTC and equity on separate lines. Fixed plus variable on one side, ESOPs with the vest schedule and cliff on the other. So the cash piece reads as guaranteed and the ESOPs sit as a four-year layer on top.",
      "On equity — we don't bundle ESOPs into the headline CTC number. The letter shows fixed, variable, and the ESOP grant separately, with the vest and cliff spelled out. Think of the cash as your base and the equity as the four-year upside.",
    ],
    phaseTinted: {
      /* Closing-push register: educational tone drops, recruiter wants
       * to lock the cash piece and treat ESOPs as the upside that
       * doesn't block the close. */
      "closing-push":
        "On ESOPs — let's not let equity slow us down here. The cash side is what you're getting guaranteed; ESOPs are a four-year layer on top with vest and cliff in the letter. Sign on the cash and the equity comes attached.",
    },
    sectorOverrides: {
      "early-startup":
        "On the ESOP piece — at this stage equity is a meaningful chunk of the total: the offer letter shows fixed, variable, and ESOPs separately with a 4-year vest and a 1-year cliff. The cash sits where the market is; the ESOP is the upside if we get to the next round.",
      "bfsi":
        "On the ESOP piece — we don't run ESOPs at this grade; comp is structured as fixed plus performance-linked variable. If equity exposure matters to you, I should flag that upfront so you can weigh it against the cash strength.",
      "it-services":
        "On the ESOP piece — ESOPs aren't part of the standard grade structure here; the comp is fixed plus a performance bonus. The offer letter will reflect that and the bonus criteria are documented separately.",
      /* 2026-05-29 sector-flavor pass — unicorn recruiters frame ESOPs as
       * the marquee upside: substantial grant, post-IPO scenario already
       * in the conversation. Materially different register from a bank's
       * "we don't run ESOPs" or a services co's "bonus instead". */
      "indian-unicorn":
        "On the ESOP piece — equity is a real component of the package here, not a token line. The offer letter shows fixed, variable, and an ESOP grant on a 4-year vest with a 1-year cliff. We're at a stage where the strike is still meaningful — if a liquidity event lands, the equity outpaces the cash side comfortably.",
      /* GCC / captive register — grants typically come from the parent
       * entity as RSUs (not ESOPs), denominated in USD, quarterly vest
       * post-cliff. Calling them "ESOPs" lands wrong; the captive's
       * tooling is the parent-company stock plan portal. */
      "gcc":
        "On the equity piece — at the captive we don't run local ESOPs; what's on the table is an RSU grant from the parent, denominated in USD, on a 4-year quarterly vest after the 1-year cliff. You'll administer it through the parent's stock plan portal. The cash CTC and the RSU grant sit on separate lines in the offer.",
      /* 2026-05-29 sector-flavor pass — edtech post-correction reality.
       * Most edtech ESOP grants issued at 2021-2022 valuations are deep
       * underwater after the 2023-2024 sector reset; recruiters now front
       * the math honestly rather than sell the upside. Tone is wary —
       * candidates have heard the pitch, want the strike-vs-FMV truth. */
      "edtech":
        "On the ESOP piece — I'll be straight with you: most grants issued at the previous round are underwater after the sector correction, and we're not going to pretend otherwise. The letter will show the grant with strike and FMV side by side so you can see where it actually sits today. Treat the cash as the real package; the equity is a long bet on the next up-round, not a number to plan around.",
      /* Consulting-MBB (McKinsey/BCG/Bain) — pre-MBA tiers don't carry
       * equity at all; comp is base + performance bonus + study-leave /
       * sponsorship sweeteners. Register is professional and structured. */
      "consulting-mbb":
        "On equity — at the pre-MBA tier we do not carry an ESOP or equivalent equity vehicle; the compensation is structured as base plus performance bonus, with study leave and MBA sponsorship as the longer-horizon levers. The offer letter will reflect base, target bonus, and the sponsorship clause separately. Happy to walk through the bonus mechanics and the sponsorship terms in detail.",
    },
  },
  "fixed-variable-split": {
    base:
      "On the structure — the breakup will include fixed cash, variable target (paid quarterly against KPIs), and ESOPs as a separate component. Are you comfortable with that shape, or would you want me to size the fixed harder against the variable?",
    variants: [
      "On the split — three pieces: fixed cash, a variable target paid quarterly on KPIs, and ESOPs as a separate line. Does that shape work, or do you want me to push the fixed up and dial the variable down?",
      "Structure-wise it's fixed plus a quarterly variable against KPIs, with ESOPs sitting separately. Happy to size the fixed harder if that's what works better for you — just say the word.",
    ],
    phaseTinted: {
      "closing-push":
        "On the split — last thing I want is for you to sign something and feel the variable shape is off. Want me to push the fixed up before we close? Easier to fix it now than after the letter.",
    },
    registerVariants: {
      "direct":
        "Fixed cash, quarterly variable on KPIs, ESOPs separate. Want the fixed pushed up?",
    },
    sectorOverrides: {
      /* P0-6 — sector framing diverges materially on this topic.
       * FMCG management trainee pipelines anchor on fixed cash + a
       * grade-linked annual bonus paid yearly (not quarterly); ESOPs
       * usually aren't on the table at MT grade. PSU pay is grade-pay
       * + DA + HRA per cadre rules with no variable in the
       * private-sector sense. Big-4 leans on the consulting framework
       * lexicon. Each persona's offer letter actually reads differently
       * — the base wording would mislead. */
      "consulting-big4":
        "On structure — our compensation framework breaks fitment into fixed, target variable on the quarterly cycle, and ESOPs as a separate vehicle. Variable weighting flexes by level. If the shape doesn't work, partner can re-balance fixed against variable within the same total.",
      "fmcg-management":
        "On structure — fitment at this grade is fixed cash plus an annual performance bonus tied to the grade-band payout (paid once a year, not quarterly). ESOPs don't sit at MT level. If you want me to weight the fixed harder, the bonus envelope shrinks correspondingly — same total, different shape.",
      "psu":
        "On the structure piece — the compensation here follows cadre rules: basic + grade pay + DA + HRA, with the band fixed for the level. There isn't a variable component in the private-sector sense; the only deviation has to be approved at the deputy GM level. Happy to walk you through the grade-wise heads if useful.",
      /* Edtech post-correction — growth math has flattened, the aggressive
       * variable-on-revenue shape from the boom years is gone. Joining
       * bonuses are rare; recruiters are slightly defensive about it. */
      "edtech":
        "On structure — the shape these days is more conservative than what the sector ran during the growth years: fixed cash, a modest annual performance bonus tied to BU outcomes, and ESOPs as a separate component that I'll be honest is mostly underwater right now. Joining bonus isn't really on the table at this grade anymore — we're not in 2021. If the variable shape feels light, that's because we'd rather over-deliver on it than promise a number we'd have to claw back.",
      /* MBB pre-MBA — pay bands are intake-cohort rigid, no base
       * negotiation; bonus is the only lever. Study leave / B-school
       * sponsorship is the sweetener. */
      "consulting-mbb":
        "On structure — the firm operates rigid pay bands by intake-cohort at the pre-MBA tier; base is set by the band and there isn't a negotiation lane on the fixed piece itself. The lever we have is the performance bonus, which is calibrated against your year-end ranking and can move materially. We also formally commit to study leave for the GMAT window and have a structured B-school sponsorship policy — those are real economic levers even if they don't show on the headline.",
    },
  },
  "budget-disclosure": {
    base:
      "On the budget — I can't share the full internal band, but the fitment sits in a defined corridor for this grade. If you share even a rough target, I'll tell you straightaway whether it lands.",
    variants: [
      "On budget — I can't put the internal band on the table, but I can tell you we have a defined corridor at this grade. Give me a rough target and I'll say straight away whether it lands or whether there's a gap.",
      "Budget-wise — the band stays internal, that's a panel call. What I can do is take your number and tell you immediately if it's in the corridor or if we'll need to work to close a gap.",
    ],
    phaseTinted: {
      "closing-push":
        "On budget — we're close enough that I'd rather not keep dancing around the band. Give me your final number and I'll go to the panel one more time with it. I want this to land.",
      "opening":
        "On the budget piece — bit early to be giving you the internal band, but the fitment for this grade sits in a defined corridor. If you share roughly what you're looking for, I'll tell you upfront whether it lands in the same zone.",
      "counter-offer":
        "On the budget — panel's heard you out, and your positioning landed well. The corridor hasn't widened on paper, but I have more room to fight within it now than I did in round 1. Give me your number and I'll take it up.",
    },
    registerVariants: {
      /* Direct candidate ("just tell me the number") — drop the corridor
       * preamble, match their cadence. */
      "direct":
        "Can't share the band. Give me your target and I'll tell you straight if it lands or if there's a gap.",
      /* Formal candidate ("kindly share the range") — keep the full
       * corridor framing, tighten to written-register cadence. */
      "formal":
        "On the budget piece — I won't share the internal band, but the fitment for this grade sits in a defined corridor. If you share your expectation, I'll tell you straightaway whether it lands.",
    },
    sectorOverrides: {
      /* PSU formality + escalation register — real PSU HR routes
       * compensation conversations through grade-pay rules + DGM/GM
       * approval lines. The base reads as private-sector smooth which
       * lands wrong here. */
      "psu":
        "On the budget piece — grade-pay rules govern the fitment at this level, and any deviation has to be signed off by the deputy GM. If you can share your expectation in writing, I'll put it through the approval line and revert with where we land.",
      /* Big-4 register — consulting recruiters anchor in "band /
       * fitment corridor" language; "panel" is replaced by "P&C". */
      "consulting-big4":
        "On budget — the fitment corridor is set by P&C against the grade we've slotted you at. I can't share the corridor itself, but share your expectation and I'll tell you whether we're within fitment or whether the partner has to be looped in.",
      /* Edtech — bands have been re-cut after the correction and the
       * recruiter is slightly defensive about it; growth-math justifies
       * less than it used to, and joining bonuses aren't lubricating the
       * conversation anymore. */
      "edtech":
        "On the budget piece — I'll level with you: the bands at this grade got re-cut after the sector reset, so the number we can put on the table is going to feel tighter than what you might've heard from edtech recruiters two years ago. Share your expectation and I'll tell you straight whether it lands in the new band or whether we're going to have to have a harder conversation. Joining bonus isn't really a lever I have anymore.",
      /* MBB pre-MBA — bands are intake-cohort fixed. Base isn't on the
       * table; the recruiter routes the conversation to bonus / study
       * leave levers without apologising for the band rigidity. */
      "consulting-mbb":
        "On budget — the pre-MBA band at this intake-cohort is set firm by the regional partnership; there is no negotiation lane on base, and I'd be misleading you to suggest otherwise. Where we have movement is on the target performance bonus, the study-leave commitment, and the sponsorship structure. Share your expectation and I'll tell you which of those levers we can shape to get you closer to the total economics you're looking for.",
    },
    roundOverrides: {
      "director":
        "On the budget — at this level the fitment isn't a single number, it's a corridor we move inside based on the panel's read of you. Give me a rough target and I'll tell you if we're in the same zip code.",
    },
    sectorPhaseOverrides: {
      /* P0-7 composition — sector content + phase warmth combined.
       * Without composition, the sector override suppresses the
       * phase tint (or vice-versa) and the recruiter loses either
       * the persona content or the closing cadence. */
      "psu": {
        "closing-push":
          "On the budget piece — we've gone back and forth on this long enough. If you can put your final expectation down in writing, I'll personally walk it to the deputy GM today and revert with where we land. I'd like to close this from our side as well.",
      },
      /* Conv-pass — Hinglish-tinted closing-push for sectors where the
       * recruiter would naturally code-switch on a warm close. Tic-level,
       * not pidgin: one "haan na" / "achha" / "thoda" per variant max.
       * Suppressed for PSU / BFSI / consulting-big4 (formal English
       * register holds even at close). */
      "indian-unicorn": {
        "closing-push":
          "Achha, look — we're close enough now that I don't want to keep dancing around the band, haan na. Give me your final number and I'll push it through one more time. Let's close this today.",
      },
      "early-startup": {
        "closing-push":
          "Look, we've been at this a while — bata do what you actually want and I'll take it to the founder one more time. Don't want to lose you on a number gap we can close.",
      },
      "it-services": {
        "closing-push":
          "Yeah so, we're around the same range basically — thoda flexibility hai still. Tell me your final number, I'll take it to the panel one more time and revert today itself.",
      },
    },
  },
  "in-hand-monthly": {
    base:
      "On the in-hand piece — the monthly take-home depends on your tax declarations and structuring (HRA, LTA, NPS), so the offer letter will show a band rather than a single number. We can walk through the structuring sheet once the fitment is locked.",
    variants: [
      "On in-hand — the monthly is a band, not a fixed number, because it moves with your declarations: HRA, LTA, NPS, the standard flexi heads. Once we lock fitment I'll get the structuring sheet over so you can plan it properly.",
      "Take-home depends on how you declare — HRA, NPS, LTA shift the monthly meaningfully. The letter will show a range, not a single figure. We can sit on the structuring sheet together once the fitment piece is closed.",
    ],
    phaseTinted: {
      /* Closing-push: stop explaining the structuring mechanics in
       * detail, push to lock fitment and handle in-hand math
       * post-signature with the comp team. */
      "closing-push":
        "On in-hand — let's not get bogged down in the structuring math now. Lock fitment today and I'll have the comp team sit with you on the structuring sheet within the week. You'll have the take-home pinned before joining.",
    },
  },
  "review-cycle": {
    base:
      "On the review piece — the next appraisal cycle is anchored to the company calendar, and joiners are usually eligible on a pro-rated basis once they've crossed the qualifying tenure. I can have the cycle dates and eligibility rule confirmed in writing alongside the offer.",
    variants: [
      "On appraisal — the cycle runs on the company calendar, and joiners typically come in pro-rated once they've crossed the qualifying tenure. I'll have the dates and the eligibility rule written into the offer alongside the comp piece.",
      "Review-wise — fixed cycle on the company calendar, pro-rated participation for joiners after the qualifying tenure. Happy to get both the cycle dates and the eligibility rule confirmed in writing when the offer goes out.",
    ],
    phaseTinted: {
      /* Closing-push: stop offering to confirm in writing — that's a
       * scheduling commitment now, not a future "if we get there". */
      "closing-push":
        "On the review — cycle dates and the pro-rated eligibility rule go into the offer letter today. You'll see exactly when your first review lands before you sign. Don't let the appraisal piece hold up the close.",
    },
  },
  "location-remote": {
    base:
      "On the location piece — the fitment doesn't change for remote or different-city, but the allowance structure (HRA, location pay) does shift to match the policy for that city. I can pull the city-wise structuring before we lock the offer.",
    variants: [
      "On location — the headline fitment holds whether you're remote or in a different city, but the allowance heads (HRA, location pay) move to match the city policy. I can have the city-wise structuring pulled before we lock the letter.",
      "Remote / different-city doesn't change the fitment number — what changes is the allowance shape (HRA, location pay) which is policy-driven per city. Tell me which city and I'll get the structuring pulled.",
    ],
    phaseTinted: {
      /* Closing-push: defer allowance math post-signature. The
       * candidate has already decided the role; city allowances are
       * a structuring detail that doesn't need to slow the close. */
      "closing-push":
        "On location — fitment holds. Tell me your city and I'll have HRA set in the offer letter you'll review this evening before you sign. Not a reason to delay.",
    },
  },
  "verification-bgv": {
    base:
      "Noted on the verification piece — slips can come at the formal BGV stage. For now let's first align on whether the range works for you, and then I'll move it through the panel.",
    variants: [
      "Noted on verification — that piece sits at the formal BGV stage, not here. For now let's first see if the range works for you; if it does I'll move it to the panel and BGV picks up from there.",
      "On verification — let's keep that for the BGV stage where it formally belongs. Right now I just want to know if the range works for you, then I'll take it forward.",
    ],
    phaseTinted: {
      /* Closing-push: BGV is post-acceptance machinery; explicitly
       * route it to the vendor and stop treating it as a pre-close
       * gate. Recruiter doesn't want a paperwork item to derail
       * an otherwise-aligned candidate. */
      "closing-push":
        "On verification — that's vendor-handled post-acceptance, you'll get the BGV portal link with the letter. Nothing here that should block us closing today; let's not lose momentum on a paperwork item.",
    },
    sectorOverrides: {
      /* P0-5 — BFSI BGV is materially heavier than other sectors: it
       * runs the bank's compliance vendor with regulatory checks
       * (CIBIL, court records, criminal). Saying "vendor-handled"
       * undersells the friction. PSU adds character-and-antecedent
       * verification through police channels. IT-services often
       * accepts a salary slip at offer stage, not post-acceptance. */
      "bfsi":
        "On verification — at this stage we'll need salary slips for the last three months along with appointment + relieving letters. BGV runs through the bank's compliance vendor post-acceptance with CIBIL, employment, and criminal checks — it's heavier than non-BFSI. Worth flagging upfront so there are no surprises.",
      "psu":
        "On the verification piece — at this grade BGV is character and antecedent verification through the police channel, plus formal documentation of all prior service. It moves slowly but it's standard. I can share the document list once we're aligned on fitment.",
      "it-services":
        "On verification — we typically ask for the latest three salary slips at the offer stage itself, not post-acceptance. BGV runs in parallel through our vendor. If there's a gap in the documentation timeline, easier to flag now than at the offer stage.",
    },
  },
  "benefits-non-ctc": {
    base:
      "On the benefits piece — beyond cash CTC there's group medical (self + family), gratuity, PF as per statute, and a few flexi allowances under the structuring envelope. I can share the full benefits sheet alongside the offer letter.",
    variants: [
      "On benefits — over and above the cash CTC: group medical for self + family, gratuity, PF per statute, plus the flexi allowances. I'll share the full benefits sheet with the offer letter so you have everything in one place.",
      "Outside cash CTC — there's medical (self plus family), gratuity, PF, and the standard flexi heads. Not headline-grabbing but it adds up. Full sheet goes with the offer.",
    ],
    phaseTinted: {
      /* Closing-push: don't re-walk benefits, defer to written sheet.
       * The objective shifts from informing to closing. */
      "closing-push":
        "On benefits — the full sheet's already going across with the letter, so you'll have medical, gratuity, PF, flexi — all of it in writing within the day. Read it once you have it. For now let's not let the non-cash piece slow the close.",
    },
    sectorOverrides: {
      /* P0-5 — benefits shape diverges sharply by sector. PSU adds
       * LTC, leave encashment, pensions, residential allotment.
       * BFSI typically has the strongest medical (parents covered
       * separately, top-up at employer cost). Early-startup is
       * thinner but flexible. */
      "psu":
        "On the benefits piece — the entitlements at this grade include LTC every two years, leave encashment as per rules, NPS contribution, and residential allotment subject to availability. Medical coverage extends to dependent parents at the empanelled hospitals. I can share the full benefits booklet from the establishment side.",
      "bfsi":
        "On benefits — beyond cash CTC: group medical for self + spouse + children + parents (separate parent floater, employer-paid), gratuity, PF, plus a soft-loan facility on standard bank rates. Stronger on medical than the market median; full sheet goes with the letter.",
      "early-startup":
        "On benefits — we keep it lean and honest: medical for self + family, statutory PF and gratuity, flexible leave policy without a fixed count. No fancy flexi structuring at this stage but we're not playing games with the math either. Sheet goes with the letter.",
    },
  },
  "notice-buyout": {
    base:
      "On the notice piece — buyout support is case-by-case and tied to the urgency from the hiring side. If they want an early join, I can take the buyout ask to the panel with your notice-period letter as evidence.",
    variants: [
      "On buyout — that's case-by-case, driven by how urgently the hiring side wants you to start. If early join matters to them, I can carry the buyout ask to the panel — but I'll need your notice letter as evidence to back it.",
      "Notice / buyout — not a standard line item, it gets decided on urgency. Share the notice-period letter and if the hiring team wants an early start, I'll put the buyout ask on the table.",
    ],
    phaseTinted: {
      "closing-push":
        "On buyout — if the early-join is a deal-maker for you, send me the notice letter today and I'll get the buyout signed off this evening. Let's not let logistics hold up the close.",
    },
    /* 2026-05-29 sector-flavor pass — notice/buyout treatment diverges
     * sharply by sector. Indian unicorns burn cash to compress joining
     * dates; BFSI rarely buys out due to policy (and asks for serving
     * full notice); GCCs route through global mobility with a fixed
     * reimbursement ceiling. The flat phase tint above reads as
     * private-startup-default, which mis-frames the other personas. */
    sectorOverrides: {
      "indian-unicorn":
        "On the buyout piece — we do support buyouts where the hiring side wants to compress the joining date; it's not a standard line but it gets approved fairly often at this grade. Share the notice letter and the recovery clause from your current employer and I'll put the ask in front of the panel today itself.",
      "bfsi":
        "On the notice piece — buyouts at this level are not standard policy; the expectation is that the candidate serves the full notice as per the prior employer's contract. In exceptional cases we can request a partial waiver from HR, but I'd be setting wrong expectations if I said it's routine. Easier to plan the joining date around the full notice.",
      "gcc":
        "On notice / buyout — at the captive this routes through global mobility rather than local HR. There's a fixed reimbursement ceiling set at the regional level, and the ask needs the hiring manager's sign-off plus documentation of the recovery from your prior employer. Share the notice letter and the buyout amount in writing and I'll start the workflow.",
    },
    sectorPhaseOverrides: {
      "indian-unicorn": {
        "closing-push":
          "Haan na, on the buyout — if the early join is the deal-maker, send me the notice letter today itself and I'll get it signed off this evening. Don't let logistics hold up the close.",
      },
      "it-services": {
        "closing-push":
          "On buyout — thoda flexibility hai from our side if you can share the notice letter today. I'll route it to the panel and revert by EOD. Let's not let the joining piece slow this down.",
      },
    },
  },
  "variable-mechanics": {
    base:
      "On the variable piece — variable is target-based, not guaranteed: payout sits between 0 and 200% of target against KPIs that get locked in the first quarter. The split between individual and company KPIs varies by grade — I can have the comp team share the policy doc once you're onboarded.",
    variants: [
      "On variable — target-based, not guaranteed. Payout runs zero to two-hundred percent of target against KPIs locked in the first quarter. The individual-vs-company KPI split moves with grade; comp team owns the policy doc, which you'll see post-joining.",
      "Variable's a target, not a floor — anywhere between zero and 200% based on quarterly KPI performance. KPIs get locked in Q1, and the individual / company weight depends on the grade you're slotted at. Policy doc shares post-joining.",
    ],
    phaseTinted: {
      /* Closing-push: drop the policy-doc framing and speak to the
       * candidate's actual concern — that the variable might be a
       * downside risk on the headline. Reframe to "target = realistic". */
      "closing-push":
        "On variable — last thing I want is for the variable line to be the reason you hesitate. Targets here aren't aspirational, they're built off historical achievement at the grade — most folks land around 100% or better. Sign the offer and you'll see the KPI sheet in your first week.",
    },
  },
  "range-grade-leverage": {
    base:
      "On the range piece — I can't put an internal band on the table, but the fitment moves with the grade we've slotted you against. If you share even a rough target, I'll tell you straightaway whether it lands, and I can take it back to the panel if there's a gap.",
    variants: [
      "On range — internal bands stay internal, but the fitment moves with the grade. Give me your rough target and I'll tell you straight up whether it lands in the same zone; if not, I'll carry the delta to the panel.",
      "Range piece — the grade we've slotted you against drives the corridor; the corridor isn't something I can share. Tell me what you're targeting and I'll level with you on whether we close it here or whether the panel needs to look at it.",
    ],
    phaseTinted: {
      "closing-push":
        "Look — panel reconvenes Friday and the slot for this grade closes EOD Thursday. Tell me your final number and I'll fight for it one more time right now. After Thursday the leverage changes completely.",
    },
    registerVariants: {
      "direct":
        "Internal band's internal. Share your target and I'll tell you if we close it here or if it's a panel conversation.",
    },
    sectorOverrides: {
      "psu":
        "Sir, the pay band at this grade is fixed by cadre rules — no internal corridor here. If you share your expectation, I'll have it checked against the grade entitlement and revert.",
    },
    sectorPhaseOverrides: {
      "indian-unicorn": {
        "closing-push":
          "Achha, on the range — we're close, na. Tell me your number and I'll fight for it one more time at the panel. Better to close this here than keep going back and forth.",
      },
      "early-startup": {
        "closing-push":
          "Look — grade ka conversation we can keep doing, but the real question is what number works for you. Bata do, I'll take it to the founder and we'll close this today.",
      },
    },
  },
  "tax-structuring": {
    base:
      "On the structuring piece — the breakup is built around the standard flexi plan (HRA, LTA, NPS, meal card). It's not aggressively optimised but it covers the usual heads. Once we lock the fitment I can have the structuring sheet shared so you can plan your declarations.",
    variants: [
      "On structuring — standard flexi shape: HRA, LTA, NPS, meal card. Not the most aggressive optimisation, but it covers the usual heads cleanly. Sheet goes across once fitment is locked so you can plan declarations.",
      "Tax-wise — we're on the standard flexi plan, not a bespoke setup. HRA, LTA, NPS, meal card all configurable. Once the fitment is closed I'll get the sheet to you and you can map your declarations against it.",
    ],
    phaseTinted: {
      /* Closing-push: the structuring conversation gets explicitly
       * deferred to post-signature. Recruiter is no longer offering
       * to plan, just promising the sheet lands soon. */
      "closing-push":
        "On tax structuring — the heads (HRA / LTA / FBP) are set before the letter goes out. Tell me your city and split preference and you'll see the final structure in the offer letter today, before you sign.",
    },
    sectorOverrides: {
      /* P0-5 — tax structuring varies materially. Big-4 / consulting
       * runs more sophisticated flexi (LTA, books, professional
       * development, sodexo). PSU is locked to government salary
       * structure with very little flex. IT-services typically runs
       * a standard mid-market flexi sheet. */
      "consulting-big4":
        "On structuring — the flexi envelope at this level is genuinely usable: HRA, LTA, professional development reimbursement, books and conference, NPS, meal benefit. P&C runs an optimisation tool that suggests a structuring shape given your declarations. I'll have it shared once fitment is locked.",
      "psu":
        "On structuring — the salary heads here are fixed by the pay commission framework. There isn't a flexi envelope to optimise in the private-sector sense; what's available is HRA based on city classification, transport allowance, and DA. Whatever applies under the rules will be reflected in the salary slip.",
      "bfsi":
        "On the structuring piece — the flexi setup here is the standard bank envelope: HRA, LTA, NPS, meal card, plus the LFC scheme on top. It's a clean structure but not aggressively optimised. Sheet lands with the offer for you to plan declarations against.",
      /* Edtech — flexi is intact but the recruiter is matter-of-fact:
       * package math has been the friction lately, not the structuring. */
      "edtech":
        "On structuring — flexi heads are the standard mid-market shape: HRA, LTA, NPS, meal card. Nothing fancy and nothing cut after the correction either — structuring isn't where the package has been pinched, so this piece is clean. Sheet goes across with the offer.",
      /* MBB — flexi is genuinely usable plus the study-leave / sponsorship
       * conversation gets folded in here too. */
      "consulting-mbb":
        "On structuring — the flexi envelope at this level is meaningfully usable: HRA, LTA, books and professional development, NPS, meal benefit. People & Capabilities runs an internal structuring tool that maps declarations against the heads. Worth noting the study-leave commitment and the B-school sponsorship clause are documented in a separate annexure — those are part of the total economics even though they sit outside the structuring sheet.",
    },
  },
  "channel-switch": {
    base:
      "Happy to take this on a call — let me set up a time once I've taken your range back to the panel. We can close the open points faster on a call than over email.",
    variants: [
      "On a call works — let me get your range to the panel first, then I'll set up a slot. We'll close the open points quicker on a call than going back and forth on email.",
      "Yeah, happy to take it on a call. Let me take your number to the panel, then we'll find a slot — open items move faster on a call than they do over email.",
    ],
    phaseTinted: {
      /* Closing-push: urgency on the call ask. No "let me first take
       * the range to the panel" — we're past that, the call is to
       * close, not to scope. */
      "closing-push":
        "Let's get on a call today — I'll send a slot for this evening. Faster than another email thread and I'd rather we close the open points face to face. Bring your questions and we'll close them in one sitting.",
    },
    sectorOverrides: {
      /* Startup casual register — early-startup recruiters drop into
       * "yeah let's just hop on a call" energy. */
      "early-startup":
        "Yeah let's just hop on a call — I'll send a calendar invite for tomorrow morning. Faster than going back and forth on email and I can pull the founder in if we need to move on the comp piece.",
      /* P0-5 — PSU + BFSI prefer formal written channels; switching
       * to a call without paper trail is materially off-register. */
      "psu":
        "On the channel piece — for compensation matters at this grade I'd suggest we keep the conversation in writing so there's a record on file. If a call is needed for clarification, I can schedule one through the official line, but the final decisions sit with the panel and need to be documented.",
      "bfsi":
        "On taking it over a call — sure, but for the comp piece itself I'd want the numbers exchanged in writing so there's an audit trail. Happy to set up a call to clarify the structure; the final number conversation we'll keep on email so both sides are on record.",
    },
  },
  "meta-coaching": {
    /* Defensive: candidate is asking the recruiter for coaching mid-call.
     * Recruiter doesn't coach — redirects to the actual question. */
    base:
      "I'll let you frame it the way you're comfortable — just share what's true for you and we'll work from there.",
    variants: [
      "Frame it however feels natural — share what's actually true for you and we'll take it from there.",
      "I'd rather not put words in your mouth — give it to me the way you'd say it, and we'll work from what you share.",
    ],
    phaseTinted: {
      /* P0-4 — closing-push: candidate looking for coaching this late
       * usually means cold feet on the number. Don't coach; ground the
       * conversation in the close. */
      "closing-push":
        "I won't coach you on the framing — we're past that. Tell me what's actually holding you back from saying yes and we'll work from there.",
    },
    sectorOverrides: {
      "early-startup":
        "No pressure on the framing — just talk normally. Tell me what's actually on your mind and we'll work it out from there.",
    },
  },
};


/* 2026-05-29 realism-pass — deterministic variant picker.
 *
 * Hashes a string seed (sessionId + turn + topic) to an index into the
 * `[base, ...variants]` candidate list. Properties we want:
 *   1. Same seed → same variant. A given session asking the same topic
 *      on the same turn always gets the same prose (idempotent retries
 *      don't churn the wording).
 *   2. Different sessions → different variants. Two candidates asking
 *      the same topic shouldn't both see `base`.
 *   3. Within a session, asking the SAME topic on a later turn picks a
 *      DIFFERENT variant (because turnIndex is in the seed). This is
 *      the conversational-realism win — re-asking gets re-phrased.
 *
 * Tiny FNV-1a hash; no crypto needs, just a well-distributed integer.
 * Pure, ASCII-stable. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Render the recruiter's deterministic response for a classified topic.
 *
 * Resolution precedence (2026-05-29 realism-pass):
 *   1. `roundOverride`  — director-tier prose if active round matches
 *   2. `sectorOverride` — sector-correct content / persona-quirk tone
 *   3. `phaseTinted`    — phase-shifted register (closing-warm,
 *                         opening-guarded), only when the active phase
 *                         has an entry
 *   4. variant rotation across `[base, ...variants]`, seeded by
 *      `variantSeed` (sessionId+turn). Used when no override / tint fires.
 *   5. `base` — when no seed is provided (back-compat / snapshot use).
 *
 * Phase tinting sits BELOW sector/round overrides because content
 * correctness (e.g. PSU grade-pay reality) trumps tone. It sits ABOVE
 * variant rotation because phase-tone is a meaningful audible shift,
 * not a paraphrase.
 *
 * `variantSeed` is hashed with the topic name to pick a variant; pass
 * `${sessionId}:${turnIndex}` so two sessions diverge and re-asks within
 * a session re-phrase. Pass `null` (or omit) to always return `base` —
 * useful for snapshot tests that need deterministic output across runs.
 *
 * Called from the planner (and the prose-layer reactive-followup branch)
 * after `classifyCandidateQuestion` fires. Returns `null` when the topic
 * has no entry — the caller should fall back to the safe generic ack.
 */
export function renderCandidateQuestionResponse(
  topic: CandidateQuestionTopic,
  sector: RecruiterSectorPersona | null | undefined,
  round: NegotiationRoundPersona | null | undefined,
  variantSeed?: string | null,
  phase?: NegotiationPhase | null,
  /* 2026-05-29 realism-pass — strict in-session non-repetition.
   *
   * Per-topic count of how many times this curated topic has ALREADY
   * been served in the current session (state.candidateQuestionServeCount
   * in `_negotiation-kernel.ts`). The renderer adds this to the hash
   * index, so ask #1 → base, ask #2 → variant 0, ask #3 → variant 1,
   * etc, wrapping at `candidates.length`. With 3 variants + the base,
   * the first FOUR re-asks land on four distinct phrasings; a fifth
   * re-ask wraps. Real recruiters never re-phrase identically within
   * a single call.
   *
   * Pass 0 (or omit) to use pure hash rotation — back-compat for
   * call sites that haven't wired the count yet. */
  serveCount?: number,
  /* 2026-05-29 realism-pass P0-2 — candidate register signal. The
   * classifier in `_candidate-register.ts` infers formal / casual /
   * direct / neutral from utterance history. When set and the topic
   * has a `registerVariants` entry for that register, the renderer
   * returns the register-mirrored prose so the recruiter audibly
   * matches the candidate's cadence. Precedence sits BELOW round /
   * sector / phase (content + flow correctness wins) and ABOVE the
   * paraphrase-variant rotation (register is a louder signal than a
   * neutral re-phrasing). Pass null / omit for legacy call sites. */
  candidateRegister?: CandidateRegister | null,
): string | null {
  const entry = RESPONSE_BANK[topic];
  if (!entry) return null;
  if (round && entry.roundOverrides?.[round]) {
    return entry.roundOverrides[round] ?? null;
  }
  /* P0-7 sector × phase composition — most-specific combo wins. */
  if (sector && phase && entry.sectorPhaseOverrides?.[sector]?.[phase]) {
    return entry.sectorPhaseOverrides[sector]?.[phase] ?? null;
  }
  if (sector && entry.sectorOverrides?.[sector]) {
    return entry.sectorOverrides[sector] ?? null;
  }
  if (phase && entry.phaseTinted?.[phase]) {
    return entry.phaseTinted[phase] ?? null;
  }
  if (candidateRegister && entry.registerVariants?.[candidateRegister]) {
    return entry.registerVariants[candidateRegister] ?? null;
  }
  const variants = entry.variants;
  if (variantSeed && variants && variants.length > 0) {
    const candidates = [entry.base, ...variants];
    const baseIdx = hashSeed(`${variantSeed}|${topic}`) % candidates.length;
    const shifted = (baseIdx + (serveCount ?? 0)) % candidates.length;
    return candidates[shifted];
  }
  return entry.base;
}

/**
 * Generic fallback used when no pattern classifies and no LLM is in play.
 * Centralised so the canonical-prose layer doesn't hand-roll the string.
 */
export const CANDIDATE_QUESTION_GENERIC_FALLBACK =
  "Happy to address that — let me come back to where we were.";
