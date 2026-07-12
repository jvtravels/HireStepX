import { describe, it, expect } from "vitest";
import {
  buildDraftSnapshot,
  validateRestoredDraft,
  DRAFT_TTL_MS,
  type DraftSnapshotInput,
} from "../_session-draft";

const baseInput: DraftSnapshotInput = {
  sessionId: "sess-abc-123",
  transcript: [{ speaker: "ai", text: "Hi", time: "t0" }],
  currentTranscript: "half-typed answer",
  currentStep: 3,
  elapsed: 120,
  interviewType: "salary-negotiation",
  interviewDifficulty: "medium",
  interviewFocus: "compensation",
  targetRole: "Software Engineer",
  targetCompany: "Flipkart",
  script: [],
};

describe("buildDraftSnapshot", () => {
  it("round-trips the sessionId so a refresh resumes under the same id (H1)", () => {
    const snap = buildDraftSnapshot(baseInput);
    expect(snap.sessionId).toBe("sess-abc-123");
  });

  it("carries all resume fields and stamps a fresh savedAt", () => {
    const before = Date.now();
    const snap = buildDraftSnapshot(baseInput);
    expect(snap.currentStep).toBe(3);
    expect(snap.currentTranscript).toBe("half-typed answer");
    expect(snap.interviewType).toBe("salary-negotiation");
    expect(snap.targetCompany).toBe("Flipkart");
    expect(snap.savedAt).toBeGreaterThanOrEqual(before);
  });
});

describe("validateRestoredDraft", () => {
  it("preserves the sessionId through a persist/restore cycle", () => {
    const snap = buildDraftSnapshot(baseInput);
    const restored = validateRestoredDraft(JSON.parse(JSON.stringify(snap)), "salary-negotiation");
    expect(restored?.sessionId).toBe("sess-abc-123");
  });

  it("still restores legacy drafts that predate the sessionId field", () => {
    const legacy = {
      transcript: [],
      currentStep: 2,
      elapsed: 10,
      interviewType: "salary-negotiation",
      savedAt: Date.now(),
    };
    const restored = validateRestoredDraft(legacy, "salary-negotiation");
    expect(restored).not.toBeNull();
    expect(restored?.sessionId).toBeUndefined();
  });

  it("rejects a draft older than the TTL", () => {
    const snap = buildDraftSnapshot(baseInput);
    snap.savedAt = Date.now() - DRAFT_TTL_MS - 1;
    expect(validateRestoredDraft(snap, "salary-negotiation")).toBeNull();
  });

  it("rejects an interview-type mismatch", () => {
    const snap = buildDraftSnapshot(baseInput);
    expect(validateRestoredDraft(snap, "behavioral")).toBeNull();
  });

  it("rejects malformed shapes", () => {
    expect(validateRestoredDraft(null)).toBeNull();
    expect(validateRestoredDraft({ transcript: "nope", currentStep: 1 })).toBeNull();
    expect(validateRestoredDraft({ transcript: [], currentStep: -1 })).toBeNull();
  });
});
