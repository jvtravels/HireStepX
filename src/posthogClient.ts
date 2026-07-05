/* Client-side PostHog wrapper.
 *
 * - Initialized lazily in TWO stages (see ConsentGatedAnalytics.tsx):
 *     1. Pre-consent: `persistence: "memory"` — cookieless, anonymous
 *        pageviews. No cookie or localStorage id is written, so this is
 *        GDPR-safe without prior consent (de-identified traffic counting).
 *     2. On cookie accept: `upgradePostHogPersistence()` flips persistence to
 *        "localStorage+cookie" so the visitor becomes a stable, identifiable
 *        person for funnels and retention.
 * - Uses environment vars NEXT_PUBLIC_POSTHOG_KEY + NEXT_PUBLIC_POSTHOG_HOST.
 * - Never throws — analytics must not break the UI.
 * - Exposes capture/identify/reset/getDistinctId/getSessionId helpers used by
 *   AuthContext, signup, interview, and onboarding flows.
 */

import type { PostHog } from "posthog-js";

/** Cookieless (pre-consent) vs persistent (post-consent). */
export type PostHogPersistence = "memory" | "localStorage+cookie";

let _instance: PostHog | null = null;
let _initPromise: Promise<PostHog | null> | null = null;

export function isPostHogReady(): boolean {
  return _instance !== null;
}

/**
 * Upgrade an already-initialized instance from cookieless (memory) to
 * persistent storage after the user accepts cookies. No-op if PostHog never
 * initialized (missing key). Safe to call repeatedly.
 */
export function upgradePostHogPersistence(): void {
  try {
    _instance?.set_config({ persistence: "localStorage+cookie" });
  } catch {
    /* never throw from telemetry */
  }
}

export async function initPostHog(
  persistence: PostHogPersistence = "localStorage+cookie",
): Promise<PostHog | null> {
  if (typeof window === "undefined") return null;
  if (_instance) return _instance;
  if (_initPromise) return _initPromise;

  const key = (process.env.NEXT_PUBLIC_POSTHOG_KEY || "").trim();
  if (!key) {
    // Silent no-op in production by design (analytics must never break the
    // UI), but a missing key means ZERO events reach PostHog — an entirely
    // invisible failure unless surfaced. Warn on non-production builds so a
    // misconfigured preview/local env is caught before it ships. If you see
    // this in a deployed environment, NEXT_PUBLIC_POSTHOG_KEY is unset in
    // that Vercel environment's variables.
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
        // "memory" pre-consent → no cookie/localStorage id written, so
        // anonymous pageviews are captured without needing consent. Upgraded
        // to "localStorage+cookie" via upgradePostHogPersistence() on accept.
        persistence,
        loaded: () => {
          _instance = ph;
        },
      });
      _instance = ph;
      return ph;
    } catch {
      return null;
    }
  })();

  return _initPromise;
}

type Props = Record<string, string | number | boolean | null | undefined>;

export function captureClientEvent(event: string, properties: Props = {}): void {
  try {
    _instance?.capture(event, properties);
  } catch {
    /* never throw from telemetry */
  }
}

export function identifyClient(distinctId: string, properties: Props = {}): void {
  try {
    _instance?.identify(distinctId, properties);
  } catch {
    /* never throw from telemetry */
  }
}

export function resetClient(): void {
  try {
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
