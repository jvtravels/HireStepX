"use client";

/* Candidate-side Messages tab — basic text chat + file sharing with
   employers who've unlocked your contact details (see supabase-migrations/
   0027-employer-candidate-messaging.sql). Two-pane layout: conversation
   list on the left, active thread on the right. Deep-links via
   ?matchId=... (JobDetailModal's "Message employer" button navigates
   here with it).

   Polling-based like every other live surface in this app (no Supabase
   Realtime anywhere in the codebase) — NotificationBell's 60s poll is the
   baseline idiom; this uses a shorter interval since a thread being
   actively read benefits more from freshness. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircleIcon, ArrowLeftIcon, MessagesSquareIcon, PaperclipIcon, SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Message, MessageAvatar, MessageContent, MessageFooter } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { MessagesRouteSkeleton, MessageThreadRouteSkeleton } from "@/routeSkeletons";
import { tokens as t, fonts as f } from "./auth/_tokens";
import {
  listConversations,
  fetchThread,
  sendMessage as apiSendMessage,
  uploadMessageAttachment,
  fetchMessageAttachmentUrl,
  type ConversationContext,
  type ConversationMessage,
  type ConversationSummary,
} from "./messagesApi";
import { groupConversationsByCounterpart } from "./conversationGrouping";
import { useToast } from "./Toast";
import { playUiSound } from "./uiSounds";
import { useMaxWidth } from "./hooks/useMaxWidth";

const LIST_POLL_MS = 15000;
const THREAD_POLL_MS = 6000;

/* No profile photos anywhere in this app — every avatar in the thread is
   two-letter initials derived from a display name. */
function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Candidate-friendly wording for a pipeline status — deliberately separate
 *  from employer/_atoms.tsx's CANDIDATE_STATUS_LABEL (same source enum,
 *  different audience) rather than importing an employer-only module into
 *  candidate code. */
const STATUS_LABEL: Record<string, string> = {
  shortlisted: "Shortlisted",
  interview_invited: "Interview invited",
  interviewing: "Interviewing",
  hired: "Hired",
  rejected: "Not selected",
  not_a_fit: "Not selected",
  no_response: "Application closed",
};

/** Same {bg, fg} token-pair convention as employer/_atoms.tsx's pillPalette +
 *  CANDIDATE_STATUS_TONE — kept as its own map (see STATUS_LABEL comment
 *  above) rather than importing the employer module, but aligned on the same
 *  tokens so a given status reads as the same color on both sides. */
const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  shortlisted: { bg: t.indigo100, fg: t.indigoDeep },
  interview_invited: { bg: t.violet100, fg: t.violet },
  interviewing: { bg: t.copper100, fg: t.copper },
  hired: { bg: t.success100, fg: t.success },
  rejected: { bg: t.error100, fg: t.error },
  not_a_fit: { bg: t.creamSoft, fg: t.inkSoft },
  no_response: { bg: t.creamSoft, fg: t.inkSoft },
};

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status] || status;
  const tone = STATUS_TONE[status] || { bg: t.creamSoft, fg: t.inkSoft };
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", fontFamily: f.sans, fontSize: 12, fontWeight: 600,
        color: tone.fg, background: tone.bg, borderRadius: 999, padding: "2px 9px",
      }}
    >
      {label}
    </span>
  );
}

