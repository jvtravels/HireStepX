/* Client-side PostHog wrapper — consent-gated.
 *
 * Nothing is initialised, captured, identified or stored until the visitor
 * allows analytics in the cookie banner (hasConsentFor("analytics")):
 *   - initPostHog() refuses to run without consent, so there is no cookieless
 *     "anonymous pageview" mode any more;
 *   - captureClientEvent() drops events when there is no consent (it only
 *     buffers during the async SDK import of an already-consented visitor);
 *   - identifyClient() queues the user id in memory and applies it on init;
 *     it never forwards email/name/phone (user id only);
 *   - withdrawing consent calls shutdownPostHog(): opt-out + reset.
 * Autocapture, session recording, heatmaps and dead-click capture are off and
 * all text/attributes are masked defensively. Exception capture is on, but
 * only ever runs post-consent because init does.
 * - Uses NEXT_PUBLIC_POSTHOG_KEY + NEXT_PUBLIC_POSTHOG_HOST.
 * - Never throws — analytics must not break the UI.
 */

import type { PostHog } from "posthog-js";
import { hasConsentFor } from "./consent";
import { clearGa4User, forwardToGa4, setGa4User } from "./ga4Events";

/** Active (consented) instance; null before consent, while loading, or after withdrawal. */
let _instance: PostHog | null = null;
/** The loaded SDK singleton; survives a withdraw -> re-accept cycle. */
let _sdk: PostHog | null = null;
let _initPromise: Promise<PostHog | null> | null = null;

/**
 * Events captured before the SDK finished its async import + init are queued
 * here and flushed on ready, but ONLY for visitors who already consented.
 * Bounded so a missing key (SDK never inits) can't grow it without limit.
 */
type PendingEvent = { event: string; properties: Props };
const _pending: PendingEvent[] = [];
const MAX_PENDING = 100;
let _pageviewCaptured = false;
let _queuedIdentity: { id: string; properties: Props } | null = null;

function hasConsent(): boolean {
  return hasConsentFor("analytics");
}

/** person properties we never forward, even if a caller passes them. */
const FORBIDDEN_PERSON_PROPS = new Set(["email", "$email", "name", "$name", "phone", "$phone", "full_name", "first_name", "last_name"]);

export function sanitizePersonProps(properties: Props): Props {
  const out: Props = {};
  for (const [k, v] of Object.entries(properties)) {
    if (!FORBIDDEN_PERSON_PROPS.has(k.toLowerCase())) out[k] = v;
  }
  return out;
}

/**
 * Flush the pre-init buffer, apply any queued identity and capture the one
 * initial `$pageview` (`capture_pageview: "history_change"` only fires on SPA
 * route changes, not the first load). Idempotent.
 */
function flushPending(ph: PostHog): void {
  try {
    if (_queuedIdentity) {
      const { id, properties } = _queuedIdentity;
      _queuedIdentity = null;
      ph.identify(id, {
        ...properties,
        is_internal_test_account: INTERNAL_TEST_USER_IDS.has(id),
      });
    }
    if (!_pageviewCaptured) {
      _pageviewCaptured = true;
      ph.capture("$pageview");
    }
    while (_pending.length > 0) {
      const item = _pending.shift();
      if (item) ph.capture(item.event, item.properties);
    }
  } catch {
    /* never throw from telemetry */
  }
}

export function isPostHogReady(): boolean {
  return _instance !== null;
}

/** Remote flag value, or undefined when PostHog isn't loaded/consented or the flag isn't defined there. */
export function getClientFeatureFlag(key: string): boolean | undefined {
  try {
    return _instance?.isFeatureEnabled(key, { send_event: false });
  } catch {
    return undefined;
  }
}

/** Withdraw: stop capturing, drop the identity and any buffered events. */
export function shutdownPostHog(): void {
  try {
    _pending.length = 0;
    _queuedIdentity = null;
    _pageviewCaptured = false;
    if (_sdk) {
      _sdk.opt_out_capturing();
      _sdk.reset();
    }
  } catch {
    /* never throw from telemetry */
  }
  _instance = null;
}

