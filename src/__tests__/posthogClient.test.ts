// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { serializeConsent } from "../consent";

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
    opt_out_capturing: vi.fn(),
    opt_in_capturing: vi.fn(),
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
    init: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
    opt_out_capturing: ReturnType<typeof vi.fn>;
    opt_in_capturing: ReturnType<typeof vi.fn>;
  };
  return { mod, ph };
}

function setConsent(choice: "accepted" | "rejected" | null) {
  localStorage.clear();
  if (choice) localStorage.setItem("hirestepx_cookie_consent", serializeConsent(choice));
}

beforeEach(() => {
  vi.clearAllMocks();
  setConsent("accepted");
});

describe("posthogClient buffering + initial pageview (consented)", () => {
  it("buffers events fired before init and flushes them after init, with one $pageview first", async () => {
    const { mod, ph } = await freshModule();

    mod.captureClientEvent("dashboard_loaded", { tier: "free" });
    expect(ph.capture).not.toHaveBeenCalled();

    await mod.initPostHog();

    const events = ph.capture.mock.calls.map((c) => c[0]);
    expect(events.filter((e) => e === "$pageview")).toHaveLength(1);
    expect(events[0]).toBe("$pageview");
    expect(events).toContain("dashboard_loaded");
    const dash = ph.capture.mock.calls.find((c) => c[0] === "dashboard_loaded");
    expect(dash?.[1]).toEqual({ tier: "free" });
  });

  it("captures at most one initial $pageview even across repeated init calls", async () => {
    const { mod, ph } = await freshModule();
    await mod.initPostHog();
    await mod.initPostHog();
    expect(ph.capture.mock.calls.filter((c) => c[0] === "$pageview")).toHaveLength(1);
  });

  it("captures straight through once initialized", async () => {
    const { mod, ph } = await freshModule();
    await mod.initPostHog();
    ph.capture.mockClear();
    mod.captureClientEvent("user_logged_in", { method: "email" });
    expect(ph.capture).toHaveBeenCalledWith("user_logged_in", { method: "email" });
  });

  it("no-ops without a key and never throws", async () => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const mod = await import("../posthogClient");
    expect(() => mod.captureClientEvent("x")).not.toThrow();
    await expect(mod.initPostHog()).resolves.toBeNull();
  });

  it("initialises with autocapture, session recording and heatmaps off and text masked", async () => {
    const { mod, ph } = await freshModule();
    await mod.initPostHog();
    const cfg = ph.init.mock.calls[0][1];
    expect(cfg).toMatchObject({
      autocapture: false,
      disable_session_recording: true,
      enable_heatmaps: false,
      mask_all_text: true,
      mask_all_element_attributes: true,
      persistence: "localStorage+cookie",
    });
  });
});

describe("posthogClient consent gating", () => {
  it("does not init or capture anything without consent", async () => {
    setConsent(null);
    const { mod, ph } = await freshModule();
    mod.captureClientEvent("cookie_consent_shown");
    await expect(mod.initPostHog()).resolves.toBeNull();
    expect(ph.init).not.toHaveBeenCalled();
    expect(ph.capture).not.toHaveBeenCalled();
  });

  it("does not init after the visitor chose essential only", async () => {
    setConsent("rejected");
    const { mod, ph } = await freshModule();
    await expect(mod.initPostHog()).resolves.toBeNull();
    expect(ph.init).not.toHaveBeenCalled();
  });

  it("drops (never retroactively sends) events captured before consent", async () => {
    setConsent(null);
    const { mod, ph } = await freshModule();
    mod.captureClientEvent("pre_consent_event");
    setConsent("accepted");
    await mod.initPostHog();
    expect(ph.capture.mock.calls.map((c) => c[0])).not.toContain("pre_consent_event");
  });

  it("withdrawal opts out and resets; re-accepting resumes without re-init", async () => {
    const { mod, ph } = await freshModule();
    await mod.initPostHog();
    mod.shutdownPostHog();
    expect(ph.opt_out_capturing).toHaveBeenCalled();
    expect(ph.reset).toHaveBeenCalled();
    ph.capture.mockClear();
    mod.captureClientEvent("after_withdraw");
    setConsent("rejected");
    expect(ph.capture).not.toHaveBeenCalled();

    setConsent("accepted");
    await mod.initPostHog();
    expect(ph.init).toHaveBeenCalledTimes(1);
    expect(ph.opt_in_capturing).toHaveBeenCalled();
  });
});

/* The founder/dogfooding account holds 154 of 199 sessions ever created
 * (production audit, 2026-09) and skews every funnel unless dashboards
 * exclude it. Tagging it as a person property is cheaper than trusting every
 * future PostHog view to remember a hardcoded id filter. */
describe("identifyClient", () => {
  it("tags the known founder/dogfooding account id as internal", async () => {
    const { mod, ph } = await freshModule();
    await mod.initPostHog();
    mod.identifyClient("00b0c97d-ecbc-480d-a43a-5dee38f7c290", { signup_method: "google" });
    expect(ph.identify).toHaveBeenCalledWith(
      "00b0c97d-ecbc-480d-a43a-5dee38f7c290",
      expect.objectContaining({ signup_method: "google", is_internal_test_account: true }),
    );
  });

  it("tags every other user id as not internal", async () => {
    const { mod, ph } = await freshModule();
    await mod.initPostHog();
    mod.identifyClient("some-real-user-id");
    expect(ph.identify).toHaveBeenCalledWith(
      "some-real-user-id",
      expect.objectContaining({ is_internal_test_account: false }),
    );
  });

  it("never forwards email / name / phone as person properties", async () => {
    const { mod, ph } = await freshModule();
    await mod.initPostHog();
    mod.identifyClient("u1", { email: "user@example.com", name: "Asha", $email: "x@y.z", signup_method: "email" });
    const props = ph.identify.mock.calls[0][1];
    expect(props).not.toHaveProperty("email");
    expect(props).not.toHaveProperty("name");
    expect(props).not.toHaveProperty("$email");
    expect(props).toMatchObject({ signup_method: "email" });
  });

  it("does not identify before consent; applies the queued id once consent + init happen", async () => {
    setConsent(null);
    const { mod, ph } = await freshModule();
    mod.identifyClient("u-late", { email: "late@example.com" });
    expect(ph.identify).not.toHaveBeenCalled();
    setConsent("accepted");
    await mod.initPostHog();
    expect(ph.identify).toHaveBeenCalledTimes(1);
    expect(ph.identify.mock.calls[0][0]).toBe("u-late");
    expect(ph.identify.mock.calls[0][1]).not.toHaveProperty("email");
  });

  it("never throws even if the underlying SDK call fails", async () => {
    const { mod, ph } = await freshModule();
    await mod.initPostHog();
    ph.identify.mockImplementationOnce(() => { throw new Error("boom"); });
    expect(() => mod.identifyClient("x")).not.toThrow();
  });
});
