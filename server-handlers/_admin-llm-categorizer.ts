/* Pure helper extracted from admin-data.ts so the regex-driven LLM-error
 * classification can be unit-tested. Categorization drives the admin
 * dashboard's "Error Breakdown" card — wrong buckets = wrong root-cause
 * call when the on-call engineer is triaging a degraded session. */

export type LlmErrorBucket =
  | "rateLimit"
  | "contextLength"
  | "timeout"
  | "serverError"
  | "auth"
  | "safety"
  | "other";

/**
 * Classify a single llm_usage row's error into a bucket. Order matters:
 * timeouts win over rate-limit (a 429 with a timeout message is still a
 * timeout from the user's perspective); context-length wins over server
 * error; etc.
 */
export function categorizeLlmError(status: string | null | undefined, errorMessage: string | null | undefined): LlmErrorBucket {
  const msg = (errorMessage || "").toLowerCase();
  if (status === "timeout" || /timeout|timed out|aborted|etimedout/.test(msg)) return "timeout";
  if (/\b429\b|rate.?limit|too many requests|tpm|rpm|tokens per minute|requests per minute|quota/.test(msg)) return "rateLimit";
  if (/context.?length|too long|max(imum)?.{0,10}token|exceed.{0,10}context|prompt is too|tokens? in (the|your) (request|messages)/.test(msg)) return "contextLength";
  if (/\b50[0234]\b|server error|service unavailable|gateway|overload|temporarily/.test(msg)) return "serverError";
  if (/\b40[13]\b|unauthor|invalid api key|forbidden|permission/.test(msg)) return "auth";
  if (/safety|blocked|harm|content policy|recitation/.test(msg)) return "safety";
  return "other";
}

export interface LlmErrorBreakdown {
  rateLimit: number;
  contextLength: number;
  timeout: number;
  serverError: number;
  auth: number;
  safety: number;
  other: number;
}

export function emptyBreakdown(): LlmErrorBreakdown {
  return { rateLimit: 0, contextLength: 0, timeout: 0, serverError: 0, auth: 0, safety: 0, other: 0 };
}
