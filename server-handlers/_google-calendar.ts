/* Google Calendar two-way sync (PRI-35) — pure helpers.
 *
 * The previous "sync" was dead: it stashed the OAuth token in sessionStorage,
 * read it from localStorage, never asked for a calendar scope, and had no
 * server side at all. This rebuild persists a refresh token server-side and
 * does all Google I/O from edge/node handlers, which is the only model that
 * supports webhooks (watch channels) and a fallback poll.
 *
 * Everything here is side-effect-free and edge-safe so the mapping and
 * sync-decision logic can be unit-tested in isolation
 * (src/__tests__/googleCalendar.test.ts). The HMAC state sign/verify use
 * crypto.subtle, which exists in both the edge and node runtimes.
 */

/** Read+write the user's events. Incremental scope: requested on top of login. */
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

/** extendedProperties.private key stamped on events we push, so the webhook can
 *  tell our own writes apart from genuine Google-side edits and avoid an echo
 *  loop (Google notifies us about the event we just created). */
export const HSX_PROP = "hirestepxId";

export interface GoogleSyncEnv {
  clientId: string;
  clientSecret: string;
}

/** True only when both halves of the OAuth client are configured. Every
 *  handler short-circuits on this so the feature stays completely inert (no DB
 *  reads, no Google calls) until the env is provisioned. */
export function googleConfigured(env: { GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string }): boolean {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_ID.trim() && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CLIENT_SECRET.trim());
}

/** Build the consent URL. access_type=offline + prompt=consent guarantees a
 *  refresh token even on re-consent (Google omits it otherwise). */
export function buildAuthUrl(opts: { clientId: string; redirectUri: string; state: string }): string {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", opts.clientId);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", `openid email ${GOOGLE_CALENDAR_SCOPE}`);
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("state", opts.state);
  return u.toString();
}

/** Token freshness check with a safety skew so we refresh slightly early. */
export function isAccessTokenExpired(expiryIso: string | null | undefined, nowMs: number, skewSec = 120): boolean {
  if (!expiryIso) return true;
  const exp = Date.parse(expiryIso);
  if (Number.isNaN(exp)) return true;
  return exp - skewSec * 1000 <= nowMs;
}

/* ── HMAC-signed OAuth state ──
 * The callback is an unauthenticated redirect, so the user id has to round-trip
 * through the `state` param. We sign it so a caller can't forge a state that
 * binds the connection to someone else's account. */

async function hmac(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
  return b64url(new Uint8Array(sig));
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface StatePayload {
  userId: string;
  nonce: string;
  /** Unix seconds the state was issued. Optional for backward compatibility;
   *  when present, verifyState can enforce a max age to bound replay. */
  iat?: number;
}

export async function signState(secret: string, payload: StatePayload): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmac(secret, body);
  return `${body}.${sig}`;
}

/** Verify the HMAC and shape of an OAuth state. When `opts.maxAgeSec` is given
 *  and the payload carries an `iat`, also reject states older than that window
 *  (and any future-dated ones), which bounds how long a leaked state can be
 *  replayed. Without those, the time check is skipped (legacy-compatible). */
export async function verifyState(
  secret: string,
  state: string,
  opts?: { now?: number; maxAgeSec?: number },
): Promise<StatePayload | null> {
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = await hmac(secret, body);
  // Constant-time-ish compare: equal length + char accumulation.
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (!json || typeof json.userId !== "string" || typeof json.nonce !== "string") return null;
    if (opts?.maxAgeSec != null && typeof json.iat === "number") {
      const nowSec = Math.floor((opts.now ?? 0) / 1000);
      const age = nowSec - json.iat;
      if (age < -60 || age > opts.maxAgeSec) return null; // expired or future-dated
    }
    return json;
  } catch {
    return null;
  }
}

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ── Event mapping ── */

export interface GoogleEvent {
  id?: string;
  status?: string; // "confirmed" | "tentative" | "cancelled"
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string> };
}

export type GoogleSyncAction =
  | { action: "delete"; googleEventId: string }
  | { action: "skip"; reason: string }
  | { action: "upsert"; googleEventId: string; body: Record<string, unknown> };

