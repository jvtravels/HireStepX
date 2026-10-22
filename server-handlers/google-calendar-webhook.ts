/* Vercel Edge Function — Google Calendar push webhook (PRI-35)
 *
 * POST /api/calendar/google/webhook
 *
 * Google calls this (no body) whenever a watched calendar changes, identifying
 * the channel via X-Goog-* headers. We map the channel + resource id back to a
 * connected user, confirm the channel token matches that user (defence against
 * a spoofed notification naming a channel that isn't theirs), then run an
 * incremental sync. Must return 200 fast; Google retries with backoff on
 * non-2xx, so transient sync failures are tolerable.
 *
 * The first notification after watch() has resource state "sync" and is just an
 * acknowledgement, not a change, so we ack it without syncing.
 */

export const config = { runtime: "edge" };

import { googleConfigured } from "./_google-calendar";
import { getSyncRowByChannel, runIncrementalSync } from "./_google-sync-runner";
import { isRateLimited, getClientIp } from "./_shared";

declare const process: { env: Record<string, string | undefined> };

export default async function handler(req: Request): Promise<Response> {
  if (!googleConfigured(process.env)) return new Response(null, { status: 200 });

  // Cap flood attempts before doing any DB work. Google sends at most a few
  // notifications per minute per channel; 120/min per IP is generous headroom
  // while blocking credential stuffing or enumeration floods.
  const ip = getClientIp(req);
  if (await isRateLimited(ip, "gcal-webhook", 120, 60_000)) {
    return new Response(null, { status: 429 });
  }

  const channelId = req.headers.get("x-goog-channel-id") || "";
  const resourceId = req.headers.get("x-goog-resource-id") || "";
  const resourceState = req.headers.get("x-goog-resource-state") || "";
  const channelToken = req.headers.get("x-goog-channel-token") || "";

  if (!channelId || !resourceId) return new Response(null, { status: 200 });
  if (resourceState === "sync") return new Response(null, { status: 200 }); // initial ack

  const row = await getSyncRowByChannel(channelId, resourceId);
  // We always set a channel token on watch() (the user id), and Google echoes it
  // on every notification for that channel. Require it to be present AND match:
  // a missing or mismatched token means a spoofed notification naming a channel
  // that isn't theirs, so we ack-and-ignore rather than running a sync for it.
  if (!row || !channelToken || channelToken !== row.user_id) {
    return new Response(null, { status: 200 });
  }

  try {
    await runIncrementalSync(row);
  } catch (e) {
    console.error(`[google-webhook] sync error for ${row.user_id}:`, e);
  }
  return new Response(null, { status: 200 });
}
