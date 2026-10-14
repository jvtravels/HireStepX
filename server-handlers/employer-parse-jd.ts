/* Employer — import a job description
 *
 * POST /api/employer-parse-jd  { text }
 * Reads JD text (the client extracts it from a PDF/DOCX/TXT or a paste) and returns
 * per-field suggestions for the create-requirement form, each with a confidence and a
 * quote from the JD. Nothing is saved; the employer reviews and applies fields.
 *
 * Pattern matching runs first and always. The language model fills the rest on the
 * Groq -> Cloudflare chain (Gemini excluded: it carries the candidate-side load) with its
 * own daily counters, never the candidate LLM quota. If the model is unavailable the
 * employer still gets the pattern-matched fields.
 *
 * Node runtime: the edge bundle limit (1 MB) is too small for the LLM client plus the
 * city and skill vocabularies this needs.
 */

export const config = { runtime: "nodejs" };

import { withAuthAndRateLimit, withRequestId, corsHeaders, redisGet, redisSetEx, redisIncrByWithExpiry, hashStable, slog } from "./_shared";
import { callLLM, extractJSON } from "./_llm-pii";
import { captureServerEvent, captureServerException, distinctIdFrom } from "./_posthog";
import {
  buildJdPrompt, buildWarnings, cleanJdText, extractJdWithRegex, mergeJdFields, sanitizeLlmFields, withDerivedDescription,
} from "./_jd-extract-helpers";
import type { JdFieldKey, JdFields, JdParseResponse } from "../data/jd-extraction";
import { JD_DAILY_PER_EMPLOYER, JD_MAX_TEXT_CHARS, JD_MIN_TEXT_CHARS } from "../data/jd-extraction";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const CACHE_TTL_SEC = 24 * 3600;
const COUNTER_TTL_SEC = 26 * 3600;
// Cloudflare's free tier (the fallback) covers roughly 35 parses a day, so the
// shared daily budget is deliberately modest. Past it, imports still work, pattern-only.
const GLOBAL_LLM_DAILY = Math.max(0, Number(process.env.JD_PARSE_GLOBAL_DAILY) || 60);

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

const dayKey = (): string => new Date().toISOString().slice(0, 10);

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

interface CachedParse { fields: JdFields; warnings: string[] }

function isCachedParse(v: unknown): v is CachedParse {
  if (v === null || typeof v !== "object") return false;
  const rec = v as Record<string, unknown>;
  return typeof rec.fields === "object" && rec.fields !== null && Array.isArray(rec.warnings);
}

