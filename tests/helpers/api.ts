import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for seeding + cleanup in e2e tests.
 * Bypasses RLS. Never import from app code — tests only.
 *
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the env. Tests that
 * need seeding should call `requireServiceClient()`; if creds are missing
 * the test should `test.skip` with a clear message rather than silently
 * pretending to seed.
 */
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

export async function deleteUserSessions(userId: string): Promise<void> {
  const c = requireServiceClient();
  await c.from("sessions").delete().eq("user_id", userId);
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
