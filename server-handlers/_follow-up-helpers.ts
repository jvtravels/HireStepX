/**
 * Pure logic extracted from server-handlers/follow-up.ts so the intent
 * detection + salary-number extraction can be unit-tested without
 * spinning up the 697-line handler + LLM mock.
 *
 * These functions run against the raw candidate answer before prompt
 * assembly. A bug here means the salary-negotiation interviewer shows
 * the wrong intent banner ("candidate accepted" when they rejected),
 * which causes catastrophic prompt-level misbehaviour.
 */

export interface CandidateIntent {
  accepted: boolean;
  /** Accepted with a condition/question attached ("I accept but what about equity?") */
  conditionalAccept: boolean;
  rejected: boolean;
  /** Explicitly signalling they're walking away */
  walkAway: boolean;
  /** Deflecting to avoid revealing their number */
  deflected: boolean;
  /** Asking for time / needs to think */
  needsTime: boolean;
  /** Mentioned competing offers */
  mentionedCompeting: boolean;
}

const acceptWords = /\b(i accept|i.?ll accept|accept the offer|sounds good|that works for me|it.?s a deal|i.?m happy with|fine with me|i agree|agreed|let.?s go ahead)\b/i;
/* Rejection signals — covers explicit rejection AND number-locking
   ("stick with 26 lakhs", "holding at 30 LPA", "won't go below"). The
   user-reported bug where "No, I would like to stick with 26 lakhs"
   wasn't classified as rejection traced back to this regex missing the
   "stick/hold/stay at <number>" family. The lookahead for an LPA-style
   number after the lock verb prevents false positives like "I'll stick
   with the team I have." */
const rejectWords = /\b(not acceptable|too low|can.?t accept|absolutely not|not enough|walk away|not interested|i reject|no deal|way too low|that.?s insulting|stick(?:ing)?\s+with(?=[^.]*\b(?:lakh|lpa|crore|cr\b|\d))|hold(?:ing)?\s+(?:at|firm)(?=[^.]*\b(?:lakh|lpa|crore|cr\b|\d))|stay(?:ing)?\s+at(?=[^.]*\b(?:lakh|lpa|crore|cr\b|\d))|firm\s+at(?=[^.]*\b(?:lakh|lpa|crore|cr\b|\d))|won.?t\s+(?:go\s+)?(?:below|under|lower)|need(?:s)?\s+at\s+least|expecting\s+(?:at\s+least\s+)?\d|^no\b[^.]*\b(?:lakh|lpa|crore|cr\b))/i;
const hedgeWords = /\b(but|however|only if|unless|provided|on condition|contingent|except|though)\b/i;
const deflectWords = /\b(you first|your offer|what.*you.*offer|tell me.*first|don.?t want to share|prefer not|rather not|you tell me)\b/i;
const thinkWords = /\b(need time|think about|sleep on|let me think|consider|talk to.*(?:family|partner|wife|husband)|get back to you|not ready)\b/i;
const competingWords = /\b(other offer|competing|another company|counter.?offer|multiple offers|also talking|interviewing at|got an offer)\b/i;
const walkAwayWords = /\b(walk away|walking away|i.?m out|not interested|i.?ll pass|no deal|withdraw|decline the offer|i decline|pull out|not worth|won.?t work|isn.?t going to work|move on|take the other|thanks but no|not for me|have to pass)\b/i;
const shortAffirmativeStart = /^(yes|yeah|okay|ok|sure|deal|agreed|accept|sounds good|that works|fine)\b/i;

