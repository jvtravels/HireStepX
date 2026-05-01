/* HireStepX — Forgot password (production)
   Step 1 of the password-reset flow. Wires useAuth().resetPassword to send
   a tokenised link to the user's email. The "sent" state is rendered inline
   (no separate route) — confirmation copy is enumeration-resistant.
   Discipline rule: Indigo is interactive · Copper is editorial · Never mix. */
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../AuthContext";
import { tokens as t, fonts as f, shadows } from "./_tokens";
import { Field, Wordmark, Spinner } from "./_fields";
import { AUTH_STYLES } from "./_styles";
import { sanitizeEmail, validateEmail } from "./_validation";
import { mapAuthError, useIsMounted } from "./_shell";
import { trackAuth, loginViewedEvent } from "./_analytics";

const EMAIL_MAX_LENGTH = 320;
// 60s matches Stripe / Linear / Notion resend cooldowns.
const RESEND_COOLDOWN_SEC = 60;

export default function ForgotPassword() {
  const router = useRouter();
  const { resetPassword, isLoggedIn } = useAuth();

  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const isMounted = useIsMounted();

  const emailV = validateEmail(email);
  const canSubmit = emailV.valid && !loading;
  const emailError = emailTouched ? emailV.message : null;

  const [shouldAutoFocus] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.visibilityState === "visible";
  });

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(
      () => setCooldown((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, [cooldown]);

  // Already-logged-in users probably opened this by accident; bounce them.
  useEffect(() => {
    if (isLoggedIn) router.replace("/dashboard");
  }, [isLoggedIn, router]);

  useEffect(() => {
    trackAuth(loginViewedEvent("forgot-password"));
  }, []);

  // Provider-aware webmail link so users land in the right inbox tab.
  const provider = useMemo(() => {
    const at = email.lastIndexOf("@");
    if (at < 0) return null;
    const domain = email.slice(at + 1).toLowerCase();
    if (domain.includes("gmail") || domain.includes("googlemail"))
      return { name: "Gmail", url: "https://mail.google.com" };
    if (
      domain.includes("outlook") ||
      domain.includes("hotmail") ||
      domain.includes("live")
    )
      return { name: "Outlook", url: "https://outlook.live.com" };
    if (domain.includes("yahoo"))
      return { name: "Yahoo", url: "https://mail.yahoo.com" };
    if (domain.includes("proton"))
      return { name: "Proton", url: "https://mail.proton.me" };
    return null;
  }, [email]);

  const submitReset = useCallback(
    async (cleanEmail: string) => {
      const result = await resetPassword(cleanEmail);
      return result;
    },
    [resetPassword],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setEmailTouched(true);
      if (!canSubmit) return;
      setError(null);
      setLoading(true);
      const cleanEmail = sanitizeEmail(email);
      try {
        const result = await submitReset(cleanEmail);
        if (!isMounted.current) return;
        if (!result.success) {
          setError(mapAuthError(result.error));
        } else {
          setSent(true);
          setCooldown(RESEND_COOLDOWN_SEC);
        }
      } catch (err) {
        if (!isMounted.current) return;
        const msg = err instanceof Error ? err.message : undefined;
        setError(mapAuthError(msg));
      } finally {
        if (isMounted.current) setLoading(false);
      }
    },
    [canSubmit, email, submitReset, isMounted],
  );

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      const cleanEmail = sanitizeEmail(email);
      await submitReset(cleanEmail);
      if (!isMounted.current) return;
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch {
      /* keep cooldown idle so user can retry */
    } finally {
      if (isMounted.current) setResending(false);
    }
  }, [cooldown, resending, email, submitReset, isMounted]);

  return (
    <>
      <style>{AUTH_STYLES}</style>
      <div
        style={{
          background: t.cream,
          minHeight: "100dvh",
          fontFamily: f.sans,
          color: t.coal,
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top bar — wordmark left, "← Back to Log in" right */}
        <header
          className="hsx-login-topbar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "32px 48px",
            gap: 16,
          }}
        >
          <a
            href="/"
            aria-label="HireStepX home"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Wordmark />
          </a>
          <a
            href="/login"
            className="hsx-link-indigo"
            style={{
              fontFamily: f.sans,
              fontSize: 14,
              fontWeight: 500,
              color: t.indigo,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Log in
          </a>
        </header>

        <main
          className="hsx-login-main"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(24px, 4vh, 64px) 24px",
          }}
        >
          {sent ? (
            /* ── Sent confirmation — enumeration-resistant copy ── */
            <>
              <div
                className="hsx-login-hero"
                style={{
                  width: "100%",
                  textAlign: "center",
                  marginBottom: 32,
                }}
              >
                <h1
                  id="forgot-heading"
                  style={{
                    fontFamily: f.serif,
                    fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                    lineHeight: 1.05,
                    fontWeight: 400,
                    letterSpacing: "-0.02em",
                    whiteSpace: "nowrap",
                    margin: 0,
                    color: t.coal,
                  }}
                >
                  Check your{" "}
                  <em
                    style={{
                      fontStyle: "italic",
                      fontWeight: 400,
                      color: t.copper,
                    }}
                  >
                    inbox
                  </em>
                </h1>
                <p
                  className="hsx-login-subtitle"
                  role="status"
                  aria-live="polite"
                  style={{
                    fontFamily: f.sans,
                    fontSize: 16,
                    lineHeight: 1.55,
                    color: t.inkSoft,
                    marginTop: 14,
                    marginBottom: 0,
                    textWrap: "balance",
                  }}
                >
                  If an account exists for{" "}
                  <strong style={{ color: t.coal, fontWeight: 600 }}>
                    {sanitizeEmail(email)}
                  </strong>
                  , a reset link is on its way.
                </p>
              </div>

              <div
                style={{
                  width: "100%",
                  maxWidth: 440,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {provider && (
                  <a
                    href={provider.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hsx-login-cta"
                    style={{
                      width: "100%",
                      fontFamily: f.sans,
                      fontSize: 15,
                      fontWeight: 600,
                      color: t.cream,
                      background: t.indigo,
                      border: "1px solid transparent",
                      borderRadius: 10,
                      padding: "16px 18px",
                      cursor: "pointer",
                      boxShadow: shadows.cta,
                      letterSpacing: 0.1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      textDecoration: "none",
                    }}
                  >
                    Open {provider.name}
                    <svg
                      className="hsx-login-cta-arrow"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M7 17L17 7" />
                      <path d="M8 7h9v9" />
                    </svg>
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || resending}
                  aria-busy={resending || undefined}
                  style={{
                    width: "100%",
                    fontFamily: f.sans,
                    fontSize: 15,
                    fontWeight: 500,
                    color: t.coal,
                    background: t.white,
                    border: `1px solid ${t.line}`,
                    borderRadius: 10,
                    padding: "14px 18px",
                    cursor:
                      cooldown > 0 || resending ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    boxShadow: shadows.card,
                    opacity: cooldown > 0 || resending ? 0.6 : 1,
                  }}
                >
                  {resending ? (
                    <>
                      <Spinner />
                      Resending…
                    </>
                  ) : cooldown > 0 ? (
                    <span aria-live="polite">
                      Resend link in {cooldown}s
                    </span>
                  ) : (
                    <span aria-live="polite">Resend link</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setCooldown(0);
                  }}
                  className="hsx-link-indigo"
                  style={{
                    width: "100%",
                    fontFamily: f.sans,
                    fontSize: 14,
                    fontWeight: 500,
                    color: t.indigo,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "10px 14px",
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  Wrong email? Try a different one
                </button>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    marginTop: 6,
                    fontFamily: f.sans,
                    fontSize: 13,
                    color: t.inkSoft,
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={t.copper}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
                    <path d="M12 8v4" />
                    <circle
                      cx="12"
                      cy="15"
                      r="0.6"
                      fill={t.copper}
                      stroke="none"
                    />
                  </svg>
                  For your security, the link will expire in 30 minutes.
                </div>

                <p
                  style={{
                    fontFamily: f.sans,
                    fontSize: 13,
                    color: t.inkFaint,
                    textAlign: "center",
                    marginTop: 4,
                    lineHeight: 1.55,
                  }}
                >
                  Don&apos;t see it? Check your spam folder.
                </p>
              </div>
            </>
          ) : (
            /* ── Request form ── */
            <>
              <div
                className="hsx-login-hero"
                style={{
                  width: "100%",
                  textAlign: "center",
                  marginBottom: 32,
                }}
              >
                <h1
                  id="forgot-heading"
                  style={{
                    fontFamily: f.serif,
                    fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                    lineHeight: 1.05,
                    fontWeight: 400,
                    letterSpacing: "-0.02em",
                    whiteSpace: "nowrap",
                    margin: 0,
                    color: t.coal,
                  }}
                >
                  Reset your{" "}
                  <em
                    style={{
                      fontStyle: "italic",
                      fontWeight: 400,
                      color: t.copper,
                    }}
                  >
                    password
                  </em>
                </h1>
                <p
                  className="hsx-login-subtitle"
                  style={{
                    fontFamily: f.sans,
                    fontSize: 16,
                    lineHeight: 1.55,
                    color: t.inkSoft,
                    marginTop: 14,
                    marginBottom: 0,
                    textWrap: "balance",
                  }}
                >
                  No worries, we&apos;ll send you a link to reset your password.
                </p>
              </div>

              <div
                className="hsx-login-form"
                style={{ width: "100%", maxWidth: 440 }}
              >
                {error && (
                  <div
                    role="alert"
                    id="forgot-error"
                    className="hsx-error-banner"
                    style={{
                      background: t.error100,
                      border: `1px solid ${t.error}`,
                      borderRadius: 10,
                      padding: "12px 14px",
                      marginBottom: 16,
                      fontFamily: f.sans,
                      fontSize: 13,
                      color: t.error,
                      lineHeight: 1.4,
                    }}
                  >
                    {error}
                  </div>
                )}
                <form
                  onSubmit={handleSubmit}
                  aria-labelledby="forgot-heading"
                  aria-describedby={error ? "forgot-error" : undefined}
                  className="hsx-login-form-fields"
                  style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
                  <Field
                    label="Email Address"
                    type="email"
                    name="email"
                    value={email}
                    onChange={(v) => {
                      setEmail(v);
                      if (error) setError(null);
                    }}
                    onFocus={() => setEmailTouched(true)}
                    onAutofill={() => setEmailTouched(true)}
                    autoComplete="email"
                    placeholder="Enter your email"
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus={shouldAutoFocus}
                    inputMode="email"
                    enterKeyHint="send"
                    maxLength={EMAIL_MAX_LENGTH}
                    invalid={
                      !!error || (emailTouched && !!emailV.message)
                    }
                    errorMessage={emailError}
                  />

                  {(() => {
                    const isGhost = !canSubmit && !loading;
                    return (
                      <button
                        type="submit"
                        disabled={!canSubmit}
                        aria-busy={loading ? "true" : "false"}
                        title={
                          isGhost
                            ? "Enter a valid email to continue"
                            : undefined
                        }
                        className="hsx-login-cta"
                        style={{
                          width: "100%",
                          fontFamily: f.sans,
                          fontSize: 15,
                          fontWeight: 600,
                          color: isGhost ? t.inkFaint : t.cream,
                          background: isGhost ? t.creamSoft : t.indigo,
                          border: isGhost
                            ? `1px solid ${t.line}`
                            : "1px solid transparent",
                          borderRadius: 10,
                          padding: "16px 18px",
                          cursor: canSubmit ? "pointer" : "not-allowed",
                          marginTop: 4,
                          boxShadow: isGhost ? "none" : shadows.cta,
                          letterSpacing: 0.1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                          opacity: loading ? 0.95 : 1,
                        }}
                      >
                        {loading ? (
                          <>
                            <Spinner />
                            Sending link…
                          </>
                        ) : (
                          <>
                            Send reset link
                            <svg
                              className="hsx-login-cta-arrow"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <line x1="5" y1="12" x2="19" y2="12" />
                              <polyline points="12 5 19 12 12 19" />
                            </svg>
                          </>
                        )}
                      </button>
                    );
                  })()}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      marginTop: 6,
                      fontFamily: f.sans,
                      fontSize: 13,
                      color: t.inkSoft,
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={t.copper}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
                      <path d="M12 8v4" />
                      <circle
                        cx="12"
                        cy="15"
                        r="0.6"
                        fill={t.copper}
                        stroke="none"
                      />
                    </svg>
                    For your security, the link will expire in 30 minutes.
                  </div>
                </form>
              </div>
            </>
          )}
        </main>

        <footer
          className="hsx-login-footer"
          style={{
            textAlign: "center",
            padding: "24px 24px 32px",
            fontFamily: f.sans,
            fontSize: 13,
            color: t.inkSoft,
            lineHeight: 1.6,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={t.copper}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1v-6h3v4z" />
              <path d="M3 19a2 2 0 0 0 2 2h1v-6H3v4z" />
            </svg>
            Need help?{" "}
            <a
              href="/contact"
              className="hsx-link-indigo"
              style={{
                color: t.indigo,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Contact support
            </a>
          </span>
        </footer>
      </div>
    </>
  );
}
