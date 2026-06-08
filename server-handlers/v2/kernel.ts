/* V2-KERNEL (2026-06-09) — the foundation rewrite, step 1.
 *
 * This is the FIRST file in `server-handlers/v2/`, the greenfield
 * replacement for the v1 deterministic-state-machine + planner +
 * canonical-prose + LLM-restyle stack.
 *
 * The shape change in v2:
 *   - v1 enumerates 25 action kinds and 9 phases; the planner picks
 *     an action via heuristic gates; the LLM only restyles. Three
 *     months of patches drifted into accretion — the offer-ask
 *     invariant (candidate explicitly asks for the offer ⇒ next turn
 *     must contain a number or an honest decline) is heuristic-gated
 *     and silently fails on real sessions (see the Flipkart fixture).
 *
 *   - v2 inverts the cut: a TINY deterministic kernel computes the
 *     band + state scalars + the set of LEGAL TOOLS the orchestrator
 *     may call. The LLM picks one tool and arguments. The kernel
 *     validates and renders the canonical prose. There is no restyle
 *     layer. There is no "ask_discovery" tool when the offer-ask
 *     invariant has tripped — the LLM literally cannot pick it.
 *
 * This commit lands ONLY the kernel's three pure functions:
 *
 *   computeBand(role, company, profile) → { initial, stretch, walkAway, hasEquity }
 *     — mirrors v1's resolveServerBand for parity during shadow.
 *
 *   deriveState(conversationLog) → DerivedState
 *     — extracts the scalars the legal-tools gate needs from the log.
 *
 *   legalTools(state) → ToolName[]
 *     — the gate. This is where the hard invariants live.
 *
 * The orchestrator, the six tools, and the output rail land in
 * subsequent commits. Shadow mode against v1 lands when the tools are
 * wired. This commit is the FOUNDATION — sign-off was on the contract
 * in chat, the test below is the failing-then-passing proof. */

import { resolveServerBand } from "../_band-resolver";
import type { NegotiationBand } from "../_negotiation-kernel";

/** The six tools v2 exposes. Exactly six, no more, no less. The
 *  enumeration is the contract — adding a seventh requires changing
 *  this type and the orchestrator system prompt together. */
export type ToolName =
  | "propose_anchor"
  | "propose_counter"
  | "concede"
  | "close_recap"
  | "decline_offer_ask"
  | "defer_with_callback"
  | "ask_discovery";

export interface ConversationTurn {
  role: "ai" | "candidate";
  text: string;
  /** When the AI turn was produced by a v2 tool call, this carries
   *  the tool name. v1 turns (shadow mode) leave this undefined and
   *  state derivation falls back to regex on `text`. */
  tool?: ToolName;
  /** If the tool was a number-shipping tool (anchor/counter/close/
   *  decline), this is the LPA scalar the kernel rendered. Used to
   *  derive lastAnchorLpa without re-parsing prose. */
  lpa?: number;
}