/** Classify the candidate's answer in a salary negotiation. */
export function detectCandidateIntent(answer: string): CandidateIntent {
  const trimmed = (answer || "").trim();
  if (!trimmed) {
    return { accepted: false, conditionalAccept: false, rejected: false, walkAway: false, deflected: false, needsTime: false, mentionedCompeting: false };
  }

  const isShortAffirmative = trimmed.split(/\s+/).length < 8
    && shortAffirmativeStart.test(trimmed)
    && !hedgeWords.test(trimmed);

  const acceptIdx = trimmed.search(acceptWords);
  const hedgeIdx = trimmed.search(hedgeWords);
  const hasAccept = acceptIdx >= 0;
  const hasHedgeAfterAccept = hasAccept && hedgeIdx > acceptIdx;
  const postHedgeText = hasHedgeAfterAccept ? trimmed.slice(hedgeIdx) : "";
  const hedgeIsRejection = rejectWords.test(postHedgeText);

  const accepted = (hasAccept || isShortAffirmative) && !hedgeIsRejection;
  const conditionalAccept = accepted && hasHedgeAfterAccept && !hedgeIsRejection;
  const rejected = rejectWords.test(trimmed) && !accepted;
  const deflected = deflectWords.test(trimmed);
  const walkAway = walkAwayWords.test(trimmed) && !acceptWords.test(trimmed);

  const candidateNum = extractCandidateSalaryNumber(trimmed);
  // "consider" co-occurring with a number is a counter, not a time request
  const needsTime = thinkWords.test(trimmed) && candidateNum === null;
  const mentionedCompeting = competingWords.test(trimmed);

  return { accepted, conditionalAccept, rejected, walkAway, deflected, needsTime, mentionedCompeting };
}

/**
 * Extract the candidate's target salary number from free-text.
 *
 * Strategy:
 *   1. Find all numbers with LPA/lakh/lakhs/l suffix.
 *   2. If the target-phrase regex matches a number from that list, prefer it.
 *   3. Otherwise, if current-CTC regex matches the first number, use the last
 *      number as the target (e.g. "currently at 20, expecting 30" → 30).
 *   4. Otherwise fall back to the last number in the list.
 *   5. If no LPA-suffixed number found, look for bare numbers prefixed with
 *      ask-intent words, bounded to the salary-plausible range [3, 200].
 *
 * Returns null when no number is found.
 */
export function extractCandidateSalaryNumber(answer: string): string | null {
  if (!answer) return null;

  // Tolerant of common Indian-English STT mishears for "lakhs":
  //   "legs"  — Deepgram occasionally renders this when the speaker
  //             stresses the "h" → "leghs"
  //   "lacks" — common substitution for "lakhs"
  //   "lac"   — singular form (sometimes transcribed as "lakh")
  //   "lax"   — short STT form
  // The user-reported session had "20 legs per annum" — without this
  // tolerance the regex missed the number entirely and the
  // candidateTarget never got set, breaking downstream clamps.
  const salaryNumRe = /₹?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|lacs?|legs|lax|l\b)/gi;
  const currentCtcRe = /(?:currently|current(?:ly)?|earning|getting|drawing|my ctc|i'm at|making|take home|i get|i earn)\s.*?(\d+(?:\.\d+)?)/i;
  const targetRe = /(?:expecting|looking for|want|need|asking|target|hoping|would like|i'd like|i want|i need|looking at|aiming)\s.*?(\d+(?:\.\d+)?)/i;
  // Competing / in-hand offer — these are the candidate's BATNA, not
  // their target. Pulling them as the "target" causes the AI to
  // counter BELOW the candidate's actual ask. Captured separately so
  // the latest target-prefixed number wins even if a competing-offer
  // figure appears later in the same utterance.
  const competingRe = /(?:offer\s+of|in[-\s]?hand(?:\s+offer)?\s+(?:of|at)?|already\s+have|received|competing\s+offer\s+(?:of|at)?|got\s+an\s+offer\s+(?:of|at)?|another\s+offer\s+(?:of|at)?)\s*₹?\s*(\d+(?:\.\d+)?)/gi;
  const competingNums = new Set<string>();
  let cm: RegExpExecArray | null;
  while ((cm = competingRe.exec(answer)) !== null) competingNums.add(cm[1]);

  const allNums: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = salaryNumRe.exec(answer)) !== null) allNums.push(m[1]);

  // Bare-number fallback when no LPA suffix was found
  if (allNums.length === 0) {
    const bareNumMatch = answer.match(/(?:expecting|want|need|asking|target|hoping|looking for|around|about|at least|minimum)\s+(?:₹?\s*)?(\d+(?:\.\d+)?)\b/i);
    if (bareNumMatch) {
      const v = parseFloat(bareNumMatch[1]);
      if (v >= 3 && v <= 200) allNums.push(bareNumMatch[1]);
    }
  }

  // Strip competing-offer numbers from candidate-target consideration.
  // These get captured by the caller's competingOfferAmount field.
  const targetCandidates = allNums.filter(n => !competingNums.has(n));
  if (targetCandidates.length === 0 && allNums.length === 0) return null;
  // If every number was a competing-offer number, fall back to the last
  // one (preserves prior behaviour for single-number utterances).
  const pool = targetCandidates.length > 0 ? targetCandidates : allNums;

  // Strongest signal: ALL target-prefixed numbers (latest wins).
  // The previous regex took the FIRST target-prefix match, so
  // "I want 20, actually let me say I'd like 25" returned 20.
  // Iterate to find the LAST target-prefix match that appears in pool.
  const allTargetRe = /(?:expecting|looking for|want|need|asking|target|hoping|would like|i'd like|i want|i need|looking at|aiming)\s.*?(\d+(?:\.\d+)?)/gi;
  const targetMatches: string[] = [];
  let tm: RegExpExecArray | null;
  while ((tm = allTargetRe.exec(answer)) !== null) {
    if (pool.includes(tm[1]) && !competingNums.has(tm[1])) targetMatches.push(tm[1]);
  }
  if (targetMatches.length > 0) return targetMatches[targetMatches.length - 1];

  // Single-shot fallback to legacy behaviour for backward compat.
  const targetMatch = targetRe.exec(answer);
  if (targetMatch && pool.includes(targetMatch[1])) return targetMatch[1];

  const currentMatch = currentCtcRe.exec(answer);
  if (currentMatch && pool.length > 1 && pool[0] === currentMatch[1]) {
    return pool[pool.length - 1];
  }

  return pool[pool.length - 1];
}

