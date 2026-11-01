/* Vercel Edge Function — receives Content-Security-Policy-Report-Only
   violations from the employer console and writes them to the function logs.
   Browsers send these without credentials, so there is no auth; the body is
   size-capped, rate-limited per IP and only a short summary is logged. */

export const config = { runtime: "edge" };

import { isRateLimited, getClientIp } from "./_shared";
import { summarizeCspReports } from "./_csp-report-helpers";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  if (await isRateLimited(getClientIp(req), "csp-report", 60, 60_000)) {
    return new Response(null, { status: 204 });
  }

  const declared = parseInt(req.headers.get("content-length") || "0", 10);
  if (declared > 16_384) return new Response("Payload too large", { status: 413 });

  try {
    const text = (await req.text()).slice(0, 16_384);
    for (const v of summarizeCspReports(JSON.parse(text))) {
      console.warn(JSON.stringify({ level: "warn", kind: "csp-report", ...v }));
    }
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
