import { EVIDENCE_VERIFY_MIN_SESSIONS, EVIDENCE_VERIFY_THRESHOLD } from "./evidenceCapabilities";

/* The four live interview focuses, each treated as a round a candidate can
   clear. Dependency-free so the candidate dashboard and the edge evidence
   handler apply the identical bar: 2+ graded sessions at 70+ in that round. */

export type RoundKey = "behavioral" | "hr-round" | "campus-placement" | "salary-negotiation";
export type RoundStatus = "not_started" | "practising" | "cleared";

export const ROUNDS: ReadonlyArray<{ key: RoundKey; label: string }> = [
  { key: "behavioral", label: "Behavioral" },
  { key: "hr-round", label: "HR Round" },
  { key: "campus-placement", label: "Campus Placement" },
  { key: "salary-negotiation", label: "Salary Negotiation" },
];

export interface RoundSessionInput {
  date: string;
  score: number;
  type?: string | null;
  focus?: string | null;
}

export interface FocusRound {
  key: RoundKey;
  label: string;
  status: RoundStatus;
  attempts: number;
  best: number | null;
  /** Sessions at or above the bar. */
  qualifying: number;
  clearedAt: string | null;
}

/* HR Round and Campus Placement are stored as type "behavioral" with their own
   focus, so focus is checked before type. */
export function roundOf(s: Pick<RoundSessionInput, "type" | "focus">): RoundKey | null {
  const type = (s.type ?? "").toLowerCase();
  const focus = (s.focus ?? "").toLowerCase();
  if (type.includes("negotiation") || focus.includes("negotiation")) return "salary-negotiation";
  if (focus === "campus-placement" || type === "campus-placement") return "campus-placement";
  if (focus === "hr-round" || type === "hr-round") return "hr-round";
  if (type === "behavioral") return "behavioral";
  return null;
}

export function computeFocusRounds(sessions: readonly RoundSessionInput[]): FocusRound[] {
  return ROUNDS.map(({ key, label }) => {
    const mine = sessions.filter((s) => roundOf(s) === key && Number.isFinite(s.score) && s.score > 0);
    const hits = mine
      .filter((s) => s.score >= EVIDENCE_VERIFY_THRESHOLD)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const cleared = hits.length >= EVIDENCE_VERIFY_MIN_SESSIONS;
    return {
      key,
      label,
      status: cleared ? "cleared" : mine.length > 0 ? "practising" : "not_started",
      attempts: mine.length,
      best: mine.length > 0 ? Math.max(...mine.map((s) => s.score)) : null,
      qualifying: hits.length,
      clearedAt: cleared ? hits[EVIDENCE_VERIFY_MIN_SESSIONS - 1].date : null,
    };
  });
}

export function roundStatusByLabel(rounds: readonly FocusRound[] | undefined): Record<string, RoundStatus> {
  return Object.fromEntries((rounds ?? []).map((r) => [r.label, r.status]));
}

/* Employer "practice" requests name a round by its focus label. Anything else
   is a free-text skill the candidate answers by hand. */
export function roundKeyForTopic(topic: string | null | undefined): RoundKey | null {
  const t = (topic ?? "").trim().toLowerCase();
  return ROUNDS.find((r) => r.label.toLowerCase() === t)?.key ?? null;
}
