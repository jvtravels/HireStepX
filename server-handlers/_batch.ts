/** Runs `fn` over `items` with at most `concurrency` in flight; one failing item never aborts the rest. */
export async function mapPool<T>(items: readonly T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      try { await fn(item); } catch { /* per-item failure is the caller's to record */ }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, worker));
}

/** Reads pages until a short page, a failed page (null), or `maxPages`; `complete` is false if more rows may remain. */
export async function fetchAllPages<T>(
  fetchPage: (offset: number, limit: number) => Promise<T[] | null>,
  pageSize: number,
  maxPages: number,
): Promise<{ rows: T[]; complete: boolean }> {
  const rows: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const batch = await fetchPage(page * pageSize, pageSize);
    if (!batch) return { rows, complete: false };
    rows.push(...batch);
    if (batch.length < pageSize) return { rows, complete: true };
  }
  return { rows, complete: false };
}

/** Wall-clock budget so a cron stops cleanly before the platform kills it. */
export function timeBudget(ms: number, now: () => number = Date.now): { expired: () => boolean } {
  const deadline = now() + ms;
  return { expired: () => now() >= deadline };
}
