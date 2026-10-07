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
