/* HireStepX — Auth / Analytics
   Typed event helpers for auth funnel tracking.
   Wraps PostHog so the canvas doesn't have a hard dependency — calls
   are no-ops in environments where PostHog isn't loaded (Storybook,
   Tempo canvas runtime). Production wires to the real client. */

export type AuthMethod = "google" | "email" | "phone" | "passkey" | "magic-link";

export type AuthEvent =
  | { type: "login_viewed"; variant?: string; referrer?: string }
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

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, props?: Record<string, unknown>) => void;
    };
  }
}

/** Fire an auth event. Safe to call before PostHog is initialized. */
export function trackAuth(event: AuthEvent): void {
  if (typeof window === "undefined") return;
  const ph = window.posthog;
  if (!ph?.capture) return;

  const { type, ...props } = event;
  try {
    ph.capture(type, props);
  } catch {
    // Swallow — analytics must never break the auth flow.
  }
}

/** Build a viewed-event payload from the current document. */
export function loginViewedEvent(variant?: string): AuthEvent {
  return {
    type: "login_viewed",
    variant,
    referrer:
      typeof document !== "undefined" ? document.referrer || undefined : undefined,
  };
}
