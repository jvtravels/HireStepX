/* Vercel Serverless Function — GDPR Data Export
 * Returns all user data as a JSON download for "right to data portability" compliance.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withNodeAuthAndRateLimit, supabaseUrl } from "./_shared";
import {
  buildExportEnvelope,
  buildExportFilename,
  pickProfileRow,
  shapeConversationsForExport,
  shapeMatchesForExport,
  shapeMessagesForExport,
  shapeStatusEventsForExport,
} from "./_export-user-data-helpers";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("X-Request-ID", crypto.randomUUID());

  const pre = await withNodeAuthAndRateLimit(req, res, {
    endpoint: "export-user-data",
    ipLimit: 3,
    allowGet: true,
  });
  if (pre.handled) return;
  const { userId, userEmail = "" } = pre;

  const SUPABASE_URL = supabaseUrl();
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };
  const encodedId = encodeURIComponent(userId);

  // Fetch all user-owned rows in parallel (gracefully handle missing tables)
  async function safeFetch(path: string): Promise<unknown[]> {
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 8000);
      const r = await fetch(`${SUPABASE_URL}${path}`, { headers, signal: ac.signal });
      clearTimeout(timer);
      if (!r.ok) return [];
      return await r.json();
    } catch { return []; }
  }

  const [profile, sessions, events, payments, feedback, interviewTurns, llmUsage] = await Promise.all([
    safeFetch(`/rest/v1/profiles?id=eq.${encodedId}`),
    safeFetch(`/rest/v1/sessions?user_id=eq.${encodedId}&order=created_at.desc`),
    safeFetch(`/rest/v1/calendar_events?user_id=eq.${encodedId}&order=date.desc`),
    safeFetch(`/rest/v1/payments?user_id=eq.${encodedId}&order=created_at.desc`),
    safeFetch(`/rest/v1/feedback?user_id=eq.${encodedId}`),
    safeFetch(`/rest/v1/interview_turns?user_id=eq.${encodedId}&order=created_at.desc&limit=5000`),
    safeFetch(`/rest/v1/llm_usage?user_id=eq.${encodedId}&order=created_at.desc&limit=1000`),
  ]);

  // Candidate-agency + employer-feature data (DPDP right of access). Employer
  // identity is only shaped in for matches the employer unlocked.
  const [consentLog, blocks, reportsFiled, rawMatches, rawEvents, rawConversations, rawMessages, employerRows] = await Promise.all([
    safeFetch(`/rest/v1/candidate_consent_log?user_id=eq.${encodedId}&order=created_at.desc&limit=500`),
    safeFetch(`/rest/v1/employer_blocks?candidate_user_id=eq.${encodedId}&select=created_at`),
    safeFetch(`/rest/v1/employer_reports?reporter_user_id=eq.${encodedId}&select=reason,note,status,created_at,reviewed_at&order=created_at.desc`),
    safeFetch(
      `/rest/v1/requirement_matches?candidate_user_id=eq.${encodedId}` +
        `&select=id,created_at,unlocked,unlocked_at,profile_viewed_at,candidate_status,candidate_response,candidate_responded_at,employer_requirements(title,employers(company_name))` +
        `&order=created_at.desc&limit=2000`,
    ),
    safeFetch(`/rest/v1/match_status_events?candidate_user_id=eq.${encodedId}&select=id,match_id,from_status,to_status,actor,note,created_at&order=created_at.desc&limit=5000`),
    safeFetch(`/rest/v1/conversations?candidate_user_id=eq.${encodedId}&select=id,match_id,created_at,last_message_at`),
    safeFetch(`/rest/v1/conversation_messages?candidate_user_id=eq.${encodedId}&select=id,conversation_id,sender_role,body,attachment_name,created_at&order=created_at.desc&limit=5000`),
    safeFetch(`/rest/v1/employers?id=eq.${encodedId}`),
  ]);
  const matches = shapeMatchesForExport(rawMatches);
  const profileRow = pickProfileRow(profile) as { employer_visibility?: string | null; employer_visibility_updated_at?: string | null } | null;

  // Employer accounts additionally get their own side (company profile, jobs, payment ledger).
  let employerAccount = null;
  if (employerRows.length > 0) {
    const [requirements, unlockPayments, unlockOrders, messagesSent] = await Promise.all([
      safeFetch(`/rest/v1/employer_requirements?employer_id=eq.${encodedId}&order=created_at.desc`),
      safeFetch(`/rest/v1/employer_unlock_payments?employer_id=eq.${encodedId}&order=created_at.desc`),
      safeFetch(`/rest/v1/employer_unlock_orders?employer_id=eq.${encodedId}&order=created_at.desc`),
      safeFetch(`/rest/v1/conversation_messages?employer_id=eq.${encodedId}&sender_role=eq.employer&select=id,conversation_id,body,attachment_name,created_at&order=created_at.desc&limit=5000`),
    ]);
    employerAccount = { employer: employerRows[0], requirements, unlock_payments: unlockPayments, unlock_orders: unlockOrders, messages_sent: shapeMessagesForExport(messagesSent) };
  }

  const exportData = buildExportEnvelope({
    userId,
    userEmail,
    profile,
    sessions,
    calendar_events: events,
    payments,
    feedback,
    interview_turns: interviewTurns,
    llm_usage: llmUsage,
    employer_discovery: {
      visibility: profileRow?.employer_visibility ?? null,
      visibility_updated_at: profileRow?.employer_visibility_updated_at ?? null,
      consent_log: consentLog,
      blocks,
      reports_filed: reportsFiled,
      matches: matches.shaped,
      status_events: shapeStatusEventsForExport(rawEvents, matches.unlockedIds),
      conversations: shapeConversationsForExport(rawConversations, matches.companyByMatch),
      messages: shapeMessagesForExport(rawMessages),
    },
    employer_account: employerAccount,
  });

  const filename = buildExportFilename(userId);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.status(200).send(JSON.stringify(exportData, null, 2));
}
