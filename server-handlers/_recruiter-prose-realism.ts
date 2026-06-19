/* 2026-05-29 realism-pass — recruiter-prose humanizer.
 *
 * The 14-topic curated response bank is essay-fluent — every utterance
 * lands as polished press-release English. Real recruiters do three
 * things our bank doesn't:
 *   1. Tic. Each sector overuses 2-3 stock phrases. Big-4 says
 *      "fundamentally". GCC says "honestly". IT-services says "yeah so".
 *   2. Hedge. Real speech sprinkles "I mean", "honestly", "right" mid-
 *      sentence — small disfluencies that signal a human, not a script.
 *   3. Loop back. After a long point, real recruiters ask "does that
 *      make sense?" so the candidate doesn't monologue back.
 *
 * `humanizeRecruiterProse` decorates a curated string with these three
 * layers. Pure. Deterministic by sessionId+turnIndex+salt so the same
 * (session, turn) always produces the same humanized output (idempotent
 * retries don't churn the prose). All three layers fire probabilistically
 * — they're seasoning, not the meal — so most utterances ship unchanged
 * and the bank's accuracy is never overwritten.
 *
 * Wired into `_next-action-planner.ts` after `renderCandidateQuestionResponse`
 * returns prose, before the prose is packaged into the NextAction. Stays
 * OFF the snapshot path (snapshots pass null sessionId → all dice rolls
 * miss → byte-for-byte canonical output).
 *
 * Design rule: NEVER alters the topical anchor (the actual answer).
 * Only the scaffolding around it gets seasoned. If a layer would change
 * meaning, the layer is wrong. */

import type { RecruiterSectorPersona } from "./_indian-recruiter-personas";
import type { NegotiationPhase } from "./_negotiation-kernel";
import type { CandidateRegister } from "./_candidate-register";

/* 2026-05-29 mood-pass — recruiter personality moods. Three distinct
 * voices for the same brain: tone shifts, strategy/planner logic does
 * not. Seeded deterministically from sessionId at kernel init so the
 * same session always uses the same mood while different sessions
 * spread across the three buckets.
 *
 *   warm    — current behavior (default). Slight extra "sure"/"yeah"
 *             prefixes ~10% of turns.
 *   brusque — drops greetings, removes hedge softeners ("just",
 *             "maybe"), trims closing pleasantries. ~15% of softeners
 *             stripped (probabilistic per-turn).
 *   frantic — extra pause tics ("uh", "umm"), occasional self-
 *             interruption ("wait, sorry — what I meant was"), short
 *             clauses joined by "and". Subtle, not parodic. */
export type RecruiterMood = "warm" | "brusque" | "frantic";

/* 2026-05-29 mood-shift-pass — DYNAMIC mood overlay layered on top of
 * the seeded `recruiterMood` baseline. Real recruiters get visibly
 * colder when the candidate pushes hard at counter-offer phase, then
 * re-warm when the candidate concedes. The base mood (warm/brusque/
 * frantic) is the recruiter's permanent personality; the dynamic mood
 * is the in-call shift.
 *
 *   baseline  — no shift, use the seeded mood as-is (back-compat).
 *   cooled    — recruiter has been pushed; behaves brusque-like
 *               regardless of baseline. Adds one deterministic cold
 *               line per session.
 *   rewarmed  — recruiter has been re-engaged after cooling; behaves
 *               warm-like regardless of baseline. Adds a softening
 *               prefix once per shift. */
export type RecruiterMoodDynamic = "baseline" | "cooled" | "rewarmed";

/* Cold-line bank for `cooled` dynamic mood. ONE line per session,
 * picked deterministically by sessionId hash. The line is appended at
 * most ONCE per session (kernel stamps a `coldLineFiredAtTurn` to gate
 * the second fire). */
const COLD_LINES = [
  "Look, I've given you my best — if this doesn't work for you, I understand.",
  "I've stretched as far as I can on this one.",
] as const;

/* Pick a deterministic cold line for the session. Exported so tests can
 * assert which line a given sessionId produces. */
export function pickColdLine(sessionId: string | null | undefined): string {
  if (!sessionId) return COLD_LINES[0];
  const h = fnv1a(`cold-line|${sessionId}`);
  return COLD_LINES[h % COLD_LINES.length];
}

/* Softening prefix for `rewarmed` dynamic mood. Fires once per
 * cool→rewarm transition (kernel stamps `rewarmLineFiredAtTurn`). */
const REWARM_PREFIX = "Okay good, I think we're getting somewhere.";

/* Deterministic mood pick from sessionId. Three buckets, roughly even.
 * Pure: same sessionId → same mood, forever. Exported so the kernel's
 * initState can seed `state.recruiterMood` once at session start. */
export function deriveRecruiterMood(sessionId: string | null | undefined): RecruiterMood {
  if (!sessionId) return "warm";
  const h = fnv1a(`mood|${sessionId}`);
  const bucket = h % 3;
  if (bucket === 0) return "warm";
  if (bucket === 1) return "brusque";
  return "frantic";
}

export interface HumanizeContext {
  sector?: RecruiterSectorPersona | null;
  phase?: NegotiationPhase | null;
  sessionId?: string | null;
  turnIndex?: number;
  /* 2026-05-29 realism-pass Fix #3 — candidate register (inferred from
   * their utterance history). Biases layer probabilities so the
   * recruiter mirrors the candidate's register:
   *   - direct  → drop tic/hedge/checkback rates (no padding for
   *               someone who wants the number)
   *   - formal  → tic-pick avoids casual openers ("Yeah so")
   *   - casual  → unchanged (default rates already conversational)
   *   - neutral → unchanged (default rates) */
  candidateRegister?: CandidateRegister | null;
  /* 2026-05-29 realism-pass P0-1 audit follow-up — proper-noun guard.
   * When set, lowercaseFirst will NOT lowercase a leading occurrence of
   * this name after the tic prefix. Covers the canonical-prose greet
   * path ("Sandeep, take your time on this …" → "Look, Sandeep, take
   * your time on this …" instead of "Look, sandeep, …"). Optional;
   * the vocative regex already catches `[A-Z][a-z]+,` shape. */
  candidateFirstName?: string | null;
  /* 2026-05-29 mood-pass — recruiter personality mood. Seeded once at
   * session start from sessionId hash (see `deriveRecruiterMood`).
   * Affects tone only; planner/strategy is mood-blind. Default 'warm'
   * preserves prior behaviour, so omitting this field on the context
   * is back-compat. */
  mood?: RecruiterMood | null;
  /* 2026-05-29 mood-shift-pass — dynamic mood overlay. Kernel sets
   * this on the context when state.recruiterMoodDynamic !== 'baseline'.
   * When 'cooled' or 'rewarmed', the corresponding layer overrides
   * the baseline mood behaviour. Default 'baseline' (or omitted) is
   * byte-identical to prior behaviour. */
  moodDynamic?: RecruiterMoodDynamic | null;
  /* 2026-05-29 mood-shift-pass — whether the cold line for `cooled`
   * has ALREADY fired this session. Kernel-stamped; the humanizer
   * appends the cold line iff cooled AND !coldLineAlreadyFired. */
  coldLineAlreadyFired?: boolean;
  /* 2026-05-29 mood-shift-pass — whether the rewarm prefix has
   * already fired for this dynamic-mood shift. Kernel-stamped; the
   * humanizer prefixes iff rewarmed AND !rewarmLineAlreadyFired. */
  rewarmLineAlreadyFired?: boolean;
  /* 2026-05-29 realism-pass P0-1 audit follow-up — TEST-ONLY layer
   * force. Production callers never set this. When set, the named
   * dice-gate fires regardless of (sessionId, turnIndex, salt). Lets
   * tests pin "tic actually fires on inline-arm X" without depending
   * on FNV-1a hash luck — the prior approach (seed `s-pdf48` happens
   * to roll tic at turn 0) silently weakens when the salt list shifts.
   *
   * `tic` / `hedge` / `checkback` correspond 1:1 with the three layers
   * in `humanizeRecruiterProse`. Multiple may be set in a single test.
   * If sector is null the tic layer still picks the `default` tic set. */
  __forceLayer?: {
    tic?: boolean;
    hedge?: boolean;
    checkback?: boolean;
    mood?: boolean;
  };
}

