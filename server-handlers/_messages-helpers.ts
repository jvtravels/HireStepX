/* Pure helpers for the employer<->candidate messaging handlers
 * (messages.ts, flag-message.ts, message-attachment-upload.ts).
 *
 * Contact-info detection mirrors Upwork's circumvention policy with one
 * deliberate difference: per product decision, it FLAGS rather than BLOCKS.
 * Candidates in the India market default to sharing a WhatsApp number as
 * their off-platform contact method, so the phone pattern is tuned for
 * Indian formats (+91, 10-digit) as well as generic ones.
 */

import { isSuspended } from "./_employer-trust";
import type { EmployerMatchAccess, MatchAccessRow } from "./_entitlements";

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

/** A refusal to let someone write to / download from a thread, shaped for a
 *  JSON Response: `{ error, code }` with `status`. */
export interface ThreadBlock {
  status: number;
  error: string;
  code: string;
}

/** Candidate statuses an employer has closed out; messaging them again is
 *  unsolicited contact. "Reopen" puts a rejected candidate back on the
 *  pipeline, which lifts this. */
const EMPLOYER_CLOSED_OUT_STATUSES = new Set(["rejected", "not_a_fit"]);

/** Why an employer may not send into this match's thread, or null when allowed.
 *  History stays readable regardless; this only gates writes (messages and
 *  attachment uploads). */
export function employerSendBlock(match: MatchAccessRow, access: EmployerMatchAccess | null): ThreadBlock | null {
  // Unpaid cold contact is exactly the spam vector the unlock fee exists to
  // price in; the candidate's own interest also opens the thread.
  if (!match.unlocked && match.candidate_response !== "interested") {
    return { status: 402, error: "Unlock this candidate to message them.", code: "unlock_required" };
  }
  // A candidate who switched employer visibility off after a paid unlock
  // closes NEW contact; the delivered history stays readable.
  if (access?.candidateWithdrew) {
    return { status: 409, error: "This candidate has withdrawn from employer contact, so you can no longer message them.", code: "candidate_withdrew" };
  }
  if (match.candidate_response === "declined") {
    return { status: 409, error: "This candidate declined contact for this job.", code: "candidate_declined" };
  }
  if (match.employer_requirements?.status === "closed") {
    return { status: 409, error: "This requirement is closed. Reopen it to message candidates.", code: "requirement_closed" };
  }
  if (EMPLOYER_CLOSED_OUT_STATUSES.has(match.candidate_status)) {
    return { status: 409, error: "This candidate is no longer in the running for this role. Reopen them to send a message.", code: "candidate_not_active" };
  }
  return null;
}

/** Pipeline stages that mean the employer has reached out, even if the thread
 *  was never opened by a paid unlock. */
const CANDIDATE_CONTACTED_STATUSES = new Set(["interview_invited", "interviewing", "hired"]);

/** Why a candidate may not send into this match's thread, or null when allowed.
 *  A candidate can always reply on a closed requirement; only a suspended /
 *  deleted employer is a dead end. Opening a NEW thread needs the employer to
 *  have reached out (paid unlock, or an interview invite or later stage): an
 *  algorithmic match, or the candidate's own "interested", is not a licence to
 *  cold-message an employer who never engaged. Replies in an existing thread
 *  are unaffected. */
export function candidateSendBlock(match: MatchAccessRow, hasConversation: boolean): ThreadBlock | null {
  if (isSuspended(match.employer_requirements?.employers)) {
    return { status: 409, error: "This employer is no longer available on HireStepX, so you can't send new messages.", code: "employer_unavailable" };
  }
  if (!hasConversation && !match.unlocked && !CANDIDATE_CONTACTED_STATUSES.has(match.candidate_status)) {
    return { status: 403, error: "You can start a conversation once the employer has contacted you.", code: "no_relationship" };
  }
  return null;
}

/** Whether a conversation already exists for a match. Fails closed (true is
 *  never assumed): a lookup error is reported as "error" so the caller 502s. */
