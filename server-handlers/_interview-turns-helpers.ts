/* Pure validation for the idempotent interview-turns endpoint. */

export const MAX_TURNS_PER_REQUEST = 100;
export const MAX_TURN_CONTENT = 20_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TURN_TYPES = new Set(["session_start", "question", "answer", "follow_up"]);
const SPEAKERS = new Set(["ai", "user", "system"]);

export interface ValidTurn {
  id: string;
  session_id: string;
  user_id: string;
  turn_index: number;
  turn_type: "session_start" | "question" | "answer" | "follow_up";
  speaker: "ai" | "user" | "system";
  content: string;
  metadata: Record<string, unknown> | null;
}

export interface TurnValidation {
  valid: ValidTurn[];
  /** Ids (or null when unreadable) of turns that can never succeed — drop them client-side. */
  invalid: Array<{ id: string | null; reason: string }>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** `user_id` is always forced from the verified auth context, never the body. */
export function validateTurns(raw: unknown, userId: string): TurnValidation {
  const out: TurnValidation = { valid: [], invalid: [] };
  if (!Array.isArray(raw)) return out;
  const seen = new Set<string>();
  for (const item of raw.slice(0, MAX_TURNS_PER_REQUEST)) {
    if (!isRecord(item)) { out.invalid.push({ id: null, reason: "not_object" }); continue; }
    const id = typeof item.id === "string" ? item.id : null;
    if (!id || !UUID_RE.test(id)) { out.invalid.push({ id: null, reason: "bad_id" }); continue; }
    if (seen.has(id)) continue;
    seen.add(id);
    const sessionId = typeof item.session_id === "string" ? item.session_id.trim() : "";
    if (!sessionId || sessionId.length > 64) { out.invalid.push({ id, reason: "bad_session" }); continue; }
    const turnIndex = item.turn_index;
    if (typeof turnIndex !== "number" || !Number.isInteger(turnIndex) || turnIndex < 0 || turnIndex > 10_000) {
      out.invalid.push({ id, reason: "bad_turn_index" }); continue;
    }
    if (typeof item.turn_type !== "string" || !TURN_TYPES.has(item.turn_type)) { out.invalid.push({ id, reason: "bad_turn_type" }); continue; }
    if (typeof item.speaker !== "string" || !SPEAKERS.has(item.speaker)) { out.invalid.push({ id, reason: "bad_speaker" }); continue; }
    const content = typeof item.content === "string" ? item.content.slice(0, MAX_TURN_CONTENT) : "";
    out.valid.push({
      id,
      session_id: sessionId,
      user_id: userId,
      turn_index: turnIndex,
      turn_type: item.turn_type as ValidTurn["turn_type"],
      speaker: item.speaker as ValidTurn["speaker"],
      content,
      metadata: isRecord(item.metadata) ? item.metadata : null,
    });
  }
  return out;
}

/** Partition valid turns by whether their session row exists for this user. */
export function partitionBySession(turns: ValidTurn[], ownedSessionIds: ReadonlySet<string>): { accepted: ValidTurn[]; missingSession: ValidTurn[] } {
  const accepted: ValidTurn[] = [];
  const missingSession: ValidTurn[] = [];
  for (const t of turns) (ownedSessionIds.has(t.session_id) ? accepted : missingSession).push(t);
  return { accepted, missingSession };
}
