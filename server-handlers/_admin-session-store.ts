/* I/O for admin sessions: Upstash revocation keys and the admin_audit_log table.
 * Pure decisions live in _admin-session-helpers.ts. Env is read per call (not at
 * module load) so the behaviour is testable and a rotated key needs no cold start. */

import { slog } from "./_shared";
import {
  NO_REVOCATIONS, REVOCATION_TTL_SEC, REVOKED_BEFORE_KEY, parseRevocationResults, revokedSidKey,
  type AdminAuditRow, type RevocationState,
} from "./_admin-session-helpers";

const REDIS_TIMEOUT_MS = 1500;
const AUDIT_TIMEOUT_MS = 750;

function redisConfig(): { url: string; token: string } | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  return url && token ? { url, token } : null;
}

async function pipeline(cfg: { url: string; token: string }, commands: Array<Array<string | number>>): Promise<unknown[]> {
  const res = await fetch(`${cfg.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`redis pipeline HTTP ${res.status}`);
  const data = await res.json() as Array<{ result?: unknown; error?: string }>;
  if (!Array.isArray(data) || data.some((d) => d?.error)) throw new Error("redis pipeline error");
  return data.map((d) => d.result ?? null);
}

/** Revocation lookup for one session. THROWS when Redis is configured but unreachable, so
 *  the caller fails closed. With no Redis configured (local dev) nothing can be revoked
 *  and the lookup is skipped; the 8h session cap still applies. */
export async function loadRevocationState(sid: string): Promise<RevocationState> {
  const cfg = redisConfig();
  if (!cfg) return NO_REVOCATIONS;
  return parseRevocationResults(await pipeline(cfg, [["GET", revokedSidKey(sid)], ["GET", REVOKED_BEFORE_KEY]]));
}

/** Revoke one session. Returns false when Redis is unavailable (the caller must say so). */
export async function revokeSession(sid: string): Promise<boolean> {
  const cfg = redisConfig();
  if (!cfg) return false;
  try {
    await pipeline(cfg, [["SET", revokedSidKey(sid), "1", "EX", REVOCATION_TTL_SEC]]);
    return true;
  } catch (err) {
    slog.error("admin-session: revoke failed", { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

/** Revoke every session signed in at or before `now`. */
export async function revokeAllSessions(now: number): Promise<boolean> {
  const cfg = redisConfig();
  if (!cfg) return false;
  try {
    await pipeline(cfg, [["SET", REVOKED_BEFORE_KEY, String(now), "EX", REVOCATION_TTL_SEC]]);
    return true;
  } catch (err) {
    slog.error("admin-session: revoke-all failed", { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

let warnedMissingTable = false;

/** Best-effort audit insert. Never throws and is bounded to AUDIT_TIMEOUT_MS, so neither a
 *  slow database nor a missing admin_audit_log table (migration 0058 not yet applied) can
 *  fail or stall an admin request. */
export async function recordAdminAudit(row: AdminAuditRow): Promise<void> {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return;
  try {
    const res = await fetch(`${url}/rest/v1/admin_audit_log`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(AUDIT_TIMEOUT_MS),
    });
    if (res.ok) return;
    if (res.status === 404 || res.status === 400) {
      if (!warnedMissingTable) {
        warnedMissingTable = true;
        slog.warn("admin-audit: insert rejected, is migration 0058-admin-audit-log applied?", { status: res.status });
      }
      return;
    }
    slog.warn("admin-audit: insert failed", { status: res.status });
  } catch (err) {
    slog.warn("admin-audit: insert errored", { error: err instanceof Error ? err.message : String(err) });
  }
}