export interface DerivedState {
  /** Count of AI turns in the log. The next AI turn is turnIndex+1. */
  turnIndex: number;
  /** How many times the candidate has explicitly asked for the
   *  offer. The offer-ask invariant trips at offerAskCount >= 2. */
  offerAskCount: number;
  /** True iff at least one prior AI turn shipped a band-anchored LPA
   *  number via propose_anchor or propose_counter. */
  hasAnchored: boolean;
  /** Most recent anchor/counter LPA the kernel rendered. null when
   *  nothing has been anchored yet. */
  lastAnchorLpa: number | null;
  /** Most recent candidate-stated target LPA. Regex-extracted from
   *  candidate turns ("my expectation is 44 LPA", "can you give me
   *  44", "I want 44 LPA"). null when never stated. */
  candidateTarget: number | null;
  /** Turn index at which the candidate verbally accepted. null when
   *  no acceptance. close_recap is illegal without this. */
  verbalAcceptanceTurn: number | null;
  /** Topics the candidate has actually raised across the conversation.
   *  defer_with_callback is only legal on a topic in this set — prevents
   *  the v1 failure where the bot defers on "joining bonus" the candidate
   *  never mentioned, turning defer into a fluff exit. Drawn from a fixed
   *  topic bank, keyword-matched against candidate turns. */
  surfacedTopics: string[];
  /** Topics the candidate has DEFINITIVELY CLOSED — disclosed a "no" or
   *  zero-value answer. ask_discovery on a closed topic is rejected: the
   *  Bug #58 T3 failure mode where the AI asks "variable side — perf-linked
   *  or fixed?" right after the candidate said "24 LPA is base" (= no
   *  variable). Closing is conservative: only fires on unambiguous
   *  negation patterns from the candidate. */
  closedTopics: string[];
  /** All LPA-shaped numbers the candidate has mentioned across the
   *  log (current CTC, base split, variable, joining bonus floats,
   *  target, etc.). The grounding set: any LPA scalar a v2 tool
   *  embeds in a rationale must be within ±0.5 of one of these (or
   *  of a band/anchor/target scalar). Prevents the T7-class
   *  fabrication where v1 invented "88% variable" with no source. */
  mentionedNumbers: number[];
  /** Numbers the candidate cited ONLY in an unverified-premise context
   *  — peer comp ("my peers at Razorpay make 60 LPA"), market rate
   *  ("market for senior PD is 50 LPA"), competing offer ("I have an
   *  offer for 45 LPA"), or named-competitor benchmark ("Flipkart pays
   *  55 LPA at this level"). If the same number ALSO appears as the
   *  candidate's own factual self-disclosure (current CTC, base,
   *  expectation), it is NOT in this set — it's grounded.
   *
   *  Deep-research invariant #11 (sycophancy gate, Malhotra 2007).
   *  Rationales for anchor/counter/concede that cite a number in this
   *  set are rejected — the bot must either anchor on band + own
   *  numbers, or ask_discovery to surface evidence for the premise
   *  before treating it as a basis for the move. Addresses the RLHF-
   *  LLM sycophancy failure where the bot accepts candidate frames at
   *  46.6–95.1% without challenge (Sharma et al. 2023). */
  unverifiedPremiseNumbers: number[];
}

/** Regex bank. The offer-ask family must catch the explicit asks the
 *  Flipkart candidate used: "you should give your initial offer",
 *  "you have not yet given initial offer", "can you give me 44 LPA".
 *  Conservative — we want recall over precision here because false
 *  positives only force a number; false negatives let the planner
 *  drift back into discovery. */
