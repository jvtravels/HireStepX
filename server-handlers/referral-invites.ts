/* Vercel Edge Function — Per-invite list for the signed-in referrer.
   GET only. Joins referrals → profiles via the service role (RLS bypassed)
   to surface the referred user's display name without exposing other
   profile fields to the referrer. Email is intentionally excluded. */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, withRequestId } from "./_shared";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

interface ReferralRow {
  id: string;
  referred_id: string | null;
  referred_email: string | null;
  status: "pending" | "redeemed" | "rewarded";
  created_at: string;
}

interface ProfileRow {
  id: string;
  name: string | null;
}

export interface ReferralInvite {
  id: string;
  name: string;
  status: "pending" | "redeemed" | "rewarded";
  createdAt: string;
}

export default async function handler(req: Request): Promise<Response> {
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "referral-invites",
    ipLimit: 30,
    userLimit: 15,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;

  const responseHeaders = withRequestId(headers);
  if (!auth.userId) {
    return new Response(JSON.stringify({ invites: [] }), { status: 200, headers: responseHeaders });
  }

  const dbHeaders = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    const refRes = await fetch(
      `${SUPABASE_URL}/rest/v1/referrals?referrer_id=eq.${encodeURIComponent(auth.userId)}&select=id,referred_id,referred_email,status,created_at&order=created_at.desc&limit=50`,
      { headers: dbHeaders },
    );
    if (!refRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to load referrals" }), { status: 500, headers: responseHeaders });
    }
    const referrals = (await refRes.json()) as ReferralRow[];
    if (!Array.isArray(referrals) || referrals.length === 0) {
      return new Response(JSON.stringify({ invites: [] }), { status: 200, headers: responseHeaders });
    }

    const referredIds = referrals.map(r => r.referred_id).filter((v): v is string => Boolean(v));
    let profilesById = new Map<string, ProfileRow>();
    if (referredIds.length > 0) {
      const idList = referredIds.map(encodeURIComponent).join(",");
      const profRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=in.(${idList})&select=id,name`,
        { headers: dbHeaders },
      );
      if (profRes.ok) {
        const profiles = (await profRes.json()) as ProfileRow[];
        profilesById = new Map(profiles.map(p => [p.id, p]));
      }
    }

    const invites: ReferralInvite[] = referrals.map(r => {
      const profile = r.referred_id ? profilesById.get(r.referred_id) : undefined;
      return {
        id: r.id,
        name: profile?.name?.trim() || "Invited User",
        status: r.status,
        createdAt: r.created_at,
      };
    });

    return new Response(JSON.stringify({ invites }), { status: 200, headers: responseHeaders });
  } catch {
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: responseHeaders });
  }
}
