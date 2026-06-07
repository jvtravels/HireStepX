import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function requireServiceClient(): SupabaseClient {
  const c = getServiceClient();
  if (!c) {
    throw new Error(
      "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required for this test. " +
        "Set them in .env.test or GitHub Actions secrets.",
    );
  }
  return c;
}

// FK-dependency-ordered child tables. Add new user-scoped tables here so
// cleanupUserData drops them before the parent profiles row would be touched.
// Mirrors the Supawright pattern (cascade-aware service-role delete).
const USER_SCOPED_TABLES = [
  "sessions",
  "calendar_events",
  "story_notebook",
  "salary_offer",
  "payments",
  "referrals",
  "session_credits",
] as const;

export async function cleanupUserData(userId: string): Promise<void> {
  const c = requireServiceClient();
  for (const table of USER_SCOPED_TABLES) {
    await c.from(table).delete().eq("user_id", userId);
  }
}

export async function seedSession(
  userId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const c = requireServiceClient();
  const row = {
    user_id: userId,
    type: "behavioral",
    difficulty: "standard",
    focus: "leadership",
    duration: 600,
    score: 78,
    questions: 5,
    transcript: [],
    skill_scores: { Communication: 75, Structure: 82, Technical: 70 },
    date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
  const { data, error } = await c.from("sessions").insert(row).select("id").single();
  if (error) throw error;
  return data.id as string;
}

/**
 * RLS-respecting Supabase client for a logged-in test user.
 *
 * Service-role bypasses RLS — fine for seeding/teardown, dangerous for the
 * assertion path. If a T1 test asserts "user can read their sessions" via
 * `requireServiceClient()`, the test passes even if RLS is misconfigured
 * (Supabase research: "tests run against the same schema, RLS policies,
 * and API endpoints that your production app uses"
 * — https://supabase.com/blog/testing-for-vibe-coders-from-zero-to-production-confidence).
 *
 * Use this helper for the post-mutation read-back. The signed-in client uses
 * the anon key + a real access token, so RLS enforces row visibility exactly
 * as it would for a browser session.
 */
export async function getAuthedClient(
  email: string,
  password: string,
): Promise<SupabaseClient> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "SUPABASE_URL + SUPABASE_ANON_KEY required for RLS-respecting reads. " +
        "Anon key is safe in CI secrets — it's already shipped to the browser.",
    );
  }
  const c = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

// Resolve the seeded test user's id from the auth.users table so tests can
// scope cleanup without hardcoding a uuid.
export async function getTestUserId(): Promise<string> {
  const c = requireServiceClient();
  const email = process.env.TEST_USER_EMAIL;
  if (!email) throw new Error("TEST_USER_EMAIL not set");
  const { data, error } = await c.auth.admin.listUsers();
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`Test user ${email} not found in auth.users`);
  return user.id;
}