/**
 * Truncate conversation history to a character budget, preserving the most
 * recent exchanges. Mirrors the historyCharLimit used in follow-up.ts
 * around line 159.
 */
export function truncateConversationHistory(history: string, budget: number): string {
  if (!history) return "";
  if (history.length <= budget) return history;
  // Keep the tail (most recent turns), prefix with marker.
  return `…[earlier turns truncated]\n${history.slice(-Math.max(budget - 40, 100))}`;
}

export interface PhaseFacts {
  acceptedImmediately?: boolean;
  candidateCounter?: string | null;
  hasCompetingOffers?: boolean;
  topicsRaised?: string[];
}

export interface DetectSalaryPhaseInput {
  /** Explicit phase override from client. Wins unconditionally. */
  negotiationPhase?: string;
  /** 0-indexed question number within the negotiation. */
  questionIndex?: number;
  /** Total questions in this negotiation session. */
  totalQuestions?: number;
  /** Extracted negotiation facts. */
  facts?: PhaseFacts | null;
  /** The candidate's most recent answer (for walk-away detection). */
  answer?: string;
}

export type SalaryPhase =
  | "offer-reaction"
  | "probe-expectations"
  | "counter-offer"
  | "benefits-discussion"
  | "closing-pressure"
  | "closing";

/**
 * Determine the negotiation conversation phase from session state.
 *
 * Closing phases require either explicit acceptance OR a stated counter.
 * Without one, late turns route to probe-expectations / counter-offer
 * instead — the negotiation cannot end before a number is on the table.
 */
