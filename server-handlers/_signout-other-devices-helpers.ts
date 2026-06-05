/* Pure helpers extracted from signout-other-devices.ts so the body
   validation and the admin metadata payload can be locked under unit
   tests. The handler keeps just the fetch orchestration. */

export interface SignoutBody {
  deviceToken?: unknown;
  userAgent?: unknown;
}

export interface ValidatedSignout {
  deviceToken: string;
  userAgent: string;
}

export type ValidationResult =
  | { ok: true; value: ValidatedSignout }
  | { ok: false; error: string };

function asString(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max);
}

/**
 * Validate the POST body for /api/signout-other-devices.
 * deviceToken is mandatory — without it we can't pin metadata, so the
 * handler returns 400 rather than guessing.
 */
export function validateSignoutBody(body: SignoutBody): ValidationResult {
  const deviceToken = asString(body.deviceToken, 200);
  if (!deviceToken) return { ok: false, error: "Missing deviceToken" };
  const userAgent = asString(body.userAgent, 200);
  return { ok: true, value: { deviceToken, userAgent } };
}

/**
 * Build the Supabase admin user_metadata patch that pins this device
 * as the sole active session. Time is injected so tests stay
 * deterministic.
 */
export function buildMetadataPatch(
  v: ValidatedSignout,
  now: number,
): { user_metadata: { active_device_token: string; recent_devices: Array<{ id: string; ua: string; at: number }> } } {
  return {
    user_metadata: {
      active_device_token: v.deviceToken,
      recent_devices: [{ id: v.deviceToken, ua: v.userAgent, at: now }],
    },
  };
}
