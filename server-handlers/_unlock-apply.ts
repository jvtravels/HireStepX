/* Shared "mark a requirement_match unlocked" write, used by both the paid
 * Razorpay flow (employer-verify-unlock-payment.ts) and the admin
 * complimentary-unlock action (_admin-unlock.ts) so the two can never drift
 * on what an unlock actually persists. */

export interface UnlockProfileSnapshot {
  name: string | null | undefined;
  email: string | null | undefined;
}

export async function patchMatchUnlocked(opts: {
  supabaseUrl: string;
  headers: Record<string, string>;
  matchId: string;
  unlockedAt: string;
  profile?: UnlockProfileSnapshot;
  fetchImpl?: typeof fetch;
}): Promise<Response> {
  const doFetch = opts.fetchImpl ?? fetch;
  const url = `${opts.supabaseUrl}/rest/v1/requirement_matches?id=eq.${encodeURIComponent(opts.matchId)}`;
  const patchHeaders = { ...opts.headers, Prefer: "return=minimal" };
  const full = await doFetch(url, {
    method: "PATCH",
    headers: patchHeaders,
    body: JSON.stringify({
      unlocked: true,
      unlocked_at: opts.unlockedAt,
      unlocked_candidate_name: opts.profile?.name ?? null,
      unlocked_candidate_email: opts.profile?.email ?? null,
    }),
  });
  if (full.ok) return full;
  // The unlock itself must not be lost to a snapshot-column mismatch (see
  // supabase-migrations/0026) — retry with just the core fields; the
  // name/email snapshot is a display nicety.
  const bodyText = await full.text().catch(() => "");
  console.error(
    "unlock patch with candidate snapshot failed, retrying without it:",
    full.status,
    bodyText.slice(0, 200),
  );
  return doFetch(url, {
    method: "PATCH",
    headers: patchHeaders,
    body: JSON.stringify({ unlocked: true, unlocked_at: opts.unlockedAt }),
  });
}
