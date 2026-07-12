/* Vercel Serverless Function — Delete User Account & Data */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  applyCorsHeaders,
  handlePreflightAndMethod,
  supabaseUrl,
  supabaseAnonKey,
  escapeHtml,
  isRateLimited,
  getVercelClientIp,
} from "./_shared";
import { captureServerEvent } from "./_posthog";
import { emailShell, title, para, link, dataCard, graveEyebrow } from "./_email-theme";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = applyCorsHeaders(req, res);
  res.setHeader("X-Request-ID", crypto.randomUUID());

  if (handlePreflightAndMethod(req, res)) return;

  // Body size check
  const bodyContentLength = parseInt((req.headers["content-length"] as string) || "0", 10);
  if (bodyContentLength > 1048576) {
    return res.status(413).json({ error: "Request too large" });
  }

  // CSRF: validate Origin header
  if (!origin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Rate limiting
  const ip = getVercelClientIp(req);
  if (await isRateLimited(ip, "delete-account", 5, 60_000)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests. Please try again shortly.", retryAfter: 60 });
  }

  const SUPABASE_URL = supabaseUrl();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  // Verify user auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const SUPABASE_ANON_KEY = supabaseAnonKey();
  const token = authHeader.slice(7);
  let userId: string;
  let userEmail: string | undefined;
  // OAuth-only accounts (Google) have no app password to verify — we
  // skip the re-auth gate for them. Bearer alone is what they had in
  // the first place (Supabase Auth never stored a hash we could check).
  let isOAuthOnly = false;
  try {
    const authAc = new AbortController();
    const authTimer = setTimeout(() => authAc.abort(), 5000);
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      signal: authAc.signal,
    });
    clearTimeout(authTimer);
    if (!userRes.ok) return res.status(401).json({ error: "Invalid auth token" });
    const userData = await userRes.json();
    userId = userData.id;
    userEmail = typeof userData.email === "string" ? userData.email : undefined;
    const provider = userData?.app_metadata?.provider;
    const providers: unknown = userData?.app_metadata?.providers;
    isOAuthOnly =
      (provider === "google" && (!Array.isArray(providers) || !providers.includes("email"))) ||
      (Array.isArray(providers) && providers.includes("google") && !providers.includes("email"));
  } catch (authErr) {
    if (authErr instanceof Error && authErr.name === "AbortError") {
      return res.status(504).json({ error: "Auth verification timed out" });
    }
    return res.status(401).json({ error: "Auth verification failed" });
  }

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
        console.error("[delete-account] Restore failed:", err);
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
        console.error("[delete-account] Soft-delete failed:", err);
        // Fall through to hard delete
      }
    }

    // Capture user email & name BEFORE deletion (data will be gone after)
    let userEmail: string | undefined;
    let userName: string | undefined;
    try {
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodedId}&select=email,name`,
        { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
      );
      if (profileRes.ok) {
        const profiles = await profileRes.json();
        const profile = Array.isArray(profiles) && profiles[0];
        userEmail = profile?.email;
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

    // Delete all user data in parallel with timeout (order doesn't matter — all keyed by user_id)
    const ac = new AbortController();
    const acTimer = setTimeout(() => ac.abort(), 8_000);
    const results = await Promise.allSettled([
      fetch(`${SUPABASE_URL}/rest/v1/sessions?user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/calendar_events?user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/payments?user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/feedback?user_id=eq.${encodedId}`, { method: "DELETE", headers, signal: ac.signal }),
    ]);
    clearTimeout(acTimer);

    const tableNames = ["sessions", "events", "payments", "profile", "feedback"];
    const failures = results
      .map((r, i) => (r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)) ? tableNames[i] : null)
      .filter(Boolean);

    if (failures.length > 0) {
      // Hash the user id so logs don't enable user enumeration
      const userHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId))
        .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 12))
        .catch(() => "unknown");
      console.error("Partial delete failure:", failures.join(", "), "for user hash", userHash);
      return res.status(500).json({ error: `Failed to delete data from: ${failures.join(", ")}. Account not deleted. Please try again or contact support.` });
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
      console.error("Auth user delete failed:", statusCode);
      // Data already deleted but auth record remains — report partial failure
      return res.status(207).json({ success: true, partial: true, warning: "Account data deleted but auth cleanup incomplete. You can still sign up again with the same email." });
    }

    await captureServerEvent("account_deleted", userId, { mode: "hard" });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Delete account error:", err);
    return res.status(500).json({ error: "Failed to delete account" });
  }
}
