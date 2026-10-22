// Server-owned competing-offer gate.
//
// Step 3 of the structural-fix series. The recurring bug class: the LLM
// fabricates a competing offer the candidate never mentioned —
//   "I appreciate you bringing up a competing offer, Jay…"
// when the candidate literally said "No, not really" to the question.
//
// Previous fix was a regex rewriter that only caught the specific phrasings
// we'd seen in screenshots. The LLM kept inventing variants the regex
// missed. The structural fix: a hard pre-send gate that strips ALL
// competing-offer references when the session has no recorded competing
// offer AND the candidate didn't affirmatively say they have one. Broad,
// not narrow.
//
// Inputs the helper considers:
//   sessionHasCompetingOffer  — true if any session-level flag says so
//                               (prepCompetingOffer set, hasCompetingOffers fact,
//                               negotiationScenario === "competing")
//   candidateText             — the candidate's latest message
//
// "Candidate mentioned" requires AFFIRMATIVE phrasing. "Any competing
// offer? No, not really" is a NEGATION — the helper must not treat that
// question-text as affirmation.

export type CompetingGateContext = {
  sessionHasCompetingOffer: boolean;
  candidateText: string;
};

// Affirmative claim of a competing offer from the candidate.
// Conservative: requires either an explicit "I have / received / got" verb,
// "in-hand offer", "another company offered me", OR a competing-offer
// phrase that's directly attached to a rupee figure.
// OA-B25 (2026-07-17): the possession-verb forms admit an OPTIONAL company /
// qualifier word between the determiner and "offer" — "I have an Amazon offer",
// "received a Google offer", "got another Flipkart offer". Previously the
// determiner had to abut "offer" directly, so any named-company phrasing
// ("an Amazon offer at ₹72L") slipped every branch and a real competing offer
// went undetected → the AI's competing-offer reference was wrongly stripped.
// Safe because it stays VERB-anchored (have/got/received/hold): a possession
// claim of an offer is competing by construction, so an aspirational "happy
// with an offer of ₹50L" (no possession verb) is still not matched.
const CANDIDATE_AFFIRMATIVE_RE =
  /\b(?:i\s+(?:have|got|received|hold)\s+(?:an?|another|a\s+competing)\s+(?:[a-z][\w'&.-]*\s+)?offer|received\s+(?:an|another|a\s+competing)\s+(?:[a-z][\w'&.-]*\s+)?offer|in[\s-]?hand\s+offer|another\s+company\s+(?:offered|has\s+offered)|got\s+(?:an|another)\s+offer\s+from)\b/i;

const CANDIDATE_COMPETING_WITH_NUMBER_RE =
  /\b(?:competing|other|another)\s+offer\s+(?:of|at|for)\s+₹?\s*\d/i;

// OA-B25 (2026-07-17): bare named-company offer welded to a rupee figure with
// NO possession verb — "Amazon offer at ₹72L", "Google offer of 75 LPA". Kept
// deliberately tight: a Capitalized proper-noun company token + "offer" + a
// preposition + a number. Requiring the capitalized company AND the attached
// figure keeps the false-positive surface tiny (an aspirational "an offer of
// ₹50L" has no leading company and never matches), while the recruiter's own
// on-table offer is referenced as "the/your/this offer", never "<Company>
// offer at ₹N".
const CANDIDATE_NAMED_COMPANY_OFFER_RE =
  /\b[A-Z][A-Za-z][\w&.-]*\s+offer\s+(?:of|at|for)\s+₹?\s*\d/;

// Negation guard: if the candidate explicitly denied a competing offer,
// affirmative matches DON'T apply. Without this guard, "any competing
// offer? no, not really" could trip phrases buried in question prefixes.
const CANDIDATE_NEGATION_RE =
  /\b(?:no(?:,?\s+(?:not\s+really|i\s+don['’]?t|none|nothing))?|not\s+really|don['’]?t\s+have|haven['’]?t\s+(?:received|got)|nothing\s+(?:yet|so\s+far))\b/i;

export function candidateMentionedCompetingOffer(text: string): boolean {
  if (!text) return false;
  // Negation wins if it appears before or right after any affirmative-looking
  // fragment. Cheapest check first: if there's a negation token at all and no
  // independent rupee-attached competing-offer phrase, treat as denied.
  const hasNumber = CANDIDATE_COMPETING_WITH_NUMBER_RE.test(text);
  if (hasNumber) return true; // "competing offer of ₹40 LPA" — explicit
  // Named-company offer welded to a figure ("Amazon offer at ₹72L") — explicit
  // competing signal (OA-B25). Like the number-attached branch, this wins
  // before the negation guard: a rupee-attached company offer is unambiguous.
  if (CANDIDATE_NAMED_COMPANY_OFFER_RE.test(text)) return true;
  const hasAffirmative = CANDIDATE_AFFIRMATIVE_RE.test(text);
  if (!hasAffirmative) return false;
  // Affirmative phrase exists. Check for a negation token nearby — if the
  // candidate said "no, I don't have another offer" the affirmative regex
  // can over-match. Conservative call: if negation appears anywhere in the
  // message, treat as denied.
  if (CANDIDATE_NEGATION_RE.test(text)) return false;
  return true;
}

// All competing-offer references in AI prose. Broader than the prior regex —
// any noun-phrase containing "competing offer", "competing", "the other offer",
// "their offer", "from the other company", "other company's offer", or
// "bringing up a / your / the competing offer".
const PHANTOM_REFS_RE =
  /\b(?:bringing\s+up\s+(?:a|the|your|that)\s+competing\s+offer|(?:your|the|a|that|another|other)\s+competing\s+offer|(?:the|that)\s+other\s+(?:company|offer)|from\s+the\s+other\s+company|that\s+other\s+offer|the(?:ir)?\s+offer\s+of\s+₹|competing\s+offer(?:s)?\s+of)\b/gi;

// Drop the entire sentence that contains a phantom competing-offer phrase
// rather than substituting "your other options" — the substituted sentence
// often reads weirdly out of context ("To help me understand where we need
// to be competitive about your other options, could you…"). Removing the
// sentence is cleaner and the rest of the message stays grammatical.
export function stripPhantomCompetingOffer(
  text: string,
  ctx: CompetingGateContext,
): { text: string; stripped: boolean } {
  if (!text) return { text, stripped: false };
  if (ctx.sessionHasCompetingOffer) return { text, stripped: false };
  if (candidateMentionedCompetingOffer(ctx.candidateText)) return { text, stripped: false };

  // Use a fresh non-global regex for existence check — the module-level
  // /g regex maintains lastIndex across calls and would false-negative.
  if (!new RegExp(PHANTOM_REFS_RE.source, "i").test(text)) return { text, stripped: false };

  // Split on sentence boundaries; drop sentences whose body matches the
  // phantom regex. Preserves the rest of the response.
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept: string[] = [];
  let stripped = false;
  for (const s of sentences) {
    if (new RegExp(PHANTOM_REFS_RE.source, "i").test(s)) {
      stripped = true;
      continue;
    }
    kept.push(s);
  }
  let out = kept.join(" ").trim();
  // If we stripped EVERYTHING (the only content was phantom prose), fall
  // back to a safe neutral redirect.
  if (out.length === 0) {
    out = "Help me understand what would make this offer work for you — is it the headline number, the structure, or something else?";
  }
  return { text: out, stripped };
}