/** Decide what an incoming Google event means for our store. Cancelled events
 *  become deletes; all-day and timed events become upserts; our own echoes and
 *  malformed entries are skipped. */
export function googleEventToAction(g: GoogleEvent, ctx: { timezone: string }): GoogleSyncAction {
  if (!g.id) return { action: "skip", reason: "no id" };
  // Echo guard: events we exported to Google carry our id in a private
  // extended property. Re-importing them would round-trip our own writes back
  // into the store and re-stamp updated_at on every poll. A user deleting such
  // an event on the Google side still propagates (cancellation -> delete); we
  // only skip the no-op upsert echo.
  if (g.extendedProperties?.private?.[HSX_PROP] && g.status !== "cancelled") {
    return { action: "skip", reason: "own echo" };
  }
  if (g.status === "cancelled") return { action: "delete", googleEventId: g.id };

  const startUtc = extractInstant(g.start);
  if (!startUtc) return { action: "skip", reason: "unparseable start" };
  const endUtc = extractInstant(g.end);

  const tz = g.start?.timeZone || ctx.timezone || "Asia/Kolkata";
  const durationMinutes = endUtc ? Math.max(5, Math.round((Date.parse(endUtc) - Date.parse(startUtc)) / 60000)) : 60;

  return {
    action: "upsert",
    googleEventId: g.id,
    body: {
      title: (g.summary || "Interview").slice(0, 200),
      notes: (g.description || "").slice(0, 4000),
      location: (g.location || "").slice(0, 500),
      start_utc: startUtc,
      end_utc: endUtc || undefined,
      duration: durationMinutes,
      timezone: tz,
      google_event_id: g.id,
      source: "google",
      kind: "real",
      status: "upcoming",
    },
  };
}

/** Normalize a Google start/end block to a UTC instant. Handles both timed
 *  (dateTime) and all-day (date) events; all-day anchors to local midnight. */
function extractInstant(slot: GoogleEvent["start"]): string | null {
  if (!slot) return null;
  if (slot.dateTime) {
    const ms = Date.parse(slot.dateTime);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }
  if (slot.date) {
    const ms = Date.parse(`${slot.date}T00:00:00Z`);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }
  return null;
}

/** Build the Google event resource for one of our rows (export direction).
 *  Stamps our id into extendedProperties so the resulting webhook echo is
 *  recognised and ignored. */
export function rowToGoogleResource(row: {
  id: string;
  title: string;
  notes?: string;
  location?: string;
  start_utc: string | null;
  end_utc: string | null;
  duration_minutes?: number;
  timezone?: string;
}): Record<string, unknown> {
  const start = row.start_utc || new Date().toISOString();
  const end =
    row.end_utc ||
    new Date(Date.parse(start) + (row.duration_minutes || 60) * 60000).toISOString();
  return {
    summary: row.title,
    description: row.notes || "",
    location: row.location || "",
    start: { dateTime: start, timeZone: row.timezone || "Asia/Kolkata" },
    end: { dateTime: end, timeZone: row.timezone || "Asia/Kolkata" },
    extendedProperties: { private: { [HSX_PROP]: row.id } },
  };
}

/** Pull the list of actions out of a Google events.list / sync response,
 *  along with the next sync token and whether the token was rejected (410). */
export function parseSyncResponse(
  status: number,
  body: { items?: GoogleEvent[]; nextSyncToken?: string; nextPageToken?: string } | null,
  ctx: { timezone: string },
): { gone: boolean; actions: GoogleSyncAction[]; nextSyncToken?: string; nextPageToken?: string } {
  if (status === 410) return { gone: true, actions: [] };
  if (!body || !Array.isArray(body.items)) return { gone: false, actions: [] };
  const actions = body.items.map((g) => googleEventToAction(g, ctx));
  return { gone: false, actions, nextSyncToken: body.nextSyncToken, nextPageToken: body.nextPageToken };
}

/** Should an event we just wrote be pushed to Google? Skip events that came
 *  FROM Google (source==="google") to break the echo loop, and skip non-real
 *  kinds (prep sessions stay app-only). */
export function shouldExportToGoogle(row: { source?: string; kind?: string; status?: string }): boolean {
  if (row.source === "google") return false;
  if (row.kind && row.kind !== "real") return false;
  return true;
}
