/* Vercel Edge Function — Save Session
 *
 * Single authoritative endpoint for persisting a completed interview session
 * AND bumping the user's practice_timestamps in one server-to-server call.
 *
 * Why this exists:
 *   The previous path used supabase-js directly from the browser, which goes
 *   through window.fetch. A material fraction of users run extensions (Loom,
 *   Jam.dev, Hotjar, session-replay tools) that wrap fetch and silently hang
 *   authenticated POSTs above a small body-size threshold. Transcripts +
 *   jd_analysis + skill_scores routinely cross that threshold, so "session
 *   completed but nothing in the sessions table, nothing in practice_timestamps"
 *   was reproducible in the wild. Routing through our own endpoint via the
 *   XHR-based apiClient bypasses those wrappers.
 *
 * Additionally, doing the session insert and the practice_timestamps append
 * in the same request eliminates the race between two independent writes
 * that each have their own failure modes.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId } from "./_shared";
import { resolveActiveResumeVersionId } from "./_resume-versioning";
import { captureServerEvent, distinctIdFrom } from "./_posthog";
import { kickoffEagerGrade, resolveBaseUrl } from "./_eager-grade";
import { emailShell, title, para, button, escapeHtml } from "./_email-theme";
import { groundNoCounterSkillScores } from "../src/sessionReport/progressTracking";
import { computeStreakReward } from "./_streak-reward";
import { grantSessionCredits } from "./_session-credits";
import { computePracticeTimestamps } from "./_save-session-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <hello@hirestepx.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://hirestepx.com";

interface SessionBody {
  id?: unknown;
  date?: unknown;
  type?: unknown;
  difficulty?: unknown;
  focus?: unknown;
  duration?: unknown;
  score?: unknown;
  questions?: unknown;
  transcript?: unknown;
  ai_feedback?: unknown;
  skill_scores?: unknown;
  job_description?: unknown;
  jd_analysis?: unknown;
  // Optional: client can send the version id it was using when the
  // session started. Falls back to resolveActiveResumeVersionId on the
  // server if not provided. Either way, immutable once written —
  // re-uploading a resume after the session never re-binds the row.
  resume_version_id?: unknown;
  target_role?: unknown;
  target_company?: unknown;
  negotiation_metrics?: unknown;
}

/** Whitelist the kernel-metrics payload to its known shape. Rejects
 *  anything not a plain object, drops unknown keys, clamps numbers to
 *  sane ranges. Returns null on any structural problem so the column
 *  stays NULL rather than persisting tampered data. */
