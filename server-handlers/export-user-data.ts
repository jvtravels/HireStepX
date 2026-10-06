/* Vercel Serverless Function — GDPR Data Export
 * Returns all user data as a JSON download for "right to data portability" compliance.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withNodeAuthAndRateLimit, supabaseUrl } from "./_shared";
import { buildExportEnvelope, buildExportFilename } from "./_export-user-data-helpers";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("X-Request-ID", crypto.randomUUID());

  const pre = await withNodeAuthAndRateLimit(req, res, {
    endpoint: "export-user-data",
    ipLimit: 3,
    allowGet: true,
  });
  if (pre.handled) return;
  const { userId, userEmail = "" } = pre;

  const SUPABASE_URL = supabaseUrl();
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };
  const encodedId = encodeURIComponent(userId);

  // Fetch all user-owned rows in parallel (gracefully handle missing tables)
  async function safeFetch(path: string): Promise<unknown[]> {
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 8000);
      const r = await fetch(`${SUPABASE_URL}${path}`, { headers, signal: ac.signal });
      clearTimeout(timer);
      if (!r.ok) return [];
      return await r.json();
    } catch { return []; }
  }

  const [profile, sessions, events, payments, feedback, interviewTurns, llmUsage] = await Promise.all([
    safeFetch(`/rest/v1/profiles?id=eq.${encodedId}`),
    safeFetch(`/rest/v1/sessions?user_id=eq.${encodedId}&order=created_at.desc`),
    safeFetch(`/rest/v1/calendar_events?user_id=eq.${encodedId}&order=date.desc`),
    safeFetch(`/rest/v1/payments?user_id=eq.${encodedId}&order=created_at.desc`),
    safeFetch(`/rest/v1/feedback?user_id=eq.${encodedId}`),
    safeFetch(`/rest/v1/interview_turns?user_id=eq.${encodedId}&order=created_at.desc&limit=5000`),
    safeFetch(`/rest/v1/llm_usage?user_id=eq.${encodedId}&order=created_at.desc&limit=1000`),
  ]);

  const exportData = buildExportEnvelope({
    userId,
    userEmail,
    profile,
    sessions,
    calendar_events: events,
    payments,
    feedback,
    interview_turns: interviewTurns,
    llm_usage: llmUsage,
  });

  const filename = buildExportFilename(userId);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.status(200).send(JSON.stringify(exportData, null, 2));
}
