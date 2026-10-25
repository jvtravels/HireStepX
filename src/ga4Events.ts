/* GA4 bridge for the app's product events.
 *
 * captureClientEvent() (posthogClient.ts) is the single choke point every
 * product event already passes through, so GA4 is fed from there instead of
 * sprinkling gtag calls across the app. Only events in GA4_EVENT_MAP are
 * forwarded: GA4 caps a property at 500 distinct event names and charges
 * nothing for PostHog-only diagnostics, so timing/error/provider noise stays
 * out. Consent is the same "analytics" gate as every other tool: without it
 * nothing is sent or held. */

import { hasConsentFor } from "./consent";
import { isGtagReady, sendGtagEvent, setGtagFields, setGtagUserProperties } from "./_browser-api-guards";

type Props = Record<string, string | number | boolean | null | undefined>;
type Ga4Params = Record<string, string | number | boolean>;

/** PostHog event name → GA4 event name. Recommended GA4 names (login, share)
 *  are used where one exists so Google's built-in reports light up. */
const GA4_EVENT_MAP: Readonly<Record<string, string>> = {
  // Acquisition → activation
  hero_cta_clicked: "cta_click",
  pricing_page_viewed: "pricing_viewed",
  signup_started: "signup_started",
  user_logged_in: "login",
  onboarding_step_viewed: "onboarding_step_viewed",
  onboarding_completed: "onboarding_completed",
  resume_upload_started: "resume_upload_started",
  resume_upload_completed: "resume_uploaded",
  resume_upload_failed: "resume_upload_failed",
  dashboard_start_clicked: "dashboard_start_clicked",
  interview_abandoned: "interview_abandoned",
  report_viewed: "report_viewed",
  // Monetisation (purchase, begin checkout, paywall and sign_up are sent
  // directly at their call sites with ecommerce params, so they are not mapped)
  purchase_started: "pricing_cta_click",
  payment_failed: "payment_failed",
  subscription_cancelled: "subscription_cancelled",
  // Referral / growth loop
  referral_invite_sent: "share",
  referral_signup: "referral_signup",
  blog_post_view: "blog_post_view",
  // Employer funnel
  employer_company_created: "employer_company_created",
  employer_requirement_created: "employer_requirement_created",
  employer_unlock_started: "employer_unlock_started",
  employer_unlock_completed: "employer_unlock_completed",
  employer_unlock_limit_hit: "employer_unlock_limit_hit",
};

const DROP_PARAMS = new Set([
  "email", "name", "phone", "full_name", "first_name", "last_name", "password", "token",
  // user_id/session_id are set once via gtag 'set' / GA's own session; per-event copies would be noise
  "user_id", "session_id",
]);
const COST_PARAM = /(^|_)(cost|tts|stt)(_|$)/;

function snake(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

export function sanitizeGa4Params(props: Props): Ga4Params {
  const out: Ga4Params = {};
  let count = 0;
  for (const [rawKey, value] of Object.entries(props)) {
    if (count >= 20) break;
    const key = snake(rawKey);
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(key) || DROP_PARAMS.has(key) || COST_PARAM.test(key)) continue;
    if (typeof value === "string") out[key] = value.slice(0, 100);
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean") out[key] = value;
    else continue;
    count++;
  }
  return out;
}

export type PageType = "employer" | "candidate_app" | "auth" | "marketing";

export function pageTypeFor(pathname: string): PageType {
  if (pathname === "/employer" || pathname.startsWith("/employer/")) return "employer";
  if (/^\/(login|signup|reset-password|forgot-password|auth)(\/|$)/.test(pathname)) return "auth";
  if (/^\/(dashboard|interview|session|sessions|onboarding|analytics|resume|settings|calendar|messages|jobs)(\/|$)/.test(pathname)) return "candidate_app";
  return "marketing";
}

export function buildGa4Event(event: string, props: Props, pathname: string): { name: string; params: Ga4Params } | null {
  const name = GA4_EVENT_MAP[event];
  if (!name) return null;
  const params = sanitizeGa4Params(props);
  if (event === "referral_invite_sent") {
    if (typeof props.channel === "string") params.method = props.channel.slice(0, 100);
    params.content_type = "referral";
  }
  params.page_type = pageTypeFor(pathname);
  return { name, params };
}

/* Events fired before the lazy-loaded gtag stub exists (it is injected after
   idle) are held briefly for consented visitors; never for non-consented ones. */
const MAX_BUFFER = 50;
const buffer: Array<{ name: string; params: Ga4Params }> = [];
let queuedUser: { id: string; internal: boolean } | null = null;
let queuedProps: Ga4Params = {};

function currentPath(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

function applyUser(u: { id: string; internal: boolean }): void {
  setGtagFields({ user_id: u.id, ...(u.internal ? { traffic_type: "internal" } : {}) });
}

function applyProps(): void {
  if (Object.keys(queuedProps).length === 0) return;
  setGtagUserProperties(queuedProps);
  queuedProps = {};
}

export function flushGa4(): void {
  if (!isGtagReady() || !hasConsentFor("analytics")) return;
  if (queuedUser) {
    const u = queuedUser;
    queuedUser = null;
    applyUser(u);
  }
  applyProps();
  while (buffer.length > 0) {
    const item = buffer.shift();
    if (item) sendGtagEvent(item.name, item.params);
  }
}

export function discardGa4Buffer(): void {
  buffer.length = 0;
  queuedUser = null;
  queuedProps = {};
}

export function forwardToGa4(event: string, props: Props = {}): void {
  try {
    if (!hasConsentFor("analytics")) return;
    const built = buildGa4Event(event, props, currentPath());
    if (!built) return;
    if (isGtagReady()) {
      flushGa4();
      sendGtagEvent(built.name, built.params);
    } else if (buffer.length < MAX_BUFFER) {
      buffer.push(built);
    }
  } catch {
    /* never throw from telemetry */
  }
}

/** Ties GA4 sessions to the Supabase user id (never email/name) so signups
 *  and repeat usage de-duplicate across devices. internal=true tags the
 *  traffic for GA4's internal-traffic filter. */
export function setGa4User(id: string, internal = false): void {
  try {
    if (!hasConsentFor("analytics")) return;
    if (isGtagReady()) applyUser({ id, internal });
    else queuedUser = { id, internal };
  } catch {
    /* never throw from telemetry */
  }
}

/** User-scoped dimensions (plan tier, employer tier, ...). Values are
 *  sanitised like event params; later calls overwrite earlier keys. */
export function setGa4UserProperties(props: Props): void {
  try {
    if (!hasConsentFor("analytics")) return;
    queuedProps = { ...queuedProps, ...sanitizeGa4Params(props) };
    if (isGtagReady()) applyProps();
  } catch {
    /* never throw from telemetry */
  }
}

export function clearGa4User(): void {
  try {
    queuedUser = null;
    queuedProps = {};
    if (isGtagReady()) setGtagFields({ user_id: null, traffic_type: null });
  } catch {
    /* never throw from telemetry */
  }
}
