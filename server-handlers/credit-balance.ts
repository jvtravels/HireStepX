/* GET /api/credit-balance
 *
 * Returns the authenticated user's purchased session-credit balance by reading
 * directly via the service role (bypasses RLS). The supabase-js client-side
 * read via the anon key + user JWT was silently returning 0 in some browser
 * environments because auth.uid() wasn't being resolved correctly in the RLS
 * policy context. Reading server-side with the service role is authoritative.
 */
export const config = { runtime: "edge" };

import { withAuthAndRateLimit } from "./_shared";
import { getSessionCredits } from "./_session-credits";

declare const process: { env: Record<string, string | undefined> };

export default async function handler(req: Request): Promise<Response> {
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "credit-balance",
    ipLimit: 60,
    userLimit: 30,
    maxBytes: 0,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    // Dev / test environment — return 0 gracefully
    return new Response(JSON.stringify({ balance: 0 }), { status: 200, headers });
  }

  try {
    const balance = await getSessionCredits(SUPABASE_URL, SERVICE_ROLE_KEY, auth.userId ?? "");
    return new Response(JSON.stringify({ balance }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ balance: 0 }), { status: 200, headers });
  }
}