const OFFER_ASK_PATTERNS: RegExp[] = [
  /\b(give|share|tell)\s+(me\s+)?(your\s+)?(initial\s+)?offer\b/i,
  /\bwhat(?:'s|\s+is)\s+(your\s+)?(initial\s+)?offer\b/i,
  /\bhave\s+not\s+(yet\s+)?given\s+(initial\s+)?offer\b/i,
  /\bcan\s+you\s+give\s+me\s+\d/i,
  /\byour\s+offer\s*[?.]?\s*$/i,
];

/* Acceptance comes in two registers and the kernel must catch both.
 *
 * STRICT: explicit, unambiguous commit. Safe to fire any time —
 * including before any anchor (rare, but e.g. candidate pre-accepts
 * a verbal range mention).
 *
 * CONVERSATIONAL: looser, Indian-English-recruiter register. "yes
 * keep base as 44 LPA" / "44 LPA works for me" / "yes 44 as base".
 * These are dangerous BEFORE an anchor — "yes my CTC is 32 LPA" is
 * a disclosure, not an accept — so they only fire when an anchor
 * has already been put on the table. The deriveState walk gates
 * this on `hasAnchored` at the cursor position. */
const STRICT_ACCEPTANCE_PATTERNS: RegExp[] = [
  /\b(i\s+)?accept\b/i,
  /\b(it'?s\s+a\s+)?deal\b/i,
  /\blet'?s\s+(do\s+it|go\s+(?:with|ahead))\b/i,
  /\bsounds?\s+good[,.]?\s*(let'?s|i'?ll\s+take)/i,
];

const CONVERSATIONAL_ACCEPTANCE_PATTERNS: RegExp[] = [
  /* English-register conversational accepts (PD #2 fixture). */
  /* "keep base as 44 LPA" / "keep the base at 44" / "keep 44 as base" */
  /\bkeep\s+(?:the\s+)?(?:base\s+)?(?:at\s+|as\s+)?\d+(?:\.\d+)?\s*(?:l|lpa)?\b(?:[^.]{0,30}\bas\s+base\b)?/i,
  /* "44 LPA as base" / "44 as base" */
  /\b\d+(?:\.\d+)?\s*(?:l|lpa)?\s+as\s+base\b/i,
  /* "44 LPA works for me" / "would work for me" */
  /\b\d+(?:\.\d+)?\s*(?:l|lpa)\b[^.]{0,40}\bwould?\s+works?\s+(?:for\s+me|out)\b/i,
  /\bwould\s+work\s+for\s+me\b/i,
  /* "yes / sure / ok + LPA number" — only safe post-anchor */
  /^\s*(?:yes|yeah|yep|sure|ok(?:ay)?|great|done)\b[^.]{0,80}\b\d+(?:\.\d+)?\s*(?:l|lpa)\b/i,

  /* Hinglish / Indian-English-recruiter register accepts. These are
   * the phrasings real Indian candidates use in negotiation calls
   * that the English-only set misses entirely. Post-anchor gating
   * keeps these safe — "chalega" or "done" outside the negotiation
   * cadence doesn't reach this branch. */
  /* "chalo done" / "chalo theek hai" / "chalo karte hain" — let's go */
  /\bchalo\s+(?:done|theek\s+hai|kar(?:o|te\s+hain?)|finalize)/i,
  /* "le lete hain" / "le lo" — we'll take it / take it */
  /\ble\s+(?:lete\s+hain?|lo|liya)\b/i,
  /* "X chalega" / "44 LPA chalega" — X will work */
  /\b(?:\d+(?:\.\d+)?\s*(?:l|lpa|lakhs?)\s+)?chalega\b/i,
  /* "done hai" / "ok hai" / "theek hai" — done / ok / fine */
  /\b(?:done|theek|sahi|pakka)\s+hai\b/i,
  /* "ho jayega" / "X par ho jayega" — will be done / done at X */
  /\bho\s+jaye?ga\b/i,
  /* "X par done" / "X par karo" / "X par finalize" — close at X */
  /\b\d+(?:\.\d+)?\s*(?:l|lpa|lakhs?)?\s+par\s+(?:done|karo|finalize|kar\s+lete)/i,
  /* "haan / han + X LPA" — yes + number, Hindi affirmative */
  /\bha(?:a)?n\b[^.]{0,40}\b\d+(?:\.\d+)?\s*(?:l|lpa|lakhs?)\b/i,

  /* Bug #58 T10/T11: "I liked the offer", "I liked your offer",
   * "love this number". Real candidate-side accept register the
   * other patterns missed. Post-anchor gated. */
  /\bi\s+(?:liked?|loved?|loving|liking)\s+(?:the|your|this|that)\s+(?:offer|number|figure|package|proposal|fitment)\b/i,
];

/** Closed-topic detection bank. Each key is a topic-bank key (must
 *  exist in TOPIC_BANK). Each value is a list of regex patterns that
 *  count as the candidate having DEFINITIVELY CLOSED that topic with
 *  a "no" or zero-value answer.
 *
 *  Closing is conservative — only patterns where the candidate's
 *  negative answer is unambiguous. "I'm not sure about variable" is
 *  NOT closing (still needs discovery). "no variable" IS closing.
 *
 *  Tested against Bug #58: candidate says "24 LPA is base" then "no
 *  rsu/esop" — both `variable` and `esop` close. */
const CLOSED_TOPIC_PATTERNS: Record<string, RegExp[]> = {
  variable: [
    /\bno\s+variable\b/i,
    /\bzero\s+variable\b/i,
    /\bwithout\s+(?:any\s+)?variable\b/i,
    /\bno\s+(?:perf(?:ormance)?\s+)?bonus\b/i,
    /\b(?:all|entire|fully?|whole|everything|completely)\s+(?:is\s+|in\s+)?(?:the\s+)?base\b/i,
    /\b(?:entire|all|whole)\s+\d+(?:\.\d+)?\s*(?:l|lpa|lakhs?)?\s+(?:is\s+)?(?:the\s+)?base\b/i,
    /\bbase\s+only\b/i,
    /\bonly\s+(?:the\s+)?base\b/i,
    /\bno\s+incentive\b/i,
    /\bflat\s+(?:base|salary)\b/i,
  ],
  esop: [
    /\bno\s+(?:esops?|stock\s+options?|rsus?|stock\s+grants?|stock|equity)\b/i,
    /\bdon'?t\s+have\s+(?:any\s+)?(?:esops?|stock\s+options?|rsus?|stock|equity)\b/i,
    /\b(?:zero|0)\s+(?:esops?|rsus?|equity|stock)\b/i,
    /\bwithout\s+(?:any\s+)?(?:esops?|rsus?|equity|stock)\b/i,
  ],
};

/** Topic bank for surfacedTopics. Keys are the canonical topic strings
 *  defer_with_callback must use; values are case-insensitive regex
 *  alternatives that count as the candidate having raised the topic. */
const TOPIC_BANK: Record<string, RegExp> = {
  "joining bonus": /\b(joining\s+bonus|sign[- ]?on|signing\s+bonus|joining\s+amount)\b/i,
  esop: /\b(esops?|stock\s+options?|rsus?|equity|stock\s+grants?)\b/i,
  variable: /\b(variable|bonus\s+component|performance\s+bonus|incentive)\b/i,
  base: /\b(base|fixed\s+(?:pay|salary|component))\b/i,
  notice: /\b(notice\s+period|buyout|relieving|last\s+working\s+day|lwd)\b/i,
  relocation: /\b(relocat\w+|shifting|move\s+to|joining\s+location)\b/i,
  timeline: /\b(timeline|joining\s+date|when\s+do\s+I\s+join|when\s+can\s+I\s+join|notice)\b/i,
  benefits: /\b(insurance|mediclaim|gratuity|pf|provident|benefits)\b/i,
  scope: /\b(role\s+scope|team\s+size|reporting|manager|designation|title|leveling|level\s+fitment)\b/i,
  retention: /\b(retention|counter[- ]?offer|current\s+company.*(retain|matching)|matching\s+offer)\b/i,
};

/** Premise-context patterns (deep-research #11 — sycophancy gate).
 *  When the candidate cites an LPA number adjacent to one of these
 *  context markers (within ±60 chars), the number is classified as
 *  an UNVERIFIED PREMISE — a claim about the external world (peers,
 *  market, competing offers, named competitors) the bot has no way
 *  to confirm. The bot must NOT use a premise number as anchor /
 *  counter / concession rationale without first challenging it via
 *  ask_discovery. Pure self-disclosure of the same number elsewhere
 *  in the log clears it (FACTUAL_NUMBER_PATTERNS below). */
const PREMISE_NUMBER_PATTERNS: RegExp[] = [
  /\b(?:peers?|colleagues?|batch[- ]?mates?|friends?|teammates?|folks|cohort|seniors?|juniors?)\b/i,
  /\b(?:market(?:\s+rate)?|industry(?:\s+standard)?|going\s+rate|standard\s+(?:rate|comp(?:ensation)?)|benchmark|levels?\.?\s*fyi)\b/i,
  /\b(?:competing|another|other|got\s+an?|have\s+an?|received(?:\s+an?(?:other)?)?|sitting\s+on(?:\s+an?)?|holding(?:\s+an?)?|in\s+hand)\s+(?:offer|comp|package|fitment)\b/i,
  /\boffer\s+(?:for|of|at|from)\b/i,
  /\b(?:flipkart|razorpay|zomato|swiggy|phonepe|google|microsoft|amazon|meta|netflix|paytm|cred|navi|uber|airbnb|stripe|apple|nvidia|atlassian|linkedin|salesforce|adobe|oracle|tcs|infosys|wipro|accenture|cognizant|cisco|myntra|nykaa|ola|rapido|dunzo|meesho|sharechan|delhivery|policybazaar|zerodha|groww|upstox|cleartax|byjus|unacademy|whitehat|vedantu|cuemath|browserstack|postman|freshworks|zoho|chargebee|hasura|gojek|grab|sea|shopee|tokopedia)\b/i,
  /\b(?:everyone|everybody|all\s+my|most(?:\s+of\s+(?:us|them))?)\s+(?:makes?|earns?|gets?|takes?(?:\s+home)?|is\s+at)\b/i,
  /\b(?:should\s+be|deserve|entitled)\s+(?:to\s+)?(?:getting|making|earning|at|paid)\b/i,
  /\b(?:leveling|levelling|fitment|band|grade)\s+(?:says?|puts?|suggests?|map(?:s|ped)?)\b/i,
];

/** Factual-context patterns. When the candidate cites an LPA number
 *  adjacent to one of these (±60 chars), the number is the candidate's
 *  own first-person self-disclosure — their current CTC, base, variable,
 *  joining bonus, expectation, or target. Factual numbers are GROUNDED
 *  even if they also appear in a premise context in another turn. */
const FACTUAL_NUMBER_PATTERNS: RegExp[] = [
  /\bmy\s+(?:current\s+)?(?:ctc|base|fixed|salary|comp(?:ensation)?|package|variable|joining\s+bonus|esops?|equity|stock|in[- ]?hand|take[- ]?home)\b/i,
  /\bi\s+(?:make|earn|take\s+home|get(?:\s+paid)?|am\s+(?:at|on|drawing)|currently\s+(?:make|earn|draw|am\s+at))\b/i,
  /\bmy\s+(?:expectation|target|ask|number|fitment)\b/i,
  /\bi\s+(?:want|expect|am\s+looking\s+for|need|am\s+expecting)\b/i,
  /\b(?:current(?:ly)?|present)\s+(?:ctc|salary|comp|package|base)\b/i,
];

const TARGET_PATTERNS: RegExp[] = [
  /\bmy\s+(expectation|target|ask)\s+is\s+(\d+(?:\.\d+)?)\s*(?:l|lpa)\b/i,
  /\bi\s+(want|expect|am\s+looking\s+for)\s+(\d+(?:\.\d+)?)\s*(?:l|lpa)\b/i,
  /\bcan\s+you\s+give\s+me\s+(\d+(?:\.\d+)?)\s*(?:l|lpa)\b/i,
  /\b(\d+(?:\.\d+)?)\s*lpa\s+(?:is\s+)?(?:my\s+)?(?:expectation|target|ask)\b/i,
];

/** v2 band calibration overrides. Keyed by `${company}|${role-normalized}|${level}`.
 *  When PostHog telemetry shows a (company, role, level) cell whose v1
 *  band is materially off market (e.g. Flipkart Senior PD landing at
 *  ~[21, 42] while market is [30, 50]), we add a row here. This is
 *  the SINGLE source of v2 calibration drift away from v1 — auditable,
 *  not scattered across patches. The map is intentionally small and
 *  grows by evidence, never by guess. */
interface BandOverride {
  initialOffer: number;
  maxStretch: number;
  walkAway: number;
  hasEquity?: boolean;
  /** Free-text justification — Glassdoor URL, internal comp band doc,
   *  or PostHog dashboard slice. The seed entries must cite a source;
   *  uncited rows are not allowed. */
  source: string;
}

function normalizeRoleKey(role: string): string {
  return role
    .toLowerCase()
    .replace(/\b(sr\.?|senior)\b/g, "senior")
    .replace(/\bproduct\s+designer\b/g, "pd")
    .replace(/\bsoftware\s+engineer\b/g, "swe")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* Loaded at module load from data/v2-band-overrides.json. Schema-
 * validated; malformed entries are skipped (with a one-time warn) so
 * a typo in the data file never crashes the v2 brain — it just falls
 * back to v1 for affected cells. The data file is editable by ops
 * without a code review; the schema is the contract. */
import bandOverridesData from "../../data/v2-band-overrides.json";

function isValidOverride(v: unknown): v is BandOverride {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.initialOffer === "number" &&
    typeof o.maxStretch === "number" &&
    typeof o.walkAway === "number" &&
    typeof o.source === "string" &&
    o.source.length >= 5 &&
    o.walkAway <= o.initialOffer &&
    o.initialOffer <= o.maxStretch
  );
}

function loadBandOverrides(): Record<string, BandOverride> {
  const out: Record<string, BandOverride> = {};
  const raw = (bandOverridesData as { overrides?: Record<string, unknown> }).overrides ?? {};
  for (const [key, val] of Object.entries(raw)) {
    if (isValidOverride(val)) {
      out[key] = val;
    } else if (process.env.NODE_ENV !== "test") {
      /* One-line warn — never throw, never spam. The brain stays up. */
      // eslint-disable-next-line no-console
      console.warn(`[v2-band-overrides] skipping malformed entry for key=${key}`);
    }
  }
  return out;
}

const BAND_OVERRIDES: Record<string, BandOverride> = loadBandOverrides();

/** Compute the band for (role, company, candidate-profile). Defers to
 *  v1's resolveServerBand by default for shadow-mode parity, but lets
 *  v2 override specific (company, role, level) cells via BAND_OVERRIDES
 *  when telemetry proves the v1 number is off market. The override is
 *  the FOUNDATION fix for band drift — patching individual rationales
 *  in the LLM prompt is the patchwork antipattern. */
export function computeBand(
  role: string,
  company: string,
  experienceLevel?: string,
  applicableYoe?: number | null,
): NegotiationBand {
  const key = `${(company ?? "").toLowerCase()}|${normalizeRoleKey(role ?? "")}|${(experienceLevel ?? "").toLowerCase()}`;
  const override = BAND_OVERRIDES[key];
  if (override) {
    return {
      initialOffer: override.initialOffer,
      maxStretch: override.maxStretch,
      walkAway: override.walkAway,
      hasEquity: override.hasEquity ?? false,
    };
  }
  return resolveServerBand(role, company, experienceLevel, applicableYoe);
}

/** Test/audit hook — exposes the override map so calibration sweeps and
 *  PostHog dashboards can iterate without reaching into module internals. */
export function _v2BandOverrideKeys(): string[] {
  return Object.keys(BAND_OVERRIDES);
}

/** Extract derived scalars from the conversation log. Pure function
 *  of the log — no side effects, no I/O. Re-deriving from the log
 *  every turn (rather than mutating long-lived state) is the v2
 *  discipline that prevents the v1 "state drift" failure mode where
 *  flags got set and never cleared. */
/** Pull every LPA-shaped scalar from a candidate text into a number
 *  list. "32 LPA" → [32]. "30 lpa base 2 LPA variable" → [30, 2].
 *  Bare integers without an L/LPA suffix are deliberately ignored —
 *  the grounding set is about money, not arbitrary digits. */
/** Classify each LPA mention by local context. Returns one entry per
 *  occurrence with `isPremise` / `isFactual` flags computed against the
 *  ±60-char window. Used by deriveState to populate
 *  unverifiedPremiseNumbers — a number that EVER appears factually is
 *  cleared from the premise set across the whole log. */
function extractLpaMentionsClassified(
  text: string,
): Array<{ n: number; isPremise: boolean; isFactual: boolean }> {
  const out: Array<{ n: number; isPremise: boolean; isFactual: boolean }> = [];
  const re = /\b(\d+(?:\.\d+)?)\s*(?:l|lpa|lakhs?)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1]);
    if (!(Number.isFinite(n) && n > 0)) continue;
    const start = Math.max(0, m.index - 60);
    const end = Math.min(text.length, m.index + m[0].length + 30);
    const window = text.slice(start, end);
    const isFactual = FACTUAL_NUMBER_PATTERNS.some((p) => p.test(window));
    const isPremise = PREMISE_NUMBER_PATTERNS.some((p) => p.test(window));
    out.push({ n, isPremise, isFactual });
  }
  return out;
}

