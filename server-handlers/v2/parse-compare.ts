/* V2 parse comparator (2026-06-09) — diagnostic-only.
 *
 * Side-by-side comparison of the regex parse layer (deriveState in
 * kernel.ts) vs an LLM-driven extraction of the same candidate turn.
 * Runs fire-and-forget AFTER the v2 serving path has already returned.
 * Logs both extractions to PostHog so we can read out post-hoc whether
 * regex coverage is the bottleneck the simulation implied.
 *
 * IMPORTANT — this module:
 *   - never affects the served response (state is already derived and
 *     the canonical turn is already returned by the time we run)
 *   - is gated behind NEGOTIATION_V2_PARSE_COMPARE=1 (off by default)
 *   - swallows every error (we are pure telemetry; we never throw)
 *   - is bounded to one LLM call per turn, ~$0.0005 each
 *
 * No new validators. No new prompt rules. No new derived-state fields.
 * Read-only observation of where the regex banks miss signal that the
 * kernel could have acted on. Aligned with the no-patchwork rule —
 * this gives us data BEFORE deciding what (if anything) to change. */

import { captureServerEvent } from "../_posthog";
import type { GenerateAiTextFn } from "../_response-pipeline";
import {
  deriveState,
  type ConversationTurn,
  type DerivedState,
} from "./kernel";

/** What the LLM is asked to extract from one candidate utterance.
 *  Shape is deliberately small — we only compare on the fields the
 *  kernel actually uses to drive legalTools / validators. */
interface LlmExtraction {
  /** Numbers the candidate stated, classified by what they refer to. */
  numbers: Array<{
    value: number;
    kind:
      | "current_ctc"
      | "current_base"
      | "current_variable"
      | "current_variable_actual_pct"
      | "target"
      | "competing_offer_lpa"
      | "market_claim_lpa"
      | "notice_period_days"
      | "joining_bonus"
      | "esop_lpa"
      | "other";
  }>;
  /** Did the candidate explicitly ask for an offer this turn? */
  is_offer_ask: boolean;
  /** Topics the candidate surfaced (from canonical bank). */
  topics_surfaced: string[];
  /** Topics the candidate closed (negated or soft-closed). */
  topics_closed: string[];
  /** Acceptance signal: hard accept, conditional ("yes if X"), or none. */
  acceptance: "hard" | "conditional" | "none";
  /** When acceptance is "conditional", the conditions attached. */
  conditions: string[];
}

const EXTRACTION_SYSTEM_PROMPT = `You read one message from a salary-negotiation candidate (Indian software engineer or product designer, comp in LPA) and extract structured signal.

Return ONLY a JSON object matching this schema. No prose.

{
  "numbers": [{"value": number, "kind": "current_ctc"|"current_base"|"current_variable"|"current_variable_actual_pct"|"target"|"competing_offer_lpa"|"market_claim_lpa"|"notice_period_days"|"joining_bonus"|"esop_lpa"|"other"}],
  "is_offer_ask": boolean,
  "topics_surfaced": string[],
  "topics_closed": string[],
  "acceptance": "hard"|"conditional"|"none",
  "conditions": string[]
}

Rules:
- All LPA-shaped numbers go in "numbers" with a kind. "competing_offer_lpa" requires a named or hinted other company; "market_claim_lpa" is peer/market/levels.fyi claims without a specific in-hand offer.
- Variable-actual-payout-rate (e.g. "they say it's 4 LPA but I only got 60% of it") → kind "current_variable_actual_pct", value 60.
- Ranges like "31-32 LPA" → emit the midpoint.
- Hindi/Hinglish like "chaar lakh" or "tees LPA" → convert to number.
- "is_offer_ask" is true if the candidate is asking the recruiter to put a number on the table.
- "topics_surfaced" / "topics_closed" use these canonical labels only: base, variable, esop, joining_bonus, notice, retention, equity, role, location, timeline, references.
- "acceptance: conditional" when the candidate accepts contingent on something ("yes if you can also bump joining date").`;

/** Build the user prompt for the extractor — just the candidate text,
 *  plus the prior AI turn for one-turn context. Intentionally small. */
function buildExtractionUserPrompt(
  candidateText: string,
  priorAiText: string | null,
): string {
  const ctx = priorAiText
    ? `Previous recruiter turn (context):\n${priorAiText}\n\n`
    : "";
  return `${ctx}Candidate said:\n${candidateText}\n\nExtract.`;
}

function parseExtraction(raw: string): LlmExtraction | null {
  const trimmed = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const m = trimmed.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]) as unknown;
    if (!obj || typeof obj !== "object") return null;
    /* Light shape-check — no Zod here; the analyst can filter
     * malformed rows out at query time. */
    const o = obj as Partial<LlmExtraction>;
    return {
      numbers: Array.isArray(o.numbers) ? o.numbers : [],
      is_offer_ask: Boolean(o.is_offer_ask),
      topics_surfaced: Array.isArray(o.topics_surfaced) ? o.topics_surfaced : [],
      topics_closed: Array.isArray(o.topics_closed) ? o.topics_closed : [],
      acceptance:
        o.acceptance === "hard" || o.acceptance === "conditional"
          ? o.acceptance
          : "none",
      conditions: Array.isArray(o.conditions) ? o.conditions : [],
    };
  } catch {
    return null;
  }
}

/** What the regex parse layer pulled from this single candidate turn
 *  (computed by diffing the kernel's DerivedState before and after the
 *  turn). Numeric symmetric-diff is enough — we don't reconstruct kind. */
