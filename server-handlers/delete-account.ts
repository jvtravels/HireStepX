/* Vercel Serverless Function — Delete User Account & Data */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  withNodeAuthAndRateLimit,
  supabaseUrl,
  supabaseAnonKey,
  escapeHtml,
  slog,
} from "./_shared";
import { captureServerEvent } from "./_posthog";
import { emailShell, title, para, link, dataCard, graveEyebrow } from "./_email-theme";
import {
  CHAT_ATTACHMENT_BUCKET,
  EMPLOYER_LOGO_BUCKET,
  anonymisedAuthEmail,
  anonymisedEmployerPatch,
  deleteSucceeded,
  extractAttachmentPaths,
  mustRetainEmployerFinancials,
} from "./_delete-account-helpers";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("X-Request-ID", crypto.randomUUID());

  const pre = await withNodeAuthAndRateLimit(req, res, {
    endpoint: "delete-account",
    ipLimit: 5,
    maxBytes: 1048576,
  });
  if (pre.handled) return;
  let { userEmail } = pre;
  const { userId, userData } = pre;

  const SUPABASE_URL = supabaseUrl();
  const SUPABASE_ANON_KEY = supabaseAnonKey();
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  // OAuth-only accounts (Google) have no app password to verify — we
  // skip the re-auth gate for them. Bearer alone is what they had in
  // the first place (Supabase Auth never stored a hash we could check).
  const provider = (userData as { app_metadata?: { provider?: unknown; providers?: unknown } })?.app_metadata?.provider;
  const providers = (userData as { app_metadata?: { providers?: unknown } })?.app_metadata?.providers;
  const isOAuthOnly =
    (provider === "google" && (!Array.isArray(providers) || !providers.includes("email"))) ||
    (Array.isArray(providers) && providers.includes("google") && !providers.includes("email"));

  // Default: soft-delete with 7-day grace period. Pass { hard: true } to permanently delete immediately.
  const hardDelete = req.body && typeof req.body === "object" && "hard" in req.body ? !!(req.body as Record<string, unknown>).hard : false;
  const restore = req.body && typeof req.body === "object" && "restore" in req.body ? !!(req.body as Record<string, unknown>).restore : false;
  const reauthPassword = req.body && typeof req.body === "object" && "password" in req.body && typeof (req.body as Record<string, unknown>).password === "string"
    ? ((req.body as Record<string, unknown>).password as string)
    : "";

  // Re-auth gate: destructive paths (soft-delete + hard-delete) require
  // the user to re-enter their password. Defends against session-token
  // theft (extension malware, leaked localStorage, shared computer)
  // where the attacker has the bearer but not the password. Restore is
  // non-destructive (just clears deleted_at) and is exempt.
  // OAuth-only users have no password to verify, so we let them through
  // on bearer-only — they were authenticated via Google's flow anyway,
  // not a password we could re-check.
  if (!restore && !isOAuthOnly) {
    if (!reauthPassword) {
      return res.status(403).json({ error: "Password required to delete account.", code: "reauth_required" });
    }
    if (!userEmail) {
      return res.status(403).json({ error: "Cannot verify password without account email.", code: "reauth_failed" });
    }
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 5000);
      // Supabase password grant — succeeds (200) iff password matches.
      // We don't keep the returned session; this is verification only.
      const reauthRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: userEmail, password: reauthPassword }),
        signal: ac.signal,
      });
      clearTimeout(t);
      if (!reauthRes.ok) {
        return res.status(403).json({ error: "Incorrect password.", code: "reauth_failed" });
      }
    } catch (reauthErr) {
      if (reauthErr instanceof Error && reauthErr.name === "AbortError") {
        return res.status(504).json({ error: "Password verification timed out." });
      }
      return res.status(503).json({ error: "Password verification unavailable." });
    }
  }

  try {
    const headers = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };
    const encodedId = encodeURIComponent(userId);

    // Restore path: clear deleted_at on the profile
    if (restore) {
      try {
        const restoreRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodedId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ deleted_at: null }),
        });
        if (!restoreRes.ok) return res.status(500).json({ error: "Failed to restore account" });
        return res.status(200).json({ success: true, restored: true });
      } catch (err) {
        slog.error("delete-account: restore failed", { error: err instanceof Error ? err.message : String(err) });
        return res.status(500).json({ error: "Failed to restore account" });
      }
    }

    // Soft-delete path: mark profile with deleted_at (scheduled for permanent removal in 7 days)
    if (!hardDelete) {
      try {
        const softRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodedId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ deleted_at: new Date().toISOString() }),
        });
        if (!softRes.ok) {
          // If column is missing, fall through to hard delete
          const msg = await softRes.text().catch(() => "");
          if (msg.includes("deleted_at")) {
            console.warn("[delete-account] deleted_at column missing, falling back to hard delete");
          } else {
            return res.status(500).json({ error: "Failed to schedule account deletion" });
          }
        } else {
          const deletionDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          return res.status(200).json({
            success: true,
            scheduled: true,
            deletionDate: deletionDate.toISOString(),
            message: `Your account is scheduled for deletion on ${deletionDate.toDateString()}. Log in any time before then to cancel.`,
          });
        }
      } catch (err) {
        slog.error("delete-account: soft-delete failed", { error: err instanceof Error ? err.message : String(err) });
        // Fall through to hard delete
      }
    }

    // Capture user email & name BEFORE deletion (data will be gone after).
    // userEmail is already set from the auth token above; the profiles fetch
    // may provide a more complete address or add userName. Fall back to auth
    // email if the profiles read fails or returns nothing.
    let userName: string | undefined;
    try {
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodedId}&select=email,name`,
        { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
      );
      if (profileRes.ok) {
        const profiles = await profileRes.json();
        const profile = Array.isArray(profiles) && profiles[0];
        userEmail = profile?.email ?? userEmail;
        userName = profile?.name;
      }
    } catch {
      // Non-critical — email won't be sent but deletion continues
    }

    // Send deletion confirmation email BEFORE data is removed (best-effort)
    if (RESEND_API_KEY && userEmail) {
      const safeName = escapeHtml(userName || "there");
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [userEmail],
            subject: "Your account has been deleted",
            html: emailShell({
              preview: "Your data is gone. Here's exactly what was removed.",
              body:
                graveEyebrow("Permanent &middot; Irreversible") +
                title("Deleted, as requested.") +
                para(`Hi ${safeName}, your HireStepX account and all associated data have been permanently deleted. This can't be undone, and we keep no backup of your sessions or reports.`) +
                dataCard("Removed", [
                  ["Profile & login", "Deleted"],
                  ["Sessions & evaluations", "Deleted"],
                  ["Payment & subscription", "Deleted"],
                ]) +
                para(`Thank you for giving HireStepX a try. If you ever want to come back, you can start fresh anytime at ${link(APP_URL.replace(/^https?:\/\//, ""), APP_URL)}.`, { muted: true }) +
                para(`Didn't expect this? Contact us at ${link("support@hirestepx.com", "mailto:support@hirestepx.com")} immediately so we can investigate.`, { small: true, muted: true }),
            }),
          }),
        });
      } catch (emailErr) {
        console.warn("[delete-account] Confirmation email failed (non-critical):", emailErr);
      }
    }

    // service_usage.user_id is declared `on delete set null` in
    // supabase-schema.sql, but the live constraint predates that and still
    // blocks deletion (23503 on profiles via service_usage_user_id_fkey).
    // Null it out explicitly, and sequentially before the parallel batch
    // below — racing it alongside the profiles delete would still hit the
    // same violation if profiles wins the race.
    const clearUsageRes = await fetch(`${SUPABASE_URL}/rest/v1/service_usage?user_id=eq.${encodedId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ user_id: null }),
    });
    if (!clearUsageRes.ok) {
      const txt = await clearUsageRes.text().catch(() => "");
      return res.status(500).json({ error: `Failed to clear service_usage references: HTTP ${clearUsageRes.status}: ${txt.slice(0, 200)}` });
    }

    // Employer-feature data. An employer row cascades (via auth.users) into the
    // unlock payment/order ledger, which must be RETAINED for tax records — so an
    // employer with any financial rows is anonymised + deactivated instead of
    // having its auth user deleted. See _delete-account-helpers.ts for the FK map.
    async function readRows(r: Response): Promise<unknown[]> {
      try { const j = await r.json(); return Array.isArray(j) ? j : []; } catch { return []; }
    }
    let retainEmployer = false;
    try {
      const empRes = await fetch(`${SUPABASE_URL}/rest/v1/employers?id=eq.${encodedId}&select=id,logo_path&limit=1`, { headers });
      if (!empRes.ok) throw new Error(`employers lookup HTTP ${empRes.status}`);
      const empRows = (await readRows(empRes)) as Array<{ id?: string; logo_path?: string | null }>;
      if (empRows[0]?.id) {
        const countRows = async (table: string): Promise<number> => {
          const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?employer_id=eq.${encodedId}&select=id&limit=1`, { headers });
          // employer_unlock_orders only exists once migration 0032 has run.
          if (r.status === 404 && table === "employer_unlock_orders") return 0;
          if (!r.ok) throw new Error(`${table} lookup HTTP ${r.status}`);
          return (await readRows(r)).length;
        };
        const [payments, orders] = await Promise.all([countRows("employer_unlock_payments"), countRows("employer_unlock_orders")]);
        retainEmployer = mustRetainEmployerFinancials({ payments, orders });
        if (retainEmployer) {
          const patchEmp = await fetch(`${SUPABASE_URL}/rest/v1/employers?id=eq.${encodedId}`, {
            method: "PATCH", headers, body: JSON.stringify(anonymisedEmployerPatch(new Date().toISOString())),
          });
          const delReqs = await fetch(`${SUPABASE_URL}/rest/v1/employer_requirements?employer_id=eq.${encodedId}`, { method: "DELETE", headers });
          if (!patchEmp.ok || !delReqs.ok) throw new Error("employer anonymisation failed");
          if (empRows[0].logo_path) {
            await fetch(`${SUPABASE_URL}/storage/v1/object/${EMPLOYER_LOGO_BUCKET}/${empRows[0].logo_path.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE", headers }).catch(() => null);
          }
        }
      }
    } catch (empErr) {
      slog.error("delete-account: employer data handling failed", { error: empErr instanceof Error ? empErr.message : String(empErr) });
      return res.status(500).json({ error: "Failed to process employer data. Account not deleted. Please try again or contact support." });
    }

    // Chat attachments live in Storage, which no FK cascade reaches. Best-effort:
    // an orphaned object must never block the erasure itself. Must run BEFORE the
    // message rows (our only pointer to the paths) are deleted.
    try {
      const attRes = await fetch(
        `${SUPABASE_URL}/rest/v1/conversation_messages?or=(candidate_user_id.eq.${encodedId},employer_id.eq.${encodedId})&attachment_path=not.is.null&select=attachment_path&limit=1000`,
        { headers },
      );
      if (attRes.ok) {
        const paths = extractAttachmentPaths(await readRows(attRes));
        if (paths.length > 0) {
          await fetch(`${SUPABASE_URL}/storage/v1/object/${CHAT_ATTACHMENT_BUCKET}`, {
            method: "DELETE", headers, body: JSON.stringify({ prefixes: paths }),
          });
        }
      }
    } catch (attErr) {
      slog.warn("delete-account: chat attachment cleanup failed (non-critical)", { error: attErr instanceof Error ? attErr.message : String(attErr) });
    }

    // Delete all user data in parallel with timeout (order doesn't matter — all keyed by user_id).
    // DPDP Act 2023 requires complete erasure: every table that stores PII or
    // user-generated content must be covered here. Gaps were identified in the
    // 2026-07-16 legal audit — resumes, question_feedback, credibility_disputes,
    // referrals (as referrer), report_shares, user_outcomes, llm_usage, and
    // google_calendar_sync were previously left behind on hard delete.
    // Note: resume_versions cascade-deletes with resumes (ON DELETE CASCADE in DDL).
    const ac = new AbortController();
    const acTimer = setTimeout(() => ac.abort(), 12_000);
    const results = await Promise.allSettled([
      fetch(`${SUPABASE_URL}/rest/v1/sessions?user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/calendar_events?user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/payments?user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/feedback?user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/resumes?user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/question_feedback?user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/credibility_disputes?user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/referrals?referrer_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/report_shares?user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/user_outcomes?user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/llm_usage?user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/google_calendar_sync?user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/product_ratings?user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/interview_turns?user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      // Candidate-agency / employer-feature rows. All of these also cascade from
      // profiles(id) (or auth.users for message_flags); the explicit deletes guard against live-FK drift,
      // as with service_usage above. employer_reports the user FILED are deleted with them
      // (decision: no anonymised retention — a report is the reporter's personal data).
      fetch(`${SUPABASE_URL}/rest/v1/candidate_consent_log?user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/employer_blocks?candidate_user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/employer_reports?reporter_user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/match_status_events?candidate_user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/message_flags?flagged_by=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/conversation_messages?candidate_user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/conversations?candidate_user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/requirement_matches?candidate_user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
    ]);
    clearTimeout(acTimer);

    const tableNames = [
      "sessions", "calendar_events", "payments", "feedback",
      "resumes", "question_feedback", "credibility_disputes",
      "referrals", "report_shares", "user_outcomes", "llm_usage",
      "google_calendar_sync", "product_ratings", "interview_turns",
      "candidate_consent_log", "employer_blocks", "employer_reports", "match_status_events",
      "message_flags", "conversation_messages", "conversations", "requirement_matches", "profiles",
    ];
    const failures = results
      .map((r, i) => (r.status === "rejected" || (r.status === "fulfilled" && !deleteSucceeded(tableNames[i], r.value.status, r.value.ok))) ? tableNames[i] : null)
      .filter(Boolean);

    if (failures.length > 0) {
      // Hash the user id so logs don't enable user enumeration
      const userHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId))
        .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 12))
        .catch(() => "unknown");
      slog.error("delete-account: partial delete failure", { failures: failures.join(", "), userHash });
      return res.status(500).json({ error: `Failed to delete data from: ${failures.join(", ")}. Account not deleted. Please try again or contact support.` });
    }

    if (retainEmployer) {
      // Deactivate instead of delete: deleting the auth user would cascade into
      // employers -> employer_unlock_payments / employer_unlock_orders.
      const deactivateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodedId}`, {
        method: "PUT",
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: anonymisedAuthEmail(userId), email_confirm: true, phone: "", user_metadata: {}, ban_duration: "876000h" }),
      }).catch(() => null);
      if (!deactivateRes || !deactivateRes.ok) {
        slog.error("delete-account: employer auth deactivation failed", { statusCode: deactivateRes?.status ?? 0 });
        return res.status(207).json({ success: true, partial: true, retainedFinancialRecords: true, warning: "Account data deleted but login deactivation incomplete. Please contact support." });
      }
      await captureServerEvent("account_deleted", userId, { mode: "hard", retainedFinancialRecords: true });
      return res.status(200).json({ success: true, retainedFinancialRecords: true });
    }

    // Delete the auth user (requires admin/service role)
    const authDeleteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodedId}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!authDeleteRes.ok) {
      const statusCode = authDeleteRes.status;
      slog.error("delete-account: auth user delete failed", { statusCode });
      // Data already deleted but auth record remains — report partial failure
      return res.status(207).json({ success: true, partial: true, warning: "Account data deleted but auth cleanup incomplete. You can still sign up again with the same email." });
    }

    await captureServerEvent("account_deleted", userId, { mode: "hard" });

    return res.status(200).json({ success: true });
  } catch (err) {
    slog.error("delete-account: delete account error", { error: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({ error: "Failed to delete account" });
  }
}
