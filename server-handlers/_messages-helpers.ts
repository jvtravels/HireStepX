/* Pure helpers for the employer<->candidate messaging handlers
 * (messages.ts, flag-message.ts, message-attachment-upload.ts).
 *
 * Contact-info detection mirrors Upwork's circumvention policy with one
 * deliberate difference: per product decision, it FLAGS rather than BLOCKS.
 * Candidates in the India market default to sharing a WhatsApp number as
 * their off-platform contact method, so the phone pattern is tuned for
 * Indian formats (+91, 10-digit) as well as generic ones.
 */

export type MessageRole = "employer" | "candidate";
export type MessageSenderRole = MessageRole | "system";

export const MAX_MESSAGE_BODY_LEN = 4000;
export const MAX_FLAG_NOTE_LEN = 500;

/** Trims and caps a message body. Returns "" (not null) for an empty/invalid
 *  body so callers can still allow an attachment-only message. */
export function asMessageBody(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_MESSAGE_BODY_LEN);
}

export function asFlagReason(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().slice(0, 100);
  return trimmed;
}

export function asFlagNote(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, MAX_FLAG_NOTE_LEN);
  return trimmed || null;
}

/** Given the authenticated caller and the two parties on a conversation,
 *  resolves which side they are (or null if neither — caller must then 403). */
export function resolveRole(authUserId: string, employerId: string, candidateUserId: string): MessageRole | null {
  if (authUserId === employerId) return "employer";
  if (authUserId === candidateUserId) return "candidate";
  return null;
}

/** A conversation is unread for a viewer when its most recent message came
 *  from the other side (or the system) and landed after the viewer's own
 *  last-read mark — never when the viewer sent that last message themself. */