export async function initPostHog(): Promise<PostHog | null> {
  if (typeof window === "undefined") return null;
  // Defence in depth: even if a caller forgets to gate, no consent = no SDK.
  if (!hasConsent()) return null;
  if (_instance) return _instance;
  if (_sdk) {
    // Re-accepted after a withdrawal: the SDK is already loaded.
    try { _sdk.opt_in_capturing({ captureEventName: false }); } catch { /* noop */ }
    _instance = _sdk;
    flushPending(_sdk);
    return _sdk;
  }
  if (_initPromise) return _initPromise;

  const key = (process.env.NEXT_PUBLIC_POSTHOG_KEY || "").trim();
  if (!key) {
    // Silent no-op in production by design, but a missing key means ZERO
    // events reach PostHog — warn on non-production builds so a misconfigured
    // preview/local env is caught before it ships.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[posthog] NEXT_PUBLIC_POSTHOG_KEY is not set — analytics disabled, no events will be captured.",
      );
    }
    return null;
  }

  _initPromise = (async () => {
    try {
      const mod = await import("posthog-js");
      const ph = mod.default;
      ph.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: "history_change",
        capture_exceptions: true,
        person_profiles: "identified_only",
        persistence: "localStorage+cookie",
        autocapture: false,
        capture_dead_clicks: false,
        enable_heatmaps: false,
        disable_session_recording: true,
        mask_all_text: true,
        mask_all_element_attributes: true,
        loaded: () => {
          _sdk = ph;
          if (hasConsent()) { _instance = ph; flushPending(ph); }
        },
      });
      ph.register({ release: process.env.NEXT_PUBLIC_RELEASE || "dev" });
      _sdk = ph;
      if (hasConsent()) {
        _instance = ph;
        flushPending(ph);
      } else {
        // Consent was withdrawn while the SDK was loading.
        shutdownPostHog();
      }
      return _instance;
    } catch {
      return null;
    } finally {
      _initPromise = null;
    }
  })();

  return _initPromise;
}

/* Founder/dogfooding account(s) that generate disproportionate real traffic
   and skew every funnel/cohort view unless explicitly excluded (production
   audit, 2026-09: this one account held 154 of 199 sessions ever created).
   Tagged as a person property in identifyClient() below so any PostHog
   insight/dashboard can filter `is_internal_test_account != true`. */
const INTERNAL_TEST_USER_IDS = new Set<string>([
  "00b0c97d-ecbc-480d-a43a-5dee38f7c290",
]);

type Props = Record<string, string | number | boolean | null | undefined>;

export function isInternalTestUser(userId: string): boolean {
  return INTERNAL_TEST_USER_IDS.has(userId);
}

export function captureClientEvent(event: string, properties: Props = {}): void {
  forwardToGa4(event, properties);
  try {
    if (_instance) {
      _instance.capture(event, properties);
      return;
    }
    // Not ready yet — buffer so events fired during the async-init race (an
    // early dashboard_loaded) aren't lost, but only for visitors who already
    // opted in: without consent the event is dropped, never held for later.
    if (hasConsent() && _pending.length < MAX_PENDING) _pending.push({ event, properties });
  } catch {
    /* never throw from telemetry */
  }
}

/** Identify by user id only. Email/name are stripped from `properties`.
 *  Before consent (or before the SDK is up) the id is held in memory and
 *  applied when PostHog initialises; nothing is sent without consent. */
export function identifyClient(distinctId: string, properties: Props = {}): void {
  try {
    const safe = sanitizePersonProps(properties);
    setGa4User(distinctId, INTERNAL_TEST_USER_IDS.has(distinctId));
    if (!hasConsent()) { _queuedIdentity = { id: distinctId, properties: safe }; return; }
    if (!_instance) { _queuedIdentity = { id: distinctId, properties: safe }; return; }
    _instance.identify(distinctId, {
      ...safe,
      is_internal_test_account: INTERNAL_TEST_USER_IDS.has(distinctId),
    });
  } catch {
    /* never throw from telemetry */
  }
}

export function resetClient(): void {
  try {
    _queuedIdentity = null;
    clearGa4User();
    _instance?.reset();
  } catch {
    /* never throw from telemetry */
  }
}

export function getDistinctId(): string | undefined {
  try {
    return _instance?.get_distinct_id();
  } catch {
    return undefined;
  }
}

export function getSessionId(): string | undefined {
  try {
    return _instance?.get_session_id?.();
  } catch {
    return undefined;
  }
}
