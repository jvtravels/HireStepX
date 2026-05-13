/* Work-mode + location parser — Phase 15 (2026-05-13).
 *
 * The audit (2026-05-13) flagged that work-mode (remote / hybrid /
 * office) and relocation are real negotiation chips with measurable
 * compensation impact in India — a remote role typically caps 10-15%
 * below an equivalent Bangalore/Mumbai office role, and relocation
 * packages run ₹1-3 LPA — but the kernel had zero state for either.
 *
 * The ON_TOPIC_LEXICON in the adversarial detector mentioned
 * "wfh/remote/hybrid/relocation" so off-topic wouldn't false-flag, but
 * that's just topic recognition — no facts were captured.
 *
 * Failure modes this closes:
 *   1. Candidate says "I'd take 5 LPA less if it's fully remote" —
 *      pre-Phase-15 the kernel folded "5 LPA less" into the wrong
 *      bucket (or lost it entirely). The compensation-for-flexibility
 *      trade was invisible.
 *   2. Candidate says "I'm in Pune, can the role stay there?" — no
 *      state captured the location ask. The AI couldn't intelligently
 *      respond.
 *   3. Candidate asks for relocation assistance — the existing infrastructure
 *      had no way to track it, so the LLM had to invent figures.
 *
 * Patterns are conservative. The Indian metro lexicon is restricted to
 * the top hiring hubs; tier-2 cities pass through as generic "city". */

export type WorkMode = "remote" | "hybrid" | "office";

export interface LocationModeResult {
  /** Candidate's stated/preferred work mode. */
  workMode: WorkMode | null;
  /** Candidate's stated city / location constraint. Lowercased,
   *  trimmed; one of the recognised hubs or a generic-passthrough
   *  string when a non-hub is mentioned. */
  locationCity: string | null;
  /** Did the candidate request relocation assistance? */
  relocationRequested: boolean;
  /** Did the candidate explicitly REFUSE to relocate? Distinct from
   *  not-stating: a hard veto. */
  relocationRefused: boolean;
  /** Convenience flag. */
  hasAny: boolean;
}

const EMPTY: LocationModeResult = {
  workMode: null,
  locationCity: null,
  relocationRequested: false,
  relocationRefused: false,
  hasAny: false,
};

const REMOTE_PATTERNS = [
  /\b(?:fully\s+remote|100%\s+remote|completely\s+remote|work\s+from\s+home\s+permanently|remote\s+(?:only|forever|always)|wfh\s+forever)\b/i,
  /\bremote\s+(?:role|position|setup|preferred|first)\b/i,
];

const HYBRID_PATTERNS = [
  /\bhybrid\b/i,
  /\b(?:few\s+days\s+(?:in\s+)?office|\d+\s+days?\s+(?:in\s+)?office|partly\s+remote|mix\s+of\s+(?:wfh|remote)\s+and\s+office)\b/i,
];

const OFFICE_PATTERNS = [
  /\b(?:full(?:y)?\s+(?:in[-\s])?office|in[-\s]?office\s+(?:only|always)|wfo\b|work\s+from\s+office|on[-\s]?site\s+(?:only|required))\b/i,
];

/* India tier-1 hubs. Multiple spellings normalize to one canonical form. */
const CITY_PATTERNS: { canonical: string; pattern: RegExp }[] = [
  { canonical: "bangalore", pattern: /\b(?:bangalore|bengaluru|bglr|blr)\b/i },
  { canonical: "mumbai", pattern: /\b(?:mumbai|bombay|bom)\b/i },
  { canonical: "delhi-ncr", pattern: /\b(?:delhi|new\s+delhi|gurgaon|gurugram|ncr|noida|faridabad|ghaziabad)\b/i },
  { canonical: "hyderabad", pattern: /\b(?:hyderabad|hyd|cyberabad|gachibowli)\b/i },
  { canonical: "pune", pattern: /\b(?:pune|hinjewadi|magarpatta)\b/i },
  { canonical: "chennai", pattern: /\b(?:chennai|madras)\b/i },
  { canonical: "kolkata", pattern: /\b(?:kolkata|calcutta)\b/i },
  { canonical: "ahmedabad", pattern: /\b(?:ahmedabad|amd)\b/i },
];

const RELOCATION_REQUEST_PATTERNS = [
  /\b(?:relocation\s+(?:assistance|package|allowance|support)|help\s+with\s+relocation|cover\s+relocation|relocation\s+budget|moving\s+expenses|moving\s+allowance|temporary\s+accommodation|company\s+accommodation|guest\s+house)\b/i,
];

const RELOCATION_REFUSE_PATTERNS = [
  /\b(?:can.?t\s+relocate|cannot\s+relocate|won.?t\s+relocate|not\s+(?:able|willing)\s+to\s+relocate|no\s+relocation|prefer\s+not\s+to\s+(?:move|relocate)|tied\s+down\s+(?:here|to\s+\w+)|family\s+reasons|can.?t\s+(?:move|leave)\s+\w+|stuck\s+in\s+\w+)\b/i,
];

export function extractLocationMode(text: string): LocationModeResult {
  if (!text) return EMPTY;

  let workMode: WorkMode | null = null;
  if (REMOTE_PATTERNS.some((p) => p.test(text))) workMode = "remote";
  else if (HYBRID_PATTERNS.some((p) => p.test(text))) workMode = "hybrid";
  else if (OFFICE_PATTERNS.some((p) => p.test(text))) workMode = "office";

  let locationCity: string | null = null;
  for (const { canonical, pattern } of CITY_PATTERNS) {
    if (pattern.test(text)) {
      locationCity = canonical;
      break;
    }
  }

  const relocationRequested = RELOCATION_REQUEST_PATTERNS.some((p) => p.test(text));
  const relocationRefused = RELOCATION_REFUSE_PATTERNS.some((p) => p.test(text));

  const hasAny =
    workMode != null ||
    locationCity != null ||
    relocationRequested ||
    relocationRefused;
  return { workMode, locationCity, relocationRequested, relocationRefused, hasAny };
}

export function mergeLocationMode(
  prior: LocationModeResult | null | undefined,
  next: LocationModeResult,
): LocationModeResult {
  const p = prior ?? EMPTY;
  /* Refusal beats request — if at any point the candidate refuses
   * relocation, that's a hard signal that sticks; subsequent neutral
   * mention doesn't flip it. But explicit request later (rare) does. */
  const merged: LocationModeResult = {
    workMode: next.workMode ?? p.workMode,
    locationCity: next.locationCity ?? p.locationCity,
    relocationRequested: next.relocationRequested || (p.relocationRequested && !next.relocationRefused),
    relocationRefused: next.relocationRefused || (p.relocationRefused && !next.relocationRequested),
    hasAny: false,
  };
  merged.hasAny =
    merged.workMode != null ||
    merged.locationCity != null ||
    merged.relocationRequested ||
    merged.relocationRefused;
  return merged;
}
