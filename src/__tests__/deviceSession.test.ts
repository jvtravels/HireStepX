import { describe, it, expect, beforeEach } from "vitest";
import {
  decideDeviceAction,
  markDeviceGrace,
  isWithinDeviceGrace,
  clearDeviceGrace,
  DEVICE_GRACE_KEY,
  DEVICE_GRACE_MS,
} from "../deviceSession";

/**
 * Regression guard for the auth self-eviction bug: a fresh login on a
 * previously-used account bounced straight back to /login because the `(app)`
 * route-group AuthProvider remounted and ran the single-device check against a
 * still-stale JWT (carrying the PREVIOUS session's device token) with no grace
 * window — the old in-memory grace ref died with the unmounted `(auth)`
 * provider. These tests pin the corrected keep/adopt/evict rule and the
 * remount-durable (localStorage-backed) grace window.
 */
describe("decideDeviceAction", () => {
  it("keeps when there is no server token yet (brand-new account / cleared metadata)", () => {
    expect(decideDeviceAction({ localToken: "a", serverToken: null, withinGrace: false })).toBe("keep");
    expect(decideDeviceAction({ localToken: null, serverToken: undefined, withinGrace: false })).toBe("keep");
  });

  it("adopts the server token when this origin has no local token (never evicts on absent local)", () => {
    expect(decideDeviceAction({ localToken: null, serverToken: "srv", withinGrace: false })).toBe("adopt");
    expect(decideDeviceAction({ localToken: undefined, serverToken: "srv", withinGrace: false })).toBe("adopt");
  });

  it("keeps when tokens match", () => {
    expect(decideDeviceAction({ localToken: "same", serverToken: "same", withinGrace: false })).toBe("keep");
  });

  it("keeps a mismatch while inside the grace window (our own rotation still propagating)", () => {
    // THE bug: localToken=new, serverToken=stale-JWT-old, just logged in.
    expect(decideDeviceAction({ localToken: "new", serverToken: "old", withinGrace: true })).toBe("keep");
  });

  it("evicts only on a real mismatch outside the grace window", () => {
    expect(decideDeviceAction({ localToken: "mine", serverToken: "other-device", withinGrace: false })).toBe("evict");
  });
});

describe("device grace window (remount-durable)", () => {
  beforeEach(() => {
    clearDeviceGrace();
  });

  it("is not active before being marked", () => {
    expect(isWithinDeviceGrace()).toBe(false);
  });

  it("is active immediately after marking and until the TTL elapses", () => {
    const t0 = 1_000_000;
    markDeviceGrace(DEVICE_GRACE_MS, t0);
    expect(isWithinDeviceGrace(t0 + 1)).toBe(true);
    expect(isWithinDeviceGrace(t0 + DEVICE_GRACE_MS - 1)).toBe(true);
  });

  it("expires exactly at the TTL boundary and self-cleans the marker", () => {
    const t0 = 2_000_000;
    markDeviceGrace(DEVICE_GRACE_MS, t0);
    expect(isWithinDeviceGrace(t0 + DEVICE_GRACE_MS)).toBe(false);
    // self-cleaned
    expect(localStorage.getItem(DEVICE_GRACE_KEY)).toBeNull();
  });

  it("survives a simulated provider remount (value lives in localStorage, not memory)", () => {
    const t0 = 3_000_000;
    markDeviceGrace(DEVICE_GRACE_MS, t0);
    // A remount creates a brand-new component with fresh refs, but localStorage
    // persists — isWithinDeviceGrace reads the same store the old instance wrote.
    expect(isWithinDeviceGrace(t0 + 5_000)).toBe(true);
  });

  it("treats a garbage marker as inactive and clears it", () => {
    localStorage.setItem(DEVICE_GRACE_KEY, "not-a-number");
    expect(isWithinDeviceGrace()).toBe(false);
    expect(localStorage.getItem(DEVICE_GRACE_KEY)).toBeNull();
  });

  it("clearDeviceGrace ends the window", () => {
    markDeviceGrace(DEVICE_GRACE_MS, 4_000_000);
    clearDeviceGrace();
    expect(isWithinDeviceGrace(4_000_001)).toBe(false);
  });
});
