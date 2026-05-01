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
