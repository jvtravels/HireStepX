/* Pure helpers for the employer-console CSP report-only trial. */

export const CSP_REPORT_PATH = "/api/csp-report";

/* Same policy the page already enforces, minus 'unsafe-inline' in the script
   directives. Sent as Report-Only so nothing breaks; each report names an
   inline script that would need a nonce before the real switch. */
export function reportOnlyCsp(enforced: string): string {
  return enforced
    .split("; ")
    .map((d) => (d.startsWith("script-src") ? d.replace(" 'unsafe-inline'", "") : d))
    .concat(`report-uri ${CSP_REPORT_PATH}`)
    .join("; ");
}

export function isEmployerConsolePath(pathname: string): boolean {
  return pathname === "/employer" || pathname.startsWith("/employer/");
}

/* Candidate and job ids in a page address are replaced so reports carry no ids. */
function stripIds(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .slice(0, 300)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/[?#].*$/, "");
}

function clip(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.slice(0, max) : "";
}

export interface CspViolationSummary {
  directive: string;
  blocked: string;
  page: string;
  source: string;
  sample: string;
}

/* Handles both the legacy `application/csp-report` body ({"csp-report": {...}})
   and the Reporting API body (an array of {type, body}). */
export function summarizeCspReports(payload: unknown): CspViolationSummary[] {
  const items: unknown[] = Array.isArray(payload) ? payload : [payload];
  const out: CspViolationSummary[] = [];
  for (const item of items.slice(0, 10)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const body = (rec["csp-report"] ?? rec.body) as Record<string, unknown> | undefined;
    if (!body || typeof body !== "object") continue;
    out.push({
      directive: clip(body["effective-directive"] ?? body.effectiveDirective ?? body["violated-directive"] ?? body.violatedDirective, 60),
      blocked: stripIds(body["blocked-uri"] ?? body.blockedURL) || clip(body["blocked-uri"] ?? body.blockedURL, 60),
      page: stripIds(body["document-uri"] ?? body.documentURL),
      source: stripIds(body["source-file"] ?? body.sourceFile),
      sample: clip(body["script-sample"] ?? body.sample, 80),
    });
  }
  return out;
}
