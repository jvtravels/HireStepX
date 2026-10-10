import type { Instrumentation } from "next";
import { captureServerException } from "./server-handlers/_posthog";

// Reports uncaught server errors (RSC render, route handlers, server actions)
// to PostHog error tracking. Handlers that catch their own errors never reach
// here, so this closes the gap for errors they don't catch. Headers and query
// strings are deliberately dropped: they can carry tokens and PII.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const digest =
    typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;
  await captureServerException(err, undefined, {
    source: "next_on_request_error",
    path: request.path.split("?")[0],
    method: request.method,
    route_path: context.routePath,
    route_type: context.routeType,
    digest,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
  });
};
