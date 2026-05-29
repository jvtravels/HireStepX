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
    sectorOverrides: {
      /* Big-4 methodology tic — consulting recruiters reach for the
       * "fitment matrix" / "compensation framework" lexicon. */
      "consulting-big4":
        "On structure — our compensation framework breaks fitment into fixed, target variable on the quarterly cycle, and ESOPs as a separate vehicle. Variable weighting flexes by level. If the shape doesn't work, partner can re-balance fixed against variable within the same total.",
    },
  },
  "budget-disclosure": {
    base:
      "On the budget — I can't share the full internal band, but the fitment sits in a defined corridor for this grade. If you can share even a rough target, I'll tell you straight away whether we're broadly aligned.",
    variants: [
      "On budget — I can't put the internal band on the table, but I can tell you we have a defined corridor at this grade. Give me a rough target and I'll say straight away whether it lands or whether there's a gap.",
      "Budget-wise — the band stays internal, that's a panel call. What I can do is take your number and tell you immediately if it's in the corridor or if we'll need to work to close a gap.",
    ],
    phaseTinted: {
      "closing-push":
        "On budget — we're close enough that I'd rather not keep dancing around the band. Give me your final number and I'll go to the panel one more time with it. I want this to land.",
      "opening":
        "On the budget piece — early to be giving you the internal band, but the fitment for this grade sits in a defined corridor. If you can share what you're broadly looking for, I'll tell you upfront if we're in the same neighbourhood.",
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
    },
    roundOverrides: {
      "director":
        "On the budget — at this level the fitment isn't a single number, it's a corridor we move inside based on the panel's read of you. Give me a rough target and I'll tell you if we're in the same zip code.",
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
  },
  "location-remote": {
    base:
      "On the location piece — the fitment doesn't change for remote or different-city, but the allowance structure (HRA, location pay) does shift to match the policy for that city. I can pull the city-wise structuring before we lock the offer.",
    variants: [
      "On location — the headline fitment holds whether you're remote or in a different city, but the allowance heads (HRA, location pay) move to match the city policy. I can have the city-wise structuring pulled before we lock the letter.",
      "Remote / different-city doesn't change the fitment number — what changes is the allowance shape (HRA, location pay) which is policy-driven per city. Tell me which city and I'll get the structuring pulled.",
    ],
  },
  "verification-bgv": {
    base:
      "Noted on the verification piece — slips can come at the formal BGV stage. For now let's first align on whether the range works for you, and then I'll move it through the panel.",
    variants: [
      "Noted on verification — that piece sits at the formal BGV stage, not here. For now let's first see if the range works for you; if it does I'll move it to the panel and BGV picks up from there.",
      "On verification — let's keep that for the BGV stage where it formally belongs. Right now I just want to know if the range works for you, then I'll take it forward.",
    ],
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
      "On the range piece — I can't put an internal band on the table, but the fitment moves with the grade we've slotted you against. If you can share even a rough target, I'll tell you straight away whether we're broadly aligned, and I can take it back to the panel if there's a gap.",
    variants: [
      "On range — internal bands stay internal, but the fitment moves with the grade. Give me your rough target and I'll tell you straight up whether we're in the same neighbourhood; if not, I'll carry the delta to the panel.",
      "Range piece — the grade we've slotted you against drives the corridor; the corridor isn't something I can share. Tell me what you're targeting and I'll level with you on whether we close it here or whether the panel needs to look at it.",
    ],
    phaseTinted: {
      "closing-push":
        "On range — look, we've been around this for a while. Tell me your number and I'll fight for it one more time at the panel. I'd rather close this with you than keep going back and forth on the band.",
    },
    sectorOverrides: {
      "psu":
        "On the range piece — at this grade the pay band is fixed by the cadre rules, sir/madam — there isn't an internal corridor in the way private-sector hiring works. If you share your expectation, I'll have it checked against the grade entitlement and revert.",
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
        "On structuring — flexi heads are what they are, no creative optimisation on the table. Sign and the sheet lands with you the same week — you'll have a clean view of HRA, NPS, LTA before you have to declare anything. Don't let the tax piece hold up the close.",
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
): string | null {
  const entry = RESPONSE_BANK[topic];
  if (!entry) return null;
  if (round && entry.roundOverrides?.[round]) {
    return entry.roundOverrides[round] ?? null;
  }
  if (sector && entry.sectorOverrides?.[sector]) {
    return entry.sectorOverrides[sector] ?? null;
  }
  if (phase && entry.phaseTinted?.[phase]) {
    return entry.phaseTinted[phase] ?? null;
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