export async function conversationExists(
  supabaseUrl: string,
  serviceHeaders: Record<string, string>,
  matchId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean | "error"> {
  const res = await fetchImpl(
    `${supabaseUrl}/rest/v1/conversations?match_id=eq.${encodeURIComponent(matchId)}&select=id&limit=1`,
    { headers: serviceHeaders },
  );
  if (!res.ok) return "error";
  const rows = (await res.json().catch(() => [])) as unknown[];
  return rows.length > 0;
}

/* ── Employer spam cap ── */

export const EMPLOYER_MESSAGE_CAP = 20;
export const EMPLOYER_MESSAGE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface MessageCapResult {
  limited: boolean;
  /** Seconds until the oldest counted message leaves the window (0 when not limited). */
  retryAfterSeconds: number;
}

/** Per-match cap on employer messages inside a rolling window. `sentAt` are the
 *  created_at timestamps of the employer's messages on this match; anything
 *  outside the window or unparseable is ignored. */
export function employerMessageCap(
  sentAt: string[],
  now: number = Date.now(),
  cap: number = EMPLOYER_MESSAGE_CAP,
  windowMs: number = EMPLOYER_MESSAGE_WINDOW_MS,
): MessageCapResult {
  const inWindow = sentAt
    .map((t) => Date.parse(t))
    .filter((t) => Number.isFinite(t) && t > now - windowMs && t <= now)
    .sort((a, b) => a - b);
  if (inWindow.length < cap) return { limited: false, retryAfterSeconds: 0 };
  // The cap frees a slot when the (n - cap + 1)th oldest message ages out.
  const blocking = inWindow[inWindow.length - cap];
  return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil((blocking + windowMs - now) / 1000)) };
}

/* ── Attachment hardening ── */

/** A stored attachment path is only ever `<matchId>/<name>`; anything else
 *  (traversal, absolute, backslash, encoded separators, extra segments) is
 *  refused before it is stored or concatenated into a storage URL. */
export function isSafeAttachmentPath(path: string, matchId: string): boolean {
  if (!matchId || !path.startsWith(`${matchId}/`)) return false;
  const name = path.slice(matchId.length + 1);
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(name)) return false;
  return !name.includes("..");
}

/** Storage object name for a new upload. The uploader's role is part of the
 *  name because the path is the only thing both the send and the download
 *  checks can trust: it is minted server-side from the authenticated caller,
 *  while a message row's sender_role says who POSTed the path, not who owns
 *  the file. */
export function attachmentObjectName(uploader: MessageRole, uuid: string, ext: string): string {
  return `${uploader}-${uuid}.${ext}`;
}

/** Who uploaded the file behind a stored path, or null for a path that
 *  predates role-tagged names (treated as the candidate's by the callers). */
export function attachmentUploaderRole(path: string): MessageRole | null {
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (name.startsWith("employer-")) return "employer";
  if (name.startsWith("candidate-")) return "candidate";
  return null;
}

/** A sender may only attach a file they uploaded to this very match, never one
 *  the other party uploaded (that would re-issue it under the sender's role)
 *  or one from another thread. */
export function isOwnAttachmentPath(path: string, matchId: string, senderRole: MessageRole): boolean {
  return isSafeAttachmentPath(path, matchId) && attachmentUploaderRole(path) === senderRole;
}

/** The path value an employer is shown for a candidate-uploaded file while the
 *  contact is not releasable: enough for the client to draw an attachment row,
 *  never the storage key. */
export const WITHHELD_ATTACHMENT_PATH = "withheld";

export function attachmentPathForViewer(path: string | null, viewerRole: MessageRole, hideContact: boolean): string | null {
  if (!path) return null;
  if (viewerRole === "employer" && hideContact && attachmentUploaderRole(path) !== "employer") return WITHHELD_ATTACHMENT_PATH;
  return path;
}

const MAX_ATTACHMENT_NAME_LEN = 120;

/** A display name for an attachment: no path separators, control characters or
 *  markup-significant characters, capped in length. Falls back to a generic
 *  name rather than storing something the client chose to look like a path. */
