/* V2 real-LLM end-to-end test (2026-06-09).
 *
 * Calls the live Anthropic Messages API with the v2 orchestrator's
 * system + user prompts and asserts the LLM returns a legal tool
 * call for the next turn of the Flipkart fixture. Gated on env so
 * CI without keys is unaffected:
 *
 *   RUN_LLM_E2E=1 ANTHROPIC_API_KEY=sk-... npx vitest run \
 *     src/__tests__/v2/llm-e2e.test.ts
 *
 * The point isn't to test the LLM. It's to prove the orchestrator's
 * JSON-mode prompt is parseable by a real model and that the legal-set
 * gate is honored end-to-end — the integration the stub tests cannot
 * cover. */

import { describe, it, expect } from "vitest";
import { generateTurn, type LlmAdapter, type LlmInput } from "../../../server-handlers/v2/orchestrator";
import { assertHonestMove } from "../../../server-handlers/v2/rail";
import { computeBand, deriveState, type ConversationTurn } from "../../../server-handlers/v2/kernel";
import type { ToolCall } from "../../../server-handlers/v2/tools";
import fixture from "../../../server-handlers/v2/__fixtures__/flipkart-senior-pd.json";

const ENABLED = process.env.RUN_LLM_E2E === "1" && !!process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.E2E_MODEL ?? "claude-sonnet-4-5";

/* The same parse + prompt the shadow adapter uses. Inlined here so
 * this file is self-contained — the e2e test must NOT couple to
 * internals that may change. */
function buildUserPrompt(input: LlmInput): string {
  const log = input.conversationLog
    .map((t) => `${t.role === "ai" ? "Recruiter" : "Candidate"}: ${t.text}`)
    .join("\n");
  const rejection = input.lastRejection
    ? `\n\nYour previous pick was REJECTED: tool=${input.lastRejection.tool} reason=${input.lastRejection.reason}. Pick differently.`
    : "";
  return `Conversation so far:\n${log}\n\nState scalars:
  turn_index: ${input.state.turnIndex}
  offer_ask_count: ${input.state.offerAskCount}
  has_anchored: ${input.state.hasAnchored}
  last_anchor_lpa: ${input.state.lastAnchorLpa ?? "null"}
  candidate_target: ${input.state.candidateTarget ?? "null"}
  verbal_acceptance_turn: ${input.state.verbalAcceptanceTurn ?? "null"}

Band: walk-away ${input.band.walkAway} LPA, initial ${input.band.initialOffer} LPA, stretch ${input.band.maxStretch} LPA.

Legal tools for this turn (you MUST pick exactly one): ${input.legalTools.join(", ")}${rejection}

Respond with ONLY a JSON object, no prose:
  { "name": "<tool_name>", "args": { ... } }`;
}

function parseToolCall(raw: string): ToolCall {
  const trimmed = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const m = trimmed.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`no JSON object in LLM response: ${raw.slice(0, 200)}`);
  const obj = JSON.parse(m[0]) as { name?: unknown; args?: unknown };
  if (typeof obj.name !== "string") throw new Error("missing 'name'");
  if (!obj.args || typeof obj.args !== "object") throw new Error("missing 'args'");
  return { name: obj.name, args: obj.args } as ToolCall;
}

async function callAnthropic(system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  return body.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
}

function liveAdapter(): LlmAdapter {
  return async (input) => parseToolCall(await callAnthropic(input.systemPrompt, buildUserPrompt(input)));
}

/* Use describe.skipIf so the test still appears in vitest output (so
 * it's discoverable) but doesn't fail when the env isn't set. */
describe.skipIf(!ENABLED)("v2 LLM e2e — real Anthropic call on Flipkart fixture", () => {
  it("picks a legal tool on the pre-T6 slice (the offer-ask gate point)", async () => {
    const log = (fixture.log as ConversationTurn[]).slice(0, 12);
    const band = computeBand("Senior Product Designer", "flipkart", "senior", 6);

    const result = await generateTurn(log, band, liveAdapter());

    /* Whatever the LLM picked, it MUST be the legal set the kernel
     * exposed. propose_anchor is the expected first pick post-T6
     * offer-ask invariant. */
    expect(result.tool).toMatch(/propose_anchor|propose_counter|decline_offer_ask|defer_with_callback/);
    /* The rail must sign off — no fluff, no ungrounded number. */
    const verdict = assertHonestMove(result, deriveState(log));
    expect(verdict.pass).toBe(true);
    /* If the LLM picked an anchor, the LPA must be inside the band. */
    if (result.tool === "propose_anchor" || result.tool === "propose_counter") {
      expect(result.lpa).toBeGreaterThanOrEqual(band.walkAway);
      expect(result.lpa).toBeLessThanOrEqual(band.maxStretch);
    }
  }, 30_000);

  it("on the post-acceptance slice, picks close_recap", async () => {
    const baseLog = fixture.log as ConversationTurn[];
    const acceptIdx = baseLog.findIndex((t) => t.role === "candidate" && /\baccept|\bdeal\b|works?\s+for\s+me/i.test(t.text));
    if (acceptIdx < 0) {
      /* Fixture has no explicit accept turn — synthesize one to drive
       * the post-acceptance branch. */
      const log: ConversationTurn[] = [
        ...baseLog.slice(0, 14),
        { role: "candidate", text: "great, I accept the offer" },
      ];
      const band = computeBand("Senior Product Designer", "flipkart", "senior", 6);
      const result = await generateTurn(log, band, liveAdapter());
      expect(result.tool).toBe("close_recap");
      return;
    }
    const log = baseLog.slice(0, acceptIdx + 1);
    const band = computeBand("Senior Product Designer", "flipkart", "senior", 6);
    const result = await generateTurn(log, band, liveAdapter());
    expect(result.tool).toBe("close_recap");
  }, 30_000);
});

/* When the gate is off, surface the reason once so `vitest --reporter=verbose`
 * makes it obvious why the suite was skipped. */
if (!ENABLED) {
  describe("v2 LLM e2e", () => {
    it.skip("[skipped — set RUN_LLM_E2E=1 and ANTHROPIC_API_KEY to run]", () => {});
  });
}
