/* Unified LLM caller — Gemini primary for big-model calls, Groq for fast (8b) calls */

import { captureServerEvent } from "./_posthog";
import { countTokens } from "./_tokenizer";
import { recordSlo } from "./_slo";
import { redisGet, redisIncrByWithExpiry, redisPipeline } from "./_shared";
import { isServerFlagEnabled } from "./_feature-flags";
import { loadProviderHealth, orderByHealth, recordProviderOutcome, setSharedCooldown } from "./_llm-health";
import { cloudflareDayKey, cloudflareDailyLimit, cloudflareNeuronsFor, cloudflareSpent, geminiDailyLimit, geminiDayKey, geminiSpent, groqAvailableCompletion, groqMinuteKey, groqMinuteWouldExceed, groqReservation, GROQ_TPM_CAP, LIMIT_KEY_TTL_SEC } from "./_llm-limits";
import { promptVersionFor } from "./_prompt-versions";
import { cloudflareModel, geminiLadder, geminiProviderName, isGeminiProviderName, geminiThinkingConfig, groqModel, isModelRetiredError, RETIRED_MODEL_COOLDOWN_MS } from "./_llm-models";

declare const process: { env: Record<string, string | undefined> };

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const CLOUDFLARE_ENABLED = !!CLOUDFLARE_API_TOKEN && /^[a-f0-9]{32}$/i.test(CLOUDFLARE_ACCOUNT_ID);
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const USAGE_LOGGING_ENABLED = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);

if (!USAGE_LOGGING_ENABLED) {
  // Fires once per cold start; surfaces misconfiguration without spamming per-call.
  console.warn(`[logUsage] disabled — missing env vars (SUPABASE_URL=${!!SUPABASE_URL}, SERVICE_KEY=${!!SUPABASE_SERVICE_KEY})`);
}

/**
 * Writes a usage row to `llm_usage`. Returns a Promise so callers can await
 * completion before returning a response.
 *
 * IMPORTANT — this must be awaited, not fire-and-forget. The analyze-resume
 * handler runs on Vercel's edge runtime, which terminates the isolate as soon
 * as `return Response` resolves. Unawaited fetches are killed mid-flight, so
 * fire-and-forget writes never reach Supabase. (This was why llm_usage stayed
 * empty despite LLM calls succeeding.)
 */
/** Map a model id OR a bare provider name to the provider label. Success rows
 *  carry the real model id ("openai/gpt-oss-120b", "gemini-3.5-flash-lite",
 *  "cloudflare-@cf/openai/gpt-oss-120b"); error rows carry the provider name directly. */
function providerFromModel(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("cloudflare") || m.includes("@cf/")) return "cloudflare";
  if (m.includes("gemini")) return "gemini";
  if (m.includes("groq") || m.includes("llama") || m.includes("gpt-oss")) return "groq";
  return m;
}

/**
 * Emit PostHog's native `$ai_generation` event so the LLM analytics dashboard
 * (per-model cost, latency, error rate, fallback share) is populated. Mirrors
 * the same data written to `llm_usage` but on PostHog's standard schema. Fires
 * regardless of whether Supabase usage-logging is configured. Awaited by
 * logUsage (which callers await) so the edge isolate stays alive until the
 * event ships — same fire-and-forget hazard documented on logUsage.
 */
async function emitAiGeneration(entry: {
  userId?: string; endpoint?: string; model: string; isFallback: boolean;
  promptTokens: number; completionTokens: number; totalTokens: number;
  latencyMs: number; status: "success" | "error" | "timeout"; errorMessage?: string;
  sessionId?: string; cachedTokens?: number; jsonValid?: boolean; schemaEnforced?: boolean;
}): Promise<void> {
  const distinctId = entry.userId || "anonymous";
  await captureServerEvent("$ai_generation", distinctId, {
    $ai_trace_id: entry.sessionId || distinctId,
    $ai_model: entry.model,
    $ai_provider: providerFromModel(entry.model),
    $ai_input_tokens: entry.promptTokens,
    $ai_output_tokens: entry.completionTokens,
    $ai_total_tokens: entry.totalTokens,
    $ai_cache_read_input_tokens: entry.cachedTokens ?? 0,
    $ai_latency: entry.latencyMs / 1000,
    $ai_is_error: entry.status !== "success",
    $ai_span_name: entry.endpoint || "unknown",
    is_fallback: entry.isFallback,
    prompt_version: promptVersionFor(entry.endpoint),
    json_valid: entry.jsonValid ?? null,
    schema_enforced: entry.schemaEnforced ?? false,
    status: entry.status,
    error_message: entry.errorMessage?.slice(0, 200) || null,
  });
}

