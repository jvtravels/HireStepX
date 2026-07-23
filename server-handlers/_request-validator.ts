/* API boundary request validator (2026-05-21).
 *
 * Audit follow-up. The negotiate-turn handler used to read body fields
 * with `body.X || default` coercion — fine for primitives, but the
 * untyped `resumeFactPack` / `parsedResume` blobs flowed straight into
 * the kernel and the optional string fields had no presence / length
 * guard. A malformed payload (e.g. `turnIndex: "3"` as a string,
 * `resumeFactPack: "[object Object]"`, candidateAnswer 2 MB long)
 * would reach the kernel and either coerce silently or throw deep in
 * the parser.
 *
 * This module owns the shape validation. It is intentionally plain TS
 * (no zod) to keep the dependency surface small and match the rest of
 * the codebase. The contract is Result-style:
 *
 *   validateInitRequest(raw)
 *   validateTurnRequest(raw)
 *
 *   → { ok: true; body: ValidatedInitRequest | ValidatedTurnRequest }
 *   → { ok: false; status: 400; error: string }
 *
 * Unknown extra fields are tolerated (forwards-compat). Wrong-typed
 * fields, fields exceeding documented bounds, and missing required
 * fields are rejected at the boundary with a precise error message.
 */

import type { NegotiationBand } from "./_negotiation-kernel";

/* ───────── Validated shapes ───────── */

export interface ValidatedInitRequest {
  action: "init";
  sessionId: string;
  role: string;
  company: string;
  band?: NegotiationBand;
  maxTurns?: number;
  experienceLevel?: string;
  totalYoe: number | null;
  applicableYoe: number | null;
  primaryDomain: string | null;
  collegeTier: "tier-1" | "tier-2" | "tier-3" | null;
  internshipMonths?: number;
  /** B6 — candidate's pre-stated total-CTC target (LPA). Client sends
   *  this from the setup wizard's "target salary" field so the server
   *  can clamp the opening offer to leave a meaningful negotiation gap.
   *  Optional: null when the candidate has not stated a target. */
  candidateTargetLpa?: number | null;
  /* The kernel re-validates pack shape during build; the validator
   * here only asserts "is an object, not a string or array". The
   * imported types are used at the boundary so downstream callers
   * (initState, buildFactPack) receive the expected nominal types
   * without an additional cast at the call site. */
  resumeFactPack: import("./_resume-fact-pack").ResumeFactPack | null;
  parsedResume: import("./_resume-fact-pack").ParsedResume | null;
}

export interface ValidatedTurnRequest {
  action: "turn";
  state: string;
  candidateAnswer: string;
}

export type ValidationResult<T> =
  | { ok: true; body: T }
  | { ok: false; status: 400; error: string };

/* ───────── Bounds ───────── *
 *
 * `MAX_CANDIDATE_ANSWER_BYTES` is intentionally generous (20 KB) — the
 * kernel's prompt-artifact boundary check defends against pasted
 * jailbreak payloads downstream, this is just a denial-of-service
 * floor. `MAX_STATE_BYTES` matches the auth middleware's existing
 * 32 KB request cap. */
const MAX_CANDIDATE_ANSWER_BYTES = 20_000;
const MAX_STATE_BYTES = 32_000;
const MAX_ROLE_LEN = 200;
const MAX_COMPANY_LEN = 200;
const MAX_SESSION_ID_LEN = 200;
const MAX_EXPERIENCE_LEVEL_LEN = 64;
const MAX_PRIMARY_DOMAIN_LEN = 64;

/* Accepted collegeTier values (mirrors the inline check at the old
 * coercion site). Anything else is mapped to null. */
const VALID_COLLEGE_TIERS = new Set(["tier-1", "tier-2", "tier-3"]);

/* ───────── Helpers ───────── */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function reject(msg: string): { ok: false; status: 400; error: string } {
  return { ok: false, status: 400, error: msg };
}

/* ───────── Public entry points ───────── */