/* Mood-layer constants. Pulled out so the layer body stays scannable
 * and so tests can reason about them. */
const WARM_PREFIXES = ["Sure,", "Yeah,", "Right,"];
const FRANTIC_TICS = ["Uh,", "Umm,"];
const FRANTIC_INTERRUPTIONS = [
  "wait, sorry — what I meant was",
  "actually, sorry — let me rephrase —",
];
/* Brusque softener-strippers. Drops the standalone word with its
 * trailing space; the regex is anchored to word boundaries so we don't
 * mangle "justify" or "maybely" (not a word, but the regex is the
 * point). Applied at ~50% per softener occurrence to "cut ~15% of
 * softeners" across a realistic prose distribution (softeners average
 * ~3 occurrences per long utterance). */
const BRUSQUE_SOFTENERS = /\b(?:just|maybe|perhaps|sort of|kind of)\s+/gi;
/* Brusque trailing pleasantry strippers — applied only to long prose
 * where we have something to trim. Conservative pattern: only removes
 * a final clause introduced by "and let me know" / "happy to" / "feel
 * free to". */
const BRUSQUE_PLEASANTRIES =
  /,?\s+(?:and\s+let\s+me\s+know[^.!?]*|happy\s+to[^.!?]*|feel\s+free\s+to[^.!?]*)([.!?])\s*$/i;

/* FNV-1a — duplicated from `_session-jitter.ts` to keep the realism
 * module standalone. 6 lines; not worth a shared util. */
function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* Deterministic [0, 1) from (sessionId, turnIndex, salt). */
function rand01(ctx: HumanizeContext, salt: string): number {
  if (!ctx.sessionId) return 0;
  const seed = `${ctx.sessionId}|${ctx.turnIndex ?? 0}|${salt}`;
  return fnv1a(seed) / 0x100000000;
}

/* Picks `p` (0..1) at the gate. Pass null sessionId → always 0 → always
 * misses (back-compat with snapshot tests). */
function diceHit(ctx: HumanizeContext, salt: string, p: number): boolean {
  if (!ctx.sessionId) return false;
  return rand01(ctx, salt) < p;
}

/* Persona-tics. Each sector has 2-3 stock phrases real recruiters from
 * that sector overuse. Inserted as a leading "Tic, prose" wrapper at a
 * ~22% rate when the persona is set.
 *
 * Phrasing curated to match the editorial register of each sector:
 *   - consulting-big4 / fmcg-mgmt: management-speak ("fundamentally",
 *     "at the end of the day"). Comes from MBB / Unilever culture.
 *   - psu / bfsi: process-speak ("as per", "policy-wise"). Risk-averse
 *     formality.
 *   - gcc: global stakeholder framing ("from a stakeholder perspective").
 *   - it-services / indian-unicorn / early-startup: casual operator
 *     register ("yeah so", "honestly", "look").
 *
 * Order matters for determinism — the rand01 pick is index-based. Adding
 * tics at the END of an array is safe; reordering shifts past sessions
 * to a new tic. */
const PERSONA_TICS: Record<RecruiterSectorPersona, readonly string[]> = {
  "consulting-big4": ["Fundamentally", "At the end of the day", "Look"],
  "fmcg-management": ["Fundamentally", "Look", "At the end of the day"],
  "psu":             ["As per process", "Policy-wise", "Look"],
  /* BFSI (Axis, HDFC, ICICI, Kotak HR) — formal bank-cadence,
   * policy-anchored. "Right so" was tonally wrong (IT-services
   * casual); replaced with "As per policy" + the genuinely bank-
   * register hedge "Frankly" used by senior BFSI HR on comp calls. */
  "bfsi":            ["Look", "Process-wise", "As per policy", "Frankly"],
  "gcc":             ["From a stakeholder perspective", "Honestly", "Right"],
  "it-services":     ["Yeah so", "Basically", "Right"],
  "indian-unicorn":  ["Look", "Honestly", "Right"],
  "early-startup":   ["Look", "Honestly", "Yeah"],
  "edtech":          ["Process-wise", "As per current policy", "Honestly"],
  "consulting-mbb":  ["Process-wise", "From a policy standpoint", "Fundamentally"],
  "default":         ["Look", "Right", "Honestly"],
};

/* 2026-05-29 sector×register coherence pass — formal-locked sectors get a
 * tightly curated whitelist of policy/process-flavored tics. BFSI, PSU, and
 * the two consulting flavors in FORMAL register must NEVER open with casual
 * American interjections ("Look", "Frankly", "Honestly"); they should only
 * use cadre/policy/process-anchored phrases. When sector is in this map AND
 * register === "formal", the humanizer uses ONLY this whitelist for Layer 1
 * tic-picking and bypasses the general casual-remover. Non-formal sectors
 * (unicorn, startup, gcc, etc.) are unaffected. */
const SECTOR_FORMAL_TIC_WHITELIST: Partial<Record<RecruiterSectorPersona, readonly string[]>> = {
  "bfsi":              ["As per policy", "Process-wise"],
  "psu":               ["As per cadre", "Process-wise", "As per rules"],
  "consulting-big4":   ["Process-wise", "From a policy standpoint"],
  "consulting-mbb":    ["Process-wise", "From a policy standpoint"],
};

/* Mid-sentence hedges. Real speech threads these as parentheticals after
 * the first comma in ~18% of utterances. Removing the hedge leaves a
 * well-formed sentence — so snapshot diffs without humanization stay
 * trivially readable. */
const HEDGES = ["honestly", "I mean", "to be fair", "right"];

/* Checkback suffixes — appended to long prose (≥40 words) at ~22% so
 * the candidate isn't left to monologue back. Question form so the
 * candidate has a concrete thing to answer ("yes" / "say more"). */
const CHECKBACKS = ["Does that make sense?", "You with me?", "Right?"];

/* Sentence starters that should NEVER be lowercased after a tic prefix.
 * The pronoun "I" is unambiguous; other capitalized words MAY be proper
 * nouns. Conservative: if the first word ends with a comma (vocative
 * pattern: "Sandeep, take your time"), assume proper noun and don't
 * lowercase. Same for the pronoun "I". The acronym guard (second char
 * must be lowercase letter) already handles ESOP / CTC / RM / HR. */
const VOCATIVE_OR_PRONOUN_START_RE = /^(?:I\b|[A-Z][a-z]+,)/;

/* Lowercase the first letter of `s` iff its first letter is currently
 * uppercase AND the second char is a lowercase letter (avoids breaking
 * acronyms like "ESOP", "CTC") AND the first word is not a vocative
 * (e.g. "Sandeep,") or the pronoun "I". `candidateFirstName` extends
 * the vocative guard when known — covers the planner-set greet path. */
