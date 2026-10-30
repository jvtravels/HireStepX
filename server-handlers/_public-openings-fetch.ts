import { PUBLIC_OPENING_SELECT, liveOpenings, type OpeningRow, type PublicOpening } from "./_public-openings-helpers";

declare const process: { env: Record<string, string | undefined> };

/** Live, approved roles for the public pages. Any failure returns an empty list
 *  (the pages then render an empty state and stay out of the sitemap), so a
 *  missing migration or an outage never breaks the marketing site. Cached 5 min. */
export async function fetchLiveOpenings(fetchImpl: typeof fetch = fetch): Promise<PublicOpening[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return [];
  try {
    const res = await fetchImpl(
      `${url}/rest/v1/employer_requirements?select=${PUBLIC_OPENING_SELECT}&public_listing=eq.approved&status=neq.closed&order=public_approved_at.desc&limit=100`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as OpeningRow[];
    return Array.isArray(rows) ? liveOpenings(rows) : [];
  } catch {
    return [];
  }
}
