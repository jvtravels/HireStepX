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

declare const process: { env: Record<string, string | undefined> };

export default async function handler(req: Request): Promise<Response> {
  if (!googleConfigured(process.env)) return new Response(null, { status: 200 });

  const channelId = req.headers.get("x-goog-channel-id") || "";
  const resourceId = req.headers.get("x-goog-resource-id") || "";
  const resourceState = req.headers.get("x-goog-resource-state") || "";
  const channelToken = req.headers.get("x-goog-channel-token") || "";

  if (!channelId || !resourceId) return new Response(null, { status: 200 });
  if (resourceState === "sync") return new Response(null, { status: 200 }); // initial ack

  const row = await getSyncRowByChannel(channelId, resourceId);
  // Token we set on watch() is the user id; reject a notification whose token
  // doesn't match the row it claims to address.
  if (!row || (channelToken && channelToken !== row.user_id)) {
    return new Response(null, { status: 200 });
  }

  try {
    await runIncrementalSync(row);
  } catch (e) {
    console.error(`[google-webhook] sync error for ${row.user_id}:`, e);
  }
  return new Response(null, { status: 200 });
}
