// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

// A fresh posthog-js mock is produced on every module reset. `init` invokes the
// `loaded` callback synchronously so tests can assert post-init behaviour without
// awaiting a network round-trip.
vi.mock("posthog-js", () => {
  const ph = {
    init: vi.fn((_key: string, cfg: { loaded?: () => void }) => {
      cfg.loaded?.();
    }),
    capture: vi.fn(),
    set_config: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    get_distinct_id: vi.fn(() => "distinct-1"),
    get_session_id: vi.fn(() => "session-1"),
  };
  return { default: ph };
});

async function freshModule() {
  vi.resetModules();
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
  const mod = await import("../posthogClient");
  const ph = (await import("posthog-js")).default as unknown as {
    capture: ReturnType<typeof vi.fn>;
    identify: ReturnType<typeof vi.fn>;
  };
  return { mod, ph };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("posthogClient buffering + initial pageview", () => {
  it("buffers events fired before init and flushes them after init, with one $pageview first", async () => {
    const { mod, ph } = await freshModule();

    // Fired BEFORE init — must not be lost (the cookie-banner race).
    mod.captureClientEvent("cookie_consent_shown");
    mod.captureClientEvent("dashboard_loaded", { tier: "free" });
    expect(ph.capture).not.toHaveBeenCalled();

    await mod.initPostHog("memory");

    const events = ph.capture.mock.calls.map((c) => c[0]);
    // Exactly one initial pageview, and it precedes the flushed buffer.
    expect(events.filter((e) => e === "$pageview")).toHaveLength(1);
    expect(events[0]).toBe("$pageview");
    expect(events).toContain("cookie_consent_shown");
    expect(events).toContain("dashboard_loaded");
    const dash = ph.capture.mock.calls.find((c) => c[0] === "dashboard_loaded");
    expect(dash?.[1]).toEqual({ tier: "free" });
  });

  it("captures at most one initial $pageview even across repeated init calls", async () => {
    const { mod, ph } = await freshModule();
    await mod.initPostHog("memory");
    await mod.initPostHog("localStorage+cookie");
    expect(ph.capture.mock.calls.filter((c) => c[0] === "$pageview")).toHaveLength(1);
  });

  it("captures straight through once initialized", async () => {
    const { mod, ph } = await freshModule();
    await mod.initPostHog("localStorage+cookie");
    ph.capture.mockClear();
    mod.captureClientEvent("user_logged_in", { method: "email" });
    expect(ph.capture).toHaveBeenCalledWith("user_logged_in", { method: "email" });
  });

  it("no-ops without a key and never throws", async () => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const mod = await import("../posthogClient");
    expect(() => mod.captureClientEvent("x")).not.toThrow();
    await expect(mod.initPostHog("memory")).resolves.toBeNull();
  });
});

/* The founder/dogfooding account holds 154 of 199 sessions ever created
 * (production audit, 2026-09) and skews every funnel unless dashboards
 * exclude it. Tagging it as a person property is cheaper than trusting every
 * future PostHog view to remember a hardcoded id filter. */
describe("identifyClient — internal test account tagging", () => {
  it("tags the known founder/dogfooding account id as internal", async () => {
    const { mod, ph } = await freshModule();
    await mod.initPostHog("localStorage+cookie");
    mod.identifyClient("00b0c97d-ecbc-480d-a43a-5dee38f7c290", { email: "founder@example.com" });
    expect(ph.identify).toHaveBeenCalledWith(
      "00b0c97d-ecbc-480d-a43a-5dee38f7c290",
      expect.objectContaining({ email: "founder@example.com", is_internal_test_account: true }),
    );
  });

  it("tags every other user id as not internal", async () => {
    const { mod, ph } = await freshModule();
    await mod.initPostHog("localStorage+cookie");
    mod.identifyClient("some-real-user-id", { email: "user@example.com" });
    expect(ph.identify).toHaveBeenCalledWith(
      "some-real-user-id",
      expect.objectContaining({ email: "user@example.com", is_internal_test_account: false }),
    );
  });

  it("never throws even if the underlying SDK call fails", async () => {
    const { mod, ph } = await freshModule();
    await mod.initPostHog("localStorage+cookie");
    ph.identify.mockImplementationOnce(() => { throw new Error("boom"); });
    expect(() => mod.identifyClient("x")).not.toThrow();
  });
});
