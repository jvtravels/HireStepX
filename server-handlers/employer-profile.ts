/* Vercel Edge Function — Employer Profile
 *
 * GET  /api/employer-profile  → current employer row, or { status: "none" }
 *      when the account has never submitted a company profile (the console
 *      then shows CompanyOnboarding). A GET never creates a row: a candidate
 *      account merely visiting /employer must not silently become an
 *      employer. Includes logoUrl (public Storage URL), the effective
 *      verification tier, its limits, and whether the account is suspended.
 * POST /api/employer-profile  { companyName, website, logoBase64?,
 *      logoContentType? } → upserts an approved employer row (fresh
 *      submission or resubmission after rejection). logoBase64 is optional;
 *      omitting it on a resubmission keeps any previously uploaded logo.
 *
 * Employers are a separate table keyed by auth.users id — see CLAUDE.md
 * scope note in app/(employer) and the schema comment in
 * supabase-schema.sql ("Employer talent-roster feature").
 *
 * Employers do not need admin approval: a submission is live immediately.
 * The `employers.status` column is legacy — nothing gates on it, every write
 * here sets "approved", and GET reports "approved" for any existing row
 * (including old "pending"/"rejected" ones) so no row can be stuck.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import { base64ToBytes } from "./_resume-upload-helpers";
import { loadAuthIdentity } from "./_entitlements";
import { deriveEmployerTier, isEmployerTier, TIER_LIMITS, tierAtLeast, type EmployerTier } from "./_employer-trust";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const LOGO_BUCKET = "employer-logos";
const LOGO_MAX_BYTES = 2_000_000;
const LOGO_CONTENT_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

function logoUrl(logoPath: string | null): string | null {
  return logoPath ? `${SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/${logoPath}` : null;
}

interface EmployerRow {
  id: string;
  company_name: string;
  website: string;
  logo_path: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  approved_at: string | null;
  verification_tier?: string | null;
  suspended_at?: string | null;
}

interface SubmitBody {
  companyName?: unknown;
  website?: unknown;
  logoBase64?: unknown;
  logoContentType?: unknown;
}

function asString(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** Deletes a stale logo object from Storage. Best-effort: a failure here
    just leaves an orphaned file behind, which is a storage-hygiene issue,
    not a correctness one — it must never fail the profile submission that's
    already succeeded. */
