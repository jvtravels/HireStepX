import { describe, it, expect, beforeAll, afterAll } from "vitest";

/**
 * RLS integration test for match_reviews (supabase-migrations/0035).
 *
 * Opt-in, same switch as employerTeams.rls.integration.test.ts: set
 * TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY and TEST_SUPABASE_SERVICE_ROLE_KEY
 * for a dedicated TEST project that has 0035 applied. Never use production.
 *
 * Reviews are blind until the reader submits their own, and that rule lives in
 * the handler, so the table must have no client access at all: a browser JWT
 * can neither read teammates' reviews nor write any.
 */

const SUPABASE_URL = process.env.TEST_SUPABASE_URL || "";
const ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || "";
const RLS_ENABLED = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);

describe.skipIf(!RLS_ENABLED)("RLS: match_reviews (integration)", () => {
  let userId = "";
  let token = "";

  beforeAll(async () => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ email: `rls-reviews-${Date.now()}@test.hirestepx.com`, password: "TestPass123!", data: { custom_email_verified: true } }),
    });
    if (!res.ok) throw new Error(`signUp failed: ${res.status}`);
    const { user, session } = await res.json();
    userId = user.id;
    token = session.access_token;
  }, 30_000);

  afterAll(async () => {
    if (!userId) return;
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "DELETE", headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    }).catch(() => {});
  });

  const asUser = (path: string, init: RequestInit = {}) =>
    fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });

  it("a client JWT reads no reviews", async () => {
    const res = await asUser("match_reviews?select=id");
    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual([]);
  });

  it("a client JWT cannot insert a review", async () => {
    const res = await asUser("match_reviews", {
      method: "POST",
      body: JSON.stringify({
        employer_id: userId, requirement_id: userId, match_id: userId,
        reviewer_user_id: userId, rating: 4, reason: "direct write",
      }),
    });
    expect(res.ok).toBe(false);
  });
});
