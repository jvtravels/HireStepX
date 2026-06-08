/* V2-TOOLS (2026-06-09) — the six tools the orchestrator may call.
 *
 * Each tool is a pure function: given the LLM-provided args, the
 * computed band, and the derived state, return either:
 *   { ok: true, canonical: string, lpa?: number }   — kernel-rendered
 *   { ok: false, reason: string }                   — kernel rejected
 *
 * The LLM provides arguments. The kernel validates and renders the
 * final prose. The LLM never writes the user-facing string. This is
 * the inversion that fixes v1's "LLM-author + 32-check restyle
 * validator" failure mode — there is nothing to validate because
 * the LLM never produces prose. */

import type { NegotiationBand } from "../_negotiation-kernel";
import type { DerivedState, ToolName } from "./kernel";

export type ToolCall =
  | { name: "propose_anchor"; args: { number_lpa: number; rationale: string } }
  | { name: "propose_counter"; args: { number_lpa: number; rationale: string } }
  | {
      name: "concede";
      args: {
        lever: "joining_bonus" | "esops" | "variable_to_base" | "role_uplift";
        amount_lpa: number;
      };
    }
  | {
      name: "close_recap";
      args: { final_lpa: number; components: { label: string; lpa: number }[] };
    }
  | { name: "decline_offer_ask"; args: { reason: string } }
  | { name: "defer_with_callback"; args: { topic: string; when: string } }
  | { name: "ask_discovery"; args: { topic: string; question: string } };

export type ToolResult =
  | { ok: true; canonical: string; lpa?: number; tool: ToolName }
  | { ok: false; reason: string };

/** Concrete-time markers that defer_with_callback REQUIRES. Without
 *  one of these phrases, the defer is rejected — the v1 "let me
 *  come back to you" failure mode where defers had no actual
 *  callback time becomes structurally impossible. */
const TIME_MARKERS = [
  /\btoday\b/i,
  /\btomorrow\b/i,
  /\bby\s+eod\b/i,
  /\bby\s+end\s+of\s+(day|week)\b/i,
  /\bwithin\s+\d+\s+(hours?|days?)\b/i,
  /\bby\s+\w+day\b/i,
  /\bby\s+\d{1,2}[\/\-]\d{1,2}\b/i,
];

function hasConcreteTime(s: string): boolean {
  return TIME_MARKERS.some((re) => re.test(s));
}

function fmtLpa(n: number): string {
  return Number.isInteger(n) ? `₹${n} LPA` : `₹${n.toFixed(1)} LPA`;
}

/* ── Number grounding ──────────────────────────────────────────────
 *
 * The T7 bug in PD #2 ("88% variable is significant" — candidate's
 * actual variable share is ~6%) is not a regex-able edge case; it's a
 * structural failure where the LLM smuggled a fabricated claim about
 * the candidate into freeform rationale prose.
 *
 * Rule: any number with an LPA/L/lakh suffix or a % suffix that
 * appears in a rationale string must be GROUNDED — derivable from
 * one of:
 *   - the candidate's own mentioned numbers (state.mentionedNumbers)
 *   - the band (walkAway, initialOffer, maxStretch)
 *   - the anchor/target scalars (lastAnchorLpa, candidateTarget,
 *     plus the number_lpa the tool itself is rendering)
 *   - any percentage derivable as 100·a/b where a, b ∈ mentionedNumbers
 *
 * Bare integers (no suffix) are deliberately not validated — phrases
 * like "3-year vesting" or "5 YoE" are not money claims. We only
 * police numbers that look like monetary or share claims. */

interface GroundingContext {
  mentionedNumbers: number[];
  bandScalars: number[];
  anchorScalars: number[];
}

function extractRationaleNumbers(rationale: string): {
  lpas: number[];
  percents: number[];
} {
  const lpas: number[] = [];
  const percents: number[] = [];
  const lpaRe = /\b(\d+(?:\.\d+)?)\s*(?:l|lpa|lakhs?)\b/gi;
  const pctRe = /\b(\d+(?:\.\d+)?)\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = lpaRe.exec(rationale)) !== null) lpas.push(Number(m[1]));
  while ((m = pctRe.exec(rationale)) !== null) percents.push(Number(m[1]));
  return { lpas, percents };
}

function isGroundedLpa(n: number, ctx: GroundingContext): boolean {
  const all = [...ctx.mentionedNumbers, ...ctx.bandScalars, ...ctx.anchorScalars];
  return all.some((x) => Math.abs(x - n) <= 0.5);
}

