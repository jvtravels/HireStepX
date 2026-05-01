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
    how systems wrongly reject "O'Brien" or "राहुल". Max length matches
    server-side cap in AuthContext.signup() (48 chars). */
export function validateName(value: string): FieldValidation {
  const trimmed = value.trim();
  if (trimmed.length === 0) return { valid: false, message: null };
  if (trimmed.length < 2) {
    return { valid: false, message: "Please enter your name." };
  }
  if (trimmed.length > 48) {
    return { valid: false, message: "Name must be 48 characters or fewer." };
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

/** Signup-grade password validator. Matches the server-side rules in
    AuthContext.signup() exactly so the client checklist never shows
    "all green" while the server rejects: length ≥8 + uppercase + digit
    + symbol (all three required). Lowercase is recommended but optional. */
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

  // Server-required criteria: uppercase, number, symbol (all three).
  // Lowercase is bonus — boosts the strength meter but isn't required.
  const requiredVariety =
    Number(checks.uppercase) + Number(checks.number) + Number(checks.symbol);
  const totalVariety = requiredVariety + Number(checks.lowercase);
  const longBonus = value.length >= 14 ? 1 : 0;
  const score = Math.min(4, totalVariety + longBonus - 1) as
    | 0
    | 1
    | 2
    | 3
    | 4;
  const safeScore = Math.max(1, score) as 0 | 1 | 2 | 3 | 4;

  if (requiredVariety < 3) {
    return {
      valid: false,
      message: null, // the checklist tells the user what's missing
      score: safeScore,
      label: "Weak",
      checks,
    };
  }

  return {
    valid: true,
    message: null,
    score: safeScore,
    label: safeScore >= 4 ? "Strong" : "Good",
    checks,
  };
}