export function sanitizeAttachmentName(value: unknown, fallback = "attachment"): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .replace(/\p{Cc}/gu, "")
    .replace(/[\\/<>"|?*:]/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, MAX_ATTACHMENT_NAME_LEN)
    .trim();
  return cleaned || fallback;
}

/** The MIME type implied by a stored path's extension. The upload handler has
 *  already checked the bytes against it, so this is trusted where the
 *  client-sent value is not. */
export function attachmentMimeFromPath(path: string): string | null {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  for (const [mime, e] of Object.entries(ALLOWED_ATTACHMENT_TYPES)) if (e === ext) return mime;
  return null;
}

function startsWithBytes(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  return bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);
}

/** Checks the file's leading bytes against the MIME type the client declared,
 *  so a renamed executable/HTML file cannot ride in as a PDF or image. */
export function attachmentBytesMatchType(bytes: Uint8Array, contentType: string): boolean {
  switch (contentType) {
    case "application/pdf": return startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case "image/png": return startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg": return startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
    case "image/webp": return startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWithBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": return startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]); // PK zip
    case "application/msword": return startsWithBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // OLE2
    case "text/plain": {
      // No magic number: reject binary (NUL / most C0 controls) in the first 4 KB.
      const head = bytes.subarray(0, 4096);
      for (const b of head) if (b === 0 || (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d && b !== 0x0c)) return false;
      return true;
    }
    default: return false;
  }
}

/** What an employer sees as a candidate-sent file's name while the contact is
 *  not releasable: file names routinely embed the candidate's name or number. */
export const REDACTED_ATTACHMENT_NAME = "Attachment";

/** Why an employer may not download an attachment from this match's thread.
 *  Stricter than sending: a candidate-uploaded file (e.g. a resume) carries
 *  contact details, so it needs a paid unlock, not just the candidate's
 *  interest. `uploaderRole` is who uploaded the file (see
 *  attachmentUploaderRole), not who sent the message; null (a legacy path) is
 *  treated as the candidate's. */
export function employerAttachmentBlock(
  access: EmployerMatchAccess,
  uploaderRole: MessageRole | null,
): ThreadBlock | null {
  if (access.candidateWithdrew) {
    return { status: 409, error: "This candidate has withdrawn from employer contact.", code: "candidate_withdrew" };
  }
  if (access.match.candidate_response === "declined") {
    return { status: 409, error: "This candidate declined contact for this job.", code: "candidate_declined" };
  }
  if (uploaderRole !== "employer" && !access.unlocked) {
    return { status: 403, error: "Unlock this candidate to download their attachments", code: "unlock_required" };
  }
  return null;
}

/** conversations has CHECK (employer_id <> candidate_user_id); a match where
 *  both sides are the same account can never hold a conversation. */
