/* Admin: mark a session insight resolved / acknowledged / wont_fix.
 * Reuses the same admin-token auth as /api/admin-data and /api/admin-quality.
 *
 * Body: { session_id, status, notes?, by? }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac, timingSafeEqual } from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TOKEN_SECRET = process.env.ADMIN_PASSWORD || "fallback-secret";

const ALLOWED_STATUSES = new Set(["open", "acknowledged", "resolved", "wont_fix"]);

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

  const body = (req.body || {}) as { session_id?: string; status?: string; notes?: string; by?: string };
  const sessionId = typeof body.session_id === "string" ? body.session_id.slice(0, 64) : "";
  const status = typeof body.status === "string" ? body.status : "";
  if (!sessionId || !ALLOWED_STATUSES.has(status)) {
    res.status(400).json({ error: "Invalid session_id or status" });
    return;
  }

  const patch: Record<string, unknown> = {
    resolution_status: status,
    resolution_notes: typeof body.notes === "string" ? body.notes.slice(0, 1000) : "",
    resolved_by: typeof body.by === "string" ? body.by.slice(0, 200) : null,
    resolved_at: status === "open" ? null : new Date().toISOString(),
  };

  const url = `${SUPABASE_URL}/rest/v1/session_insights?session_id=eq.${encodeURIComponent(sessionId)}`;
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
  res.status(200).json({ ok: true, session_id: sessionId, status });
}
