/* Single-device session enforcement — pure decision logic + a remount-durable
 * grace window.
 *
 * Why this exists as its own unit:
 *
 * The app mounts THREE separate <AuthProvider> instances, one per route group
 * (`(auth)`, `(app)`, `(marketing)` — see each *Shell.tsx). A fresh email/
 * password login happens under `(auth)`; the optimistic setUser() there flips
 * isLoggedIn, and the Login screen immediately router.replace()s into the
 * `(app)` group. That navigation UNMOUNTS the `(auth)` provider and MOUNTS a
 * brand-new `(app)` provider whose restore path re-runs the single-device
 * check from scratch.
 *
 * Two facts then collide:
 *   1. The device token lives in localStorage (rotated synchronously at login)
 *      while the comparison value lives in the JWT's user_metadata
 *      (active_device_token), which only updates when the access token is
 *      re-issued by refreshSession(). For a brief window after login the JWT
 *      still carries the PREVIOUS session's token.
 *   2. The old in-memory "just authenticated" grace ref that was meant to cover
 *      exactly that window died with the unmounted `(auth)` provider.
 *
 * Result: the freshly-logged-in user, on a previously-used account, gets
 * localToken(new) ≠ serverToken(stale JWT) with no grace → self-eviction back
 * to /login within ~1–2s. The authenticated app was effectively unreachable.
 *
 * The fix is twofold and both halves live here so they can be unit-tested:
 *   - decideDeviceAction(): the keep/adopt/evict rule, with eviction gated on a
 *     real, grace-free mismatch and a present local token (never evict on an
 *     absent local token — we have nothing proving THIS device is the stale one).
 *   - a grace window persisted in localStorage so it survives the cross-group
 *     provider remount that the in-memory ref could not.
 *
 * Eviction is the destructive action, so the caller additionally confirms a
 * would-be eviction against authoritative server metadata (getUser()) before
 * signing out — decideDeviceAction is the same rule applied to that fresh read.
 */

export type DeviceAction = "keep" | "adopt" | "evict";

/** Decide what the single-device check should do for one (local, server) pair.
 *
 *  - no server token  → nothing to enforce yet (brand-new account pre-rotation,
 *    or metadata cleared on sign-out). Keep.
 *  - no local token   → first login on this origin, or localStorage was cleared.
 *    Adopt the server's so the NEXT check compares like-for-like. Never evict on
 *    an absent local token.
 *  - tokens equal     → this device is the active one. Keep.
 *  - mismatch + grace → our own rotation is still propagating into the JWT. Keep.
 *  - mismatch, no grace → another device genuinely rotated the token. Evict. */
export function decideDeviceAction(args: {
  localToken: string | null | undefined;
  serverToken: string | null | undefined;
  withinGrace: boolean;
}): DeviceAction {
  const { localToken, serverToken, withinGrace } = args;
  if (!serverToken) return "keep";
  if (!localToken) return "adopt";
  if (localToken === serverToken) return "keep";
  if (withinGrace) return "keep";
  return "evict";
}

/* ─── Remount-durable grace window ───
 * Stored in localStorage (shared across route-group provider remounts on the
 * same origin) rather than a React ref, which would reset on every remount. */

export const DEVICE_GRACE_KEY = "hirestepx_device_grace";
/** How long after a fresh auth we suppress eviction while the new device token
 *  propagates from updateUser()→refreshSession() into the JWT. Generous on
 *  purpose: a false eviction locks a legitimate user out of the whole app; a
 *  too-long window only delays kicking a genuinely-displaced device, which the
 *  60s periodic check and next restore still catch. */
export const DEVICE_GRACE_MS = 20_000;

/** Open the grace window for `ttlMs` from `now`. Call BEFORE the optimistic
 *  setUser() at login so the value is already persisted when the `(app)`
 *  provider mounts and reads it. */
export function markDeviceGrace(ttlMs: number = DEVICE_GRACE_MS, now: number = Date.now()): void {
  try {
    localStorage.setItem(DEVICE_GRACE_KEY, String(now + ttlMs));
  } catch {
    /* localStorage may be unavailable (SSR / privacy mode) — grace simply
       won't apply, and the getUser() confirmation still prevents a wrong evict. */
  }
}

/** True while inside an unexpired grace window. Self-cleans an expired marker so
 *  a stale value can never silently extend the window. */
export function isWithinDeviceGrace(now: number = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(DEVICE_GRACE_KEY);
    if (!raw) return false;
    const until = parseInt(raw, 10);
    if (!Number.isFinite(until)) {
      localStorage.removeItem(DEVICE_GRACE_KEY);
      return false;
    }
    if (now >= until) {
      localStorage.removeItem(DEVICE_GRACE_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Close the grace window explicitly (on sign-out / confirmed eviction). */
export function clearDeviceGrace(): void {
  try {
    localStorage.removeItem(DEVICE_GRACE_KEY);
  } catch {
    /* expected: localStorage may be unavailable */
  }
}
