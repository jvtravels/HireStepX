/* Pure helpers for record-session-start, extracted for unit-testability.
 * OA-B50: BroadcastChannel only guards same-browser tabs. Cross-device
 * concurrent sessions (mobile + desktop) cannot be detected client-side.
 * The server-side guard compares recently-started session IDs against the
 * sessions table: any started ID not yet saved = an in-flight session on
 * another device.
 *
 * B-EMP1 (2026-08-20): a session that's simply abandoned (tab closed, crash,
 * user gave up) never gets a `sessions` row either — it looked identical to
 * an in-flight cross-device session and stayed flagged as "concurrent"
 * forever once it fell inside the lookback window. Low-frequency users (e.g.
 * 2 lifetime starts, first one abandoned) hit a permanent false positive on
 * every subsequent attempt. Fix: only treat an unsaved start as in-flight if
 * it began recently (staleAfterMs); older unsaved starts are treated as
 * abandoned, not concurrent. Starts with no recorded timestamp (pre-fix
 * data) are treated as not-recent rather than assumed concurrent, since we
 * can't confirm recency for them either way. */

export interface ConcurrentSessionInput {
  /** All session IDs recorded as started for this user, in order. */
  existingStarts: string[];
  /** The session ID being started now (excluded from the in-flight check). */
  currentSessionId: string;
  /** IDs from existingStarts that are already present in the sessions table. */
  savedSessionIds: ReadonlySet<string>;
  /** ISO timestamp each existingStarts entry was recorded, keyed by session id.
   *  Entries with no known timestamp are treated as not-recent. */
  startedAtById?: Readonly<Record<string, string>>;
  /** Current time in ms — pass explicitly in tests; defaults to Date.now(). */
  now?: number;
  /** How long (ms) an unsaved start is still considered in-flight before it's
   *  treated as abandoned. Default 2 hours — comfortably longer than any real
   *  interview session. */
  staleAfterMs?: number;
  /** How many of the most-recent existing starts to check (default: 5). */
  lookback?: number;
}

/**
 * Returns true when at least one recently-started, still-recent session is
 * not yet saved — indicating an in-flight session on another device/browser.
 *
 * Rationale: `existingStarts` holds the last N session IDs written by
 * record-session-start. `savedSessionIds` is the set of IDs already present
 * in the `sessions` table (written by save-session at completion). An ID in
 * existingStarts that is NOT in savedSessionIds AND started within
 * `staleAfterMs` is still in-flight. Older unsaved starts are abandoned
 * sessions, not concurrent ones, and must not be flagged.
 */
export function detectConcurrentSession(input: ConcurrentSessionInput): boolean {
  const {
    existingStarts,
    currentSessionId,
    savedSessionIds,
    startedAtById = {},
    staleAfterMs = 2 * 60 * 60 * 1000,
    lookback = 5,
  } = input;
  const now = input.now ?? Date.now();
  const recent = existingStarts
    .filter(id => id !== currentSessionId)
    .slice(-lookback);
  return recent.some(id => {
    if (savedSessionIds.has(id)) return false;
    const ts = startedAtById[id];
    if (!ts) return false;
    const startedMs = Date.parse(ts);
    if (!Number.isFinite(startedMs)) return false;
    return now - startedMs <= staleAfterMs;
  });
}

/* ─── Compare-and-swap append ───
 * The start record used to be read-then-PATCH: two tabs starting at once both
 * read the same arrays and the second PATCH silently overwrote the first, so
 * one start (and its practice_timestamps entry) vanished. Same CAS shape as
 * save-session.ts: the PATCH only matches while practice_timestamps still
 * equals the value we read; a loser re-reads and re-applies on top of the
 * winner's write. */

export interface StartRow {
  practice_timestamps?: unknown;
  started_session_ids?: unknown;
  started_session_ts?: unknown;
}

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** PostgREST filter pinning practice_timestamps to the value that was read.
 *  A NULL column needs `is.null`; `eq.[]` would never match it. */
export function casFilterFor(raw: unknown): string {
  return Array.isArray(raw)
    ? `practice_timestamps=eq.${encodeURIComponent(JSON.stringify(raw))}`
    : "practice_timestamps=is.null";
}

export function buildNextStartState(row: StartRow, sessionId: string, nowIso: string) {
  const timestamps = asStringArray(row.practice_timestamps);
  const starts = asStringArray(row.started_session_ids);
  const startTs = asStringArray(row.started_session_ts);
  return {
    // Caps match save-session.ts; the id/ts arrays share a cap so they stay index-aligned.
    practice_timestamps: [...timestamps, nowIso].slice(-500),
    started_session_ids: [...starts, sessionId].slice(-50),
    started_session_ts: [...startTs, nowIso].slice(-50),
  };
}

export type CasStartResult =
  | { outcome: "recorded"; attempts: number }
  | { outcome: "already_counted" }
  | { outcome: "schema_pending"; ok: boolean }
  | { outcome: "contended" }
  | { outcome: "error"; status: number; body: string };

export interface CasStartInput {
  baseUrl: string;
  serviceKey: string;
  userId: string;
  sessionId: string;
  /** Row as already read by the caller (saves one round-trip on the first attempt). */
  initialRow: StartRow;
  nowIso: string;
  fetchImpl?: typeof fetch;
  maxAttempts?: number;
}

export async function casAppendStart(input: CasStartInput): Promise<CasStartResult> {
  const { baseUrl, serviceKey, userId, sessionId, nowIso } = input;
  const f = input.fetchImpl ?? fetch;
  const maxAttempts = input.maxAttempts ?? 4;
  const authHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const url = `${baseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`;
  let row = input.initialRow;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      const res = await f(`${url}&select=practice_timestamps,started_session_ids,started_session_ts`, { headers: authHeaders });
      if (!res.ok) return { outcome: "error", status: res.status, body: "" };
      const arr = await res.json().catch(() => []);
      row = Array.isArray(arr) && arr[0] ? arr[0] : {};
    }
    // A sibling request with this same id (StrictMode double-mount, client
    // retry) may have won the previous round.
    if (asStringArray(row.started_session_ids).includes(sessionId)) {
      return { outcome: "already_counted" };
    }

    const next = buildNextStartState(row, sessionId, nowIso);
    const patch = (body: Record<string, unknown>) =>
      f(`${url}&${casFilterFor(row.practice_timestamps)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders, Prefer: "return=representation" },
        body: JSON.stringify(body),
      });

    let res = await patch({ ...next, has_completed_onboarding: true });
    let schemaPending = false;
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      // started_session_* columns not migrated yet: still bump practice_timestamps.
      if (!/started_session_ids|started_session_ts/.test(t)) return { outcome: "error", status: res.status, body: t };
      schemaPending = true;
      res = await patch({ practice_timestamps: next.practice_timestamps, has_completed_onboarding: true });
      if (!res.ok) return { outcome: "schema_pending", ok: false };
    }
    const updated = await res.json().catch(() => []);
    if (Array.isArray(updated) && updated.length > 0) {
      return schemaPending ? { outcome: "schema_pending", ok: true } : { outcome: "recorded", attempts: attempt };
    }
    // Zero rows matched: another write changed practice_timestamps. Re-read and retry.
  }
  return { outcome: "contended" };
}
