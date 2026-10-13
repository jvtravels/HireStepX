/* Shared by the eval scripts that drive real server handlers in-process.
 * Handlers read Supabase / Upstash / PostHog config when their module loads,
 * so call this BEFORE the first dynamic import of a handler. With those
 * unset, verifyAuth accepts a localhost origin without a user, and the quota,
 * cache, lock and persistence paths all no-op, leaving only the LLM call. */

const HANDLER_ENV_TO_CLEAR = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "POSTHOG_API_KEY",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "RESEND_API_KEY",
  "SLACK_ALERT_WEBHOOK_URL",
  "QUOTA_FAIL_CLOSED",
];

export const EVAL_ORIGIN = "http://localhost:3000";

export function isolateHandlerEnv(): void {
  for (const key of HANDLER_ENV_TO_CLEAR) delete process.env[key];
  process.env.NODE_ENV = "development";
}

export function hasHandlerProviderKey(): boolean {
  return !!(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY);
}

export function describeMissingProviderKey(): string {
  const cloudflareOnly = !!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID);
  return cloudflareOnly
    ? "only Cloudflare credentials are set; the handlers require GROQ_API_KEY or GEMINI_API_KEY"
    : "no provider key set (GROQ_API_KEY / GEMINI_API_KEY)";
}
