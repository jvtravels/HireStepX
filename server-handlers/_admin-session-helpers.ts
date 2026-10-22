/* Pure admin-session logic: token claim parsing, expiry / revocation / MFA
 * decisions, and audit-row shaping. No I/O, so it is unit-testable in isolation
 * (see adminSessionHelpers.test.ts). Redis + Supabase access lives in
 * _admin-session-store.ts.
 *
 * The admin console authenticates with one shared password (+ optional TOTP)
 * and a signed HMAC session token, not a Supabase user. There is therefore no
 * per-person identity: the "who" in the audit trail is the session id (`sid`),
 * and "MFA" means the token was minted after a verified TOTP code. */

/** Absolute cap on a session, measured from the original sign-in (`ast`).
 *  Refreshed tokens inherit `ast`, so activity can never stretch it. */
export const ADMIN_SESSION_MAX_MS = 8 * 60 * 60 * 1000;

/** Redis key for a revoke-everything cutoff (ms timestamp). */
export const REVOKED_BEFORE_KEY = "admin:revoked-before";
export const revokedSidKey = (sid: string) => `admin:revoked:${sid}`;
/** Revocation entries only matter until the session cap would have expired the token anyway. */
export const REVOCATION_TTL_SEC = Math.ceil(ADMIN_SESSION_MAX_MS / 1000) + 3600;

export const ADMIN_ACTOR = "shared-admin";

export interface AdminClaims {
  iat: number;
  exp: number;
  /** Sign-in time (ms). Carried unchanged through every token refresh. */
  ast: number;
  /** Session id, null on tokens minted before session ids existed. */
  sid: string | null;
  /** A TOTP code was verified when this session was created. */
  mfa: boolean;
}

const SID_RE = /^[A-Za-z0-9-]{8,64}$/;

export function parseAdminClaims(raw: unknown): AdminClaims | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.iat !== "number" || !Number.isFinite(p.iat)) return null;
  if (typeof p.exp !== "number" || !Number.isFinite(p.exp)) return null;
  const ast = typeof p.ast === "number" && Number.isFinite(p.ast) ? p.ast : p.iat;
  const sid = typeof p.sid === "string" && SID_RE.test(p.sid) ? p.sid : null;
  return { iat: p.iat, exp: p.exp, ast, sid, mfa: p.mfa === true };
}

/** Expiry for a (re)issued token: sliding idle window, never past the session cap. */
export function tokenExpiry(now: number, authTime: number, idleTtlMs: number): number {
  return Math.min(now + idleTtlMs, authTime + ADMIN_SESSION_MAX_MS);
}

export function isMfaRequired(envValue: string | undefined): boolean {
  return (envValue || "").trim() === "1";
}

export interface RevocationState {
  sidRevoked: boolean;
  /** Sessions signed in at or before this instant are revoked. */
  revokedBeforeMs: number | null;
}

export const NO_REVOCATIONS: RevocationState = { sidRevoked: false, revokedBeforeMs: null };

export type SessionDenial = {
  ok: false;
  status: 401 | 403;
  code: "session_expired" | "session_revoked" | "mfa_required";
  error: string;
};

export function evaluateSession(
  claims: AdminClaims,
  ctx: { now: number; requireMfa: boolean } & RevocationState,
): { ok: true } | SessionDenial {
  const expired: SessionDenial = { ok: false, status: 401, code: "session_expired", error: "Session expired. Please sign in again." };
  // Tokens without a session id can't be revoked individually, so they are not honoured.
  if (!claims.sid) return expired;
  if (ctx.now > claims.exp) return expired;
  if (ctx.now > claims.ast + ADMIN_SESSION_MAX_MS) return expired;
  if (ctx.sidRevoked || (ctx.revokedBeforeMs !== null && claims.ast <= ctx.revokedBeforeMs)) {
    return { ok: false, status: 401, code: "session_revoked", error: "Session was revoked. Please sign in again." };
  }
  if (ctx.requireMfa && !claims.mfa) {
    return { ok: false, status: 403, code: "mfa_required", error: "Two-factor authentication is required for admin access." };
  }
  return { ok: true };
}

/** Interpret the [GET sid-key, GET revoked-before] Upstash pipeline results. */
export function parseRevocationResults(results: unknown): RevocationState {
  const arr = Array.isArray(results) ? results : [];
  const before = Number(arr[1]);
  return {
    sidRevoked: arr[0] !== null && arr[0] !== undefined,
    revokedBeforeMs: arr[1] != null && Number.isFinite(before) ? before : null,
  };
}

export function readCookie(header: string, name: string): string | undefined {
  const prefix = `${name}=`;
  const hit = header.split(";").map((c) => c.trim()).find((c) => c.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

/** Node's header bag → Web Headers, so getClientIp() (which takes a Request) can be reused. */
export function toWebHeaders(h: Record<string, string | string[] | undefined>): Headers {
  const out = new Headers();
  for (const [k, v] of Object.entries(h)) {
    if (typeof v === "string") out.set(k, v);
    else if (Array.isArray(v) && v.length) out.set(k, v.join(", "));
  }
  return out;
}

/* ─── Audit rows ─── */

export interface AdminAuditRow {
  admin_user_id: string;
  session_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  outcome: string;
  ip: string | null;
  meta: Record<string, string | number | boolean>;
}

const RESOURCE_FIELDS: Array<[string, string]> = [
  ["userId", "user"], ["sessionId", "session"], ["employerId", "employer"], ["paymentId", "payment"],
  ["requirementId", "requirement"], ["flagId", "message_flag"], ["reportId", "employer_report"], ["id", "record"],
];
/** Scalar request fields safe to keep: enums, counts and amounts. Free text (search, note,
 *  reason, subject, htmlBody) is excluded because it can carry PII. */
const META_FIELDS = ["tier", "days", "qty", "amountPaise", "status", "flagStatus", "month", "scope"] as const;

const clean = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.length > 0 ? v.slice(0, max) : null;

export function describeAdminAction(
  section: string,
  body: Record<string, unknown> | undefined,
): Pick<AdminAuditRow, "action" | "resource_type" | "resource_id" | "meta"> {
  const b = body ?? {};
  let resource_type: string | null = null;
  let resource_id: string | null = null;
  for (const [field, type] of RESOURCE_FIELDS) {
    const id = clean(b[field], 80);
    if (id) { resource_type = type; resource_id = id; break; }
  }
  const meta: Record<string, string | number | boolean> = {};
  for (const f of META_FIELDS) {
    const v = b[f];
    if (typeof v === "number" && Number.isFinite(v)) meta[f] = v;
    else if (typeof v === "string" && v.length <= 32) meta[f] = v;
  }
  if (Array.isArray(b.matchIds)) meta.matchCount = b.matchIds.length;
  if (typeof b.search === "string" && b.search.length > 0) meta.hasSearch = true;
  return { action: section.replace(/[^\w-]/g, "").slice(0, 64) || "unknown", resource_type, resource_id, meta };
}
