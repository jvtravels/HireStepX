/* Daily cron: compares report-score distributions over time and across the
 * grading provider, and alerts on a shift. Needs no LLM calls; it reads the
 * `model` and `overallScore` already stored in sessions.report_json. */

import { analyzeDrift, parseSessionRows } from "./_llm-drift-helpers";
import { sendOpsAlert } from "./_ops-alert";

export const config = { runtime: "nodejs" };

declare const process: { env: Record<string, string | undefined> };

const WINDOW_DAYS = 21;
const RECENT_DAYS = 3;
const MAX_ROWS = 3000;

export default async function handler(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || (req.headers.get("authorization") || "") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return new Response(JSON.stringify({ ok: false, error: "supabase not configured" }), { status: 200, headers: { "Content-Type": "application/json" } });

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const res = await fetch(
    `${url}/rest/v1/sessions?select=created_at,model:report_json->>model,score:report_json->>overallScore&report_json=not.is.null&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=${MAX_ROWS}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) },
  ).catch(() => null);
  if (!res || !res.ok) {
    console.error(`[LLM-DRIFT] sessions query failed (${res?.status ?? "network"})`);
    return new Response(JSON.stringify({ ok: false, error: "query failed" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const sessions = parseSessionRows(await res.json().catch(() => null));
  const findings = analyzeDrift(sessions, Date.now(), RECENT_DAYS * 86_400_000);
  if (findings.length > 0) {
    const text = `${findings.map((f) => `- ${f.message}`).join("\n")}\n\nWindow: last ${WINDOW_DAYS} days, ${sessions.length} scored reports. Check the model ladder, provider health and recent prompt changes (PROMPT_VERSIONS).`;
    console.error(`[LLM-DRIFT] ${text}`);
    await sendOpsAlert("LLM report-quality drift", text);
  } else {
    console.warn(`[LLM-DRIFT] no drift across ${sessions.length} scored reports`);
  }
  return new Response(JSON.stringify({ ok: findings.length === 0, sessions: sessions.length, findings }), { status: 200, headers: { "Content-Type": "application/json" } });
}
