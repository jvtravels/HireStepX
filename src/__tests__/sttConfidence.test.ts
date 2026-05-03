import { describe, it, expect } from "vitest";
import {
  LOW_CONFIDENCE_THRESHOLD,
  createSttConfidenceState,
  updateSttConfidence,
  resetSttConfidence,
  snapshotSttConfidence,
} from "../_stt-confidence";

describe("STT confidence tracker", () => {
  describe("snapshot empty state", () => {
    it("returns neutral defaults when no chunks observed", () => {
      const s = createSttConfidenceState();
      const snap = snapshotSttConfidence(s);
      expect(snap.mean).toBe(1);
      expect(snap.min).toBe(1);
      expect(snap.lowFraction).toBe(0);
      expect(snap.shouldHint).toBe(false);
    });
  });

  describe("update + snapshot", () => {
    it("computes mean / min correctly across chunks", () => {
      const s = createSttConfidenceState();
      updateSttConfidence(s, 0.9);
      updateSttConfidence(s, 0.7);
      updateSttConfidence(s, 0.8);
      const snap = snapshotSttConfidence(s);
      expect(snap.mean).toBeCloseTo(0.8, 5);
      expect(snap.min).toBe(0.7);
    });

    it("counts low-confidence chunks via the threshold", () => {
      const s = createSttConfidenceState();
      updateSttConfidence(s, 0.95); // not low
      updateSttConfidence(s, 0.6);  // low
      updateSttConfidence(s, 0.5);  // low
      updateSttConfidence(s, 0.85); // not low
      const snap = snapshotSttConfidence(s);
      expect(snap.lowFraction).toBeCloseTo(0.5, 5);
    });

    it("clamps overshoots above 1.0 (Deepgram float rounding edge)", () => {
      const s = createSttConfidenceState();
      updateSttConfidence(s, 1.0001);
      const snap = snapshotSttConfidence(s);
      expect(snap.min).toBe(1);
      expect(snap.mean).toBe(1);
    });

    it("clamps undershoots below 0 (defensive)", () => {
      const s = createSttConfidenceState();
      updateSttConfidence(s, -0.1);
      const snap = snapshotSttConfidence(s);
      expect(snap.min).toBe(0);
      expect(snap.lowFraction).toBe(1); // 0 is below threshold
    });

    it("ignores non-finite values silently (no NaN poisoning)", () => {
      const s = createSttConfidenceState();
      updateSttConfidence(s, NaN);
      updateSttConfidence(s, Infinity);
      // @ts-expect-error - testing defensive non-number input
      updateSttConfidence(s, "0.8");
      const snap = snapshotSttConfidence(s);
      expect(snap.mean).toBe(1); // empty state defaults
      expect(s.totalChunks).toBe(0);
    });
  });

  describe("shouldHint heuristic", () => {
    it("does NOT hint on a single low-confidence chunk (avoid blips)", () => {
      const s = createSttConfidenceState();
      updateSttConfidence(s, 0.4);
      const snap = snapshotSttConfidence(s);
      expect(snap.shouldHint).toBe(false);
    });

    it("hints when mean drops below the threshold over multiple chunks", () => {
      const s = createSttConfidenceState();
      updateSttConfidence(s, 0.5);
      updateSttConfidence(s, 0.4);
      updateSttConfidence(s, 0.6);
      const snap = snapshotSttConfidence(s);
      expect(snap.shouldHint).toBe(true);
    });

    it("hints when low-fraction crosses 30% (even if mean is OK)", () => {
      const s = createSttConfidenceState();
      // 1 low + 2 high → 33% low fraction, mean ~0.78 (above threshold)
      updateSttConfidence(s, 0.4);
      updateSttConfidence(s, 0.95);
      updateSttConfidence(s, 0.95);
      const snap = snapshotSttConfidence(s);
      expect(snap.lowFraction).toBeGreaterThanOrEqual(0.3);
      expect(snap.mean).toBeGreaterThan(LOW_CONFIDENCE_THRESHOLD);
      expect(snap.shouldHint).toBe(true);
    });

    it("does NOT hint when everything is clean", () => {
      const s = createSttConfidenceState();
      updateSttConfidence(s, 0.92);
      updateSttConfidence(s, 0.88);
      updateSttConfidence(s, 0.95);
      const snap = snapshotSttConfidence(s);
      expect(snap.shouldHint).toBe(false);
    });
  });

  describe("reset", () => {
    it("clears state for a new turn", () => {
      const s = createSttConfidenceState();
      updateSttConfidence(s, 0.4);
      updateSttConfidence(s, 0.5);
      resetSttConfidence(s);
      const snap = snapshotSttConfidence(s);
      expect(snap.mean).toBe(1);
      expect(snap.min).toBe(1);
      expect(snap.lowFraction).toBe(0);
      expect(snap.shouldHint).toBe(false);
    });
  });

  describe("threshold pinning", () => {
    it("LOW_CONFIDENCE_THRESHOLD stays in the documented band", () => {
      // If anyone tweaks this, the comment in _stt-confidence.ts (Indian
      // English on Deepgram Nova-3, ~85-92% accuracy floor) is the
      // calibration reference. Pin so a silent retune surfaces in CI.
      expect(LOW_CONFIDENCE_THRESHOLD).toBeGreaterThanOrEqual(0.5);
      expect(LOW_CONFIDENCE_THRESHOLD).toBeLessThanOrEqual(0.75);
    });
  });
});