interface RegexPerTurnSignal {
  numbers_added: number[];
  offer_ask_fired: boolean;
  topics_surfaced_added: string[];
  topics_closed_added: string[];
  target_set: number | null;
  acceptance_fired: boolean;
  premise_numbers_added: number[];
}

function diffStates(before: DerivedState, after: DerivedState): RegexPerTurnSignal {
  const beforeNums = new Set(before.mentionedNumbers);
  const beforeSurfaced = new Set(before.surfacedTopics);
  const beforeClosed = new Set(before.closedTopics);
  const beforePremise = new Set(before.unverifiedPremiseNumbers);
  return {
    numbers_added: after.mentionedNumbers.filter((n) => !beforeNums.has(n)),
    offer_ask_fired: after.offerAskCount > before.offerAskCount,
    topics_surfaced_added: after.surfacedTopics.filter((t) => !beforeSurfaced.has(t)),
    topics_closed_added: after.closedTopics.filter((t) => !beforeClosed.has(t)),
    target_set:
      after.candidateTarget !== before.candidateTarget ? after.candidateTarget : null,
    acceptance_fired:
      before.verbalAcceptanceTurn === null && after.verbalAcceptanceTurn !== null,
    premise_numbers_added: after.unverifiedPremiseNumbers.filter(
      (n) => !beforePremise.has(n),
    ),
  };
}

/** Numeric overlap between regex-extracted numbers and LLM-extracted
 *  numbers. Used as the headline "did regex find what the LLM found?"
 *  metric in the PostHog event. */
function numberOverlap(
  regexNums: number[],
  llmNums: Array<{ value: number }>,
): { regex_only: number[]; llm_only: number[]; shared: number[] } {
  const r = new Set(regexNums);
  const l = new Set(llmNums.map((x) => x.value));
  return {
    regex_only: [...r].filter((n) => !l.has(n)),
    llm_only: [...l].filter((n) => !r.has(n)),
    shared: [...r].filter((n) => l.has(n)),
  };
}

/** Entry point. Fire-and-forget — caller does NOT await this. Gated by
 *  NEGOTIATION_V2_PARSE_COMPARE=1 env var. Bounded to one LLM call. */
export function compareParsePerTurnAsync(
  log: ConversationTurn[],
  generateAiText: GenerateAiTextFn,
  distinctId: string,
  sessionId: string,
): void {
  if (process.env.NEGOTIATION_V2_PARSE_COMPARE !== "1") return;
  /* Last turn must be a candidate utterance — that's the new info
   * the kernel just derived state from. If the AI is opening or the
   * last turn is the AI, there's nothing to compare. */
  const last = log[log.length - 1];
  if (!last || last.role !== "candidate") return;

  /* Fire-and-forget. Wrap the whole thing so a thrown promise
   * rejection can't crash the node process. */
  void (async () => {
    try {
      const before = deriveState(log.slice(0, -1));
      const after = deriveState(log);
      const regex = diffStates(before, after);

      const priorAi =
        log.length >= 2 && log[log.length - 2].role === "ai"
          ? log[log.length - 2].text
          : null;

      const raw = await generateAiText(
        EXTRACTION_SYSTEM_PROMPT,
        buildExtractionUserPrompt(last.text, priorAi),
        { temperature: 0, userId: distinctId },
      );
      const llm = parseExtraction(raw);

      const overlap = llm
        ? numberOverlap(regex.numbers_added, llm.numbers)
        : { regex_only: regex.numbers_added, llm_only: [] as number[], shared: [] as number[] };

      /* PostHog Props type disallows arrays — JSON-stringify all
       * list-shaped fields. Analyst parses them back at query time. */
      void captureServerEvent("negotiation_v2_parse_compare", distinctId, {
        session_id: sessionId,
        turn_index: after.turnIndex,
        candidate_text_len: last.text.length,
        /* Regex side — what deriveState pulled from this single turn. */
        regex_numbers_json: JSON.stringify(regex.numbers_added),
        regex_offer_ask: regex.offer_ask_fired,
        regex_topics_surfaced_json: JSON.stringify(regex.topics_surfaced_added),
        regex_topics_closed_json: JSON.stringify(regex.topics_closed_added),
        regex_target_set: regex.target_set,
        regex_acceptance: regex.acceptance_fired,
        regex_premise_numbers_json: JSON.stringify(regex.premise_numbers_added),
        /* LLM side. */
        llm_parsed: llm !== null,
        llm_numbers_json: JSON.stringify(llm?.numbers ?? []),
        llm_offer_ask: llm?.is_offer_ask ?? null,
        llm_topics_surfaced_json: JSON.stringify(llm?.topics_surfaced ?? []),
        llm_topics_closed_json: JSON.stringify(llm?.topics_closed ?? []),
        llm_acceptance: llm?.acceptance ?? null,
        llm_conditions_json: JSON.stringify(llm?.conditions ?? []),
        /* Headline numeric overlap. */
        numbers_regex_only_json: JSON.stringify(overlap.regex_only),
        numbers_llm_only_json: JSON.stringify(overlap.llm_only),
        numbers_shared_json: JSON.stringify(overlap.shared),
        /* Boolean disagreement flags — easy to filter on in dashboard. */
        disagree_offer_ask:
          llm !== null && llm.is_offer_ask !== regex.offer_ask_fired,
        disagree_acceptance:
          llm !== null &&
          (llm.acceptance !== "none") !== regex.acceptance_fired,
      });
    } catch (err) {
      void captureServerEvent("negotiation_v2_parse_compare_error", distinctId, {
        session_id: sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}
