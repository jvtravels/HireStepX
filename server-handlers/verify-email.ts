/* Vercel Serverless Function — Email Verification Handler */
/* Validates HMAC token and sets email_confirmed_at on Supabase Auth user */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateToken as validateTokenPure } from "./_email-verify-helpers";
import { consumeToken } from "./_used-tokens";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

/* Verification-token signing secret. MUST match the secret used by
   send-welcome.ts when issuing the token — they're two halves of the
   same HMAC contract. Production requires EMAIL_VERIFICATION_SECRET
   to be set; dev/preview falls back to the service role key for
   convenience, never in production. See send-welcome.ts for the
   rationale on why we don't permanently fall back to the service
   role key (token forgery blast radius on key leak). */
const EMAIL_SECRET = (() => {
  const dedicated = (process.env.EMAIL_VERIFICATION_SECRET || "").trim();
  if (dedicated) return dedicated;
  if (process.env.VERCEL_ENV === "production") {
    console.error(
      "[CRITICAL] EMAIL_VERIFICATION_SECRET is unset in production. " +
      "Verification links will be rejected until this is configured.",
    );
    return "";
  }
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback-secret").trim();
})();

/** Validate a verification token (delegates to pure helper so the
 *  HMAC contract is unit-testable in isolation). */
function validateToken(email: string, token: string): boolean {
  return validateTokenPure(email, token, EMAIL_SECRET);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // This endpoint is GET (user clicks link in email)
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = (req.query.email as string || "").trim();
  const token = (req.query.token as string || "").trim();

  if (!email || !token) {
    return res.redirect(302, `${APP_URL}/login?error=invalid-link`);
  }

  // Validate HMAC token with expiry check
  if (!validateToken(email, token)) {
    // Distinguish expired vs invalid — check if the expiry window has passed
    const parts = token.split(".");
    const expiryStr = parts.length >= 2 ? parts[1] : null;
    if (expiryStr) {
      const expiry = parseInt(expiryStr, 10);
      const currentWindow = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
      if (!isNaN(expiry) && currentWindow - expiry > 1) {
        return res.redirect(302, `${APP_URL}/login?error=link-expired`);
      }
    }
    return res.redirect(302, `${APP_URL}/login?error=invalid-token`);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Supabase not configured for email verification");
    return res.redirect(302, `${APP_URL}/login?error=config`);
  }

  // One-shot consumption check — reject replayed tokens BEFORE we
  // touch the user record. This is the only defense against forged
  // tokens if EMAIL_VERIFICATION_SECRET ever leaks (HMAC validates,
  // but every forged token that survives this insert gets used at
  // most once). See _used-tokens.ts for full rationale.
  const consumption = await consumeToken(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    token,
    email,
  );
  if (consumption.ok && consumption.status === "already-used") {
    // Token is well-formed + unexpired but already consumed. Don't
    // distinguish "you clicked twice" from "someone replayed your
    // link" in the user-facing copy — the action to take is the
    // same (sign in, request a new link if needed). The legitimate
    // double-click case ends up here on the second click, which is
    // benign and produces a clean message.
    console.warn(`[verify-email] replay attempt for already-used token (email=${email})`);
    return res.redirect(302, `${APP_URL}/login?verified=already`);
  }
  if (!consumption.ok) {
    // Infra fault — fail CLOSED. Refusing to verify on a 5xx is
    // safer than allowing replay because the ledger is unreachable.
    // Most common cause: the schema migration hasn't run yet.
    console.error(
      `[verify-email] used-token ledger unreachable: ${consumption.status}` +
        ("message" in consumption ? ` — ${consumption.message}` : ""),
    );
    return res.redirect(302, `${APP_URL}/login?error=verification-failed`);
  }
  // consumption.status === "consumed" → first-time use, proceed.

  try {
    // Find user by email using Supabase Admin API generate_link (most reliable method)
    // This generates a magic link for the email, which implicitly finds the user
    // If user doesn't exist, it returns an error
    let user: { id: string; email?: string; email_confirmed_at?: string; user_metadata?: Record<string, unknown> } | null = null;

    // Method 1: Use admin generate_link to find user (always works if user exists)
    const genRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/generate_link`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "magiclink",
          email: email.toLowerCase().trim(),
        }),
      }
    );
    if (genRes.ok) {
      const genData = await genRes.json();
      // generate_link returns user data alongside the link
      if (genData.id) {
        user = genData;
      }
    }

    // Method 2: Fallback to filter search
    if (!user) {
      const searchRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
        {
          method: "GET",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const users = searchData.users || searchData;
        if (Array.isArray(users)) {
          user = users.find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase()) || null;
        }
      }
    }

    // Method 3: Bounded paginated search as last resort (max 3 pages of 50)
    if (!user) {
      for (let page = 1; page <= 3 && !user; page++) {
        const listRes = await fetch(
          `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=50`,
          {
            method: "GET",
            headers: {
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        );
        if (!listRes.ok) break;
        const listData = await listRes.json();
        const pageUsers = listData.users || listData;
        if (!Array.isArray(pageUsers) || pageUsers.length === 0) break;
        user = pageUsers.find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase()) || null;
      }
    }

    if (!user) {
      console.error("User not found for email:", email, "— tried all lookup methods");
      return res.redirect(302, `${APP_URL}/login?error=user-not-found`);
    }

    // If already verified via our custom flow, redirect with success (idempotent)
    if (user.user_metadata?.custom_email_verified === true) {
      return res.redirect(302, `${APP_URL}/login?verified=already`);
    }

    // Set email_confirmed_at via admin API AND our custom flag
    const updateRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${user.id}`,
      {
        method: "PUT",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_confirm: true,
          user_metadata: { ...user.user_metadata, custom_email_verified: true },
        }),
      }
    );

    if (!updateRes.ok) {
      const errBody = await updateRes.text();
      console.error("Failed to confirm email:", updateRes.status, errBody);
      return res.redirect(302, `${APP_URL}/login?error=verification-failed`);
    }

    // Redirect to login page — user must log in manually after verification
    return res.redirect(302, `${APP_URL}/login?verified=true`);
  } catch (err) {
    console.error("Email verification error:", err);
    return res.redirect(302, `${APP_URL}/login?error=verification-failed`);
  }
}