async function logUsage(entry: {
  userId?: string; endpoint?: string; model: string; isFallback: boolean;
  promptTokens: number; completionTokens: number; totalTokens: number;
  latencyMs: number; status: "success" | "error" | "timeout"; errorMessage?: string;
  sessionId?: string; cachedTokens?: number; jsonValid?: boolean; schemaEnforced?: boolean;
}): Promise<void> {
  await emitAiGeneration(entry);
  if (!USAGE_LOGGING_ENABLED) return;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 5000);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/llm_usage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: "return=minimal",
      },
      signal: ac.signal,
      body: JSON.stringify({
        user_id: entry.userId || null,
        endpoint: entry.endpoint || "unknown",
        model: entry.model,
        is_fallback: entry.isFallback,
        prompt_tokens: entry.promptTokens,
        completion_tokens: entry.completionTokens,
        total_tokens: entry.totalTokens,
        latency_ms: entry.latencyMs,
        status: entry.status,
        error_message: entry.errorMessage?.slice(0, 500) || null,
        session_id: entry.sessionId || null,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[logUsage] HTTP ${res.status} writing llm_usage: ${body.slice(0, 200)}`);
    }
  } catch (err) {
    console.error(`[logUsage] fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/* LLM error classification (pure, exported for unit testing).
 *
 * A 429 normally means a per-second rate limit that recovers within ~1s, so a
 * single short-backoff retry before failover is worth it. But a 429 carrying
 * "exceeded your current quota" / "plan and billing" / "RESOURCE_EXHAUSTED" is
 * a hard daily-cap or billing block that will NOT recover in 800ms — retrying
 * it only adds latency before the inevitable failover. Observed live: Gemini
 * quota-exhausted 429s sat in the retry path on every static-fallback request.
 * Treat quota exhaustion as permanent so the chain fails over immediately. */
export function isQuotaExhausted(msg: string): boolean {
  return /current quota|plan and billing|billing details|resource_exhausted|quota.?exceeded|exceeded.*quota|\[daily quota\]|daily free allocation/i.test(msg);
}

/* A per-DAY request cap (Gemini free tier: 20 requests/day/model,
 * quotaId "...PerDay...") won't recover in 5 minutes; re-probing it on that
 * cadence just burns the few requests that reset would have given back. Bench
 * the model until the quota window rolls over (midnight Pacific ≈ 07:00-08:00
 * UTC; 08:00 is used so we never under-bench), capped at 12h. */
export function isDailyQuotaExhausted(msg: string): boolean {
  return isQuotaExhausted(msg) && /per.?day|daily|requests_per_day/i.test(msg);
}

export function msUntilDailyQuotaReset(now = Date.now()): number {
  const d = new Date(now);
  const reset = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 0, 0);
  const next = reset > now ? reset : reset + 86_400_000;
  return Math.min(next - now, 12 * 3_600_000);
}

/* Per-user daily token ceiling: an abuse/runaway backstop on top of the
   per-day call quota (which can't see that one call is 20x another). Only
   enhancement endpoints are gated; the core interview loop (generate,
   follow-up, evaluate-session) is never blocked mid-session. Fail-open when
   Redis is unavailable. */
const TOKEN_GATE_EXEMPT = ["generate", "follow-up", "evaluate-session"];
const DAILY_TOKEN_CAP = Number(process.env.LLM_DAILY_TOKEN_CAP) || 600_000;

export function isTokenGated(endpoint: string | undefined): boolean {
  if (!endpoint) return false;
  return !TOKEN_GATE_EXEMPT.some((p) => endpoint === p || endpoint.startsWith(`${p}-`));
}

function tokenKey(userId: string): string {
  return `llm_tok:${userId}:${new Date().toISOString().slice(0, 10)}`;
}

async function isOverTokenBudget(userId: string, endpoint: string | undefined): Promise<boolean> {
  if (!isTokenGated(endpoint)) return false;
  if (!(await isServerFlagEnabled("LLM_TOKEN_CAP"))) return false;
  const raw = await redisGet(tokenKey(userId)).catch(() => null);
  return raw != null && Number(raw) >= DAILY_TOKEN_CAP;
}

/* A quota-exhausted provider stays exhausted for minutes, but callers like
   evaluate-session chain 2-3 callLLM invocations back to back, each of which
   used to re-hit the dead provider first. Remember it per isolate so the
   follow-up calls skip straight to a provider that can answer. */
const QUOTA_COOLDOWN_MS = 5 * 60_000;
const quotaCooldownUntil = new Map<string, number>();

export function markProviderQuotaExhausted(name: string, now = Date.now(), durationMs = QUOTA_COOLDOWN_MS): void {
  quotaCooldownUntil.set(name, now + durationMs);
}

/* Circuit breaker for provider health failures (timeouts, 5xx, overload).
   Request-specific errors (413/400, budget skips) say nothing about provider
   health and are ignored. After BREAKER_THRESHOLD consecutive health failures
   the provider is skipped briefly so users don't each wait out its timeout. */
const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 30_000;
const consecutiveHealthFailures = new Map<string, number>();

export function recordProviderSuccess(name: string): void {
  consecutiveHealthFailures.delete(name);
}

export function recordProviderFailure(name: string, msg: string, isTimeout: boolean, now = Date.now()): void {
  const healthFailure = isTimeout || (isTransientLLMError(msg) && !isDeterministicLLMFailure(msg));
  if (!healthFailure) return;
  const n = (consecutiveHealthFailures.get(name) ?? 0) + 1;
  if (n >= BREAKER_THRESHOLD) {
    consecutiveHealthFailures.delete(name);
    markProviderQuotaExhausted(name, now, BREAKER_COOLDOWN_MS);
  } else {
    consecutiveHealthFailures.set(name, n);
  }
}

export function isProviderCoolingDown(name: string, now = Date.now()): boolean {
  const until = quotaCooldownUntil.get(name);
  if (until === undefined) return false;
  if (now >= until) { quotaCooldownUntil.delete(name); return false; }
  return true;
}

export function resetProviderCooldowns(): void {
  quotaCooldownUntil.clear();
  consecutiveHealthFailures.clear();
}

/** A provider failure that re-sending the same request cannot fix: hard
    quota, "request too large", or a rejected request (4xx other than 429),
    or a provider we deliberately skipped (prompt too big / budget spent). */
export function isDeterministicLLMFailure(msg: string): boolean {
  if (isQuotaExhausted(msg)) return true;
  if (/\b413\b/.test(msg)) return true;
  if (/\b(400|401|403|404|422)\b/.test(msg)) return true;
  return /skipped.{1,4}prompt/i.test(msg);
}

/** Thrown when every provider fails. Carries each provider's message so
    callers can tell "retry might work" from "same input will fail again". */
export class LLMChainError extends Error {
  providerErrors: string[];
  constructor(message: string, providerErrors: string[]) {
    super(message);
    this.name = "LLMChainError";
    this.providerErrors = providerErrors;
  }
}

/** True when retrying the same prompt through the same chain is pointless. */
export function isNonRetryableChainFailure(err: unknown): boolean {
  if (!(err instanceof LLMChainError) || err.providerErrors.length === 0) return false;
  return err.providerErrors.every(isDeterministicLLMFailure);
}

/** Transient = worth one short-backoff retry on the SAME provider before
 *  failover. Quota exhaustion is explicitly excluded (it's permanent). */
export function isTransientLLMError(msg: string): boolean {
  if (isQuotaExhausted(msg)) return false;
  return /\b(429|500|502|503|504)\b/.test(msg) || /overload|rate.?limit|temporar/i.test(msg);
}

interface LLMOptions {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  // Output budget for the FALLBACK providers (Gemini/Cloudflare) only. Groq is
  // primary and bounded by a tight free-tier TPM ceiling that counts
  // (prompt + max_tokens), so its budget must stay small. The fallbacks have
  // ~10× higher TPM, and at least one (the Gemini model) is materially more
  // verbose on the same JSON schema — at the Groq-sized cap it truncates large
  // reports (e.g. the HR-round report) mid-object, yielding an empty/degenerate
  // result. Give the fallbacks more room so a Groq outage still produces a
  // complete report. Defaults to maxTokens when unset.
  fallbackMaxTokens?: number;
  jsonMode?: boolean;
  // Provider-enforced output shape (Groq json_schema, Gemini responseJsonSchema).
  // Cloudflare has no JSON mode, so callers must still validate. A provider
  // that rejects the schema with a 400 is retried once without it.
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  fast?: boolean;
  // Groq-only: the smallest completion a caller considers usable, in tokens.
  // callGroq() skips the API call outright (no network round trip) when the
  // prompt alone leaves less than this much room under the free-tier TPM cap
  // — a request that small would almost certainly truncate mid-response
  // anyway, so failing over immediately beats waiting out a doomed call.
  // Defaults to a small generic floor (GROQ_DEFAULT_MIN_COMPLETION_TOKENS)
  // that only guards against degenerate near-zero budgets; set this higher
  // when a caller knows its real completions run larger (e.g. a multi-field
  // JSON report needs ~1000+ tokens and a 300-token budget is never enough).
  groqMinCompletionTokens?: number;
}

interface LLMResult {
  text: string;
  model: string;
  fallback: boolean;
  tokensUsed?: { prompt: number; completion: number; total: number; cached?: number; neurons?: number };
  latencyMs?: number;
}

// Confirmed directly from the Groq console's Organization Limits table
// (2026-10-03, matches a 413 body's "Limit 8000"): openai/gpt-oss-20b AND
// -120b share a flat 8,000 tokens/minute free-tier cap, counting
// (prompt + max_tokens) against it regardless of actual output length. A
// fixed max_tokens guarantees a 413 once the prompt alone grows past
// ~(cap - margin - max_tokens); sizing max_tokens off the ACTUAL prompt size
// keeps every call under the cap, and skipping outright when even the floor
// doesn't fit saves a doomed round trip instead of waiting out its 413.
const GROQ_DEFAULT_MIN_COMPLETION_TOKENS = 256;

// A provider declined before any network call (prompt can never fit). Not a
// provider failure, so it is neither logged to llm_usage nor counted against
// the provider's health.
class LLMPreflightSkip extends Error {}

async function callGroq(opts: LLMOptions, signal?: AbortSignal): Promise<LLMResult> {
  // Groq shut down llama-3.1-8b-instant (Aug 16, 2026) and
  // llama-3.3-70b-specdec (Apr 14, 2025). Use their supported successors.
  const model = groqModel(!!opts.fast);
  const requestedMaxTokens = opts.maxTokens ?? 2000;
  const promptTokens = countTokens(opts.prompt);
  const minCompletionTokens = opts.groqMinCompletionTokens ?? GROQ_DEFAULT_MIN_COMPLETION_TOKENS;
  const reservation = groqReservation(promptTokens, requestedMaxTokens, minCompletionTokens);
  if (!reservation) {
    throw new LLMPreflightSkip(
      `Groq skipped — prompt (~${promptTokens} tokens) leaves ~${Math.max(0, groqAvailableCompletion(promptTokens))} tokens under the ${GROQ_TPM_CAP} TPM free-tier cap, below the ${minCompletionTokens}-token floor for a usable response`,
    );
  }
  const maxTokens = reservation.maxTokens;
  await redisIncrByWithExpiry(groqMinuteKey(model), reservation.reserved, LIMIT_KEY_TTL_SEC.groq);
  const start = Date.now();
  const post = (withSchema: boolean) => fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
    signal,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: opts.prompt }],
      temperature: opts.temperature ?? 0.3,
      max_tokens: maxTokens,
      // GPT-OSS is a reasoning model — unlike the retired llama-3.1-8b-instant,
      // it spends part of max_tokens on an internal reasoning pass before the
      // final answer. Our per-call budgets (500-2500 tokens) were sized for
      // the old non-reasoning model and left no room for that overhead, so
      // reasoning-heavy calls got cut off mid-JSON and Groq rejected them with
      // "Failed to validate JSON" (400). Capping reasoning effort to "low"
      // keeps the overhead small enough to fit the existing budgets.
      reasoning_effort: "low",
      ...(opts.jsonMode ? { response_format: withSchema && opts.jsonSchema
        ? { type: "json_schema", json_schema: { name: opts.jsonSchema.name, strict: false, schema: opts.jsonSchema.schema } }
        : { type: "json_object" } } : {}),
    }),
  });
  let res = await post(true);
  if (res.status === 400 && opts.jsonMode && opts.jsonSchema) {
    console.warn(`[LLM] Groq ${model} rejected the response schema (400) — retrying with json_object`);
    res = await post(false);
  }
  const latencyMs = Date.now() - start;
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[LLM] Groq ${model} — HTTP ${res.status} after ${latencyMs}ms: ${errText.slice(0, 100)}`);
    throw new Error(`Groq error ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const usage = data.usage;
  const tokensUsed = usage ? { prompt: usage.prompt_tokens, completion: usage.completion_tokens, total: usage.total_tokens, cached: usage.prompt_tokens_details?.cached_tokens } : undefined;
  if (typeof usage?.total_tokens === "number") {
    await redisIncrByWithExpiry(groqMinuteKey(model), usage.total_tokens - reservation.reserved, LIMIT_KEY_TTL_SEC.groq);
  }
  return { text: data.choices?.[0]?.message?.content || "", model, fallback: false, tokensUsed, latencyMs };
}