export function detectSalaryPhase(input: DetectSalaryPhaseInput): SalaryPhase {
  const { negotiationPhase, questionIndex, totalQuestions, facts, answer } = input;
  if (negotiationPhase) return negotiationPhase as SalaryPhase;

  const idx = questionIndex ?? 0;
  const total = totalQuestions ?? 6;
  const progressRatio = idx / Math.max(1, total);

  if (facts?.acceptedImmediately) return "closing";

  const walkAwayPat = /\b(walk away|walking away|i.?m out|not interested|decline|pull out|no deal|have to pass)\b/i;
  if (answer && walkAwayPat.test(answer)) return "closing-pressure";

  if (facts?.candidateCounter && idx >= 2) return "counter-offer";

  if (facts?.hasCompetingOffers && !facts?.candidateCounter && idx <= 3) return "probe-expectations";

  const hasCounter = !!facts?.candidateCounter;
  // CLOSING REQUIRES EXPLICIT ACCEPTANCE. Stating a target ≠ agreeing
  // to close. Without acceptedImmediately, the deepest phase we route
  // to is closing-pressure — the AI keeps pushing for a yes, never
  // wraps up with "let me put together the final numbers".
  if (progressRatio >= 0.85 && hasCounter) return "closing-pressure";
  if (progressRatio >= 0.7 && hasCounter) return "closing-pressure";
  if (progressRatio >= 0.7 && !hasCounter) return "probe-expectations";

  if (facts?.topicsRaised && facts.topicsRaised.length >= 2 && idx >= 3) {
    return "benefits-discussion";
  }

  if (idx <= 1) return "offer-reaction";
  if (idx === 2) return "probe-expectations";
  if (idx === 3) return "counter-offer";
  if (idx === 4) return "benefits-discussion";
  if (idx === 5) return hasCounter ? "closing-pressure" : "probe-expectations";
  return hasCounter ? "closing-pressure" : "counter-offer";
}

export interface PickCounterInput {
  phase: SalaryPhase | string;
  initialOffer: number;
  maxStretch: number;
  walkAway: number;
  /** Highest ₹ already presented this session, if any. */
  highestOfferMade?: number | null;
  /** Candidate's stated target, if any. */
  candidateTarget?: number | null;
}

/**
 * Server-side recommended counter number for the AI's next turn.
 *
 * Removes the LLM's hand from picking ₹ values — it still writes prose
 * around the number but the figure itself is computed deterministically
 * from the band + session state. The post-LLM clamp guards stay in
 * place as a safety net; this just stops the hallucinations at the
 * source instead of reactively repairing them.
 *
 * Returns null when the phase shouldn't introduce a new number
 * (offer-reaction reuses the initial; probe-expectations is asking,
 * not offering; benefits / closing maintain the last counter).
 */
export function pickServerCounter(input: PickCounterInput): number | null {
  const { phase, initialOffer, maxStretch, highestOfferMade, candidateTarget } = input;

  const floor = Math.max(highestOfferMade ?? 0, initialOffer);
  const ceiling = maxStretch;

  // Cap aspiration at the band's ceiling. If the candidate's target is
  // above maxStretch, the AI shouldn't reach for it — it should flag.
  const aspiration = Math.min(candidateTarget ?? ceiling, ceiling);

  // If aspiration is already at or below floor, there's nowhere to move.
  if (aspiration <= floor) return null;

  let next: number | null = null;

  switch (phase) {
    case "offer-reaction":
      // First turn — present the initial offer. Caller usually has this
      // already from initialOfferText; we only return it for completeness.
      next = initialOffer;
      break;

    case "probe-expectations":
    case "benefits-discussion":
      // No new number this turn — these phases ask / discuss, they
      // don't offer.
      return null;

    case "counter-offer":
      // Split the difference between current floor and aspiration.
      next = floor + (aspiration - floor) * 0.5;
      break;

    case "closing-pressure":
      // Push 70% of the way toward aspiration — visible movement to
      // close the deal.
      next = floor + (aspiration - floor) * 0.7;
      break;

    case "closing":
      // Maintain the highest offer made; closing is the recap, not a
      // new bump.
      return null;

    default:
      return null;
  }

  if (next === null || !Number.isFinite(next)) return null;
  // Clamp to band, floor at monotonic, round to 0.1.
  next = Math.max(floor, Math.min(ceiling, next));
  return Math.round(next * 10) / 10;
}

/**
 * Extract mirroring anchors from a candidate's answer — the words and
 * phrases the LLM should echo verbatim in the follow-up to lift rapport.
 *
 * Two passes:
 * 1. High-frequency / proper-noun word ranking (top 5 lowercased keys).
 * 2. "the X" / "my X" / "our X" idiomatic phrases (length ≤4 words),
 *    casing preserved so "the Migration Project" survives.
 *
 * PII scrub: drops always-capitalized, low-frequency tokens that look
 * like personal first names. Tokens with internal caps (PhonePe), known
 * tech / company allowlist members (Stripe, Figma), or company-shape
 * suffixes (-ai, -labs, -tech, -inc, -corp, -io) survive.
 */
