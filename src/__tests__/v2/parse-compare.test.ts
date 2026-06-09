/* V2 parse-compare test suite (2026-06-09).
 *
 * The comparator is diagnostic-only. Its three contracts:
 *
 *   1. Env-gated. Without NEGOTIATION_V2_PARSE_COMPARE=1 the LLM is
 *      never called and no telemetry event fires.
 *   2. Fire-and-forget. The function signature is void; it must not
 *      throw even when the LLM rejects, returns garbage, or hangs.
 *   3. No-op when the last log turn isn't a candidate utterance —
 *      there's no new candidate text to compare on.
 *
 * The actual analyst signal (regex vs LLM agreement) is read out of
 * PostHog post-hoc; we don't assert on numeric overlap here because
 * that's the comparator's whole reason to exist.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  compareParsePerTurnAsync,
  replayLogAsync,
  summarizeRecords,
} from "../../../server-handlers/v2/parse-compare";
import type { ConversationTurn } from "../../../server-handlers/v2/kernel";

vi.mock("../../../server-handlers/_posthog", () => ({
  captureServerEvent: vi.fn(),
}));
import { captureServerEvent } from "../../../server-handlers/_posthog";

const FLAG = "NEGOTIATION_V2_PARSE_COMPARE";
const prior = process.env[FLAG];

beforeEach(() => {
  vi.mocked(captureServerEvent).mockClear();
});

afterEach(() => {
  if (prior === undefined) delete process.env[FLAG];
  else process.env[FLAG] = prior;
});

const LOG: ConversationTurn[] = [
  { role: "ai", text: "what's your current CTC?", tool: "ask_discovery" },
  { role: "candidate", text: "my current ctc is 32 LPA, 28 base + 4 variable" },
];

describe("parse-compare — env gating", () => {
  it("no-op without NEGOTIATION_V2_PARSE_COMPARE=1 — LLM never called, no event fired", async () => {
    delete process.env[FLAG];
    const llm = vi.fn(async () => "{}");
    compareParsePerTurnAsync(LOG, llm, "user-1", "session-1");
    /* Give microtasks a chance to flush so we know nothing queued. */
    await new Promise((r) => setTimeout(r, 10));
    expect(llm).not.toHaveBeenCalled();
    expect(captureServerEvent).not.toHaveBeenCalled();
  });

  it("enabled with =1 — LLM called once, event fired", async () => {
    process.env[FLAG] = "1";
    const llm = vi.fn(
      async () =>
        '{"numbers":[{"value":32,"kind":"current_ctc"}],"is_offer_ask":false,"topics_surfaced":["base","variable"],"topics_closed":[],"acceptance":"none","conditions":[]}',
    );
    compareParsePerTurnAsync(LOG, llm, "user-1", "session-1");
    await new Promise((r) => setTimeout(r, 20));
    expect(llm).toHaveBeenCalledTimes(1);
    expect(captureServerEvent).toHaveBeenCalledTimes(1);
    const call = vi.mocked(captureServerEvent).mock.calls[0];
    expect(call[0]).toBe("negotiation_v2_parse_compare");
    expect(call[1]).toBe("user-1");
    const props = call[2] as Record<string, unknown>;
    expect(props.session_id).toBe("session-1");
    expect(props.llm_parsed).toBe(true);
    /* Array fields are JSON-stringified to fit PostHog's Props type. */
    expect(typeof props.regex_numbers_json).toBe("string");
    expect(typeof props.llm_numbers_json).toBe("string");
    expect(JSON.parse(props.llm_numbers_json as string)).toEqual([
      { value: 32, kind: "current_ctc" },
    ]);
  });
});

describe("parse-compare — last-turn gating", () => {
  it("no-op when the last log turn is the AI (no new candidate text)", async () => {
    process.env[FLAG] = "1";
    const aiLastLog: ConversationTurn[] = [
      { role: "candidate", text: "32 LPA" },
      { role: "ai", text: "got it", tool: "ask_discovery" },
    ];
    const llm = vi.fn(async () => "{}");
    compareParsePerTurnAsync(aiLastLog, llm, "user-1", "session-1");
    await new Promise((r) => setTimeout(r, 10));
    expect(llm).not.toHaveBeenCalled();
    expect(captureServerEvent).not.toHaveBeenCalled();
  });

  it("no-op on empty log", async () => {
    process.env[FLAG] = "1";
    const llm = vi.fn(async () => "{}");
    compareParsePerTurnAsync([], llm, "user-1", "session-1");
    await new Promise((r) => setTimeout(r, 10));
    expect(llm).not.toHaveBeenCalled();
  });
});

