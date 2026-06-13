/* Admin: mark a session insight resolved / acknowledged / wont_fix.
 * Reuses the same admin-token auth as /api/admin-data and /api/admin-quality.
 *
 * Body: { session_id, status, notes?, by? }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAdminToken as verifyToken } from "./_admin-auth";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const ALLOWED_STATUSES = new Set(["open", "acknowledged", "resolved", "wont_fix"]);

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
  const token = req.headers["x-admin-token"];
  if (typeof token !== "string" || !verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = (req.body || {}) as { session_id?: string; session_ids?: string[]; status?: string; notes?: string; by?: string; flag?: string };
  const status = typeof body.status === "string" ? body.status : "";
  if (!ALLOWED_STATUSES.has(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  // Accept either single (session_id) or bulk (session_ids array). Bulk mode
  // also accepts an optional `flag` so the UI can "acknowledge all sessions
  // currently flagged with X" without resolving sessions that have a different mix.
  const ids: string[] = [];
  if (Array.isArray(body.session_ids)) {
    for (const id of body.session_ids) {
      if (typeof id === "string" && id.length > 0 && id.length <= 64) ids.push(id);
    }
  } else if (typeof body.session_id === "string" && body.session_id.length > 0) {
    ids.push(body.session_id.slice(0, 64));
  }
  if (ids.length === 0) {
    res.status(400).json({ error: "Missing session_id or session_ids" });
    return;
  }
  if (ids.length > 200) {
    res.status(400).json({ error: "Bulk update capped at 200 sessions" });
    return;
  }

  const patch: Record<string, unknown> = {
    resolution_status: status,
    resolution_notes: typeof body.notes === "string" ? body.notes.slice(0, 1000) : "",
    resolved_by: typeof body.by === "string" ? body.by.slice(0, 200) : null,
    resolved_at: status === "open" ? null : new Date().toISOString(),
  };

  const idsParam = `(${ids.map((id) => `"${id.replace(/"/g, "")}"`).join(",")})`;
  const url = `${SUPABASE_URL}/rest/v1/session_insights?session_id=in.${encodeURIComponent(idsParam)}`;
  const upd = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });
  if (!upd.ok) {
    const txt = (await upd.text().catch(() => "")).slice(0, 300);
    console.error(`[admin-quality-resolve] PATCH failed ${upd.status}: ${txt}`);
    res.status(502).json({ error: "Update failed", details: txt });
    return;
  }
  res.status(200).json({ ok: true, updated: ids.length, status });
}
