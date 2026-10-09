/* ─── Feature Flags (client) ─── */
/* Flags are declared in featureFlagRegistry.ts. Values resolve as:
     localStorage override (dev/QA) > remote provider (PostHog) > rollout > default.
   Flipping a flag in PostHog takes effect without a deploy; the server
   enforces the same flag independently (server-handlers/_feature-flags.ts),
   so a local override only changes what this browser shows.
   Console access via window.__FF. */

import { FLAGS, isFlagName, remoteKeyFor, resolveFlag, type FlagName } from "./featureFlagRegistry";
import { getClientFeatureFlag } from "./posthogClient";

export { FLAGS, type FlagName } from "./featureFlagRegistry";
export type { FeatureFlag } from "./featureFlagRegistry";

/** Remote flag source. PostHog by default; swap via setFlagProvider (e.g. GrowthBook). */
export interface FlagProvider {
  get(remoteKey: string): boolean | undefined;
}

let provider: FlagProvider = { get: getClientFeatureFlag };

export function setFlagProvider(next: FlagProvider): void {
  provider = next;
}

const LS_PREFIX = "hirestepx_ff_";

function readOverride(name: FlagName): boolean | undefined {
  try {
    const v = localStorage.getItem(`${LS_PREFIX}${name}`);
    return v === null ? undefined : v === "true";
  } catch {
    return undefined; /* SSR / restricted context */
  }
}

function readRemote(name: FlagName): boolean | undefined {
  try {
    return provider.get(remoteKeyFor(name));
  } catch {
    return undefined; /* a broken provider must never break the UI */
  }
}

export function isEnabled(flagName: FlagName, userId?: string): boolean {
  return resolveFlag(flagName, { override: readOverride(flagName), remote: readRemote(flagName), userId });
}

export function getEnabledFlags(): FlagName[] {
  return (Object.keys(FLAGS) as FlagName[]).filter((k) => isEnabled(k));
}

/** Store a dev/QA override in localStorage; wins over remote and defaults. */
export function overrideFlag(flagName: string, enabled: boolean): void {
  if (!isFlagName(flagName)) return;
  try {
    localStorage.setItem(`${LS_PREFIX}${flagName}`, String(enabled));
  } catch { /* restricted context */ }
}

export function clearOverrides(): void {
  try {
    Object.keys(FLAGS).forEach((k) => localStorage.removeItem(`${LS_PREFIX}${k}`));
  } catch { /* restricted context */ }
}

declare global {
  interface Window {
    __FF?: {
      isEnabled: typeof isEnabled;
      overrideFlag: typeof overrideFlag;
      clearOverrides: typeof clearOverrides;
      getEnabledFlags: typeof getEnabledFlags;
      FLAGS: typeof FLAGS;
    };
  }
}

if (typeof window !== "undefined") {
  window.__FF = { isEnabled, overrideFlag, clearOverrides, getEnabledFlags, FLAGS };
}
