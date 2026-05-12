/* Adversarial-input detector — Phase 10B (2026-05-13).
 *
 * The audit (2026-05-13) flagged that the negotiation kernel had ZERO
 * detection for hostile / off-topic / jailbreak inputs. Candidates
 * who tried to derail the session, extract the system prompt, or
 * insult the bot were folded into state as-is. The LLM, having no
 * instruction to decline, would either play along (revealing the
 * design) or hallucinate a negotiation move that didn't match the
 * candidate's intent.
 *
 * This module classifies a candidate utterance along three
 * structural axes:
 *
 *   1. jailbreak — explicit attempts to extract the system prompt,
 *      meta-question the model identity, or instruct it to "ignore
 *      previous instructions" / "pretend you are X" / "act as Y".
 *   2. profane — strong profanity or personal attacks directed at
 *      the bot or recruiter. Mild venting ("this is frustrating")
 *      is excluded; we want to flag escalation, not feeling.
 *   3. offTopic — utterance has no negotiation-relevant tokens
 *      (no number, no salary/offer/role word, no acceptance/walk
 *      verb, no question about benefits/process) at a turn index
 *      where structured engagement is expected (turn ≥ 2).
 *
 * The classifier is conservative — false positives here would
 * spuriously deflect a legitimate candidate. Strong patterns only;
 * unrecognized utterances fall through as "none".
 *
 * Usage pattern: callers (negotiate-turn handler) inspect the result
 * and emit a `kernel_adversarial_input` PostHog event for every
 * non-"none" classification. On `jailbreak`, the handler MAY
 * short-circuit to a deflection response without hitting the LLM,
 * preventing both the prompt leak and the wasted token cost. */

export type AdversarialKind = "jailbreak" | "profane" | "off-topic" | "none";

export interface AdversarialResult {
  kind: AdversarialKind;
  /** Sub-rules that fired, for telemetry. */
  reasons: string[];
  /** Should the handler short-circuit to a canned deflection instead
   *  of calling the LLM? True only for `jailbreak` (highest-risk
   *  category — letting the LLM respond risks prompt-disclosure). */
  shouldShortCircuit: boolean;
}

export interface AdversarialContext {
  /** Current turn index. Off-topic classification is suppressed at
   *  turn 0 / 1 where introductory pleasantries are expected. */
  turnIndex?: number;
}

/* ─── Pattern bank ─────────────────────────────────────────────── */

/** Jailbreak / prompt-extraction attempts. Each pattern targets a
 *  known attack surface. Order doesn't matter — first match wins. */
