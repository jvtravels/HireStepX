/* Admin: fetch a single session's transcript + analyzer findings.
 *
 * Used by the SessionDetail side panel to render Q→A→next-Q context
 * for each finding. Token-auth identical to the other admin-quality
 * endpoints.
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

async function supa<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) return [];
  const j = await res.json();
  return Array.isArray(j) ? (j as T[]) : [];
}

interface SessionRow {
  id: string;
  user_id: string;
  type: string;
  focus: string;
  difficulty: string;
  score: number;
  questions: number;
  duration: number;
  transcript: { speaker: string; text: string; time: string }[] | null;
  ai_feedback: string;
  created_at: string;
}

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

  const body = (req.body || {}) as { session_id?: string };
  const sessionId = typeof body.session_id === "string" ? body.session_id.slice(0, 64) : "";
  if (!sessionId) {
    res.status(400).json({ error: "Missing session_id" });
    return;
  }

  const rows = await supa<SessionRow>(
    `sessions?id=eq.${encodeURIComponent(sessionId)}&select=id,user_id,type,focus,difficulty,score,questions,duration,transcript,ai_feedback,created_at&limit=1`,
  );
  const session = rows[0];
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.status(200).json({
    ok: true,
    session: {
      id: session.id,
      user_id: session.user_id,
      type: session.type,
      focus: session.focus,
      difficulty: session.difficulty,
      score: session.score,
      questions: session.questions,
      duration: session.duration,
      transcript: Array.isArray(session.transcript) ? session.transcript : [],
      ai_feedback: session.ai_feedback || "",
      created_at: session.created_at,
    },
  });
}
