/* Vercel Cron — LLM model watchdog.
 *
 * Vendors retire models on a published schedule, and the first symptom in
 * production is a 404 on live user traffic. This verifies every model the
 * chain is configured to use, daily, against the vendor's own model list plus
 * a one-token probe, and alerts while there is still time to repoint
 * GEMINI_MODELS / GROQ_MODEL (env change + redeploy, no code change). */

import { geminiLadder, geminiThinkingConfig, groqModel } from "./_llm-models";
import { buildReport, ladderIsThin, needsAction, type ModelReport } from "./_llm-watchdog-helpers";

export const config = { runtime: "nodejs" };

declare const process: { env: Record<string, string | undefined> };

type Fetch = typeof fetch;

async function listGemini(key: string, fetchImpl: Fetch): Promise<Set<string> | null> {
  const ids = new Set<string>();
  let token = "";
  for (let page = 0; page < 5; page++) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`;
    const res = await fetchImpl(url, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { models?: Array<{ name?: string }>; nextPageToken?: string };
    for (const m of data.models ?? []) if (m.name) ids.add(m.name);
    if (!data.nextPageToken) break;
    token = data.nextPageToken;
  }
  return ids.size > 0 ? ids : null;
}

async function probeGemini(key: string, model: string, fetchImpl: Fetch): Promise<number | null> {
  try {
    const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Reply with OK" }] }],
        generationConfig: { maxOutputTokens: 16, thinkingConfig: geminiThinkingConfig(model) },
      }),
      signal: AbortSignal.timeout(12000),
    });
    return res.status;
  } catch {
    return null;
  }
}

async function listGroq(key: string, fetchImpl: Fetch): Promise<Set<string> | null> {
  try {
    const res = await fetchImpl("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    const ids = new Set((data.data ?? []).flatMap((m) => (m.id ? [m.id] : [])));
    return ids.size > 0 ? ids : null;
  } catch {
    return null;
  }
}

export async function runWatchdog(fetchImpl: Fetch = fetch): Promise<ModelReport[]> {
  const reports: ModelReport[] = [];
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const listed = await listGemini(geminiKey, fetchImpl).catch(() => null);
    for (const model of geminiLadder()) {
      const probe = await probeGemini(geminiKey, model, fetchImpl);
      reports.push(buildReport("gemini", model, listed, probe));
    }
  }
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const listed = await listGroq(groqKey, fetchImpl);
    for (const model of new Set([groqModel(true), groqModel(false)])) reports.push(buildReport("groq", model, listed, undefined));
  }
  return reports;
}

async function alert(subject: string, text: string): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    tasks.push(fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "HireStepX Alerts <alerts@hirestepx.com>", to: [process.env.ALERT_EMAIL || "support@hirestepx.com"], subject, text }),
      signal: AbortSignal.timeout(3000),
    }));
  }
  const slack = process.env.SLACK_ALERT_WEBHOOK_URL;
  if (slack) {
    tasks.push(fetch(slack, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `*${subject}*\n${text}` }), signal: AbortSignal.timeout(3000) }));
  }
  await Promise.allSettled(tasks);
}

export default async function handler(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || (req.headers.get("authorization") || "") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const reports = await runWatchdog();
  const actionable = reports.filter(needsAction);
  const thin = reports.some((r) => r.provider === "gemini") && ladderIsThin(reports);

  if (actionable.length > 0 || thin) {
    const lines = [
      ...actionable.map((r) => `- ${r.provider} ${r.model}: ${r.status}${r.detail ? ` (${r.detail})` : ""}`),
      ...(thin ? ["- Fewer than 2 Gemini models are answering — the chain has no Gemini failover."] : []),
    ];
    const text = `${lines.join("\n")}\n\nRepoint with the GEMINI_MODELS (comma-separated, ordered) or GROQ_MODEL / GROQ_FAST_MODEL env vars in Vercel, then redeploy. No code change needed.`;
    console.error(`[LLM-WATCHDOG] action needed:\n${text}`);
    await alert("LLM model watchdog: action needed", text);
  } else {
    console.warn(`[LLM-WATCHDOG] all models healthy: ${reports.map((r) => `${r.model}=${r.status}`).join(", ")}`);
  }

  return new Response(JSON.stringify({ ok: actionable.length === 0 && !thin, reports }), { status: 200, headers: { "Content-Type": "application/json" } });
}
