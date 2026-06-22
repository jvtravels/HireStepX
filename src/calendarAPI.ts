/**
 * Client wrapper for the `/api/calendar/*` endpoints (PRI-35).
 *
 * The calendar is DB-authoritative: every mutation goes through these
 * functions, never supabase-js directly. They route over the XHR-based
 * apiClient so fetch-wrapping browser extensions can't hang the request
 * (see apiClient.ts for the full rationale). localStorage stays a cache only.
 */

import { apiFetch } from "./apiClient";
import { canonicalTimezone } from "./dashboardHelpers";

export type CalendarKind = "real" | "prep-session";
export type CalendarStatus = "upcoming" | "completed" | "cancelled";
export type CalendarSource = "manual" | "nl" | "google" | "prep-runway";
export type ReminderChannel = "email" | "push";

export interface CalendarReminder {
  channel: ReminderChannel;
  minutesBefore: number;
}

/** Server row shape returned by the API (snake_case, mirrors the DB). */
export interface CalendarEventRow {
  id: string;
  user_id: string;
  title: string;
  company: string;
  role: string;
  date: string;
  time: string;
  type: string;
  notes: string;
  start_utc: string | null;
  end_utc: string | null;
  timezone: string;
  duration_minutes: number;
  location: string;
  status: CalendarStatus;
  kind: CalendarKind;
  parent_interview_id: string | null;
  source: CalendarSource;
  google_event_id: string | null;
  reminders: CalendarReminder[];
  created_at?: string;
  updated_at?: string;
}

/** Fields a client may submit. `id` present => update; absent => create. */
export interface CalendarEventInput {
  id?: string;
  title: string;
  company?: string;
  role?: string;
  date?: string;
  time?: string;
  type?: string;
  notes?: string;
  start_utc?: string;
  end_utc?: string;
  timezone?: string;
  duration?: number;
  location?: string;
  status?: CalendarStatus;
  kind?: CalendarKind;
  parent_interview_id?: string;
  source?: CalendarSource;
  google_event_id?: string;
  reminders?: CalendarReminder[] | boolean;
}

/** The caller's IANA timezone, defaulting to the Indian-candidate audience. */
export function currentTimezone(): string {
  try {
    return canonicalTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata");
  } catch {
    return "Asia/Kolkata";
  }
}

export async function listEvents(signal?: AbortSignal): Promise<{ ok: boolean; events: CalendarEventRow[]; error: string | null }> {
  // The server's list handler accepts POST as well as GET (allowGet preamble),
  // so we use the apiClient's default POST transport for a uniform call path.
  const res = await apiFetch<{ ok: boolean; events: CalendarEventRow[] }>("/api/calendar/list", {}, { signal });
  return { ok: res.ok, events: res.data?.events ?? [], error: res.error };
}

export async function saveEvent(
  input: CalendarEventInput,
  signal?: AbortSignal,
): Promise<{ ok: boolean; event: CalendarEventRow | null; status: number; error: string | null }> {
  const payload: CalendarEventInput = { timezone: currentTimezone(), ...input };
  const res = await apiFetch<{ ok: boolean; event: CalendarEventRow }>("/api/calendar/save", payload, { signal });
  return { ok: res.ok, event: res.data?.event ?? null, status: res.status, error: res.error };
}

export async function deleteEvent(
  id: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; error: string | null }> {
  const res = await apiFetch<{ ok: boolean }>("/api/calendar/delete", { id }, { signal });
  return { ok: res.ok, status: res.status, error: res.error };
}

/**
 * Auto-schedule the Prep Runway countdown for a logged interview. Idempotent:
 * a second call returns the already-scheduled sessions (alreadyGenerated:true)
 * instead of duplicating them. The server derives the ladder and persists it.
 */
export async function generatePrepRunway(
  parentId: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; events: CalendarEventRow[]; alreadyGenerated: boolean; status: number; error: string | null }> {
  const res = await apiFetch<{ ok: boolean; events: CalendarEventRow[]; alreadyGenerated?: boolean }>(
    "/api/calendar/prep-runway",
    { parentId },
    { signal },
  );
  return {
    ok: res.ok,
    events: res.data?.events ?? [],
    alreadyGenerated: !!res.data?.alreadyGenerated,
    status: res.status,
    error: res.error,
  };
}

/**
 * Begin the Google Calendar two-way sync connection. Returns the Google consent
 * URL (with an HMAC-signed state binding the flow to this user); the caller
 * navigates the browser to it. `unavailable: true` means the server has no
 * Google OAuth client configured yet, so the UI should hide the affordance
 * rather than show an error.
 */
export async function connectGoogleCalendar(
  signal?: AbortSignal,
): Promise<{ ok: boolean; url: string | null; unavailable: boolean; upgradeRequired: boolean; error: string | null }> {
  const res = await apiFetch<{ ok: boolean; url: string; unavailable?: boolean; upgradeRequired?: boolean }>(
    "/api/calendar/google/connect",
    {},
    { signal },
  );
  return {
    ok: res.ok,
    url: res.data?.url ?? null,
    unavailable: res.status === 501 || !!res.data?.unavailable,
    upgradeRequired: res.status === 403 || !!res.data?.upgradeRequired,
    error: res.error,
  };
}

/** Tear down the Google Calendar connection (revoke + stop watch + drop row). */
export async function disconnectGoogleCalendar(
  signal?: AbortSignal,
): Promise<{ ok: boolean; error: string | null }> {
  const res = await apiFetch<{ ok: boolean }>("/api/calendar/google/disconnect", {}, { signal });
  return { ok: res.ok, error: res.error };
}
