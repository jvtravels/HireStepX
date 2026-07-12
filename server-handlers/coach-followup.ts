/* Vercel Edge Function — Dialogic feedback (PRI-37).
 *
 * "Ask about / argue with your verdict." The candidate reads their mock-
 * interview report and asks the coach a follow-up — "why did I score low
 * on structure?", "I disagree, I did give a metric". This handler is a
 * THIN shell: every piece of judgement lives in the unit-tested pure core
 * (_coach-followup-helpers.ts). Here we only do request handling —
 * auth/rate-limit preamble, the feature-flag gate, body coercion, the LLM
 * call, and response shaping.
 *
 * Grounding note: the report context is supplied by the client (which
 * already holds the rendered report) rather than re-fetched from the DB.
 * That's safe for v1 — the candidate can only mislead themselves about
 * their OWN session, nothing is persisted, and no score is mutated. The
 * pure core constrains the LLM to "answer ONLY from these facts", so the
 * worst case is a self-inflicted unhelpful answer. If we later want the
 * dialogue to be authoritative we move the fetch server-side; the helper
 * API doesn't change.
 *
 * Dark-launched behind COACH_FOLLOWUP_ENABLED=1 (fail-safe OFF). */

export const config = { runtime: "edge" };

import {
  withAuthAndRateLimit,
  corsHeaders,
  withRequestId,
  validateContentType,
  sanitizeForLLM,
} from "./_shared";
import { callLLM } from "./_llm";
import {
  validateFollowupRequest,
  buildCoachPrompt,
  fallbackAnswer,
  type FollowupQuestionContext,
} from "./_coach-followup-helpers";

declare const process: { env: Record<string, string | undefined> };

const FEATURE_ENABLED = process.env.COACH_FOLLOWUP_ENABLED === "1";

/* Coerce the client-supplied report context defensively — every field
   optional, arrays clamped, strings bounded. Never trust shape. */
function coerceReportContext(raw: unknown): FollowupQuestionContext {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const strArr = (v: unknown, cap: number): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string").slice(0, cap).map((x) => x.slice(0, 280))
      : [];
  const ws = r.weakestSkill;
  const weakestSkill =
    typeof ws === "object" && ws !== null && typeof (ws as Record<string, unknown>).name === "string"
      ? {
          name: String((ws as Record<string, unknown>).name).slice(0, 80),
          tip: String((ws as Record<string, unknown>).tip ?? "").slice(0, 280),
        }
      : undefined;
  const perQuestion = Array.isArray(r.perQuestion)
    ? r.perQuestion
        .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
        .slice(0, 12)
        .map((p) => ({
          question: String(p.question ?? "").slice(0, 400),
          score: typeof p.score === "number" ? p.score : undefined,
          candidateAnswer: String(p.candidateAnswer ?? "").slice(0, 4000),
        }))
    : undefined;
  return {
    overallScore: typeof r.overallScore === "number" ? r.overallScore : 0,
    verdict: typeof r.verdict === "string" ? r.verdict.slice(0, 60) : "Unknown",
    strengths: strArr(r.strengths, 6),
    improvements: strArr(r.improvements, 6),
    weakestSkill,
    perQuestion,
  };
}

export default async function handler(req: Request): Promise<Response> {
  const baseHeaders = withRequestId(corsHeaders(req));

  if (!FEATURE_ENABLED) {
    // Dark-launch: the route exists but reports as not-found until flagged.
    return new Response(JSON.stringify({ error: "Not found." }), {
      status: 404,
      headers: baseHeaders,
    });
  }

  const ctErr = validateContentType(req, baseHeaders);
  if (ctErr) return ctErr;

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "coach-followup",
    ipLimit: 40,
    userLimit: 10,
    maxBytes: 40_000,
    checkQuota: true,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), { status: 400, headers });
  }

  const validation = validateFollowupRequest(body);
  if (!validation.ok) {
    return new Response(JSON.stringify({ error: validation.error }), { status: 400, headers });
  }
  const validated = validation.value;

  // Off-topic questions never reach the LLM — deterministic redirect.
  if (validated.intent === "offtopic") {
    return new Response(
      JSON.stringify({ ok: true, answer: fallbackAnswer("offtopic"), intent: validated.intent, model: "none" }),
      { status: 200, headers },
    );
  }

  // Sanitise the candidate's question against prompt injection before it
  // enters the prompt; keep the classified intent (computed pre-sanitise).
  const safeValidated = { ...validated, question: sanitizeForLLM(validated.question, 600) };
  const context = coerceReportContext((body as Record<string, unknown>)?.report);
  const prompt = buildCoachPrompt(context, safeValidated);

  try {
    const result = await callLLM(
      { prompt, temperature: 0.4, maxTokens: 500 },
      14000,
      { userId: auth.userId, endpoint: "coach-followup" },
    );
    const answer = (result.text || "").trim() || fallbackAnswer(validated.intent);
    return new Response(
      JSON.stringify({ ok: true, answer, intent: validated.intent, model: result.model }),
      { status: 200, headers },
    );
  } catch {
    // Every provider failed — degrade gracefully, never hard-error the UI.
    return new Response(
      JSON.stringify({ ok: true, answer: fallbackAnswer(validated.intent), intent: validated.intent, model: "fallback" }),
      { status: 200, headers },
    );
  }
}
