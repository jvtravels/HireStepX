/* HireStepX — Auth / Validation
   Pure validators. No React, no DOM, no side effects. Unit-testable. */

export interface FieldValidation {
  valid: boolean;
  message: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): FieldValidation {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { valid: false, message: null }; // empty is "not yet" not "wrong"
  }
  if (!EMAIL_RE.test(trimmed)) {
    return { valid: false, message: "Enter a valid email address." };
  }
  return { valid: true, message: null };
}

export function validatePassword(value: string): FieldValidation {
  if (value.length === 0) {
    return { valid: false, message: null };
  }
  if (value.length < 6) {
    return { valid: false, message: "Must be at least 6 characters." };
  }
  return { valid: true, message: null };
}

/** Sanitize an email for submission. Trims whitespace; lowercases the
    domain (RFC 5321 §2.3.11). The local part is left as-is to preserve
    case-sensitive providers (rare but legal). */
export function sanitizeEmail(value: string): string {
  const trimmed = value.trim();
  const at = trimmed.lastIndexOf("@");
  if (at < 0) return trimmed;
  return trimmed.slice(0, at) + "@" + trimmed.slice(at + 1).toLowerCase();
}

/** Detect leading/trailing whitespace in a password — should warn the
    user before submit since most servers reject it as malformed. */
export function passwordHasEdgeWhitespace(value: string): boolean {
  return value.length > 0 && value !== value.trim();
}

/** Name validator (signup). Names can be one word, multilingual, with
    spaces, hyphens, apostrophes. Don't be over-prescriptive — that's
    how systems wrongly reject "O'Brien" or "राहुल". */
export function validateName(value: string): FieldValidation {
  const trimmed = value.trim();
  if (trimmed.length === 0) return { valid: false, message: null };
  if (trimmed.length < 2) {
    return { valid: false, message: "Please enter your name." };
  }
  if (trimmed.length > 64) {
    return { valid: false, message: "Name must be 64 characters or fewer." };
  }
  return { valid: true, message: null };
}

/** Per-criterion checks exposed for the live checklist UI. */
export interface PasswordChecks {
  length: boolean;
  lowercase: boolean;
  uppercase: boolean;
  number: boolean;
  symbol: boolean;
}

/** Signup-grade password validator. Min 8 chars + at least 3 of:
    lowercase / uppercase / digit / symbol. Returns score 0-4 for the
    strength meter, individual checks for the live checklist, and an
    actionable message when invalid. */
export interface PasswordStrength extends FieldValidation {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  checks: PasswordChecks;
}

export function validateSignupPassword(value: string): PasswordStrength {
  const checks: PasswordChecks = {
    length: value.length >= 8,
    lowercase: /[a-z]/.test(value),
    uppercase: /[A-Z]/.test(value),
    number: /[0-9]/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
  };

  if (value.length === 0) {
    return { valid: false, message: null, score: 0, label: "", checks };
  }
  if (!checks.length) {
    return {
      valid: false,
      message: null, // checklist communicates this
      score: 1,
      label: "Too short",
      checks,
    };
  }

  const variety =
    Number(checks.lowercase) +
    Number(checks.uppercase) +
    Number(checks.number) +
    Number(checks.symbol);
  const longBonus = value.length >= 14 ? 1 : 0;
  const score = Math.min(4, variety + longBonus) as 0 | 1 | 2 | 3 | 4;

  if (variety < 3) {
    return {
      valid: false,
      message: null, // the checklist tells the user what's missing
      score: Math.max(1, score) as 0 | 1 | 2 | 3 | 4,
      label: "Weak",
      checks,
    };
  }

  return {
    valid: true,
    message: null,
    score,
    label: score >= 4 ? "Strong" : "Good",
    checks,
  };
}
