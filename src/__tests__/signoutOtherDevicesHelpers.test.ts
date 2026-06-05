import { describe, it, expect } from "vitest";
import {
  validateSignoutBody,
  buildMetadataPatch,
} from "../../server-handlers/_signout-other-devices-helpers";

describe("validateSignoutBody", () => {
  it("rejects missing deviceToken", () => {
    expect(validateSignoutBody({})).toEqual({ ok: false, error: "Missing deviceToken" });
    expect(validateSignoutBody({ deviceToken: "" })).toEqual({ ok: false, error: "Missing deviceToken" });
  });

  it("rejects non-string deviceToken (scripted-abuse defence)", () => {
    expect(validateSignoutBody({ deviceToken: 42 })).toEqual({ ok: false, error: "Missing deviceToken" });
    expect(validateSignoutBody({ deviceToken: { id: "x" } })).toEqual({ ok: false, error: "Missing deviceToken" });
  });

  it("accepts a valid deviceToken with optional userAgent", () => {
    expect(validateSignoutBody({ deviceToken: "abc123" })).toEqual({
      ok: true,
      value: { deviceToken: "abc123", userAgent: "" },
    });
    expect(validateSignoutBody({ deviceToken: "abc123", userAgent: "Chrome/macOS" })).toEqual({
      ok: true,
      value: { deviceToken: "abc123", userAgent: "Chrome/macOS" },
    });
  });

  it("truncates deviceToken and userAgent to 200 chars", () => {
    const long = "x".repeat(500);
    const r = validateSignoutBody({ deviceToken: long, userAgent: long });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.deviceToken).toHaveLength(200);
      expect(r.value.userAgent).toHaveLength(200);
    }
  });

  it("drops a non-string userAgent silently rather than erroring", () => {
    // userAgent is decorative — wrong type shouldn't fail the request.
    const r = validateSignoutBody({ deviceToken: "abc", userAgent: 99 });
    expect(r).toEqual({ ok: true, value: { deviceToken: "abc", userAgent: "" } });
  });
});

describe("buildMetadataPatch", () => {
  it("pins recent_devices to a single entry containing only the caller's device", () => {
    const patch = buildMetadataPatch({ deviceToken: "tok-1", userAgent: "Chrome" }, 1_700_000_000_000);
    expect(patch).toEqual({
      user_metadata: {
        active_device_token: "tok-1",
        recent_devices: [{ id: "tok-1", ua: "Chrome", at: 1_700_000_000_000 }],
      },
    });
  });

  it("uses the injected timestamp (no Date.now() in helpers, so tests stay deterministic)", () => {
    const a = buildMetadataPatch({ deviceToken: "t", userAgent: "" }, 1);
    const b = buildMetadataPatch({ deviceToken: "t", userAgent: "" }, 2);
    expect(a.user_metadata.recent_devices[0].at).toBe(1);
    expect(b.user_metadata.recent_devices[0].at).toBe(2);
  });
});