export function validateInitRequest(raw: unknown): ValidationResult<ValidatedInitRequest> {
  if (!isPlainObject(raw)) return reject("body: expected object");
  if (raw.action !== "init") return reject('action: expected "init"');

  /* sessionId — required, non-empty string, bounded. The kernel uses
   * this as the idempotency key prefix; an empty string would collapse
   * unrelated sessions into the same idempotency window. */
  const sessionId = raw.sessionId;
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    return reject("sessionId: expected non-empty string");
  }
  if (sessionId.length > MAX_SESSION_ID_LEN) {
    return reject(`sessionId: max length ${MAX_SESSION_ID_LEN}`);
  }

  /* role / company — optional but if present must be strings. Falsy
   * preserves the handler's existing default behaviour (`role || "swe"`,
   * `company || ""`). */
  let role: string;
  if (raw.role === undefined || raw.role === null || raw.role === "") {
    role = "";
  } else if (typeof raw.role === "string" && raw.role.length <= MAX_ROLE_LEN) {
    role = raw.role;
  } else {
    return reject(`role: expected string ≤ ${MAX_ROLE_LEN} chars`);
  }

  let company: string;
  if (raw.company === undefined || raw.company === null || raw.company === "") {
    company = "";
  } else if (typeof raw.company === "string" && raw.company.length <= MAX_COMPANY_LEN) {
    company = raw.company;
  } else {
    return reject(`company: expected string ≤ ${MAX_COMPANY_LEN} chars`);
  }

  /* experienceLevel — optional string, bounded. */
  let experienceLevel: string | undefined;
  if (raw.experienceLevel !== undefined && raw.experienceLevel !== null) {
    if (typeof raw.experienceLevel !== "string" || raw.experienceLevel.length > MAX_EXPERIENCE_LEVEL_LEN) {
      return reject(`experienceLevel: expected string ≤ ${MAX_EXPERIENCE_LEVEL_LEN} chars`);
    }
    experienceLevel = raw.experienceLevel;
  }

  /* maxTurns — optional finite positive number, clamped externally. */
  let maxTurns: number | undefined;
  if (raw.maxTurns !== undefined && raw.maxTurns !== null) {
    if (!isFiniteNumber(raw.maxTurns) || raw.maxTurns <= 0 || raw.maxTurns > 100) {
      return reject("maxTurns: expected finite number in (0, 100]");
    }
    maxTurns = raw.maxTurns;
  }

  /* totalYoe / applicableYoe — both number-or-null.
   *
   * DEBT #4 (2026-05-21) — explicit-reject ordering. The earlier shape
   * coerced first and then re-checked, which read as "silently absorb a
   * bad value, then maybe complain". Invert: assert the shape first,
   * then bind the local from the (now-trusted) raw field. Same external
   * behaviour, clearer intent, no two-step coercion-then-check. */
  if (raw.totalYoe != null && !isFiniteNumber(raw.totalYoe)) {
    return reject("totalYoe: expected finite number or null");
  }
  const totalYoe = (raw.totalYoe as number | null | undefined) ?? null;
  if (raw.applicableYoe != null && !isFiniteNumber(raw.applicableYoe)) {
    return reject("applicableYoe: expected finite number or null");
  }
  const applicableYoe = (raw.applicableYoe as number | null | undefined) ?? null;

  /* primaryDomain — string-or-null with length cap. */
  let primaryDomain: string | null = null;
  if (typeof raw.primaryDomain === "string" && raw.primaryDomain.length > 0) {
    if (raw.primaryDomain.length > MAX_PRIMARY_DOMAIN_LEN) {
      return reject(`primaryDomain: max length ${MAX_PRIMARY_DOMAIN_LEN}`);
    }
    primaryDomain = raw.primaryDomain;
  }

  /* collegeTier — enum or null. */
  const collegeTier =
    typeof raw.collegeTier === "string" && VALID_COLLEGE_TIERS.has(raw.collegeTier)
      ? (raw.collegeTier as "tier-1" | "tier-2" | "tier-3")
      : null;

  /* internshipMonths — optional 1..12 finite number. The clamp lives
   * downstream in resolveServerBand; we only reject non-numeric or
   * out-of-realistic-range values here. */
  let internshipMonths: number | undefined;
  if (raw.internshipMonths !== undefined && raw.internshipMonths !== null) {
    if (!isFiniteNumber(raw.internshipMonths) || raw.internshipMonths < 0 || raw.internshipMonths > 60) {
      return reject("internshipMonths: expected finite number in [0, 60]");
    }
    internshipMonths = raw.internshipMonths;
  }

  /* band — optional. The handler IGNORES client-supplied band for
   * security (recomputed server-side from role/company). Still
   * type-check it so we can return a clear error rather than letting
   * a 5 MB nested blob through. */
  let band: NegotiationBand | undefined;
  if (raw.band !== undefined && raw.band !== null) {
    if (!isPlainObject(raw.band)) return reject("band: expected object");
    band = raw.band as unknown as NegotiationBand;
  }

  /* candidateTargetLpa — optional finite positive number (LPA). The
   * client sends the candidate's pre-stated target salary from the setup
   * wizard so the server can clamp the opening offer to leave headroom.
   * Out-of-range values (≤0 or non-finite) are treated as absent. */
  let candidateTargetLpa: number | null | undefined;
  if (raw.candidateTargetLpa != null) {
    if (!isFiniteNumber(raw.candidateTargetLpa) || (raw.candidateTargetLpa as number) <= 0) {
      return reject("candidateTargetLpa: expected positive finite number or null");
    }
    candidateTargetLpa = raw.candidateTargetLpa as number;
  } else {
    candidateTargetLpa = null;
  }

  /* resumeFactPack / parsedResume — must be plain objects when present.
   * Strings or arrays here would corrupt downstream parsers; the kernel
   * does its own field-level validation but a string here used to make
   * `pack.priorCompanies.length` throw deep in the pipeline. */
  type PackT = import("./_resume-fact-pack").ResumeFactPack;
  type ResumeT = import("./_resume-fact-pack").ParsedResume;
  const resumeFactPack: PackT | null | undefined =
    raw.resumeFactPack === undefined || raw.resumeFactPack === null
      ? null
      : isPlainObject(raw.resumeFactPack)
        ? (raw.resumeFactPack as unknown as PackT)
        : undefined;
  if (resumeFactPack === undefined) return reject("resumeFactPack: expected object or null");

  const parsedResume: ResumeT | null | undefined =
    raw.parsedResume === undefined || raw.parsedResume === null
      ? null
      : isPlainObject(raw.parsedResume)
        ? (raw.parsedResume as unknown as ResumeT)
        : undefined;
  if (parsedResume === undefined) return reject("parsedResume: expected object or null");

  return {
    ok: true,
    body: {
      action: "init",
      sessionId,
      role,
      company,
      band,
      maxTurns,
      experienceLevel,
      totalYoe,
      applicableYoe,
      primaryDomain,
      collegeTier,
      internshipMonths,
      candidateTargetLpa,
      resumeFactPack,
      parsedResume,
    },
  };
}