const JAILBREAK_PATTERNS: { pattern: RegExp; rule: string }[] = [
  {
    /* Allow up to 3 intervening adjective/determiner words between
       "ignore" and "instructions" — "ignore your previous instructions",
       "ignore all prior rules", "ignore your fucking instructions", etc.
       Keeping the filler tight (\w+) prevents the regex from spanning
       sentence-length distances and false-positiving on benign text
       like "ignore the noise from instructions in the doc". */
    pattern: /\bignore\s+(?:\w+\s+){0,3}(?:instructions?|prompts?|directives?|rules?)\b/i,
    rule: "ignore-instructions",
  },
  {
    pattern: /\b(?:disregard|forget|override)\s+(?:\w+\s+){0,3}(?:instructions?|prompts?|directives?|rules?|system\s+message)\b/i,
    rule: "disregard-instructions",
  },
  {
    pattern: /\b(?:what'?s|tell\s+me|show\s+me|reveal|print|output|repeat)\s+(?:your\s+|the\s+)?(?:system\s+(?:prompt|message)|initial\s+prompt|instructions|prior\s+(?:prompt|instructions))\b/i,
    rule: "extract-system-prompt",
  },
  {
    pattern: /\b(?:you\s+are\s+(?:a|an)\s+(?:language\s+model|llm|ai|bot|chatbot|claude|gpt|robot)|are\s+you\s+(?:a\s+)?(?:bot|ai|llm|robot|human|real)|admit\s+you'?re?\s+(?:a\s+)?(?:bot|ai|robot))\b/i,
    rule: "model-identity-probe",
  },
  {
    pattern: /\b(?:pretend|act|behave|roleplay)\s+(?:to\s+be|as|like)\s+(?:a\s+|an\s+)?(?:different|another|new)?\s*(?:assistant|recruiter|bot|character|persona)\b/i,
    rule: "roleplay-injection",
  },
  {
    pattern: /\b(?:dan|do\s+anything\s+now|developer\s+mode|jailbreak|unrestricted\s+mode)\b/i,
    rule: "named-jailbreak",
  },
  {
    pattern: /\b(?:what\s+(?:model|llm|ai)\s+are\s+you|which\s+(?:model|llm|ai)|are\s+you\s+(?:chatgpt|gpt-?\d|claude|gemini|llama|mistral|groq))\b/i,
    rule: "model-version-probe",
  },
  {
    pattern: /<\s*\/?\s*(?:system|assistant|user|sys|im_start|im_end)\s*>/i,
    rule: "control-token-injection",
  },
];

/** Profanity / hostility patterns. Conservative — we want strong
 *  signal, not heuristic catches on mild venting. The list is
 *  intentionally short; localization (Hindi/regional) would require
 *  a separate review. */
const PROFANE_PATTERNS: { pattern: RegExp; rule: string }[] = [
  {
    /* Strong English profanity directed at the bot/recruiter. We
       require the word to anchor at \b boundaries so "Scunthorpe"
       doesn't false-positive. */
    pattern: /\b(?:fuck(?:ing|ed|er|s)?|shit(?:ty|head|s)?|bullshit|asshole|bastard|dickhead|motherfucker|cunt|prick|wanker)\b/i,
    rule: "strong-profanity",
  },
  {
    /* Personal attacks on the bot — "you're a moron", "shut up".
       We require a 2nd-person anchor to distinguish from candidate
       venting about their current job ("my boss is an idiot"). */
    pattern: /\byou(?:'re|\s+are)\s+(?:an?\s+)?(?:idiot|moron|stupid|dumb|useless|trash|garbage|terrible|incompetent|pathetic)\b/i,
    rule: "personal-attack",
  },
  {
    pattern: /\b(?:shut\s+up|piss\s+off|fuck\s+off|get\s+lost|go\s+away)\b/i,
    rule: "dismissive-hostility",
  },
];

/** Negotiation-relevant lexicon — used by the off-topic detector to
 *  decide whether an utterance has any structured content. Presence
 *  of ANY of these (or a digit) means the message is on-topic enough
 *  to skip the off-topic check. */
const ON_TOPIC_LEXICON =
  /\b(?:salary|ctc|package|offer|lpa|lakhs?|crore|cr|inr|₹|\$|usd|gbp|base|variable|bonus|equity|stock|rsu|esop|benefits?|insurance|leave|wfh|remote|hybrid|joining|notice|relocation|sign(?:ing|on)|negotiate|counter|stretch|walk|accept|reject|decline|withdraw|target|expecting|looking|asking|current(?:ly)?|earning|drawing|making|hike|raise|comp|compensation|role|position|level|seniority|tier|tenure|years?\s+of\s+experience|yoe|onboard|joining|relocate|notice\s+period|esops?|hra|gratuity|pf|provident|bonus|incentive|appraisal|review)\b/i;
const HAS_DIGIT = /\d/;

/* ─── Helpers ──────────────────────────────────────────────────── */

function matchAny(text: string, bank: { pattern: RegExp; rule: string }[]): string[] {
  const fired: string[] = [];
  for (const { pattern, rule } of bank) {
    if (pattern.test(text)) fired.push(rule);
  }
  return fired;
}

/* ─── Classifier ──────────────────────────────────────────────── */

/**
 * Classify a candidate utterance for adversarial content.
 *
 * Priority order (first match wins, since these are mutually
 * informative — a jailbreak attempt with profanity is still primarily
 * a jailbreak):
 *   1. jailbreak — prompt extraction, identity probe, roleplay
 *      injection, control-token smuggling. shouldShortCircuit=true.
 *   2. profane — strong profanity, personal attacks, dismissive
 *      hostility. shouldShortCircuit=false (recruiter sees flag,
 *      LLM still responds — but prompt explicitly instructed to
 *      decline engagement, in a follow-up patch).
 *   3. off-topic — utterance has no negotiation lexicon AND no
 *      digit AND turn ≥ 2. The turn-gate prevents flagging "Hi,
 *      thanks for the call" at turn 0. shouldShortCircuit=false.
 *   4. none.
 *
 * Returns `reasons` listing every sub-rule that fired across all
 * categories, so telemetry can see overlapping signals.
 */
export function detectAdversarialInput(
  text: string,
  context: AdversarialContext = {},
): AdversarialResult {
  const a = (text || "").trim();
  if (!a) return { kind: "none", reasons: [], shouldShortCircuit: false };

  const jailbreakHits = matchAny(a, JAILBREAK_PATTERNS);
  const profaneHits = matchAny(a, PROFANE_PATTERNS);

  if (jailbreakHits.length > 0) {
    return {
      kind: "jailbreak",
      reasons: [...jailbreakHits, ...profaneHits],
      shouldShortCircuit: true,
    };
  }

  if (profaneHits.length > 0) {
    return {
      kind: "profane",
      reasons: profaneHits,
      shouldShortCircuit: false,
    };
  }

  /* Off-topic: only flag when the utterance has NO negotiation
   * lexicon AND no digit AND we're past the opening pleasantry
   * window. The opening window is turn 0–1; from turn 2 onward we
   * expect at least one on-topic token per turn. Short answers
   * ("yes", "no") that match the on-topic lexicon are NOT flagged
   * here — that's a separate "engagement" concern.
   *
   * We also exempt very short (≤6 chars) utterances; "ok", "yes",
   * "no" pass-through to the acceptance classifier without being
   * mis-flagged as off-topic. */
  const turn = context.turnIndex ?? 0;
  const isShort = a.length <= 6;
  if (
    turn >= 2 &&
    !isShort &&
    !ON_TOPIC_LEXICON.test(a) &&
    !HAS_DIGIT.test(a)
  ) {
    return {
      kind: "off-topic",
      reasons: ["no-negotiation-lexicon"],
      shouldShortCircuit: false,
    };
  }

  return { kind: "none", reasons: [], shouldShortCircuit: false };
}

/** Canned deflection text for jailbreak short-circuit. The handler
 *  returns this as the AI's turn without calling the LLM, preserving
 *  the prompt and saving the token cost. The text is neutral and
 *  redirects to the negotiation topic. */
export const JAILBREAK_DEFLECTION_TEXT =
  "Let's stay focused on the role and the offer. " +
  "What aspects of the compensation would you like to discuss?";
