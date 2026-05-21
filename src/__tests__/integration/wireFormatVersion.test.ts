/* Wire-format version contract test (2026-05-21 audit follow-up).
 *
 * NegotiationState serialised by the kernel carries a `__v` marker so
 * a newer client cannot push a future-shape payload through an older
 * server's back-compat backfill chain. These tests assert:
 *
 *   1. serializeState writes the current KERNEL_STATE_VERSION on every
 *      payload.
 *   2. deserializeState round-trips the payload and strips `__v` from
 *      the returned NegotiationState.
 *   3. A payload with __v > current is rejected loudly.
 *   4. A payload with __v = current or <= current is accepted.
 *   5. A LEGACY payload with NO __v key is still accepted (so in-flight
 *      sessions don't break on the rollout).
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  serializeState,
  deserializeState,
  KERNEL_STATE_VERSION,
} from "../../../server-handlers/_negotiation-kernel";

function seed() {
  return initState({
    sessionId: "wfv-1",
    role: "Senior Product Designer",
    company: "Flipkart",
    band: { initialOffer: 35, maxStretch: 50, walkAway: 30, hasEquity: true },
  });
}

describe("wire-format version — __v marker", () => {
  it("serializeState writes __v = KERNEL_STATE_VERSION on every payload", () => {
    const state = seed();
    const json = serializeState(state);
    const parsed = JSON.parse(json);
    expect(parsed.__v).toBe(KERNEL_STATE_VERSION);
  });

  it("round-trips: deserialize(serialize(state)) preserves all fields and strips __v", () => {
    const state = seed();
    const restored = deserializeState(serializeState(state));
    /* sessionId / role / company / band / phase / turnIndex are the
     * load-bearing identity fields — they must survive the round-trip
     * byte-identical. */
    expect(restored.sessionId).toBe(state.sessionId);
    expect(restored.role).toBe(state.role);
    expect(restored.company).toBe(state.company);
    expect(restored.band).toEqual(state.band);
    expect(restored.phase).toBe(state.phase);
    expect(restored.turnIndex).toBe(state.turnIndex);
    /* __v must NOT leak onto the returned NegotiationState. */
    expect((restored as unknown as { __v?: number }).__v).toBeUndefined();
  });

  it("rejects payloads with __v > KERNEL_STATE_VERSION (client newer than server)", () => {
    const state = seed();
    const futureJson = JSON.stringify({ ...state, __v: KERNEL_STATE_VERSION + 1 });
    expect(() => deserializeState(futureJson)).toThrow(/__v=\d+ exceeds server/);
  });

  it("rejects non-number __v as obviously malformed", () => {
    const state = seed();
    const badJson = JSON.stringify({ ...state, __v: "v2" });
    expect(() => deserializeState(badJson)).toThrow(/__v: expected finite number/);
  });

  it("accepts LEGACY payloads with NO __v key (in-flight sessions)", () => {
    /* Critical back-compat: when this versioning rollout shipped,
     * thousands of in-flight sessions had been serialised WITHOUT __v.
     * Those payloads must still deserialise — otherwise every active
     * candidate session would error on the next turn. */
    const state = seed();
    const legacyPayload = JSON.parse(JSON.stringify(state)); // strip nothing, no __v
    expect(legacyPayload.__v).toBeUndefined();
    const legacyJson = JSON.stringify(legacyPayload);
    const restored = deserializeState(legacyJson);
    expect(restored.sessionId).toBe(state.sessionId);
  });

  it("accepts __v = current and __v = current-1 (back-compat window)", () => {
    const state = seed();
    expect(() =>
      deserializeState(JSON.stringify({ ...state, __v: KERNEL_STATE_VERSION })),
    ).not.toThrow();
    /* If KERNEL_STATE_VERSION ever advances, prior versions remain
     * acceptable — only FUTURE versions are rejected. */
    if (KERNEL_STATE_VERSION > 1) {
      expect(() =>
        deserializeState(JSON.stringify({ ...state, __v: KERNEL_STATE_VERSION - 1 })),
      ).not.toThrow();
    }
  });
});
