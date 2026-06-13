/* Admin: log a prompt revision (POST) or list recent ones (GET-ish via POST {action:'list'}).
 *
 * Each revision marks 'I deployed a prompt change for focus X at time T'.
 * The nightly cron later measures the 7-day flag-rate delta around T and
 * writes the verdict to outcome.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAdminToken as verifyToken } from "./_admin-auth";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "x-admin-token, content-type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { res.status(503).json({ error: "Server misconfigured" }); return; }
  const token = req.headers["x-admin-token"];
  if (typeof token !== "string" || !verifyToken(token)) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = (req.body || {}) as { action?: string; focus?: string; description?: string; commit_sha?: string; by?: string };
  const action = body.action || "create";

  if (action === "list") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/prompt_revisions?order=deployed_at.desc&limit=50`, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!r.ok) { res.status(502).json({ error: "Fetch failed" }); return; }
    res.status(200).json({ ok: true, revisions: await r.json() });
    return;
  }

  // Default action: create
  const focus = typeof body.focus === "string" ? body.focus.slice(0, 64) : "";
  const description = typeof body.description === "string" ? body.description.slice(0, 500) : "";
  if (!focus || !description) {
    res.status(400).json({ error: "focus and description are required" });
    return;
  }

  const row = {
    focus,
    description,
    commit_sha: typeof body.commit_sha === "string" ? body.commit_sha.slice(0, 64) : "",
    deployed_by: typeof body.by === "string" ? body.by.slice(0, 200) : "",
    deployed_at: new Date().toISOString(),
  };

  const r = await fetch(`${SUPABASE_URL}/rest/v1/prompt_revisions`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([row]),
  });
  if (!r.ok) {
    const txt = (await r.text().catch(() => "")).slice(0, 300);
    res.status(502).json({ error: "Insert failed", details: txt });
    return;
  }
  const created = (await r.json()) as unknown[];
  res.status(200).json({ ok: true, revision: Array.isArray(created) ? created[0] : null });
}
