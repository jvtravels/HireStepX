/* Pure helpers for the candidate-agency endpoints (candidate-visibility.ts,
 * candidate-employer-actions.ts): consent-log row building, input validation,
 * note sanitising and the report-count -> suspend decision. No I/O; unit-tested
 * in src/__tests__/candidateConsentHelpers.test.ts.
 *
 * Policy version is bumped whenever the copy that tells a candidate what
 * employers can see changes — each consent-log row records the version the
 * candidate actually agreed to (DPDP: consent must be specific + informed). */

import { shouldAutoSuspend } from "./_employer-trust";

export const EMPLOYER_DISCOVERY_POLICY_VERSION = "employer-discovery-2026-10";

export const CONSENT_PURPOSE = "employer_discovery";

export type EmployerVisibility = "masked" | "off";
export type ConsentAction = "granted" | "withdrawn";

export const CONSENT_SOURCES = ["settings", "post_session_prompt", "onboarding", "dashboard"] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

export const REPORT_REASONS = [
  "spam",
  "fake_company",
  "harassment",
  "off_platform_solicitation",
  "discriminatory",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const EMPLOYER_ACTIONS = ["block", "report", "respond"] as const;
export type EmployerAction = (typeof EMPLOYER_ACTIONS)[number];

export type CandidateResponse = "interested" | "declined";

export const NOTE_MAX_LENGTH = 500;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export function asVisibility(v: unknown): EmployerVisibility | null {
  return v === "masked" || v === "off" ? v : null;
}

/** Unknown / missing source falls back to "settings" — never trust the client to pick arbitrary strings into an audit table. */
export function asConsentSource(v: unknown): ConsentSource {
  return (CONSENT_SOURCES as readonly string[]).includes(v as string) ? (v as ConsentSource) : "settings";
}

export function asEmployerAction(v: unknown): EmployerAction | null {
  return (EMPLOYER_ACTIONS as readonly string[]).includes(v as string) ? (v as EmployerAction) : null;
}

export function isReportReason(v: unknown): v is ReportReason {
  return typeof v === "string" && (REPORT_REASONS as readonly string[]).includes(v);
}

export function asCandidateResponse(v: unknown): CandidateResponse | null {
  return v === "interested" || v === "declined" ? v : null;
}

/** Strips control characters, collapses whitespace, caps length. Returns null for empty / non-string input
 *  so the column stays NULL rather than holding "". */
export function sanitizeNote(raw: unknown, max: number = NOTE_MAX_LENGTH): string | null {
  if (typeof raw !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();
  return cleaned.length > 0 ? cleaned : null;
}

/* ── Consent log ── */

export function consentActionFor(next: EmployerVisibility): ConsentAction {
  return next === "off" ? "withdrawn" : "granted";
}

export interface ConsentLogRow {
  user_id: string;
  purpose: typeof CONSENT_PURPOSE;
  action: ConsentAction;
  policy_version: string;
  source: ConsentSource;
}

/** Row to append for a visibility change, or null when nothing changed (no-op writes leave no log entry). */
export function buildConsentLogRow(input: {
  userId: string;
  current: EmployerVisibility;
  next: EmployerVisibility;
  source?: unknown;
}): ConsentLogRow | null {
  if (input.current === input.next) return null;
  return {
    user_id: input.userId,
    purpose: CONSENT_PURPOSE,
    action: consentActionFor(input.next),
    policy_version: EMPLOYER_DISCOVERY_POLICY_VERSION,
    source: asConsentSource(input.source),
  };
}

export interface ConsentHistoryEntry {
  action: ConsentAction;
  createdAt: string;
  source: string;
}

export function shapeConsentHistory(
  rows: Array<{ action?: unknown; created_at?: unknown; source?: unknown }> | null | undefined,
): ConsentHistoryEntry[] {
  if (!Array.isArray(rows)) return [];
  const out: ConsentHistoryEntry[] = [];
  for (const r of rows) {
    if ((r.action !== "granted" && r.action !== "withdrawn") || typeof r.created_at !== "string") continue;
    out.push({ action: r.action, createdAt: r.created_at, source: typeof r.source === "string" ? r.source : "settings" });
  }
  return out;
}

/* ── Reports -> suspension ── */

export function countDistinctReporters(rows: Array<{ reporter_user_id?: unknown }> | null | undefined): number {
  if (!Array.isArray(rows)) return 0;
  const ids = new Set<string>();
  for (const r of rows) if (typeof r.reporter_user_id === "string") ids.add(r.reporter_user_id);
  return ids.size;
}

export type SuspendDecision =
  | { suspend: false }
  | { suspend: true; reason: string };

/** Auto-suspend once enough independent candidates have reported; never re-stamps an already-suspended employer
 *  (keeps an admin's manual reason / timestamp intact). */
export function decideAutoSuspension(distinctReporters: number, alreadySuspended: boolean): SuspendDecision {
  if (alreadySuspended || !shouldAutoSuspend(distinctReporters)) return { suspend: false };
  return { suspend: true, reason: `auto: ${distinctReporters} candidate reports` };
}

/* ── Respond notification ── */

export function respondNotificationText(response: CandidateResponse, maskedName: string, roleTitle: string | null): { title: string; body: string } {
  const role = roleTitle ? ` for ${roleTitle}` : "";
  return response === "interested"
    ? { title: "A candidate is interested", body: `${maskedName} responded as interested${role}.` }
    : { title: "A candidate declined", body: `${maskedName} declined contact${role}.` };
}
