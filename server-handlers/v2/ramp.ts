/* V2 canary ramp decision layer (2026-06-09).
 *
 * Pure decision function: given a sessionId and the current env, return
 * whether this session should be routed LIVE to v2 (its output served
 * to the user) or stay on v1. Shadow-mode telemetry is unaffected —
 * shadow runs on every session regardless of routing.
 *
 * Three knobs:
 *   NEGOTIATION_V2_KILL=1          — kill switch. Forces all sessions to
 *                                    v1 regardless of ramp percent.
 *                                    Always honored first.
 *   NEGOTIATION_V2_RAMP_PCT=0..100 — percent of sessions to route to v2.
 *                                    Default 0 (shadow-only). Hashing on
 *                                    sessionId keeps routing stable across
 *                                    turns within a session — a session
 *                                    that started on v2 stays on v2.
 *   NEGOTIATION_V2_RAMP_ALLOWLIST  — comma-separated sessionId / userId
 *                                    prefixes that are unconditionally
 *                                    routed to v2 regardless of percent.
 *                                    For internal QA before broad ramp.
 *
 * The decision function is pure: no I/O, no logging. Telemetry is
 * emitted separately by the caller using `describeDecision()` so this
 * file stays trivially testable. */

export type RampReason =
  | "kill-switch"
  | "allowlist"
  | "in-cohort"
  | "out-of-cohort"
  | "ramp-zero";

export interface RampDecision {
  /** true → serve v2 output. false → serve v1 output (shadow still runs). */
  routeV2: boolean;
  /** Why. Goes to telemetry, not to the user. */
  reason: RampReason;
  /** The ramp percent we used. */
  rampPct: number;
  /** The session bucket (0-99) we hashed into. Stable across turns. */
  bucket: number;
}

export interface RampEnv {
  kill?: string;
  rampPct?: string;
  allowlist?: string;
}

/** Read the ramp env. Default reads process.env; tests inject. */
export function readRampEnv(): RampEnv {
  return {
    kill: process.env.NEGOTIATION_V2_KILL,
    rampPct: process.env.NEGOTIATION_V2_RAMP_PCT,
    allowlist: process.env.NEGOTIATION_V2_RAMP_ALLOWLIST,
  };
}

/** Deterministic hash → bucket 0..99. We use a small FNV-1a variant so
 *  the hash is portable (no Node crypto dep) and stable across processes.
 *  A given sessionId ALWAYS maps to the same bucket — critical because
 *  the routing decision must not flip mid-session. */
export function sessionBucket(sessionId: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < sessionId.length; i++) {
    h ^= sessionId.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 100;
}

function parsePct(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.floor(n);
}

function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** The decision function. Pure, deterministic for a given (sessionId, env). */
export function shouldRouteV2(sessionId: string, env: RampEnv = readRampEnv()): RampDecision {
  const bucket = sessionBucket(sessionId);
  const rampPct = parsePct(env.rampPct);

  /* Kill switch is honored FIRST and unconditionally — even allowlisted
   * sessions go back to v1 when this is set. The point of a kill switch
   * is that ONE env flip flushes everyone. */
  if (env.kill === "1") {
    return { routeV2: false, reason: "kill-switch", rampPct, bucket };
  }

  const allow = parseAllowlist(env.allowlist);
  if (allow.some((prefix) => sessionId.startsWith(prefix))) {
    return { routeV2: true, reason: "allowlist", rampPct, bucket };
  }

  if (rampPct === 0) {
    return { routeV2: false, reason: "ramp-zero", rampPct, bucket };
  }

  if (bucket < rampPct) {
    return { routeV2: true, reason: "in-cohort", rampPct, bucket };
  }
  return { routeV2: false, reason: "out-of-cohort", rampPct, bucket };
}

/** Telemetry payload helper. Callers fire this on `v2_route_decision`. */
export function describeDecision(decision: RampDecision): Record<string, unknown> {
  return {
    v2_routed: decision.routeV2,
    v2_route_reason: decision.reason,
    v2_ramp_pct: decision.rampPct,
    v2_route_bucket: decision.bucket,
  };
}
