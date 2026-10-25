import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONSENT_KEY, serializeConsent } from "../consent";
import {
  buildGa4Event,
  clearGa4User,
  discardGa4Buffer,
  flushGa4,
  forwardToGa4,
  pageTypeFor,
  sanitizeGa4Params,
  setGa4User,
  setGa4UserProperties,
} from "../ga4Events";

type GtagWindow = Window & { gtag?: (...a: unknown[]) => void };
const win = () => window as GtagWindow;

function consent(analytics: boolean) {
  localStorage.setItem(CONSENT_KEY, serializeConsent({ analytics, advertising: false }));
}

describe("sanitizeGa4Params", () => {
  it("drops PII, identifiers and cost telemetry, converts camelCase, and caps value length", () => {
    const out = sanitizeGa4Params({
      email: "a@b.co", name: "Asha", user_id: "u1", tts_cost_inr_est: 4, stt_audio_seconds: 9,
      sessionLength: 15, plan: "x".repeat(300), skipped: null, bad: Number.NaN, ok: true,
    });
    expect(out).toEqual({ session_length: 15, plan: "x".repeat(100), ok: true });
  });

  it("keeps at most 20 params", () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(sanitizeGa4Params(many))).toHaveLength(20);
  });
});

describe("pageTypeFor", () => {
  it.each([
    ["/employer", "employer"], ["/employer/requirements/1", "employer"], ["/employers", "marketing"],
    ["/login", "auth"], ["/signup", "auth"], ["/dashboard", "candidate_app"], ["/interview", "candidate_app"],
    ["/", "marketing"], ["/pricing", "marketing"],
  ])("%s -> %s", (path, type) => expect(pageTypeFor(path)).toBe(type));
});

describe("buildGa4Event", () => {
  it("renames to the GA4 name and tags the page type", () => {
    expect(buildGa4Event("user_logged_in", { method: "email" }, "/login")).toEqual({
      name: "login", params: { method: "email", page_type: "auth" },
    });
  });

  it("maps referral invites onto the recommended share event", () => {
    expect(buildGa4Event("referral_invite_sent", { surface: "referrals_page", channel: "whatsapp" }, "/dashboard")?.params)
      .toMatchObject({ method: "whatsapp", content_type: "referral" });
  });

  it("ignores events that are PostHog-only or already sent directly with ecommerce params", () => {
    for (const e of ["employer_api_timing", "stt_provider_used", "payment_success", "user_signed_up", "checkout_opened", "paywall_shown"]) {
      expect(buildGa4Event(e, {}, "/")).toBeNull();
    }
  });
});

describe("forwarding", () => {
  let gtag: ReturnType<typeof vi.fn<(...a: unknown[]) => void>>;
  beforeEach(() => { localStorage.clear(); discardGa4Buffer(); delete win().gtag; gtag = vi.fn<(...a: unknown[]) => void>(); });
  afterEach(() => { delete win().gtag; localStorage.clear(); discardGa4Buffer(); });

  it("sends nothing and holds nothing without analytics consent", () => {
    consent(false);
    forwardToGa4("report_viewed", { score: 7 });
    win().gtag = gtag;
    flushGa4();
    expect(gtag).not.toHaveBeenCalled();
  });

  it("sends immediately once gtag exists", () => {
    consent(true);
    win().gtag = gtag;
    forwardToGa4("report_viewed", { score: 7 });
    expect(gtag).toHaveBeenCalledWith("event", "report_viewed", { score: 7, page_type: "marketing" });
  });

  it("buffers before gtag loads and flushes identity, properties, then events in order", () => {
    consent(true);
    forwardToGa4("signup_started", { account: "candidate" });
    setGa4User("user-1", true);
    setGa4UserProperties({ subscription_tier: "free" });
    expect(gtag).not.toHaveBeenCalled();
    win().gtag = gtag;
    flushGa4();
    expect(gtag.mock.calls).toEqual([
      ["set", { user_id: "user-1", traffic_type: "internal" }],
      ["set", "user_properties", { subscription_tier: "free" }],
      ["event", "signup_started", { account: "candidate", page_type: "marketing" }],
    ]);
  });

  it("drops buffered data when consent is withdrawn", () => {
    consent(true);
    forwardToGa4("signup_started");
    setGa4User("user-1");
    discardGa4Buffer();
    win().gtag = gtag;
    flushGa4();
    expect(gtag).not.toHaveBeenCalled();
  });

  it("clears the GA4 user id on logout", () => {
    consent(true);
    win().gtag = gtag;
    clearGa4User();
    expect(gtag).toHaveBeenCalledWith("set", { user_id: null, traffic_type: null });
  });
});
