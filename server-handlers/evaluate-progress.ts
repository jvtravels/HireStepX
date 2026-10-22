/* Vercel Edge Function — report grading progress (polled by the report loading screen) */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit } from "./_shared";
import { getEvalStage, parseProgressSessionId } from "./_eval-progress";

export default async function handler(req: Request): Promise<Response> {
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "evaluate-progress",
    ipLimit: 90,
    userLimit: 40,
    maxBytes: 2_000,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;
  headers["Cache-Control"] = "no-store";

  let sessionId: string | null = null;
  try {
    const body = (await req.json()) as { sessionId?: unknown };
    sessionId = parseProgressSessionId(body?.sessionId);
  } catch {
    sessionId = null;
  }
  if (!sessionId || !auth.userId) {
    return new Response(JSON.stringify({ error: "sessionId required" }), { status: 400, headers });
  }

  const stage = await getEvalStage(auth.userId, sessionId);
  return new Response(JSON.stringify({ stage }), { status: 200, headers });
}
