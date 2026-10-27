/* Audit entry for an employer message to a candidate.
 *
 * One entry per burst, not per message: a back-and-forth chat would otherwise
 * bury every other event in the Activity feed. A new entry is written when the
 * same teammate has not messaged this candidate in the last WINDOW. The message
 * text is never logged, only who wrote to whom and about which job. */

import { writeAuditLog } from "./_employer-team-helpers";

export const MESSAGE_AUDIT_WINDOW_MS = 30 * 60_000;

export async function logEmployerMessage(p: {
  supabaseUrl: string;
  headers: Record<string, string>;
  employerId: string;
  actorUserId: string;
  actorEmail?: string | null;
  matchId: string;
  candidateName: string | null;
  jobTitle: string | null;
  hasAttachment: boolean;
  now?: number;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const f = p.fetchImpl ?? fetch;
  const since = new Date((p.now ?? Date.now()) - MESSAGE_AUDIT_WINDOW_MS).toISOString();
  try {
    const res = await f(
      `${p.supabaseUrl}/rest/v1/employer_audit_log?employer_id=eq.${encodeURIComponent(p.employerId)}` +
        `&actor_user_id=eq.${encodeURIComponent(p.actorUserId)}&action=eq.candidate.messaged` +
        `&entity_id=eq.${encodeURIComponent(p.matchId)}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=1`,
      { headers: p.headers },
    );
    // A failed lookup logs anyway: a duplicate entry is better than a silent gap.
    if (res.ok) {
      const rows: unknown = await res.json().catch(() => []);
      if (Array.isArray(rows) && rows.length > 0) return false;
    }
  } catch {
    /* fall through to writing the entry */
  }
  return writeAuditLog(p.supabaseUrl, p.headers, {
    employerId: p.employerId,
    actorUserId: p.actorUserId,
    actorEmail: p.actorEmail ?? null,
    action: "candidate.messaged",
    entityType: "match",
    entityId: p.matchId,
    meta: { candidateName: p.candidateName, jobTitle: p.jobTitle, hasAttachment: p.hasAttachment },
  }, f);
}
