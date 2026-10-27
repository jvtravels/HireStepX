/* Vercel Edge Function — Accept a team invite
 *
 * GET  /api/employer-team-accept?token=…   (no sign-in required)
 *      → { state, companyName, role, email, inviterName } so the join page can
 *      say who is inviting you before you sign in. The token is the secret;
 *      a bad or unknown one is a uniform 404 and the endpoint is IP rate-limited.
 * POST /api/employer-team-accept { token } (signed in)
 *      → joins the company. The invite must be pending, and the signed-in
 *      account's CONFIRMED email must equal the invited email, so a leaked
 *      link is useless to anyone else. Single use is enforced by an atomic
 *      conditional PATCH (accepted_at is null), not read-then-write.
 */

export const config = { runtime: "edge" };

import {
  withAuthAndRateLimit, corsHeaders, handleCorsPreflightOrMethod, withRequestId, isRateLimited, getClientIp,
  rateLimitResponse, validateOrigin, forbiddenResponse, slog,
} from "./_shared";
import {
  INVITE_ACCEPT_MESSAGE, MAX_TEAM_SIZE, ROLE_LABEL, checkInviteAcceptable, hashInviteToken, inviteState, writeAuditLog,
  type InviteRow,
} from "./_employer-team-helpers";
import { teamsEnabledFor } from "./_employer-team-gate";
import { notify } from "./_notify";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const serviceHeaders = (): Record<string, string> => ({ apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` });
const jsonHeaders = () => ({ ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation" });

interface InviteWithCompany extends InviteRow {
  invited_by: string | null;
  employers: { company_name: string; suspended_at: string | null } | null;
}

const COLS = "id,employer_id,email,role,invited_by,expires_at,accepted_at,revoked_at,employers(company_name,suspended_at)";

async function findInvite(token: string): Promise<InviteWithCompany | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const hash = await hashInviteToken(token);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/employer_invites?token_hash=eq.${hash}&select=${COLS}&limit=1`, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`invite read failed: ${res.status}`);
  const inv = ((await res.json()) as InviteWithCompany[])[0] ?? null;
  // Kill switch: an invite for a company with teams switched off reads as not found.
  if (inv && !(await teamsEnabledFor(inv.employer_id))) return null;
  return inv;
}