export function isSelfConversation(employerId: string, candidateUserId: string): boolean {
  return employerId === candidateUserId;
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

// Phone numbers typed with separators the plain PHONE_RE misses: "98765-43210"
// is caught there, but "9 8 7 6 5 4 3 2 1 0", "98.76.54.32.10", "(+91) 98765 43210"
// and Devanagari digits are not. Ten digits, the first being 6-9, with at most
// two separator characters between any two digits. Not preceded or followed by
// another digit, so a long id or a lakh-formatted salary ("9,00,000") is left alone.
const SEPARATED_PHONE_RE =
  /(?<![\d०-९])(?:(?:\+|00)?91[\s.()-]*|0)?[6-9६-९](?:[\s.()-]{0,2}[\d०-९]){9}(?![\d०-९])/;

// "name at gmail dot com", "name (at) gmail (dot) com", "name[at]gmail[dot]com",
// "name @ gmail dot com". A literal "." never takes surrounding spaces, so
// "see you @ 5. Thanks" and "at cafe. Then" are not mistaken for an address.
const MAIL_LABEL = "[a-z][a-z0-9-]*";
const MAIL_DOT = String.raw`(?:\s*[(\[{]\s*dot\s*[)\]}]\s*|\s+dot\s+|\.)`;
const MAIL_LOCAL = "[a-z0-9._%+-]+";
const OBFUSCATED_EMAIL_RE = new RegExp(
  `${MAIL_LOCAL}(?:\\s*[(\\[{]\\s*at\\s*[)\\]}]\\s*|\\s*@\\s*)${MAIL_LABEL}(?:${MAIL_DOT}${MAIL_LABEL})*${MAIL_DOT}[a-z]{2,}\\b` +
    // The bare word "at" is only an address when the dot is spoken as well.
    `|${MAIL_LOCAL}\\s+at\\s+${MAIL_LABEL}(?:\\s+dot\\s+${MAIL_LABEL})*\\s+dot\\s+[a-z]{2,}\\b`,
  "i",
);

// @handle (Instagram, Telegram, X): letter first, so "@5pm" is not one. The
// lookbehind skips the middle of an address, which is redacted as an email.
const SOCIAL_HANDLE_RE = /(?<![\w@.])@[a-z][a-z0-9._]{2,29}\b/i;

// A link of any kind hands the employer a way to find the candidate (a
// profile, a portfolio, a calendar page) without paying. Scheme/www links, and
// bare domains on the TLDs people actually share; a short TLD list keeps
// "Node.js" and "e.g." out.
const LINK_RE =
  /\b(?:https?:\/\/|www\.)[^\s<>"']+|(?<![@\w.-])(?:[a-z0-9-]+\.)+(?:com|in|io|me|co|net|org|dev|app|ai|xyz|ly|gg|us)\b(?:\/[^\s<>"']*)?/i;

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
  if (EMAIL_RE.test(body) || OBFUSCATED_EMAIL_RE.test(body)) return "email_detected";
  if (PHONE_RE.test(body) || SEPARATED_PHONE_RE.test(body)) return "phone_number_detected";
  if (SPELLED_DIGIT_RE.test(body)) return "spelled_out_number_detected";
  if (LINK_RE.test(body)) return "link_detected";
  if (SOCIAL_HANDLE_RE.test(body)) return "social_handle_detected";
  if (OFF_PLATFORM_PHRASE_RE.test(body)) return "off_platform_contact_phrase";
  return null;
}

export const CONTACT_REDACTION_MARK = "[contact details hidden until unlock]";
export const CONTACT_WITHHELD_NOTICE = "This candidate has chosen not to share contact details with you.";
export const CONTACT_REDACTED_NOTICE = "Contact details unlock after you unlock this candidate.";

/** Replaces emails (including "x at y dot com"), phone numbers (including
 *  spaced-out digits), spelled-out digit runs, links and @handles with a visible
 *  mark. Applied to message bodies an employer reads while the match is still
 *  Locked: a candidate who shares a number in an "interested" reply must not
 *  hand the employer the contact the unlock fee pays for. The stored body is
 *  untouched, so the full text shows once the employer unlocks. */
export function redactContactInfo(body: string): { text: string; redacted: boolean } {
  if (!body) return { text: body, redacted: false };
  const text = body
    .replace(new RegExp(EMAIL_RE.source, "gi"), CONTACT_REDACTION_MARK)
    .replace(new RegExp(OBFUSCATED_EMAIL_RE.source, "gi"), CONTACT_REDACTION_MARK)
    .replace(new RegExp(SEPARATED_PHONE_RE.source, "gu"), CONTACT_REDACTION_MARK)
    .replace(new RegExp(PHONE_RE.source, "g"), CONTACT_REDACTION_MARK)
    .replace(new RegExp(SPELLED_DIGIT_RE.source, "gi"), CONTACT_REDACTION_MARK)
    .replace(new RegExp(LINK_RE.source, "gi"), CONTACT_REDACTION_MARK)
    .replace(new RegExp(SOCIAL_HANDLE_RE.source, "gi"), CONTACT_REDACTION_MARK);
  return { text, redacted: text !== body };
}

/** What the viewer is shown for a stored message body: only an employer
 *  reading a Locked match gets the candidate's contact text masked. */
export function messageBodyForViewer(body: string, senderRole: MessageSenderRole, hideContact: boolean): string {
  return hideContact && senderRole === "candidate" ? redactContactInfo(body).text : body;
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