export function sanitizeNegotiationMetrics(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const num = (n: unknown, lo: number, hi: number): number | null => {
    if (typeof n !== "number" || !Number.isFinite(n)) return null;
    return Math.max(lo, Math.min(hi, n));
  };
  const outcome = typeof o.outcome === "string" && ["accepted", "walked-away", "stalemate", "in-progress"].includes(o.outcome)
    ? o.outcome
    : null;
  if (!outcome) return null;
  /* Bounded LPA array — the report's authoritative offer trajectory. Caps
     length and clamps each entry so a malformed/oversized payload can't
     bloat the row or poison the chart. */
  const lpaArray = (a: unknown): number[] | undefined => {
    if (!Array.isArray(a)) return undefined;
    return a
      .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
      .slice(0, 50)
      .map((x) => Math.max(0, Math.min(500, x)));
  };
  /* Bounded short-string array — Voss tactics / info-asked labels. */
  const strArray = (a: unknown): string[] | undefined => {
    if (!Array.isArray(a)) return undefined;
    return a
      .filter((x): x is string => typeof x === "string")
      .slice(0, 20)
      .map((x) => x.slice(0, 80));
  };
  const lowballEvent = (() => {
    if (!o.lowballEvent || typeof o.lowballEvent !== "object") return undefined;
    const e = o.lowballEvent as Record<string, unknown>;
    return {
      candidateAnchor: num(e.candidateAnchor, 0, 500) ?? 0,
      bandFloor: num(e.bandFloor, 0, 500) ?? 0,
      gapPct: num(e.gapPct, -1000, 1000) ?? 0,
      recruiterProbed: e.recruiterProbed === true,
      candidateHeld: e.candidateHeld === true,
    };
  })();
  const powerContext = (() => {
    if (!o.powerContext || typeof o.powerContext !== "object") return undefined;
    const p = o.powerContext as Record<string, unknown>;
    const sig = (p.signals && typeof p.signals === "object" ? p.signals : {}) as Record<string, unknown>;
    const posture = ["strong", "neutral", "hungry"].includes(p.posture as string) ? (p.posture as string) : "neutral";
    const leverage = ["low", "neutral", "high"].includes(p.candidateLeverage as string) ? (p.candidateLeverage as string) : "neutral";
    const quarter = ["fresh-quarter", "mid-quarter", "quarter-end", "annual-sprint"].includes(sig.quarterTiming as string)
      ? (sig.quarterTiming as string)
      : undefined;
    return {
      recruiterPower: num(p.recruiterPower, 0, 1) ?? 0,
      signals: {
        ...(num(sig.openReqMonths, 0, 120) != null ? { openReqMonths: num(sig.openReqMonths, 0, 120) } : {}),
        ...(num(sig.pipelineDepth, 0, 1000) != null ? { pipelineDepth: num(sig.pipelineDepth, 0, 1000) } : {}),
        ...(quarter ? { quarterTiming: quarter } : {}),
        ...(typeof sig.candidateHasCompetingProcess === "boolean" ? { candidateHasCompetingProcess: sig.candidateHasCompetingProcess } : {}),
      },
      posture,
      candidateLeverage: leverage,
    };
  })();
  const traj = lpaArray(o.offerTrajectoryLpa);
  const voss = strArray(o.vossTacticsUsed);
  const info = strArray(o.infoAsked);
  return {
    outcome,
    anchorTurn: typeof o.anchorTurn === "number" && Number.isFinite(o.anchorTurn) ? Math.max(0, Math.min(50, o.anchorTurn)) : null,
    leverDiversity: num(o.leverDiversity, 0, 11) ?? 0,
    lpaGained: num(o.lpaGained, 0, 500) ?? 0,
    lpaPerTurn: num(o.lpaPerTurn, 0, 500) ?? 0,
    bandTraversal: typeof o.bandTraversal === "number" && Number.isFinite(o.bandTraversal) ? Math.max(0, Math.min(1, o.bandTraversal)) : null,
    overBandViolation: o.overBandViolation === true,
    totalTurns: num(o.totalTurns, 0, 50) ?? 0,
    score: num(o.score, 0, 100) ?? 0,
    /* Authoritative offer/ask numbers — the report adapter's
       adoptKernelOutcome REQUIRES initialOfferLpa + offerTrajectoryLpa to
       drive the offer trajectory + close/stage detection from kernel truth.
       Dropping them (the pre-2026-06-27 sanitizer did) forced every
       Supabase-loaded report onto the transcript-regex heuristic, which
       rendered a cleanly-closed negotiation as "0 of 5 stages / didn't
       close" cross-device and after localStorage eviction. (DATA-1.) */
    ...(num(o.initialOfferLpa, 0, 500) != null ? { initialOfferLpa: num(o.initialOfferLpa, 0, 500) } : {}),
    ...(num(o.finalOfferLpa, 0, 500) != null ? { finalOfferLpa: num(o.finalOfferLpa, 0, 500) } : {}),
    candidateAskLpa: num(o.candidateAskLpa, 0, 500),
    ...(traj ? { offerTrajectoryLpa: traj } : {}),
    /* Optional kernel signals consumed by the Quality / Voss-tactics /
       UnaskedLevers / lowball / power-dynamics panels. */
    ...(voss ? { vossTacticsUsed: voss } : {}),
    ...(info ? { infoAsked: info } : {}),
    ...(typeof o.walkAwayReturned === "boolean" ? { walkAwayReturned: o.walkAwayReturned } : {}),
    ...(typeof o.hardBandCap === "boolean" ? { hardBandCap: o.hardBandCap } : {}),
    ...(["soft", "neutral", "hot"].includes(o.marketMode as string) ? { marketMode: o.marketMode } : {}),
    ...(lowballEvent ? { lowballEvent } : {}),
    ...(powerContext ? { powerContext } : {}),
    /* S4S5-B3 — persist the one-time joining bonus so the report's
       OfferEconomicsPanel and CounterOfferLetterPanel can surface it
       after DB save/reload (previously lost because the sanitizer dropped it). */
    ...(num(o.lastJoiningBonusOffered, 0, 500) != null
      ? { lastJoiningBonusOffered: num(o.lastJoiningBonusOffered, 0, 500) }
      : {}),
  };
}

