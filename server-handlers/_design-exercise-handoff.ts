/* Design Interview Loop — Portfolio Review → Design Exercise handoff
 * (Stage 4 of the approved CEO brief "Role-Based Interviews: Product
 * Designer Track"). One-way only: only a Design Exercise session reads
 * this, and only from the candidate's own most recent Portfolio Review
 * session. No other round is affected.
 *
 * Mirrors _question-dedup.ts's fetch pattern (service-role REST read,
 * best-effort, never throws) and reuses extractEvidenceQuotes, the same
 * grounded-quote source the employer evidence view already reads — a
 * win's `quote` is already checked to be a real substring of the
 * candidate's transcript (filterGroundedItems in evaluate-session.ts),
 * so this doesn't re-validate grounding. */

import { extractEvidenceQuotes } from "./_employer-candidate-evidence-helpers";

export interface PortfolioHandoffLookupInput {
  supabaseUrl: string;
  serviceKey: string;
  userId: string;
  fetchImpl?: typeof fetch;
}

interface SessionRow {
  report_json?: unknown;
}

/** Pulls the candidate's most recent completed Portfolio Review session
 *  and reduces its report to one short handoff sentence for the Design
 *  Exercise prompt. Returns null on any failure (network, no completed
 *  Portfolio Review yet, malformed report) — never throws; the caller
 *  treats null as "no handoff this time," not an error. */
export async function fetchPortfolioReviewHandoff(
  input: PortfolioHandoffLookupInput,
): Promise<string | null> {
  const { supabaseUrl, serviceKey, userId, fetchImpl = globalThis.fetch } = input;
  if (!supabaseUrl || !serviceKey || !userId) return null;

  const params = new URLSearchParams();
  params.set("user_id", `eq.${userId}`);
  params.set("type", "eq.portfolio-review");
  params.set("report_json", "not.is.null");
  params.set("select", "report_json");
  params.set("order", "created_at.desc");
  params.set("limit", "1");

  const url = `${supabaseUrl}/rest/v1/sessions?${params.toString()}`;

  let rows: SessionRow[] = [];
  try {
    const res = await fetchImpl(url, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!res.ok) return null;
    rows = (await res.json().catch(() => [])) as SessionRow[];
  } catch {
    return null;
  }
  if (!Array.isArray(rows) || rows.length === 0) return null;

  return extractPortfolioHandoffNote(rows[0]?.report_json);
}

/** Pure logic — reduces a Portfolio Review session's report_json to one
 *  short handoff note. Prefers a grounded "win" (a declarative statement
 *  already checked against the candidate's own words) over any other
 *  field, since that's what makes "you mentioned X" land as genuine
 *  rather than generic. Exposed for unit testing. */
export function extractPortfolioHandoffNote(reportJson: unknown): string | null {
  const win = extractEvidenceQuotes(reportJson).find((q) => q.kind === "win");
  return win ? win.text : null;
}
