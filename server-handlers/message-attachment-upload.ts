/* Vercel Edge Function — Chat attachment upload
 *
 * POST /api/message-attachment-upload { matchId, fileName, contentType, fileBase64 }
 * -> { ok, attachmentPath, attachmentName, attachmentMime }
 *
 * Uploads to the `chat-attachments` Storage bucket (created manually,
 * same runbook as resume-files — see resume-upload-file.ts for the
 * precedent and the bucket-missing degradation). Returns the storage path;
 * the client then calls POST /api/messages with it to actually send the
 * message, mirroring the two-step resume upload flow.
 *
 * Base64-in-JSON, not multipart — same rationale as resume-upload-file.ts.
 * Attachment type is capped to a small allowlist (docs + images) via
 * inferAttachmentExtension, unlike resume uploads which only ever see
 * resume-shaped files.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import { base64ToBytes } from "./_resume-upload-helpers";
import { inferAttachmentExtension, resolveRole, MATCH_ID_RE } from "./_messages-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "chat-attachments";
const MAX_BYTES = 8_000_000;

interface UploadBody {
  matchId?: unknown;
  fileName?: unknown;
  contentType?: unknown;
  fileBase64?: unknown;
}

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503, headers: withRequestId(corsHeaders(req)),
    });
  }

  // 11 MB JSON ceiling covers an ~8 MB raw attachment at base64 overhead.
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "message-attachment-upload",
    ipLimit: 20,
    userLimit: 10,
    maxBytes: 11_000_000,
    checkQuota: false,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req) };

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  let body: UploadBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const matchId = typeof body.matchId === "string" ? body.matchId : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 255) : "attachment";
  const contentType = typeof body.contentType === "string" ? body.contentType.slice(0, 100) : "";
  const fileBase64 = typeof body.fileBase64 === "string" ? body.fileBase64 : "";

  if (!MATCH_ID_RE.test(matchId)) return new Response(JSON.stringify({ error: "Invalid matchId" }), { status: 400, headers });
  if (!fileBase64) return new Response(JSON.stringify({ error: "Missing fileBase64" }), { status: 400, headers });
  const ext = inferAttachmentExtension(contentType);
  if (!ext) {
    return new Response(JSON.stringify({ error: "Unsupported file type. Allowed: PDF, DOC/DOCX, TXT, PNG, JPG, WEBP." }), { status: 415, headers });
  }

  try {
    const matchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?id=eq.${encodeURIComponent(matchId)}` +
        `&select=id,candidate_user_id,employer_requirements(employer_id)`,
      { headers: serviceHeaders() },
    );
    const matchRows = (await matchRes.json().catch(() => [])) as Array<{
      id: string; candidate_user_id: string; employer_requirements: { employer_id: string } | null;
    }>;
    if (!matchRes.ok || !matchRows[0] || !matchRows[0].employer_requirements) {
      return new Response(JSON.stringify({ error: "Candidate match not found" }), { status: 404, headers });
    }
    const role = resolveRole(auth.userId, matchRows[0].employer_requirements.employer_id, matchRows[0].candidate_user_id);
    if (!role) {
      return new Response(JSON.stringify({ error: "Not authorized for this conversation" }), { status: 403, headers });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Match lookup error" }), { status: 502, headers });
  }

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(fileBase64);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid base64 file content" }), { status: 400, headers });
  }
  if (bytes.length === 0) return new Response(JSON.stringify({ error: "Empty file" }), { status: 400, headers });
  if (bytes.length > MAX_BYTES) {
    return new Response(JSON.stringify({ error: "File too large (8MB max)" }), { status: 413, headers });
  }

  const storagePath = `${matchId}/${crypto.randomUUID()}.${ext}`;

  try {
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => "");
      const isMissingBucket = uploadRes.status === 404 || /bucket.*not.*found/i.test(errText);
      slog.warn("message-attachment-upload: storage upload failed", { httpStatus: uploadRes.status, body: errText.slice(0, 200) });
      return new Response(JSON.stringify({
        error: isMissingBucket ? "File sharing isn't configured yet." : `Upload failed: ${errText.slice(0, 100)}`,
        bucketMissing: isMissingBucket,
      }), { status: isMissingBucket ? 503 : 502, headers });
    }
  } catch (err) {
    slog.error("message-attachment-upload threw", { code: "message_attachment_upload_error", error: (err as Error).message.slice(0, 200), userId: auth.userId });
    return new Response(JSON.stringify({ error: "Upload error" }), { status: 502, headers });
  }

  return new Response(
    JSON.stringify({ ok: true, attachmentPath: storagePath, attachmentName: fileName, attachmentMime: contentType }),
    { status: 200, headers },
  );
}
