/* Prompt version registry. Bump an entry whenever that endpoint's prompt text,
 * rubric or output schema changes, so a quality shift in PostHog `$ai_generation`
 * events can be traced to the prompt revision that caused it. Retry and
 * assembly variants (`follow-up-dedup-retry`, `evaluate-session-fast`) inherit
 * their base endpoint's version via the longest matching prefix. */

import { REPORT_VERSION } from "./_evaluate-report-cache";

export const PROMPT_VERSIONS: Readonly<Record<string, string>> = {
  "analyze-resume": "v1",
  "auto-recommendations": "v1",
  "jd-match": "v1",
  "coach-followup": "v1",
  "evaluate": "v1",
  "employer-parse-jd": "v1",
  "evaluate-session": REPORT_VERSION,
  "follow-up": "v1",
  "generate": "v1",
  "generate-questions": "v1",
  "insights": "v1",
  "negotiate-turn": "v1",
  "requirement-match-llm": "v1",
  "resume-rewrite-bullet": "v1",
};

export function promptVersionFor(endpoint: string | undefined): string {
  if (!endpoint) return "unversioned";
  const exact = PROMPT_VERSIONS[endpoint];
  if (exact) return exact;
  let best = "";
  for (const key of Object.keys(PROMPT_VERSIONS)) {
    if (endpoint.startsWith(`${key}-`) && key.length > best.length) best = key;
  }
  return best ? PROMPT_VERSIONS[best] : "unversioned";
}
