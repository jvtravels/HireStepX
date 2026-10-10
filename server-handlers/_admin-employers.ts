/* Admin employer moderation: tier (verify / unverify), suspend / unsuspend, and
 * the candidate-report queue (reports are filed via /api/candidate-employer-actions).
 *
 * Pure decision helpers are exported separately from the I/O functions so they
 * can be unit-tested (src/__tests__/adminEmployers.test.ts). The admin session
 * is one shared password with no per-person identity, so suspension reasons are
 * prefixed "admin:" to tell them apart from "auto: N candidate reports". */

import { fetchJSON, supa, ValidationError } from "./_admin-shared";
import { slog } from "./_shared";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IN_CHUNK = 80;
const REASON_MAX = 300;

export const EMPLOYER_TIERS = ["basic", "email_verified", "verified"] as const;
export type EmployerTier = (typeof EMPLOYER_TIERS)[number];

export const REPORT_STATUSES = ["open", "reviewed", "actioned", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type ResolvedReportStatus = Exclude<ReportStatus, "open">;

export function isEmployerUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export function parseEmployerTier(v: unknown): EmployerTier {
  if (typeof v === "string" && (EMPLOYER_TIERS as readonly string[]).includes(v)) return v as EmployerTier;
  throw new ValidationError("tier must be basic | email_verified | verified");
}

/** verified_at records when the employer first reached a verified tier; basic clears it. */
export function buildTierPatch(tier: EmployerTier, now: string): { verification_tier: EmployerTier; verified_at: string | null } {
  return { verification_tier: tier, verified_at: tier === "basic" ? null : now };
}

/** Required, trimmed, control-char-free. A suspension with no reason is an unaccountable one. */
export function parseSuspendReason(v: unknown): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, REASON_MAX) : "";
  if (!cleaned) throw new ValidationError("reason required");
  return cleaned;
}

export function buildSuspendPatch(reason: string, now: string): { suspended_at: string; suspended_reason: string } {
  return { suspended_at: now, suspended_reason: `admin: ${reason}` };
}

export function buildUnsuspendPatch(): { suspended_at: null; suspended_reason: null } {
  return { suspended_at: null, suspended_reason: null };
}

export function parseReportFilter(v: unknown): ReportStatus | "all" {
  if (v === undefined || v === null || v === "") return "open";
  if (v === "all") return "all";
  if (typeof v === "string" && (REPORT_STATUSES as readonly string[]).includes(v)) return v as ReportStatus;
  throw new ValidationError("status must be open | reviewed | actioned | dismissed | all");
}

export function parseResolveStatus(v: unknown): ResolvedReportStatus {
  if (v === "reviewed" || v === "actioned" || v === "dismissed") return v;
  throw new ValidationError("status must be reviewed | actioned | dismissed");
}

/** open -> anything; reviewed -> actioned | dismissed; actioned / dismissed are final
 *  (a dismissed report is excluded from the auto-suspend count, so flipping it back
 *  silently would change suspension maths). */
export function canTransitionReport(from: ReportStatus, to: ResolvedReportStatus): boolean {
  if (from === "open") return true;
  if (from === "reviewed") return to === "actioned" || to === "dismissed";
  return false;
}

export interface EmployerListRow {
  id: string;
  company_name: string | null;
  website: string | null;
  verification_tier: string | null;
  verified_at: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  submitted_at: string | null;
}

export function summarizeEmployers(
  employers: EmployerListRow[],
  openReports: Array<{ employer_id: string }>,
  payments: Array<{ employer_id: string; amount: number | null; status: string | null }>,
  contacts: Map<string, { name: string; email: string }>,
) {
  const openCount = new Map<string, number>();
  for (const r of openReports) openCount.set(r.employer_id, (openCount.get(r.employer_id) ?? 0) + 1);
  const revenue = new Map<string, number>();
  for (const p of payments) {
    // Admin grants are zero-amount rows with status "admin_grant"; only paid unlocks are revenue.
    if (p.status !== "completed" || typeof p.amount !== "number") continue;
    revenue.set(p.employer_id, (revenue.get(p.employer_id) ?? 0) + p.amount);
  }
  return employers.map((e) => ({
    id: e.id,
    companyName: e.company_name ?? "",
    website: e.website ?? "",
    submittedAt: e.submitted_at,
    tier: e.verification_tier ?? "basic",
    verifiedAt: e.verified_at,
    suspended: !!e.suspended_at,
    suspendedAt: e.suspended_at,
    suspendedReason: e.suspended_reason,
    openReports: openCount.get(e.id) ?? 0,
    unlockRevenuePaise: revenue.get(e.id) ?? 0,
    contactName: contacts.get(e.id)?.name ?? "(deleted user)",
    contactEmail: contacts.get(e.id)?.email ?? "—",
  }));
}

/* ── I/O ── */

