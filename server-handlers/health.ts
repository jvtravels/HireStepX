/* Vercel Edge Function — Health Check Endpoint */
/* Verifies service dependencies are reachable, not just configured */

export const config = { runtime: "edge" };

declare const process: { env: Record<string, string | undefined> };

async function checkSupabase(): Promise<"ok" | "error" | "missing"> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return "missing";
  try {
    // Hit a real query path so we exercise the SQL connection, not
    // just PostgREST's HTTP front. profiles is the most-trafficked
    // user-scoped table, so a count(*) with limit=1 is a cheap
    // canary that catches "PostgREST up but DB down" partial outages.
    const res = await fetch(
      `${url}/rest/v1/profiles?select=id&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          // Tell PostgREST this is a single-row read; avoids paginated
          // response overhead on the health path.
          "Range-Unit": "items",
          Range: "0-0",
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    // 200 / 206 = ok (data returned), 416 = empty table but reachable.
    // 404 = bad endpoint config. 5xx = real outage.
    if (res.status === 416 || (res.status >= 200 && res.status < 300)) return "ok";
    return res.status < 500 ? "ok" : "error";
  } catch {
    return "error";
  }
}

async function checkUpstash(): Promise<"ok" | "error" | "missing"> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return "missing";
  try {
    // PING is the canonical liveness probe; round-trips a single
    // command without touching application data.
    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Run live checks in parallel
  const [supabase, upstash] = await Promise.all([
    checkSupabase(),
    checkUpstash(),
  ]);

  const checks: Record<string, string> = {
    supabase,
    upstash,
    llm: (process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY) ? "ok" : "missing",
    tts: process.env.GCP_TTS_API_KEY ? "ok" : "missing",
    stt: process.env.DEEPGRAM_API_KEY ? "ok" : "missing",
    payments: process.env.RAZORPAY_KEY_ID ? "ok" : "missing",
    email: process.env.RESEND_API_KEY ? "ok" : "missing",
  };

  const allOk = Object.values(checks).every(v => v === "ok");

  // Log detailed service status server-side only
  console.warn("[health]", JSON.stringify(checks));

  return new Response(JSON.stringify({
    status: allOk ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
  }), {
    status: allOk ? 200 : 503,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
