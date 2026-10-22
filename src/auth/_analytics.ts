/* HireStepX — Auth / Analytics
   Typed event helpers for auth funnel tracking.
   Wraps PostHog so the canvas doesn't have a hard dependency — calls
   are no-ops in environments where PostHog isn't loaded (Storybook,
   Tempo canvas runtime). Production wires to the real client via
   posthogClient.captureClientEvent. */

import { captureClientEvent } from "../posthogClient";

export type AuthMethod = "google" | "email" | "phone" | "passkey" | "magic-link";

export type AuthEvent =
  | {
      type: "login_viewed";
      variant?: string;
      referrer?: string;
      source?: string;
      company?: string;
      role?: string;
      focus?: string;
    }
  | { type: "login_method_selected"; method: AuthMethod }
  | { type: "login_field_focused"; field: "email" | "password" }
  | { type: "login_password_visibility_toggled"; visible: boolean }
  | { type: "login_submitted"; method: AuthMethod }
  | { type: "login_succeeded"; method: AuthMethod; timeMs: number }
  | {
      type: "login_failed";
      method: AuthMethod;
      reason: "invalid_credentials" | "rate_limited" | "network" | "unknown";
    }
  | { type: "login_signup_clicked" }
  | { type: "login_forgot_password_clicked" };

/** Fire an auth event. Safe to call before PostHog is initialized —
 *  posthogClient internally no-ops until init() completes. */
export function trackAuth(event: AuthEvent): void {
  if (typeof window === "undefined") return;
  const { type, ...props } = event;
  // PostHog's typed Props only allows scalar values; AuthEvent props
  // are already strings/numbers/booleans/undefined so this is safe.
  const safe: Record<string, string | number | boolean | null | undefined> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      safe[k] = v;
    }
  }
  captureClientEvent(type, safe);
}

/** Build a viewed-event payload from the current document.
 *  `sourceParams` carries the SEO-page attribution (?source=&company=&role=&focus=)
 *  so the funnel from a specific landing page through to signup is traceable. */
export function loginViewedEvent(
  variant?: string,
  sourceParams?: { source?: string; company?: string; role?: string; focus?: string },
): AuthEvent {
  return {
    type: "login_viewed",
    variant,
    referrer:
      typeof document !== "undefined" ? document.referrer || undefined : undefined,
    ...sourceParams,
  };
}
