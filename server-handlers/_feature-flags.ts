/* Server-side feature flags. Authoritative: the client can hide a feature,
 * but only this check stops the spend behind it.
 *
 * Precedence: FF_<NAME> env (operator hard switch: "on"/"off") >
 * PostHog remote value (no deploy needed) > rollout > code default.
 * Remote lookups are cached per isolate for CACHE_TTL_MS; "global"-scope
 * flags share one cache entry so a kill switch costs ~1 PostHog call per
 * minute per isolate, not one per request. */

import { FLAGS, remoteKeyFor, resolveFlag, type FlagName } from "../src/featureFlagRegistry";
import { getServerFeatureFlag } from "./_posthog";

declare const process: { env: Record<string, string | undefined> };

const CACHE_TTL_MS = 60_000;
const GLOBAL_DISTINCT_ID = "hirestepx-server";

export function parseEnvFlag(raw: string | undefined): boolean | undefined {
  const v = raw?.trim().toLowerCase();
  if (v === "on" || v === "true" || v === "1") return true;
  if (v === "off" || v === "false" || v === "0") return false;
  return undefined;
}

export interface ServerFlagDeps {
  env: Record<string, string | undefined>;
  remote: (key: string, distinctId: string) => Promise<boolean | undefined>;
  now: () => number;
}

const cache = new Map<string, { value: boolean | undefined; expires: number }>();

export function _clearFlagCache(): void {
  cache.clear();
}

export async function isServerFlagEnabled(
  name: FlagName,
  userId?: string,
  deps: ServerFlagDeps = { env: process.env, remote: getServerFeatureFlag, now: Date.now },
): Promise<boolean> {
  const override = parseEnvFlag(deps.env[`FF_${name}`]);
  if (override !== undefined) return override;

  const distinctId = FLAGS[name].scope === "global" ? GLOBAL_DISTINCT_ID : (userId ?? GLOBAL_DISTINCT_ID);
  const cacheKey = `${name}|${distinctId}`;
  const hit = cache.get(cacheKey);
  let remote: boolean | undefined;
  if (hit && hit.expires > deps.now()) {
    remote = hit.value;
  } else {
    remote = await deps.remote(remoteKeyFor(name), distinctId);
    cache.set(cacheKey, { value: remote, expires: deps.now() + CACHE_TTL_MS });
  }
  return resolveFlag(name, { remote, userId });
}
