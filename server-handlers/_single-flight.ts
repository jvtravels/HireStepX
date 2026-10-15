// Per-isolate request coalescing: concurrent callers with the same key share one
// in-flight promise, so a double-click or retry storm costs one LLM call, not N.
const inflight = new Map<string, Promise<unknown>>();

export function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, p);
  return p;
}

// Bump a version when the prompt or response shape of a cached endpoint changes,
// so stale entries are orphaned instead of served.
export const CACHE_VERSION = {
  gq: "v1",
  ins: "v1",
  jdMatch: "v1",
  bulletRewrite: "v1",
} as const;
