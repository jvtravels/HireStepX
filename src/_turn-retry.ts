/* Hold-and-retry policy for an interview turn that needs the server.
 *
 * Rule: a transient outage must never end a session. When a turn request
 * fails we first ask "is the server reachable at all?". If not, the turn is
 * HELD (not failed) until connectivity returns, bounded only by a long
 * ceiling. If the server IS reachable, the failure is a real server-side one
 * and we fall back to a short bounded retry, then give up so the caller can
 * degrade (e.g. a scripted closing) as before.
 *
 * All I/O is injected so the policy is unit-testable without timers or a DOM.
 */

export interface HoldRetryDeps<T> {
  attempt: () => Promise<T | null>;
  /** Active reachability check ("did a request to our server just succeed?"). */
  probe: () => Promise<boolean>;
  /** Resolves true when reachable again, false on timeout/abort. */
  waitReachable: (opts: { timeoutMs: number }) => Promise<boolean>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  isCancelled?: () => boolean;
  onHoldChange?: (held: boolean) => void;
  onEvent?: (event: "attempt_failed" | "held" | "resumed" | "gave_up", detail: Record<string, unknown>) => void;
  /** Server-side failures tolerated while reachable (default 2 total attempts). */
  maxServerFailures?: number;
  serverBackoffMs?: readonly number[];
  /** Hard ceiling on total held time before giving up (default 10 min). */
  maxHoldMs?: number;
}

export interface HoldRetryResult<T> {
  value: T | null;
  attempts: number;
  heldMs: number;
}

export const DEFAULT_MAX_HOLD_MS = 10 * 60_000;

export async function runWithHold<T>(deps: HoldRetryDeps<T>): Promise<HoldRetryResult<T>> {
  const maxServerFailures = deps.maxServerFailures ?? 2;
  const backoff = deps.serverBackoffMs ?? [600, 2_000];
  const maxHoldMs = deps.maxHoldMs ?? DEFAULT_MAX_HOLD_MS;
  let attempts = 0;
  let serverFailures = 0;
  let heldMs = 0;

  for (;;) {
    attempts += 1;
    const value = await deps.attempt();
    if (value !== null) return { value, attempts, heldMs };
    if (deps.isCancelled?.()) return { value: null, attempts, heldMs };

    const reachable = await deps.probe();
    deps.onEvent?.("attempt_failed", { attempts, reachable });

    if (!reachable) {
      const remaining = maxHoldMs - heldMs;
      if (remaining <= 0) {
        deps.onEvent?.("gave_up", { attempts, heldMs, reason: "hold_ceiling" });
        return { value: null, attempts, heldMs };
      }
      deps.onHoldChange?.(true);
      deps.onEvent?.("held", { attempts });
      const startedAt = deps.now();
      const back = await deps.waitReachable({ timeoutMs: remaining });
      heldMs += deps.now() - startedAt;
      deps.onHoldChange?.(false);
      if (deps.isCancelled?.()) return { value: null, attempts, heldMs };
      if (!back) {
        deps.onEvent?.("gave_up", { attempts, heldMs, reason: "hold_ceiling" });
        return { value: null, attempts, heldMs };
      }
      deps.onEvent?.("resumed", { attempts, heldMs });
      continue;
    }

    serverFailures += 1;
    if (serverFailures >= maxServerFailures) {
      deps.onEvent?.("gave_up", { attempts, heldMs, reason: "server_failures" });
      return { value: null, attempts, heldMs };
    }
    await deps.sleep(backoff[Math.min(serverFailures - 1, backoff.length - 1)]);
    if (deps.isCancelled?.()) return { value: null, attempts, heldMs };
  }
}

/**
 * A deadline that only counts down while the server is reachable. Offline
 * time is "frozen" (up to `ceilingMs` of wall clock) so a connection drop can
 * not burn the budget and trigger a premature fallback. Resolves null.
 */
export function createOnlineBudget(opts: {
  budgetMs: number;
  ceilingMs: number;
  isReachable: () => boolean;
  tickMs?: number;
  now?: () => number;
}): { promise: Promise<null>; cancel: () => void } {
  const tick = opts.tickMs ?? 250;
  const now = opts.now ?? Date.now;
  let timer: ReturnType<typeof setInterval> | null = null;
  let settle: (v: null) => void = () => {};
  const promise = new Promise<null>((resolve) => { settle = resolve; });
  let consumed = 0;
  const startedAt = now();
  let last = startedAt;
  timer = setInterval(() => {
    const t = now();
    if (opts.isReachable()) consumed += t - last;
    last = t;
    if (consumed >= opts.budgetMs || t - startedAt >= opts.ceilingMs) {
      if (timer) clearInterval(timer);
      timer = null;
      settle(null);
    }
  }, tick);
  return {
    promise,
    cancel: () => { if (timer) clearInterval(timer); timer = null; },
  };
}
