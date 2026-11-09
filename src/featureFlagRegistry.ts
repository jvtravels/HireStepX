/* ─── Feature flag registry + resolution (shared client/server) ─── */
/* Dependency-free on purpose: imported by the browser module
   (featureFlags.ts) and by edge handlers (server-handlers/_feature-flags.ts),
   so both sides agree on defaults, rollout hashing, and precedence. */

export interface FeatureFlag {
  description: string;
  /** Code default when no override or remote value exists. */
  enabled: boolean;
  /** Percentage rollout (0-100) keyed on userId hash; ignored without a userId. */
  rolloutPercent?: number;
  /** "global" kill switches are evaluated once for everyone (cheap, cacheable
      server-side); "user" flags are evaluated per person for targeting. */
  scope: "global" | "user";
  /** Hard-gated to STAGING_HOST: resolves false everywhere else, even under
      an operator override or a remote "on" value. For features mid-build
      that must not reach production candidates yet. */
  stagingOnly?: boolean;
}

/** staging.hirestepx.com is a DNS alias of the production deployment (same
    Vercel env), so this is the only way to tell them apart — see next.config.js's
    host-based rewrites for the same distinction applied to routes. */
export const STAGING_HOST = "staging.hirestepx.com";

/**
 * Declared flags must have a real consumer: unused entries rot and suggest
 * features that don't exist. HOMEPAGE_V2 was removed once the legacy
 * homepage was deleted (nothing left to fall back to).
 */
export const FLAGS = {
  SALARY_NEGOTIATION_MODE: {
    description: "Salary negotiation interview type. Off → hidden as 'Coming soon' in setup and /api/negotiate-turn returns 503.",
    enabled: true,
    scope: "global",
  },
  LLM_TOKEN_CAP: {
    description: "Per-user daily LLM token ceiling on enhancement endpoints. Off → cap is not enforced (kill switch if it wrongly blocks users).",
    enabled: true,
    scope: "global",
  },
  DESIGNER_LOOP_MODE: {
    description: "Designer-track interview loop (Portfolio Review + Design Exercise rounds, plus unlocking Panel Interview/Strategic for the designer family). Off → those focuses stay 'Coming soon' in setup for designer-family users. Staging-only while in build (see stagingOnly) — not yet cleared for production candidates. Staged rollout once promoted: internal → 10% of designer candidates → everyone.",
    enabled: false,
    rolloutPercent: 10,
    scope: "user",
    stagingOnly: true,
  },
} as const satisfies Record<string, FeatureFlag>;

export type FlagName = keyof typeof FLAGS;

export function isFlagName(name: string): name is FlagName {
  return Object.prototype.hasOwnProperty.call(FLAGS, name);
}

/** Remote providers (PostHog) use kebab-case keys: SALARY_NEGOTIATION_MODE → salary-negotiation-mode. */
export function remoteKeyFor(name: FlagName): string {
  return name.toLowerCase().replace(/_/g, "-");
}

/* FNV-1a 32-bit hash mod 100 — fast, well-distributed, deterministic */
export function hashPercent(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash % 100;
}

export interface FlagInputs {
  /** Local/operator override (dev localStorage on the client, FF_* env on the server). */
  override?: boolean;
  /** Value from the remote provider; undefined = flag not defined there or not loaded. */
  remote?: boolean;
  userId?: string;
  /** Whether this request/session is on STAGING_HOST. Required to ever resolve
      a `stagingOnly` flag true; irrelevant to every other flag. */
  isStaging?: boolean;
}

/** Precedence: stagingOnly hard-gate > override > remote provider > userId rollout > code default. */
export function resolveFlag(name: FlagName, { override, remote, userId, isStaging }: FlagInputs): boolean {
  const flag: FeatureFlag = FLAGS[name];
  if (flag.stagingOnly && !isStaging) return false;
  if (override !== undefined) return override;
  if (remote !== undefined) return remote;
  if (flag.rolloutPercent != null && userId) {
    return hashPercent(userId + name) < flag.rolloutPercent;
  }
  return flag.enabled;
}
