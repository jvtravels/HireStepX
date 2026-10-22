/* Pure pieces for the employer -> candidate request workflow (evidence,
   proof, clarification, contact details): validation of what the employer
   asked for, the candidate-facing wording, and the status vocabulary shared
   by both consoles. */

import { asContactRequestFields, joinFieldLabels, type ContactRequestField } from "./_employer-contact-request-helpers";
import { roundKeyForTopic } from "../src/focusRounds";
import { detectContactInfoFlag, redactContactInfo } from "./_messages-helpers";
import {
  REQUEST_KINDS,
  REQUEST_STATUSES,
  REQUEST_NOTE_MAX,
  REQUEST_TOPIC_MAX,
  type RequestKind,
  type RequestStatus,
  type CandidateRequestDto,
} from "../src/employer/_candidateRequestTypes";

export {
  REQUEST_KINDS,
  REQUEST_STATUSES,
  REQUEST_NOTE_MAX,
  REQUEST_TOPIC_MAX,
  REQUEST_RESPONSE_MAX,
  DAILY_REQUEST_CAP,
  DOCUMENT_TOPICS,
  REQUEST_STATUS_LABEL,
  type RequestKind,
  type RequestStatus,
  type CandidateRequestDto,
} from "../src/employer/_candidateRequestTypes";

export interface CreateRequestInput {
  kind: RequestKind;
  topic: string | null;
  fields: ContactRequestField[] | null;
  note: string | null;
}

export function isRequestKind(v: unknown): v is RequestKind {
  return typeof v === "string" && (REQUEST_KINDS as readonly string[]).includes(v);
}

export function isRequestStatus(v: unknown): v is RequestStatus {
  return typeof v === "string" && (REQUEST_STATUSES as readonly string[]).includes(v);
}

export function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const t = v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/[ \t]+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

export type ParseResult = { ok: true; value: CreateRequestInput } | { ok: false; error: string };

const CONTACT_IN_TEXT_ERROR = "Keep phone numbers, emails and links out of requests. Once you unlock a candidate you can message them directly.";

/** Validates the employer's body. Free text may not carry contact details:
 *  a request reaches candidates the employer has not paid to unlock, so it must
 *  not become a free side channel around the unlock fee. */
export function parseCreateRequest(body: { kind?: unknown; topic?: unknown; fields?: unknown; note?: unknown }): ParseResult {
  if (!isRequestKind(body.kind)) return { ok: false, error: "Choose what to request" };
  const kind = body.kind;
  const topic = cleanText(body.topic, REQUEST_TOPIC_MAX);
  const note = cleanText(body.note, REQUEST_NOTE_MAX);

  if (kind === "contact") {
    const fields = asContactRequestFields(body.fields);
    if (!fields) return { ok: false, error: "Choose at least one detail to request" };
    return { ok: true, value: { kind, topic: null, fields, note: null } };
  }
  if (kind === "document" && !topic) return { ok: false, error: "Say what you would like to see" };
  if (kind === "practice" && !topic) return { ok: false, error: "Say which skill or question to practise" };
  if (kind === "clarification" && !note) return { ok: false, error: "Write the question you would like answered" };

  if ([topic, note].some((t) => t && detectContactInfoFlag(t))) return { ok: false, error: CONTACT_IN_TEXT_ERROR };
  return { ok: true, value: { kind, topic, fields: null, note } };
}

export function requestHeadline(r: { kind: RequestKind; topic: string | null; fields: readonly string[] | null }): string {
  switch (r.kind) {
    case "contact": return `Contact details: ${joinFieldLabels((r.fields ?? []).filter((f): f is ContactRequestField => asContactRequestFields([f]) !== null))}`;
    case "document": return r.topic ?? "A document or link";
    case "practice": return roundKeyForTopic(r.topic) ? `Practise a ${r.topic} interview` : `Practice answer: ${r.topic ?? "a skill"}`;
    case "clarification": return r.topic ? `Question about ${r.topic}` : "A question about your profile";
  }
}

/** Candidate-facing wording. `companyName` must already be the redacted name for
 *  locked candidates; the employer's identity is never revealed by a request. */
export function requestNotificationText(companyName: string, roleTitle: string, r: { kind: RequestKind; topic: string | null; fields: readonly string[] | null }) {
  const what = requestHeadline(r);
  return {
    title: `${companyName} sent you a request`,
    body: `For ${roleTitle}: ${what}. Open the role to share it or decline.`,
    systemMessage: `📎 ${companyName} asked for: ${what}.`,
  };
}

export interface CandidateRequestRow {
  id: string;
  match_id: string;
  kind: RequestKind;
  topic: string | null;
  fields: string[] | null;
  note: string | null;
  status: RequestStatus;
  response_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

export function toRequestDto(r: CandidateRequestRow): CandidateRequestDto {
  return {
    id: r.id,
    kind: r.kind,
    topic: r.topic,
    fields: r.fields,
    note: r.note,
    status: r.status,
    responseNote: r.response_note,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  };
}

/** What a candidate may do with a pending request. */
export type RequestResolution = "fulfilled" | "declined";

export function asRequestResolution(v: unknown): RequestResolution | null {
  return v === "fulfilled" || v === "declined" ? v : null;
}

export function resolutionNotificationText(resolution: RequestResolution, r: { kind: RequestKind; topic: string | null; fields: readonly string[] | null }, maskedName: string) {
  const what = requestHeadline(r);
  return resolution === "fulfilled"
    ? { title: `${maskedName} responded to your request`, body: `${what}: shared.` }
    : { title: `${maskedName} declined your request`, body: `${what}: declined.` };
}

/** PostgREST answers 404 (PGRST205) or a 42P01 body when the table is absent,
 *  which lets handlers ship before migration 0040 is applied. */
export function isMissingTableResponse(status: number, bodyText: string): boolean {
  return status === 404 || /PGRST205|42P01|does not exist/i.test(bodyText);
}

export function isUniqueViolation(status: number, bodyText: string): boolean {
  return status === 409 || /23505|duplicate key/i.test(bodyText);
}

const escapeRegExp = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const COMPANY_MASK = "the company";

/** Employer-authored posting text shown to a candidate on a Locked match: the
 *  company name, its website host and any contact details are masked so the
 *  free text cannot name the employer the unlock fee protects. */
export function maskLockedPostingText(
  text: string | null | undefined,
  employer: { company_name?: string | null; website?: string | null } | null | undefined,
): string | null {
  if (!text) return text ?? null;
  let out = text;
  const needles = [employer?.company_name, employer?.website?.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "")]
    .map((n) => n?.trim())
    .filter((n): n is string => !!n && n.length >= 3);
  for (const n of needles) out = out.replace(new RegExp(escapeRegExp(n), "gi"), COMPANY_MASK);
  return redactContactInfo(out).text;
}
