"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  clearPendingConsent,
  storePendingConsent,
  storePendingEmployerProfile,
  storePendingNextTarget,
  storePendingReferralCode,
  useAuth,
} from "../AuthContext";
import { isPlausibleWebsite, WEBSITE_FORMAT_MESSAGE } from "../employer/_companyProfileHelpers";
import { emailDomain, isFreeMailDomain } from "../../server-handlers/_employer-trust";
import { PasswordChecklist, PasswordStrengthMeter } from "../auth/_fields";
import {
  checkPasswordBreached,
  isDisposableEmail,
  passwordHasEdgeWhitespace,
  sanitizeEmail,
  validateEmail,
  validateName,
  validatePassword,
  validateSignupPassword,
} from "../auth/_validation";
import { loginViewedEvent, trackAuth } from "../auth/_analytics";
import ResendVerification, { ResendStatus, resendButtonLabel, useResendVerification } from "../auth/ResendVerification";
import {
  computeAuthRedirect,
  detectEmailProvider,
  isResetInProgress,
  mapAuthError,
  markSessionStart,
  readStaySignedInPref,
  suggestEmailCorrection,
  UNVERIFIED_EMAIL_MESSAGE,
  useIsMounted,
} from "../auth/_shell";
import { Google } from "./Auth";

const PASSWORD_VISIBLE_TIMEOUT_MS = 10_000;
const LOCKOUT_STORAGE_KEY = "hirestepx_login_lockout";

function readLockoutSeconds(): number {
  try {
    const until = parseInt(localStorage.getItem(LOCKOUT_STORAGE_KEY) || "0", 10);
    if (until && Date.now() < until) return Math.ceil((until - Date.now()) / 1000);
  } catch {
    /* localStorage may be blocked */
  }
  return 0;
}

export const authFormsCss = `
.hx-au-inner > h1, .hx-au-inner > .hx-sub { text-align: center; }
.hx-au-inner > h1 { color: var(--ink); text-wrap: balance; }
.hx-au-inner > .hx-sub { margin-top: 12px; color: var(--ink-2); font-size: 16px !important; }
.hx-au-inner .hx-gbtn, .hx-au-inner .hx-btn { font-size: 15px !important; }
.hx-au-inner .hx-gbtn:disabled, .hx-au-inner .hx-btn:disabled { opacity: .5; cursor: not-allowed; }
.hx-au-inner .hx-in[aria-invalid="true"] { border-color: oklch(0.55 0.17 25); }
.hx-au-inner .hx-err { font-size: 13px !important; font-weight: 400; color: oklch(0.5 0.17 25); }
.hx-au-inner .hx-banner { margin-top: 20px; padding: 12px 14px; border-radius: 10px; font-size: 14px; line-height: 1.5; background: oklch(0.96 0.03 25); color: oklch(0.42 0.14 25); }
.hx-au-inner .hx-banner.ok { background: oklch(0.96 0.04 155); color: oklch(0.38 0.1 155); }
.hx-au-inner .hx-chk { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; font-weight: 400; color: var(--ink-2); cursor: pointer; }
.hx-au-inner .hx-chk input { width: 18px; height: 18px; margin: 1px 0 0; flex: none; accent-color: var(--btn); }
.hx-au-inner .hx-chk a { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
.hx-au-inner .hx-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.hx-au-inner .hx-row a { color: var(--btn); font-weight: 500; }
.hx-au-inner .hx-legal { margin-top: 18px; text-align: center; color: var(--ink-3); }
.hx-au-inner .hx-legal, .hx-au-inner .hx-legal a { font-size: 13px !important; }
.hx-au-inner .hx-trial { text-align: center; color: var(--ink-3); }
.hx-au-inner .hx-sent { display: flex; flex-direction: column; align-items: center; gap: 12px; margin-top: 28px; }
.hx-au-inner .hx-sent .hx-btn { min-width: 220px; justify-content: center; border: 0; font: inherit; cursor: pointer; text-decoration: none; }
.hx-au-inner .hx-sent .hx-btn.ghost { background: var(--white); color: var(--ink); border: 1px solid var(--line); }
.hx-au-inner .hx-link { all: unset; cursor: pointer; color: var(--btn); font-weight: 500; }
.hx-au-inner .hx-note { margin-top: 6px; font-size: 13px !important; color: var(--ink-3); }
.hx-au-inner .hx-hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.hx-au-inner .hx-pwfeed { margin-top: 8px; }
`;