export function deriveState(log: ConversationTurn[]): DerivedState {
  let turnIndex = 0;
  let offerAskCount = 0;
  let hasAnchored = false;
  let lastAnchorLpa: number | null = null;
  let candidateTarget: number | null = null;
  let verbalAcceptanceTurn: number | null = null;
  const mentionedNumbers: number[] = [];
  const surfacedTopicsSet = new Set<string>();
  const closedTopicsSet = new Set<string>();
  /* Premise tracking — deep-research #11. A number is "unverified
   * premise" iff it appears in premise contexts across the log AND
   * never in a factual self-disclosure context. */
  const premiseSet = new Set<number>();
  const factualSet = new Set<number>();

  for (let i = 0; i < log.length; i++) {
    const turn = log[i];
    if (turn.role === "ai") {
      turnIndex++;
      /* v2-native turns set tool + lpa directly. Trust the structured
       * data; fall back to regex only when the turn came from v1
       * (shadow-mode mixed log). */
      if (turn.tool === "propose_anchor" || turn.tool === "propose_counter") {
        hasAnchored = true;
        if (typeof turn.lpa === "number") lastAnchorLpa = turn.lpa;
      } else if (turn.tool === undefined) {
        /* v1-mixed shadow: heuristic — does the AI text contain an
         * LPA scalar? If yes, count as anchored. */
        const m = turn.text.match(/\b(\d+(?:\.\d+)?)\s*(?:l|lpa)\b/i);
        if (m) {
          hasAnchored = true;
          lastAnchorLpa = Number(m[1]);
        }
      }
      continue;
    }

    /* candidate turn — extract any LPA-shaped numbers into the
     * grounding set BEFORE the regex banks (so a turn that both
     * states a target and discloses a number contributes both).
     * Classified extraction also populates premise vs. factual sets. */
    for (const m of extractLpaMentionsClassified(turn.text)) {
      mentionedNumbers.push(m.n);
      if (m.isFactual) factualSet.add(m.n);
      if (m.isPremise && !m.isFactual) premiseSet.add(m.n);
    }

    /* Topic surfacing — once mentioned, stays in the set for the rest
     * of the session. defer_with_callback consults this set so the AI
     * can't defer on a topic the candidate didn't raise. */
    for (const [topic, pat] of Object.entries(TOPIC_BANK)) {
      if (pat.test(turn.text)) surfacedTopicsSet.add(topic);
    }
    /* Topic CLOSING — the candidate gave a definitive "no" / zero
     * answer on this topic. Once closed, stays closed. ask_discovery
     * on a closed topic is illegal — Bug #58 T3 fix. */
    for (const [topic, pats] of Object.entries(CLOSED_TOPIC_PATTERNS)) {
      for (const pat of pats) {
        if (pat.test(turn.text)) {
          closedTopicsSet.add(topic);
          break;
        }
      }
    }

    for (const pat of OFFER_ASK_PATTERNS) {
      if (pat.test(turn.text)) {
        offerAskCount++;
        break;
      }
    }
    /* Strict acceptance fires any time. Conversational acceptance is
     * gated on hasAnchored at this point in the walk — otherwise
     * "yes my CTC is 32 LPA" at T1 would flip us into close territory. */
    let accepted = false;
    for (const pat of STRICT_ACCEPTANCE_PATTERNS) {
      if (pat.test(turn.text)) {
        accepted = true;
        break;
      }
    }
    if (!accepted && hasAnchored) {
      for (const pat of CONVERSATIONAL_ACCEPTANCE_PATTERNS) {
        if (pat.test(turn.text)) {
          accepted = true;
          break;
        }
      }
    }
    if (accepted) verbalAcceptanceTurn = turnIndex;
    for (const pat of TARGET_PATTERNS) {
      const m = turn.text.match(pat);
      if (m) {
        const n = Number(m[2] ?? m[1]);
        if (Number.isFinite(n) && n > 0) candidateTarget = n;
        break;
      }
    }
  }

  return {
    turnIndex,
    offerAskCount,
    hasAnchored,
    lastAnchorLpa,
    candidateTarget,
    verbalAcceptanceTurn,
    mentionedNumbers,
    surfacedTopics: Array.from(surfacedTopicsSet),
    closedTopics: Array.from(closedTopicsSet),
    /* Premise number is only "unverified" if it was NEVER also seen
     * factually. Same number in factualSet clears it (self-disclosure
     * is the verification). */
    unverifiedPremiseNumbers: Array.from(premiseSet).filter((n) => !factualSet.has(n)),
  };
}