export function extractMirrorTokens(answer: string): string[] {
  if (!answer || answer.length < 30) return [];
  const stop = new Set([
    "the","and","you","your","what","when","where","which","who","whom","whose",
    "how","why","that","this","these","those","with","from","into","onto","upon",
    "have","has","had","was","were","been","being","are","could","should","would",
    "did","does","but","not","all","any","one","two","three","for","its","their","them",
    "they","there","then","than","also","just","like","about","after","before","each",
    "such","very","over","much","more","most","some","many","tell","share","walk",
    "give","make","made","take","took","get","got","said","say","says","really","actually",
    "because","while","whilst","through","across","around","without","within","under","upon",
    "myself","yourself","ourselves","themselves","itself","being","doing","going","saying",
    "people","person","thing","things","stuff","really","quite","kind","sort","still","also",
  ]);
  const NON_PII_CAPS = new Set([
    "stripe","razorpay","paytm","phonepe","figma","github","gitlab","slack","notion","jira",
    "zoom","azure","aws","gcp","docker","kubernetes","python","javascript","typescript",
    "react","node","postgres","mysql","redis","mongodb","graphql","rest","api","sdk",
    "google","microsoft","amazon","apple","meta","netflix","uber","ola","swiggy","zomato",
    "flipkart","myntra","cred","groww","zerodha","freshworks","zoho","tcs","infosys","wipro",
    "accenture","deloitte","mckinsey","bain","bcg","kpmg","ey","pwc","sap","oracle","ibm",
    "android","ios","linux","windows","macos","chrome","firefox","safari","cartesia","groq",
    "gemini","openai","anthropic","claude","supabase","vercel","upstash","deepgram","sarvam",
  ]);
  const COMPANY_SUFFIX = /(?:ai|ml|labs?|tech|inc|corp|io)$/i;

  const cleaned = answer.replace(/[^A-Za-z0-9\s'-]/g, " ");
  const words = cleaned.split(/\s+/).filter(Boolean);
  const freq = new Map<string, { count: number; capitalized: boolean; lowerCount: number; hasInternalCap: boolean }>();
  for (const w of words) {
    if (w.length < 4) continue;
    const lower = w.toLowerCase();
    if (stop.has(lower)) continue;
    const cur = freq.get(lower) || { count: 0, capitalized: false, lowerCount: 0, hasInternalCap: false };
    cur.count++;
    if (/^[A-Z]/.test(w)) cur.capitalized = true;
    else cur.lowerCount++;
    if (/^[A-Za-z].*[A-Z]/.test(w.slice(1))) cur.hasInternalCap = true;
    freq.set(lower, cur);
  }
  const ranked = Array.from(freq.entries())
    .filter(([lower, info]) => {
      if (!info.capitalized || info.lowerCount > 0) return true;
      if (info.count > 2) return true;
      if (lower.length > 10 || lower.length < 3) return true;
      if (NON_PII_CAPS.has(lower)) return true;
      if (info.hasInternalCap) return true;
      if (COMPANY_SUFFIX.test(lower)) return true;
      return false;
    })
    .sort((a, b) => (b[1].count - a[1].count) || ((b[1].capitalized ? 1 : 0) - (a[1].capitalized ? 1 : 0)))
    .slice(0, 5)
    .map(([w]) => w);

  const phraseRe = /\b(?:the|my|our)\s+([a-z][a-z-]{2,})(?:\s+([a-z][a-z-]{2,}))?\b/gi;
  const phrases: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = phraseRe.exec(answer)) !== null && phrases.length < 4) {
    const full = m[0].replace(/\s+/g, " ");
    if (!phrases.some(p => p.toLowerCase() === full.toLowerCase())) phrases.push(full);
  }
  return Array.from(new Set([...ranked, ...phrases])).slice(0, 6);
}
