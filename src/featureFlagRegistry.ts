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
}

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
}

/** Precedence: override > remote provider > userId rollout > code default. */
export function resolveFlag(name: FlagName, { override, remote, userId }: FlagInputs): boolean {
  if (override !== undefined) return override;
  if (remote !== undefined) return remote;
  const flag: FeatureFlag = FLAGS[name];
  if (flag.rolloutPercent != null && userId) {
    return hashPercent(userId + name) < flag.rolloutPercent;
  }
  return flag.enabled;
}
