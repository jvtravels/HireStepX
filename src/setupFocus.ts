export function getRecommendedFocus(role?: string, experienceLevel?: string): string {
  // Profile-level "fresher" wins over role-name heuristics so a user who calls
  // themselves "Software Engineer" but is a fresh graduate lands on campus placement.
  if (experienceLevel === "fresher") return "Campus Placement";
  if (!role) return "Behavioral";
  const r = role.toLowerCase();
  if (/engineer|developer|sde|swe|programmer|coder/i.test(r)) return "Technical Leadership";
  if (/product\s*manager|pm\b/i.test(r)) return "Strategic";
  if (/analyst|data/i.test(r)) return "Technical Leadership";
  if (/intern|fresher|graduate|campus|entry/i.test(r)) return "Campus Placement";
  if (/consult/i.test(r)) return "Case Study";
  if (/manager|director|vp|head of|cto|ceo/i.test(r)) return "Management";
  return "Behavioral";
}

interface FocusInput {
  role?: string;
  experienceLevel?: string;
  relevant: ReadonlySet<string> | null;
  isComingSoon: (focus: string) => boolean;
}

/* One source of truth for the "For you" badge and the pre-selected card, so the
   badge can never point at a card the role filter hides or that is locked. */
export function resolveFocusDefaults({ role, experienceLevel, relevant, isComingSoon }: FocusInput): { recommended: string; defaultFocus: string } {
  const pick = getRecommendedFocus(role, experienceLevel);
  if (!isComingSoon(pick) && (!relevant || relevant.has(pick))) return { recommended: pick, defaultFocus: pick };
  const firstOpen = relevant ? [...relevant].find((f) => !isComingSoon(f)) : undefined;
  return { recommended: "Behavioral", defaultFocus: firstOpen ?? "Behavioral" };
}