export default async function handler(req: Request): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return json({ error: "Server misconfigured" }, 503, withRequestId(corsHeaders(req)));
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "employer-parse-jd",
    ipLimit: 20,
    userLimit: 6,
    maxBytes: 60_000,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;
  const userId = auth.userId;
  if (!userId) return json({ error: "Unauthorized" }, 401, headers);

  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "Invalid request" }, 400, headers); }
  const rawText = body !== null && typeof body === "object" ? (body as Record<string, unknown>).text : undefined;
  if (typeof rawText !== "string") return json({ error: "Paste or upload the job description text." }, 400, headers);

  const text = cleanJdText(rawText);
  if (text.length < JD_MIN_TEXT_CHARS) {
    return json({ error: "That is too short to read as a job description. Paste the full text or upload the file." }, 400, headers);
  }
  const truncated = rawText.trim().length > JD_MAX_TEXT_CHARS;

  try {
    const employerRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employers?id=eq.${encodeURIComponent(userId)}&select=id,suspended_at`,
      { headers: serviceHeaders() },
    );
    const rows = (await employerRes.json().catch(() => [])) as Array<{ id: string; suspended_at?: string | null }>;
    if (!employerRes.ok || !rows[0]) {
      return json({ error: "Add your company profile before importing a job description." }, 403, headers);
    }
    if (rows[0].suspended_at) {
      return json({ error: "Your account is suspended, so imports are unavailable." }, 403, headers);
    }
  } catch (err) {
    slog.error("employer-parse-jd employer lookup failed", { error: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200) });
    return json({ error: "Could not check your account. Try again." }, 503, headers);
  }

  const distinctId = distinctIdFrom(req, userId);
  const cacheKey = `jdparse:v1:${await hashStable(text)}`;

  // A repeat of the same JD costs nothing, so it does not spend the employer's daily allowance.
  const cachedRaw = await redisGet(cacheKey);
  if (cachedRaw) {
    try {
      const cached: unknown = JSON.parse(cachedRaw);
      if (isCachedParse(cached)) {
        void captureServerEvent("jd_import_parsed", distinctId, { cached: true, llm: true, fieldCount: Object.keys(cached.fields).length }, req);
        const res: JdParseResponse = { ok: true, fields: cached.fields, warnings: cached.warnings, llm: true, cached: true, remainingToday: null };
        return json(res, 200, headers);
      }
    } catch { /* corrupt cache entry: parse fresh */ }
  }

  const day = dayKey();
  const used = await redisIncrByWithExpiry(`jdparse:emp:${userId}:${day}`, 1, COUNTER_TTL_SEC);
  if (used !== null && used > JD_DAILY_PER_EMPLOYER) {
    void redisIncrByWithExpiry(`jdparse:emp:${userId}:${day}`, -1, COUNTER_TTL_SEC);
    void captureServerEvent("jd_import_blocked", distinctId, { reason: "employer_daily_cap" }, req);
    return json({ error: `You have used today's ${JD_DAILY_PER_EMPLOYER} job description imports. Try again tomorrow, or fill the form by hand.`, limitReached: true }, 429, headers);
  }
  const remainingToday = used === null ? null : Math.max(0, JD_DAILY_PER_EMPLOYER - used);

  const regex = extractJdWithRegex(text);
  let llmFields: JdFields = {};
  let dropped: JdFieldKey[] = [];
  let llmOk = false;
  let llmError = "";

  const globalUsed = await redisIncrByWithExpiry(`jdparse:global:${day}`, 1, COUNTER_TTL_SEC);
  const globalOk = globalUsed === null || globalUsed <= GLOBAL_LLM_DAILY;
  if (!globalOk) {
    void redisIncrByWithExpiry(`jdparse:global:${day}`, -1, COUNTER_TTL_SEC);
    llmError = "global_cap";
  } else {
    try {
      const result = await callLLM(
        { prompt: buildJdPrompt(text), temperature: 0, maxTokens: 1800, jsonMode: true },
        25000,
        { userId, endpoint: "employer-parse-jd", excludeGemini: true, totalBudgetMs: 45000, reserveMs: 12000 },
      );
      const parsed = extractJSON<Record<string, unknown>>(result.text);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        const sanitized = sanitizeLlmFields(parsed, text);
        llmFields = sanitized.fields;
        dropped = sanitized.dropped;
        llmOk = true;
      } else {
        llmError = "unparseable";
      }
    } catch (err) {
      llmError = err instanceof Error ? err.message.slice(0, 160) : "llm_failed";
      slog.warn("employer-parse-jd llm unavailable, serving pattern-only result", { error: llmError, userId });
    }
    if (!llmOk) void redisIncrByWithExpiry(`jdparse:global:${day}`, -1, COUNTER_TTL_SEC);
  }

  // A failed model call costs the employer nothing: refund their import.
  if (!llmOk && used !== null) void redisIncrByWithExpiry(`jdparse:emp:${userId}:${day}`, -1, COUNTER_TTL_SEC);

  try {
    const merged = withDerivedDescription(mergeJdFields(regex.fields, llmFields), text);
    const warnings = buildWarnings({ llm: llmOk, dropped, extra: regex.warnings, truncated });
    const res: JdParseResponse = {
      ok: true,
      fields: merged,
      warnings,
      llm: llmOk,
      cached: false,
      remainingToday: llmOk || used === null ? remainingToday : remainingToday === null ? null : remainingToday + 1,
    };
    if (llmOk) void redisSetEx(cacheKey, CACHE_TTL_SEC, JSON.stringify({ fields: merged, warnings }));
    void captureServerEvent("jd_import_parsed", distinctId, {
      cached: false, llm: llmOk, llmError, droppedCount: dropped.length, fieldCount: Object.keys(merged).length, chars: text.length,
    }, req);
    return json(res, 200, headers);
  } catch (err) {
    void captureServerException(err, distinctId, { endpoint: "employer-parse-jd" });
    return json({ error: "Could not read that job description. Try pasting the text instead." }, 500, headers);
  }
}