function PasswordField({
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  show,
  onToggle,
  autoComplete,
  placeholder,
  maxLength,
  error,
  invalid,
  link,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
  placeholder: string;
  maxLength: number;
  error: string | null;
  invalid: boolean;
  link?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="hx-lab">
      <span className="hx-lab-row">
        <label htmlFor={`pw-${autoComplete}`}>{label}</label>
        {link}
      </span>
      <span className="hx-pw">
        <input
          id={`pw-${autoComplete}`}
          className="hx-in"
          type={show ? "text" : "password"}
          name={autoComplete === "new-password" ? "new-password" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-invalid={invalid}
          aria-describedby={error ? `pw-err-${autoComplete}` : undefined}
        />
        <button type="button" onClick={onToggle} aria-pressed={show} aria-label={show ? "Hide password" : "Show password"}>
          {show ? "Hide" : "Show"}
        </button>
      </span>
      {error && <span id={`pw-err-${autoComplete}`} className="hx-err" role="alert">{error}</span>}
      {children}
    </div>
  );
}

function TextField({
  label,
  id,
  value,
  onChange,
  onFocus,
  onBlur,
  type = "text",
  inputMode,
  autoComplete,
  placeholder,
  maxLength,
  error,
  invalid,
  autoFocus,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  type?: string;
  inputMode?: "email" | "url";
  autoComplete: string;
  placeholder: string;
  maxLength: number;
  error: string | null;
  invalid: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="hx-lab">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="hx-in"
        type={type}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={invalid}
        aria-describedby={error ? `${id}-err` : undefined}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
      />
      {error && <span id={`${id}-err`} className="hx-err" role="alert">{error}</span>}
    </div>
  );
}

function usePasswordReveal() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!show) return;
    const id = setTimeout(() => setShow(false), PASSWORD_VISIBLE_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [show]);
  const toggle = () =>
    setShow((v) => {
      trackAuth({ type: "login_password_visibility_toggled", visible: !v });
      return !v;
    });
  return [show, toggle] as const;
}

function useAutoFocus() {
  const [yes] = useState(() => typeof document !== "undefined" && document.visibilityState === "visible");
  return yes;
}

