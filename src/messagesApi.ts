/* Candidate-side messaging API calls. No context wrapper here (unlike the
   employer side's EmployerDataContext) — mirrors the direct fetch +
   authHeaders() pattern already used by HiringActivityCard/DashboardJobs
   for every other candidate read. */

import { authHeaders } from "./supabase";

export interface ConversationMessage {
  id: string;
  senderRole: "employer" | "candidate" | "system";
  body: string;
  attachmentPath: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  flagged: boolean;
  createdAt: string;
}

export interface ConversationSummary {
  matchId: string;
  conversationId: string;
  role: "employer" | "candidate";
  counterpartName: string;
  /** The employer's company name, resolved independent of `role` — always
   *  safe for the candidate UI to display, even on a malformed row. */
  companyName: string;
  roleTitle: string;
  lastMessageAt: string | null;
  unread: boolean;
  candidateStatus: string;
  matchScore: number | null;
}

/** Thread-level context returned alongside GET /api/messages?matchId= —
 *  the job/company/pipeline-state framing every bubble is read against, so
 *  the thread page doesn't need a second round-trip to show it. */
export interface ConversationContext {
  roleTitle: string;
  companyName: string;
  candidateName: string;
  matchScore: number | null;
  candidateStatus: string;
  interviewScheduledAt: string | null;
  viewerRole: "employer" | "candidate";
}

export interface ThreadResult {
  messages: ConversationMessage[];
  context: ConversationContext | null;
}

export async function listConversations(): Promise<ConversationSummary[] | null> {
  try {
    const headers = await authHeaders();
    const res = await fetch("/api/messages", { headers });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) return null;
    return (data.conversations ?? []) as ConversationSummary[];
  } catch {
    return null;
  }
}

export async function fetchThread(matchId: string): Promise<ThreadResult | null> {
  try {
    const headers = await authHeaders();
    const res = await fetch(`/api/messages?matchId=${encodeURIComponent(matchId)}`, { headers });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) return null;
    return {
      messages: (data.messages ?? []) as ConversationMessage[],
      context: (data.context ?? null) as ConversationContext | null,
    };
  } catch {
    return null;
  }
}

export async function sendMessage(
  matchId: string,
  payload: { body?: string; attachmentPath?: string; attachmentName?: string; attachmentMime?: string },
): Promise<ConversationMessage | null> {
  try {
    const headers = await authHeaders();
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, ...payload }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.message) return null;
    return data.message as ConversationMessage;
  } catch {
    return null;
  }
}

export async function uploadMessageAttachment(
  matchId: string,
  file: { fileName: string; contentType: string; fileBase64: string },
): Promise<{ attachmentPath: string; attachmentName: string; attachmentMime: string } | { error: string }> {
  try {
    const headers = await authHeaders();
    const res = await fetch("/api/message-attachment-upload", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, ...file }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data) return data;
    return { error: typeof data?.error === "string" ? data.error : "Upload failed" };
  } catch {
    return { error: "Upload failed" };
  }
}

export async function fetchMessageAttachmentUrl(messageId: string): Promise<string | null> {
  try {
    const headers = await authHeaders();
    const res = await fetch(`/api/message-attachment-url?messageId=${encodeURIComponent(messageId)}`, { headers });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.url) return null;
    return data.url as string;
  } catch {
    return null;
  }
}

export async function flagMessage(messageId: string, reason: string, note?: string): Promise<boolean> {
  try {
    const headers = await authHeaders();
    const res = await fetch("/api/flag-message", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, reason, note }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
