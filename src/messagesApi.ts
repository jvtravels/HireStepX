/* Candidate-side messaging API calls. No context wrapper here (unlike the
   employer side's EmployerDataContext) — mirrors the direct fetch +
   authHeaders() pattern already used by HiringActivityCard/DashboardJobs
   for every other candidate read. */

import { authHeaders } from "./supabase";

export interface ConversationMessage {
  id: string;
  senderRole: "employer" | "candidate";
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
  roleTitle: string;
  lastMessageAt: string | null;
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

export async function fetchThread(matchId: string): Promise<ConversationMessage[] | null> {
  try {
    const headers = await authHeaders();
    const res = await fetch(`/api/messages?matchId=${encodeURIComponent(matchId)}`, { headers });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) return null;
    return (data.messages ?? []) as ConversationMessage[];
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
