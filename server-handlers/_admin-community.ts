/* Admin sections: support, messaging moderation, employers, referrals, promo codes. */

import { fetchJSON, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, fetchCount, daysAgo } from "./_admin-shared";
import { kFactor } from "./_cost-helpers";

export async function updateSupportStatus(
  id: string,
  status: "new" | "seen" | "resolved",
): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();
  // Set SLA timestamps: first_response_at on first acknowledgement, resolved_at on close.
  // We use ?id=eq.X&first_response_at=is.null so the timestamp only stamps once.
  const patch: Record<string, string | null> = { status };
  if (status === "seen") {
    // Stamp first_response_at only if not already set — done via a conditional filter below
    patch["first_response_at"] = now;
  } else if (status === "resolved") {
    patch["resolved_at"] = now;
  }

  try {
    // For seen: only set first_response_at when it is currently null (first touch)
    const filterSuffix = status === "seen" ? "&first_response_at=is.null" : "";
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/support_messages?id=eq.${encodeURIComponent(id)}${filterSuffix}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(patch),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    // If the conditional filter matched 0 rows (first_response_at already set),
    // still update status without overwriting the timestamp
    if (status === "seen") {
      await fetch(
        `${SUPABASE_URL}/rest/v1/support_messages?id=eq.${encodeURIComponent(id)}&first_response_at=not.is.null`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ status }),
        },
      ).catch(() => { /* best-effort */ });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getSupportMessages() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [messages, totalCount] = await Promise.all([
    fetchJSON<{
      id: string; user_id: string | null; email: string | null; message: string;
      page: string | null; user_agent: string | null; status: string; created_at: string;
      type: string | null; plan_tier: string | null; session_count_30d: number | null;
      first_response_at: string | null; resolved_at: string | null;
    }>("support_messages?select=id,user_id,email,message,page,user_agent,status,created_at,type,plan_tier,session_count_30d,first_response_at,resolved_at&order=created_at.desc&limit=200"),
    fetchCount("support_messages"),
  ]);

  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let totalResponseMs = 0;
  let respondedCount = 0;
  let resolvedCount = 0;
  let totalResolutionMs = 0;

  // Volume by day (last 30 days)
  const volumeByDay: Record<string, number> = {};
  const cutoff = new Date(thirtyDaysAgo);

  for (const m of messages) {
    byStatus[m.status || "new"] = (byStatus[m.status || "new"] || 0) + 1;
    const t = m.type || "other";
    byType[t] = (byType[t] || 0) + 1;

    const createdAt = new Date(m.created_at);
    if (createdAt >= cutoff) {
      const day = m.created_at.slice(0, 10);
      volumeByDay[day] = (volumeByDay[day] || 0) + 1;
    }

    if (m.first_response_at) {
      const responseMs = new Date(m.first_response_at).getTime() - new Date(m.created_at).getTime();
      if (responseMs > 0) { totalResponseMs += responseMs; respondedCount++; }
    }
    if (m.resolved_at) {
      const resMs = new Date(m.resolved_at).getTime() - new Date(m.created_at).getTime();
      if (resMs > 0) { totalResolutionMs += resMs; resolvedCount++; }
    }
  }

  const avgResponseHours = respondedCount > 0 ? Math.round((totalResponseMs / respondedCount) / 3_600_000 * 10) / 10 : null;
  const avgResolutionHours = resolvedCount > 0 ? Math.round((totalResolutionMs / resolvedCount) / 3_600_000 * 10) / 10 : null;

  return {
    total: totalCount,
    byStatus,
    byType,
    avgResponseHours,
    avgResolutionHours,
    volumeByDay,
    recent: messages.slice(0, 100),
  };
}

/* Employer<->candidate messaging monitor. Mirrors getSupportMessages()'s
   shape (stats + a capped recent list) but the "recent" list here is EVERY
   message, not just flagged ones — the product ask is full visibility into
   the chat feed, with the flag queue surfaced alongside it for triage. */
export async function getMessaging() {
  const [messages, flags, totalMessages, openFlagCount] = await Promise.all([
    fetchJSON<{
      id: string; conversation_id: string; sender_role: string; body: string;
      attachment_name: string | null; auto_flag_reason: string | null; created_at: string;
    }>("conversation_messages?select=id,conversation_id,sender_role,body,attachment_name,auto_flag_reason,created_at&order=created_at.desc&limit=200"),
    fetchJSON<{
      id: string; message_id: string; conversation_id: string; flagged_by_role: string;
      reason: string; note: string | null; status: string; created_at: string;
    }>("message_flags?select=id,message_id,conversation_id,flagged_by_role,reason,note,status,created_at&order=created_at.desc&limit=200"),
    fetchCount("conversation_messages"),
    fetchCount("message_flags", "&status=eq.open"),
  ]);

  const byRole: Record<string, number> = {};
  const volumeByDay: Record<string, number> = {};
  const cutoff = daysAgo(30);
  for (const m of messages) {
    byRole[m.sender_role] = (byRole[m.sender_role] || 0) + 1;
    if (m.created_at >= cutoff) {
      const day = m.created_at.slice(0, 10);
      volumeByDay[day] = (volumeByDay[day] || 0) + 1;
    }
  }

  return {
    totalMessages,
    openFlagCount,
    byRole,
    volumeByDay,
    recentMessages: messages.slice(0, 100),
    flags: flags.slice(0, 100),
  };
}

