/* Vocabulary shared by the request handlers and both consoles.
   No imports on purpose: it must stay edge- and browser-safe. */

export const REQUEST_KINDS = ["contact", "document", "practice", "clarification"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_STATUSES = ["pending", "fulfilled", "declined", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_NOTE_MAX = 300;
export const REQUEST_TOPIC_MAX = 120;
export const REQUEST_RESPONSE_MAX = 500;
/** Per employer per rolling 24h, across every candidate. */
export const DAILY_REQUEST_CAP = 30;

export const DOCUMENT_TOPICS = [
  "Certificate",
  "GitHub project or portfolio",
  "Work sample",
  "Degree proof",
  "Employer verification",
] as const;

export const REQUEST_KIND_LABEL: Record<RequestKind, string> = {
  contact: "Contact details",
  document: "Document or link",
  practice: "Practice question",
  clarification: "Clarification",
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Waiting on candidate",
  fulfilled: "Shared",
  declined: "Declined",
  cancelled: "Cancelled",
};

export interface CandidateRequestDto {
  id: string;
  kind: RequestKind;
  topic: string | null;
  fields: string[] | null;
  note: string | null;
  status: RequestStatus;
  responseNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CreateRequestBody {
  kind: RequestKind;
  topic?: string;
  fields?: string[];
  note?: string;
}
