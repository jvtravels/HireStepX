import { useEffect, useRef } from "react";

interface PollOptions {
  /** Restart the loop (and treat the next run as `first`) when this changes. */
  restartKey?: string | number | null;
  enabled?: boolean;
  /** Upper bound for the exponential backoff applied after failed runs. */
  maxBackoffMs?: number;
}

/**
 * Runs `task` every `intervalMs` while the tab is visible. Hidden tabs make no
 * requests; on return the task runs immediately if it's due. `task` returning
 * `false` counts as a failure and backs off exponentially so a rate-limited
 * caller can't keep its own window pinned open.
 */
export function usePolling(
  task: (first: boolean) => Promise<boolean | void> | boolean | void,
  intervalMs: number,
  { restartKey = null, enabled = true, maxBackoffMs = 120_000 }: PollOptions = {},
): void {
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let first = true;
    let lastRunAt = 0;
    let running = false;

    const delayMs = () => (failures === 0 ? intervalMs : Math.min(intervalMs * 2 ** failures, maxBackoffMs));

    const schedule = (ms: number) => {
      clearTimeout(timer);
      if (cancelled || document.visibilityState === "hidden") return;
      timer = setTimeout(run, ms);
    };

    async function run() {
      if (cancelled || running) return;
      running = true;
      const isFirst = first;
      first = false;
      lastRunAt = Date.now();
      let ok = true;
      try {
        ok = (await taskRef.current(isFirst)) !== false;
      } catch {
        ok = false;
      }
      running = false;
      if (cancelled) return;
      failures = ok ? 0 : failures + 1;
      schedule(delayMs());
    }

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        clearTimeout(timer);
        return;
      }
      if (running) return;
      const due = delayMs() - (Date.now() - lastRunAt);
      if (due <= 0) void run();
      else schedule(due);
    };

    void run();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, restartKey, enabled, maxBackoffMs]);
}
