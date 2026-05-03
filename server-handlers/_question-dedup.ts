/* HireStepX — Question-bank dedup helper

   Pro-tier users do up to 30 sessions per month. Without dedup, the
   LLM happily regenerates the same "tell me about a time you led a
   team" question across sessions and the user hits visible repeats
   in week 2 — the silent-killer churn pattern: they don't complain,
   they just stop showing up.

   The existing prompt has an `avoidTopics` clause, but it relies on
   the CLIENT passing `pastTopics` in the request body. If the client
   omits it (race conditions, older app versions, direct API calls),
   the LLM has no signal and dedup quietly stops working.

   This helper closes that loop server-side: given a userId, pull the
   most recent N sessions for the same (role, focus) tuple, extract
   the interviewer turns from their transcripts, and return a deduped
   list of question texts. Caller threads the result into the prompt
   regardless of what the client sent.

   Pure-ish — only depends on fetch (injectable). Edge-runtime safe. */

export interface PastQuestionLookupInput {
  supabaseUrl: string;
  serviceKey: string;
  userId: string;
  /** Match sessions of this type (e.g. "behavioral", "hr-round"). Empty = match all. */
  type?: string;
  /** Match sessions on this focus tag (e.g. "stakeholder-management"). Empty = match all. */
  focus?: string;
  /** How far back to look. 30 sessions ≈ a Pro user's monthly cap. */
  sessionLimit?: number;
  /** Cap the returned question list at this length. The prompt has a
   *  ~20-item slice anyway; pulling more wastes tokens. */
  questionLimit?: number;
  fetchImpl?: typeof fetch;
}

interface TranscriptTurn {
  role?: string;
  text?: string;
}

interface SessionRow {
  id?: string;
  transcript?: TranscriptTurn[] | null;
  ai_feedback?: string | null;
}

/** Pull recent question texts the user has been asked, for use as a
 *  server-side anti-repetition signal in the question-generation
 *  prompt. Returns an empty array on any failure (network, schema
 *  drift, no sessions yet) — never throws. */
export async function fetchRecentQuestions(
  input: PastQuestionLookupInput,
): Promise<string[]> {
  const {
    supabaseUrl,
    serviceKey,
    userId,
    type = "",
    focus = "",
    sessionLimit = 30,
    questionLimit = 40,
    fetchImpl = globalThis.fetch,
  } = input;

  if (!supabaseUrl || !serviceKey || !userId) return [];

  // Build the PostgREST query. We filter by user_id, optionally by type
  // and focus, order newest first, and select only the columns we need
  // (transcript) to keep the response small. Limit at the SQL level to
  // bound payload size.
  const params = new URLSearchParams();
  params.set("user_id", `eq.${userId}`);
  params.set("select", "id,transcript");
  params.set("order", "created_at.desc");
  params.set("limit", String(Math.max(1, Math.min(100, sessionLimit))));
  if (type) params.set("type", `eq.${type}`);
  if (focus) params.set("focus", `eq.${focus}`);

  const url = `${supabaseUrl}/rest/v1/sessions?${params.toString()}`;

  let rows: SessionRow[] = [];
  try {
    const res = await fetchImpl(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    if (!res.ok) return [];
    rows = (await res.json().catch(() => [])) as SessionRow[];
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];

  return extractRecentQuestions(rows, questionLimit);
}

/** Pure logic — extract interviewer turns from a list of session
 *  rows, dedup by normalized text, return up to `limit` questions
 *  in newest-first order. Exposed for unit testing. */
export function extractRecentQuestions(
  rows: SessionRow[],
  limit = 40,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const turns = Array.isArray(row.transcript) ? row.transcript : [];
    for (const turn of turns) {
      if (!turn || typeof turn !== "object") continue;
      const role = typeof turn.role === "string" ? turn.role.toLowerCase() : "";
      // Match common interviewer-turn role labels. Be tolerant —
      // older schema variants used "ai", "assistant", "system".
      if (
        role !== "interviewer" &&
        role !== "ai" &&
        role !== "assistant"
      ) {
        continue;
      }
      const text = typeof turn.text === "string" ? turn.text.trim() : "";
      if (!text || text.length < 10) continue; // too short to be a real question
      // Normalize for dedup: collapse whitespace, lowercase, strip
      // trailing punctuation. Two questions that differ only in
      // wording flourishes shouldn't both surface.
      const key = text
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[?.!]+$/, "")
        .trim();
      if (seen.has(key)) continue;
      seen.add(key);
      // Cap individual entries at 200 chars — prompt-token economy.
      out.push(text.slice(0, 200));
      if (out.length >= limit) return out;
    }
  }
  return out;
}
