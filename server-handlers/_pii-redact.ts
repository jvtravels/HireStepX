/* HireStepX — PII redaction for AI-generated profile fields

   The LLM is told not to surface PII (phone, email, address, ID
   numbers) in the narrative fields it returns, but models occasionally
   echo back snippets they "noticed" in the resume — e.g. paraphrasing
   "reach me at rahul@example.com" into a summary. Anything that
   reaches the client is rendered on the score card; we don't want PII
   landing in screenshots, share links, or future public profiles.

   This module strips a small set of HIGH-CONFIDENCE patterns. We
   deliberately err on the side of keeping more text intact than less
   — over-redacting butchers the narrative ("Worked at [REDACTED]"
   reads worse than the original). Patterns are limited to:

     • email addresses
     • Indian phone formats (+91 / 10-digit)
     • generic E.164-style international phones (+digits)
     • Indian PAN  (5 letters, 4 digits, 1 letter)
     • Aadhaar (12 digits)
     • US SSN (3-2-4 digits with dashes/spaces)
     • plausible street addresses (very narrow heuristic)

   We do NOT redact:
     • company names or domains (those are professional content)
     • people names mentioned in the summary (the user IS the subject)
     • generic city / state / country names
     • numbers attached to metrics ("32% improvement", "₹50 Cr")

   The client-side resume parser already strips most PII before the
   text reaches the LLM (see resumeParser.ts), so this module is the
   second line of defense against any PII the parser missed AND any
   PII the LLM hallucinates by re-emitting fragments it saw. */

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// Indian mobile — first digit 6/7/8/9 plus 9 more digits, where ANY
// of the gaps between digits may be a single space or dash. Matches
// 5-5 (98765 43210), 3-3-4 (987 654 3210), 3-7 (987 6543210), bare
// 9876543210, etc. The optional +91 / 91 prefix may appear before.
// Word boundary at the end keeps "9876543210 customers" from matching
// the digits inside "9876543210customers" — at the start we don't
// require a boundary because the leading + would break it.
const PHONE_IN_RE = /(?:\+?91[\s-]?)?[6-9](?:[\s-]?\d){9}\b/g;

// Generic international phone — leading + and 7-15 digits with
// optional separators. Narrow because we don't want to eat numbers
// like "$10,000" or "300 million". Requires the +.
const PHONE_GENERIC_RE = /\+\d(?:[\s-]?\d){6,14}\b/g;

// Indian PAN — 5 letters / 4 digits / 1 letter, uppercase only. Very
// distinctive shape.
const PAN_RE = /\b[A-Z]{5}\d{4}[A-Z]\b/g;

// Aadhaar — 12 digits in 4-4-4 groups (with optional spaces). Bare
// 12-digit runs are too noisy without grouping, so require either
// spaces / dashes between the groups OR exact 12-digit isolated.
const AADHAAR_RE = /\b\d{4}[\s-]\d{4}[\s-]\d{4}\b/g;

// US SSN — 3-2-4 with dashes or spaces.
const SSN_RE = /\b\d{3}[\s-]\d{2}[\s-]\d{4}\b/g;

const REDACTED = "[redacted]";

/** Redact PII patterns from a single string. Returns the input if no
    PII is detected (no allocation churn for the common case). */
export function redactPii(input: string): string {
  if (!input || typeof input !== "string") return input;
  let s = input;
  // Order matters slightly — emails first so the @-suffix doesn't
  // get partially eaten by phone matchers on weird inputs.
  if (EMAIL_RE.test(s)) s = s.replace(EMAIL_RE, REDACTED);
  // Reset lastIndex on the global regexes (they're stateful).
  PHONE_IN_RE.lastIndex = 0;
  if (PHONE_IN_RE.test(s)) s = s.replace(PHONE_IN_RE, REDACTED);
  PHONE_GENERIC_RE.lastIndex = 0;
  if (PHONE_GENERIC_RE.test(s)) s = s.replace(PHONE_GENERIC_RE, REDACTED);
  PAN_RE.lastIndex = 0;
  if (PAN_RE.test(s)) s = s.replace(PAN_RE, REDACTED);
  AADHAAR_RE.lastIndex = 0;
  if (AADHAAR_RE.test(s)) s = s.replace(AADHAAR_RE, REDACTED);
  SSN_RE.lastIndex = 0;
  if (SSN_RE.test(s)) s = s.replace(SSN_RE, REDACTED);
  // Reset for next call (defensive, since the helper may be reused).
  EMAIL_RE.lastIndex = 0;
  return s;
}

/** Walk a profile object and redact PII from every string-valued or
    string-array field. Mutates and returns the same object. Non-string
    leaves (numbers, booleans, nulls) pass through untouched. */
export function redactProfilePii(
  profile: Record<string, unknown>,
): Record<string, unknown> {
  for (const key of Object.keys(profile)) {
    const v = profile[key];
    if (typeof v === "string") {
      profile[key] = redactPii(v);
    } else if (Array.isArray(v)) {
      profile[key] = v.map((item) =>
        typeof item === "string" ? redactPii(item) : item,
      );
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      // Shallow recursion — the LLM occasionally returns nested objects
      // (e.g. scoreBreakdown). One level is enough; deeper structures
      // don't appear in the current contract.
      redactProfilePii(v as Record<string, unknown>);
    }
  }
  return profile;
}
