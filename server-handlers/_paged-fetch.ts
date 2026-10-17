/* Offset paging for PostgREST reads that feed money or alert numbers.
 * Supabase caps a response at its `max-rows` setting (1000 by default), so a
 * single `limit=10000` silently returns the first 1000 rows and every total
 * computed from it is wrong. These helpers page until the table is exhausted
 * or a hard row cap is hit, and tell the caller which of those happened.
 *
 * Pure of Supabase specifics (the caller passes a `get`), no _shared import, so
 * it is safe for the edge uptime-check bundle. */

export const PAGE_SIZE = 1000;
export const DEFAULT_MAX_ROWS = 50_000;

/** PostgREST / Postgres codes for "table or column does not exist yet". */
const MISSING_SCHEMA_CODES = new Set(["PGRST205", "PGRST204", "42P01", "42703"]);

export class RestReadError extends Error {
  readonly status: number;
  /** True when the table or a selected column has not been migrated yet. */
  readonly missingSchema: boolean;
  constructor(message: string, status: number, missingSchema: boolean) {
    super(message);
    this.name = "RestReadError";
    this.status = status;
    this.missingSchema = missingSchema;
  }
}

export interface PagedRows<T> {
  rows: T[];
  /** True when the row cap was reached while more rows may remain. */
  truncated: boolean;
}

export type RestGet = (path: string) => Promise<Response>;

/** Reads one page. Throws RestReadError on any non-2xx, network error or non-array body. */
export async function readPage<T>(get: RestGet, path: string): Promise<T[]> {
  let res: Response;
  try {
    res = await get(path);
  } catch (err) {
    throw new RestReadError(`request failed: ${err instanceof Error ? err.message : String(err)}`, 0, false);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { code?: unknown } | null;
    const missing = typeof body?.code === "string" && MISSING_SCHEMA_CODES.has(body.code);
    throw new RestReadError(`HTTP ${res.status}`, res.status, missing);
  }
  const data = await res.json().catch(() => null);
  if (!Array.isArray(data)) throw new RestReadError("non-array body", res.status, false);
  return data as T[];
}

/** Pages `basePath` (which must carry a deterministic `order=`, ideally with a unique
    tiebreaker, or rows can repeat or vanish between pages). Throws on a read failure
    so a partial read is never mistaken for a complete one. */
export async function readAllPages<T>(
  get: RestGet,
  basePath: string,
  opts: { pageSize?: number; maxRows?: number } = {},
): Promise<PagedRows<T>> {
  const pageSize = opts.pageSize ?? PAGE_SIZE;
  const maxRows = opts.maxRows ?? DEFAULT_MAX_ROWS;
  const sep = basePath.includes("?") ? "&" : "?";
  const rows: T[] = [];
  while (rows.length < maxRows) {
    const want = Math.min(pageSize, maxRows - rows.length);
    const page = await readPage<T>(get, `${basePath}${sep}offset=${rows.length}&limit=${want}`);
    rows.push(...page);
    if (page.length < want) return { rows, truncated: false };
  }
  // Cap reached on a full page: there may be more.
  return { rows, truncated: true };
}

/** Like readAllPages, but returns null when the table/column is not migrated yet
    (an expected state), and still throws on a real failure. */
export async function readAllPagesOrMissing<T>(
  get: RestGet,
  basePath: string,
  opts?: { pageSize?: number; maxRows?: number },
): Promise<PagedRows<T> | null> {
  try {
    return await readAllPages<T>(get, basePath, opts);
  } catch (err) {
    if (err instanceof RestReadError && err.missingSchema) return null;
    throw err;
  }
}
