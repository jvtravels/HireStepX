import { describe, it, expect, vi } from "vitest";
import {
  fetchRecentQuestions,
  extractRecentQuestions,
} from "../../server-handlers/_question-dedup";

const SUPABASE_URL = "https://example.supabase.co";
const SERVICE_KEY = "service-role-key";

function ok(rows: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => rows,
    text: async () => JSON.stringify(rows),
  } as Response;
}

function notOk(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => "",
  } as Response;
}

describe("extractRecentQuestions", () => {
  it("pulls interviewer turns from a single session", () => {
    const out = extractRecentQuestions([
      {
        id: "s1",
        transcript: [
          { role: "interviewer", text: "Tell me about a time you led a team" },
          { role: "candidate", text: "I led a 5-person team at Acme…" },
          { role: "interviewer", text: "What was the hardest tradeoff you made?" },
        ],
      },
    ]);
    expect(out).toEqual([
      "Tell me about a time you led a team",
      "What was the hardest tradeoff you made?",
    ]);
  });

  it("dedupes by normalized text across sessions", () => {
    // Same logical question, different wording / casing / punctuation
    // should collapse to one entry. Otherwise the prompt fills with
    // near-duplicate items and wastes tokens.
    const out = extractRecentQuestions([
      {
        transcript: [
          { role: "interviewer", text: "Tell me about a time you led a team." },
        ],
      },
      {
        transcript: [
          { role: "interviewer", text: "tell me about a time you led a team!" },
        ],
      },
      {
        transcript: [
          { role: "interviewer", text: "TELL ME ABOUT A TIME YOU LED A TEAM" },
        ],
      },
    ]);
    expect(out).toHaveLength(1);
  });

  it("skips short / empty turns", () => {
    const out = extractRecentQuestions([
      {
        transcript: [
          { role: "interviewer", text: "Hi" },
          { role: "interviewer", text: "" },
          // @ts-expect-error - testing defensive non-string text input
          { role: "interviewer", text: null },
          { role: "interviewer", text: "Tell me about your experience with React" },
        ],
      },
    ]);
    expect(out).toEqual(["Tell me about your experience with React"]);
  });

  it("treats 'ai' and 'assistant' role labels as interviewer (legacy schema)", () => {
    const out = extractRecentQuestions([
      {
        transcript: [
          { role: "ai", text: "Why do you want this role at our company?" },
          { role: "assistant", text: "Walk me through a project you're proud of" },
          { role: "user", text: "Sure, so at my last job…" },
        ],
      },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("Why do you want this role");
  });

  it("ignores candidate turns", () => {
    const out = extractRecentQuestions([
      {
        transcript: [
          { role: "candidate", text: "I have 5 years of experience in product management" },
          { role: "user", text: "I led teams at Flipkart and Razorpay" },
        ],
      },
    ]);
    expect(out).toHaveLength(0);
  });

  it("respects the limit cap (no payload bloat)", () => {
    const turns = Array.from({ length: 50 }, (_, i) => ({
      role: "interviewer",
      text: `Question number ${i} about a very specific scenario`,
    }));
    const out = extractRecentQuestions([{ transcript: turns }], 10);
    expect(out).toHaveLength(10);
  });

  it("truncates individual entries at 200 chars (token economy)", () => {
    const longText = "Tell me about " + "x".repeat(500);
    const out = extractRecentQuestions([
      {
        transcript: [{ role: "interviewer", text: longText }],
      },
    ]);
    expect(out[0].length).toBeLessThanOrEqual(200);
  });

  it("returns empty array on degenerate input (defensive)", () => {
    expect(extractRecentQuestions([])).toEqual([]);
    // @ts-expect-error - testing defensive non-array input
    expect(extractRecentQuestions(null)).toEqual([]);
    expect(
      extractRecentQuestions([
        { transcript: null },
        { transcript: [] },
        // @ts-expect-error - testing defensive non-array transcript
        { transcript: "not an array" },
      ]),
    ).toEqual([]);
  });
});

describe("fetchRecentQuestions", () => {
  it("returns [] on missing config (graceful degrade)", async () => {
    expect(await fetchRecentQuestions({ supabaseUrl: "", serviceKey: "", userId: "u1" })).toEqual([]);
    expect(await fetchRecentQuestions({ supabaseUrl: SUPABASE_URL, serviceKey: "", userId: "u1" })).toEqual([]);
    expect(await fetchRecentQuestions({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, userId: "" })).toEqual([]);
  });

  it("builds the right PostgREST query (user filter + ordering + limit)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([]));
    await fetchRecentQuestions({
      supabaseUrl: SUPABASE_URL,
      serviceKey: SERVICE_KEY,
      userId: "user-1",
      type: "behavioral",
      focus: "leadership",
      sessionLimit: 20,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("user_id=eq.user-1");
    expect(url).toContain("type=eq.behavioral");
    expect(url).toContain("focus=eq.leadership");
    expect(url).toContain("order=created_at.desc");
    expect(url).toContain("limit=20");
    expect(url).toContain("select=id%2Ctranscript");
  });

  it("omits type/focus filters when not provided (broader match)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([]));
    await fetchRecentQuestions({
      supabaseUrl: SUPABASE_URL,
      serviceKey: SERVICE_KEY,
      userId: "user-1",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).not.toContain("type=eq.");
    expect(url).not.toContain("focus=eq.");
  });

  it("returns [] on HTTP failure (never throws)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(notOk(500));
    const out = await fetchRecentQuestions({
      supabaseUrl: SUPABASE_URL,
      serviceKey: SERVICE_KEY,
      userId: "user-1",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(out).toEqual([]);
  });

  it("returns [] on network exception (never throws)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    const out = await fetchRecentQuestions({
      supabaseUrl: SUPABASE_URL,
      serviceKey: SERVICE_KEY,
      userId: "user-1",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(out).toEqual([]);
  });

  it("end-to-end: fetches sessions and extracts deduped questions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok([
        {
          id: "s2",
          transcript: [
            { role: "interviewer", text: "Tell me about a time you led a team" },
            { role: "candidate", text: "I led 5 engineers at Acme" },
            { role: "interviewer", text: "What was your biggest failure?" },
          ],
        },
        {
          id: "s1",
          transcript: [
            // duplicate of session 2's first question — dedup should collapse
            { role: "interviewer", text: "Tell me about a time you led a team." },
            { role: "interviewer", text: "How do you prioritize a roadmap?" },
          ],
        },
      ]),
    );
    const out = await fetchRecentQuestions({
      supabaseUrl: SUPABASE_URL,
      serviceKey: SERVICE_KEY,
      userId: "user-1",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(out).toHaveLength(3); // not 4 — one duplicate folded
    expect(out[0]).toContain("Tell me about a time you led a team");
    expect(out).toContain("What was your biggest failure?");
    expect(out).toContain("How do you prioritize a roadmap?");
  });

  it("clamps sessionLimit to a sane range", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([]));
    await fetchRecentQuestions({
      supabaseUrl: SUPABASE_URL,
      serviceKey: SERVICE_KEY,
      userId: "user-1",
      sessionLimit: 999, // way too many
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("limit=100"); // clamped to upper bound
  });
});
