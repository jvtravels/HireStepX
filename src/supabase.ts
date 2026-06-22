import type { SupabaseClient } from "@supabase/supabase-js";
import { safeUUID } from "./utils";
import type { SessionCoaching, SessionFocusMetric } from "./dashboardTypes";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Lazy-initialize the Supabase client so the SDK (~191KB) doesn't block
// the initial page load. The client is created on first access.
let _client: SupabaseClient | null = null;
let _clientPromise: Promise<SupabaseClient> | null = null;

async function initClient(): Promise<SupabaseClient> {
  if (_client) return _client;
  if (!_clientPromise) {
    _clientPromise = import("@supabase/supabase-js").then(({ createClient }) => {
      _client = supabaseConfigured
        ? createClient(supabaseUrl, supabaseAnonKey)
        : createClient("https://placeholder.supabase.co", "placeholder-key");
      return _client;
    });
  }
  return _clientPromise;
}

/** Get the Supabase client (initializes on first call) */
export async function getSupabase(): Promise<SupabaseClient> {
  return initClient();
}

// Eagerly start loading Supabase when AuthProvider mounts (called from AuthContext)
export function preloadSupabase() {
  initClient();
}

// Synchronous access for code that runs after init (backwards compat)
export function getSupabaseSync(): SupabaseClient {
  if (!_client) throw new Error("Supabase not initialized — call getSupabase() first");
  return _client;
}

/* ─── Auth Token Helper ─── */

/**
 * Read the access token straight out of the localStorage slot Supabase
 * writes to on every auth event. Key format is
 *   sb-<project-ref>-auth-token
 * where <project-ref> is the subdomain of NEXT_PUBLIC_SUPABASE_URL.
 *
 * We need a synchronous fallback because browser extensions (Jam.dev,
 * Loom, Hotjar) that wrap window.fetch and/or the service worker can
 * cause supabase-js's own `getSession()` to hang indefinitely — it
 * awaits an internal fetch that never resolves. The network call isn't
 * strictly required: the session object (including the JWT) is always
 * persisted to localStorage. Reading it directly gives us a working
 * Authorization header in microseconds even when getSession() is
 * frozen.
 */
function getTokenFromLocalStorage(): string | null {
  try {
    if (!supabaseUrl) return null;
    const ref = new URL(supabaseUrl).hostname.split(".")[0];
    if (!ref) return null;
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { access_token?: string; currentSession?: { access_token?: string } };
    // supabase-js v2 stores { access_token, refresh_token, ... } at the top level.
    // Older/custom storage adapters sometimes nest under currentSession.
    return parsed.access_token || parsed.currentSession?.access_token || null;
  } catch {
    return null;
  }
}

