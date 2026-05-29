/* Session Report — "Try this instead" snippet library.
 *
 * Backs the per-question `idealAnswerSnippet` field on the Question
 * view-model. The production path will replace these with LLM-generated
 * snippets per question; for now this library seeds a few canonical
 * snippets so the new coaching block renders against fixture / canvas
 * data without requiring a backend round-trip.
 *
 * Matching is intentionally lightweight (keyword on the question text
 * + band check) — when no snippet matches we return undefined and the
 * panel block simply doesn't render. That's the desired graceful
 * fallback: never show a "Try this instead" block with junk content.
 *
 * Pure data; no side effects. */

import type { Question } from "./types";

type Snippet = NonNullable<Question["idealAnswerSnippet"]>;

interface Rule {
  /** Lowercase substring or regex matched against the question text. */
  match: RegExp;
  snippet: Snippet;
}

/* Hand-tuned library. Each entry targets a common weak-answer shape
 * surfaced in fixtures / typical behavioural / negotiation prompts.
 * Keep the `text` under ~55 words — the block is meant to be read in
 * one glance, not studied. */
const RULES: Rule[] = [
  {
    match: /tell me about yourself|walk me through your background/i,
    snippet: {
      text:
        "I'm a backend engineer with four years scaling payments infra — most recently I cut p99 checkout latency from 820ms to 210ms at Acme, owning the migration end-to-end. I'm looking for a place where I can keep operating at that scope while moving closer to platform work.",
      whyBetter:
        "Leads with a quantified result, ties past work to the target role, and lands in under 60 words — your answer drifted across three jobs without a headline number.",
    },
  },
  {
    match: /conflict|disagree|difficult (colleague|teammate|coworker)/i,
    snippet: {
      text:
        "Our staff engineer wanted to ship the rewrite in one cut; I pushed for a two-phase rollout because we'd burned a weekend on a similar all-or-nothing release. I wrote up the risk matrix, walked him through it 1:1, and we shipped phase one with zero rollbacks.",
      whyBetter:
        "Names the disagreement, your specific action, and the measurable outcome — your version stayed in the framing of the conflict without showing what you did or what changed.",
    },
  },
  {
    match: /failure|mistake|something didn'?t go well/i,
    snippet: {
      text:
        "I shipped a cache layer without a kill-switch; when the invalidation logic broke, we served stale prices for 18 minutes. I owned the incident review, added kill-switches as a launch-checklist gate, and we've shipped 40+ features under that gate since with no recurrence.",
      whyBetter:
        "Owns the failure in first-person, quantifies the blast radius, and ends on the system-level fix — your answer leaned on 'we' and stopped before the learning.",
    },
  },
  {
    match: /salary|compensation|what are you looking for|expectations/i,
    snippet: {
      text:
        "Based on my research for senior backend roles at similar-stage companies, I'm targeting a total comp band of 48-56 lakhs, weighted toward base. Happy to walk through how I got there — but I'd love to hear what range you've budgeted for this role first.",
      whyBetter:
        "Anchors a justified range, signals research, and flips the question back without conceding — your answer named a single number and didn't probe their band.",
    },
  },
  {
    match: /why (this company|us|here|are you interested)/i,
    snippet: {
      text:
        "Two things. One — your infra team just published the Aurora-to-TiDB migration writeup; that's the exact problem I shipped at Acme and I want to go deeper on it. Two — every IC I talked to mentioned the design-review culture, which is what I've been missing at my current place.",
      whyBetter:
        "Cites a specific public artifact and a specific cultural signal from your own conversations — your answer named generic strengths anyone could have read off the homepage.",
    },
  },
];

/* Fallback snippets keyed by band — used when no question-text rule
 * matches but we still want to teach by example on weak answers. Kept
 * deliberately generic so they read as STAR-shape patterns, not as
 * answers to a specific prompt. */
const BAND_FALLBACK: Record<"weak" | "partial", Snippet> = {
  weak: {
    text:
      "Last quarter our checkout error rate spiked to 4%. I owned the investigation, traced it to a stale feature flag, shipped a rollback within 90 minutes, and added a flag-staleness alert. Error rate dropped back to 0.3% and we've caught two flags before they shipped since.",
    whyBetter:
      "Compact STAR shape — Situation, your Action in first person, a Result with numbers, and a Learning that closes the loop. Your answer skipped at least two of those rungs.",
  },
  partial: {
    text:
      "We hit the Q3 latency goal one week early — I'd flagged that the index migration was on the critical path and personally took the on-call rotation that week so the team could finish the cutover without context-switching.",
    whyBetter:
      "Same content as yours, but reframes 'we' into a specific first-person action that maps to the outcome — strong answers always name what the candidate, specifically, did.",
  },
};

/** Returns a snippet for this question, or undefined if none applies.
 *  Intentionally only fires for weak/partial bands — strong/complete
 *  answers don't need a "try this instead" callout. */
export function pickIdealAnswerSnippet(
  questionText: string,
  band: Question["band"]
): Snippet | undefined {
  if (band !== "weak" && band !== "partial") return undefined;
  for (const rule of RULES) {
    if (rule.match.test(questionText)) return rule.snippet;
  }
  return BAND_FALLBACK[band];
}