export function validateTurnRequest(raw: unknown): ValidationResult<ValidatedTurnRequest> {
  if (!isPlainObject(raw)) return reject("body: expected object");
  if (raw.action !== "turn") return reject('action: expected "turn"');

  if (typeof raw.state !== "string" || raw.state.length === 0) {
    return reject("state: expected non-empty string (serialized NegotiationState)");
  }
  if (raw.state.length > MAX_STATE_BYTES) {
    return reject(`state: max length ${MAX_STATE_BYTES} bytes`);
  }

  if (typeof raw.candidateAnswer !== "string") {
    return reject("candidateAnswer: expected string");
  }
  if (raw.candidateAnswer.length > MAX_CANDIDATE_ANSWER_BYTES) {
    return reject(`candidateAnswer: max length ${MAX_CANDIDATE_ANSWER_BYTES} bytes`);
  }

  return {
    ok: true,
    body: {
      action: "turn",
      state: raw.state,
      candidateAnswer: raw.candidateAnswer,
    },
  };
}

/* Top-level dispatch. Looks at body.action to pick the right validator.
 * Used by the handler so the route code stays a single call. */
export function validateRequestBody(
  raw: unknown,
): ValidationResult<ValidatedInitRequest | ValidatedTurnRequest> {
  if (!isPlainObject(raw)) return reject("body: expected object");
  if (raw.action === "init") return validateInitRequest(raw);
  if (raw.action === "turn") return validateTurnRequest(raw);
  return reject('action: expected "init" or "turn"');
}
