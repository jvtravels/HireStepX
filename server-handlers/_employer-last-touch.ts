/* "Last updated by" for candidates, read from the team audit log so it needs no
   schema change. Best-effort: on any failure the candidate simply shows no line. */

export interface LastTouch {
  name: string;
  isYou: boolean;
  at: string;
}

const TOUCH_ACTIONS = ["candidate.unlocked", "candidate.status_changed", "candidate.note_updated"];
const BATCH = 50;

type Fetch = typeof fetch;
type LogRow = { entity_id: string | null; actor_user_id: string | null; created_at: string };

export async function loadLastTouch(opts: {
  supabaseUrl: string;
  headers: Record<string, string>;
  employerId: string;
  viewerId: string;
  matchIds: string[];
  fetchImpl?: Fetch;
}): Promise<Map<string, LastTouch>> {
  const out = new Map<string, LastTouch>();
  const f = opts.fetchImpl ?? fetch;
  if (!opts.matchIds.length) return out;
  const eid = encodeURIComponent(opts.employerId);
  try {
    const batches: string[][] = [];
    for (let i = 0; i < opts.matchIds.length; i += BATCH) batches.push(opts.matchIds.slice(i, i + BATCH));
    const [rosterRes, ...logRes] = await Promise.all([
      f(`${opts.supabaseUrl}/rest/v1/employer_members?employer_id=eq.${eid}&select=user_id,name,email`, { headers: opts.headers }),
      ...batches.map((ids) =>
        f(
          `${opts.supabaseUrl}/rest/v1/employer_audit_log?employer_id=eq.${eid}&entity_type=eq.match` +
            `&entity_id=in.(${ids.map(encodeURIComponent).join(",")})&action=in.(${TOUCH_ACTIONS.join(",")})` +
            `&select=entity_id,actor_user_id,created_at&order=created_at.desc&limit=1000`,
          { headers: opts.headers },
        ),
      ),
    ]);
    if (!rosterRes.ok || logRes.some((r) => !r.ok)) return out;
    const roster = (await rosterRes.json()) as Array<{ user_id: string; name: string | null; email: string }>;
    const names = new Map(roster.map((m) => [m.user_id, m.name || m.email]));
    for (const res of logRes) {
      for (const row of (await res.json()) as LogRow[]) {
        if (!row.entity_id || !row.actor_user_id || out.has(row.entity_id)) continue;
        out.set(row.entity_id, {
          name: names.get(row.actor_user_id) ?? "A former member",
          isYou: row.actor_user_id === opts.viewerId,
          at: row.created_at,
        });
      }
    }
  } catch {
    return new Map();
  }
  return out;
}
