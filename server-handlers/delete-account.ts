/* Vercel Serverless Function — Delete User Account & Data */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  withNodeAuthAndRateLimit,
  supabaseUrl,
  supabaseAnonKey,
  slog,
  isRateLimited,
} from "./_shared";
import { captureServerEvent } from "./_posthog";
import { eraseUserData, posthogConfigFromEnv, pseudonymousId, sha256Hex } from "./_erase-user";
import { sendErasureEmail } from "./_erase-user-email";
import { RESTORE_EMPLOYER_FILTER, deletionPendingPatch, restoreEmployerPatch } from "./_delete-account-helpers";

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
  const { userId, userData, userEmail } = pre;
  if (await isRateLimited(userId, "delete-account-user", 3, 60_000)) {
    return res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
  }

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
        // Lift only the block the soft delete placed on an employer row; an admin or
        // report-threshold suspension carries a different reason and stays in force.
        const unblock = await fetch(`${SUPABASE_URL}/rest/v1/employers?id=eq.${encodedId}&${RESTORE_EMPLOYER_FILTER}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(restoreEmployerPatch()),
        });
        if (!unblock.ok) {
          // Leaving an employer blocked after a "successful" restore would strand them; surface it.
          slog.error("delete-account: employer unblock failed on restore", { code: "delete_account_employer_unblock_failed", httpStatus: unblock.status });
          return res.status(500).json({ error: "Failed to restore account" });
        }
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
        // Every failure here returns 500: falling through to the irreversible erasure below
        // would turn a transient error into permanent data loss the user never confirmed
        // (they asked for the 7-day grace period). Hard erase only runs for { hard: true }.
        if (!softRes.ok) {
          return res.status(500).json({ error: "Failed to schedule account deletion" });
        }
        // An employer must stop being live NOW, not in 7 days: block them through the
        // suspension gate every employer handler already enforces. No-op for candidates
        // (no employers row) and for an already-suspended employer.
        const block = await fetch(`${SUPABASE_URL}/rest/v1/employers?id=eq.${encodedId}&suspended_at=is.null`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(deletionPendingPatch(new Date().toISOString())),
        });
        if (!block.ok) {
          slog.error("delete-account: employer block failed on soft delete", { code: "delete_account_employer_block_failed", httpStatus: block.status });
          await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodedId}`, {
            method: "PATCH", headers, body: JSON.stringify({ deleted_at: null }),
          }).catch(() => null);
          return res.status(500).json({ error: "Failed to schedule account deletion" });
        }
        // Stop employer matching right away (belt and braces with the deleted_at filter in
        // matching). Separate best-effort call: the column ships in a later migration than
        // deleted_at, and a missing column must not block the deletion itself. Restore does
        // not flip it back, so a restored candidate re-enables visibility in Settings.
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodedId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ employer_visibility: "off", employer_visibility_updated_at: new Date().toISOString() }),
        }).then((r) => {
          if (!r.ok) slog.warn("delete-account: could not switch employer visibility off", { httpStatus: r.status });
        }).catch(() => null);
        const deletionDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        return res.status(200).json({
          success: true,
          scheduled: true,
          deletionDate: deletionDate.toISOString(),
          message: `Your account is scheduled for deletion on ${deletionDate.toDateString()}. Log in any time before then to cancel.`,
        });
      } catch (err) {
        slog.error("delete-account: soft-delete failed", { error: err instanceof Error ? err.message : String(err) });
        return res.status(500).json({ error: "Failed to schedule account deletion" });
      }
    }

    // Immediate ("hard") erasure goes through the same routine as the 7-day cron.
    const result = await eraseUserData(
      {
        fetchImpl: fetch,
        supabaseUrl: SUPABASE_URL,
        serviceKey: SUPABASE_SERVICE_ROLE_KEY,
        trigger: "user_hard",
        contact: { email: userEmail },
        posthog: posthogConfigFromEnv(process.env),
        notify: (contact) => sendErasureEmail(fetch, { resendApiKey: RESEND_API_KEY, fromEmail: FROM_EMAIL, appUrl: APP_URL }, contact),
        log: (msg, fields) => slog.info(msg, fields),
      },
      userId,
    );

    if (!result.ok) {
      const userHash = (await sha256Hex(userId).catch(() => "unknown")).slice(0, 12);
      slog.error("delete-account: erasure incomplete", { failures: result.failedSteps.join(", "), userHash });
      // Hand the leftovers to the cron: it only picks up soft-deleted profiles, and every
      // step is idempotent, so the next run finishes the job.
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodedId}&deleted_at=is.null`, {
        method: "PATCH", headers, body: JSON.stringify({ deleted_at: new Date().toISOString() }),
      }).catch(() => null);

      if (result.failedSteps.length === 1 && result.failedSteps[0] === "auth") {
        // Data is gone; only the login record remains. Same 207 contract as before.
        const warning = result.retainedFinancialRecords
          ? "Account data deleted but login deactivation incomplete. Please contact support."
          : "Account data deleted but auth cleanup incomplete. You can still sign up again with the same email.";
        return res.status(207).json({ success: true, partial: true, ...(result.retainedFinancialRecords ? { retainedFinancialRecords: true } : {}), warning });
      }
      return res.status(500).json({
        error: `Failed to delete data from: ${result.failedSteps.join(", ")}. Account not deleted. We will retry automatically; contact support if this persists.`,
      });
    }

    await captureServerEvent("account_deleted", await pseudonymousId(userId), {
      mode: "hard",
      ...(result.retainedFinancialRecords ? { retainedFinancialRecords: true } : {}),
      $process_person_profile: false,
    });

    return res.status(200).json(result.retainedFinancialRecords ? { success: true, retainedFinancialRecords: true } : { success: true });
  } catch (err) {
    slog.error("delete-account: delete account error", { error: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({ error: "Failed to delete account" });
  }
}
