/* Edge-runtime compatibility smoke test.
 *
 * Regression guard for the class of bugs where a third-party SDK touches
 * Node-only APIs at module init / first call, breaking every Edge handler
 * that imports it. The triggering incident: posthog-node's
 * enableExceptionAutocapture registered globalThis.process.on('uncaughtException'),
 * which threw "globalThis.process?.on is not a function" in production
 * because the Edge runtime ships a partial process polyfill without
 * EventEmitter methods.
 *
 * Strategy: simulate the Edge environment by stripping Node-only methods
 * from process before importing the modules that wrap third-party SDKs.
 * Any import-time or init-time access to those APIs throws — but our
 * wrappers must catch and degrade gracefully so the request continues.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Edge-runtime compatibility — third-party SDK init must not throw", () => {
  let originalProcessOn: typeof process.on;
  let originalProcessOff: typeof process.off;

  beforeEach(() => {
    // Stash and remove Node-only EventEmitter methods to simulate Edge.
    // The Edge runtime exposes process.env but no .on / .off / .emit.
    originalProcessOn = process.on;
    originalProcessOff = process.off;
    delete (process as unknown as Record<string, unknown>).on;
    delete (process as unknown as Record<string, unknown>).off;
    vi.resetModules();
  });

  afterEach(() => {
    process.on = originalProcessOn;
    process.off = originalProcessOff;
  });

  it("_posthog.ts imports without throwing when process.on is missing", async () => {
    let importError: unknown = null;
    try {
      await import("../../server-handlers/_posthog");
    } catch (e) {
      importError = e;
    }
    expect(importError).toBeNull();
  });

  it("getClient (via captureServerEvent dispatch) tolerates missing process.on", async () => {
    // Set a key so the lazy init path actually constructs PostHog (not the
    // "no key" early return). Use an unreachable host so the SDK's internal
    // fetch fails fast — we're not testing the network, only init resilience.
    const prevKey = process.env.POSTHOG_API_KEY;
    const prevHost = process.env.POSTHOG_HOST;
    process.env.POSTHOG_API_KEY = "phc_test_smoke_key";
    process.env.POSTHOG_HOST = "http://127.0.0.1:1"; // refused port

    const mod = await import("../../server-handlers/_posthog");

    // Race the call against a timeout — the contract is "doesn't throw",
    // not "completes". A hung capture is acceptable; an uncaught throw is not.
    const callPromise = mod.captureServerEvent("smoke_event", "test_user").then(() => "ok").catch((e) => e);
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve("timeout"), 200));
    const result = await Promise.race([callPromise, timeoutPromise]);

    // Either ok or timeout is fine. An Error means the wrapper failed to swallow.
    expect(result).not.toBeInstanceOf(Error);

    if (prevKey === undefined) delete process.env.POSTHOG_API_KEY;
    else process.env.POSTHOG_API_KEY = prevKey;
    if (prevHost === undefined) delete process.env.POSTHOG_HOST;
    else process.env.POSTHOG_HOST = prevHost;
  });
});