/** Closed-topic keys — exposed so tools.ts and tests can validate against
 *  the canonical list rather than duplicating the bank. */
export function _v2ClosedTopicKeys(): string[] {
  return Object.keys(CLOSED_TOPIC_PATTERNS);
}

/** Topic-bank keys — exposed so tools.ts and tests can validate against
 *  the canonical list rather than duplicating the bank. */
export function _v2TopicBankKeys(): string[] {
  return Object.keys(TOPIC_BANK);
}

/** Does the given text reference the given topic, by the topic bank's
 *  own regex? Used by tools.ts to catch the case where the LLM passes
 *  a generic `topic:"package"` arg but writes a question about ESOPs —
 *  the literal substring "esop" isn't in "RSUs vesting", but the topic
 *  bank's `esop` regex matches "RSUs". Single source of truth: the
 *  TOPIC_BANK regex defines what counts as referencing a topic. */
export function topicReferencedIn(text: string, topic: string): boolean {
  const pat = TOPIC_BANK[topic];
  if (!pat) return false;
  return pat.test(text);
}

/** The gate. Returns the set of tools the orchestrator may call on
 *  the NEXT turn. The orchestrator presents this set to the LLM; the
 *  LLM cannot pick a tool not in the set.
 *
 *  This is where the hard invariants live. Each invariant is one
 *  branch — readable, auditable, single source of truth. No nine
 *  phases. No twenty-five action kinds. */
