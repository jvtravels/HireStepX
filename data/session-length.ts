/* Single source of truth for session length (minutes) and question count
 * per interview focus display name — mirrors generate-questions.ts's
 * questionCount rule and SessionSetup.tsx's time-pill copy, so any other
 * UI that previews an upcoming session (e.g. the dashboard's Next Move
 * card) shows the number the engine will actually run instead of a
 * guessed placeholder. */

export const FOCUS_MINUTES: Record<string, number> = {
  "Behavioral": 15,
  "Strategic": 20,
  "Technical Leadership": 20,
  "Case Study": 25,
  "Salary Negotiation": 12,
  "Panel Interview": 25,
  "Campus Placement": 15,
  "HR Round": 10,
  "Management": 18,
  "Government / PSU": 18,
};

export function sessionMinutesForFocus(focus: string): number {
  return FOCUS_MINUTES[focus] ?? 15;
}

/* Mirrors generate-questions.ts's questionCount: HR Round's 10-minute
 * mini-mode session is the only focus with its own count (its 8-dimension
 * Indian HR gate needs 7 questions); salary-negotiation and every other
 * full-length session ask 5. */
export function questionCountForFocus(focus: string): number {
  return focus === "HR Round" ? 7 : 5;
}
