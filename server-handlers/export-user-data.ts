/* Vercel Serverless Function — GDPR Data Export
 * Returns all user data as a JSON download for "right to data portability" compliance.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withNodeAuthAndRateLimit, supabaseUrl } from "./_shared";
import { buildExportFilename } from "./_export-user-data-helpers";
import { collectUserExport } from "./_export-user-data-collect";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("X-Request-ID", crypto.randomUUID());

  const pre = await withNodeAuthAndRateLimit(req, res, {
    endpoint: "export-user-data",
    ipLimit: 3,
    allowGet: true,
  });
  if (pre.handled) return;
  const { userId, userEmail = "" } = pre;

  const SUPABASE_URL = supabaseUrl();
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  const { envelope, status } = await collectUserExport({
    fetchImpl: fetch,
    supabaseUrl: SUPABASE_URL,
    serviceKey: SUPABASE_SERVICE_ROLE_KEY,
    userId,
    userEmail,
  });
  // Nothing loaded at all: a 200 with an empty file would be a silent lie.
  if (status === "failed") {
    return res.status(500).json({ error: "Could not load your data right now. Please try again shortly.", complete: false });
  }

  const filename = buildExportFilename(userId);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("X-Export-Complete", status === "complete" ? "true" : "false");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.status(200).send(JSON.stringify(envelope, null, 2));
}
