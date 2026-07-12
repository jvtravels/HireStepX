/* Admin: update the status of an auto-generated quality recommendation.
 * pending → in_progress → done | dismissed.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAdminToken as verifyToken } from "./_admin-auth";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ALLOWED = new Set(["pending", "in_progress", "done", "dismissed"]);

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    const origin = req.headers.origin || "";
    res.setHeader("Access-Control-Allow-Origin", origin || "https://hirestepx.com");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "x-admin-token, content-type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { res.status(503).json({ error: "Server misconfigured" }); return; }
  const token = req.headers["x-admin-token"];
  if (typeof token !== "string" || !verifyToken(token)) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = (req.body || {}) as { id?: string; status?: string; notes?: string; by?: string };
  const id = typeof body.id === "string" ? body.id.slice(0, 64) : "";
  const status = typeof body.status === "string" ? body.status : "";
  if (!id || !ALLOWED.has(status)) {
    res.status(400).json({ error: "Invalid id or status" });
    return;
  }

  const patch = {
    status,
    status_notes: typeof body.notes === "string" ? body.notes.slice(0, 500) : "",
    status_updated_at: new Date().toISOString(),
    status_updated_by: typeof body.by === "string" ? body.by.slice(0, 200) : "",
  };

  const upd = await fetch(`${SUPABASE_URL}/rest/v1/quality_recommendations?id=eq.${encodeURIComponent(id)}`, {
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
    res.status(502).json({ error: "Update failed", details: txt });
    return;
  }
  res.status(200).json({ ok: true, id, status });
}
