/* HireStepX — Auth / Shared shell
   Helpers shared between Login, Signup, ForgotPassword.
   Keeps the per-screen components focused on composition + state. */

import { useCallback, useEffect, useRef } from "react";

/* ─── Error mapping ─── */

/** Map Supabase auth errors to user-facing copy. Keep messages short
    and actionable; never leak which field was wrong (security). */
export function mapAuthError(raw: string | undefined): string {
  if (!raw) return "Something went wrong. Try again.";
  const msg = raw.toLowerCase();
  if (
    msg.includes("invalid login credentials") ||
    msg.includes("invalid_credentials")
  ) {
    return "Email or password is incorrect. Try again, or reset your password.";
  }
  // Note: AuthContext.signup() now intercepts the "already exists"
  // case BEFORE we reach this mapper (both the fake-success path and
  // the explicit-error path), returns success, and triggers a
  // separate "you already have an account" email. The branch below is
  // a safety net for legacy / OAuth pathways. Reworded to focus on
  // the most common cause — pending verification — and offer the
  // sign-in path explicitly.
  if (
    msg.includes("already registered") ||
    msg.includes("already exists") ||
    msg.includes("user already")
  ) {
    return "This email is already in our system. Check your inbox for a pending verification link, or sign in instead.";
  }
  if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
    return "Your email isn't verified yet. Check your inbox for the verification link, or use \"Forgot password\" to resend it.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Too many attempts. Try again in a few minutes.";
  }
  if (msg.includes("network") || msg.includes("failed to fetch")) {
    return "Couldn't reach our servers. Check your connection and try again.";
  }
  return raw;
}

/* ─── isMounted ref — prevents setState-after-unmount on async submits ─── */

export function useIsMounted(): React.MutableRefObject<boolean> {
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  return isMounted;
}

/* ─── Reset-in-progress flag ─── */

/* When the user is mid-reset-flow in another tab, that tab briefly
   establishes a recovery session that propagates across tabs via
   localStorage. Without this flag, Login/Signup tabs see isLoggedIn
   flip to true and yank the user to /dashboard with a stale session
   that the reset flow's signOut is about to invalidate.

   /reset-password sets this flag on mount and clears it on unmount;
   Login + Signup check it before honoring their auto-redirect. */

const RESET_IN_PROGRESS_KEY = "hsx_reset_in_progress";