export function lowercaseFirst(s: string, candidateFirstName?: string | null): string {
  if (s.length < 2) return s;
  if (VOCATIVE_OR_PRONOUN_START_RE.test(s)) return s;
  if (
    candidateFirstName &&
    candidateFirstName.length > 0 &&
    s.startsWith(candidateFirstName)
  ) {
    return s;
  }
  const c0 = s.charAt(0);
  const c1 = s.charAt(1);
  if (c0 >= "A" && c0 <= "Z" && c1 >= "a" && c1 <= "z") {
    return c0.toLowerCase() + s.slice(1);
  }
  return s;
}

/* ── Output-contract tidy pass (D5, 2026-06-18) ───────────────────────
 *
 * The realism chain (`chainProseOverlays`) runs up to five INDEPENDENT
 * overlay layers — context-ref clause, persona-tic signature, power-
 * posture, the humanizer's own tic/hedge/mood pass, and fallibility —
 * each prepending a discourse-filler with its OWN probabilistic dice and
 * no shared budget. On unlucky rolls they stack 2-3 deep into garbles a
 * real Indian HR would never utter:
 *   "In this profitability-first era, honestly, okay. what justifies it"
 *   "To be fair, I mean, okay. structure. actually, ..."
 * plus a broken capital after the sentence-final period ("okay. what").
 *
 * Enumerating "which layer fired" is the patchwork trap — every new
 * overlay re-opens the hole. Instead we enforce an OUTPUT CONTRACT at the
 * single composition point, independent of which layers fired:
 *   (1) an utterance opens with AT MOST ONE leading discourse filler
 *       before its first content word; stacked openers collapse to the
 *       first (the richest — usually the sector context-ref clause).
 *   (2) every sentence starts with a capital letter.
 * Pure + idempotent. Only invoked on the overlay-active path, so the
 * null-session snapshot path stays byte-identical. */

/* Curated discourse openers NOT already present in the persona/hedge/
 * context-ref banks (acks + generic markers a recruiter pads with). */
const TIDY_EXTRA_OPENERS: readonly string[] = [
  "sure", "yeah", "right", "okay", "ok", "alright", "noted",
  "got it", "fine", "look", "frankly", "honestly", "basically",
  "fundamentally", "i mean", "to be fair", "you know",
  "actually", "well", "so", "now", "then",
];

let _tidyOpeners: string[] | null = null;
/* Union of every phrase any overlay layer can prepend, lowercased and
 * sorted longest-first so multi-word openers ("at the end of the day")
 * match before their single-word substrings. Built lazily because
 * ALL_CONTEXT_REF_PHRASES is declared later in the module. */
function tidyOpenerPhrases(): string[] {
  if (_tidyOpeners) return _tidyOpeners;
  const all = [
    ...Object.values(PERSONA_TICS).flat(),
    ...Object.values(SECTOR_FORMAL_TIC_WHITELIST).flat(),
    ...HEDGES,
    ...ALL_CONTEXT_REF_PHRASES,
    ...TIDY_EXTRA_OPENERS,
  ]
    .map((p) => p.toLowerCase().trim())
    .filter((p) => p.length > 0);
  _tidyOpeners = Array.from(new Set(all)).sort((a, b) => b.length - a.length);
  return _tidyOpeners;
}

/* If `s` begins with a discourse opener delimited by a comma or period,
 * return the opener (original casing) + the remainder after the
 * delimiter. The trailing-punct requirement gives a token boundary, so
 * "rightfully," / "lookout." never match as "right" / "look". */
function matchLeadingOpener(
  s: string,
  openers: readonly string[],
): { opener: string; rest: string; delim: "," | "." } | null {
  const lower = s.toLowerCase();
  for (const op of openers) {
    if (!lower.startsWith(op)) continue;
    const after = s.slice(op.length);
    const m = after.match(/^\s*([,.])\s+/);
    if (m) {
      return {
        opener: s.slice(0, op.length),
        rest: after.slice(m[0].length),
        delim: m[1] as "," | ".",
      };
    }
  }
  return null;
}

/* Collapse a run of ≥2 stacked leading openers to the first one.
 *
 * Preserve the delimiter that immediately preceded the CONTENT (the last
 * collapsed opener's delimiter). A period there marks a sentence boundary
 * — "Right, got it. What fitment…" must collapse to "Right. What fitment…"
 * (a clean sentence), NOT "Right, What fitment…", which glues a capital
 * content word onto a comma and reads as a declarative+question fragment
 * (the validator's `declarative-plus-question-mark` reject; surfaced once
 * tidy began running on default-persona sessions). When the content was
 * comma-joined, keep the comma. */
function collapseStackedOpeners(s: string, openers: readonly string[]): string {
  const found: string[] = [];
  let lastDelim: "," | "." = ",";
  let cur = s;
  for (let i = 0; i < 6; i++) {
    const m = matchLeadingOpener(cur, openers);
    if (!m) break;
    found.push(m.opener);
    lastDelim = m.delim;
    cur = m.rest;
  }
  if (found.length <= 1) return s;
  return `${found[0]}${lastDelim} ${cur}`;
}

/* Capitalize the first letter of the utterance and the first letter
 * after every sentence-final period / bang / question mark. */