/* REPORT-4b write-time grounding. The Skill Progress panel reads persisted
 * skill_scores DIRECTLY (fetchSkillProgressTrends → sessionRowsToProgressPoints),
 * bypassing the report adapter's render-time grounding — so a no-counter session
 * that persists `anchoring: 70` renders "Anchoring 70 · +30 pts vs last" on this
 * and every future report, contradicting the same session's "No counter named"
 * headline, "Numbers stated 0%", and grounded Skills Breakdown. Grounding the
 * anchor / counter / specificity axes at the write seam keeps the stored row
 * coherent for every downstream reader. The rule itself is the ONE shared
 * `groundNoCounterSkillScores` (also applied at the cross-session read seam),
 * imported above and re-exported here so save-session's existing unit tests
 * keep their import path. */
export { groundNoCounterSkillScores };

function asString(v: unknown, max = 500): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max);
}

function asNumber(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Validate and sanitize a raw transcript array before persisting.
 *
 *  The CANONICAL transcript shape across the entire app is
 *  `{ speaker: "ai" | "user"; text: string; time?: string }` — the
 *  interview engine, the session-detail / dashboard render, and the
 *  SessionReport → evaluate-session boundary (which maps speaker→role)
 *  all read `speaker`. Persisting any other shape silently breaks every
 *  downstream reader. (An earlier version validated against an invented
 *  `{ role: "interviewer" | "candidate" }` shape that nothing in the app
 *  ever produces, so EVERY entry was filtered out and every session
 *  persisted an empty transcript — see PRI-61.)
 *
 *  (a) Limits total entries to 200 to prevent oversized payloads reaching the DB.
 *  (b) Each entry must have speaker === "ai" or speaker === "user" — any other
 *      value (injection attempts, unknown speakers) is dropped.
 *  (c) Caps text at 3000 chars per entry so a single turn can't balloon the row,
 *      and time at 16 chars (it's a "mm:ss" display stamp).
 *  Returns an empty array when the input is not an array. */
export function sanitizeTranscript(raw: unknown): Array<{ speaker: string; text: string; time?: string }> {
  if (!Array.isArray(raw)) return [];
  const VALID_SPEAKERS = new Set(["ai", "user"]);
  return raw
    .slice(0, 200)
    .filter(
      (entry): entry is { speaker: string; text: string; time?: unknown } =>
        entry !== null &&
        typeof entry === "object" &&
        typeof (entry as Record<string, unknown>).speaker === "string" &&
        VALID_SPEAKERS.has((entry as Record<string, unknown>).speaker as string) &&
        typeof (entry as Record<string, unknown>).text === "string",
    )
    .map(entry => {
      const time = (entry as Record<string, unknown>).time;
      return {
        speaker: entry.speaker,
        text: entry.text.slice(0, 3000),
        ...(typeof time === "string" ? { time: time.slice(0, 16) } : {}),
      };
    });
}

/** Map the canonical speaker-shaped transcript to the role-shaped input
 *  evaluate-session expects. Single boundary conversion — mirrors
 *  src/sessionReport/SessionReport.tsx so the eager (save-time) grade and
 *  the user-initiated (report-view) grade feed evaluate-session identical
 *  data. Without this, eager grading saw every turn as `role: undefined`
 *  and labelled the whole transcript CANDIDATE. */
export function toRoleTranscript(
  rows: Array<{ speaker: string; text: string }>,
): Array<{ role: string; text: string }> {
  return rows.map(t => ({
    role: t.speaker === "ai" ? "interviewer" : "candidate",
    text: t.text,
  }));
}

/* ── Session-report email ── */

/** Fire-and-forget: notify the user that their interview report is ready.
 *  Uses the same Resend + _email-theme pattern as verify-payment.ts.
 *  Never throws — any failure is swallowed so the save-session response
 *  is never delayed or blocked. */
async function sendSessionReportEmail(
  userEmail: string,
  userName: string,
  sessionId: string,
  interviewType: string,
): Promise<void> {
  if (!RESEND_API_KEY || !userEmail) return; // skip if not configured
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(userEmail)) return;

  const reportUrl = `${APP_URL}/session/${sessionId}`;
  const greeting = escapeHtml(userName || "there");
  const typeLabel = escapeHtml(interviewType || "interview");

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000);
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: ac.signal,
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
        // One report email per session: a save retry (slow network, double
        // submit) dedupes to a single Resend send within 24h.
        "Idempotency-Key": `session-report-${sessionId}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [userEmail],
        subject: "Your HireStepX interview report is ready 🎯",
        html: emailShell({
          preview: `Your ${typeLabel} report is ready. Tap to see your score and feedback.`,
          body:
            title("Your report is", { accentWord: "ready." }) +
            para(`Hi ${greeting}, your ${typeLabel} session has been graded. Your AI feedback, STAR breakdown, and skill scores are waiting for you.`) +
            button("View my report", reportUrl) +
            para(
              "If you didn't take this interview or have questions, reply to this email and we'll help.",
              { small: true, muted: true },
            ),
        }),
      }),
    });
    clearTimeout(timer);
    if (!emailRes.ok) {
      const errBody = await emailRes.text().catch(() => "");
      console.warn(`[save-session] session report email failed HTTP ${emailRes.status}: ${errBody.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn(`[save-session] session report email threw: ${(err as Error).message}`);
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503,
      headers: withRequestId(corsHeaders(req)),
    });
  }

  // Transcripts + skill_scores + jd_analysis can be sizeable — cap at 500 KB
  // which is generous for a 30-minute interview with full per-turn transcript.
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "save-session",
    ipLimit: 30,
    userLimit: 15,
    maxBytes: 500_000,
    checkQuota: false,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;

  if (!auth.userId || typeof auth.userId !== "string") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  let body: SessionBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  // Pin the resume_version_id used to generate this session's questions
  // so scores stay reproducible if the user later re-uploads. Prefer the
  // value the client sent (captured at session start); fall back to
  // looking up whatever resume is currently active for this user. Null
  // is acceptable — sessions can run with no resume.
  const clientVersionId = typeof body.resume_version_id === "string" && /^[0-9a-f-]{32,}$/i.test(body.resume_version_id)
    ? body.resume_version_id
    : null;
  const resolvedVersionId = clientVersionId
    || await resolveActiveResumeVersionId(SUPABASE_URL, SUPABASE_SERVICE_KEY, auth.userId, asString(body.type, 64));

  /* Sanitize once, reuse for both the negotiation_metrics column AND the
     write-time skill-score grounding below (REPORT-4b). candidateAskLpa is the
     kernel's authoritative ask; null ⇒ no counter was ever named. */
  const negMetrics = sanitizeNegotiationMetrics(body.negotiation_metrics);
  const rawSkillScores =
    body.skill_scores && typeof body.skill_scores === "object"
      ? (body.skill_scores as Record<string, unknown>)
      : null;
  const candidateAskLpa =
    typeof negMetrics?.candidateAskLpa === "number" ? negMetrics.candidateAskLpa : null;
  /* Ground only for negotiation rows (negMetrics present). Non-negotiation
     sessions never carry a counter concept, so their skill_scores pass through
     untouched even if a key happens to match the anchor regex. */
  const skillScores = negMetrics
    ? groundNoCounterSkillScores(rawSkillScores, candidateAskLpa)
    : rawSkillScores;

  const sessionRow = {
    id: asString(body.id, 64),
    user_id: auth.userId,
    date: asString(body.date, 64) || new Date().toISOString(),
    type: asString(body.type, 64),
    difficulty: asString(body.difficulty, 32),
    focus: asString(body.focus, 128),
    duration: asNumber(body.duration),
    score: asNumber(body.score),
    questions: asNumber(body.questions),
    transcript: sanitizeTranscript(body.transcript),
    ai_feedback: asString(body.ai_feedback, 20000),
    skill_scores: skillScores,
    job_description: asString(body.job_description, 20000) || null,
    jd_analysis: (body.jd_analysis && typeof body.jd_analysis === "object") ? body.jd_analysis : null,
    resume_version_id: resolvedVersionId,
    target_role: asString(body.target_role, 200) || null,
    target_company: asString(body.target_company, 200) || null,
    /* Kernel-aware negotiation metrics. Persisted on salary-neg
       sessions only; null otherwise. Whitelisted to a fixed set of
       primitive fields so a tampered client can't dump arbitrary
       payload into the column. The column-stripping retry below
       handles environments where the migration hasn't run yet. */
    negotiation_metrics: negMetrics,
  };

  if (!sessionRow.id) {
    return new Response(JSON.stringify({ error: "Missing session id" }), { status: 400, headers });
  }

  const t0 = Date.now();

  // Ownership guard: sessions.id is text (caller-supplied), and the upsert uses
  // service role which bypasses RLS. Check that any pre-existing row with this
  // ID belongs to the authenticated user before merging. A crafted ID that matches
  // another user's session would otherwise silently overwrite their data.
  {
    const ownerRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?id=eq.${encodeURIComponent(sessionRow.id)}&select=user_id`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    );
    if (!ownerRes.ok) {
      return new Response(JSON.stringify({ error: "Service unavailable" }), { status: 503, headers });
    }
    const ownerRows = await ownerRes.json().catch(() => []);
    if (Array.isArray(ownerRows) && ownerRows[0] && ownerRows[0].user_id !== auth.userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
    }
  }

  // 1. Insert the session row. Column-stripping retry for environments where
  //    jd_analysis / job_description haven't been migrated yet.
  const strippedSession: string[] = [];
  const row: Record<string, unknown> = { ...sessionRow };
  let sessionOk = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions?on_conflict=id`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([row]),
    });
    if (res.ok) { sessionOk = true; break; }
    const errText = await res.text().catch(() => "");
    const missingCol = errText.match(/Could not find the '(\w+)' column/)?.[1]
      || errText.match(/column "(\w+)" of .* does not exist/i)?.[1]
      || errText.match(/column sessions\.(\w+) does not exist/i)?.[1];
    if (missingCol && missingCol in row && missingCol !== "id" && missingCol !== "user_id") {
      strippedSession.push(missingCol);
      delete row[missingCol];
      continue;
    }
    console.error(`[save-session] session insert failed HTTP ${res.status}: ${errText.slice(0, 300)}`);
    return new Response(JSON.stringify({
      error: "Session save failed",
      details: errText.slice(0, 300),
      strippedColumns: strippedSession,
    }), { status: res.status >= 400 && res.status < 500 ? 400 : 502, headers });
  }

  if (!sessionOk) {
    return new Response(JSON.stringify({
      error: "Session save failed after retries",
      strippedColumns: strippedSession,
    }), { status: 500, headers });
  }

  // Fire-and-forget: attribute LLM cost to this session
  // Queries llm_usage rows tagged with this session_id, computes INR cost,
  // and patches the sessions row. Never delays the save-session response.
  void (async () => {
    try {
      const { costBreakdown: computeCost, DEFAULT_COST_RATES } = await import("./_cost-helpers");
      const usageRes = await fetch(
        `${SUPABASE_URL}/rest/v1/llm_usage?session_id=eq.${encodeURIComponent(sessionRow.id)}&select=total_tokens,prompt_tokens,completion_tokens,is_fallback`,
        { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
      );
      if (!usageRes.ok) return;
      const usageRows: Array<{ total_tokens: number; prompt_tokens: number; completion_tokens: number; is_fallback: boolean }> = await usageRes.json();
      if (!Array.isArray(usageRows) || usageRows.length === 0) return;
      let promptTok = 0, completionTok = 0, primaryTok = 0, fallbackTok = 0;
      for (const r of usageRows) {
        promptTok += r.prompt_tokens || 0;
        completionTok += r.completion_tokens || 0;
        if (r.is_fallback) fallbackTok += r.total_tokens || 0;
        else primaryTok += r.total_tokens || 0;
      }
      const cost = computeCost({ llmTokensPrimary: primaryTok, llmTokensFallback: fallbackTok, ttsChars: 0, sttCalls: 0, sessions: 1 }, DEFAULT_COST_RATES);
      await fetch(
        `${SUPABASE_URL}/rest/v1/sessions?id=eq.${encodeURIComponent(sessionRow.id)}`,
        {
          method: "PATCH",
          headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ llm_cost_inr: cost.llmInr, prompt_tokens: promptTok, completion_tokens: completionTok }),
        },
      );
    } catch { /* best effort — never block the user response */ }
  })();

  // 2. Atomically append a timestamp to practice_timestamps. Read-modify-write
  //    with the service role — not ideal for high concurrency but a user only
  //    completes one session at a time, so races aren't real here.
  const nowIso = new Date().toISOString();
  let practiceAppended = false;
  try {
    const getRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(auth.userId)}&select=practice_timestamps,started_session_ids`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      },
    );
    if (getRes.ok) {
      const arr = await getRes.json().catch(() => []);
      const row = Array.isArray(arr) && arr[0] ? arr[0] : {};
      const existing: string[] = Array.isArray(row.practice_timestamps) ? row.practice_timestamps : [];
      const startedIds: string[] = Array.isArray(row.started_session_ids) ? row.started_session_ids : [];

      const questionsAnswered = (sessionRow.questions ?? 0) >= 1;
      const { next, refundedStartedIds, alreadyCounted, isGhostSession } = computePracticeTimestamps({
        existing,
        startedIds,
        sessionId: sessionRow.id,
        questionsAnswered,
        nowIso,
      });

      const patchBody: Record<string, unknown> = { practice_timestamps: next, has_completed_onboarding: true };
      if (refundedStartedIds !== null) patchBody.started_session_ids = refundedStartedIds;

      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(auth.userId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify(patchBody),
        },
      );
      if (patchRes.ok) {
        practiceAppended = !isGhostSession;
        if (!alreadyCounted && questionsAnswered) {
          const bonus = computeStreakReward(existing, nowIso);
          if (bonus > 0) {
            const milestone = existing.length + 1;
            void grantSessionCredits(SUPABASE_URL, SUPABASE_SERVICE_KEY, auth.userId, bonus, fetch, 2)
              .then(() => captureServerEvent("streak_milestone_reward", auth.userId, { milestone, bonus }))
              .catch((e: unknown) => console.warn("[save-session] streak reward grant failed:", (e as Error).message));
          }
        }
      } else {
        const t = await patchRes.text().catch(() => "");
        console.warn(`[save-session] practice_timestamps patch failed HTTP ${patchRes.status}: ${t.slice(0, 200)}`);
      }
    } else {
      console.warn(`[save-session] profile read failed HTTP ${getRes.status}`);
    }
  } catch (err) {
    console.warn(`[save-session] practice_timestamps update threw: ${(err as Error).message}`);
  }

  console.log(`[save-session] OK user=${auth.userId.slice(0, 8)} session=${sessionRow.id.slice(0, 8)} practiceAppended=${practiceAppended} questions=${sessionRow.questions ?? 0} stripped=${strippedSession.join(",") || "-"} latency=${Date.now() - t0}ms`);

  // ─── Eager grading kickoff ───
  // The session row is durable in the DB at this point. Kick off the
  // LLM grading asynchronously so the report is already cached by
  // the time the user navigates to it — eliminates the 30s wait at
  // the most fragile point in the funnel. Fire-and-forget; never
  // blocks save-session, never throws. Idempotent at the handler
  // level (evaluate-session checks report_json cache before calling
  // the LLM, so this can race with the user's actual report-view
  // request without producing two LLM calls).
  //
  // Skipped when:
  //   - No transcript in the body (degenerate session)
  //   - No Authorization header (shouldn't happen post-auth, but
  //     guard against it because we forward this header verbatim)
  //   - resolveBaseUrl returns null (no APP_URL + unparseable req.url)
  const authHeader = req.headers.get("authorization");
  const baseUrl = resolveBaseUrl(req.url);
  // Reuse the already-sanitized canonical transcript and convert to the
  // role shape at this single boundary — never re-read the raw body here
  // (that's how the shape drift in PRI-61 went unnoticed).
  const gradeTranscript = toRoleTranscript(sessionRow.transcript);
  if (authHeader && baseUrl && gradeTranscript.length > 0) {
    kickoffEagerGrade({
      baseUrl,
      authorization: authHeader,
      sessionId: sessionRow.id,
      transcript: gradeTranscript,
      meta: {
        type: sessionRow.type,
        focus: sessionRow.focus,
        role: asString(body.type, 64),
        targetCompany: asString((body as { targetCompany?: unknown }).targetCompany, 64) || undefined,
        duration: sessionRow.duration,
      },
    });
  }

  // ─── Session-report email ───
  // Fire-and-forget: fetch the user's email + display name from Supabase auth
  // (service-role admin endpoint) and send a "report ready" notification via
  // Resend. Mobile users who close the tab right after finishing the interview
  // would otherwise never know their report is ready. Never blocks the response.
  void (async () => {
    try {
      const userRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(auth.userId!)}`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        },
      );
      if (userRes.ok) {
        const userData = await userRes.json() as { email?: string; user_metadata?: { name?: string; full_name?: string } };
        const userEmail = userData.email || "";
        const userName = userData.user_metadata?.name || userData.user_metadata?.full_name || "";
        await sendSessionReportEmail(userEmail, userName, sessionRow.id, sessionRow.type || "interview");
      } else {
        console.warn(`[save-session] auth user fetch failed HTTP ${userRes.status} — skipping report email`);
      }
    } catch (err) {
      console.warn(`[save-session] report email dispatch threw: ${(err as Error).message}`);
    }
  })();

  await captureServerEvent("interview_completed", distinctIdFrom(req, auth.userId), {
    session_id: sessionRow.id,
    practice_appended: practiceAppended,
  }, req);

  return new Response(JSON.stringify({
    ok: true,
    sessionId: sessionRow.id,
    practiceAppended,
    timestamp: nowIso,
    strippedColumns: strippedSession,
  }), { status: 200, headers });
}
