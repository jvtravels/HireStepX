/* HireStepX — Forgot password (production)
   Step 1 of the password-reset flow. Wires useAuth().resetPassword
   to send a tokenized link to the user's email. */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../AuthContext";
import { tokens as t, fonts as f, shadows } from "./_tokens";
import { Field, Wordmark, Spinner } from "./_fields";
import { AUTH_STYLES } from "./_styles";
import { sanitizeEmail, validateEmail } from "./_validation";
import { mapAuthError, useIsMounted } from "./_shell";
import { trackAuth, loginViewedEvent } from "./_analytics";

const EMAIL_MAX_LENGTH = 320;

export default function ForgotPassword() {
  const router = useRouter();
  const { resetPassword, isLoggedIn } = useAuth();

  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const isMounted = useIsMounted();

  const emailV = validateEmail(email);
  const canSubmit = emailV.valid && !loading;
  const emailError = emailTouched ? emailV.message : null;

  const [shouldAutoFocus] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.visibilityState === "visible";
  });

  // Already-logged-in users probably opened this by accident; bounce them.
  useEffect(() => {
    if (isLoggedIn) router.replace("/dashboard");
  }, [isLoggedIn, router]);

  useEffect(() => {
    trackAuth(loginViewedEvent("forgot-password"));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setEmailTouched(true);
      if (!canSubmit) return;
      setError(null);
      setLoading(true);
      const cleanEmail = sanitizeEmail(email);
      try {
        const result = await resetPassword(cleanEmail);
        if (!isMounted.current) return;
        if (!result.success) {
          setError(mapAuthError(result.error));
        } else {
          setSent(true);
        }
      } catch (err) {
        if (!isMounted.current) return;
        const msg = err instanceof Error ? err.message : undefined;
        setError(mapAuthError(msg));
      } finally {
        if (isMounted.current) setLoading(false);
      }
    },
    [canSubmit, email, resetPassword, isMounted],
  );

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
        {/* Top bar */}
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
          <div
            className="hsx-login-signup-prompt"
            style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}
          >
            <span className="hsx-login-signup-text">Remembered it? </span>
            <a
              href="/login"
              className="hsx-link-indigo"
              style={{
                color: t.indigo,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Log in
            </a>
          </div>
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
            <div
              role="status"
              aria-live="polite"
              style={{ width: "100%", maxWidth: 480, textAlign: "center" }}
            >
              <h1
                style={{
                  fontFamily: f.serif,
                  fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                  lineHeight: 1.05,
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                  margin: 0,
                  color: t.coal,
                  whiteSpace: "nowrap",
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
                  email
                </em>
                .
              </h1>
              <p
                style={{
                  fontFamily: f.sans,
                  fontSize: 16,
                  lineHeight: 1.55,
                  color: t.inkSoft,
                  marginTop: 18,
                  textWrap: "balance",
                }}
              >
                If an account exists for{" "}
                <strong style={{ color: t.coal }}>{sanitizeEmail(email)}</strong>
                , we've sent a link to reset your password. The link expires in
                30 minutes.
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  marginTop: 32,
                }}
              >
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="hsx-link-indigo"
                  style={{
                    fontFamily: f.sans,
                    fontSize: 14,
                    fontWeight: 500,
                    color: t.indigo,
                    background: "transparent",
                    border: "none",
                    textDecoration: "none",
                    cursor: "pointer",
                    padding: 0,
                    alignSelf: "center",
                  }}
                >
                  Wrong email? Change it
                </button>
                <p
                  style={{
                    fontFamily: f.mono,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: t.inkFaint,
                    margin: 0,
                  }}
                >
                  Didn't see it? Check spam folder.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div
                className="hsx-login-hero"
                style={{
                  width: "100%",
                  textAlign: "center",
                  marginBottom: 36,
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
                  .
                </h1>
                <p
                  className="hsx-login-subtitle"
                  style={{
                    fontFamily: f.sans,
                    fontSize: 16,
                    lineHeight: 1.55,
                    color: t.inkSoft,
                    marginTop: 18,
                    marginBottom: 0,
                    textWrap: "balance",
                  }}
                >
                  Enter the email tied to your account. We'll send a link to
                  set a new password.
                </p>
              </div>

              <div
                className="hsx-login-form"
                style={{ width: "100%", maxWidth: 540 }}
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
                  style={{ display: "flex", flexDirection: "column", gap: 18 }}
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
                    placeholder="rahul@example.com"
                    autoFocus={shouldAutoFocus}
                    inputMode="email"
                    enterKeyHint="send"
                    maxLength={EMAIL_MAX_LENGTH}
                    invalid={!!error || (emailTouched && !!emailV.message)}
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
                          isGhost ? "Enter a valid email to continue" : undefined
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
                          marginTop: 6,
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
                          "Send reset link"
                        )}
                      </button>
                    );
                  })()}

                  <a
                    href="/login"
                    className="hsx-link-indigo"
                    style={{
                      fontFamily: f.sans,
                      fontSize: 14,
                      fontWeight: 500,
                      color: t.indigo,
                      textDecoration: "none",
                      textAlign: "center",
                      marginTop: 4,
                    }}
                  >
                    ← Back to log in
                  </a>
                </form>
              </div>
            </>
          )}
        </main>

        <footer
          className="hsx-login-footer"
          style={{
            textAlign: "center",
            padding: "20px 24px 28px",
            fontFamily: f.sans,
            fontSize: 12,
            color: t.inkFaint,
            lineHeight: 1.6,
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          For your security, reset links expire in 30 minutes and we limit how
          often they can be requested.
        </footer>
      </div>
    </>
  );
}