function fixSentenceCaps(s: string): string {
  let out = s.replace(
    /([.!?])(\s+)([a-z])/g,
    (_m, p: string, ws: string, c: string) => p + ws + c.toUpperCase(),
  );
  out = out.replace(
    /^(\s*["'(]*)([a-z])/,
    (_m, pre: string, c: string) => pre + c.toUpperCase(),
  );
  return out;
}

/* Discourse markers / conjunctions that are NEVER proper nouns in this
 * domain. When an overlay prepends an opener ("Right, ") in front of base
 * prose that itself began with one of these ("So for this grade…"), the
 * base word keeps its sentence-initial capital and we get "Right, So for
 * this grade". Lowercasing the second word repairs the seam. Restricted
 * to this whitelist so we never lowercase a real proper noun / vocative
 * ("Look, Sandeep" / "Right, Bangalore"). */
const TIDY_MIDSENTENCE_DOWNCASE =
  /(,\s+)(So|And|But|Okay|Right|Honestly|Basically|Well|Actually|Look|Then|Now|Fundamentally|Frankly)\b/g;

export function tidyRealismArtifacts(s: string): string {
  if (!s) return s;
  let out = collapseStackedOpeners(s, tidyOpenerPhrases());
  out = out.replace(/,\s*,/g, ",").replace(/[ \t]{2,}/g, " ");
  out = fixSentenceCaps(out);
  out = out.replace(
    TIDY_MIDSENTENCE_DOWNCASE,
    (_m, sep: string, w: string) => sep + w.charAt(0).toLowerCase() + w.slice(1),
  );
  return out;
}

/**
 * Decorate curated prose with persona-tic prefix + mid-sentence hedge +
 * checkback suffix. Probabilistic per (session, turn). Pure.
 *
 * Pass null sessionId → every dice roll misses → byte-for-byte input
 * is returned. Used by snapshot tests and by code paths that don't want
 * humanization.
 */
export function humanizeRecruiterProse(
  prose: string,
  ctx: HumanizeContext,
): string {
  if (!prose) return prose;
  let out = prose;

  /* Register-conditioned layer probabilities. The candidate's inferred
   * register (formal / casual / direct / neutral) modulates how much
   * the recruiter pads. Direct candidates ("just tell me the number")
   * get tighter prose; formal candidates trigger filtered tic selection
   * (no "Yeah so" register-mismatches). */
  const register = ctx.candidateRegister ?? "neutral";
  const ticRate = register === "direct" ? 0.08 : 0.22;
  const hedgeRate = register === "direct" ? 0.08 : 0.18;
  const checkbackRate = register === "direct" ? 0.10 : 0.22;

  /* Layer 1 — persona-tic prefix. Rate depends on candidate register.
   * For formal candidates, filter the tic pool to drop casual openers
   * ("Yeah so", "Yeah") so the recruiter doesn't sound mismatched. */
  if ((ctx.sector || ctx.__forceLayer?.tic) && (ctx.__forceLayer?.tic || diceHit(ctx, "tic-fire", ticRate))) {
    let tics: readonly string[] = PERSONA_TICS[ctx.sector ?? "default"] ?? PERSONA_TICS.default;
    /* 2026-05-29 sector×register coherence — for formal-locked sectors
     * (BFSI, PSU, consulting-big4, consulting-mbb) in FORMAL register,
     * replace the pool entirely with a policy/process-flavored whitelist.
     * This bypasses the general casual-remover below and guarantees the
     * recruiter never opens with "Look" / "Frankly" / "Honestly". */
    const sectorWhitelist = ctx.sector
      ? SECTOR_FORMAL_TIC_WHITELIST[ctx.sector]
      : undefined;
    if (register === "formal" && sectorWhitelist && sectorWhitelist.length > 0) {
      tics = sectorWhitelist;
    } else if (register === "formal") {
      const filtered = tics.filter((t) => !/^yeah\b/i.test(t));
      if (filtered.length > 0) tics = filtered;
    }
    const tic = tics[Math.floor(rand01(ctx, "tic-pick") * tics.length)];
    out = `${tic}, ${lowercaseFirst(out, ctx.candidateFirstName)}`;
  }

  /* Layer 2 — mid-sentence hedge. Rate depends on candidate register. */
  const firstComma = out.indexOf(",");
  if (firstComma > 8 && (ctx.__forceLayer?.hedge || diceHit(ctx, "hedge-fire", hedgeRate))) {
    const hedge = HEDGES[Math.floor(rand01(ctx, "hedge-pick") * HEDGES.length)];
    out = out.slice(0, firstComma) + `, ${hedge},` + out.slice(firstComma + 1);
  }

  /* Layer 3 — checkback suffix. Rate depends on candidate register;
   * still gated on prose ≥40 words. */
  const wordCount = out.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 40 && (ctx.__forceLayer?.checkback || diceHit(ctx, "checkback-fire", checkbackRate))) {
    const cb = CHECKBACKS[Math.floor(rand01(ctx, "checkback-pick") * CHECKBACKS.length)];
    /* Strip a trailing terminator + whitespace, then append. Keeps
     * us from producing "...end of prose. Does that make sense?" with
     * a double period. */
    out = out.replace(/[.!?\s]+$/, "");
    out = `${out}. ${cb}`;
  }

  /* Layer 4 — mood. Same brain, different voice. Mood is seeded once
   * at session start (kernel `initState`) from a hash of sessionId so
   * it's deterministic per session and varies across sessions. The
   * layer affects tone only — it never changes numbers, levers, or
   * the topical anchor.
   *
   *   warm    — current behaviour; slight extra "Sure," / "Yeah,"
   *             warmth prefix ~10% of turns (only when no tic already
   *             fired, to avoid stacking "Look, Sure, ...").
   *   brusque — drops greetings/softeners, trims trailing pleasantries.
   *   frantic — extra pause tic + occasional self-interruption +
   *             short-clause joiner. Subtle, not parodic. */
  /* 2026-05-29 mood-shift-pass — apply dynamic mood overlay BEFORE the
   * baseline mood branches. `cooled` masquerades as brusque-like;
   * `rewarmed` as warm-like. `baseline` (default) is a no-op so
   * back-compat is byte-identical. */
  const moodDynamic: RecruiterMoodDynamic = ctx.moodDynamic ?? "baseline";
  const baselineMood: RecruiterMood = ctx.mood ?? "warm";
  const mood: RecruiterMood =
    moodDynamic === "cooled" ? "brusque"
    : moodDynamic === "rewarmed" ? "warm"
    : baselineMood;
  /* Mood-layer activation gate. The mood layer is sector-anchored so
   * snapshot paths and byte-identical contract tests (which pass no
   * sector and rely on null-sessionId or undefined-sector to skip all
   * realism) continue to pass through unchanged. `__forceLayer.mood`
   * bypasses this for unit tests. */
  const moodActive = !!(ctx.sector || ctx.__forceLayer?.mood);
  if (moodActive && mood === "warm") {
    const alreadyHasTicPrefix = /^(?:Sure|Yeah|Right|Look|Honestly|Fundamentally|At the end of the day|Yeah so|Basically|From a stakeholder perspective|As per process|As per policy|Policy-wise|Process-wise|Frankly),/.test(out);
    /* For formal candidates, drop the casual "Yeah," prefix so the
     * recruiter doesn't sound mismatched (mirrors the tic layer's
     * register-conditioned filter at Layer 1). */
    let warmPrefixes = WARM_PREFIXES;
    if (register === "formal") {
      const filtered = warmPrefixes.filter((p) => !/^yeah\b/i.test(p));
      if (filtered.length > 0) warmPrefixes = filtered;
    }
    if (
      !alreadyHasTicPrefix &&
      (ctx.__forceLayer?.mood || diceHit(ctx, "mood-warm-fire", 0.1))
    ) {
      const pick = warmPrefixes[Math.floor(rand01(ctx, "mood-warm-pick") * warmPrefixes.length)];
      out = `${pick} ${lowercaseFirst(out, ctx.candidateFirstName)}`;
    }
  } else if (moodActive && mood === "brusque") {
    /* Strip leading greeting if it's a known tic prefix the prior
     * layer added (or the canonical body opened with one). Real
     * brusque recruiters cut to the chase. Conservative — only the
     * casual openers; "Fundamentally," stays because it carries
     * argumentative weight, not pleasantry. */
    out = out.replace(/^(?:Sure|Yeah|Yeah so|Right|Honestly|Look),\s*/i, (m) => {
      return ctx.__forceLayer?.mood || diceHit(ctx, "mood-brusque-greet", 1)
        ? ""
        : m;
    });
    /* Capitalize the now-leading letter if we stripped a prefix. */
    if (out.length > 0 && /^[a-z]/.test(out)) {
      out = out.charAt(0).toUpperCase() + out.slice(1);
    }
    /* Cut softeners. ~15% of softener-occurrences get cut on average
     * (per-occurrence dice). */
    if (ctx.__forceLayer?.mood || ctx.sessionId) {
      out = out.replace(BRUSQUE_SOFTENERS, (match, _g, offset: number) => {
        const fired = ctx.__forceLayer?.mood
          ? true
          : diceHit(ctx, `mood-brusque-soft-${offset}`, 0.5);
        return fired ? "" : match;
      });
    }
    /* Trim trailing pleasantries — only when present. */
    out = out.replace(BRUSQUE_PLEASANTRIES, "$1");
    /* Collapse any double-spaces left by softener stripping. */
    out = out.replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1");
  } else if (moodActive && mood === "frantic") {
    /* Leading pause tic — "Uh," / "Umm," — fires ~22%. Only when no
     * other tic prefix is already present to avoid "Look, uh, ...". */
    const alreadyHasTicPrefix = /^(?:Sure|Yeah|Right|Look|Honestly|Fundamentally|At the end of the day|Yeah so|Basically|From a stakeholder perspective|As per process|As per policy|Policy-wise|Process-wise|Frankly|Uh|Umm),/i.test(out);
    if (
      !alreadyHasTicPrefix &&
      (ctx.__forceLayer?.mood || diceHit(ctx, "mood-frantic-tic-fire", 0.22))
    ) {
      const pick = FRANTIC_TICS[Math.floor(rand01(ctx, "mood-frantic-tic-pick") * FRANTIC_TICS.length)];
      out = `${pick} ${lowercaseFirst(out, ctx.candidateFirstName)}`;
    }
    /* Self-interruption — fires ~15% on prose with at least two
     * sentences. Inserts after the first sentence boundary. Subtle,
     * not parodic. */
    const firstSentenceBoundary = out.search(/[.!?]\s+[A-Z]/);
    if (
      firstSentenceBoundary > 12 &&
      (ctx.__forceLayer?.mood || diceHit(ctx, "mood-frantic-interrupt-fire", 0.15))
    ) {
      const pick =
        FRANTIC_INTERRUPTIONS[
          Math.floor(rand01(ctx, "mood-frantic-interrupt-pick") * FRANTIC_INTERRUPTIONS.length)
        ];
      const head = out.slice(0, firstSentenceBoundary + 1);
      const tail = out.slice(firstSentenceBoundary + 2);
      /* Adversarial-sweep fix (2026-06-19) — the interruption is inserted
       * AFTER a sentence-final boundary (firstSentenceBoundary matches
       * [.!?]\s+[A-Z]), so it opens a new sentence and must be capitalized.
       * Shipping it lowercase ("…for that city. wait, sorry —…") trips the
       * lowercase-after-period fluency check. */
      const pickCapped = pick.charAt(0).toUpperCase() + pick.slice(1);
      out = `${head} ${pickCapped} ${lowercaseFirst(tail, ctx.candidateFirstName)}`;
    }
    /* Short-clause joiner — replaces one ". " with " and " ~12% so the
     * cadence sounds rushed. Only the first match, never the last
     * sentence (so the prose still ends cleanly). */
    if (ctx.__forceLayer?.mood || diceHit(ctx, "mood-frantic-join-fire", 0.12)) {
      const m = out.match(/^(.*?[a-z])\.\s+([A-Z].*[.!?])\s*([A-Z][^.!?]*[.!?])\s*$/);
      if (m) {
        out = `${m[1]} and ${lowercaseFirst(m[2], ctx.candidateFirstName)} ${m[3]}`;
      }
    }
  }

  /* 2026-05-29 mood-shift-pass — dynamic mood decorations.
   *
   * cooled  → append ONE cold line per session. The kernel stamps
   *           `coldLineAlreadyFired` once the line has been emitted;
   *           subsequent turns in cooled state stay tonally brusque
   *           but do not re-spam the cold line.
   * rewarmed → prefix a softening line ONCE per cool→rewarm shift.
   *            Kernel stamps `rewarmLineAlreadyFired` after the first
   *            emit. */
  if (ctx.sessionId && moodDynamic === "cooled" && !ctx.coldLineAlreadyFired) {
    const coldLine = pickColdLine(ctx.sessionId);
    /* Append after a clean terminator. */
    out = out.replace(/[.!?\s]+$/, "");
    out = `${out}. ${coldLine}`;
  } else if (ctx.sessionId && moodDynamic === "rewarmed" && !ctx.rewarmLineAlreadyFired) {
    out = `${REWARM_PREFIX} ${lowercaseFirst(out, ctx.candidateFirstName)}`;
  }

  return out;
}

/* 2026-05-29 sector×register coherence — in-source vitest tests for the
 * formal-sector tic whitelist. Co-located with the producer so the
 * contract travels with the code. Gated on `import.meta.vitest` so the
 * production bundle is untouched. */
/* ============================================================
 * 2026-05-29 conversational-realism pass - three composable overlays
 * layered on top of `humanizeRecruiterProse`. Each is pure, deterministic
 * via the existing `fnv1a`, and idempotent (safe to re-run on its own
 * output). They are NOT auto-wired into `humanizeRecruiterProse`; callers
 * can chain them as needed. The contract: they only decorate, never
 * change the topical anchor's truth value.
 * ============================================================ */

/* -- Feature 1 -- Recruiter fallibility */

const FALLIBILITY_COMPONENTS = [
  "the joining bonus",
  "the variable",
  "the relocation",
  "the retention sign-on",
] as const;

const RUPEE_FIGURE_RE = /\u20B9(\d+(?:\.\d+)?)L/;

export interface FallibilityContext {
  mood?: RecruiterMoodDynamic | RecruiterMood | null;
  turnIndex?: number;
  packageComplexity?: number;
  sessionId?: string | null;
}

const FALLIBILITY_SENTINEL_RE = /\b(wait|hold on|my bad|sorry)\b/i;

export function applyFallibilityOverlay(
  text: string,
  ctx: FallibilityContext,
): string {
  if (!text) return text;
  const m = text.match(RUPEE_FIGURE_RE);
  if (!m) return text;

  const mood = ctx.mood ?? "warm";
  const cooled = mood === "cooled";
  const lateTurn = (ctx.turnIndex ?? 0) > 8;
  const complex = (ctx.packageComplexity ?? 0) >= 3;
  if (!cooled && !lateTurn && !complex) return text;

  if (FALLIBILITY_SENTINEL_RE.test(text.slice(0, 60))) return text;

  const sessionId = ctx.sessionId ?? "";
  if (!sessionId) return text;
  const h = fnv1a(`fallibility|${sessionId}|${ctx.turnIndex ?? 0}`);
  if ((h / 0x100000000) >= 0.25) return text;

  const figure = m[0];
  const numeric = parseFloat(m[1]);
  const hComp = fnv1a(`fallibility-comp|${sessionId}|${ctx.turnIndex ?? 0}`);
  const hTpl = fnv1a(`fallibility-tpl|${sessionId}|${ctx.turnIndex ?? 0}`);
  const hDelta = fnv1a(`fallibility-delta|${sessionId}|${ctx.turnIndex ?? 0}`);

  const component = FALLIBILITY_COMPONENTS[hComp % FALLIBILITY_COMPONENTS.length];
  const delta = 1 + (hDelta % 3);
  const corrected = numeric + delta;
  const correctedStr = Number.isInteger(corrected)
    ? `${corrected}`
    : `${corrected.toFixed(1)}`;
  const correctedFigure = `\u20B9${correctedStr}L`;

  const netVal = Math.round(numeric * 8.5) / 10;
  const netStr = Number.isInteger(netVal) ? `${netVal}` : `${netVal.toFixed(1)}`;
  const netFigure = `\u20B9${netStr}L`;

  const templates = [
    `${figure} \u2014 wait, ${correctedFigure} with ${component}, my bad`,
    `hold on, ${figure} is gross, net's ${netFigure}`,
    `${figure} total \u2014 sorry, ${correctedFigure} including ${component}`,
  ];
  const replacement = templates[hTpl % templates.length];

  const idx = text.indexOf(figure);
  return text.slice(0, idx) + replacement + text.slice(idx + figure.length);
}

/* -- Feature 2 -- Per-session verbal tic signatures */

const PERSONA_TIC_BANKS: Record<RecruiterSectorPersona, readonly string[]> = {
  "bfsi":            ["As per policy", "Process-wise", "From a policy standpoint", "Fundamentally"],
  "psu":             ["As per cadre", "As per rules", "Process-wise", "As per policy", "Fundamentally"],
  "consulting-big4": ["Fundamentally", "Process-wise", "From a policy standpoint", "honestly", "to be fair", "end of the day"],
  "consulting-mbb":  ["Fundamentally", "From a policy standpoint", "Process-wise", "honestly", "to be fair"],
  "fmcg-management": ["Fundamentally", "end of the day", "honestly", "basically", "see"],
  "gcc":             ["honestly", "basically", "see", "to be fair", "Fundamentally"],
  "it-services":     ["ya so", "basically", "right, right", "see", "actually", "honestly"],
  "indian-unicorn":  ["honestly", "basically", "see", "actually", "to be fair", "right, right"],
  "early-startup":   ["ya so", "honestly", "ek minute", "see", "actually", "right, right", "basically"],
  "edtech":          ["honestly", "basically", "see", "actually", "to be fair"],
  "default":         ["honestly", "basically", "right, right", "see", "actually"],
};

const FORMAL_ONLY_TICS = new Set<string>([
  "As per policy",
  "Process-wise",
  "From a policy standpoint",
  "Fundamentally",
  "As per cadre",
  "As per rules",
]);

const CASUAL_TICS = new Set<string>([
  "right, right",
  "ya so",
  "ek minute",
  "basically",
  "honestly",
  "see",
  "actually",
  "to be fair",
  "end of the day",
]);

export function pickPersonaTicSignature(
  sessionId: string,
  persona: RecruiterSectorPersona,
): readonly string[] {
  const bank = PERSONA_TIC_BANKS[persona] ?? PERSONA_TIC_BANKS.default;
  const hCount = fnv1a(`persona-tic-count|${sessionId}|${persona}`);
  const count = 2 + (hCount % 2);
  const sessionHash = fnv1a(`persona-tic-session|${sessionId}|${persona}`);
  const indexed = bank.map((tic, i) => ({
    tic,
    /* Double-mix: combine the per-index FNV with the per-session FNV via
     * imul + xor so small key changes propagate broadly across the sort
     * key space. Single-FNV per-index showed weak avalanching across
     * neighbouring session strings, collapsing the variance. */
    sort: fnv1a(`persona-tic-pick|${sessionHash}|${i}|${sessionId.length}`) ^ Math.imul(sessionHash + i * 2654435761, 0x85ebca6b),
  }));
  indexed.sort((a, b) => a.sort - b.sort);
  return indexed.slice(0, Math.min(count, bank.length)).map((x) => x.tic);
}

const ALL_PERSONA_TICS: readonly string[] = Array.from(
  new Set(Object.values(PERSONA_TIC_BANKS).flat()),
);

const EXISTING_SECTOR_TIC_PREFIX_RE = /^(?:Sure|Yeah|Right|Look|Honestly|Fundamentally|At the end of the day|Yeah so|Basically|From a stakeholder perspective|As per process|As per policy|Policy-wise|Process-wise|Frankly|As per cadre|As per rules|From a policy standpoint),/i;

export function applyPersonaTicSignature(
  text: string,
  sessionId: string,
  persona: RecruiterSectorPersona,
): string {
  if (!text || !sessionId) return text;
  if (EXISTING_SECTOR_TIC_PREFIX_RE.test(text)) return text;
  const lower = text.toLowerCase();
  for (const tic of ALL_PERSONA_TICS) {
    if (lower.includes(tic.toLowerCase())) return text;
  }
  const h = fnv1a(`persona-tic-fire|${sessionId}|${text}`);
  if ((h / 0x100000000) >= 0.2) return text;
  const signature = pickPersonaTicSignature(sessionId, persona);
  const hPick = fnv1a(`persona-tic-inject|${sessionId}|${text}`);
  const tic = signature[hPick % signature.length];
  return `${tic}, ${lowercaseFirst(text)}`;
}

/* -- Feature 3 -- Sector real-world context refs */

const SECTOR_CONTEXT_REFS: Record<RecruiterSectorPersona, readonly string[]> = {
  "edtech": [
    "after the BYJU correction",
    "post-2024 edtech reset",
    "since the funding winter hit ed-tech hardest",
  ],
  "it-services": [
    "with the H1B uncertainty",
    "in this slower hiring cycle",
    "given the bench-strength concerns this quarter",
  ],
  "gcc": [
    "with the GCC consolidation push",
    "given the parent-comp re-benchmarking",
    "post the global comp review",
  ],
  "indian-unicorn": [
    "after the down-round corrections",
    "given how SoftBank tightened the screws",
    "in this profitability-first era",
  ],
  "early-startup": [
    "given runway pressure",
    "with the Series-B market this tight",
    "after the seed-to-A bottleneck",
  ],
  "bfsi": [
    "post the RBI circular",
    "with the latest compliance review",
    "given the recent RBI cap on incentives",
  ],
  "psu": [
    "given the latest CPC clarification",
    "with the cadre cap review pending",
    "post the recent OM revision",
  ],
  "consulting-big4": [
    "in this slower deal cycle",
    "given the audit-vs-advisory rebalancing",
    "with the recent partner promotion freeze",
  ],
  "consulting-mbb": [
    "given the post-pandemic engagement mix",
    "with the AI-disruption hiring rebalance",
    "in this leaner partner-track year",
  ],
  "fmcg-management": [
    "given the rural slowdown",
    "post the input-cost squeeze",
    "with the modern-trade consolidation",
  ],
  "default": [],
};

const ALL_CONTEXT_REF_PHRASES: readonly string[] = Object.values(
  SECTOR_CONTEXT_REFS,
).flat();

export function pickSectorContextRef(
  persona: RecruiterSectorPersona,
  sessionId: string,
): string | null {
  const bank = SECTOR_CONTEXT_REFS[persona] ?? [];
  if (bank.length === 0) return null;
  const hNull = fnv1a(`ctx-ref-null|${sessionId}|${persona}`);
  if ((hNull / 0x100000000) < 0.5) return null;
  const hPick = fnv1a(`ctx-ref-pick|${sessionId}|${persona}`);
  return bank[hPick % bank.length];
}

/* A market-context aside ("after the down-round corrections", "with the
 * GCC consolidation push") is something a recruiter drops ONCE, early, to
 * frame the band — not a verbal tic they repeat every turn. The phrase is
 * deterministic per (session, persona), so a per-line probabilistic gate
 * landed the IDENTICAL clause on 3-4 lines in a single conversation
 * ("After the down-round corrections, ..." × 4), which reads robotic.
 *
 * Fix is single-fire-per-session, structural not probabilistic: pick one
 * early turn deterministically from the session and prepend the aside only
 * on that turn. At most one context-ref clause per conversation. */
const CONTEXT_REF_WINDOW = 3; // turns 0..2 — the band-framing window
export function applyContextRefOverlay(
  text: string,
  persona: RecruiterSectorPersona,
  sessionId: string,
  turnIndex?: number,
): string {
  if (!text || !sessionId) return text;
  const textLower = text.toLowerCase();
  for (const phrase of ALL_CONTEXT_REF_PHRASES) {
    if (textLower.includes(phrase.toLowerCase())) return text;
  }
  const ref = pickSectorContextRef(persona, sessionId);
  if (!ref) return text;
  const ti =
    typeof turnIndex === "number" && Number.isFinite(turnIndex)
      ? Math.abs(Math.trunc(turnIndex))
      : 0;
  const chosenTurn =
    fnv1a(`ctx-ref-turn|${sessionId}|${persona}`) % CONTEXT_REF_WINDOW;
  if (ti !== chosenTurn) return text;
  return `${ref.charAt(0).toUpperCase()}${ref.slice(1)}, ${lowercaseFirst(text)}`;
}

/* Affinity-dynamic feature (2026-05-29) — warmth/cool overlay.
 *
 * When recruiter affinity is high (≥ +2), prepend a warm token deterministically
 * ~30% of the time. When affinity is low (≤ -2), prepend a cool token ~30%.
 * In the [-1, +1] band the overlay is a no-op (byte-identical input/output).
 *
 * Idempotent: if the text already starts with one of the registered tokens
 * the overlay returns the text unchanged.
 *
 * Pure / deterministic — keyed on (sessionId, affinity-bucket, text-hash). */
const AFFINITY_WARM_TOKENS: readonly string[] = [
  "You've been very straightforward, so — ",
  "I appreciate the candor — ",
  "Ok look, between us — ",
];
const AFFINITY_COOL_TOKENS: readonly string[] = [
  "Look, let me be direct — ",
  "I'll keep this short — ",
  "Let's stick to facts — ",
];

export function affinityWarmthOverlay(
  text: string,
  affinity: number,
  sessionId: string | null | undefined,
): string {
  if (!text || !sessionId) return text;
  if (typeof affinity !== "number" || !Number.isFinite(affinity)) return text;
  if (affinity > -2 && affinity < 2) return text;

  /* Idempotency guard — if any registered token is already a prefix,
   * skip. */
  for (const tk of AFFINITY_WARM_TOKENS) {
    if (text.startsWith(tk)) return text;
  }
  for (const tk of AFFINITY_COOL_TOKENS) {
    if (text.startsWith(tk)) return text;
  }

  const bucket = affinity >= 2 ? "warm" : "cool";
  const fireSeed = `affinity-overlay-fire|${sessionId}|${bucket}|${text}`;
  const fireU = fnv1a(fireSeed) / 0x100000000;
  if (fireU >= 0.30) return text;

  const pool = bucket === "warm" ? AFFINITY_WARM_TOKENS : AFFINITY_COOL_TOKENS;
  const pickSeed = `affinity-overlay-pick|${sessionId}|${bucket}|${text}`;
  const idx = fnv1a(pickSeed) % pool.length;
  return `${pool[idx]}${text}`;
}

/* ───────────────────────────────────────────────────────────────────
 * Power-posture overlay (2026-05-30).
 *
 * The kernel already computes a scalar `recruiterPower ∈ [-3,+3]` from
 * `powerSignals` (open-req age, pipeline depth, quarter timing,
 * candidate's competing process). Until now that scalar only nudged
 * concession headroom — the recruiter SOUNDED identical whether they
 * were hungry (req 6 months stale, no other pipeline) or leveraged
 * (deep pipeline, fresh quarter).
 *
 * Real recruiters posture VISIBLY when leverage shifts: a hungry
 * recruiter leans in ("we have flexibility", "leadership is keen", "we
 * really want to close this"); a leveraged one composes themselves
 * ("I'll be candid", "I'll save us both time", "we're seeing a lot of
 * interest at this level"). The posture is sector-specific in register
 * — BFSI hungry ≠ unicorn hungry — so the bank is keyed on
 * (persona × strength).
 *
 * Gate semantics:
 *   • Fires only when |recruiterPower| ≥ 2 (a "strong" posture). At
 *     |power| ≤ 1 the recruiter is in equilibrium — neutral voice is
 *     the right default and we'd rather under-fire than over-color.
 *   • FNV-1a deterministic ~20% fire rate keyed on (sessionId, text)
 *     so repeated turns don't all wear the same posture prefix.
 *   • Idempotent: if any registered posture phrase already sits at the
 *     head of `text`, the overlay is a byte-identical no-op.
 *   • Default sector → empty bank → no-op (snapshot baseline safe). */

interface PostureBank {
  readonly hungry: readonly string[];
  readonly leveraged: readonly string[];
}

const POWER_POSTURE_BANK: Record<RecruiterSectorPersona, PostureBank> = {
  "it-services": {
    hungry: [
      "Look, we'd really like to close this without too much back-and-forth",
      "Honestly, we have some flexibility on the structure side",
      "Between you and me, the requisition has been open a while",
    ],
    leveraged: [
      "As per process, I'd suggest we stay close to the band",
      "I'll be straight — we have a healthy pipeline at this level",
      "Process-wise, the cadre cap doesn't leave much room",
    ],
  },
  "gcc": {
    hungry: [
      "Honestly, we've been struggling to fill this seat",
      "Look, leadership is keen to close this before the next review",
      "I'll be candid — we have flexibility on joining and relocation",
    ],
    leveraged: [
      "From a stakeholder perspective, we're seeing solid interest at this level",
      "Fundamentally, the parent-comp benchmark caps us here",
      "I'll be candid — we're not in a rush on this requisition",
    ],
  },
  "indian-unicorn": {
    hungry: [
      "Look, we really want to close this fast",
      "Honestly, the band on this role has been hard to fill",
      "Between us, leadership has signed off on stretching for the right profile",
    ],
    leveraged: [
      "Look, we have a few strong candidates in late stages",
      "Honestly, the profitability-first mandate keeps us tight on comp",
      "I'll keep it real — we're not desperate on this one",
    ],
  },
  "early-startup": {
    hungry: [
      "Look, we need someone in seat yesterday",
      "Honestly, the runway conversation makes us flexible on equity",
      "Between us, the founder is personally chasing this hire",
    ],
    leveraged: [
      "Look, we're early — cash is tight and the equity has to do the work",
      "I'll be straight — we have a few founders' network referrals in flight",
      "Honestly, at our stage we can't bid against late-stage comp",
    ],
  },
  "bfsi": {
    hungry: [
      "As per policy I have some headroom, and honestly we'd like to close this cycle",
      "Look, the role has been open through two compliance reviews now",
      "Policy-wise we have flexibility on joining bonus given the duration",
    ],
    leveraged: [
      "As per policy the cap on this band is firm",
      "Policy-wise we're seeing strong applicant flow at this level",
      "I'll be direct — the RBI guideline doesn't leave room here",
    ],
  },
  "psu": {
    hungry: [
      "As per cadre we have some scope to expedite, given the seat has been vacant",
      "As per rules I can push for the upper end of the scale here",
      "Frankly, the OM permits a relaxation for the right candidate",
    ],
    leveraged: [
      "As per rules, the cadre cap is non-negotiable",
      "As per cadre the pay-band is fixed by the latest CPC",
      "Process-wise the panel has multiple shortlisted candidates",
    ],
  },
  "consulting-big4": {
    hungry: [
      "Fundamentally, we have headroom this cycle that we don't always have",
      "Look, the partner sponsor is keen and that helps with the band",
      "Honestly, we'd rather close than restart the search",
    ],
    leveraged: [
      "Fundamentally, the band is set against the global cadre framework",
      "I'll be direct — we have other candidates in final-round panels",
      "From a stakeholder perspective the partner promotion freeze caps us",
    ],
  },
  "consulting-mbb": {
    hungry: [
      "Honestly, we've signed off on stretching for the right profile here",
      "Look, the practice is short-staffed against the engagement pipeline",
      "Between us, the partner sponsor is personally backing this hire",
    ],
    leveraged: [
      "Fundamentally, the global comp framework anchors us here",
      "Honestly, we have a few late-stage candidates we're considering",
      "I'll be direct — the leaner partner-track year keeps the band tight",
    ],
  },
  "fmcg-management": {
    hungry: [
      "Honestly, the role has been open across two appraisal cycles",
      "Look, the modern-trade vertical can't wait for another round",
      "Between us, we have stretched the band for this role specifically",
    ],
    leveraged: [
      "Honestly, the grade-band sets a hard cap on what I can offer",
      "I'll be direct — we have strong internal IJP candidates as well",
      "Look, the input-cost squeeze keeps every grade tight this year",
    ],
  },
  "edtech": {
    hungry: [
      "Look, we've struggled to find the right profile post the reset",
      "Honestly, the founder is personally invested in closing this one",
      "Between us, we have flexibility on joining timeline and equity refresh",
    ],
    leveraged: [
      "Honestly, the post-correction band leaves us tight on cash comp",
      "Look, we're seeing solid candidate flow now that hiring re-opened",
      "I'll be direct — the runway math caps the offer here",
    ],
  },
  "default": { hungry: [], leveraged: [] },
};

const ALL_POSTURE_PHRASES: readonly string[] = (() => {
  const out: string[] = [];
  for (const bank of Object.values(POWER_POSTURE_BANK)) {
    out.push(...bank.hungry, ...bank.leveraged);
  }
  return out;
})();

const POWER_POSTURE_FIRE_RATE = 0.20;
const POWER_POSTURE_THRESHOLD = 2;

/** Fire-gate the posture overlay.
 *
 *   text   — recruiter prose to potentially prefix
 *   persona — sector key into POWER_POSTURE_BANK
 *   sessionId — FNV seed; empty string → no-op (snapshot baseline)
 *   recruiterPower — kernel scalar; |power| < 2 → no-op
 *
 * Returns input unchanged when any gate misses. When firing, prefixes
 * one posture phrase + ", " + lowercased original. Idempotent. */
export function applyPowerPostureOverlay(
  text: string,
  persona: RecruiterSectorPersona,
  sessionId: string | null | undefined,
  recruiterPower: number | null | undefined,
): string {
  if (!text || !sessionId) return text;
  if (typeof recruiterPower !== "number" || !Number.isFinite(recruiterPower)) return text;
  if (Math.abs(recruiterPower) < POWER_POSTURE_THRESHOLD) return text;
  const bank = POWER_POSTURE_BANK[persona];
  if (!bank) return text;
  const pool = recruiterPower <= -POWER_POSTURE_THRESHOLD ? bank.hungry : bank.leveraged;
  if (pool.length === 0) return text;

  /* Idempotency — already prefixed by some posture phrase from any
   * sector (defensive against persona swap mid-session). */
  for (const phrase of ALL_POSTURE_PHRASES) {
    if (text.startsWith(phrase)) return text;
  }

  const fireU = fnv1a(`power-posture-fire|${sessionId}|${persona}|${text}`) / 0x100000000;
  if (fireU >= POWER_POSTURE_FIRE_RATE) return text;

  const idx = fnv1a(`power-posture-pick|${sessionId}|${persona}|${text}`) % pool.length;
  return `${pool[idx]}, ${lowercaseFirst(text)}`;
}

/* Test-only access to internal sets for verifying tic register bias. */
export const __TEST_ONLY__ = {
  FORMAL_ONLY_TICS,
  CASUAL_TICS,
  PERSONA_TIC_BANKS,
  SECTOR_CONTEXT_REFS,
  POWER_POSTURE_BANK,
};

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  /* Long base prose so Layer 1 always has room to apply, and the test
   * isn't sensitive to checkback-gate word-count threshold. */
  const BASE = "We can structure the comp around a base and variable split, and the joining bonus offsets the notice-period gap on your end if that helps frame the picture.";

  const ticFireCtx = (overrides: Partial<HumanizeContext> = {}): HumanizeContext => ({
    sessionId: "s-formal-bfsi",
    turnIndex: 0,
    candidateRegister: "formal",
    __forceLayer: { tic: true },
    ...overrides,
  });

  describe("sector×register coherence — formal-sector tic whitelist", () => {
    it("BFSI formal session never opens with 'Look' or 'Frankly' across 50 simulated turns", () => {
      const seen = new Set<string>();
      for (let t = 0; t < 50; t++) {
        const out = humanizeRecruiterProse(BASE, ticFireCtx({
          sector: "bfsi",
          sessionId: `s-bfsi-formal-${t}`,
          turnIndex: t,
        }));
        const opener = out.split(",")[0];
        seen.add(opener);
        expect(opener).not.toBe("Look");
        expect(opener).not.toBe("Frankly");
        expect(opener).not.toBe("Honestly");
      }
      // Every opener must be from the BFSI formal whitelist.
      for (const opener of seen) {
        expect(["As per policy", "Process-wise"]).toContain(opener);
      }
    });

    it("PSU formal session uses 'As per cadre' or 'As per rules' at expected rate", () => {
      const whitelist = ["As per cadre", "Process-wise", "As per rules"];
      const counts: Record<string, number> = {};
      for (let t = 0; t < 300; t++) {
        const out = humanizeRecruiterProse(BASE, ticFireCtx({
          sector: "psu",
          sessionId: `s-psu-formal-${t}`,
          turnIndex: t,
        }));
        const opener = out.split(",")[0];
        expect(whitelist).toContain(opener);
        counts[opener] = (counts[opener] ?? 0) + 1;
      }
      // Each of the 3 whitelist openers should appear roughly 1/3 of the
      // time. Loose bound (≥10%) so FNV-1a variance doesn't flake CI.
      expect((counts["As per cadre"] ?? 0)).toBeGreaterThanOrEqual(30);
      expect((counts["As per rules"] ?? 0)).toBeGreaterThanOrEqual(30);
    });

    it("non-formal sectors (unicorn, startup) still get the casual tic pool unchanged", () => {
      const unicornPool = ["Look", "Honestly", "Right"];
      const startupPool = ["Look", "Honestly", "Yeah"];
      const unicornSeen = new Set<string>();
      const startupSeen = new Set<string>();
      for (let t = 0; t < 200; t++) {
        const uOut = humanizeRecruiterProse(BASE, ticFireCtx({
          sector: "indian-unicorn",
          candidateRegister: "casual",
          sessionId: `s-unicorn-${t}`,
          turnIndex: t,
        }));
        const sOut = humanizeRecruiterProse(BASE, ticFireCtx({
          sector: "early-startup",
          candidateRegister: "casual",
          sessionId: `s-startup-${t}`,
          turnIndex: t,
        }));
        unicornSeen.add(uOut.split(",")[0]);
        startupSeen.add(sOut.split(",")[0]);
      }
      for (const o of unicornSeen) expect(unicornPool).toContain(o);
      for (const o of startupSeen) expect(startupPool).toContain(o);
    });
  });
}

declare global {
  interface ImportMeta {
    vitest?: typeof import("vitest");
  }
}
