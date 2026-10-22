export const config = { runtime: "edge" };

import { withAuthAndRateLimit, errorResponse, readBodyWithSizeLimit } from "./_shared";
import {
  CATEGORY_COLUMN,
  DEFAULT_EMAIL_PREFERENCES,
  EMAIL_CATEGORIES,
  getEmailPreferences,
  preferenceDepsFromEnv,
  setEmailOptOut,
} from "./_unsubscribe";

/** Authenticated settings counterpart of /api/unsubscribe.
 *  POST `{}` returns the caller's email preferences;
 *  POST `{ marketing_opt_out?: boolean, employer_notifications_opt_out?: boolean }` updates them. */
export default async function handler(req: Request): Promise<Response> {
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "email-preferences",
    ipLimit: 40,
    userLimit: 20,
    maxBytes: 2_000,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;
  if (!auth.userId) return errorResponse(401, "Unauthorized", headers);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse((await readBodyWithSizeLimit(req, 2_000)) || "{}");
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch (err) {
    if (err instanceof Response) return err;
    return errorResponse(400, "Invalid request body", headers);
  }

  const deps = preferenceDepsFromEnv();
  for (const category of EMAIL_CATEGORIES) {
    const value = body[CATEGORY_COLUMN[category]];
    if (value === undefined) continue;
    if (typeof value !== "boolean") return errorResponse(400, "Invalid preference value", headers);
    if (!(await setEmailOptOut(deps, auth.userId, category, value))) {
      return errorResponse(502, "Could not save preferences", headers);
    }
  }

  const prefs = (await getEmailPreferences(deps, auth.userId)) ?? { ...DEFAULT_EMAIL_PREFERENCES };
  return new Response(JSON.stringify({ prefs }), { status: 200, headers });
}