export async function reviewMessageFlag(id: string, status: "reviewed" | "dismissed"): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/message_flags?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status, reviewed_at: new Date().toISOString(), reviewed_by: "admin" }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/* ─── New section handlers (referrals, promo codes, calendar) ─── */

export interface ReferralRow {
  id: string;
  referrer_id: string;
  referred_id?: string;
  referred_email?: string;
  status: string;
  reward_granted_at?: string | null;
  created_at: string;
}

// A referral counts as "converted" once the reward has been paid out — i.e.
// status 'rewarded' or a non-null reward_granted_at (the CAS stamp). The legacy
// 'converted' status string never existed in this schema; the canonical values
// are pending | redeemed | rewarded.
export function isReferralConverted(r: ReferralRow): boolean {
  return r.status === "rewarded" || !!r.reward_granted_at;
}

export interface EmployerRow {
  id: string;
  company_name: string;
  website: string;
  submitted_at: string;
}

export async function getEmployers() {
  const [employers, profiles] = await Promise.all([
    fetchJSON<EmployerRow>("employers?select=id,company_name,website,submitted_at&order=submitted_at.desc&limit=1000"),
    fetchJSON<{ id: string; name: string | null; email: string }>("profiles?select=id,name,email&limit=2000"),
  ]);
  const profileMap = new Map(profiles.map((p) => [p.id, { name: p.name || "(no name)", email: p.email }]));

  const rows = employers.map((e) => ({
    id: e.id,
    companyName: e.company_name,
    website: e.website,
    submittedAt: e.submitted_at,
    contactName: profileMap.get(e.id)?.name || "(deleted user)",
    contactEmail: profileMap.get(e.id)?.email || "—",
  }));

  return {
    total: rows.length,
    rows,
  };
}

export async function getReferrals() {
  const monthAgo = daysAgo(30);
  const [allReferrals, recentProfiles] = await Promise.all([
    fetchJSON<ReferralRow>("referrals?select=id,referrer_id,referred_id,referred_email,status,reward_granted_at,created_at&order=created_at.desc&limit=500"),
    fetchJSON<{ id: string; name: string | null; email: string; practice_timestamps: string[] | null }>("profiles?select=id,name,email,practice_timestamps&limit=2000"),
  ]);
  const profileMap = new Map(recentProfiles.map((p) => [p.id, { name: p.name || "(no name)", email: p.email }]));

  const total = allReferrals.length;
  const last30d = allReferrals.filter((r) => r.created_at >= monthAgo).length;
  const converted = allReferrals.filter(isReferralConverted).length;
  const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

  // K-factor = referred signups in the last 30d / users active in the last 30d.
  // The doc's go/no-go metric for the referral loop (target > 0.3). Active =
  // practiced at least once in the window. Reads 0 cleanly when there's no
  // traffic yet (vs. a misleading Infinity).
  const now = Date.now();
  let activeLast30d = 0;
  for (const p of recentProfiles) {
    const ts = p.practice_timestamps;
    if (ts?.length && now - new Date(ts[ts.length - 1]).getTime() < 30 * 86400000) activeLast30d++;
  }
  const k = kFactor(last30d, activeLast30d);

  // Top referrers by total referrals brought in
  const referrerCounts = new Map<string, { count: number; converted: number }>();
  for (const r of allReferrals) {
    const cur = referrerCounts.get(r.referrer_id) || { count: 0, converted: 0 };
    cur.count++;
    if (isReferralConverted(r)) cur.converted++;
    referrerCounts.set(r.referrer_id, cur);
  }
  const topReferrers = Array.from(referrerCounts.entries())
    .map(([id, stats]) => ({
      id,
      name: profileMap.get(id)?.name || "(deleted user)",
      email: profileMap.get(id)?.email || "—",
      total: stats.count,
      converted: stats.converted,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  const recent = allReferrals.slice(0, 50).map((r) => ({
    id: r.id,
    referrerName: profileMap.get(r.referrer_id)?.name || "(deleted)",
    refereeEmail: r.referred_email || (r.referred_id ? (profileMap.get(r.referred_id)?.email || "—") : "—"),
    status: r.status,
    rewardGranted: !!r.reward_granted_at,
    createdAt: r.created_at,
  }));

  return { total, last30d, converted, conversionRate, kFactor: k, activeLast30d, topReferrers, recent };
}

export interface PromoRow {
  id: string;
  code: string;
  discount_pct?: number;
  discount_amount?: number;
  max_uses: number | null;
  uses: number;
  active: boolean;
  applies_to: string;
  expires_at: string | null;
  created_at: string;
}

export async function getPromoCodes() {
  const codes = await fetchJSON<PromoRow>("promo_codes?select=*&order=created_at.desc&limit=200");
  const active = codes.filter((c) => c.active && (!c.expires_at || c.expires_at > new Date().toISOString())).length;
  const expired = codes.filter((c) => c.expires_at && c.expires_at <= new Date().toISOString()).length;
  const totalUses = codes.reduce((sum, c) => sum + (c.uses || 0), 0);
  return {
    total: codes.length,
    active,
    expired,
    totalUses,
    codes: codes.map((c) => ({
      id: c.id,
      code: c.code,
      discountPct: c.discount_pct ?? null,
      discountAmount: c.discount_amount ?? null,
      maxUses: c.max_uses,
      uses: c.uses || 0,
      active: c.active,
      appliesTo: c.applies_to,
      expiresAt: c.expires_at,
      createdAt: c.created_at,
    })),
  };
}
