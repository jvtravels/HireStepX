/* LLM model registry.
 *
 * Model ids used to be string literals scattered through _llm.ts, so a vendor
 * retirement meant a code change, a test run and a deploy while users hit 404s.
 * The ladders below are the single source of truth and can be re-pointed with
 * an env var (no deploy-time code change) the moment a model is announced
 * for retirement. The daily model-watchdog cron verifies every entry still
 * exists and answers, so a retirement is caught weeks before the cutoff.
 *
 * Only models Google/Groq list as stable with no announced shutdown belong in
 * the defaults (checked Oct 2026). Deliberately absent: gemini-3.1-flash-lite
 * (shuts down 2027-05-07) and gemini-3.5-flash (deprecated). */

declare const process: { env: Record<string, string | undefined> };

// Each Gemini model has its own free-tier quota bucket and its own capacity
// pool, so a third rung is real headroom: on 2026-10-13 3.5-flash-lite hung,
// 2.5-flash-lite was out of daily quota, and 2.5-flash still answered in ~2s.
export const DEFAULT_GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-2.5-flash-lite", "gemini-2.5-flash"] as const;
export const DEFAULT_GROQ_FAST_MODEL = "openai/gpt-oss-20b";
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
// Cloudflare Workers AI is the overflow rung: 128K context takes the ~10K-token
// session-report prompt Groq's 8K TPM cap can never take, and gpt-oss-120b is
// the same model family we already run on Groq. Free tier is 10,000 neurons/day.
export const DEFAULT_CLOUDFLARE_MODEL = "@cf/openai/gpt-oss-120b";

const MAX_GEMINI_MODELS = 3;
const MODEL_ID = /^[a-z0-9][a-z0-9._-]{2,63}$/i;

/** Ordered Gemini ladder: GEMINI_MODELS="a,b,c" overrides the defaults. Invalid
 *  ids are dropped; an override that leaves nothing valid falls back to the defaults. */
export function geminiLadder(raw: string | undefined = process.env.GEMINI_MODELS): string[] {
  const parsed = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s, i, all) => MODEL_ID.test(s) && all.indexOf(s) === i)
    .slice(0, MAX_GEMINI_MODELS);
  return parsed.length > 0 ? parsed : [...DEFAULT_GEMINI_MODELS];
}

/** Chain name for the Nth Gemini model. The first keeps the legacy name
 *  "gemini" so health keys, SLO data and llm_usage history stay continuous. */
export const geminiProviderName = (index: number, model: string): string => (index === 0 ? "gemini" : model);

export function isGeminiProviderName(name: string | undefined, ladder: string[] = geminiLadder()): boolean {
  return name === "gemini" || (name !== undefined && ladder.includes(name));
}

export const groqModel = (fast: boolean): string =>
  (fast ? process.env.GROQ_FAST_MODEL : process.env.GROQ_MODEL)?.trim() || (fast ? DEFAULT_GROQ_FAST_MODEL : DEFAULT_GROQ_MODEL);

const CF_MODEL_ID = /^@cf\/[a-z0-9._-]+\/[a-z0-9._-]+$/i;

export const cloudflareModel = (raw: string | undefined = process.env.CLOUDFLARE_AI_MODEL): string => {
  const id = raw?.trim() ?? "";
  return CF_MODEL_ID.test(id) ? id : DEFAULT_CLOUDFLARE_MODEL;
};

/** Gemini 3.x is thinking-only and rejects thinkingBudget (400); 2.x takes a
 *  budget of 0 and rejects thinkingLevel. thinkingLevel and thinkingBudget are
 *  mutually exclusive. Unknown future families (4.x, ...) follow the 3.x rule,
 *  which is where Google is heading. */
export function geminiThinkingConfig(model: string): { thinkingLevel: "minimal" } | { thinkingBudget: 0 } {
  return /^gemini-[12]\./.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: "minimal" };
}

/** A 404 (or an explicit retirement message) on a model endpoint means the
 *  model id no longer exists — not that the request was bad. */
export function isModelRetiredError(msg: string): boolean {
  return (
    /\b404\b/.test(msg) &&
    /not found|not supported|no longer|deprecat|retire|shut ?down|does not exist/i.test(msg)
  ) || /no longer available|has been (retired|deprecated|shut down)|model.{0,40}(deprecated|decommission)/i.test(msg);
}

export const RETIRED_MODEL_COOLDOWN_MS = 24 * 60 * 60_000;
