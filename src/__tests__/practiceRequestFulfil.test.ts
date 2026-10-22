import { describe, it, expect } from "vitest";
import { requestsAnsweredBySession, fulfilPracticeRequests } from "../../server-handlers/_practice-request-fulfil";
import { roundKeyForTopic } from "../focusRounds";

const req = (id: string, topic: string | null, match_id = "m1", created_at = "2026-10-01T00:00:00Z") => ({ id, match_id, topic, created_at });
const titles = new Map([["m1", "Backend Engineer"], ["m2", "Product Manager"]]);
const session = (over: Partial<Parameters<typeof requestsAnsweredBySession>[1]> = {}) => ({
  type: "behavioral", focus: "hr-round", target_role: "Backend Engineer", score: 72, created_at: "2026-10-02T00:00:00Z", ...over,
});

describe("roundKeyForTopic", () => {
  it("maps focus labels case-insensitively and rejects free text", () => {
    expect(roundKeyForTopic(" hr round ")).toBe("hr-round");
    expect(roundKeyForTopic("Salary Negotiation")).toBe("salary-negotiation");
    expect(roundKeyForTopic("System design")).toBeNull();
    expect(roundKeyForTopic(null)).toBeNull();
  });
});

describe("requestsAnsweredBySession", () => {
  it("answers a request for the round the session covered", () => {
    expect(requestsAnsweredBySession([req("a", "HR Round")], session(), titles).map((r) => r.id)).toEqual(["a"]);
  });
  it("ignores other rounds and free-text topics", () => {
    expect(requestsAnsweredBySession([req("a", "Behavioral"), req("b", "System design")], session(), titles)).toEqual([]);
  });
  it("needs a graded session", () => {
    expect(requestsAnsweredBySession([req("a", "HR Round")], session({ score: null }), titles)).toEqual([]);
    expect(requestsAnsweredBySession([req("a", "HR Round")], session({ score: 0 }), titles)).toEqual([]);
  });
  it("does not count a session taken before the request was made", () => {
    expect(requestsAnsweredBySession([req("a", "HR Round", "m1", "2026-10-03T00:00:00Z")], session(), titles)).toEqual([]);
  });
  it("does not count a session for an unrelated role", () => {
    expect(requestsAnsweredBySession([req("a", "HR Round", "m2")], session(), titles)).toEqual([]);
  });
});

describe("fulfilPracticeRequests", () => {
  it("never throws when the backend is not configured", async () => {
    await expect(fulfilPracticeRequests("u1", "s1", (() => Promise.reject(new Error("down"))) as unknown as typeof fetch)).resolves.toBe(0);
  });
});