export function StagingLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginWithGoogle, isLoggedIn, user } = useAuth();
  const isMounted = useIsMounted();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, toggleShow] = usePasswordReveal();
  const [staySignedIn, setStaySignedIn] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleInFlight, setGoogleInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const autoFocus = useAutoFocus();

  const userInteractedRef = React.useRef(false);
  useEffect(() => {
    const id = setTimeout(() => {
      if (userInteractedRef.current) return;
      setEmail((cur) => (cur && !userInteractedRef.current ? "" : cur));
      setPassword((cur) => (cur && !userInteractedRef.current ? "" : cur));
    }, 250);
    return () => clearTimeout(id);
  }, []);

  const emailV = validateEmail(email);
  const passwordV = validatePassword(password);
  const isLocked = lockoutSeconds > 0;
  const canSubmit = emailV.valid && passwordV.valid && !loading && !isLocked;
  const emailError = emailTouched ? emailV.message : null;
  const passwordError = passwordTouched
    ? passwordV.message ||
      (passwordHasEdgeWhitespace(password) ? "Password has leading or trailing spaces, check your paste." : null)
    : null;

  const planParam = searchParams?.get("plan") ?? null;
  const nextParam = searchParams?.get("next") ?? null;
  const isEmployerFlow = !!nextParam?.startsWith("/employer");

  useEffect(() => {
    const ref = searchParams?.get("ref") ?? null;
    if (ref) storePendingReferralCode(ref);
  }, [searchParams]);

  const computeRedirect = useCallback(
    () => computeAuthRedirect({ next: nextParam, plan: planParam, hasCompletedOnboarding: !!user?.hasCompletedOnboarding }),
    [nextParam, planParam, user],
  );

  useEffect(() => {
    if (isLoggedIn && user && !isResetInProgress()) router.replace(computeRedirect());
  }, [isLoggedIn, user, router, computeRedirect]);

  useEffect(() => {
    trackAuth(loginViewedEvent("login"));
  }, []);

  useEffect(() => {
    setLockoutSeconds(readLockoutSeconds());
    setStaySignedIn(readStaySignedInPref());
  }, []);

  useEffect(() => {
    const handler = (e: PageTransitionEvent) => {
      if (e.persisted) setError(null);
    };
    window.addEventListener("pageshow", handler);
    return () => window.removeEventListener("pageshow", handler);
  }, []);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const id = setInterval(() => setLockoutSeconds(readLockoutSeconds()), 1000);
    return () => clearInterval(id);
  }, [lockoutSeconds]);

  const handleGoogle = useCallback(async () => {
    if (googleInFlight || loading) return;
    setGoogleInFlight(true);
    setError(null);
    trackAuth({ type: "login_method_selected", method: "google" });
    trackAuth({ type: "login_submitted", method: "google" });
    const fallback = setTimeout(() => {
      if (isMounted.current) setGoogleInFlight(false);
    }, 8000);
    const start = Date.now();
    try {
      storePendingConsent();
      const result = await loginWithGoogle(computeRedirect());
      if (!isMounted.current) return;
      if (!result.success) {
        clearPendingConsent();
        setError(mapAuthError(result.error));
        trackAuth({ type: "login_failed", method: "google", reason: "unknown" });
      } else {
        markSessionStart(staySignedIn);
        trackAuth({ type: "login_succeeded", method: "google", timeMs: Date.now() - start });
        return;
      }
    } catch (e) {
      if (!isMounted.current) return;
      setError(mapAuthError(e instanceof Error ? e.message : undefined));
      trackAuth({ type: "login_failed", method: "google", reason: "unknown" });
    } finally {
      clearTimeout(fallback);
    }
    if (isMounted.current) setGoogleInFlight(false);
  }, [googleInFlight, loading, loginWithGoogle, computeRedirect, isMounted, staySignedIn]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setEmailTouched(true);
      setPasswordTouched(true);
      if (!canSubmit) return;
      setError(null);
      setLoading(true);
      trackAuth({ type: "login_method_selected", method: "email" });
      trackAuth({ type: "login_submitted", method: "email" });
      const start = Date.now();
      try {
        const result = await login(sanitizeEmail(email), password);
        if (!isMounted.current) return;
        if (!result.success) {
          setLockoutSeconds(readLockoutSeconds());
          setError(mapAuthError(result.error));
          trackAuth({
            type: "login_failed",
            method: "email",
            reason: result.error?.toLowerCase().includes("rate") ? "rate_limited" : "invalid_credentials",
          });
        } else {
          markSessionStart(staySignedIn);
          trackAuth({ type: "login_succeeded", method: "email", timeMs: Date.now() - start });
        }
      } catch (err) {
        if (!isMounted.current) return;
        setError(mapAuthError(err instanceof Error ? err.message : undefined));
        trackAuth({ type: "login_failed", method: "email", reason: "network" });
      } finally {
        if (isMounted.current) setLoading(false);
      }
    },
    [canSubmit, email, password, login, isMounted, staySignedIn],
  );

  const verifiedParam = searchParams?.get("verified") ?? null;
  const errorParam = searchParams?.get("error") ?? null;
  const errorParamMessage = errorParam
    ? errorParam === "verification-failed" || errorParam === "config"
      ? "We couldn't verify your email just now. Open the link in your email again in a minute; it still works. If it keeps failing, contact hello@hirestepx.com."
      : errorParam === "link-expired" || errorParam === "verification-expired"
        ? "Your verification link has expired. Enter your email below and request a new one."
        : errorParam === "invalid-token"
          ? "That verification link isn't valid. Use the latest email we sent you, or enter your email below and request a new one."
          : errorParam === "user-not-found"
            ? "We couldn't find an account for that link. Sign up to create one."
            : errorParam === "session-expired"
              ? "Your session expired. Please log in again."
              : "Something went wrong. Try again or contact hello@hirestepx.com."
    : null;
  const verifiedNotice =
    verifiedParam === "true"
      ? "Email verified. You're all set. Log in below to continue."
      : verifiedParam === "already"
        ? "This email is already verified. Log in below to continue."
        : null;
  const needsVerificationHelp =
    error === UNVERIFIED_EMAIL_MESSAGE ||
    errorParam === "link-expired" ||
    errorParam === "verification-expired" ||
    errorParam === "invalid-token" ||
    errorParam === "verification-failed";
  const displayError = isLocked
    ? `Account temporarily locked after too many attempts. Try again in ${Math.ceil(lockoutSeconds / 60)} minute${lockoutSeconds > 60 ? "s" : ""}.`
    : error || errorParamMessage;

  return (
    <div className="hx-au-inner">
      <style>{authFormsCss}</style>
      <h1 id="login-heading">Welcome back</h1>
      <p className="hx-sub">
        {isEmployerFlow ? "Log in to review your shortlist of scored candidates." : "Log in to continue."}
      </p>
      <button
        type="button"
        className="hx-gbtn"
        onClick={handleGoogle}
        disabled={googleInFlight || loading || isLocked}
        aria-busy={googleInFlight}
      >
        <Google />
        {googleInFlight ? "Opening Google…" : "Continue with Google"}
      </button>
      <div className="hx-or">or use your email</div>
      {!displayError && verifiedNotice && (
        <div role="status" aria-live="polite" className="hx-banner ok">{verifiedNotice}</div>
      )}
      {displayError && (
        <div role="alert" id="login-error" className="hx-banner">{displayError}</div>
      )}
      {needsVerificationHelp && !isLocked && <ResendVerification email={email} />}
      <form
        className="hx-form"
        onSubmit={handleSubmit}
        noValidate
        aria-labelledby="login-heading"
        aria-describedby={displayError ? "login-error" : undefined}
      >
        <TextField
          label="Email"
          id="email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(v) => {
            userInteractedRef.current = true;
            setEmail(v);
            if (error) setError(null);
          }}
          onFocus={() => {
            if (!emailTouched) trackAuth({ type: "login_field_focused", field: "email" });
          }}
          onBlur={() => setEmailTouched(true)}
          autoComplete="email"
          placeholder="you@example.com"
          maxLength={254}
          error={emailError}
          invalid={!!error || (emailTouched && !!emailV.message)}
          autoFocus={autoFocus}
        />
        <PasswordField
          label="Password"
          value={password}
          onChange={(v) => {
            userInteractedRef.current = true;
            setPassword(v);
            if (error) setError(null);
          }}
          onFocus={() => {
            if (!passwordTouched) trackAuth({ type: "login_field_focused", field: "password" });
          }}
          onBlur={() => setPasswordTouched(true)}
          show={show}
          onToggle={toggleShow}
          autoComplete="current-password"
          placeholder="Enter your password"
          maxLength={128}
          error={passwordError}
          invalid={!!error || (passwordTouched && !!passwordV.message)}
          link={
            <a href="/forgot-password" onClick={() => trackAuth({ type: "login_forgot_password_clicked" })}>
              Forgot password?
            </a>
          }
        />
        <label className="hx-chk">
          <input type="checkbox" checked={staySignedIn} onChange={(e) => setStaySignedIn(e.target.checked)} />
          <span>Stay signed in for 30 days. Leave unchecked on shared devices.</span>
        </label>
        <button type="submit" className="hx-btn" disabled={!canSubmit} aria-busy={loading}>
          {loading ? "Signing in…" : isEmployerFlow ? "Continue to your roster" : "Log in"}
        </button>
      </form>
      <p className="hx-legal">
        By continuing you confirm you are 18 or older and agree to the{" "}
        <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a> and{" "}
        <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
      </p>
    </div>
  );
}