function isGroundedPercent(p: number, ctx: GroundingContext): boolean {
  /* Any pairwise ratio of mentioned LPA scalars, tolerance ±2pp. */
  const mn = ctx.mentionedNumbers;
  for (let i = 0; i < mn.length; i++) {
    for (let j = 0; j < mn.length; j++) {
      if (i === j || mn[j] === 0) continue;
      const ratio = (mn[i] / mn[j]) * 100;
      if (Math.abs(ratio - p) <= 2) return true;
    }
  }
  /* Also accept the trivial 100%, common in close recap phrasing. */
  return Math.abs(p - 100) <= 2;
}

function validateGrounding(
  rationale: string,
  ctx: GroundingContext,
): string | null {
  const { lpas, percents } = extractRationaleNumbers(rationale);
  for (const n of lpas) {
    if (!isGroundedLpa(n, ctx)) {
      return `rationale references ${n} LPA which is not grounded in the conversation (candidate-mentioned: [${ctx.mentionedNumbers.join(", ")}], band: [${ctx.bandScalars.join(", ")}])`;
    }
  }
  for (const p of percents) {
    if (!isGroundedPercent(p, ctx)) {
      return `rationale references ${p}% which is not derivable from any pair of candidate-mentioned numbers [${ctx.mentionedNumbers.join(", ")}]`;
    }
  }
  return null;
}

function buildGroundingCtx(
  band: NegotiationBand,
  state: DerivedState,
  toolNumber?: number,
): GroundingContext {
  const bandScalars = [band.walkAway, band.initialOffer, band.maxStretch];
  const anchorScalars: number[] = [];
  if (state.lastAnchorLpa !== null) anchorScalars.push(state.lastAnchorLpa);
  if (state.candidateTarget !== null) anchorScalars.push(state.candidateTarget);
  if (typeof toolNumber === "number") anchorScalars.push(toolNumber);
  return {
    mentionedNumbers: state.mentionedNumbers,
    bandScalars,
    anchorScalars,
  };
}