async function inviterName(userId: string | null, employerId: string): Promise<string | null> {
  if (!userId) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/employer_members?employer_id=eq.${encodeURIComponent(employerId)}&user_id=eq.${encodeURIComponent(userId)}&select=name,email&limit=1`,
    { headers: serviceHeaders() },
  ).catch(() => null);
  if (!res?.ok) return null;
  const row = ((await res.json().catch(() => [])) as Array<{ name: string | null; email: string }>)[0];
  return row ? row.name || row.email : null;
}

export default async function handler(req: Request): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 503, headers: corsHeaders(req, { allowGet: true }) });
  }
  if (req.method === "GET") return preview(req);
  return accept(req);
}

async function preview(req: Request): Promise<Response> {
  const early = handleCorsPreflightOrMethod(req, { allowGet: true });
  if (early) return early;
  const headers = withRequestId(corsHeaders(req, { allowGet: true }));
  if (!validateOrigin(req)) return forbiddenResponse(headers);
  if (await isRateLimited(getClientIp(req), "employer-team-preview", 20, 60_000)) return rateLimitResponse(headers);
  try {
    const token = new URL(req.url).searchParams.get("token") ?? "";
    const inv = await findInvite(token);
    if (!inv) return new Response(JSON.stringify({ error: INVITE_ACCEPT_MESSAGE.invalid }), { status: 404, headers });
    return new Response(JSON.stringify({
      state: inviteState(inv),
      companyName: inv.employers?.company_name ?? "",
      role: inv.role,
      email: inv.email,
      inviterName: await inviterName(inv.invited_by, inv.employer_id),
    }), { status: 200, headers });
  } catch (err) {
    slog.error("employer-team-accept preview threw", { code: "employer_team_preview_error", error: String(err).slice(0, 200) });
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), { status: 500, headers });
  }
}

async function authUser(userId: string): Promise<{ email: string | null; confirmed: boolean; name: string | null }> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { headers: serviceHeaders() }).catch(() => null);
  if (!res?.ok) return { email: null, confirmed: false, name: null };
  const u = (await res.json().catch(() => null)) as { email?: string; email_confirmed_at?: string | null; user_metadata?: { name?: string; full_name?: string } } | null;
  return { email: u?.email ?? null, confirmed: !!u?.email_confirmed_at, name: u?.user_metadata?.name || u?.user_metadata?.full_name || null };
}

async function accept(req: Request): Promise<Response> {
  const pre = await withAuthAndRateLimit(req, { endpoint: "employer-team-accept", ipLimit: 20, userLimit: 10, maxBytes: 2_000, checkQuota: false, allowGet: true });
  if (pre instanceof Response) return pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowGet: true }) };
  const userId = pre.auth.userId;
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (!userId) return reply({ error: "Unauthorized" }, 401);

  try {
    const body = (await req.json().catch(() => ({}))) as { token?: unknown };
    const inv = await findInvite(typeof body.token === "string" ? body.token : "");
    const [user, existing] = await Promise.all([
      authUser(userId),
      fetch(`${SUPABASE_URL}/rest/v1/employer_members?user_id=eq.${encodeURIComponent(userId)}&select=employer_id&limit=1`, { headers: serviceHeaders() }),
    ]);

    const problem = checkInviteAcceptable(inv, { email: user.email, emailConfirmed: user.confirmed });
    if (problem || !inv) {
      const code = problem ?? "invalid";
      return reply({ error: INVITE_ACCEPT_MESSAGE[code], code }, code === "invalid" ? 404 : 409);
    }

    if (existing.ok) {
      const mine = ((await existing.json().catch(() => [])) as Array<{ employer_id: string }>)[0];
      if (mine) {
        if (mine.employer_id === inv.employer_id) return reply({ ok: true, companyName: inv.employers?.company_name ?? "", role: inv.role });
        return reply({ error: INVITE_ACCEPT_MESSAGE.already_member, code: "already_member" }, 409);
      }
    }
    // A solo company created before member rows existed counts as membership too.
    const own = await fetch(`${SUPABASE_URL}/rest/v1/employers?id=eq.${encodeURIComponent(userId)}&select=id&limit=1`, { headers: serviceHeaders() });
    if (own.ok && ((await own.json().catch(() => [])) as unknown[]).length > 0) {
      return reply({ error: INVITE_ACCEPT_MESSAGE.already_member, code: "already_member" }, 409);
    }

    if (inv.employers?.suspended_at) {
      return reply({ error: "This company's account is suspended, so it can't add people right now.", code: "suspended" }, 403);
    }
    // Invites count as seats when sent, so this only trips when two invites raced past the cap
    // or the team was already over it. Checked before the claim so the invite isn't burned.
    const seats = await fetch(`${SUPABASE_URL}/rest/v1/employer_members?employer_id=eq.${encodeURIComponent(inv.employer_id)}&select=user_id`, { headers: serviceHeaders() });
    if (seats.ok && ((await seats.json().catch(() => [])) as unknown[]).length >= MAX_TEAM_SIZE) {
      return reply({ error: `This team already has ${MAX_TEAM_SIZE} people. Ask an admin to free up a seat, then try again.`, code: "team_full" }, 409);
    }

    // Atomic claim: only one concurrent accept can flip accepted_at from null.
    const claim = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_invites?id=eq.${inv.id}&accepted_at=is.null&revoked_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`,
      { method: "PATCH", headers: jsonHeaders(), body: JSON.stringify({ accepted_at: new Date().toISOString(), accepted_by: userId }) },
    );
    if (!claim.ok) throw new Error(`invite claim failed: ${claim.status}`);
    if (((await claim.json().catch(() => [])) as unknown[]).length === 0) {
      return reply({ error: INVITE_ACCEPT_MESSAGE.used, code: "used" }, 409);
    }

    const ins = await fetch(`${SUPABASE_URL}/rest/v1/employer_members`, {
      method: "POST",
      headers: { ...jsonHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({
        employer_id: inv.employer_id, user_id: userId, role: inv.role, email: user.email ?? inv.email,
        name: user.name, invited_by: inv.invited_by, last_active_at: new Date().toISOString(),
      }),
    });
    if (!ins.ok) {
      // Un-claim so the invite isn't burned by a failed join (e.g. a concurrent join elsewhere).
      await fetch(`${SUPABASE_URL}/rest/v1/employer_invites?id=eq.${inv.id}`, {
        method: "PATCH", headers: { ...jsonHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ accepted_at: null, accepted_by: null }),
      }).catch(() => {});
      if (ins.status === 409) return reply({ error: INVITE_ACCEPT_MESSAGE.already_member, code: "already_member" }, 409);
      throw new Error(`member insert failed: ${ins.status}`);
    }

    await writeAuditLog(SUPABASE_URL, serviceHeaders(), {
      employerId: inv.employer_id, actorUserId: userId, actorEmail: user.email, action: "member.joined",
      entityType: "member", entityId: userId, meta: { role: inv.role, inviteId: inv.id },
    });
    if (inv.invited_by) {
      await notify({
        userId: inv.invited_by,
        type: "team_invite_accepted",
        title: `${user.name || user.email || inv.email} joined your team`,
        body: `They accepted your invite as ${ROLE_LABEL[inv.role]}.`,
        link: "/employer/team",
      });
    }
    return reply({ ok: true, companyName: inv.employers?.company_name ?? "", role: inv.role });
  } catch (err) {
    slog.error("employer-team-accept threw", { code: "employer_team_accept_error", error: String(err).slice(0, 200), userId });
    return reply({ error: "Something went wrong. Please try again." }, 500);
  }
}