export default function MessagesV2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const isNarrow = useMaxWidth(768);

  const openAttachment = useCallback(async (messageId: string) => {
    // Window must open synchronously on click or popup blockers kill it after the await.
    const win = window.open("", "_blank");
    if (win) win.opener = null;
    const url = await fetchMessageAttachmentUrl(messageId);
    if (!url) {
      win?.close();
      toast("Couldn't open attachment — please try again", "error");
      return;
    }
    if (win) win.location.href = url;
    else window.location.href = url;
  }, [toast]);

  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [listError, setListError] = useState(false);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(searchParams?.get("matchId") || null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const list = await listConversations();
    if (list) {
      setConversations(list);
      setListError(false);
      return true;
    }
    setListError(true);
    return false;
  }, []);

  /* A fixed-interval poll that keeps firing through failures (e.g. a 429)
     never lets the caller's rate-limit window go idle, turning a transient
     block into a permanent one for the rest of the session. Back off on
     each consecutive failure and reset to the normal cadence on success. */
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const tick = async () => {
      const ok = await loadConversations();
      if (cancelled) return;
      failures = ok ? 0 : failures + 1;
      const delay = ok ? LIST_POLL_MS : Math.min(LIST_POLL_MS * 2 ** failures, 120_000);
      timer = setTimeout(tick, delay);
    };
    tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [loadConversations]);

  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  const loadThread = useCallback(async (matchId: string, showSpinner: boolean) => {
    if (showSpinner) setThreadLoading(true);
    const result = await fetchThread(matchId);
    if (result) {
      const seen = seenMessageIdsRef.current;
      if (showSpinner) seen.clear();
      else if (result.messages.some((m) => m.senderRole !== "candidate" && !seen.has(m.id))) playUiSound("receive");
      for (const m of result.messages) seen.add(m.id);
      setMessages(result.messages);
      setContext(result.context);
    }
    if (showSpinner) setThreadLoading(false);
    return !!result;
  }, []);

  useEffect(() => {
    if (!activeMatchId) {
      setMessages([]);
      setContext(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const tick = async (showSpinner: boolean) => {
      const ok = await loadThread(activeMatchId, showSpinner);
      if (cancelled) return;
      failures = ok ? 0 : failures + 1;
      const delay = ok ? THREAD_POLL_MS : Math.min(THREAD_POLL_MS * 2 ** failures, 60_000);
      timer = setTimeout(() => tick(false), delay);
    };
    tick(true);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [activeMatchId, loadThread]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const selectConversation = (matchId: string) => {
    setActiveMatchId(matchId);
    router.replace(`/messages?matchId=${matchId}`);
  };

  const backToList = () => {
    setActiveMatchId(null);
    router.replace("/messages");
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !activeMatchId) return;
    setSending(true);
    const sent = await apiSendMessage(activeMatchId, { body: text });
    setSending(false);
    if (!sent) {
      toast("Couldn't send message — please try again", "error");
      return;
    }
    playUiSound("send");
    setDraft("");
    loadThread(activeMatchId, false);
    loadConversations();
  };

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeMatchId) return;
    if (file.size > 8_000_000) {
      toast("File is too large — 8MB max", "error");
      return;
    }
    setAttaching(true);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    }).catch(() => null);
    if (!dataUrl) {
      setAttaching(false);
      toast("Couldn't read file", "error");
      return;
    }
    const fileBase64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const uploaded = await uploadMessageAttachment(activeMatchId, { fileName: file.name, contentType: file.type, fileBase64 });
    if ("error" in uploaded) {
      setAttaching(false);
      toast(uploaded.error, "error");
      return;
    }
    const sent = await apiSendMessage(activeMatchId, {
      attachmentPath: uploaded.attachmentPath,
      attachmentName: uploaded.attachmentName,
      attachmentMime: uploaded.attachmentMime,
    });
    setAttaching(false);
    if (!sent) {
      toast("Attachment uploaded but failed to send — please try again", "error");
      return;
    }
    playUiSound("send");
    loadThread(activeMatchId, false);
    loadConversations();
  };

  const heading = (
    <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.line}` }}>
      <h1 style={{ fontFamily: f.sans, fontSize: 26, fontWeight: 700, color: t.coal, margin: 0, letterSpacing: "-0.01em", lineHeight: "32px" }}>Messages</h1>
      <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkFaint, margin: "2px 0 0" }}>
        Chat with employers who&apos;ve unlocked your contact details.
      </p>
    </div>
  );

  const shell = (body: React.ReactNode, hideHeading = false) => (
    <div style={{ background: t.white, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, borderRadius: 12, border: `1px solid ${t.line}`, overflow: "hidden" }}>
      {!hideHeading && heading}
      {body}
    </div>
  );

  if (conversations === null && !listError) {
    return shell(<MessagesRouteSkeleton />);
  }

  if (listError) {
    return shell(
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "64px 20px", flex: 1 }} role="alert">
        <AlertCircleIcon size={26} color={t.inkFaint} aria-hidden="true" />
        <p style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal, margin: 0 }}>Couldn&apos;t load your messages</p>
        <Button variant="outline" onClick={loadConversations} style={{ borderRadius: 8, height: 36, fontFamily: f.sans, fontSize: 13, fontWeight: 500 }}>
          Retry
        </Button>
      </div>,
    );
  }

  const list = conversations ?? [];
  const active = list.find((c) => c.matchId === activeMatchId) ?? null;
  // Group by companyName, not the generic counterpartName — a candidate's
  // "counterpart" must always be the hiring company, never a person.
  const groups = groupConversationsByCounterpart(
    list.map((c) => ({ ...c, counterpartName: c.companyName })),
  );
  const lastOwnMessageId = messages.filter((mm) => mm.senderRole === "candidate").at(-1)?.id;

  if (list.length === 0) {
    return shell(
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "56px 24px", flex: 1, textAlign: "center" }}>
        <MessagesSquareIcon size={26} color={t.inkFaint} aria-hidden="true" />
        <p style={{ fontFamily: f.sans, fontSize: 14.5, fontWeight: 600, color: t.coal, margin: 0 }}>No conversations yet</p>
        <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint, margin: 0, lineHeight: 1.5, maxWidth: 380 }}>
          Once an employer unlocks your contact details and sends a message, it&apos;ll show up here.
        </p>
      </div>,
    );
  }

  // Phones: one pane at a time — the list, or the open thread with a back
  // button — instead of squeezing a fixed 280px list beside the thread.
  const showList = !isNarrow || !active;
  const showThread = !isNarrow || !!active;

  return shell(
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      {showList && (
      <nav style={{ width: isNarrow ? "100%" : 280, borderRight: isNarrow ? "none" : `1px solid ${t.line}`, overflowY: "auto", flexShrink: 0 }} aria-label="Conversations">
        {groups.map((group) => (
          <div key={group.counterpartName}>
            <div aria-hidden="true" style={{
              padding: "10px 16px 4px", fontFamily: f.sans, fontSize: 12, fontWeight: 700,
              color: t.inkFaint, textTransform: "uppercase", letterSpacing: "0.04em",
            }}>
              {group.counterpartName}
            </div>
            <div role="list" aria-label={group.counterpartName}>
              {group.conversations.map((c) => (
                <div key={c.matchId} role="listitem">
                  <button
                    aria-current={c.matchId === activeMatchId ? "true" : undefined}
                    onClick={() => selectConversation(c.matchId)}
                    style={{
                      display: "block", width: "100%", textAlign: "left", padding: "10px 16px 10px 24px",
                      border: "none", borderBottom: `1px solid ${t.line}`, cursor: "pointer",
                      background: c.matchId === activeMatchId ? t.creamSoft : c.unread ? t.pageBg : "transparent",
                    }}
                  >
                    <div style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, display: "flex", alignItems: "center", gap: 6 }}>
                      {c.unread && (
                        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: t.indigo, flexShrink: 0 }} />
                      )}
                      {c.roleTitle}
                    </div>
                    <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 2 }}>
                      {c.counterpartName}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </nav>
      )}
      {showThread && (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {!active ? (
          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: t.inkFaint, fontFamily: f.sans, fontSize: 13 }}>
            Select a conversation
          </div>
        ) : (
          <>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.line}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {isNarrow && (
                <Button variant="ghost" size="icon" aria-label="Back to conversations" onClick={backToList} style={{ flexShrink: 0, width: 44, height: 44, marginLeft: -8 }}>
                  <ArrowLeftIcon size={20} aria-hidden="true" />
                </Button>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal }}>{context?.companyName || active.companyName}</span>
                  <StatusBadge status={active.candidateStatus} />
                </div>
                <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, marginTop: 2 }}>
                  {active.roleTitle}{context?.companyName ? ` · ${context.companyName}` : ""}
                </div>
              </div>
            </div>
            <div
              ref={scrollRef}
              role="log"
              aria-live="polite"
              aria-label={`Conversation with ${context?.companyName || active.companyName}`}
              style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}
            >
              {threadLoading && <MessageThreadRouteSkeleton />}
              {!threadLoading && messages.length === 0 && (
                <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint }}>No messages yet — say hello.</p>
              )}
              {messages.map((m) =>
                m.senderRole === "system" ? (
                  <div key={m.id} style={{ alignSelf: "center", textAlign: "center", maxWidth: "85%" }}>
                    <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, background: t.creamSoft, borderRadius: 999, padding: "4px 12px", display: "inline-block" }}>
                      {m.body}
                    </span>
                  </div>
                ) : (
                  <Message key={m.id} align={m.senderRole === "candidate" ? "end" : "start"}>
                    <MessageAvatar className="self-center">
                      <Avatar size="sm">
                        <AvatarFallback>
                          {initialsOf(m.senderRole === "candidate" ? context?.candidateName || "Me" : context?.companyName || active.companyName)}
                        </AvatarFallback>
                      </Avatar>
                    </MessageAvatar>
                    <MessageContent>
                      <Bubble variant={m.senderRole === "candidate" ? "default" : "secondary"}>
                        <BubbleContent>
                          {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                          {m.attachmentPath && (
                            <button
                              type="button"
                              onClick={() => openAttachment(m.id)}
                              aria-label={`Open attachment ${m.attachmentName || ""}`.trim()}
                              style={{ fontFamily: f.sans, fontSize: 12.5, marginTop: m.body ? 4 : 0, display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, color: "inherit", textDecoration: "underline", cursor: "pointer" }}
                            >
                              <PaperclipIcon size={12} aria-hidden="true" />
                              {m.attachmentName || "Attachment"}
                            </button>
                          )}
                        </BubbleContent>
                      </Bubble>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px" }}>
                        <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint }}>
                          {new Date(m.createdAt).toLocaleString()}
                        </span>
                        {m.flagged && <Badge variant="destructive">Flagged</Badge>}
                      </div>
                      {m.senderRole === "candidate" && m.id === lastOwnMessageId && (
                        <MessageFooter>Delivered</MessageFooter>
                      )}
                    </MessageContent>
                  </Message>
                ),
              )}
            </div>
            <div style={{ padding: "12px 16px", paddingBottom: "max(12px, env(safe-area-inset-bottom))", borderTop: `1px solid ${t.line}`, display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message…"
                aria-label="Message"
                rows={2}
                style={isNarrow ? { fontSize: 16 } : undefined}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ cursor: attaching ? "default" : "pointer" }}>
                  <input
                    type="file"
                    onChange={handleAttach}
                    disabled={attaching}
                    aria-label="Attach a file (max 8MB)"
                    style={{ display: "none" }}
                  />
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft }}>
                    <PaperclipIcon size={14} aria-hidden="true" /> {attaching ? "Uploading…" : "Attach file"}
                  </span>
                </label>
                <Button size="sm" className="gap-2" onClick={handleSend} disabled={sending || !draft.trim()}>
                  <SendIcon size={13} aria-hidden="true" /> {sending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
      )}
    </div>,
    isNarrow && !!active,
  );
}
