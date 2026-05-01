/* HireStepX — Auth / Fields & Icons
   Shared atoms for all auth screens (Login, Signup, ForgotPassword, etc).
   No business logic — pure presentation + local interaction state. */
import React, { useState, useId, useEffect, useRef } from "react";
import { tokens as t, fonts as f } from "./_tokens";

/* ─── Icons ─── */

export function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.92v2.32A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71a5.41 5.41 0 0 1 0-3.42V4.97H.92a9 9 0 0 0 0 8.06l3.05-2.32z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.99 8.99 0 0 0 .92 4.97l3.05 2.32C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

export function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ animation: "hsx-spin 0.8s linear infinite" }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="2.5"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

/* ─── Field ─── */

export interface FieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  rightSlot?: React.ReactNode;
  name?: string;
  autoFocus?: boolean;
  /** Controls visual + aria invalid state. */
  invalid?: boolean;
  /** Inline error message rendered below the field. */
  errorMessage?: string | null;
  onFocus?: () => void;
  /** Mobile-keyboard hints. */
  inputMode?: "text" | "email" | "tel" | "url" | "search" | "numeric" | "decimal";
  enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
  /** Hard cap on length — prevents OOM and matches RFC limits. */
  maxLength?: number;
  /** Fired when the browser autofills this field (paste / 1Password / Chrome). */
  onAutofill?: () => void;
}

export function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  rightSlot,
  name,
  autoFocus,
  invalid,
  errorMessage,
  onFocus,
  inputMode,
  enterKeyHint,
  maxLength,
  onAutofill,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasError = invalid && !!errorMessage;

  // Autofill detection — Chrome/Safari fire :-webkit-autofill which we hook
  // via a sentinel CSS animation. This lets us mark the field as "touched"
  // when a password manager or browser autofills it (otherwise touched
  // state stays false and per-field errors never appear).
  useEffect(() => {
    const el = inputRef.current;
    if (!el || !onAutofill) return;
    const handler = (e: AnimationEvent) => {
      if (e.animationName === "hsx-autofill-start") onAutofill();
    };
    el.addEventListener("animationstart", handler);
    return () => el.removeEventListener("animationstart", handler);
  }, [onAutofill]);

  return (
    <div>
      <label
        className="hsx-login-field-label"
        style={{
          display: "block",
          fontFamily: f.sans,
          fontSize: 14,
          fontWeight: 500,
          color: t.coal,
          marginBottom: 8,
        }}
      >
        {label}
      </label>
      <div
        style={{
          position: "relative",
          background: t.white,
          border: `1px solid ${
            invalid ? t.error : focused ? t.indigo : t.line
          }`,
          borderRadius: 10,
          boxShadow: focused
            ? `0 0 0 4px ${invalid ? "rgba(185, 28, 28, 0.18)" : t.indigoRing}`
            : "none",
          transition:
            "border-color 150ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <input
          ref={inputRef}
          type={type}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          autoFocus={autoFocus}
          inputMode={inputMode}
          enterKeyHint={enterKeyHint}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          aria-describedby={hasError ? errorId : undefined}
          onFocus={() => {
            setFocused(true);
            onFocus?.();
          }}
          onBlur={() => setFocused(false)}
          className={`hsx-login-field-input${rightSlot ? " has-slot" : ""}`}
          style={{
            width: "100%",
            fontFamily: f.sans,
            fontSize: 15,
            color: t.coal,
            background: "transparent",
            border: "none",
            borderRadius: 10,
            padding: rightSlot ? "14px 44px 14px 16px" : "14px 16px",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {rightSlot && (
          <div
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
            }}
          >
            {rightSlot}
          </div>
        )}
      </div>
      {/* aria-live="polite" announces during natural pauses; role="alert"
          would interrupt repeatedly as the user types. Field errors are
          informational, not urgent. */}
      <p
        id={errorId}
        className="hsx-field-error"
        aria-live="polite"
        style={{
          fontFamily: f.sans,
          fontSize: 12,
          color: t.error,
          margin: hasError ? "6px 2px 0" : 0,
          height: hasError ? "auto" : 0,
          overflow: "hidden",
          lineHeight: 1.4,
        }}
      >
        {hasError ? errorMessage : ""}
      </p>
    </div>
  );
}

/* ─── Checkbox ─── */

export interface CheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  /** Helper text shown via title + aria-describedby for consent context */
  description?: string;
}

export function Checkbox({ checked, onChange, label, description }: CheckboxProps) {
  const [focused, setFocused] = useState(false);
  const descId = useId();
  return (
    <label
      title={description}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        fontFamily: f.sans,
        fontSize: 13,
        color: t.inkSoft,
        userSelect: "none",
        position: "relative",
      }}
    >
      {/* Real checkbox — visually hidden but keyboard-focusable */}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-describedby={description ? descId : undefined}
        style={{
          position: "absolute",
          width: 16,
          height: 16,
          opacity: 0,
          margin: 0,
          cursor: "pointer",
        }}
      />
      {description && (
        <span id={descId} style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
          {description}
        </span>
      )}
      <span
        aria-hidden="true"
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          border: `1.5px solid ${checked ? t.indigo : t.lineStrong}`,
          background: checked ? t.indigo : t.white,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.12s ease",
          flexShrink: 0,
          boxShadow: focused ? `0 0 0 3px ${t.indigoRing}` : "none",
        }}
      >
        {checked && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            stroke={t.cream}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path className="hsx-check-path" d="M2 6.5L4.8 9.2 10 3.5" />
          </svg>
        )}
      </span>
      <span>{label}</span>
    </label>
  );
}

/* ─── Password Strength Meter ─── */

export interface PasswordStrengthMeterProps {
  /** 0 (empty) → 4 (strong) */
  score: 0 | 1 | 2 | 3 | 4;
  /** Display label, e.g. "Weak" / "Good" / "Strong" */
  label?: string;
}

export function PasswordStrengthMeter({
  score,
  label,
}: PasswordStrengthMeterProps) {
  // 4 segment bars; how many are filled depends on score.
  // Color graduates from error → warning → success.
  const filled = Math.max(0, Math.min(4, score));
  const colors = [t.line, t.error, t.error, t.warning ?? t.copper, t.success];
  const barColor = colors[filled] ?? t.line;
  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginTop: 8,
      }}
    >
      <div style={{ display: "flex", gap: 4, flex: 1 }}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i < filled ? barColor : t.line,
              transition: "background 200ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        ))}
      </div>
      {label && (
        <span
          style={{
            fontFamily: f.mono,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: filled <= 1 ? t.error : filled <= 2 ? t.inkSoft : t.success,
            minWidth: 64,
            textAlign: "right",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/* ─── Wordmark ─── */

export function Wordmark() {
  return (
    <div
      className="hsx-wordmark hsx-login-wordmark"
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 0,
        fontFamily: f.serif,
        fontSize: 22,
        fontWeight: 600,
        color: t.coal,
        letterSpacing: -0.4,
        cursor: "default",
      }}
    >
      <span>HireStep</span>
      <span
        className="hsx-wordmark-x"
        style={{ fontStyle: "italic", color: t.copper }}
      >
        X
      </span>
    </div>
  );
}
