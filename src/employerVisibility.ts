/* Candidate-side client for the employer-visibility consent setting
   (GET/POST /api/candidate-visibility). `masked` = employers may see practice
   evidence with name and contact hidden until they pay to unlock; `off` =
   never shown to employers. The server owns the consent record; this file is
   only transport + display helpers. */

import { authHeaders } from "./supabase";
import { apiFetch } from "./apiClient";

export type EmployerVisibility = "masked" | "off";

export interface VisibilityHistoryEntry {
  action: "granted" | "withdrawn";
  createdAt: string;
  source: string;
}

export interface VisibilityState {
  visibility: EmployerVisibility;
  updatedAt: string | null;
  policyVersion: string;
  history: VisibilityHistoryEntry[];
  stats: { employersViewedLast30d: number };
}

function isVisibilityState(v: unknown): v is VisibilityState {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (o.visibility === "masked" || o.visibility === "off") && Array.isArray(o.history);
}

export async function fetchVisibility(): Promise<VisibilityState | null> {
  try {
    const headers = await authHeaders();
    const res = await fetch("/api/candidate-visibility", { headers });
    const data: unknown = await res.json().catch(() => null);
    return res.ok && isVisibilityState(data) ? data : null;
  } catch {
    return null;
  }
}

export async function saveVisibility(
  visibility: EmployerVisibility,
): Promise<{ ok: true; state: VisibilityState } | { ok: false; error: string }> {
  const res = await apiFetch<unknown>("/api/candidate-visibility", { visibility });
  if (res.ok && isVisibilityState(res.data)) return { ok: true, state: res.data };
  return { ok: false, error: res.error || "Couldn't update your setting" };
}

const SOURCE_LABEL: Record<string, string> = {
  settings: "Settings",
  dashboard: "Dashboard",
  onboarding: "Onboarding",
  backfill: "Account migration",
  system: "System",
};

export function describeHistoryEntry(e: VisibilityHistoryEntry, now: number = Date.now()): string {
  const verb = e.action === "granted" ? "Allowed employer discovery" : "Turned off employer discovery";
  const when = new Date(e.createdAt);
  const whenLabel = Number.isNaN(when.getTime())
    ? ""
    : when.toLocaleDateString("en-IN", {
        day: "numeric", month: "short",
        ...(now - when.getTime() > 300 * 86_400_000 ? { year: "numeric" as const } : {}),
      });
  const source = SOURCE_LABEL[e.source] ?? null;
  return [verb, whenLabel, source ? `via ${source}` : null].filter(Boolean).join(" · ");
}

export function viewedLabel(count: number): string {
  if (count <= 0) return "No employers viewed your practice evidence in the last 30 days.";
  if (count === 1) return "1 employer viewed your practice evidence in the last 30 days.";
  return `${count} employers viewed your practice evidence in the last 30 days.`;
}

/* One-time dashboard notice dismissal. localStorage can throw (private mode,
   blocked storage), so every access is guarded and the notice simply shows
   again next visit in that case. */
export const VISIBILITY_NOTICE_DISMISS_KEY = "hirestepx_employer_visibility_notice_dismissed";

export function isVisibilityNoticeDismissed(): boolean {
  try { return localStorage.getItem(VISIBILITY_NOTICE_DISMISS_KEY) === "1"; } catch { return false; }
}

export function dismissVisibilityNotice(): void {
  try { localStorage.setItem(VISIBILITY_NOTICE_DISMISS_KEY, "1"); } catch { /* expected: localStorage may be unavailable */ }
}