async function deleteLogoIfDifferent(userId: string, oldPath: string | null, newPath: string): Promise<void> {
  if (!oldPath || oldPath === newPath) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${LOGO_BUCKET}/${oldPath}`, {
      method: "DELETE",
      headers: serviceHeaders(),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      slog.error("employer-profile stale logo delete failed", { code: "employer_profile_logo_delete_failed", httpStatus: res.status, body: errText.slice(0, 200), userId });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-profile stale logo delete threw", { code: "employer_profile_logo_delete_error", error: msg.slice(0, 200), userId });
  }
}

type LogoUpload =
  | { kind: "none" }
  | { kind: "ok"; path: string }
  | { kind: "error"; message: string };

/** Creates the public logo bucket. The bucket used to be a manual runbook step,
    and a missing bucket silently dropped every logo; creating it on demand
    makes the feature self-healing in any environment. 409 = already exists. */
async function ensureLogoBucket(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: "POST",
      headers: { ...serviceHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        id: LOGO_BUCKET,
        name: LOGO_BUCKET,
        public: true,
        file_size_limit: LOGO_MAX_BYTES,
        allowed_mime_types: Object.keys(LOGO_CONTENT_TYPES),
      }),
    });
    return res.ok || res.status === 409;
  } catch {
    return false;
  }
}

function postLogoObject(storagePath: string, contentType: string, bytes: Uint8Array): Promise<Response> {
  return fetch(`${SUPABASE_URL}/storage/v1/object/${LOGO_BUCKET}/${storagePath}`, {
    method: "POST",
    headers: { ...serviceHeaders(), "Content-Type": contentType, "Cache-Control": "max-age=3600" },
    body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  });
}

/** Uploads an optional logo to Storage. A logo the user explicitly submitted
    that cannot be stored is reported as an error — never swallowed — so the
    form can say so instead of showing "saved" and losing the image on refresh.
    Every upload gets a NEW immutable path (`<userId>/logo-<version>.<ext>`):
    a fixed path would be served stale by the Storage CDN (max-age) after a
    replace, and differing extensions would orphan the old object. Callers
    delete the previous logo_path once the new one is persisted; see
    deleteLogoIfDifferent(). */
async function uploadLogoIfPresent(userId: string, body: SubmitBody): Promise<LogoUpload> {
  const logoBase64 = typeof body.logoBase64 === "string" ? body.logoBase64 : "";
  if (!logoBase64) return { kind: "none" };

  const contentType = typeof body.logoContentType === "string" ? body.logoContentType : "";
  const ext = LOGO_CONTENT_TYPES[contentType];
  if (!ext) {
    slog.error("employer-profile logo rejected", { code: "employer_profile_logo_bad_type", contentType: contentType.slice(0, 50), userId });
    return { kind: "error", message: "Use a PNG, JPG, or WEBP image for your logo." };
  }

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(logoBase64);
  } catch {
    return { kind: "error", message: "We couldn't read that logo file. Try a different image." };
  }
  if (bytes.length === 0) return { kind: "error", message: "We couldn't read that logo file. Try a different image." };
  if (bytes.length > LOGO_MAX_BYTES) return { kind: "error", message: "Logo is too large. Keep it under 2 MB." };

  const storagePath = `${userId}/logo-${Date.now().toString(36)}.${ext}`;
  try {
    let uploadRes = await postLogoObject(storagePath, contentType, bytes);
    if (uploadRes.status === 404 && (await ensureLogoBucket())) {
      uploadRes = await postLogoObject(storagePath, contentType, bytes);
    }
    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => "");
      slog.error("employer-profile logo upload failed", { code: "employer_profile_logo_upload_failed", httpStatus: uploadRes.status, body: errText.slice(0, 200), userId });
      return { kind: "error", message: "We couldn't upload your logo right now. Please try again." };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-profile logo upload threw", { code: "employer_profile_logo_upload_error", error: msg.slice(0, 200), userId });
    return { kind: "error", message: "We couldn't upload your logo right now. Please try again." };
  }
  return { kind: "ok", path: storagePath };
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

  // maxBytes covers a base64-encoded 2MB logo (~33% overhead) on top of the
  // plain-text fields; GET requests carry no body so this only bounds POST.
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "employer-profile",
    ipLimit: 30,
    userLimit: 20,
    maxBytes: 2_800_000,
    checkQuota: false,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowGet: true }) };

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  if (req.method === "GET") {
    return handleGet(auth.userId, headers);
  }
  if (req.method === "POST") {
    return handlePost(req, auth.userId, headers);
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}

async function fetchEmployer(userId: string): Promise<EmployerRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/employers?id=eq.${encodeURIComponent(userId)}&select=id,company_name,website,logo_path,status,submitted_at,approved_at,verification_tier,suspended_at`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) throw new Error(`employer read failed: ${res.status}`);
  const rows = (await res.json().catch(() => [])) as EmployerRow[];
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/** Effective tier shown to the employer and persisted when it has risen
 *  (e.g. they confirmed a company email) so admins see it without recomputing. */
