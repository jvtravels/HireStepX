/* Rollout gate for employer team management.
 *
 * Precedence: FF_EMPLOYER_TEAMS=off (kill switch, beats everything) >
 * EMPLOYER_TEAMS_COMPANIES allowlist (pilot companies, comma-separated company ids) >
 * the regular flag chain (FF_ env on, PostHog, code default off).
 *
 * Only the Team page and its APIs are gated. Roles and per-member attribution
 * stay active everywhere, so turning the flag off never locks an existing
 * teammate out of the console. */

import { isServerFlagEnabled, parseEnvFlag } from "./_feature-flags";

declare const process: { env: Record<string, string | undefined> };

export interface TeamsGateDeps {
  env: Record<string, string | undefined>;
  flag: (companyId: string) => Promise<boolean>;
}

export function parsePilotCompanies(raw: string | undefined): Set<string> {
  return new Set((raw ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
}

export async function teamsEnabledFor(
  companyId: string,
  deps: TeamsGateDeps = { env: process.env, flag: (id) => isServerFlagEnabled("EMPLOYER_TEAMS", id) },
): Promise<boolean> {
  if (parseEnvFlag(deps.env.FF_EMPLOYER_TEAMS) === false) return false;
  if (parsePilotCompanies(deps.env.EMPLOYER_TEAMS_COMPANIES).has(companyId.toLowerCase())) return true;
  return deps.flag(companyId);
}