export function setResetInProgress(value: boolean) {
  try {
    if (value) {
      localStorage.setItem(RESET_IN_PROGRESS_KEY, String(Date.now()));
    } else {
      localStorage.removeItem(RESET_IN_PROGRESS_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function isResetInProgress(): boolean {
  try {
    const raw = localStorage.getItem(RESET_IN_PROGRESS_KEY);
    if (!raw) return false;
    // Stale flags expire after 10 min so a crashed reset tab doesn't
    // trap auth tabs forever.
    const stamped = parseInt(raw, 10);
    if (Number.isNaN(stamped) || Date.now() - stamped > 10 * 60 * 1000) {
      localStorage.removeItem(RESET_IN_PROGRESS_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/* ─── "Stay signed in" — real session-lifetime control ───
   Supabase sessions live in localStorage by default and persist
   indefinitely until the refresh token expires. We layer a client-
   enforced TTL on top: the user's "Stay signed in" preference at
   login dictates how long the session is allowed to live before we
   force-sign-them-out, regardless of Supabase token state. */

const STAY_SIGNED_IN_PREF = "hsx_stay_signed_in";
const SESSION_STARTED_AT = "hsx_session_started_at";

const STAY_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const NO_STAY_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export function readStaySignedInPref(): boolean {
  try {
    return localStorage.getItem(STAY_SIGNED_IN_PREF) === "1";
  } catch {
    return false;
  }
}

export function writeStaySignedInPref(value: boolean) {
  try {
    localStorage.setItem(STAY_SIGNED_IN_PREF, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Call right before a successful login completes — records the
    session-start timestamp + the user's stay-signed-in preference so
    AuthContext can enforce expiry on subsequent mounts. */
export function markSessionStart(staySignedIn: boolean) {
  try {
    writeStaySignedInPref(staySignedIn);
    localStorage.setItem(SESSION_STARTED_AT, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function clearSessionStart() {
  try {
    localStorage.removeItem(SESSION_STARTED_AT);
  } catch {
    /* ignore */
  }
}

/** Returns true if the current session has aged past the "Stay signed
    in" preference's TTL and should be forcibly signed out.
    Returns false if no start timestamp is recorded (treats as fresh). */
export function isSessionExpiredByPreference(): boolean {
  try {
    const startRaw = localStorage.getItem(SESSION_STARTED_AT);
    if (!startRaw) return false;
    const start = parseInt(startRaw, 10);
    if (Number.isNaN(start)) return false;
    const stay = readStaySignedInPref();
    const ttl = stay ? STAY_DURATION_MS : NO_STAY_DURATION_MS;
    return Date.now() - start > ttl;
  } catch {
    return false;
  }
}

/* ─── Build a /signup or /login link that preserves both
       plan + next params (Login → Signup, Signup → Login). ─── */

export function buildAuthLink(
  basePath: "/login" | "/signup",
  searchParams: URLSearchParams | { get(k: string): string | null } | null,
): string {
  if (!searchParams) return basePath;
  const plan = searchParams.get("plan");
  const next = searchParams.get("next");
  const qs = new URLSearchParams();
  if (plan) qs.set("plan", plan);
  if (next && next.startsWith("/")) qs.set("next", next);
  const search = qs.toString();
  return search ? `${basePath}?${search}` : basePath;
}

/* ─── Compute the post-auth redirect destination ─── */

export interface ComputeRedirectArgs {
  /** The `next=` query param (may be null) */
  next: string | null;
  /** The `plan=` query param (may be null) */
  plan: string | null;
  /** Whether the user has finished onboarding */
  hasCompletedOnboarding: boolean;
}

export function computeAuthRedirect({
  next,
  plan,
  hasCompletedOnboarding,
}: ComputeRedirectArgs): string {
  if (next && next.startsWith("/")) return next;
  const base = hasCompletedOnboarding ? "/dashboard" : "/onboarding";
  return plan ? `${base}?plan=${plan}` : base;
}

/* ─── Email typo detection (Levenshtein-1 against common domains) ─── */

const COMMON_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "yahoo.co.in",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "protonmail.com",
  "rediffmail.com",
  "live.com",
  "me.com",
];

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }
  return dp[m]![n]!;
}

/** Suggest a corrected email if the domain is within edit-distance 1 or 2
    of a known common domain. Returns null if no suggestion. */
export function suggestEmailCorrection(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 0) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain || COMMON_DOMAINS.includes(domain)) return null;

  for (const d of COMMON_DOMAINS) {
    const dist = levenshtein(domain, d);
    if (dist > 0 && dist <= 2) {
      return `${local}@${d}`;
    }
  }
  return null;
}

/* ─── Webmail provider detection ─── */

export interface EmailProvider {
  name: string;
  url: string;
}

/** Detect the user's webmail provider from their email domain so we
    can deep-link them to the right inbox tab after a verification email
    is sent. Returns null for unsupported / corporate domains. */
export function detectEmailProvider(email: string): EmailProvider | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).toLowerCase();
  if (domain.includes("gmail") || domain.includes("googlemail")) {
    return { name: "Gmail", url: "https://mail.google.com" };
  }
  if (
    domain.includes("outlook") ||
    domain.includes("hotmail") ||
    domain.includes("live")
  ) {
    return { name: "Outlook", url: "https://outlook.live.com" };
  }
  if (domain.includes("yahoo")) {
    return { name: "Yahoo", url: "https://mail.yahoo.com" };
  }
  if (domain.includes("proton")) {
    return { name: "Proton", url: "https://mail.proton.me" };
  }
  if (domain.includes("icloud") || domain.includes("me.com")) {
    return { name: "iCloud", url: "https://www.icloud.com/mail" };
  }
  if (domain.includes("rediffmail")) {
    return { name: "Rediffmail", url: "https://mail.rediff.com" };
  }
  return null;
}

/* ─── Async-safe setter helper ─── */

export function useSafeAsync<T extends (...args: never[]) => Promise<unknown>>(
  fn: T,
  isMounted: React.MutableRefObject<boolean>,
): T {
  return useCallback(
    (async (...args: Parameters<T>) => {
      const result = await fn(...args);
      if (!isMounted.current) return undefined as never;
      return result;
    }) as T,
    [fn, isMounted],
  );
}
