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

export interface HumanizeContext {
  sector?: RecruiterSectorPersona | null;
  phase?: NegotiationPhase | null;
  sessionId?: string | null;
  turnIndex?: number;
}

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
  "bfsi":            ["Look", "Process-wise", "Right so"],
  "gcc":             ["From a stakeholder perspective", "Honestly", "Right"],
  "it-services":     ["Yeah so", "Basically", "Right"],
  "indian-unicorn":  ["Look", "Honestly", "Right"],
  "early-startup":   ["Look", "Honestly", "Yeah"],
  "default":         ["Look", "Right", "Honestly"],
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

/* Lowercase the first letter of `s` iff its first letter is currently
 * uppercase AND the second char is a lowercase letter (avoids breaking
 * acronyms like "ESOP", "CTC"). */
function lowercaseFirst(s: string): string {
  if (s.length < 2) return s;
  const c0 = s.charAt(0);
  const c1 = s.charAt(1);
  if (c0 >= "A" && c0 <= "Z" && c1 >= "a" && c1 <= "z") {
    return c0.toLowerCase() + s.slice(1);
  }
  return s;
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

  /* Layer 1 — persona-tic prefix. ~22% hit rate when sector is set. */
  if (ctx.sector && diceHit(ctx, "tic-fire", 0.22)) {
    const tics = PERSONA_TICS[ctx.sector] ?? PERSONA_TICS.default;
    const tic = tics[Math.floor(rand01(ctx, "tic-pick") * tics.length)];
    out = `${tic}, ${lowercaseFirst(out)}`;
  }

  /* Layer 2 — mid-sentence hedge. ~18% hit rate. Requires a comma in
   * the prose (so the hedge has a natural insertion site); skips if
   * the only comma is in the first 3 words (we'd hedge before content). */
  const firstComma = out.indexOf(",");
  if (firstComma > 8 && diceHit(ctx, "hedge-fire", 0.18)) {
    const hedge = HEDGES[Math.floor(rand01(ctx, "hedge-pick") * HEDGES.length)];
    out = out.slice(0, firstComma) + `, ${hedge},` + out.slice(firstComma + 1);
  }

  /* Layer 3 — checkback suffix. ~22% hit rate, only on prose ≥40 words. */
  const wordCount = out.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 40 && diceHit(ctx, "checkback-fire", 0.22)) {
    const cb = CHECKBACKS[Math.floor(rand01(ctx, "checkback-pick") * CHECKBACKS.length)];
    /* Strip a trailing terminator + whitespace, then append. Keeps
     * us from producing "...end of prose. Does that make sense?" with
     * a double period. */
    out = out.replace(/[.!?\s]+$/, "");
    out = `${out}. ${cb}`;
  }

  return out;
}
