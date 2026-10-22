/* Report cache for evaluate-session: the report is stored on the sessions row
 * and keyed by schema version + calibration inputs. Generic over the report
 * type so this file stays free of the large SessionReport interface. */

import { hashStable } from "./_shared";
import { fulfilPracticeRequests } from "./_practice-request-fulfil";

declare const process: { env: Record<string, string | undefined> };

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Bump on any schema change to perQuestion/redFlags/etc. Old cached reports
// with a different version are auto-invalidated on next view.
// mvp-9: added focusMetrics (per-focus signature strip on the session card).
export const REPORT_VERSION = "mvp-9";

/**
 * Inputs — beyond sessionId + schema version — that change the *content* of a
 * report even for an identical transcript. Band calibration reads
 * targetCompany / role / difficulty (resolveCompanyProfile → applyBands), so a
 * report cached before the user edited any of these is stale. We fold them into
 * the cached row's identity so any edit is a cache MISS that recomputes.
 */
export interface ReportCacheIdentityInputs {
  targetCompany?: string | null;
  role?: string | null;
  difficulty?: string | null;
}

/**
 * The single source of truth for a cached report's identity. Written by
 * saveCachedReport and compared by loadCachedReport — never inline either side.
 * Returns a composite version string `<REPORT_VERSION>:<hash>` stored in the
 * existing `report_version` column, so a schema bump OR a calibration-input
 * change both invalidate the cache with no DB migration. Edge/WinterCG safe
 * (hashStable → crypto.subtle).
 */
export async function buildReportCacheVersion(inputs: ReportCacheIdentityInputs): Promise<string> {
  // Normalize so cosmetic differences (case, whitespace, null vs "") don't
  // cause spurious misses — but any real change flips the hash.
  const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
  const canonical = JSON.stringify({
    c: norm(inputs.targetCompany),
    r: norm(inputs.role),
    d: norm(inputs.difficulty),
  });
  const hash = await hashStable(canonical);
  return `${REPORT_VERSION}:${hash}`;
}

/**
 * Try to read a cached report for this session. Returns null on any failure
 * (cache miss, network error, version mismatch) so the caller re-evaluates.
 * We verify user_id matches the caller so one user can't retrieve another's
 * report via a guessed sessionId. `identity` folds the calibration-affecting
 * inputs (company/role/difficulty) into the compare — see
 * buildReportCacheVersion — so editing any of them is a miss that recomputes.
 */
export async function loadCachedReport<T>(
  sessionId: string,
  userId: string,
  identity: ReportCacheIdentityInputs,
): Promise<T | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  try {
    const expectedVersion = await buildReportCacheVersion(identity);
    const q = `sessions?id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(userId)}&select=report_json,report_version`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Accept": "application/json",
      },
    });
    if (!res.ok) return null;
    const rows = await res.json() as Array<{ report_json?: T; report_version?: string }>;
    const row = rows?.[0];
    if (!row?.report_json) return null;
    // Composite version encodes schema version AND calibration inputs; a schema
    // upgrade OR a company/role/difficulty edit both invalidate the cache here.
    if (row.report_version !== expectedVersion) return null;
    return row.report_json;
  } catch (err) {
    console.warn(`[evaluate-session] cache read failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Persist the report on the session row. Fire-and-forget relative to the
 * response: we await it so the write completes before the edge isolate
 * terminates (same lesson as llm_usage), but failures don't block the
 * response — worst case, the user re-evaluates on next view.
 */
export async function saveCachedReport<T extends { overallScore: number }>(
  sessionId: string,
  userId: string,
  report: T,
  identity: ReportCacheIdentityInputs,
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  try {
    const reportVersion = await buildReportCacheVersion(identity);
    const q = `sessions?id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(userId)}`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        report_json: report,
        report_version: reportVersion,
        report_generated_at: new Date().toISOString(),
        // Reconcile the canonical sessions.score column with the report's
        // blended overall. save-session.ts first writes the QUICK eval
        // (/api/evaluate — raw LLM score) here; the report shows the richer
        // blended-and-anchored score (computeBlendedOverall). Without this
        // line the Sessions list / dashboard kept showing the quick number
        // while the report showed the blended one (e.g. 64 vs 51) for the
        // same session. Writing both in ONE atomic PATCH guarantees
        // report_json.overallScore and sessions.score can never diverge.
        score: report.overallScore,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[evaluate-session] cache write HTTP ${res.status}: ${body.slice(0, 200)}`);
    } else {
      await fulfilPracticeRequests(userId, sessionId);
    }
  } catch (err) {
    console.error(`[evaluate-session] cache write failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
