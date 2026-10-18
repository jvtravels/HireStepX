/* Single cron-auth gate. Vercel sends `Authorization: Bearer ${CRON_SECRET}` on
 * every cron invocation when the env var is set, so that is the only accepted
 * credential. `x-vercel-cron: 1` is a plain header anyone can spoof and must
 * never authenticate a request. Fails closed when the secret is unset. Edge-safe
 * (no node:crypto) and usable from both Web Request and Node-style handlers. */

declare const process: { env: Record<string, string | undefined> };

type HeaderBag = Headers | Record<string, string | string[] | undefined>;

function readHeader(headers: HeaderBag, name: string): string {
  if (typeof (headers as Headers).get === "function") return (headers as Headers).get(name) || "";
  const v = (headers as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(v) ? (v[0] || "") : (v || "");
}

/** Length-independent comparison so a mismatch does not leak how many leading chars matched. */
export function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function verifyCronAuth(req: { headers: HeaderBag }): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  return constantTimeEqual(readHeader(req.headers, "authorization"), `Bearer ${secret}`);
}
