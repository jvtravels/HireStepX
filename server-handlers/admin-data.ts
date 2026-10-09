/* Admin Dashboard API — returns aggregated metrics for the admin panel.
 * Security: timing-safe password comparison, rate limiting, session tokens with expiry. */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAuth, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ValidationError, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RESEND_API_KEY, fetchJSON } from "./_admin-shared";
import { getOverview, getUsers, getUserDetail, getSessionDetail, getSessions, getFeedback, getCalendar, getOutcomes } from "./_admin-activity";
import { getFinancials, getLLMUsage, getCostData, saveCostReconciliation } from "./_admin-financials";
import { getSupportMessages, getMessaging, reviewMessageFlag, getReferrals, getEmployers, getPromoCodes, updateSupportStatus } from "./_admin-community";
import { getHealthAlerts } from "./_health-alerts";
import { listUnlockRequirements, getUnlockMatches, adminUnlockCandidates } from "./_admin-unlock";
import { razorpayBasicAuth } from "./_razorpay-auth";
import { createAdminToken } from "./_admin-auth";
import { slog } from "./_shared";


/* ─── Handler ─── */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Scoped to the admin dashboard's own origin — mirrors admin-login.ts,
  // which is the only other place this endpoint's credentials are usable from.
  res.setHeader("Access-Control-Allow-Origin", "https://admin.hirestepx.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token, x-admin-key");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") return res.status(204).end();

  const auth = await verifyAuth(req);
  if (!auth.ok) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  const body = req.body as { section?: string; action?: string; search?: string; offset?: number; userId?: string; sessionId?: string; id?: string; status?: string; tier?: string; days?: number; qty?: number; note?: string; paymentId?: string; amountPaise?: number; subject?: string; htmlBody?: string; month?: string; actualInvoiceInr?: number; flagId?: string; flagStatus?: string; requirementId?: string; matchIds?: string[] } | undefined;
  const section = body?.section || body?.action || "overview";

  try {
    const data = await (async () => {
      switch (section) {
        case "overview": return getOverview();
        case "users": return getUsers(body?.search, body?.offset);
        case "user-detail":
          if (!body?.userId) throw new ValidationError("userId required");
          return getUserDetail(body.userId);
        case "session-detail":
          if (!body?.sessionId) throw new ValidationError("sessionId required");
          return getSessionDetail(body.sessionId);
        case "financials": return getFinancials();
        case "llm": return getLLMUsage();
        case "sessions": return getSessions();
        case "feedback": return getFeedback();
        case "support-messages": return getSupportMessages();
        case "messaging": return getMessaging();
        case "review-message-flag": {
          if (!body?.flagId) throw new ValidationError("flagId required");
          const s = body.flagStatus;
          if (s !== "reviewed" && s !== "dismissed") throw new ValidationError("flagStatus must be reviewed | dismissed");
          return reviewMessageFlag(body.flagId, s);
        }
        case "referrals": return getReferrals();
        case "employers": return getEmployers();
        case "unlock-requirements": return listUnlockRequirements(body?.search);
        case "unlock-matches": return getUnlockMatches(String(body?.requirementId ?? ""));
        case "admin-unlock-candidates": return adminUnlockCandidates({ requirementId: body?.requirementId, matchIds: body?.matchIds, note: body?.note });
        case "promo-codes": return getPromoCodes();
        case "calendar": return getCalendar();
        case "outcomes": return getOutcomes();
        case "costs": return getCostData();
        case "health": return getHealthAlerts();
        case "save-cost-reconciliation": {
          if (!body?.month || !/^\d{4}-\d{2}$/.test(body.month)) throw new ValidationError("month required, format YYYY-MM");
          const actualInvoiceInr = Number(body.actualInvoiceInr);
          if (!Number.isFinite(actualInvoiceInr) || actualInvoiceInr < 0) throw new ValidationError("actualInvoiceInr must be a non-negative number");
          const row = await saveCostReconciliation(body.month, actualInvoiceInr, body.note);
          return { ok: true, reconciliation: row };
        }
        case "update-support-status": {
          if (!body?.id) throw new ValidationError("id required");
          const s = body.status;
          if (s !== "new" && s !== "seen" && s !== "resolved") throw new ValidationError("status must be new | seen | resolved");
          return updateSupportStatus(body.id, s);
        }
        case "extend-subscription": {
          if (!body?.userId) throw new ValidationError("userId required");
          const tier = body.tier as string | undefined;
          const days = Number(body.days ?? 30);
          if (!tier || !["free", "starter"].includes(tier)) throw new ValidationError("tier must be free | starter");
          if (!Number.isInteger(days) || days < 1 || days > 366) throw new ValidationError("days must be 1–366");
          const now = new Date();
          const newEnd = new Date(now.getTime() + days * 86400000).toISOString();
          // For starter (Sprint Pack): the session limit counts sessions since subscription_start,
          // NOT since subscription_end. If the user has exhausted their 5 sessions, only resetting
          // subscription_start opens a fresh window — pushing subscription_end alone does nothing.
          const patchPayload: Record<string, string> = {
            subscription_tier: tier,
            subscription_end: newEnd,
          };
          if (tier === "starter") {
            patchPayload.subscription_start = now.toISOString();
          }
          const patchRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(body.userId)}`,
            {
              method: "PATCH",
              headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body: JSON.stringify(patchPayload),
            },
          );
          if (!patchRes.ok) {
            const body2 = await patchRes.text().catch(() => "");
            return { ok: false, error: `Supabase PATCH failed: HTTP ${patchRes.status}: ${body2.slice(0, 200)}` };
          }
          return { ok: true, tier, days, newEnd };
        }
        case "grant-credits": {
          if (!body?.userId) throw new ValidationError("userId required");
          const qty = Number(body.qty ?? 0);
          if (!Number.isInteger(qty) || qty < 1 || qty > 100) throw new ValidationError("qty must be 1–100");
          const note = typeof body.note === "string" ? body.note.slice(0, 200) : "admin grant";
          const rpcRes = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/grant_session_credits`,
            {
              method: "POST",
              headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ p_user_id: body.userId, p_qty: qty, p_note: note }),
            },
          );
          if (!rpcRes.ok) {
            const body2 = await rpcRes.text().catch(() => "");
            return { ok: false, error: `RPC failed: HTTP ${rpcRes.status}: ${body2.slice(0, 200)}` };
          }
          const newBalance = await rpcRes.json().catch(() => null);
          return { ok: true, qty, note, newBalance: typeof newBalance === "number" ? newBalance : null };
        }
        case "ban-user": {
          if (!body?.userId) throw new ValidationError("userId required");
          const banRes = await fetch(
            `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(body.userId)}`,
            {
              method: "PUT",
              headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ ban_duration: "876000h" }),
            },
          );
          if (!banRes.ok) return { ok: false, error: `Auth ban failed: HTTP ${banRes.status}` };
          return { ok: true };
        }
        case "unban-user": {
          if (!body?.userId) throw new ValidationError("userId required");
          const unbanRes = await fetch(
            `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(body.userId)}`,
            {
              method: "PUT",
              headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ ban_duration: "none" }),
            },
          );
          if (!unbanRes.ok) return { ok: false, error: `Auth unban failed: HTTP ${unbanRes.status}` };
          return { ok: true };
        }
        case "delete-user": {
          if (!body?.userId) throw new ValidationError("userId required");
          const encoded2 = encodeURIComponent(body.userId);
          // service_usage.user_id is declared `on delete set null` in
          // supabase-schema.sql, but the live constraint predates that and
          // still blocks the cascade (23503 on profiles via
          // service_usage_user_id_fkey). Null it out explicitly first so the
          // auth-user delete below can cascade through profiles regardless
          // of which constraint version is actually deployed.
          const clearUsageRes = await fetch(
            `${SUPABASE_URL}/rest/v1/service_usage?user_id=eq.${encoded2}`,
            {
              method: "PATCH",
              headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body: JSON.stringify({ user_id: null }),
            },
          );
          if (!clearUsageRes.ok) {
            const txt = await clearUsageRes.text().catch(() => "");
            return { ok: false, error: `Failed to clear service_usage references: HTTP ${clearUsageRes.status}: ${txt.slice(0, 200)}` };
          }
          // Hard-delete auth user; FK cascades delete sessions, payments, etc.
          const delRes = await fetch(
            `${SUPABASE_URL}/auth/v1/admin/users/${encoded2}`,
            {
              method: "DELETE",
              headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            },
          );
          if (!delRes.ok) {
            const txt = await delRes.text().catch(() => "");
            return { ok: false, error: `Delete failed: HTTP ${delRes.status}: ${txt.slice(0, 200)}` };
          }
          return { ok: true };
        }
        case "refund-payment": {
          if (!body?.paymentId) throw new ValidationError("paymentId required");
          if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return { ok: false, error: "Razorpay keys not configured" };
          const amountPaise = body.amountPaise ? Number(body.amountPaise) : undefined;
          if (amountPaise !== undefined && (!Number.isInteger(amountPaise) || amountPaise < 100)) {
            throw new ValidationError("amountPaise must be an integer ≥ 100");
          }
          const rzpAuth = razorpayBasicAuth(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET);
          const refundBody: Record<string, unknown> = {};
          if (amountPaise) refundBody.amount = amountPaise;
          const rzpRes = await fetch(
            `https://api.razorpay.com/v1/payments/${encodeURIComponent(String(body.paymentId))}/refund`,
            {
              method: "POST",
              headers: { Authorization: `Basic ${rzpAuth}`, "Content-Type": "application/json" },
              body: JSON.stringify(refundBody),
            },
          );
          if (!rzpRes.ok) {
            const txt = await rzpRes.text().catch(() => "");
            return { ok: false, error: `Razorpay refund failed: HTTP ${rzpRes.status}: ${txt.slice(0, 300)}` };
          }
          const refundData = await rzpRes.json() as { id?: string; amount?: number; status?: string };
          return { ok: true, refundId: refundData.id, amount: refundData.amount, status: refundData.status };
        }
        case "send-email": {
          if (!body?.userId || !body?.subject || !body?.htmlBody) throw new ValidationError("userId, subject, and htmlBody required");
          if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY not configured" };
          const subjectStr = String(body.subject).slice(0, 200);
          const htmlStr = String(body.htmlBody).slice(0, 20000);
          // Fetch user email from profiles
          const prof = await fetchJSON<{ email: string }>(`profiles?id=eq.${encodeURIComponent(body.userId)}&select=email&limit=1`);
          const toEmail = prof[0]?.email;
          if (!toEmail) return { ok: false, error: "User email not found" };
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "HireStepX <noreply@hirestepx.com>",
              to: [toEmail],
              subject: subjectStr,
              html: htmlStr,
            }),
          });
          if (!emailRes.ok) {
            const txt = await emailRes.text().catch(() => "");
            return { ok: false, error: `Resend failed: HTTP ${emailRes.status}: ${txt.slice(0, 200)}` };
          }
          const emailData = await emailRes.json() as { id?: string };
          return { ok: true, emailId: emailData.id, to: toEmail };
        }
        case "live": {
          const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
          const liveSessions = await fetchJSON<{ id: string; user_id: string; type: string; difficulty: string; score: number | null; created_at: string }>(
            `sessions?created_at=gte.${encodeURIComponent(since)}&select=id,user_id,type,difficulty,score,created_at&order=created_at.desc&limit=50`,
          );
          return { sessions: liveSessions, since };
        }
        default: throw new ValidationError(`Unknown section: ${section}`);
      }
    })();

    // Include a fresh token in every response so the client stays authenticated
    return res.status(200).json({ ...data as object, _token: createAdminToken() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch admin data";
    slog.error("admin-data: unexpected error", { error: msg });
    const status = err instanceof ValidationError ? 400 : 500;
    return res.status(status).json({ error: status === 400 ? "Bad request" : "Internal server error" });
  }
}