// Second Gemini model used as a failover when the primary is overloaded. It has
// its own quota bucket and (unlike Gemini 3) disables thinking via thinkingBudget.
async function callGemini(opts: LLMOptions, signal: AbortSignal | undefined, model: string): Promise<LLMResult> {
  if (!GEMINI_API_KEY) throw new Error("Gemini not configured");
  // gemini-2.5-flash is Google's limited-access/legacy tier as of Oct 2026
  // (retiring 2026-10-16) — Google was already throttling it with 429s
  // ahead of the hard cutoff. Google's own migration guidance for 2.5 Flash
  // is 3.5 Flash-Lite or 3.8 Flash; 3.5-flash-lite is the same per-token
  // price as the retiring model, so it's a straight swap, not a cost change.
  //
  // NOT a straight swap for `thinkingConfig`, though (production 400s,
  // 2026-10-04): 2.5-flash could disable thinking outright via
  // `thinkingBudget: 0`. The Gemini 3 family (3.5-flash-lite included)
  // can't — it's thinking-only — and rejects `thinkingBudget` on every
  // call with a generic 400 INVALID_ARGUMENT that carries no
  // field-level detail. `thinkingLevel: "minimal"` is Gemini 3's
  // equivalent of "as close to zero thinking as this model allows";
  // `thinkingLevel` and `thinkingBudget` are also mutually exclusive —
  // sending both is itself a 400, so don't add thinkingBudget back
  // "for safety".
  const start = Date.now();
  const post = (withSchema: boolean) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: opts.prompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.3,
        maxOutputTokens: opts.fallbackMaxTokens ?? opts.maxTokens ?? 2000,
        ...(opts.jsonMode ? { responseMimeType: "application/json" } : {}),
        ...(opts.jsonMode && withSchema && opts.jsonSchema ? { responseJsonSchema: opts.jsonSchema.schema } : {}),
        thinkingConfig: geminiThinkingConfig(model),
      },
    }),
  });
  let res = await post(true);
  if (res.status === 400 && opts.jsonMode && opts.jsonSchema) {
    console.warn(`[LLM] Gemini ${model} rejected the response schema (400) — retrying with plain JSON mode`);
    res = await post(false);
  }
  const latencyMs = Date.now() - start;
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[LLM] Gemini ${model} — HTTP ${res.status} after ${latencyMs}ms: ${errText.slice(0, 100)}`);
    // The per-day quotaId sits past the 200-char slice, so tag it up front.
    const dailyTag = res.status === 429 && /PerDay/i.test(errText) ? " [daily quota]" : "";
    throw new Error(`Gemini error ${res.status}${dailyTag}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const usage = data.usageMetadata;
  const tokensUsed = usage ? { prompt: usage.promptTokenCount, completion: usage.candidatesTokenCount, total: usage.totalTokenCount, cached: usage.cachedContentTokenCount } : undefined;
  return { text: data.candidates?.[0]?.content?.parts?.[0]?.text || "", model, fallback: false, tokensUsed, latencyMs };
}