async function patchEmployer(employerId: string, patch: Record<string, unknown>, extraFilter = ""): Promise<boolean> {
  const res = await supa(`employers?id=eq.${encodeURIComponent(employerId)}${extraFilter}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    slog.error("admin-employers: employer PATCH failed", { status: res.status });
    throw new Error("Employer update failed");
  }
  const rows = (await res.json().catch(() => [])) as unknown[];
  return rows.length > 0;
}

export async function listEmployers() {
  const employers = await fetchJSON<EmployerListRow>(
    "employers?select=id,company_name,website,verification_tier,verified_at,suspended_at,suspended_reason,submitted_at&order=submitted_at.desc&limit=1000",
  );
  const [openReports, payments] = await Promise.all([
    fetchJSON<{ employer_id: string }>("employer_reports?status=eq.open&select=employer_id&limit=5000"),
    fetchJSON<{ employer_id: string; amount: number | null; status: string | null }>("employer_unlock_payments?select=employer_id,amount,status&limit=10000"),
  ]);
  const contacts = new Map<string, { name: string; email: string }>();
  const ids = employers.map((e) => encodeURIComponent(e.id));
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const rows = await fetchJSON<{ id: string; name: string | null; email: string }>(
      `profiles?id=in.(${ids.slice(i, i + IN_CHUNK).join(",")})&select=id,name,email`,
    );
    for (const p of rows) contacts.set(p.id, { name: p.name || "(no name)", email: p.email });
  }
  const rows = summarizeEmployers(employers, openReports, payments, contacts);
  return { total: rows.length, rows };
}

export async function setEmployerTier(employerId: unknown, tier: unknown) {
  if (!isEmployerUuid(employerId)) throw new ValidationError("employerId required");
  const patch = buildTierPatch(parseEmployerTier(tier), new Date().toISOString());
  if (!(await patchEmployer(employerId, patch))) throw new ValidationError("Employer not found");
  return { ok: true, employerId, ...patch };
}

export async function suspendEmployer(employerId: unknown, reason: unknown) {
  if (!isEmployerUuid(employerId)) throw new ValidationError("employerId required");
  const patch = buildSuspendPatch(parseSuspendReason(reason), new Date().toISOString());
  if (!(await patchEmployer(employerId, patch))) throw new ValidationError("Employer not found");
  slog.warn("admin-employers: employer suspended", { employerId });
  return { ok: true, employerId, ...patch };
}

export async function unsuspendEmployer(employerId: unknown) {
  if (!isEmployerUuid(employerId)) throw new ValidationError("employerId required");
  const patch = buildUnsuspendPatch();
  if (!(await patchEmployer(employerId, patch))) throw new ValidationError("Employer not found");
  return { ok: true, employerId, ...patch };
}

export async function listEmployerReports(filter: unknown, employerId?: unknown) {
  const status = parseReportFilter(filter);
  let q = "employer_reports?select=id,employer_id,match_id,reason,note,status,created_at,reviewed_at&order=created_at.desc&limit=200";
  if (status !== "all") q += `&status=eq.${status}`;
  if (employerId !== undefined && employerId !== null && employerId !== "") {
    if (!isEmployerUuid(employerId)) throw new ValidationError("employerId must be a uuid");
    q += `&employer_id=eq.${encodeURIComponent(employerId)}`;
  }
  const reports = await fetchJSON<{ id: string; employer_id: string; match_id: string | null; reason: string; note: string | null; status: string; created_at: string; reviewed_at: string | null }>(q);
  const ids = [...new Set(reports.map((r) => r.employer_id))].map(encodeURIComponent);
  const employers = new Map<string, { company_name: string | null; suspended_at: string | null; verification_tier: string | null }>();
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const rows = await fetchJSON<{ id: string; company_name: string | null; suspended_at: string | null; verification_tier: string | null }>(
      `employers?id=in.(${ids.slice(i, i + IN_CHUNK).join(",")})&select=id,company_name,suspended_at,verification_tier`,
    );
    for (const e of rows) employers.set(e.id, e);
  }
  return {
    total: reports.length,
    rows: reports.map((r) => ({
      id: r.id,
      employerId: r.employer_id,
      companyName: employers.get(r.employer_id)?.company_name ?? "(deleted employer)",
      employerSuspended: !!employers.get(r.employer_id)?.suspended_at,
      employerTier: employers.get(r.employer_id)?.verification_tier ?? "basic",
      matchId: r.match_id,
      reason: r.reason,
      note: r.note,
      status: r.status,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
    })),
  };
}

export async function resolveEmployerReport(reportId: unknown, status: unknown) {
  if (!isEmployerUuid(reportId)) throw new ValidationError("reportId required");
  const to = parseResolveStatus(status);
  const current = await fetchJSON<{ status: ReportStatus }>(`employer_reports?id=eq.${encodeURIComponent(reportId)}&select=status&limit=1`);
  if (!current[0]) throw new ValidationError("Report not found");
  if (!canTransitionReport(current[0].status, to)) {
    throw new ValidationError(`Report is already ${current[0].status}`);
  }
  const reviewedAt = new Date().toISOString();
  // CAS on the status we read so two admins can't both resolve the same report differently.
  const res = await supa(`employer_reports?id=eq.${encodeURIComponent(reportId)}&status=eq.${current[0].status}`, {
    method: "PATCH",
    body: JSON.stringify({ status: to, reviewed_at: reviewedAt }),
  });
  if (!res.ok) {
    slog.error("admin-employers: report PATCH failed", { status: res.status });
    throw new Error("Report update failed");
  }
  const rows = (await res.json().catch(() => [])) as unknown[];
  if (rows.length === 0) throw new ValidationError("Report changed concurrently, refresh and retry");
  return { ok: true, reportId, status: to, reviewedAt };
}