async function resolveTier(row: EmployerRow, userId: string): Promise<EmployerTier> {
  const identity = await loadAuthIdentity(SUPABASE_URL, serviceHeaders(), userId);
  const tier = deriveEmployerTier({
    storedTier: row.verification_tier,
    email: identity.email,
    emailConfirmed: identity.emailConfirmed,
    website: row.website,
  });
  const stored: EmployerTier = isEmployerTier(row.verification_tier) ? row.verification_tier : "basic";
  if (tier !== stored && tierAtLeast(tier, stored)) {
    await fetch(`${SUPABASE_URL}/rest/v1/employers?id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ verification_tier: tier, verified_at: new Date().toISOString() }),
    }).catch(() => {});
  }
  return tier;
}

function profileResponse(row: EmployerRow, tier: EmployerTier) {
  return {
    status: "approved" as const,
    companyName: row.company_name,
    website: row.website,
    logoUrl: logoUrl(row.logo_path),
    verificationTier: tier,
    limits: TIER_LIMITS[tier],
    suspended: !!row.suspended_at,
  };
}

async function handleGet(userId: string, headers: Record<string, string>): Promise<Response> {
  try {
    const row = await fetchEmployer(userId);
    if (!row) return new Response(JSON.stringify({ status: "none" }), { status: 200, headers });
    return new Response(JSON.stringify(profileResponse(row, await resolveTier(row, userId))), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-profile GET threw", { code: "employer_profile_get_unexpected_error", error: msg.slice(0, 200), userId });
    return new Response(JSON.stringify({ error: "Failed to load employer profile" }), { status: 500, headers });
  }
}

async function handlePost(req: Request, userId: string, headers: Record<string, string>): Promise<Response> {
  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const companyName = asString(body.companyName, 200);
  // Signup only captures the company name; an omitted website must keep the
  // stored one rather than blank it (and silently drop the tier it proved).
  const websiteProvided = body.website !== undefined;
  let website = asString(body.website, 300);

  if (companyName.length < 2) {
    return new Response(JSON.stringify({ error: "companyName is required" }), { status: 400, headers });
  }
  if (website && !/^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(website)) {
    return new Response(JSON.stringify({ error: "Enter a valid company website, e.g. acme.com" }), { status: 400, headers });
  }

  try {
    const upload = await uploadLogoIfPresent(userId, body);
    if (upload.kind === "error") {
      return new Response(JSON.stringify({ error: upload.message, code: "logo_upload_failed" }), { status: 422, headers });
    }
    const uploadedLogoPath = upload.kind === "ok" ? upload.path : null;
    const existing = await fetchEmployer(userId);
    if (!websiteProvided) website = existing?.website ?? "";
    const logoPath = uploadedLogoPath ?? existing?.logo_path ?? null;
    const now = new Date().toISOString();
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/employers?on_conflict=id`, {
      method: "POST",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([{
        id: userId,
        company_name: companyName,
        website,
        logo_path: logoPath,
        status: "approved",
        submitted_at: now,
        approved_at: existing?.approved_at ?? now,
      }]),
    });

    if (!upsertRes.ok) {
      const t = await upsertRes.text().catch(() => "");
      slog.error("employer-profile upsert failed", { code: "employer_profile_upsert_failed", httpStatus: upsertRes.status, body: t.slice(0, 200), userId });
      if (uploadedLogoPath) await deleteLogoIfDifferent(userId, uploadedLogoPath, existing?.logo_path ?? "");
      return new Response(JSON.stringify({ error: "Failed to submit company profile" }), { status: 500, headers });
    }

    if (uploadedLogoPath) await deleteLogoIfDifferent(userId, existing?.logo_path ?? null, uploadedLogoPath);

    const saved = (await upsertRes.json().catch(() => [])) as EmployerRow[];
    const row: EmployerRow = saved[0] ?? { ...(existing ?? { id: userId, status: "approved", submitted_at: now, approved_at: now, logo_path: logoPath }), company_name: companyName, website, logo_path: logoPath };
    return new Response(JSON.stringify(profileResponse(row, await resolveTier(row, userId))), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-profile POST threw", { code: "employer_profile_post_unexpected_error", error: msg.slice(0, 200), userId });
    return new Response(JSON.stringify({ error: "Failed to submit company profile" }), { status: 500, headers });
  }
}
