/* Candidate-side recourse against an employer match: respond (interested /
   declined), block, or report. Backed by POST /api/candidate-employer-actions.
   Block = the employer can no longer see or contact the candidate; report =
   block plus a trust-and-safety report (3 distinct reports auto-suspend an
   employer). */

import { apiFetch } from "./apiClient";

export type EmployerReportReason =
  | "spam"
  | "fake_company"
  | "harassment"
  | "off_platform_solicitation"
  | "discriminatory"
  | "other";

export type EmployerResponse = "interested" | "declined";

export const REPORT_REASONS: ReadonlyArray<{ value: EmployerReportReason; label: string; hint: string }> = [
  { value: "spam", label: "Spam or irrelevant outreach", hint: "Mass messages that have nothing to do with your profile." },
  { value: "fake_company", label: "Fake or misleading company", hint: "The company or role doesn't look real, or is not who they claim to be." },
  { value: "harassment", label: "Harassment or inappropriate behaviour", hint: "Abusive, threatening or unwelcome messages." },
  { value: "off_platform_solicitation", label: "Asking for money or to move off HireStepX", hint: "Fees, deposits, or pushing you to WhatsApp/Telegram before a real offer." },
  { value: "discriminatory", label: "Discriminatory content", hint: "Treats you differently based on gender, religion, caste, region, age or similar." },
  { value: "other", label: "Something else", hint: "Tell us more in the note below." },
];

export const REPORT_NOTE_MAX = 500;

export function reasonLabel(reason: EmployerReportReason): string {
  return REPORT_REASONS.find((r) => r.value === reason)?.label ?? "Other";
}

export function responseLabel(response: EmployerResponse | null | undefined): string | null {
  if (response === "interested") return "You said: Interested";
  if (response === "declined") return "You said: Not interested";
  return null;
}

export function normalizeResponse(v: unknown): EmployerResponse | null {
  return v === "interested" || v === "declined" ? v : null;
}

export type EmployerActionResult = { ok: true } | { ok: false; error: string };

type ActionBody =
  | { action: "respond"; matchId: string; response: EmployerResponse }
  | { action: "block"; matchId: string }
  | { action: "report"; matchId: string; reason: EmployerReportReason; note?: string };

async function post(body: ActionBody): Promise<EmployerActionResult> {
  const res = await apiFetch<{ ok?: boolean }>("/api/candidate-employer-actions", body);
  if (res.ok) return { ok: true };
  return { ok: false, error: res.error || "Something went wrong. Please try again." };
}

export const respondToEmployer = (matchId: string, response: EmployerResponse) =>
  post({ action: "respond", matchId, response });

export const blockEmployer = (matchId: string) => post({ action: "block", matchId });

export const reportEmployer = (matchId: string, reason: EmployerReportReason, note: string) => {
  const trimmed = note.trim().slice(0, REPORT_NOTE_MAX);
  return post({ action: "report", matchId, reason, ...(trimmed ? { note: trimmed } : {}) });
};

/* The list endpoint may not echo the candidate's response yet, so remember it
   locally per match — keeps the menu/badge truthful across navigation until the
   server value (when present) takes over. */
const RESPONSE_KEY = (matchId: string) => `hirestepx_employer_response_${matchId}`;

export function readStoredResponse(matchId: string): EmployerResponse | null {
  try { return normalizeResponse(localStorage.getItem(RESPONSE_KEY(matchId))); } catch { return null; }
}

export function storeResponse(matchId: string, response: EmployerResponse | null): void {
  try {
    if (response) localStorage.setItem(RESPONSE_KEY(matchId), response);
    else localStorage.removeItem(RESPONSE_KEY(matchId));
  } catch { /* expected: localStorage may be unavailable */ }
}

/* After a block/report the match must vanish from every cached list so a stale
   cache can't flash the employer back for a moment. */
export function dropMatchFromCaches(userId: string | undefined, matchId: string): void {
  if (!userId) return;
  for (const key of [
    `hirestepx_cache_hiring_activity_full_${userId}`,
    `hirestepx_cache_hiring_activity_teaser_${userId}`,
  ]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") continue;
      const obj = parsed as { recent?: Array<{ id?: string }>; shortlistedCount?: number };
      if (!Array.isArray(obj.recent)) continue;
      const next = obj.recent.filter((m) => m.id !== matchId);
      if (next.length === obj.recent.length) continue;
      localStorage.setItem(key, JSON.stringify({
        ...obj,
        recent: next,
        ...(typeof obj.shortlistedCount === "number" ? { shortlistedCount: Math.max(0, obj.shortlistedCount - 1) } : {}),
      }));
    } catch { /* expected: cache is best-effort */ }
  }
}
