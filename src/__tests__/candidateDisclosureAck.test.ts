/* PDF #18 root-cause (2026-05-15) — candidate-disclosure ack tracker.
 *
 * Tests both the pure detector + pruner module and its kernel
 * integration (applyCandidateAnswer / applyAiMove). */
import { describe, expect, it } from "vitest";
import {
  detectCandidateDisclosures,
  pruneAcknowledged,
} from "../../server-handlers/_candidate-disclosure-tracker";

describe("detectCandidateDisclosures — pure", () => {
  it("detects 90-day notice period", () => {
    const out = detectCandidateDisclosures("I have a 90 days notice period.");
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("notice-period");
    expect(out[0].label).toMatch(/90/);
  });

  it("detects '60-day notice' compact form", () => {
    const out = detectCandidateDisclosures("My 60-day notice starts next week.");
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("notice-period");
  });

  it("detects current CTC disclosure", () => {
    const out = detectCandidateDisclosures("My current CTC is 22 LPA.");
    expect(out.some((e) => e.kind === "current-ctc")).toBe(true);
  });

  it("detects competing offer", () => {
    const out = detectCandidateDisclosures("I have a competing offer at hand.");
    expect(out.some((e) => e.kind === "competing-offer")).toBe(true);
  });

  it("detects joining-date disclosure", () => {
    const out = detectCandidateDisclosures("I can join after 30 days.");
    expect(out.some((e) => e.kind === "joining-date")).toBe(true);
  });

  it("returns empty for plain hello", () => {
    expect(detectCandidateDisclosures("Hello, nice to meet you.")).toEqual([]);
  });

  it("returns empty for null / undefined input", () => {
    expect(detectCandidateDisclosures(null)).toEqual([]);
    expect(detectCandidateDisclosures(undefined)).toEqual([]);
  });
});

describe("pruneAcknowledged — pure", () => {
  it("removes notice-period entry when bot mentions notice", () => {
    const pending = detectCandidateDisclosures("I have 90 days notice.");
    const remaining = pruneAcknowledged(pending, "Got it — we can work with a 90 day notice or explore buyout.");
    expect(remaining).toHaveLength(0);
  });

  it("keeps notice-period entry when bot ignores it (benefits restatement)", () => {
    const pending = detectCandidateDisclosures("I have 90 days notice.");
    const remaining = pruneAcknowledged(pending, "We offer great medical insurance and PF benefits.");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].kind).toBe("notice-period");
  });

  it("removes only the acknowledged subset", () => {
    const pending = [
      ...detectCandidateDisclosures("I have 90 days notice."),
      ...detectCandidateDisclosures("My current CTC is 22 LPA."),
    ];
    expect(pending.length).toBe(2);
    const remaining = pruneAcknowledged(pending, "Your notice period of 90 days is fine.");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].kind).toBe("current-ctc");
  });

  it("returns pending as-is when bot reply empty", () => {
    const pending = detectCandidateDisclosures("I have 90 days notice.");
    const remaining = pruneAcknowledged(pending, "");
    expect(remaining).toHaveLength(1);
  });

  it("returns [] for empty pending", () => {
    expect(pruneAcknowledged([], "anything")).toEqual([]);
  });
});

describe("PDF #18 — kernel integration", async () => {
  const {
    applyCandidateAnswer,
    applyAiMove,
    initState,
  } = await import("../../server-handlers/_negotiation-kernel");

  it("applyCandidateAnswer pushes notice-period disclosure into pendingCandidateAcks", () => {
    const s0 = initState({
      sessionId: "s1",
      role: "Software Engineer",
      company: "acme",
      band: { initialOffer: 28, maxStretch: 38, walkAway: 22, hasEquity: false },
    });
    const s1 = applyCandidateAnswer(s0, "I have a 90 days notice period.");
    expect(s1.pendingCandidateAcks).toBeDefined();
    expect(s1.pendingCandidateAcks?.some((e) => e.kind === "notice-period")).toBe(true);
  });

  it("applyAiMove prunes pendingCandidateAcks the bot reply addresses", () => {
    const s0 = initState({
      sessionId: "s1",
      role: "Software Engineer",
      company: "acme",
      band: { initialOffer: 28, maxStretch: 38, walkAway: 22, hasEquity: false },
    });
    const s1 = applyCandidateAnswer(s0, "I have a 90 days notice period.");
    expect(s1.pendingCandidateAcks?.length).toBe(1);
    const s2 = applyAiMove(
      s1,
      { lever: "probe", newTotalLpa: null, rationale: "ack" },
      "Understood — 90 day notice noted, we'll discuss buyout terms.",
    );
    expect((s2.pendingCandidateAcks ?? []).length).toBe(0);
  });

  it("applyAiMove keeps pendingCandidateAcks the bot reply ignored", () => {
    const s0 = initState({
      sessionId: "s1",
      role: "Software Engineer",
      company: "acme",
      band: { initialOffer: 28, maxStretch: 38, walkAway: 22, hasEquity: false },
    });
    const s1 = applyCandidateAnswer(s0, "I have a 90 days notice period.");
    const s2 = applyAiMove(
      s1,
      { lever: "benefits-summary", newTotalLpa: null, rationale: "deflect" },
      "We have a great learning budget and free meals.",
    );
    expect(s2.pendingCandidateAcks?.length).toBe(1);
    expect(s2.pendingCandidateAcks?.[0].kind).toBe("notice-period");
  });

  it("de-dupes when candidate restates the same disclosure", () => {
    const s0 = initState({
      sessionId: "s1",
      role: "Software Engineer",
      company: "acme",
      band: { initialOffer: 28, maxStretch: 38, walkAway: 22, hasEquity: false },
    });
    const s1 = applyCandidateAnswer(s0, "I have a 90 days notice period.");
    const s2 = applyAiMove(
      s1,
      { lever: "benefits-summary", newTotalLpa: null, rationale: "ignore" },
      "We have a learning budget.",
    );
    const s3 = applyCandidateAnswer(s2, "Just to repeat — I have 90 days notice.");
    expect(s3.pendingCandidateAcks?.length).toBe(1);
  });
});
