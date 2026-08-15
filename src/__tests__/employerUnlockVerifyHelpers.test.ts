import { describe, it, expect } from "vitest";
import {
  validatePaymentIdsFormat,
  isOversizedRequest,
  verifyOrderOwnership,
  isClosedAndLocked,
  buildUnlockResponsePayload,
} from "../../server-handlers/_employer-unlock-verify-helpers";

describe("validatePaymentIdsFormat", () => {
  it("accepts well-formed Razorpay ids and a non-empty signature", () => {
    expect(
      validatePaymentIdsFormat({ orderId: "order_ABC123", paymentId: "pay_XYZ789", signature: "a".repeat(64) }),
    ).toBe(true);
  });

  it("rejects an order id with disallowed characters", () => {
    expect(
      validatePaymentIdsFormat({ orderId: "order-abc!", paymentId: "pay_XYZ789", signature: "sig" }),
    ).toBe(false);
  });

  it("rejects a too-short id", () => {
    expect(
      validatePaymentIdsFormat({ orderId: "abc", paymentId: "pay_XYZ789", signature: "sig" }),
    ).toBe(false);
  });

  it("rejects a signature over 128 chars", () => {
    expect(
      validatePaymentIdsFormat({ orderId: "order_ABC123", paymentId: "pay_XYZ789", signature: "a".repeat(129) }),
    ).toBe(false);
  });

  it("rejects an empty signature", () => {
    expect(
      validatePaymentIdsFormat({ orderId: "order_ABC123", paymentId: "pay_XYZ789", signature: "" }),
    ).toBe(false);
  });

  it("rejects non-string fields", () => {
    expect(
      validatePaymentIdsFormat({ orderId: 12345, paymentId: "pay_XYZ789", signature: "sig" }),
    ).toBe(false);
  });
});

describe("isOversizedRequest", () => {
  it("passes a normally-sized request", () => {
    expect(isOversizedRequest(200, 200, 4_096)).toBe(false);
  });

  it("flags an oversized declared Content-Length", () => {
    expect(isOversizedRequest(5_000, 200, 4_096)).toBe(true);
  });

  it("flags an oversized actual body regardless of the header", () => {
    expect(isOversizedRequest(0, 5_000, 4_096)).toBe(true);
  });
});

describe("verifyOrderOwnership", () => {
  it("authorizes when the order's noted employer matches the caller", () => {
    expect(verifyOrderOwnership({ notedEmployerId: "emp_1", matchId: "match_1", employerId: "emp_1" })).toBe(true);
  });

  it("rejects when the order belongs to a different employer", () => {
    expect(verifyOrderOwnership({ notedEmployerId: "emp_2", matchId: "match_1", employerId: "emp_1" })).toBe(false);
  });

  it("rejects when the order has no matchId in its notes", () => {
    expect(verifyOrderOwnership({ notedEmployerId: "emp_1", matchId: "", employerId: "emp_1" })).toBe(false);
  });
});

describe("isClosedAndLocked", () => {
  it("blocks a first unlock attempt on a closed requirement", () => {
    expect(isClosedAndLocked("closed", false)).toBe(true);
  });

  it("allows re-viewing an already-unlocked match even if the requirement later closed", () => {
    expect(isClosedAndLocked("closed", true)).toBe(false);
  });

  it("allows unlocking an open requirement", () => {
    expect(isClosedAndLocked("open", false)).toBe(false);
  });
});

describe("buildUnlockResponsePayload", () => {
  it("shapes the response from a full profile", () => {
    expect(
      buildUnlockResponsePayload({ matchId: "match_1", profile: { name: "Priya Sharma", email: "priya@example.com" } }),
    ).toEqual({ matchId: "match_1", unlocked: true, name: "Priya Sharma", contact: { email: "priya@example.com" } });
  });

  it("falls back to safe defaults when the profile is missing", () => {
    expect(buildUnlockResponsePayload({ matchId: "match_1", profile: undefined })).toEqual({
      matchId: "match_1",
      unlocked: true,
      name: "Candidate",
      contact: { email: "" },
    });
  });

  it("falls back per-field when name/email are null", () => {
    expect(
      buildUnlockResponsePayload({ matchId: "match_2", profile: { name: null, email: null } }),
    ).toEqual({ matchId: "match_2", unlocked: true, name: "Candidate", contact: { email: "" } });
  });
});