async function callCloudflare(opts: LLMOptions, signal?: AbortSignal): Promise<LLMResult> {
  // Overflow rung so a Groq+Gemini outage doesn't kill the interview. Its 128K
  // context takes the full-size report prompt that Groq's 8K TPM cap rejects.
  // response_format is deliberately omitted: Workers AI doesn't document JSON
  // mode for gpt-oss, and callers already extract JSON from free text.
  // reasoning_effort "low" is accepted and cut tokens/latency ~25% in live tests
  // (hidden reasoning counts toward completion_tokens and neurons).
  const model = cloudflareModel();
  const start = Date.now();
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}` },
    signal,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: opts.prompt }],
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.fallbackMaxTokens ?? opts.maxTokens ?? 2000,
      reasoning_effort: "low",
    }),
  });
  const latencyMs = Date.now() - start;
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[LLM] Cloudflare ${model} — HTTP ${res.status} after ${latencyMs}ms: ${errText.slice(0, 100)}`);
    throw new Error(`Cloudflare error ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const body = data.choices ? data : data.result;
  const usage = body?.usage;
  const neurons = cloudflareNeuronsFor(usage);
  await redisIncrByWithExpiry(cloudflareDayKey(), neurons, LIMIT_KEY_TTL_SEC.cloudflare);
  const tokensUsed = usage ? { prompt: usage.prompt_tokens, completion: usage.completion_tokens, total: usage.total_tokens, neurons } : undefined;
  return { text: body?.choices?.[0]?.message?.content || "", model: `cloudflare-${model}`, fallback: false, tokensUsed, latencyMs };
}

/* Providers whose known free-tier budget is already spent (or would be blown
   by this very request), read in one Redis round trip. Skipping them up front
   saves the failed call; the chain is never emptied by this (see benched). */
async function loadSpentProviders(
  providers: ReadonlyArray<{ name: string; model?: string }>,
  ladder: string[],
  opts: LLMOptions,
): Promise<Set<string>> {
  const spent = new Set<string>();
  const commands: Array<Array<string | number>> = [];
  const verdicts: Array<(used: number) => void> = [];
  const cloudflareLimit = cloudflareDailyLimit();
  for (const p of providers) {
    if (p.model && isGeminiProviderName(p.name, ladder)) {
      const geminiLimit = geminiDailyLimit(p.model);
      if (geminiLimit <= 0) continue;
      commands.push(["GET", geminiDayKey(p.model)]);
      verdicts.push((used) => { if (geminiSpent(used, geminiLimit)) spent.add(p.name); });
    } else if (p.name === "groq" && p.model) {
      const reservation = groqReservation(countTokens(opts.prompt), opts.maxTokens ?? 2000, opts.groqMinCompletionTokens ?? GROQ_DEFAULT_MIN_COMPLETION_TOKENS);
      if (!reservation) continue;
      commands.push(["GET", groqMinuteKey(p.model)]);
      verdicts.push((used) => { if (groqMinuteWouldExceed(used, reservation.reserved)) spent.add(p.name); });
    } else if (p.name === "cloudflare") {
      if (cloudflareLimit <= 0) continue;
      commands.push(["GET", cloudflareDayKey()]);
      verdicts.push((used) => { if (cloudflareSpent(used, cloudflareLimit)) spent.add(p.name); });
    }
  }
  if (commands.length === 0) return spent;
  const results = await redisPipeline(commands, 300);
  if (!results) return spent;
  results.forEach((raw, i) => verdicts[i](Number(raw) || 0));
  return spent;
}

export async function callLLM(opts: LLMOptions, timeoutMs = 15000, meta?: { userId?: string; endpoint?: string; groqTimeoutMs?: number; sessionId?: string; totalBudgetMs?: number; hedgeAfterMs?: number; excludeGemini?: boolean }): Promise<LLMResult> {
  type ProviderEntry = { name: string; model?: string; call: (s: AbortSignal) => Promise<LLMResult> };
  const providers: ProviderEntry[] = [];
  const ladder = geminiLadder();
  const geminiEntries = (): ProviderEntry[] =>
    GEMINI_API_KEY ? ladder.map((model, i) => ({ name: geminiProviderName(i, model), model, call: (s) => callGemini(opts, s, model) })) : [];
  // Fast calls use Groq GPT-OSS 20B, the recommended replacement for
  // llama-3.1-8b-instant. Slow calls use Gemini first; Groq GPT-OSS 120B is
  // the large-model fallback after llama-3.3-70b-specdec was retired.
  // Slow/big-model calls try the Gemini ladder first. Free-tier Gemini is only
  // 20 requests/day PER MODEL, so each rung is an independent bucket and a rung
  // that reports its daily cap is benched until reset (see isDailyQuotaExhausted).
  // Groq (8K TPM) can only carry small prompts; Cloudflare Workers AI is the overflow.
  if (opts.fast) {
    if (GROQ_API_KEY) providers.push({ name: "groq", model: groqModel(!!opts.fast), call: (s) => callGroq(opts, s) });
    providers.push(...geminiEntries());
  } else {
    providers.push(...geminiEntries());
    if (GROQ_API_KEY) providers.push({ name: "groq", model: groqModel(!!opts.fast), call: (s) => callGroq(opts, s) });
  }
  if (CLOUDFLARE_ENABLED) providers.push({ name: "cloudflare", model: cloudflareModel(), call: (s) => callCloudflare(opts, s) });

  // A last-resort tier that exists to reach a DIFFERENT provider must not
  // re-hit the Gemini rungs the previous tier just failed on.
  if (meta?.excludeGemini) {
    for (let i = providers.length - 1; i >= 0; i--) if (isGeminiProviderName(providers[i].name, ladder)) providers.splice(i, 1);
  }

  if (providers.length === 0) throw new Error("No LLM configured — set GROQ_API_KEY, GEMINI_API_KEY, or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID");

  // Drop providers in quota cooldown, but never empty the chain: if every
  // provider is cooling down, try them all rather than fail without a call.
  // Health is shared across instances via Redis: a provider another instance
  // already found cooling down is skipped, and one with a high recent failure
  // rate goes to the back of the chain rather than costing this user a timeout.
  // Retirement is keyed by model id (not chain name) so repointing
  // GEMINI_MODELS / GROQ_MODEL at a replacement takes effect immediately
  // instead of inheriting a 24h bench from the old id.
  const retiredKey = (p: ProviderEntry) => (p.model ? `retired:${p.model}` : "");
  const health = await loadProviderHealth(providers.flatMap((p) => (p.model ? [p.name, retiredKey(p)] : [p.name])));
  const spentProviders = await loadSpentProviders(providers, ladder, opts);
  const benched = (p: ProviderEntry) => {
    const rk = retiredKey(p);
    return spentProviders.has(p.name) || isProviderCoolingDown(p.name) || !!health.get(p.name)?.cooling || (!!rk && (isProviderCoolingDown(rk) || !!health.get(rk)?.cooling));
  };
  const available = providers.filter((p) => !benched(p));
  if (available.length > 0 && available.length < providers.length) {
    providers.splice(0, providers.length, ...available);
  }
  const ordered = orderByHealth(providers, health);
  const reordered = ordered.some((p, i) => p !== providers[i]);
  const degradedNames = providers.filter((p) => health.get(p.name)?.degraded).map((p) => p.name);
  providers.splice(0, providers.length, ...ordered);

  // Per-provider timeout: cap Groq at 10s so a real incident fails over
  // fast, but don't kneecap normal large-output calls (a 1400-token JSON
  // response on llama-3.3-70b regularly takes 6-9s — the previous 6s cap
  // was sized for short responses and killed legitimate calls, sending
  // them to Gemini where Google-side "high demand" 503s would surface to
  // the user). Fast 20B calls normally finish well under 10s.
  // Per-call Groq cap override — evaluate-session's full-transcript
  // prompts regularly take 6-9s; the global 10s cap kicks Groq out under
  // p95 spike and the user pays the Gemini fallback latency. Callers can
  // raise via meta.groqTimeoutMs (still bounded by timeoutMs).
  const groqCap = Math.min(timeoutMs, meta?.groqTimeoutMs ?? 10000);

  // Overall wall-clock ceiling across the WHOLE provider chain, including
  // retries and failover — opt-in via meta.totalBudgetMs. Without it,
  // remainingBudget() is always Infinity and every caller's existing
  // per-provider-timeout behavior is unchanged.
  //
  // Why this exists: timeoutMs/groqCap were being read as "the worst case
  // is timeoutMs × providers", but a provider can also retry once on a
  // transient (non-timeout) error before failing over, so the REAL worst
  // case is closer to (timeoutMs + 800ms retry backoff) × providers. For
  // analyze-resume specifically that chain is 3 deep (gemini → groq →
  // cloudflare) and blew past both the client's fetch timeout and the Vercel
  // edge function's own execution ceiling — the isolate got killed before
  // the handler's own catch block could return a graceful "timed out"
  // response. totalBudgetMs lets a caller cap the chain's real wall-clock
  // time regardless of how many providers or retries fire.
  if (meta?.userId && await isOverTokenBudget(meta.userId, meta.endpoint)) {
    throw new LLMChainError("Daily AI token budget reached for this account", ["Daily token budget reached 400"]);
  }

  const startedAt = Date.now();
  const remainingBudget = () => meta?.totalBudgetMs != null
    ? Math.max(0, meta.totalBudgetMs - (Date.now() - startedAt))
    : Infinity;

  const providerTimeout = (name: string) => {
    const base = name === "groq" ? groqCap : timeoutMs;
    return Math.min(base, remainingBudget());
  };

  // Retry classification lives in module-scope isTransientLLMError (above):
  // transient → one short-backoff retry on the same provider; quota exhaustion
  // and other hard errors → fail over to the next provider immediately.
  const isTransient = isTransientLLMError;

  const callOnce = async (provider: ProviderEntry): Promise<LLMResult> => {
    const budget = providerTimeout(provider.name);
    if (budget <= 0) throw new Error(`${provider.name} skipped — total LLM budget exhausted`);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), budget);
    try {
      const result = await provider.call(ac.signal);
      clearTimeout(timer);
      return result;
    } finally {
      clearTimeout(timer);
    }
  };

  const tryProvider = async (provider: ProviderEntry, isFallback: boolean): Promise<LLMResult> => {
    let attempt = 0;
    // up to 2 attempts per provider (1 initial + 1 retry on transient),
    // but never retry into a budget too small to be worth it.
    while (true) {
      attempt++;
      if (remainingBudget() <= 0) throw new Error(`${provider.name} skipped — total LLM budget exhausted`);
      try {
        const result = await callOnce(provider);
        recordProviderSuccess(provider.name);
        if (meta?.userId && result.tokensUsed?.total) {
          await redisIncrByWithExpiry(tokenKey(meta.userId), result.tokensUsed.total, 90_000);
        }
        const jsonValid = opts.jsonMode ? extractJSON(result.text) !== null : undefined;
        if (jsonValid === false) console.warn(`[LLM] ${provider.name} returned unparseable JSON for ${meta?.endpoint ?? "unknown"} (${result.text.length} chars)`);
        await Promise.all([
          logUsage({ userId: meta?.userId, endpoint: meta?.endpoint, model: result.model, isFallback, promptTokens: result.tokensUsed?.prompt ?? 0, completionTokens: result.tokensUsed?.completion ?? 0, totalTokens: result.tokensUsed?.total ?? 0, latencyMs: result.latencyMs ?? 0, status: "success", sessionId: meta?.sessionId, cachedTokens: result.tokensUsed?.cached, jsonValid, schemaEnforced: !!opts.jsonSchema }),
          recordProviderOutcome(provider.name, true),
          provider.model && isGeminiProviderName(provider.name, ladder)
            ? redisIncrByWithExpiry(geminiDayKey(provider.model), 1, LIMIT_KEY_TTL_SEC.gemini)
            : Promise.resolve(null),
        ]);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        const errName = err instanceof Error ? err.name : "";
        const isTimeout = errName === "AbortError" || msg.includes("aborted") || msg.includes("abort");
        const transient = isTransient(msg);
        if (err instanceof LLMPreflightSkip) throw err;
        // A 503 "high demand" on one rung rarely clears in 800ms; when another
        // provider is queued, move on instead of re-hitting the same model.
        const overloaded = /\b503\b|high demand|overload/i.test(msg);
        const hasNext = providers.indexOf(provider) < providers.length - 1;
        if (attempt < 2 && transient && !isTimeout && !(overloaded && hasNext) && remainingBudget() > 800) {
          console.warn(`[LLM] ${provider.name} transient error (${msg.slice(0, 80)}) — retrying after 800ms`);
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        let sharedHealthWrite: Promise<void> = Promise.resolve();
        if (isModelRetiredError(msg)) {
          const rk = provider.model ? `retired:${provider.model}` : provider.name;
          markProviderQuotaExhausted(rk, Date.now(), RETIRED_MODEL_COOLDOWN_MS);
          sharedHealthWrite = setSharedCooldown(rk, RETIRED_MODEL_COOLDOWN_MS);
          console.error(`[LLM] MODEL RETIRED? ${provider.name} returned a not-found/deprecated error — benched for 24h. Update GEMINI_MODELS / GROQ_MODEL: ${msg.slice(0, 150)}`);
        } else if (isQuotaExhausted(msg)) {
          const cooldownMs = isDailyQuotaExhausted(msg) ? msUntilDailyQuotaReset() : QUOTA_COOLDOWN_MS;
          markProviderQuotaExhausted(provider.name, Date.now(), cooldownMs);
          sharedHealthWrite = setSharedCooldown(provider.name, cooldownMs);
        } else {
          recordProviderFailure(provider.name, msg, isTimeout);
          if (isTimeout || (transient && !isDeterministicLLMFailure(msg))) sharedHealthWrite = recordProviderOutcome(provider.name, false);
        }
        console.error(`[LLM] ${provider.name} failed (${isTimeout ? "timeout" : "error"}): ${msg.slice(0, 150)}`);
        await sharedHealthWrite;
        await logUsage({ userId: meta?.userId, endpoint: meta?.endpoint, model: provider.name, isFallback, promptTokens: 0, completionTokens: 0, totalTokens: 0, latencyMs: 0, status: isTimeout ? "timeout" : "error", errorMessage: msg.slice(0, 200), sessionId: meta?.sessionId });
        throw err;
      }
    }
  };

  // Walk providers in order (fast: groq→gemini→gemini-2.5, slow: gemini→gemini-2.5→groq→cloudflare). First success wins.
  console.warn(`[LLM] Provider chain: ${providers.map(p => p.name).join(" → ")}${reordered ? ` (reordered, degraded: ${degradedNames.join(",")})` : ""} (timeout: ${timeoutMs}ms${meta?.totalBudgetMs != null ? `, totalBudget: ${meta.totalBudgetMs}ms` : ""})`);
  let lastErr: unknown;
  const providerErrors: string[] = [];

  // A hung Gemini otherwise costs the whole per-provider timeout before the
  // next model even starts, leaving the rungs behind it with no budget. A
  // staggered race starts the next rung whenever the in-flight ones have been
  // silent for hedgeAfterMs OR one of them fails, keeps earlier rungs running,
  // and takes whichever succeeds first; the slower requests are ignored.
  const raceHedged = (group: ProviderEntry[], hedgeAfterMs: number) =>
    new Promise<{ result: LLMResult; winner: number }>((resolve, reject) => {
      let settled = false;
      let started = 0;
      let failures = 0;
      let lastError: unknown;
      let hedgeTimer: ReturnType<typeof setTimeout> | undefined;
      const startNext = () => {
        if (settled || started >= group.length) return;
        const index = started++;
        if (index > 0) console.warn(`[LLM] ${group[index - 1].name} slow or failed — hedging with ${group[index].name}`);
        if (started < group.length) {
          clearTimeout(hedgeTimer);
          hedgeTimer = setTimeout(startNext, hedgeAfterMs);
        }
        tryProvider(group[index], index > 0).then(
          (result) => { if (!settled) { settled = true; clearTimeout(hedgeTimer); resolve({ result, winner: index }); } },
          (err) => {
            lastError = err;
            providerErrors.push(err instanceof Error ? err.message : String(err));
            if (++failures === group.length && !settled) { settled = true; clearTimeout(hedgeTimer); reject(lastError); return; }
            startNext();
          },
        );
      };
      startNext();
    });

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    if (remainingBudget() <= 0) {
      lastErr = new Error("total LLM budget exhausted before all providers were tried");
      break;
    }
    let group: ProviderEntry[] = [];
    if (meta?.hedgeAfterMs != null && isGeminiProviderName(provider.name, ladder)) {
      for (let j = i; j < providers.length && isGeminiProviderName(providers[j].name, ladder); j++) group.push(providers[j]);
      if (group.length < 2) group = [];
    }
    const hedged = group.length > 0;
    try {
      if (hedged) {
        const { result, winner } = await raceHedged(group, meta!.hedgeAfterMs!);
        await Promise.all([recordSlo("llm_availability", true), recordSlo("llm_primary", winner === 0 && i === 0)]);
        return result;
      }
      const result = await tryProvider(provider, i > 0);
      await Promise.all([recordSlo("llm_availability", true), recordSlo("llm_primary", i === 0)]);
      return result;
    } catch (err) {
      lastErr = err;
      if (!hedged) providerErrors.push(err instanceof Error ? err.message : String(err));
      else i += group.length - 1;
      const following = providers[i + 1];
      if (following) console.warn(`[LLM] ${hedged ? group.map((p) => p.name).join("+") : provider.name} failed, falling back to ${following.name}`);
    }
  }
  await Promise.all([recordSlo("llm_availability", false), recordSlo("llm_primary", false)]);
  throw new LLMChainError(
    lastErr instanceof Error ? lastErr.message : "All LLM providers failed",
    providerErrors,
  );
}

export function extractJSON<T = unknown>(text: string): T | null {
  try { return JSON.parse(text); } catch { /* fallback */ }
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fallback */ }
  // Bracket-balanced scan for the first complete JSON value (array or object).
  const scan = (open: string, close: string): T | null => {
    const start = cleaned.indexOf(open);
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(cleaned.slice(start, i + 1)); } catch { return null; }
        }
      }
    }
    return null;
  };
  const objStart = cleaned.indexOf("{");
  const arrStart = cleaned.indexOf("[");
  // Prefer whichever appears first — matches the model's intended top-level shape.
  if (objStart !== -1 && (arrStart === -1 || objStart < arrStart)) {
    const obj = scan("{", "}");
    if (obj !== null) return obj;
    return scan("[", "]");
  }
  if (arrStart !== -1) {
    const arr = scan("[", "]");
    if (arr !== null) return arr;
    return scan("{", "}");
  }
  return null;
}