export function StagingSignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signup, loginWithGoogle, isLoggedIn, user } = useAuth();
  const isMounted = useIsMounted();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [show, toggleShow] = usePasswordReveal();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsAttempted, setTermsAttempted] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [companyNameTouched, setCompanyNameTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleInFlight, setGoogleInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSent, setSignupSent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const autoFocus = useAutoFocus();
  const emailSuggestion = emailTouched ? suggestEmailCorrection(email) : null;
  const resend = useResendVerification(email);

  const planParam = searchParams?.get("plan") ?? null;
  const nextParam = searchParams?.get("next") ?? null;
  const isEmployerFlow = !!nextParam?.startsWith("/employer");

  const nameV = validateName(name);
  const emailV = validateEmail(email);
  const passwordV = validateSignupPassword(password);
  const companyNameValid = !isEmployerFlow || companyName.trim().length >= 2;
  const websiteValid = !isEmployerFlow || !website.trim() || isPlausibleWebsite(website);
  const workEmailValid = !isEmployerFlow || !emailV.valid || !isFreeMailDomain(emailDomain(email));
  const canSubmit =
    (isEmployerFlow || nameV.valid) &&
    emailV.valid &&
    passwordV.valid &&
    companyNameValid &&
    websiteValid &&
    workEmailValid &&
    termsAccepted &&
    !loading;

  const nameError = nameTouched ? nameV.message : null;
  const emailError = emailTouched
    ? emailV.message ||
      (workEmailValid ? null : "Use your work email (e.g. you@yourcompany.com). Personal email addresses can't register a company.")
    : null;
  const passwordError = passwordTouched
    ? passwordV.message ||
      (passwordHasEdgeWhitespace(password) ? "Password has leading or trailing spaces, check your paste." : null)
    : null;
  const companyNameError = companyNameTouched && !companyNameValid ? "Enter your company's name." : null;

  const computeRedirect = useCallback(
    () => computeAuthRedirect({ next: nextParam, plan: planParam, hasCompletedOnboarding: !!user?.hasCompletedOnboarding }),
    [nextParam, planParam, user],
  );

  useEffect(() => {
    if (isLoggedIn && user && !isResetInProgress()) router.replace(computeRedirect());
  }, [isLoggedIn, user, router, computeRedirect]);

  useEffect(() => {
    trackAuth(
      loginViewedEvent("signup", {
        source: searchParams?.get("source") ?? undefined,
        company: searchParams?.get("company") ?? undefined,
        role: searchParams?.get("role") ?? undefined,
        focus: searchParams?.get("focus") ?? undefined,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    storePendingReferralCode(searchParams?.get("ref") ?? null);
    storePendingNextTarget(nextParam);
  }, [searchParams, nextParam]);

  const switchWho = (employer: boolean) => {
    if (employer === isEmployerFlow) return;
    const qs = new URLSearchParams(searchParams?.toString() ?? "");
    if (employer) qs.set("next", "/employer");
    else qs.delete("next");
    const s = qs.toString();
    router.replace(s ? `/signup?${s}` : "/signup");
  };

  const handleGoogle = useCallback(async () => {
    if (googleInFlight || loading) return;
    setGoogleInFlight(true);
    setError(null);
    trackAuth({ type: "login_method_selected", method: "google" });
    trackAuth({ type: "login_submitted", method: "google" });
    const fallback = setTimeout(() => {
      if (isMounted.current) setGoogleInFlight(false);
    }, 8000);
    const start = Date.now();
    try {
      storePendingConsent();
      const result = await loginWithGoogle(computeRedirect());
      if (!isMounted.current) return;
      if (!result.success) {
        clearPendingConsent();
        setError(mapAuthError(result.error));
        trackAuth({ type: "login_failed", method: "google", reason: "unknown" });
      } else {
        trackAuth({ type: "login_succeeded", method: "google", timeMs: Date.now() - start });
        return;
      }
    } catch (e) {
      if (!isMounted.current) return;
      setError(mapAuthError(e instanceof Error ? e.message : undefined));
      trackAuth({ type: "login_failed", method: "google", reason: "unknown" });
    } finally {
      clearTimeout(fallback);
    }
    if (isMounted.current) setGoogleInFlight(false);
  }, [googleInFlight, loading, loginWithGoogle, computeRedirect, isMounted]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isEmployerFlow) setNameTouched(true);
      setEmailTouched(true);
      setPasswordTouched(true);
      setCompanyNameTouched(true);
      setTermsAttempted(true);
      if (honeypot) {
        setSignupSent(true);
        return;
      }
      if (!canSubmit) return;
      setError(null);

      const cleanEmail = sanitizeEmail(email);
      if (isDisposableEmail(cleanEmail)) {
        setError("Please use a permanent email address. Temporary inboxes aren't supported.");
        return;
      }

      setLoading(true);
      const breach = await checkPasswordBreached(password);
      if (!isMounted.current) return;
      if (breach.breached) {
        setError("This password is too common, attackers already know it. Try a different one.");
        setLoading(false);
        return;
      }
      if (breach.unknown) {
        console.warn("[signup] HIBP breach check unreachable, proceeding without verification");
      }

      if (isEmployerFlow) storePendingEmployerProfile(companyName, website);
      trackAuth({ type: "login_method_selected", method: "email" });
      trackAuth({ type: "login_submitted", method: "email" });
      const start = Date.now();
      try {
        const result = await signup(
          cleanEmail,
          isEmployerFlow ? companyName.trim() : name.trim(),
          password,
          isEmployerFlow ? "/employer" : undefined,
          isEmployerFlow ? { companyName, website } : undefined,
        );
        if (!isMounted.current) return;
        if (!result.success) {
          setError(mapAuthError(result.error));
          trackAuth({ type: "login_failed", method: "email", reason: "invalid_credentials" });
        } else {
          trackAuth({ type: "login_succeeded", method: "email", timeMs: Date.now() - start });
          setSignupSent(true);
        }
      } catch (err) {
        if (!isMounted.current) return;
        setError(mapAuthError(err instanceof Error ? err.message : undefined));
        trackAuth({ type: "login_failed", method: "email", reason: "network" });
      } finally {
        if (isMounted.current) setLoading(false);
      }
    },
    [canSubmit, email, name, password, signup, honeypot, isMounted, isEmployerFlow, companyName, website],
  );

  if (signupSent) {
    const provider = detectEmailProvider(email);
    return (
      <div className="hx-au-inner" role="status" aria-live="polite">
        <style>{authFormsCss}</style>
        <h1>Check your email</h1>
        <p className="hx-sub">
          We sent a verification link to <b>{sanitizeEmail(email)}</b>. Click it to finish creating your account.
        </p>
        <div className="hx-sent">
          {provider && (
            <a className="hx-btn" href={provider.url} target="_blank" rel="noopener noreferrer">
              Open {provider.name}
            </a>
          )}
          <button
            type="button"
            className={provider ? "hx-btn ghost" : "hx-btn"}
            onClick={resend.send}
            disabled={resend.cooldown > 0 || resend.sending}
            aria-busy={resend.sending || undefined}
          >
            {resendButtonLabel(resend.sending, resend.cooldown)}
          </button>
          <ResendStatus message={resend.message} />
          <button type="button" className="hx-link" onClick={() => setSignupSent(false)}>
            Wrong email? Change it
          </button>
          <p className="hx-note">Didn&apos;t see it? Check your spam folder.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hx-au-inner">
      <style>{authFormsCss}</style>
      <h1 id="signup-heading">{isEmployerFlow ? "Create a company account" : "Create your account"}</h1>
      <p className="hx-sub">{isEmployerFlow ? "Find candidates who have practised." : "Start practising in a minute."}</p>
      <div className="hx-seg" role="group" aria-label="Account type">
        <button type="button" aria-pressed={!isEmployerFlow} onClick={() => switchWho(false)}>I&apos;m a candidate</button>
        <button type="button" aria-pressed={isEmployerFlow} onClick={() => switchWho(true)}>I&apos;m hiring</button>
      </div>
      {!isEmployerFlow && (
        <>
          <button
            type="button"
            className="hx-gbtn"
            onClick={handleGoogle}
            disabled={googleInFlight || loading}
            aria-busy={googleInFlight}
          >
            <Google />
            {googleInFlight ? "Opening Google…" : "Continue with Google"}
          </button>
          <div className="hx-or">or use your email</div>
        </>
      )}
      {error && <div role="alert" id="signup-error" className="hx-banner">{error}</div>}
      <form
        className="hx-form"
        style={isEmployerFlow ? { marginTop: 24 } : undefined}
        onSubmit={handleSubmit}
        noValidate
        aria-labelledby="signup-heading"
        aria-describedby={error ? "signup-error" : undefined}
      >
        {isEmployerFlow ? (
          <TextField
            label="Company name"
            id="company-name"
            value={companyName}
            onChange={(v) => {
              setCompanyName(v);
              if (error) setError(null);
            }}
            onBlur={() => setCompanyNameTouched(true)}
            autoComplete="organization"
            placeholder="Acme Pvt Ltd"
            maxLength={200}
            error={companyNameError}
            invalid={!!error || (companyNameTouched && !companyNameValid)}
            autoFocus={autoFocus}
          />
        ) : (
          <TextField
            label="Full name"
            id="name"
            value={name}
            onChange={(v) => {
              setName(v);
              if (error) setError(null);
            }}
            onBlur={() => setNameTouched(true)}
            autoComplete="name"
            placeholder="Priya Sharma"
            maxLength={40}
            error={nameError}
            invalid={!!error || (nameTouched && !!nameV.message)}
            autoFocus={autoFocus}
          />
        )}
        {isEmployerFlow && (
          <TextField
            label="Company website (optional)"
            id="company-website"
            inputMode="url"
            value={website}
            onChange={(v) => {
              setWebsite(v);
              if (error) setError(null);
            }}
            autoComplete="url"
            placeholder="acme.com"
            maxLength={300}
            error={websiteValid ? null : WEBSITE_FORMAT_MESSAGE}
            invalid={!websiteValid}
          />
        )}
        <TextField
          label={isEmployerFlow ? "Work email" : "Email"}
          id="email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(v) => {
            setEmail(v);
            if (error) setError(null);
          }}
          onBlur={() => setEmailTouched(true)}
          autoComplete="email"
          placeholder={isEmployerFlow ? "you@company.com" : "you@example.com"}
          maxLength={254}
          error={emailError}
          invalid={!!error || (emailTouched && (!!emailV.message || !workEmailValid))}
        />
        {emailSuggestion && !emailV.valid && (
          <p className="hx-note" style={{ marginTop: -8 }}>
            Did you mean{" "}
            <button type="button" className="hx-link" onClick={() => setEmail(emailSuggestion)}>{emailSuggestion}</button>?
          </p>
        )}
        <div className="hx-hp" aria-hidden="true">
          <label htmlFor="hsx-referral-display-name">Referral display name (leave blank)</label>
          <input
            id="hsx-referral-display-name"
            type="text"
            name="referral_display_name"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>
        <PasswordField
          label="Password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            if (error) setError(null);
          }}
          onBlur={() => setPasswordTouched(true)}
          show={show}
          onToggle={toggleShow}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          maxLength={128}
          error={passwordError}
          invalid={!!error || (passwordTouched && !!passwordV.message)}
        >
          {password.length > 0 ? (
            <div className="hx-pwfeed">
              <PasswordStrengthMeter score={passwordV.score} label={passwordV.label} />
              <PasswordChecklist checks={passwordV.checks} />
            </div>
          ) : (
            <span className="hx-hint">At least 8 characters.</span>
          )}
        </PasswordField>
        <div>
          <label className="hx-chk">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => {
                setTermsAccepted(e.target.checked);
                if (e.target.checked && termsAttempted) setTermsAttempted(false);
              }}
            />
            <span>
              I am 18 or older and agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Use</a> and{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
            </span>
          </label>
          {termsAttempted && !termsAccepted && (
            <p className="hx-err" role="alert" style={{ marginTop: 6 }}>Please accept the Terms to continue.</p>
          )}
        </div>
        <button type="submit" className="hx-btn" disabled={!canSubmit} aria-busy={loading}>
          {loading ? "Creating your account…" : isEmployerFlow ? "Create company account" : "Create account"}
        </button>
        {!isEmployerFlow && <p className="hx-note hx-trial">2 sessions free · No card needed</p>}
      </form>
    </div>
  );
}