describe("parse-compare — error swallowing", () => {
  it("swallows LLM throws — never crashes, logs error event", async () => {
    process.env[FLAG] = "1";
    const llm = vi.fn(async () => {
      throw new Error("boom");
    });
    expect(() =>
      compareParsePerTurnAsync(LOG, llm, "user-1", "session-1"),
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
    expect(captureServerEvent).toHaveBeenCalledWith(
      "negotiation_v2_parse_compare_error",
      "user-1",
      expect.objectContaining({ session_id: "session-1", error: "boom" }),
    );
  });

  it("handles garbage LLM output — logs event with llm_parsed=false", async () => {
    process.env[FLAG] = "1";
    const llm = vi.fn(async () => "not json at all");
    compareParsePerTurnAsync(LOG, llm, "user-1", "session-1");
    await new Promise((r) => setTimeout(r, 20));
    expect(captureServerEvent).toHaveBeenCalledWith(
      "negotiation_v2_parse_compare",
      "user-1",
      expect.objectContaining({ llm_parsed: false }),
    );
  });

  it("handles partial JSON — missing fields default to empty/null", async () => {
    process.env[FLAG] = "1";
    /* No "numbers" field, malformed acceptance. */
    const llm = vi.fn(async () => '{"is_offer_ask": true, "acceptance": "weird"}');
    compareParsePerTurnAsync(LOG, llm, "user-1", "session-1");
    await new Promise((r) => setTimeout(r, 20));
    const call = vi.mocked(captureServerEvent).mock.calls[0];
    const props = call[2] as Record<string, unknown>;
    expect(props.llm_parsed).toBe(true);
    expect(JSON.parse(props.llm_numbers_json as string)).toEqual([]);
    expect(props.llm_acceptance).toBe("none");
  });
});

describe("parse-compare — replayLogAsync (offline batch)", () => {
  /* The replay path runs one LLM call per candidate turn over a full
   * log. Unlike the live path, this is awaitable and returns records —
   * it's how scripts/v2-parse-replay.ts produces a readout. */
  it("returns one record per candidate turn, skipping AI turns", async () => {
    const log: ConversationTurn[] = [
      { role: "ai", text: "CTC?", tool: "ask_discovery" },
      { role: "candidate", text: "32 LPA" },
      { role: "ai", text: "target?", tool: "ask_discovery" },
      { role: "candidate", text: "44 LPA" },
    ];
    const llm = vi.fn(async () =>
      '{"numbers":[],"is_offer_ask":false,"topics_surfaced":[],"topics_closed":[],"acceptance":"none","conditions":[]}',
    );
    const records = await replayLogAsync(log, llm);
    expect(records).toHaveLength(2);
    expect(llm).toHaveBeenCalledTimes(2);
    expect(records[0].turnIndex).toBeGreaterThanOrEqual(1);
    expect(records[0].candidateText).toBe("32 LPA");
    expect(records[1].candidateText).toBe("44 LPA");
  });

  it("handles individual LLM failures gracefully — record.llm is null, replay continues", async () => {
    const log: ConversationTurn[] = [
      { role: "candidate", text: "32 LPA" },
      { role: "ai", text: "ok", tool: "ask_discovery" },
      { role: "candidate", text: "44 LPA" },
    ];
    let calls = 0;
    const llm = vi.fn(async () => {
      calls++;
      if (calls === 1) throw new Error("rate limited");
      return '{"numbers":[{"value":44,"kind":"target"}],"is_offer_ask":false,"topics_surfaced":[],"topics_closed":[],"acceptance":"none","conditions":[]}';
    });
    const records = await replayLogAsync(log, llm);
    expect(records).toHaveLength(2);
    expect(records[0].llm).toBeNull();
    expect(records[1].llm).not.toBeNull();
  });
});

describe("parse-compare — summarizeRecords", () => {
  it("computes coverage on the union of regex+llm numbers (when both agree)", async () => {
    /* Single LPA-suffixed number — both layers see it cleanly. */
    const log: ConversationTurn[] = [
      { role: "candidate", text: "my current ctc is 32 LPA" },
    ];
    const llm = vi.fn(
      async () =>
        '{"numbers":[{"value":32,"kind":"current_ctc"}],"is_offer_ask":false,"topics_surfaced":[],"topics_closed":[],"acceptance":"none","conditions":[]}',
    );
    const records = await replayLogAsync(log, llm);
    const s = summarizeRecords(records);
    expect(s.totalCandidateTurns).toBe(1);
    expect(s.regexCoverageOnUnion).toBe(1);
    expect(s.llmCoverageOnUnion).toBe(1);
    expect(s.disagreementCount).toBe(0);
  });

  it("exposes regex gap on multi-number candidate text without per-number LPA suffix", async () => {
    /* "32 LPA, 28 base + 4 variable" — regex needs the literal "LPA"
     * suffix per number, so it only catches 32. This is the real
     * parse-coverage gap the comparator was built to surface.
     * If this assertion ever changes, the kernel's number extractor
     * got smarter (good) — bump it deliberately, don't paper over. */
    const log: ConversationTurn[] = [
      { role: "candidate", text: "my current ctc is 32 LPA, 28 base + 4 variable" },
    ];
    const llm = vi.fn(
      async () =>
        '{"numbers":[{"value":32,"kind":"current_ctc"},{"value":28,"kind":"current_base"},{"value":4,"kind":"current_variable"}],"is_offer_ask":false,"topics_surfaced":["base","variable"],"topics_closed":[],"acceptance":"none","conditions":[]}',
    );
    const records = await replayLogAsync(log, llm);
    const s = summarizeRecords(records);
    /* Regex caught 1/3; LLM caught 3/3. */
    expect(s.regexCoverageOnUnion).toBeCloseTo(1 / 3, 2);
    expect(s.llmCoverageOnUnion).toBe(1);
    expect([...s.numbersOnlyLlmSaw].sort((a, b) => a - b)).toEqual([4, 28]);
  });

  it("flags low regex coverage when llm catches numbers regex misses", async () => {
    /* Paraphrased: "four-five LPA" — regex won't catch the 45. */
    const log: ConversationTurn[] = [
      { role: "candidate", text: "I have an offer at four-five LPA" },
    ];
    const llm = vi.fn(
      async () =>
        '{"numbers":[{"value":45,"kind":"competing_offer_lpa"}],"is_offer_ask":false,"topics_surfaced":[],"topics_closed":[],"acceptance":"none","conditions":[]}',
    );
    const records = await replayLogAsync(log, llm);
    const s = summarizeRecords(records);
    expect(s.regexCoverageOnUnion).toBeLessThan(1);
    expect(s.numbersOnlyLlmSaw).toContain(45);
  });
});

describe("parse-compare — disagreement flags", () => {
  it("flags disagree_offer_ask when regex misses but LLM catches the ask", async () => {
    process.env[FLAG] = "1";
    /* Candidate uses paraphrased ask the regex doesn't catch. */
    const log: ConversationTurn[] = [
      { role: "ai", text: "tell me about your current setup", tool: "ask_discovery" },
      { role: "candidate", text: "look just throw a number at me na, what can you do?" },
    ];
    const llm = vi.fn(
      async () =>
        '{"numbers":[],"is_offer_ask":true,"topics_surfaced":[],"topics_closed":[],"acceptance":"none","conditions":[]}',
    );
    compareParsePerTurnAsync(log, llm, "user-1", "session-1");
    await new Promise((r) => setTimeout(r, 20));
    const call = vi.mocked(captureServerEvent).mock.calls[0];
    const props = call[2] as Record<string, unknown>;
    /* The whole point of the comparator: surface this disagreement. */
    expect(props.disagree_offer_ask).toBe(true);
  });
});
