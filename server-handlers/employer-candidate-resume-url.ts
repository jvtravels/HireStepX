/* Vercel Edge Function — Employer candidate resume download link
 *
 * GET /api/employer-candidate-resume-url?matchId=...
 *
 * Returns a short-lived signed URL for the candidate's most recent original
 * resume file. Gated by loadEmployerMatchAccess (ownership, suspension,
 * opt-out, blocks) AND by the employer having unlocked the candidate, since
 * the file carries the candidate's real name and contact details.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import { loadEmployerMatchAccess, loadAuthIdentity, DENIED_STATUS } from "./_entitlements";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "resume-files";
const SIGNED_URL_TTL_SECONDS = 120;

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, { allowGet: true }) });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503, headers: withRequestId(corsHeaders(req, { allowGet: true })),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "employer-candidate-resume-url",
    ipLimit: 40,
    userLimit: 20,
    checkQuota: false,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowGet: true }) };

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  const matchId = new URL(req.url).searchParams.get("matchId") || "";
  if (!matchId) {
    return new Response(JSON.stringify({ error: "matchId is required" }), { status: 400, headers });
  }

  try {
    const identity = await loadAuthIdentity(SUPABASE_URL, serviceHeaders(), auth.userId);
    const decision = await loadEmployerMatchAccess({
      supabaseUrl: SUPABASE_URL,
      headers: serviceHeaders(),
      employerId: auth.userId,
      matchId,
      authEmail: identity.email,
      emailConfirmed: identity.emailConfirmed,
    });
    if (!decision.ok) {
      if (decision.reason === "error") {
        return new Response(JSON.stringify({ error: "Failed to load resume" }), { status: 502, headers });
      }
      const d = DENIED_STATUS[decision.reason];
      return new Response(JSON.stringify({ error: d.error }), { status: d.status, headers });
    }
    if (!decision.access.unlocked) {
      return new Response(JSON.stringify({ error: "Unlock this candidate to download their resume" }), { status: 403, headers });
    }

    const candidateUserId = decision.access.match.candidate_user_id;
    const fileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/resume_versions?select=file_name,file_path,resumes!inner(user_id)&resumes.user_id=eq.${encodeURIComponent(candidateUserId)}&file_path=not.is.null&order=created_at.desc&limit=1`,
      { headers: serviceHeaders() },
    );
    const rows = (await fileRes.json().catch(() => [])) as Array<{ file_name: string | null; file_path: string | null }>;
    if (!fileRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to load resume" }), { status: 502, headers });
    }
    const file = rows[0];
    if (!file?.file_path) {
      return new Response(JSON.stringify({ error: "This candidate has no resume file on record" }), { status: 404, headers });
    }

    const fileName = file.file_name || "resume";
    const signRes = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${file.file_path}`, {
      method: "POST",
      headers: { ...serviceHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
    });
    const signData = (await signRes.json().catch(() => ({}))) as { signedURL?: string };
    if (!signRes.ok || !signData.signedURL) {
      return new Response(JSON.stringify({ error: "Could not generate a download link" }), { status: 502, headers });
    }
    const sep = signData.signedURL.includes("?") ? "&" : "?";
    const url = `${SUPABASE_URL}/storage/v1${signData.signedURL}${sep}download=${encodeURIComponent(fileName)}`;

    return new Response(JSON.stringify({ url, fileName }), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-candidate-resume-url threw", { code: "employer_candidate_resume_url_unexpected_error", error: msg.slice(0, 200), userId: auth.userId, matchId });
    return new Response(JSON.stringify({ error: "Failed to generate download link" }), { status: 500, headers });
  }
}
