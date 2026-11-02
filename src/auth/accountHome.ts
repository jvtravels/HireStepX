/* One login for everyone: with no explicit `next`, the account itself decides where
 * "home" is. A company, a team membership or a pending invite for the confirmed email
 * means the employer console; anything else is a candidate. Failures fall back to the
 * candidate redirect so a flaky lookup can never lock anyone out of the dashboard. */

type AuthedFetch = (url: string, init: { headers: Record<string, string> }) => Promise<Response>;

export async function resolveAccountHome(token: string, fetchImpl: AuthedFetch = fetch): Promise<"/employer" | null> {
  const headers = { Authorization: `Bearer ${token}` };
  const [profile, invites] = await Promise.all([
    fetchImpl("/api/employer-profile", { headers })
      .then(async (res) => (res.ok ? ((await res.json()) as { status?: string }).status : undefined))
      .catch(() => undefined),
    fetchImpl("/api/employer-team-accept?mine=1", { headers })
      .then(async (res) => (res.ok ? ((await res.json()) as { invites?: unknown[] }).invites?.length ?? 0 : 0))
      .catch(() => 0),
  ]);
  if (profile && profile !== "none") return "/employer";
  return invites > 0 ? "/employer" : null;
}