export function executeTool(
  call: ToolCall,
  band: NegotiationBand,
  state: DerivedState,
): ToolResult {
  switch (call.name) {
    case "propose_anchor": {
      const n = call.args.number_lpa;
      if (!Number.isFinite(n) || n <= 0) {
        return { ok: false, reason: "anchor number must be a positive LPA scalar" };
      }
      if (n < band.walkAway || n > band.maxStretch) {
        return {
          ok: false,
          reason: `anchor ${n} is outside band [${band.walkAway}, ${band.maxStretch}]`,
        };
      }
      if (state.hasAnchored) {
        return {
          ok: false,
          reason: "already anchored — use propose_counter for the next move",
        };
      }
      const rationale = (call.args.rationale ?? "").trim();
      if (rationale.length < 10) {
        return { ok: false, reason: "anchor requires a rationale (>= 10 chars)" };
      }
      const groundingFail = validateGrounding(
        rationale,
        buildGroundingCtx(band, state, n),
      );
      if (groundingFail) return { ok: false, reason: groundingFail };
      const canonical = `Based on what you've shared, we can come in at ${fmtLpa(n)} for this role — ${rationale}.`;
      return { ok: true, canonical, lpa: n, tool: "propose_anchor" };
    }

    case "propose_counter": {
      const n = call.args.number_lpa;
      if (!Number.isFinite(n) || n <= 0) {
        return { ok: false, reason: "counter number must be a positive LPA scalar" };
      }
      if (n < band.walkAway || n > band.maxStretch) {
        return {
          ok: false,
          reason: `counter ${n} is outside band [${band.walkAway}, ${band.maxStretch}]`,
        };
      }
      if (!state.hasAnchored || state.lastAnchorLpa === null) {
        return {
          ok: false,
          reason: "cannot counter before anchoring — use propose_anchor",
        };
      }
      if (n <= state.lastAnchorLpa) {
        return {
          ok: false,
          reason: `counter ${n} must exceed prior anchor ${state.lastAnchorLpa}`,
        };
      }
      const rationale = (call.args.rationale ?? "").trim();
      if (rationale.length < 10) {
        return { ok: false, reason: "counter requires a rationale (>= 10 chars)" };
      }
      const groundingFail = validateGrounding(
        rationale,
        buildGroundingCtx(band, state, n),
      );
      if (groundingFail) return { ok: false, reason: groundingFail };
      const canonical = `We can move up to ${fmtLpa(n)} on the fixed — ${rationale}.`;
      return { ok: true, canonical, lpa: n, tool: "propose_counter" };
    }

    case "concede": {
      const { lever, amount_lpa: amt } = call.args;
      if (!Number.isFinite(amt) || amt <= 0) {
        return { ok: false, reason: "concession amount must be positive" };
      }
      const cap = (state.lastAnchorLpa ?? band.initialOffer) * 0.5;
      if (amt > cap) {
        return {
          ok: false,
          reason: `concession ${amt} exceeds 50% of anchor — structurally implausible`,
        };
      }
      const tmpl: Record<typeof lever, string> = {
        joining_bonus: `I can add a ${fmtLpa(amt)} joining bonus to bridge the gap — that's the structural lever I have here.`,
        esops: `I can layer in ${fmtLpa(amt)} of ESOPs vesting over 4 years — that's where the upside sits.`,
        variable_to_base: `I can shift ${fmtLpa(amt)} from variable into your fixed base — cleaner predictability.`,
        role_uplift: `I can move you to the next band on title — that's worth about ${fmtLpa(amt)} on next cycle.`,
      };
      return { ok: true, canonical: tmpl[lever], lpa: amt, tool: "concede" };
    }

    case "close_recap": {
      if (state.verbalAcceptanceTurn === null) {
        return {
          ok: false,
          reason: "cannot close_recap before verbal acceptance",
        };
      }
      const f = call.args.final_lpa;
      if (!Number.isFinite(f) || f <= 0) {
        return { ok: false, reason: "final_lpa must be positive" };
      }
      if (state.lastAnchorLpa !== null && Math.abs(f - state.lastAnchorLpa) > 0.5) {
        return {
          ok: false,
          reason: `final ${f} must match prior anchor ${state.lastAnchorLpa}`,
        };
      }
      const parts = (call.args.components ?? [])
        .map((c) => `${c.label} ${fmtLpa(c.lpa)}`)
        .join(", ");
      const canonical =
        parts.length > 0
          ? `Quick recap — ${fmtLpa(f)} total: ${parts}. I'll have HR send the formal letter today. Sounds good?`
          : `Quick recap — ${fmtLpa(f)} total. I'll have HR send the formal letter today. Sounds good?`;
      return { ok: true, canonical, lpa: f, tool: "close_recap" };
    }

    case "decline_offer_ask": {
      /* The honest exit. Always valid — refusing to invent a number
       * is structurally preferable to marketing fluff. */
      const reason = (call.args.reason ?? "").trim();
      const ceiling = fmtLpa(band.maxStretch);
      const canonical =
        reason.length >= 10
          ? `Honest answer — our ceiling on this role is ${ceiling}. ${reason}. If that's a dealbreaker, I'd rather tell you now than waste your time.`
          : `Honest answer — our ceiling on this role is ${ceiling}. If that's a dealbreaker, I'd rather tell you now than waste your time.`;
      return { ok: true, canonical, tool: "decline_offer_ask" };
    }

    case "defer_with_callback": {
      const { topic, when } = call.args;
      if (!topic || topic.trim().length < 3) {
        return { ok: false, reason: "defer requires a topic" };
      }
      if (!when || !hasConcreteTime(when)) {
        return {
          ok: false,
          reason: "defer requires a CONCRETE callback time (today / tomorrow / by EOD / by <weekday> / by MM/DD)",
        };
      }
      const canonical = `Need to check with finance on ${topic.trim()}. I'll come back to you ${when.trim()} with a concrete number — not a maybe.`;
      return { ok: true, canonical, tool: "defer_with_callback" };
    }

    case "ask_discovery": {
      const q = (call.args.question ?? "").trim();
      if (q.length < 5) {
        return { ok: false, reason: "discovery question is empty" };
      }
      /* Strip any LPA number from the question — discovery is for
       * gathering info, not for sneaking anchors past the gate. */
      if (/\b\d+(?:\.\d+)?\s*(?:l|lpa)\b/i.test(q)) {
        return {
          ok: false,
          reason: "ask_discovery cannot contain an LPA number — use propose_anchor",
        };
      }
      /* Single-sentence rule. The PD #2 T8 monologue ("...The clawback
       * is typically 12 months pro-rata.") was a discovery question
       * with an unsolicited policy assertion tacked on. Discovery is
       * ONE question — no multi-clause declaratives. We allow a
       * single trailing '?' and reject any mid-string '. ' or '! '
       * that signals a second sentence. 200-char hard cap on top. */
      if (q.length > 200) {
        return {
          ok: false,
          reason: "ask_discovery must be a single short question (>200 chars suggests a monologue)",
        };
      }
      /* Strip a trailing terminal punctuation before checking interior. */
      const interior = q.replace(/[?.!]+\s*$/, "");
      if (/[.!?]\s+\S/.test(interior)) {
        return {
          ok: false,
          reason: "ask_discovery must be a single sentence — no embedded policy assertions or follow-on claims",
        };
      }
      return { ok: true, canonical: q.endsWith("?") ? q : `${q}?`, tool: "ask_discovery" };
    }
  }
}
