/* Keyset (preferred) or offset paging for PostgREST reads that feed money or alert numbers.
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
  /** Matching-row total from the Content-Range header, when the caller's `get` asked for a count. */
  total?: number;
}

export type RestGet = (path: string) => Promise<Response>;

export interface PageOpts {
  pageSize?: number;
  maxRows?: number;
  /** Unique, orderable column (usually `id`; it must be in the select) to page by keyset
      (`order=<col>.asc&<col>=gt.<last>`). Offset paging can skip or repeat rows when the
      table changes between pages; keyset cannot. `basePath` must then carry no `order=`. */
  keyset?: string;
}

/** Total from `Content-Range: 0-999/5234` (null for `*`, a missing header or a header-less mock). */
export function contentRangeTotal(res: Response): number | null {
  const raw = typeof res.headers?.get === "function" ? res.headers.get("content-range") : null;
  const m = raw ? /\/(\d+)$/.exec(raw.trim()) : null;
  return m ? Number(m[1]) : null;
}

async function fetchPage<T>(get: RestGet, path: string): Promise<{ rows: T[]; total: number | null }> {
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
  return { rows: data as T[], total: contentRangeTotal(res) };
}

/** Reads one page. Throws RestReadError on any non-2xx, network error or non-array body. */
export async function readPage<T>(get: RestGet, path: string): Promise<T[]> {
  return (await fetchPage<T>(get, path)).rows;
}

/** Pages `basePath` until exhausted or `maxRows`. Throws on a read failure so a partial
    read is never mistaken for a complete one.
    - keyset mode (`opts.keyset`): stable under concurrent writes; preferred whenever the
      select includes a unique id.
    - offset mode (fallback): `basePath` must carry a deterministic `order=` with a unique
      tiebreaker, or rows can repeat or vanish between pages.
    End of data is decided by the Content-Range total when the response carries one (so a
    server `max-rows` below the page size cannot end the read early), otherwise by a short page. */
export async function readAllPages<T>(get: RestGet, basePath: string, opts: PageOpts = {}): Promise<PagedRows<T>> {
  const pageSize = opts.pageSize ?? PAGE_SIZE;
  const maxRows = opts.maxRows ?? DEFAULT_MAX_ROWS;
  const keyCol = opts.keyset;
  if (keyCol && /(^|[?&])order=/.test(basePath)) throw new Error("readAllPages: keyset mode appends its own order=");
  const sep = basePath.includes("?") ? "&" : "?";
  const rows: T[] = [];
  let last: string | number | null = null;
  let total: number | undefined;
  while (rows.length < maxRows) {
    const want = Math.min(pageSize, maxRows - rows.length);
    const path: string = keyCol
      ? `${basePath}${sep}order=${keyCol}.asc${last === null ? "" : `&${keyCol}=gt.${encodeURIComponent(String(last))}`}&limit=${want}`
      : `${basePath}${sep}offset=${rows.length}&limit=${want}`;
    const page = await fetchPage<T>(get, path);
    rows.push(...page.rows);
    // First page's count is the whole-query total in both modes (keyset has no gt filter yet).
    if (page.total !== null && total === undefined) total = page.total;
    if (page.rows.length === 0) return { rows, truncated: false, total };
    if (keyCol) {
      const key = (page.rows[page.rows.length - 1] as Record<string, unknown>)[keyCol];
      if (typeof key !== "string" && typeof key !== "number") throw new RestReadError(`keyset column "${keyCol}" missing from rows`, 200, false);
      last = key;
    }
    const done = total !== undefined ? rows.length >= total : page.rows.length < want;
    if (done) return { rows, truncated: false, total };
  }
  // Cap reached on a full page: there may be more.
  return { rows, truncated: true, total };
}

/** Like readAllPages, but returns null when the table/column is not migrated yet
    (an expected state), and still throws on a real failure. */
export async function readAllPagesOrMissing<T>(
  get: RestGet,
  basePath: string,
  opts?: PageOpts,
): Promise<PagedRows<T> | null> {
  try {
    return await readAllPages<T>(get, basePath, opts);
  } catch (err) {
    if (err instanceof RestReadError && err.missingSchema) return null;
    throw err;
  }
}
