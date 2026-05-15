/* PDF #18 root-cause (2026-05-15) — anchor lock wired into applyAiMove.
 *
 * Before this fix, lockAnchor() was exported but never called anywhere
 * outside its own unit tests (confirmed via full-codebase grep). The
 * PDF #18 real session showed an anchor jump 54 → 28 LPA mid-flight
 * because band.initialOffer was being re-derived without a session-
 * lifetime lock.
 *
 * applyAiMove now fires lockAnchor on the FIRST numeric move, making
 * the anchor immutable for the remainder of the session. */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  effectiveAnchorLpa,
  type NegotiationBand,
  type NegotiationState,
  type AiMove,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 28, maxStretch: 40, walkAway: 18, hasEquity: false };
const init = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s1", role: "qa-engineer", company: "jp morgan", band: BAND }),
  ...overrides,
});

describe("anchor lock survives band recompute (PDF #18)", () => {
  it("first numeric move locks the anchor", () => {
    const s = init();
    expect(s.anchorLocked).toBe(false);
    const move: AiMove = { lever: "open-with-offer", newTotalLpa: 28, rationale: "open" };
    const next = applyAiMove(s, move, "Our band opens at ₹28L.");
    expect(next.anchorLocked).toBe(true);
    expect(next.lockedAnchorLpa).toBe(28);
    expect(effectiveAnchorLpa(next)).toBe(28);
  });

  it("non-numeric move (probe) does not lock the anchor", () => {
    const s = init();
    const move: AiMove = { lever: "probe", newTotalLpa: null, rationale: "probe" };
    const next = applyAiMove(s, move, "What are you targeting?");
    expect(next.anchorLocked).toBeFalsy();
    expect(next.lockedAnchorLpa).toBeFalsy();
  });

  it("second numeric move does NOT change the locked anchor", () => {
    const s = init();
    const m1: AiMove = { lever: "open-with-offer", newTotalLpa: 54, rationale: "open" };
    const after1 = applyAiMove(s, m1, "We can open at ₹54L.");
    expect(after1.lockedAnchorLpa).toBe(54);
    /* Simulate band recompute (e.g. fresh-grad disclosure) that shifts
     * initialOffer downward. The locked anchor must survive. */
    const recomputed: NegotiationState = {
      ...after1,
      band: { ...after1.band, initialOffer: 28 },
    };
    const m2: AiMove = { lever: "counter-base", newTotalLpa: 30, rationale: "counter" };
    const after2 = applyAiMove(recomputed, m2, "We can stretch to ₹30L.");
    /* lockedAnchorLpa stays at the first disclosed number; effectiveAnchorLpa
     * keeps returning 54 even though band.initialOffer is now 28. */
    expect(after2.lockedAnchorLpa).toBe(54);
    expect(effectiveAnchorLpa(after2)).toBe(54);
  });

  it("PDF #18 scenario: 54 → 28 jump is prevented", () => {
    /* Turn 1: AI opens at ₹54L. Anchor locks at 54. */
    const s = init();
    const m1: AiMove = { lever: "open-with-offer", newTotalLpa: 54, rationale: "open" };
    const t1 = applyAiMove(s, m1, "We can open at ₹54L.");
    expect(effectiveAnchorLpa(t1)).toBe(54);

    /* Turn 2: even if some external code rebases band.initialOffer to
     * 28 (mimicking the PDF #18 mid-flight regression), effectiveAnchorLpa
     * still returns the locked 54. */
    const rebased: NegotiationState = {
      ...t1,
      band: { ...t1.band, initialOffer: 28, maxStretch: 32 },
    };
    expect(effectiveAnchorLpa(rebased)).toBe(54);
  });

  it("zero/negative newTotalLpa does not lock", () => {
    const s = init();
    const m: AiMove = { lever: "open-with-offer", newTotalLpa: 0, rationale: "noop" };
    const next = applyAiMove(s, m, "");
    expect(next.anchorLocked).toBeFalsy();
  });

  it("NaN newTotalLpa does not lock", () => {
    const s = init();
    const m: AiMove = { lever: "open-with-offer", newTotalLpa: Number.NaN, rationale: "noop" };
    const next = applyAiMove(s, m, "");
    expect(next.anchorLocked).toBeFalsy();
  });

  it("post-acceptance band churn does not relock anchor", () => {
    const s = init();
    const m1: AiMove = { lever: "open-with-offer", newTotalLpa: 28, rationale: "open" };
    const t1 = applyAiMove(s, m1, "₹28L.");
    expect(t1.lockedAnchorLpa).toBe(28);
    /* Even subsequent moves at higher numbers do not relock — the FIRST
     * disclosed anchor wins for the session. */
    const m2: AiMove = { lever: "counter-base", newTotalLpa: 32, rationale: "counter" };
    const t2 = applyAiMove(t1, m2, "₹32L.");
    expect(t2.lockedAnchorLpa).toBe(28);
    expect(t2.highestOfferMade).toBe(32);
  });

  it("effectiveAnchorLpa falls back to band.initialOffer when never locked", () => {
    const s = init();
    expect(effectiveAnchorLpa(s)).toBe(28);
  });
});
