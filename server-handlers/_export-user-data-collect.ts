/* Gathers every user-scoped row for the data-portability export.
 * Split out of export-user-data.ts so the completeness behaviour (pagination,
 * visible failures, resume-file links) is unit-testable with an injected fetch. */

import {
  buildCandidateExportSpecs,
  buildExportEnvelope,
  fetchPaged,
  resumeFileRefs,
  shapeConversationsForExport,
  shapeMatchesForExport,
  shapeMessagesForExport,
  shapeStatusEventsForExport,
  stripResumeJoin,
  type ExportEnvelope,
  type ExportSpec,
  type PagedResult,
} from "./_export-user-data-helpers";

export const RESUME_FILES_BUCKET = "resume-files";
/** Signed resume-file links expire quickly: the export is a download, not a share. */
export const RESUME_LINK_TTL_SECONDS = 3600;

export interface CollectDeps {
  fetchImpl: typeof fetch;
  supabaseUrl: string;
  serviceKey: string;
  userId: string;
  userEmail: string;
  now?: () => string;
}

export interface CollectResult {
  envelope: ExportEnvelope;
  /** complete: everything loaded; partial: some tables failed/truncated; failed: nothing loaded. */
  status: "complete" | "partial" | "failed";
}

async function signResumeFiles(deps: CollectDeps, versions: unknown[]): Promise<{ files: unknown[]; failed: boolean }> {
  const refs = resumeFileRefs(versions);
  let failed = false;
  const files: unknown[] = [];
  for (const ref of refs) {
    try {
      const encoded = ref.file_path.split("/").map(encodeURIComponent).join("/");
      const r = await deps.fetchImpl(`${deps.supabaseUrl}/storage/v1/object/sign/${RESUME_FILES_BUCKET}/${encoded}`, {
        method: "POST",
        headers: { apikey: deps.serviceKey, Authorization: `Bearer ${deps.serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: RESUME_LINK_TTL_SECONDS }),
        signal: AbortSignal.timeout(8_000),
      });
      const body: unknown = r.ok ? await r.json() : null;
      const rel = body && typeof body === "object" ? (body as { signedURL?: unknown }).signedURL : null;
      if (typeof rel === "string" && rel) {
        files.push({
          version_id: ref.version_id,
          file_name: ref.file_name,
          download_url: `${deps.supabaseUrl}/storage/v1${rel.startsWith("/") ? "" : "/"}${rel}`,
          expires_in_seconds: RESUME_LINK_TTL_SECONDS,
        });
      } else {
        failed = true;
        files.push({ version_id: ref.version_id, file_name: ref.file_name, download_url: null });
      }
    } catch {
      failed = true;
      files.push({ version_id: ref.version_id, file_name: ref.file_name, download_url: null });
    }
  }
  return { files, failed };
}

export async function collectUserExport(deps: CollectDeps): Promise<CollectResult> {
  const { userId } = deps;
  const headers = { apikey: deps.serviceKey, Authorization: `Bearer ${deps.serviceKey}` };
  const errors: string[] = [];
  const truncated: string[] = [];
  const get = async (spec: ExportSpec): Promise<unknown[]> => {
    const r: PagedResult = await fetchPaged(deps.fetchImpl, deps.supabaseUrl, headers, spec);
    if (r.error) errors.push(spec.key);
    if (r.truncated) truncated.push(spec.key);
    return r.rows;
  };
  // Small waves instead of one burst of ~35 requests.
  const runAll = async (specs: ExportSpec[]): Promise<Record<string, unknown[]>> => {
    const out: Record<string, unknown[]> = {};
    for (let i = 0; i < specs.length; i += 8) {
      const wave = specs.slice(i, i + 8);
      const results = await Promise.all(wave.map(get));
      wave.forEach((s, j) => { out[s.key] = results[j]; });
    }
    return out;
  };

  const e = encodeURIComponent(userId);
  const candidateSpecs = buildCandidateExportSpecs(e);
  const agencySpecs: ExportSpec[] = [
    { key: "candidate_consent_log", path: `/rest/v1/candidate_consent_log?user_id=eq.${e}`, order: "created_at.desc,id.asc", optional: true },
    { key: "employer_blocks", path: `/rest/v1/employer_blocks?candidate_user_id=eq.${e}&select=created_at`, order: "created_at.desc", optional: true },
    { key: "employer_reports", path: `/rest/v1/employer_reports?reporter_user_id=eq.${e}&select=reason,note,status,created_at,reviewed_at`, order: "created_at.desc,id.asc", optional: true },
    {
      key: "requirement_matches",
      path: `/rest/v1/requirement_matches?candidate_user_id=eq.${e}&select=id,created_at,unlocked,unlocked_at,profile_viewed_at,candidate_status,candidate_response,candidate_responded_at,employer_requirements(title,employers(company_name))`,
      order: "created_at.desc,id.asc",
      optional: true,
    },
    { key: "match_status_events", path: `/rest/v1/match_status_events?candidate_user_id=eq.${e}&select=id,match_id,from_status,to_status,actor,note,created_at`, order: "created_at.desc,id.asc", optional: true },
    { key: "conversations", path: `/rest/v1/conversations?candidate_user_id=eq.${e}&select=id,match_id,created_at,last_message_at`, order: "created_at.desc,id.asc", optional: true },
    { key: "conversation_messages", path: `/rest/v1/conversation_messages?candidate_user_id=eq.${e}&select=id,conversation_id,sender_role,body,attachment_name,created_at`, order: "created_at.desc,id.asc", optional: true },
    { key: "employers", path: `/rest/v1/employers?id=eq.${e}`, order: "id.asc", optional: true },
  ];

  const total = candidateSpecs.length + agencySpecs.length;
  const t = await runAll([...candidateSpecs, ...agencySpecs]);

  const matches = shapeMatchesForExport(t.requirement_matches);
  const profileRow = (Array.isArray(t.profiles) && t.profiles[0] ? t.profiles[0] : null) as
    | { employer_visibility?: string | null; employer_visibility_updated_at?: string | null }
    | null;

  let employerAccount = null;
  let attempted = total;
  if (t.employers.length > 0) {
    const empSpecs: ExportSpec[] = [
      { key: "employer_requirements", path: `/rest/v1/employer_requirements?employer_id=eq.${e}`, order: "created_at.desc,id.asc" },
      { key: "employer_unlock_payments", path: `/rest/v1/employer_unlock_payments?employer_id=eq.${e}`, order: "created_at.desc,id.asc" },
      { key: "employer_unlock_orders", path: `/rest/v1/employer_unlock_orders?employer_id=eq.${e}`, order: "created_at.desc,id.asc" },
      { key: "employer_messages_sent", path: `/rest/v1/conversation_messages?employer_id=eq.${e}&sender_role=eq.employer&select=id,conversation_id,body,attachment_name,created_at`, order: "created_at.desc,id.asc" },
    ];
    const emp = await runAll(empSpecs);
    attempted += empSpecs.length;
    employerAccount = {
      employer: t.employers[0],
      requirements: emp.employer_requirements,
      unlock_payments: emp.employer_unlock_payments,
      unlock_orders: emp.employer_unlock_orders,
      messages_sent: shapeMessagesForExport(emp.employer_messages_sent),
    };
  }

  const versions = stripResumeJoin(t.resume_versions);
  const signed = await signResumeFiles(deps, versions);
  if (signed.failed) errors.push("resume_files");

  // Fixed envelope sections are populated explicitly; everything else is an extra table.
  const fixed = new Set(["profiles", "sessions", "calendar_events", "payments", "feedback", "interview_turns", "llm_usage"]);
  const handledElsewhere = new Set([
    ...fixed, ...agencySpecs.map((s) => s.key), "resume_versions",
  ]);
  const extra: Record<string, unknown[]> = {};
  for (const [key, rows] of Object.entries(t)) if (!handledElsewhere.has(key)) extra[key] = rows;
  extra.resume_versions = versions;
  extra.resume_files = signed.files;

  const envelope = buildExportEnvelope({
    userId,
    userEmail: deps.userEmail,
    exportedAt: deps.now?.(),
    profile: t.profiles,
    sessions: t.sessions,
    calendar_events: t.calendar_events,
    payments: t.payments,
    feedback: t.feedback,
    interview_turns: t.interview_turns,
    llm_usage: t.llm_usage,
    extra_tables: extra,
    errors,
    truncated,
    employer_discovery: {
      visibility: profileRow?.employer_visibility ?? null,
      visibility_updated_at: profileRow?.employer_visibility_updated_at ?? null,
      consent_log: t.candidate_consent_log,
      blocks: t.employer_blocks,
      reports_filed: t.employer_reports,
      matches: matches.shaped,
      status_events: shapeStatusEventsForExport(t.match_status_events, matches.unlockedIds),
      conversations: shapeConversationsForExport(t.conversations, matches.companyByMatch),
      messages: shapeMessagesForExport(t.conversation_messages),
    },
    employer_account: employerAccount,
  });

  const tableErrors = errors.filter((k) => k !== "resume_files").length;
  const status = errors.length === 0 && truncated.length === 0 ? "complete" : tableErrors >= attempted ? "failed" : "partial";
  return { envelope, status };
}