export function legalTools(state: DerivedState): ToolName[] {
  /* Invariant 1: post-acceptance, only close_recap is legal. The
   * candidate has said yes — the bot's job is to recap the deal. */
  if (state.verbalAcceptanceTurn !== null) {
    return ["close_recap"];
  }

  /* Invariant 2: the offer-ask invariant. If the candidate has
   * explicitly asked for the offer AT LEAST ONCE past the early
   * discovery window (turnIndex >= 4) and we have NOT anchored, the
   * next turn MUST contain a number or an honest decline. Discovery,
   * defer, concede — all illegal. This is the exact branch that would
   * have prevented the Flipkart session from looping for 14 turns.
   *
   * The threshold is >=1 (not >=2) on purpose: ignoring the FIRST
   * explicit "give your initial offer" is the credibility-destroying
   * failure mode the Flipkart fixture captures. The >=4 turnIndex
   * floor preserves 3 turns of pure-discovery runway before an early
   * rhetorical "what's your offer" can trip the invariant. */
  if (state.offerAskCount >= 1 && state.turnIndex >= 4 && !state.hasAnchored) {
    return ["propose_anchor", "decline_offer_ask"];
  }

  /* Invariant 3: candidate has stated a target and we've anchored —
   * we're in counter-territory. Discovery is over. Anchor again is
   * silly (we already did). The legal moves are counter, concede, or
   * defer (with callback). */
  if (state.hasAnchored && state.candidateTarget !== null) {
    return ["propose_counter", "concede", "defer_with_callback", "decline_offer_ask"];
  }

  /* Invariant 4: we've anchored but candidate hasn't stated a target.
   * Either they're still chewing on our number or they're about to
   * counter. Discovery is over. */
  if (state.hasAnchored) {
    return ["propose_counter", "concede", "defer_with_callback", "ask_discovery"];
  }

  /* Invariant 5: early discovery — turns 1-6, no offer-ask pressure,
   * nothing anchored yet. Discover, or anchor if we have enough
   * signal. */
  if (state.turnIndex <= 6 && state.offerAskCount === 0) {
    return ["ask_discovery", "propose_anchor"];
  }

  /* Fallback: anywhere else, anchor or honest-decline. Defer is NOT
   * in the fallback set — we never want the kernel to suggest a
   * defer as the safe default. Defer must be deliberately chosen. */
  return ["propose_anchor", "decline_offer_ask"];
}
