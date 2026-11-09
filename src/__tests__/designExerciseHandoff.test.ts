import { describe, it, expect, vi } from "vitest";
import {
  fetchPortfolioReviewHandoff,
  extractPortfolioHandoffNote,
} from "../../server-handlers/_design-exercise-handoff";

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

describe("extractPortfolioHandoffNote", () => {
  it("prefers a grounded win over anything else in the report", () => {
    const report = {
      wins: [{ text: "Grounded decisions in real user research.", questionIdx: 1, quote: "we ran five usability sessions" }],
      coaching: { strength: { headline: "Research-led", meaning: "You lean on evidence." } },
    };
    expect(extractPortfolioHandoffNote(report)).toBe("Grounded decisions in real user research.");
  });

  it("returns null when there is no usable win, even if coaching exists", () => {
    const report = { wins: [], coaching: { strength: { headline: "x", meaning: "y" } } };
    expect(extractPortfolioHandoffNote(report)).toBeNull();
  });

  it("returns null for malformed or missing report_json", () => {
    expect(extractPortfolioHandoffNote(null)).toBeNull();
    expect(extractPortfolioHandoffNote(undefined)).toBeNull();
    expect(extractPortfolioHandoffNote({})).toBeNull();
    expect(extractPortfolioHandoffNote({ wins: [{ text: "", quote: "" }] })).toBeNull();
  });
});

describe("fetchPortfolioReviewHandoff", () => {
  it("returns null on missing config (graceful degrade)", async () => {
    expect(await fetchPortfolioReviewHandoff({ supabaseUrl: "", serviceKey: "", userId: "u1" })).toBeNull();
    expect(await fetchPortfolioReviewHandoff({ supabaseUrl: SUPABASE_URL, serviceKey: "", userId: "u1" })).toBeNull();
    expect(await fetchPortfolioReviewHandoff({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, userId: "" })).toBeNull();
  });

  it("queries only the candidate's most recent completed portfolio-review session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([]));
    await fetchPortfolioReviewHandoff({
      supabaseUrl: SUPABASE_URL,
      serviceKey: SERVICE_KEY,
      userId: "user-1",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("user_id=eq.user-1");
    expect(url).toContain("type=eq.portfolio-review");
    expect(url).toContain("report_json=not.is.null");
    expect(url).toContain("order=created_at.desc");
    expect(url).toContain("limit=1");
  });

  it("extracts the handoff note from the returned row", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok([{ report_json: { wins: [{ text: "Grounded decisions in real user research.", questionIdx: 0, quote: "q" }] } }]),
    );
    const result = await fetchPortfolioReviewHandoff({
      supabaseUrl: SUPABASE_URL,
      serviceKey: SERVICE_KEY,
      userId: "user-1",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result).toBe("Grounded decisions in real user research.");
  });

  it("returns null when no portfolio-review session exists yet", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([]));
    const result = await fetchPortfolioReviewHandoff({
      supabaseUrl: SUPABASE_URL,
      serviceKey: SERVICE_KEY,
      userId: "user-1",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result).toBeNull();
  });

  it("returns null on HTTP failure or network error (never throws)", async () => {
    const failing = vi.fn().mockResolvedValue(notOk(500));
    expect(await fetchPortfolioReviewHandoff({
      supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, userId: "u1", fetchImpl: failing as unknown as typeof fetch,
    })).toBeNull();

    const throwing = vi.fn().mockRejectedValue(new Error("network down"));
    expect(await fetchPortfolioReviewHandoff({
      supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, userId: "u1", fetchImpl: throwing as unknown as typeof fetch,
    })).toBeNull();
  });
});