export async function getAuthToken(): Promise<string | null> {
  if (!supabaseConfigured) return null;
  // Fast path: grab the token from localStorage without awaiting the
  // Supabase client. Only fall through to the async client-based path
  // when the local copy is missing entirely.
  const localToken = getTokenFromLocalStorage();
  if (localToken) return localToken;
  try {
    const client = await getSupabase();
    const { data: { session } } = await client.auth.getSession();
    return session?.access_token || null;
  } catch (err) {
    console.warn("[getAuthToken] getSession failed, proceeding unauthenticated:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/* ─── Database Types ─── */

export interface Profile {
  id: string;
  name: string;
  email: string;
  target_role: string;
  target_company: string;
  city: string;
  industry: string;
  interview_date: string;
  experience_level: string;
  learning_style: string;
  preferred_session_length: number;
  interview_types: string[];
  resume_file_name: string;
  resume_text: string;
  resume_data: Record<string, unknown> | null;
  /** UUID pointer to resume_versions.id — the canonical version row
      whose AI parse populated resume_data. Soft FK (no DB constraint). */
  resume_version_id: string | null;
  practice_timestamps: string[];
  avatar_url: string;
  subscription_tier: "free" | "starter" | "pro" | "team";
  subscription_start: string | null;
  subscription_end: string | null;
  cancel_at_period_end: boolean;
  subscription_paused: boolean;
  has_completed_onboarding: boolean;
  razorpay_payment_id: string | null;
  razorpay_subscription_id: string | null;
  referral_code: string | null;
  referred_by: string | null;
  /** Soft-delete timestamp. Set when the user requests account
      deletion; profile rows linger for the 30-day grace period. */
  deleted_at: string | null;
  created_at: string;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  date: string;
  type: string;
  difficulty: string;
  focus: string;
  /* The role/company the candidate targeted at /session/new. Written by
     server-handlers/save-session.ts; read back so the report's evaluator
     meta tailors to the real role instead of the "general" focus fallback. */
  target_role?: string | null;
  target_company?: string | null;
  duration: number;
  score: number;
  questions: number;
  transcript: { speaker: string; text: string; time: string }[];
  ai_feedback: string;
  skill_scores: Record<string, number> | null;
  job_description?: string | null;
  jd_analysis?: Record<string, unknown> | null;
  negotiation_metrics?: Record<string, unknown> | null;
  /* Cached evaluator output (server-handlers/evaluate-session.ts). jsonb
     column; shape is the SessionReport but we only read `coaching` here for
     the dashboard card, so it's typed loosely. The report layer is the trust
     boundary — this is just transport. */
  report_json?: { coaching?: SessionCoaching | null; focusMetrics?: SessionFocusMetric[] | null } & Record<string, unknown> | null;
  /* Schema version the evaluator was on when the report was written.
     Surfaced so the client can short-circuit /api/evaluate-session
     when (report_json present, report_version === current). The
     constant lives in server-handlers/evaluate-session.ts and is
     re-exported via REPORT_VERSION below. */
  report_version?: string | null;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  company: string;
  date: string;
  time: string;
  type: string;
  notes: string;
  google_event_id?: string;
  created_at: string;
}

/* ─── Profile helpers ─── */

export async function getProfile(userId: string): Promise<Profile | null> {
  const client = await getSupabase();
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[supabase] getProfile error:", error.message, error.code, "for user:", userId);
  }
  return data;
}

/**
 * Direct profile upsert via supabase-js. Only used for first-time profile
 * creation (`ensureProfile` immediately after a brand-new signup, when no
 * session is persisted yet to route through our own API). All other writes
 * go through POST /api/profile/update, which handles them server-to-server
 * with the service role key — see src/apiClient.ts and
 * server-handlers/update-profile.ts.
 *
 * Retains the column-stripping retry loop so a missing column in an older
 * database doesn't break brand-new signups.
 */
export async function upsertProfile(profile: Partial<Profile> & { id: string }): Promise<{ data: unknown; error: unknown; strippedColumns?: string[] }> {
  const client = await getSupabase();
  const safeProfile = { ...profile } as Record<string, unknown>;
  const strippedColumns: string[] = [];

  for (let attempt = 0; attempt < 8; attempt++) {
    const result = await client.from("profiles").upsert(safeProfile, { onConflict: "id" });
    if (!result.error) {
      if (strippedColumns.length > 0) console.warn("[supabase] saved OK but stripped columns:", strippedColumns.join(", "));
      return { ...result, strippedColumns };
    }
    const missingCol = result.error.message.match(/Could not find the '(\w+)' column/)?.[1]
      || result.error.message.match(/column "(\w+)" of relation .* does not exist/i)?.[1];
    if (missingCol && missingCol in safeProfile && missingCol !== "id") {
      console.warn(`[supabase] column '${missingCol}' missing in DB`);
      strippedColumns.push(missingCol);
      delete safeProfile[missingCol];
      continue;
    }
    console.error("[supabase] upsert failed:", result.error.message);
    return { ...result, strippedColumns };
  }
  return { data: null, error: null, strippedColumns };
}

/* ─── Live Interview Turn Persistence ─── */

export interface InterviewTurn {
  id: string;
  session_id: string;
  user_id: string;
  turn_index: number;
  turn_type: "session_start" | "question" | "answer" | "follow_up";
  speaker: "ai" | "user" | "system";
  content: string;
  metadata: Record<string, unknown> | null;
  created_at?: string;
}

/**
 * Create the live session row and save all initial questions as turns.
 * Returns success/failure so callers can react (toast, retry queue, etc.) —
 * previous void-returning version meant transcript loss was silent.
 */
export async function initLiveSession(params: {
  sessionId: string;
  userId: string;
  type: string;
  difficulty: string;
  focus: string;
  role: string;
  company: string;
  questions: { type: string; aiText: string; persona?: string }[];
}): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured) return { ok: false, error: "Supabase not configured" };
  try {
    const client = await getSupabase();
    const turns: Omit<InterviewTurn, "created_at">[] = [
      {
        id: safeUUID(),
        session_id: params.sessionId,
        user_id: params.userId,
        turn_index: 0,
        turn_type: "session_start",
        speaker: "system",
        content: `Interview started: ${params.type} / ${params.difficulty}`,
        metadata: { type: params.type, difficulty: params.difficulty, focus: params.focus, role: params.role, company: params.company },
      },
      ...params.questions.map((q, i) => ({
        id: safeUUID(),
        session_id: params.sessionId,
        user_id: params.userId,
        turn_index: i + 1,
        turn_type: "question" as const,
        speaker: "ai" as const,
        content: q.aiText,
        metadata: { questionType: q.type, ...(q.persona ? { persona: q.persona } : {}) },
      })),
    ];
    const { error } = await client.from("interview_turns").insert(turns);
    if (error) {
      console.error("[supabase] initLiveSession insert failed:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[supabase] initLiveSession threw:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Save a single turn (answer or follow-up) in real-time.
 * Returns success/failure + queues a localStorage backup on failure so
 * transcripts aren't silently lost on flaky network.
 */
const TURN_RETRY_QUEUE_KEY = "hirestepx_pending_turns";

export async function saveInterviewTurn(turn: Omit<InterviewTurn, "created_at">): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured) return { ok: false, error: "Supabase not configured" };
  try {
    const client = await getSupabase();
    const { error } = await client.from("interview_turns").insert(turn);
    if (error) {
      console.error("[supabase] saveInterviewTurn failed:", error.message);
      queueTurnForRetry(turn);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[supabase] saveInterviewTurn threw:", msg);
    queueTurnForRetry(turn);
    return { ok: false, error: msg };
  }
}

/** Localstorage backup queue for failed turns. Survives reload. Drained by flushPendingTurns(). */
function queueTurnForRetry(turn: Omit<InterviewTurn, "created_at">): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(TURN_RETRY_QUEUE_KEY);
    const queue = raw ? (JSON.parse(raw) as Array<Omit<InterviewTurn, "created_at">>) : [];
    queue.push(turn);
    // Cap at 200 to prevent localStorage overflow on prolonged outage.
    if (queue.length > 200) queue.splice(0, queue.length - 200);
    localStorage.setItem(TURN_RETRY_QUEUE_KEY, JSON.stringify(queue));
  } catch { /* localStorage may be full or disabled — best effort */ }
}

/** Drain the retry queue. Call on app load or network-recovery events. */
export async function flushPendingTurns(): Promise<{ flushed: number; failed: number }> {
  if (typeof localStorage === "undefined" || !supabaseConfigured) return { flushed: 0, failed: 0 };
  let queue: Array<Omit<InterviewTurn, "created_at">> = [];
  try {
    const raw = localStorage.getItem(TURN_RETRY_QUEUE_KEY);
    if (!raw) return { flushed: 0, failed: 0 };
    queue = JSON.parse(raw);
  } catch { return { flushed: 0, failed: 0 }; }
  if (queue.length === 0) return { flushed: 0, failed: 0 };

  const remaining: typeof queue = [];
  let flushed = 0;
  for (const turn of queue) {
    const res = await saveInterviewTurn(turn);
    // saveInterviewTurn auto-requeues on failure; avoid double-queueing here.
    if (res.ok) flushed++;
    else remaining.push(turn);
  }
  try {
    if (remaining.length === 0) localStorage.removeItem(TURN_RETRY_QUEUE_KEY);
    else localStorage.setItem(TURN_RETRY_QUEUE_KEY, JSON.stringify(remaining));
  } catch { /* best effort */ }
  return { flushed, failed: remaining.length };
}

/* ─── Session helpers ─── */

export async function saveSession(session: Omit<SessionRecord, "created_at">) {
  const client = await getSupabase();
  const result = await client.from("sessions").insert(session);
  if (result.error) throw new Error(result.error.message);
  return result;
}

export async function getUserSessions(userId: string): Promise<SessionRecord[]> {
  const client = await getSupabase();
  const { data } = await client
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function getSessionById(sessionId: string, userId: string): Promise<SessionRecord | null> {
  const client = await getSupabase();
  const { data } = await client
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

/**
 * Pull the gap-flag list from the user's most-recent analyzed session.
 *
 * Used by the dashboard "Your next move" CTA to surface gap-specific
 * coaching (`pickNextMove({ topGaps })`). The analyzer writes one row
 * per session into `session_insights` — we just need the freshest one
 * for the current user.
 *
 * Returns [] on miss, RLS denial, or any error. Best-effort: a failed
 * read silently falls back to the skill-based CTA, never breaks the
 * dashboard.
 */
export async function getLatestSessionInsightFlags(
  userId: string,
  /* Phase-6.1: optional focus filter. The auto-prebias path in
   *  useInterviewEngine wants the latest flag set for the SAME focus
   *  as the new session — feeding HR flags into a behavioral run (or
   *  vice-versa) drops every flag at the server's vocabulary check
   *  anyway, but the unfiltered query also blocks the legitimate same-
   *  focus row when intervening sessions of other focuses exist.
   *  When `focus` is omitted, behaviour is unchanged (latest of any
   *  focus) — protects the existing HR-round caller until it migrates. */
  focus?: string,
): Promise<string[]> {
  try {
    const client = await getSupabase();
    let query = client
      .from("session_insights")
      .select("flags")
      .eq("user_id", userId);
    if (focus) {
      query = query.eq("focus", focus);
    }
    const { data } = await query
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const flags = (data as { flags?: unknown } | null)?.flags;
    return Array.isArray(flags) ? flags.filter((f): f is string => typeof f === "string") : [];
  } catch {
    return [];
  }
}

/* ─── Feedback helpers ─── */

export interface FeedbackRecord {
  id: string;
  user_id: string;
  session_id: string;
  rating: "helpful" | "too_harsh" | "too_generous" | "inaccurate";
  comment: string;
  session_score: number;
  session_type: string;
  created_at: string;
}

export async function saveFeedback(feedback: Omit<FeedbackRecord, "created_at">) {
  if (!supabaseConfigured) return { error: null };
  const client = await getSupabase();
  return client.from("feedback").upsert(feedback, { onConflict: "id" });
}

export async function getSessionFeedback(sessionId: string, userId: string): Promise<FeedbackRecord | null> {
  if (!supabaseConfigured) return null;
  const client = await getSupabase();
  const { data } = await client
    .from("feedback")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

/* ─── Payment history helpers ─── */

export interface PaymentRecord {
  id: string;
  user_id: string;
  razorpay_payment_id: string;
  razorpay_order_id: string;
  plan: string;
  tier: string;
  amount: number;
  currency: string;
  status: string;
  subscription_start: string;
  subscription_end: string;
  created_at: string;
  receipt_url?: string | null;
}

export async function getPaymentHistory(userId: string): Promise<PaymentRecord[]> {
  if (!supabaseConfigured) return [];
  const client = await getSupabase();
  const { data, error } = await client
    .from("payments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.warn("[supabase] getPaymentHistory error:", error.message);
    return [];
  }
  return (data || []) as PaymentRecord[];
}

/* ─── Calendar helpers ─── */

export async function getCalendarEvents(userId: string): Promise<CalendarEvent[]> {
  const client = await getSupabase();
  const { data } = await client
    .from("calendar_events")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true });
  return data || [];
}

// Calendar writes now go exclusively through the DB-authoritative `/api/calendar/*`
// handlers (see calendarAPI.ts). The old client-direct saveCalendarEvent /
// deleteCalendarEvent + Google push helper were dead and violated the
// no-client-direct-mutation rule, so they were removed.

/* ─── Google Calendar Sync ─── */

export function getGoogleProviderToken(): string | null {
  try { return localStorage.getItem("hirestepx_google_token"); } catch { return null; }
}

export function clearGoogleProviderToken() {
  try { localStorage.removeItem("hirestepx_google_token"); } catch { /* expected: localStorage may be unavailable */ }
}

function extractCompany(summary: string): string {
  const withMatch = summary.match(/(?:interview|call|chat|screen)\s+(?:with|at)\s+(.+)/i);
  if (withMatch) return withMatch[1].trim();
  const prefixMatch = summary.match(/^(.+?)\s+(?:interview|call|chat|screen)/i);
  if (prefixMatch) return prefixMatch[1].trim();
  return "";
}

function detectInterviewType(summary: string, description: string): string {
  const text = `${summary} ${description}`.toLowerCase();
  if (text.includes("technical") || text.includes("coding")) return "Technical";
  if (text.includes("behavioral") || text.includes("culture")) return "Behavioral";
  if (text.includes("system design")) return "System Design";
  if (text.includes("case study")) return "Case Study";
  if (text.includes("phone screen")) return "Phone Screen";
  if (text.includes("final")) return "Final Round";
  return "Behavioral";
}

export async function fetchGoogleCalendarEvents(token: string): Promise<CalendarEvent[]> {
  const now = new Date().toISOString();
  const maxDate = new Date(Date.now() + 90 * 86400000).toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
    `timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(maxDate)}` +
    `&singleEvents=true&orderBy=startTime&maxResults=50`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      clearGoogleProviderToken();
      throw new Error("Calendar access not granted — please sign in with Google again");
    }
    throw new Error(`Google Calendar API error: ${res.status}`);
  }

  const data = await res.json();
  type GoogleCalendarItem = { id?: string; summary?: string; description?: string; start?: { dateTime?: string; date?: string } };
  const items: GoogleCalendarItem[] = data.items || [];
  const interviewKeywords = /interview|round|screen|onsite|recruiter|hiring|placement|assessment|walkthrough/i;
  const filtered = items.filter(item => {
    const text = `${item.summary || ""} ${item.description || ""}`;
    return interviewKeywords.test(text);
  });

  return filtered.map(item => ({
    id: "",
    user_id: "",
    title: item.summary || "Interview",
    company: extractCompany(item.summary || ""),
    date: (item.start?.dateTime || item.start?.date || "").split("T")[0],
    time: item.start?.dateTime
      ? new Date(item.start.dateTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      : "09:00",
    type: detectInterviewType(item.summary || "", item.description || ""),
    notes: item.description || "",
    google_event_id: item.id,
    created_at: "",
  }));
}

export async function syncGoogleEvents(userId: string): Promise<{ synced: number; error?: string }> {
  const token = getGoogleProviderToken();
  if (!token) return { synced: 0, error: "No Google token — please sign in with Google" };

  const googleEvents = await fetchGoogleCalendarEvents(token);
  if (googleEvents.length === 0) return { synced: 0 };

  const client = await getSupabase();

  const { data: existing } = await client
    .from("calendar_events")
    .select("google_event_id")
    .eq("user_id", userId)
    .not("google_event_id", "is", null);

  const existingIds = new Set((existing || []).map((e: { google_event_id: string | null }) => e.google_event_id));

  const newEvents = googleEvents
    .filter(e => e.google_event_id && !existingIds.has(e.google_event_id))
    .map(e => ({
      id: safeUUID(),
      user_id: userId,
      title: e.title,
      company: e.company,
      date: e.date,
      time: e.time,
      type: e.type,
      notes: e.notes,
      google_event_id: e.google_event_id,
    }));

  if (newEvents.length === 0) return { synced: 0 };

  const { error } = await client.from("calendar_events").insert(newEvents);
  if (error) return { synced: 0, error: error.message };

  return { synced: newEvents.length };
}

/** Read the user's purchased session-credit balance.
 *
 * Reads via the /api/credit-balance server endpoint (service-role auth) rather
 * than supabase-js directly. The direct supabase-js path relied on auth.uid()
 * being resolved inside the RLS policy, which silently returned 0 in some
 * browser environments when the JWT wasn't propagated correctly to PostgREST.
 * The server endpoint uses the service role key, bypassing RLS entirely, and
 * is authoritative.
 *
 * Returns the balance on success. Throws on network/auth/server errors so the
 * caller can distinguish a genuine 0-balance (HTTP 200, balance: 0) from a
 * failed read — avoiding the previous behaviour where a misconfigured env var
 * silently showed every user as having 0 credits.
 *
 * Retries up to `maxRetries` times on 502/503 (transient infra errors) with
 * exponential back-off before giving up. */
export async function getCreditBalance(_userId: string, maxRetries = 2): Promise<number> {
  if (!_userId) return 0;

  // authHeaders() reads the JWT from localStorage — must be done before fetch.
  const hdrs = await authHeaders();

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch("/api/credit-balance", { headers: hdrs });

      // 200 → parse balance. balance:null means the server had a read error but
      // returned a structured response; treat as transient and retry.
      if (res.ok) {
        const json = await res.json() as { balance?: number | null; error?: string };
        if (typeof json.balance === "number") return Math.max(0, json.balance);
        // balance: null → server-side read failure reported structurally; retry
        throw new Error(`credit-balance read_failed: ${json.error ?? "unknown"}`);
      }

      // 401/403 → auth problem; no point retrying
      if (res.status === 401 || res.status === 403) {
        throw new Error(`credit-balance auth ${res.status}`);
      }

      // 502/503 → transient infra error; retry
      lastError = new Error(`credit-balance ${res.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Auth errors should not be retried
      if (lastError.message.includes("auth 401") || lastError.message.includes("auth 403")) throw lastError;
    }

    if (attempt < maxRetries) {
      // Exponential back-off: 300ms, 600ms
      await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error("credit-balance: max retries exceeded");
}
