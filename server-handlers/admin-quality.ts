/* Admin Quality Dashboard API.
 *
 * Returns aggregated session-quality metrics from session_insights
 * and daily_quality_report. Reuses the same token-based auth as
 * /api/admin-data — admin logs in there, the token in localStorage
 * works here too because both handlers share TOKEN_SECRET.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac, timingSafeEqual } from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TOKEN_SECRET = process.env.ADMIN_PASSWORD || "fallback-secret";

function verifyToken(token: string): boolean {
  try {
    const [dataB64, sig] = token.split(".");
    if (!dataB64 || !sig) return false;
    const data = Buffer.from(dataB64, "base64").toString();
    const expectedSig = createHmac("sha256", TOKEN_SECRET).update(data).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length) return false;
    if (!timingSafeEqual(a, b)) return false;
    const payload = JSON.parse(data);
    if (Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

function isAuthed(req: VercelRequest): boolean {
  const token = req.headers["x-admin-token"];
  return typeof token === "string" && verifyToken(token);
}

async function supa<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    console.error(`[admin-quality] supa ${path}: ${res.status}`);
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? (data as T[]) : [];
}

interface DailyRow {
  day: string;
  focus: string;
  sessions_analyzed: number;
  avg_score_drift: number;
  hallucination_rate: number;
  flagged_question_count: number;
  top_flags: { flag: string; count: number }[] | null;
}

interface InsightRow {
  session_id: string;
  user_id: string;
  focus: string;
  analyzer_version: string;
  analyzed_at: string;
  rescore: number | null;
  score_drift: number | null;
  flags: string[] | null;
  hallucinations: unknown;
  coaching_notes: string;
  error: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "x-admin-token, content-type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(503).json({ error: "Server misconfigured" });
    return;
  }

  if (!isAuthed(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // 30 days of daily aggregates ordered newest first.
  const sinceDay = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const daily = await supa<DailyRow>(
    `daily_quality_report?day=gte.${sinceDay}&order=day.desc,focus.asc&limit=500`,
  );

  // Last 50 insight rows with non-empty flags or hallucinations,
  // newest first — the "what just broke" panel.
  const recent = await supa<InsightRow>(
    `session_insights?order=analyzed_at.desc&limit=50&select=session_id,user_id,focus,analyzer_version,analyzed_at,rescore,score_drift,flags,hallucinations,coaching_notes,error`,
  );

  // Per-focus rollup over the last 7 days for the headline cards.
  const sevenDayCutoff = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const week = daily.filter((d) => d.day >= sevenDayCutoff);
  const focusRollup = new Map<string, {
    sessions: number;
    drift_sum: number;
    drift_count: number;
    halluc_session_sum: number;
  }>();
  for (const row of week) {
    const r = focusRollup.get(row.focus) || { sessions: 0, drift_sum: 0, drift_count: 0, halluc_session_sum: 0 };
    r.sessions += row.sessions_analyzed || 0;
    if (typeof row.avg_score_drift === "number") {
      r.drift_sum += row.avg_score_drift * (row.sessions_analyzed || 0);
      r.drift_count += row.sessions_analyzed || 0;
    }
    r.halluc_session_sum += (row.hallucination_rate || 0) * (row.sessions_analyzed || 0);
    focusRollup.set(row.focus, r);
  }
  const headlines = Array.from(focusRollup.entries())
    .map(([focus, r]) => ({
      focus,
      sessions_7d: r.sessions,
      avg_drift_7d: r.drift_count > 0 ? r.drift_sum / r.drift_count : 0,
      hallucination_rate_7d: r.sessions > 0 ? r.halluc_session_sum / r.sessions : 0,
    }))
    .sort((a, b) => b.sessions_7d - a.sessions_7d);

  res.status(200).json({
    headlines,
    daily,
    recent,
    generated_at: new Date().toISOString(),
  });
}
