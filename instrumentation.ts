import type { Instrumentation } from "next";

declare const process: { env: Record<string, string | undefined> };

// Reports uncaught server errors (RSC render, route handlers, server actions)
// to PostHog error tracking. Handlers that catch their own errors never reach
// here, so this closes the gap for errors they don't catch.
//
// Deliberately a bare fetch to PostHog's capture endpoint, NOT posthog-node:
// Next bundles instrumentation.ts into every edge function, and importing the
// SDK here pushed api/generate-questions to 1.02 MB, over Vercel's 1 MB edge
// limit, which failed the production deploy. Headers and query strings are
// dropped on purpose: they can carry tokens and PII.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const key = process.env.POSTHOG_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const message = err instanceof Error ? err.message : String(err);
  const type = err instanceof Error ? err.name : "Error";
  const digest =
    typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;
  try {
    await fetch(`${process.env.POSTHOG_HOST || "https://us.i.posthog.com"}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event: "$exception",
        distinct_id: "server",
        properties: {
          $exception_list: [{ type, value: message, mechanism: { handled: false, synthetic: false } }],
          source: "next_on_request_error",
          path: request.path.split("?")[0],
          method: request.method,
          route_path: context.routePath,
          route_type: context.routeType,
          digest,
          release: process.env.VERCEL_GIT_COMMIT_SHA,
        },
      }),
    });
  } catch {
    /* telemetry must never break a request */
  }
};
