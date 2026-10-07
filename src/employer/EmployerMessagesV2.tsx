"use client";

/* Employer-side Messages inbox — mirrors ../MessagesV2.tsx (candidate side)
   but goes through EmployerDataContext for all reads/writes, matching the
   established employer data-layer convention instead of a direct-fetch
   module. Reachable via the header MessagesBell (AppShellFrame.tsx) and
   deep-links via ?matchId=... the same way the candidate page does. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircleIcon, FlagIcon, MessagesSquareIcon, PaperclipIcon, SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import LoadingScreen from "@/_LoadingScreen";
import { tokens as t, fonts as f } from "../auth/_tokens";
import { useEmployerData, type ConversationMessage, type ConversationSummary } from "./EmployerDataContext";
import { useToast } from "../Toast";

const LIST_POLL_MS = 15000;
const THREAD_POLL_MS = 6000;

export default function EmployerMessagesV2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { listConversations, fetchMessages, sendMessage, uploadMessageAttachment, flagMessage } = useEmployerData();

  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [listError, setListError] = useState(false);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(searchParams?.get("matchId") || null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
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
    } else {
      setListError(true);
    }
  }, [listConversations]);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, LIST_POLL_MS);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const loadThread = useCallback(async (matchId: string, showSpinner: boolean) => {
    if (showSpinner) setThreadLoading(true);
    const msgs = await fetchMessages(matchId);
    if (msgs) setMessages(msgs);
    if (showSpinner) setThreadLoading(false);
  }, [fetchMessages]);

  useEffect(() => {
    if (!activeMatchId) {
      setMessages([]);
      return;
    }
    loadThread(activeMatchId, true);
    const interval = setInterval(() => loadThread(activeMatchId, false), THREAD_POLL_MS);
    return () => clearInterval(interval);
  }, [activeMatchId, loadThread]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const selectConversation = (matchId: string) => {
    setActiveMatchId(matchId);
    router.replace(`/employer/messages?matchId=${matchId}`);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !activeMatchId) return;
    setSending(true);
    const sent = await sendMessage(activeMatchId, { body: text });
    setSending(false);
    if (!sent) {
      toast("Couldn't send message — please try again", "error");
      return;
    }
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
    const sent = await sendMessage(activeMatchId, {
      attachmentPath: uploaded.attachmentPath,
      attachmentName: uploaded.attachmentName,
      attachmentMime: uploaded.attachmentMime,
    });
    setAttaching(false);
    if (!sent) {
      toast("Attachment uploaded but failed to send — please try again", "error");
      return;
    }
    loadThread(activeMatchId, false);
    loadConversations();
  };

  const handleFlag = async (messageId: string) => {
    const reason = window.prompt("Reason for flagging this message (e.g. inappropriate, spam, off-platform contact):");
    if (!reason || !reason.trim()) return;
    const ok = await flagMessage(messageId, reason.trim());
    toast(ok ? "Message flagged for review" : "Couldn't flag message", ok ? "success" : "error");
  };

  const heading = (
    <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.line}` }}>
      <h1 style={{ fontFamily: f.sans, fontSize: 26, fontWeight: 700, color: t.coal, margin: 0, letterSpacing: "-0.01em", lineHeight: "32px" }}>Messages</h1>
      <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkFaint, margin: "2px 0 0" }}>
        Chat with candidates you&apos;ve unlocked.
      </p>
    </div>
  );

  const shell = (body: React.ReactNode) => (
    <div style={{ background: t.white, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, borderRadius: 12, border: `1px solid ${t.line}`, overflow: "hidden" }}>
      {heading}
      {body}
    </div>
  );

  if (conversations === null && !listError) {
    return shell(
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <LoadingScreen fullScreen={false} message="Loading your conversations…" />
      </div>,
    );
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

  if (list.length === 0) {
    return shell(
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "56px 24px", flex: 1, textAlign: "center" }}>
        <MessagesSquareIcon size={26} color={t.inkFaint} aria-hidden="true" />
        <p style={{ fontFamily: f.sans, fontSize: 14.5, fontWeight: 600, color: t.coal, margin: 0 }}>No conversations yet</p>
        <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint, margin: 0, lineHeight: 1.5, maxWidth: 380 }}>
          Once you unlock a candidate and send a message, it&apos;ll show up here.
        </p>
      </div>,
    );
  }

  return shell(
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <div style={{ width: 280, borderRight: `1px solid ${t.line}`, overflowY: "auto", flexShrink: 0 }}>
        {list.map((c) => (
          <button
            key={c.matchId}
            onClick={() => selectConversation(c.matchId)}
            style={{
              display: "block", width: "100%", textAlign: "left", padding: "12px 16px",
              border: "none", borderBottom: `1px solid ${t.line}`, cursor: "pointer",
              background: c.matchId === activeMatchId ? t.creamSoft : "transparent",
            }}
          >
            <div style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: 600, color: t.coal }}>{c.counterpartName}</div>
            <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, marginTop: 2 }}>{c.roleTitle}</div>
          </button>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {!active ? (
          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: t.inkFaint, fontFamily: f.sans, fontSize: 13 }}>
            Select a conversation
          </div>
        ) : (
          <>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.line}` }}>
              <div style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal }}>{active.counterpartName}</div>
              <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint }}>{active.roleTitle}</div>
            </div>
            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {threadLoading && <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint }}>Loading messages…</p>}
              {!threadLoading && messages.length === 0 && (
                <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint }}>No messages yet — say hello.</p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.senderRole === "employer" ? "flex-end" : "flex-start",
                    maxWidth: "75%",
                    background: m.senderRole === "employer" ? t.indigo100 : t.creamSoft,
                    borderRadius: 10,
                    padding: "8px 10px",
                  }}
                >
                  {m.body && <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.coal, whiteSpace: "pre-wrap" }}>{m.body}</div>}
                  {m.attachmentPath && (
                    <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.indigoDeep, marginTop: m.body ? 4 : 0 }}>
                      <PaperclipIcon size={12} style={{ display: "inline", marginRight: 4 }} aria-hidden="true" />
                      {m.attachmentName || "Attachment"}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <span style={{ fontFamily: f.sans, fontSize: 11, color: t.inkFaint }}>
                      {new Date(m.createdAt).toLocaleString()}
                    </span>
                    {m.flagged && <Badge variant="destructive">Flagged</Badge>}
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => handleFlag(m.id)}
                      style={{ fontSize: 11, height: "auto", padding: 0, color: t.inkFaint, display: "flex", alignItems: "center", gap: 2 }}
                    >
                      <FlagIcon size={11} aria-hidden="true" /> Report
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.line}`, display: "flex", flexDirection: "column", gap: 8 }}>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message…"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ cursor: attaching ? "default" : "pointer" }}>
                  <input type="file" onChange={handleAttach} disabled={attaching} style={{ display: "none" }} />
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
    </div>,
  );
}