export function isConversationUnread(
  viewerRole: MessageRole,
  lastMessageAt: string | null,
  lastSenderRole: MessageSenderRole | null,
  viewerLastReadAt: string | null,
): boolean {
  if (!lastMessageAt || !lastSenderRole) return false;
  if (lastSenderRole === viewerRole) return false;
  if (!viewerLastReadAt) return true;
  return new Date(lastMessageAt).getTime() > new Date(viewerLastReadAt).getTime();
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

// Indian mobile numbers are most commonly shared as a bare 10-digit number
// starting 6-9, optionally prefixed +91/91/0, with optional spaces/dashes.
// International E.164-ish numbers are also caught as a fallback.
const PHONE_RE =
  /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b|(?:\+?91[\s-]?)?[6-9]\d{9}\b|\+\d{1,3}[\s-]?\d{3,4}[\s-]?\d{3,4}[\s-]?\d{0,4}\b/;

const SPELLED_DIGIT_RE =
  /\b(?:zero|one|two|three|four|five|six|seven|eight|nine)\b(?:[\s,.-]+\b(?:zero|one|two|three|four|five|six|seven|eight|nine)\b){6,}/i;

// Mentioning any of these app names, or a "DM/text/call/contact me on/at"
// construction, is itself the off-platform-diversion signal regardless of
// word order — not trying to parse full sentences, just flag for review.
const OFF_PLATFORM_PHRASE_RE =
  /\b(whatsapp|telegram|skype|wechat|signal app|instagram|insta dm)\b|\b(dm|text|message|call|contact|reach)\s+me\s+(on|at|via)\b|\bmy\s+(number|email|whatsapp|insta|instagram)\s+is\b/i;

/** Scans an outgoing message body for contact info / off-platform-contact
 *  solicitation. Returns a short machine-readable reason string to store as
 *  conversation_messages.auto_flag_reason, or null if nothing matched.
 *  Deliberately never blocks the send — see file header. */
export function detectContactInfoFlag(body: string): string | null {
  if (!body) return null;
  if (EMAIL_RE.test(body)) return "email_detected";
  if (PHONE_RE.test(body)) return "phone_number_detected";
  if (SPELLED_DIGIT_RE.test(body)) return "spelled_out_number_detected";
  if (OFF_PLATFORM_PHRASE_RE.test(body)) return "off_platform_contact_phrase";
  return null;
}

const ALLOWED_ATTACHMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Maps a sniffed MIME type to an allowed extension, or null to reject the
 *  upload — chat attachments are capped to a small allowlist (docs + images),
 *  unlike resume uploads which only ever see resume-shaped files anyway. */
export function inferAttachmentExtension(contentType: string): string | null {
  return ALLOWED_ATTACHMENT_TYPES[contentType] ?? null;
}

export const MATCH_ID_RE = /^[0-9a-f-]{32,}$/i;
export const CONVERSATION_ID_RE = /^[0-9a-f-]{32,}$/i;
export const MESSAGE_ID_RE = /^[0-9a-f-]{32,}$/i;

/** Finds (or lazily creates) the conversation id for a match, given ids the
 *  caller already resolved and verified ownership of — used by
 *  employer-candidate-status.ts to post a system message into the thread
 *  without re-implementing messages.ts's own findOrCreateConversation
 *  (which returns the full row, not just the id, for its own needs). */
export async function findOrCreateConversationId(
  supabaseUrl: string,
  serviceHeaders: Record<string, string>,
  identity: { matchId: string; requirementId: string; employerId: string; candidateUserId: string },
): Promise<string | null> {
  const existingRes = await fetch(
    `${supabaseUrl}/rest/v1/conversations?match_id=eq.${encodeURIComponent(identity.matchId)}&select=id`,
    { headers: serviceHeaders },
  );
  const existingRows = (await existingRes.json().catch(() => [])) as Array<{ id: string }>;
  if (existingRes.ok && existingRows[0]) return existingRows[0].id;

  const createRes = await fetch(`${supabaseUrl}/rest/v1/conversations`, {
    method: "POST",
    headers: { ...serviceHeaders, "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify({
      match_id: identity.matchId,
      requirement_id: identity.requirementId,
      employer_id: identity.employerId,
      candidate_user_id: identity.candidateUserId,
    }),
  });
  const createdRows = (await createRes.json().catch(() => [])) as Array<{ id: string }>;
  if (createRes.ok && createdRows[0]) return createdRows[0].id;

  // Lost the create race to a concurrent sender — re-read.
  const retryRes = await fetch(
    `${supabaseUrl}/rest/v1/conversations?match_id=eq.${encodeURIComponent(identity.matchId)}&select=id`,
    { headers: serviceHeaders },
  );
  const retryRows = (await retryRes.json().catch(() => [])) as Array<{ id: string }>;
  return retryRows[0]?.id ?? null;
}

/** Posts a `sender_role: "system"` message into a conversation and bumps
 *  last_message_at — the record of a pipeline action (interview invite,
 *  rejection, ...) landing in the thread itself rather than only as a
 *  separate, less-discoverable notification. Best-effort: callers fire this
 *  after their own write already succeeded and don't block the response
 *  on it, same convention as _notify.ts's notify(). */
export async function postSystemMessage(
  supabaseUrl: string,
  serviceHeaders: Record<string, string>,
  params: { conversationId: string; employerId: string; candidateUserId: string; senderId: string; body: string },
): Promise<void> {
  const now = new Date().toISOString();
  await fetch(`${supabaseUrl}/rest/v1/conversation_messages`, {
    method: "POST",
    headers: { ...serviceHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      conversation_id: params.conversationId,
      employer_id: params.employerId,
      candidate_user_id: params.candidateUserId,
      sender_id: params.senderId,
      sender_role: "system",
      body: params.body,
    }),
  });
  await fetch(`${supabaseUrl}/rest/v1/conversations?id=eq.${encodeURIComponent(params.conversationId)}`, {
    method: "PATCH",
    headers: { ...serviceHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ last_message_at: now, last_sender_role: "system" }),
  });
}
