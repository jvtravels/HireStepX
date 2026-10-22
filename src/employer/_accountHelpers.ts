/* Pure helpers for the employer Settings page: how the verification tier is
   described, whether the "Verified" badge is earned, and reading the data-export
   response. Kept out of the page so they are unit-tested directly. */

import { TIER_LIMITS, type EmployerTier } from "../../server-handlers/_employer-trust";

export interface TierPresentation {
  label: string;
  /** Only the top tier earns the badge: it means the work-email domain matches the website. */
  verifiedBadge: boolean;
  /** What to do next to raise limits; null when already at the top. */
  nextStep: string | null;
}

export function tierPresentation(tier: EmployerTier): TierPresentation {
  if (tier === "verified") return { label: "Verified", verifiedBadge: true, nextStep: null };
  if (tier === "email_verified") {
    return {
      label: "Work email confirmed",
      verifiedBadge: false,
      nextStep: "Set your company website to the same domain as your work email to reach Verified and raise your limits.",
    };
  }
  return {
    label: "Basic",
    verifiedBadge: false,
    nextStep: "Verify with a work email (not Gmail, Yahoo or similar) to raise your limits.",
  };
}

export function describeLimits(limits: { unlocksPerDay: number; openRequirements: number; rematchesPerHour: number }): string {
  return `${limits.unlocksPerDay} unlocks a day, ${limits.openRequirements} open jobs, ${limits.rematchesPerHour} re-matches an hour`;
}

/** The three tiers side by side, for the onboarding explainer. Numbers come from the server's table. */
export function tierLadder(): Array<{ tier: EmployerTier; label: string; limits: string }> {
  return (["basic", "email_verified", "verified"] as const).map((tier) => ({
    tier,
    label: tierPresentation(tier).label,
    limits: describeLimits(TIER_LIMITS[tier]),
  }));
}

/** Open = anything not closed (matching, ready, failed, etc. all still count against the limit). */
export function openJobCount(requirements: ReadonlyArray<{ status: string }>): number {
  return requirements.filter((r) => r.status !== "closed").length;
}

const DEFAULT_EXPORT_FILENAME = "hirestepx-data-export.json";

export function exportFilename(headers: Record<string, string>): string {
  const m = /filename="?([^";]+)"?/i.exec(headers["content-disposition"] ?? "");
  const name = m?.[1]?.trim();
  return name && /^[\w.-]+$/.test(name) ? name : DEFAULT_EXPORT_FILENAME;
}

/** The server marks an export "false" when some tables could not be read; the file is still
 *  usable but must not be presented as the full record. */
export function exportIsIncomplete(headers: Record<string, string>): boolean {
  return headers["x-export-complete"] === "false";
}

export function exportBody(data: unknown): string {
  return typeof data === "string" ? data : JSON.stringify(data, null, 2);
}
