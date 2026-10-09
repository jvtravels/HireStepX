"use client";

/* Employer-side Messages inbox — mirrors ../MessagesV2.tsx (candidate side)
   but goes through EmployerDataContext for all reads/writes, matching the
   established employer data-layer convention instead of a direct-fetch
   module. Reachable via the header MessagesBell (AppShellFrame.tsx) and
   deep-links via ?matchId=... the same way the candidate page does. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useMaxWidth } from "../hooks/useMaxWidth";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircleIcon, FlagIcon, MessagesSquareIcon, PaperclipIcon, SendIcon, ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Message, MessageAvatar, MessageContent, MessageFooter } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LoadingScreen from "@/_LoadingScreen";
import { tokens as t, fonts as f } from "../auth/_tokens";
import { useEmployerData, type ConversationContext, type ConversationMessage, type ConversationSummary, type CandidateEvidence } from "./EmployerDataContext";
import { groupConversationsByCounterpart } from "../conversationGrouping";
import { useToast } from "../Toast";
import { CandidateStatusChip, OutlineCta, PrimaryCta, Pill, ScoreChip } from "./_atoms";

const LIST_POLL_MS = 15000;
const THREAD_POLL_MS = 6000;

/* No profile photos anywhere in this app — every avatar in the thread is
   two-letter initials derived from a display name. */
function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function EmployerMessagesV2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const mobile = useMaxWidth(768);
  const { listConversations, fetchMessages, sendMessage, uploadMessageAttachment, flagMessage, updateCandidateStatus, fetchCandidateEvidence, fetchMessageAttachmentUrl, companyName } = useEmployerData();

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
  }, [toast, fetchMessageAttachmentUrl]);


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

  const [evidence, setEvidence] = useState<CandidateEvidence | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteNote, setInviteNote] = useState("");
  const [inviteDate, setInviteDate] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const [flagMessageId, setFlagMessageId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [flagSubmitting, setFlagSubmitting] = useState(false);

  const loadConversations = useCallback(async () => {
    const list = await listConversations();
    if (list) {
      setConversations(list);
      setListError(false);
      return true;
    }
    setListError(true);
    return false;
  }, [listConversations]);

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

  const loadThread = useCallback(async (matchId: string, showSpinner: boolean) => {
    if (showSpinner) setThreadLoading(true);
    const result = await fetchMessages(matchId);
    if (result) {
      setMessages(result.messages);
      setContext(result.context);
    }
    if (showSpinner) setThreadLoading(false);
    return !!result;
  }, [fetchMessages]);

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
    if (!activeMatchId) {
      setEvidence(null);
      return;
    }
    let active = true;
    fetchCandidateEvidence(activeMatchId).then((e) => {
      if (active) setEvidence(e);
    });
    return () => {
      active = false;
    };
  }, [activeMatchId, fetchCandidateEvidence]);

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

  const handleSubmitFlag = async () => {
    if (!flagMessageId || !flagReason.trim()) return;
    setFlagSubmitting(true);
    const ok = await flagMessage(flagMessageId, flagReason.trim());
    setFlagSubmitting(false);
    toast(ok ? "Message flagged for review" : "Couldn't flag message", ok ? "success" : "error");
    setFlagMessageId(null);
    setFlagReason("");
  };

  const handleSendInvite = async () => {
    if (!activeMatchId) return;
    setInviteSubmitting(true);
    const ok = await updateCandidateStatus(activeMatchId, {
      candidateStatus: "interview_invited",
      note: inviteNote.trim() || undefined,
      interviewScheduledAt: inviteDate || undefined,
    });
    setInviteSubmitting(false);
    if (!ok) {
      toast("Couldn't send the invite — please try again", "error");
      return;
    }
    toast("Interview invite sent", "success");
    setInviteOpen(false);
    setInviteNote("");
    setInviteDate("");
    loadThread(activeMatchId, false);
    loadConversations();
  };

  const handleReject = async () => {
    if (!activeMatchId) return;
    setRejectSubmitting(true);
    const ok = await updateCandidateStatus(activeMatchId, { candidateStatus: "rejected", note: rejectNote.trim() || undefined });
    setRejectSubmitting(false);
    if (!ok) {
      toast("Couldn't reject the candidate — please try again", "error");
      return;
    }
    toast("Candidate marked as rejected", "success");
    setRejectOpen(false);
    setRejectNote("");
    loadThread(activeMatchId, false);
    loadConversations();
  };

  const heading = (
    <div style={{ padding: mobile ? "12px 16px" : "16px 20px", borderBottom: `1px solid ${t.line}` }}>
      <h1 style={{ fontFamily: f.sans, fontSize: mobile ? 22 : 26, fontWeight: 700, color: t.coal, margin: 0, letterSpacing: "-0.01em", lineHeight: "32px" }}>Messages</h1>
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
  const groups = groupConversationsByCounterpart(list);
  const lastOwnMessageId = messages.filter((mm) => mm.senderRole === "employer").at(-1)?.id;

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
      <nav style={{ width: mobile ? "100%" : 280, display: mobile && active ? "none" : undefined, borderRight: mobile ? "none" : `1px solid ${t.line}`, overflowY: "auto", flexShrink: 0 }} aria-label="Conversations">
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
                    {c.lastMessageAt && (
                      <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, marginTop: 2 }}>
                        {new Date(c.lastMessageAt).toLocaleDateString()}
                      </div>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div style={{ flex: 1, display: mobile && !active ? "none" : "flex", flexDirection: "column", minWidth: 0 }}>
        {!active ? (
          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: t.inkFaint, fontFamily: f.sans, fontSize: 13 }}>
            Select a conversation
          </div>
        ) : (
          <>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.line}` }}>
              {mobile && (
                <Button type="button" variant="ghost" size="sm" onClick={() => { setActiveMatchId(null); router.replace("/employer/messages"); }} style={{ marginBottom: 6, marginLeft: -8, minHeight: 36 }}>
                  <ArrowLeftIcon size={14} aria-hidden="true" /> All conversations
                </Button>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal }}>{active.counterpartName}</span>
                    <CandidateStatusChip status={active.candidateStatus} />
                    {active.matchScore != null && <ScoreChip score={active.matchScore} />}
                  </div>
                  <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, marginTop: 2 }}>
                    {active.roleTitle}{context?.companyName ? ` · ${context.companyName}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {evidence && evidence.skills.length > 0 && (
                    <OutlineCta size="sm" onClick={() => setEvidenceOpen(true)}>
                      View evidence
                    </OutlineCta>
                  )}
                  {active.candidateStatus === "shortlisted" && (
                    <PrimaryCta size="sm" onClick={() => setInviteOpen(true)}>
                      Send Interview Invite
                    </PrimaryCta>
                  )}
                  {!["hired", "rejected", "not_a_fit"].includes(active.candidateStatus) && (
                    <OutlineCta size="sm" onClick={() => setRejectOpen(true)}>
                      Reject
                    </OutlineCta>
                  )}
                </div>
              </div>
            </div>
            <div
              ref={scrollRef}
              role="log"
              aria-live="polite"
              aria-label={`Conversation with ${active.counterpartName}`}
              style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}
            >
              {threadLoading && (
                <div style={{ display: "flex", flex: 1 }}>
                  <LoadingScreen fullScreen={false} message="Loading messages…" />
                </div>
              )}
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
                  <Message key={m.id} align={m.senderRole === "employer" ? "end" : "start"}>
                    <MessageAvatar className="self-center">
                      <Avatar size="sm">
                        <AvatarFallback>
                          {initialsOf(m.senderRole === "employer" ? companyName || "Me" : active.counterpartName)}
                        </AvatarFallback>
                      </Avatar>
                    </MessageAvatar>
                    <MessageContent>
                      <Bubble variant={m.senderRole === "employer" ? "default" : "secondary"}>
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
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => setFlagMessageId(m.id)}
                          style={{ fontSize: 12, height: "auto", padding: 0, color: t.inkFaint, display: "flex", alignItems: "center", gap: 2 }}
                        >
                          <FlagIcon size={11} aria-hidden="true" /> Report
                        </Button>
                      </div>
                      {m.senderRole === "employer" && m.id === lastOwnMessageId && (
                        <MessageFooter>Delivered</MessageFooter>
                      )}
                    </MessageContent>
                  </Message>
                ),
              )}
            </div>
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.line}`, display: "flex", flexDirection: "column", gap: 8 }}>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message…"
                aria-label="Message"
                rows={2}
                style={mobile ? { fontSize: 16 } : undefined}
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

            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send interview invite</DialogTitle>
                  <DialogDescription>Marks {active.counterpartName} as invited to interview for {active.roleTitle}.</DialogDescription>
                </DialogHeader>
                <div style={{ display: "grid", gap: 14, padding: "4px 0" }}>
                  <div style={{ display: "grid", gap: 8 }}>
                    <Label htmlFor="msg-invite-scheduled-at">Scheduled date (optional)</Label>
                    <Input id="msg-invite-scheduled-at" type="date" style={mobile ? { fontSize: 16 } : undefined} value={inviteDate} onChange={(e) => setInviteDate(e.target.value)} />
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <Label htmlFor="msg-invite-note">Note (optional)</Label>
                    <Textarea id="msg-invite-note" rows={3} style={mobile ? { fontSize: 16 } : undefined} value={inviteNote} onChange={(e) => setInviteNote(e.target.value)} placeholder="Anything you want on record about this invite…" />
                  </div>
                </div>
                <DialogFooter>
                  <OutlineCta onClick={() => setInviteOpen(false)}>Cancel</OutlineCta>
                  <PrimaryCta onClick={handleSendInvite} disabled={inviteSubmitting}>
                    {inviteSubmitting ? "Sending…" : "Send invite"}
                  </PrimaryCta>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reject this candidate?</DialogTitle>
                  <DialogDescription>Marks {active.counterpartName} as rejected for {active.roleTitle}. This can&apos;t be undone from here.</DialogDescription>
                </DialogHeader>
                <div style={{ display: "grid", gap: 8, padding: "4px 0" }}>
                  <Label htmlFor="msg-reject-note">Reason (optional)</Label>
                  <Textarea id="msg-reject-note" rows={3} style={mobile ? { fontSize: 16 } : undefined} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Anything you want on record about this decision…" />
                </div>
                <DialogFooter>
                  <OutlineCta onClick={() => setRejectOpen(false)}>Cancel</OutlineCta>
                  <Button type="button" variant="destructive" onClick={handleReject} disabled={rejectSubmitting}>
                    {rejectSubmitting ? "Rejecting…" : "Reject candidate"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={!!flagMessageId} onOpenChange={(open) => { if (!open) { setFlagMessageId(null); setFlagReason(""); } }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Report this message</DialogTitle>
                  <DialogDescription>Flags it for review — e.g. inappropriate content, spam, or off-platform contact info.</DialogDescription>
                </DialogHeader>
                <div style={{ display: "grid", gap: 8, padding: "4px 0" }}>
                  <Label htmlFor="msg-flag-reason">Reason</Label>
                  <Textarea
                    id="msg-flag-reason"
                    rows={3}
                    style={mobile ? { fontSize: 16 } : undefined}
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    placeholder="What's wrong with this message?"
                  />
                </div>
                <DialogFooter>
                  <OutlineCta onClick={() => { setFlagMessageId(null); setFlagReason(""); }}>Cancel</OutlineCta>
                  <Button type="button" variant="destructive" onClick={handleSubmitFlag} disabled={flagSubmitting || !flagReason.trim()}>
                    {flagSubmitting ? "Reporting…" : "Report message"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={evidenceOpen} onOpenChange={setEvidenceOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Practice-session evidence</DialogTitle>
                  <DialogDescription>{active.counterpartName}&apos;s most recent mock-interview performance.</DialogDescription>
                </DialogHeader>
                {evidence && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 0" }}>
                    {(evidence.readiness || evidence.starCompleteness) && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {evidence.readiness && (
                          <Pill tone={evidence.readiness.band === "strongHire" ? "success" : evidence.readiness.band === "hire" ? "indigo" : "neutral"}>
                            {evidence.readiness.band === "strongHire" ? "Strong hire" : evidence.readiness.band === "hire" ? "Hire" : "Lean hire"} readiness · {evidence.readiness.confidence} confidence
                          </Pill>
                        )}
                        {evidence.starCompleteness && (
                          <Pill tone={evidence.starCompleteness.pct >= 70 ? "success" : evidence.starCompleteness.pct >= 40 ? "neutral" : "indigo"}>
                            STAR completeness: {evidence.starCompleteness.pct}%
                          </Pill>
                        )}
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {evidence.skills.map((s) => (
                        <div key={s.name}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: f.sans, fontSize: 13, color: t.coal, marginBottom: 4 }}>
                            <span>{s.name}</span>
                            <strong>{Math.round(s.score)}</strong>
                          </div>
                          <div style={{ height: 6, borderRadius: 999, background: t.line, overflow: "hidden" }}>
                            <div style={{ width: `${Math.max(0, Math.min(100, s.score))}%`, height: "100%", background: s.score >= 70 ? t.success : s.score >= 50 ? t.warning : t.error }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {evidence.quotes.map((q, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: q.kind === "redFlag" ? t.error + "0d" : t.success + "0d",
                          border: `1px solid ${q.kind === "redFlag" ? t.error + "33" : t.success + "33"}`,
                        }}
                      >
                        <div style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 700, color: q.kind === "redFlag" ? t.error : t.success, marginBottom: 4 }}>
                          {q.kind === "redFlag" ? "Flag" : "Win"} · {q.text}
                        </div>
                        <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, fontStyle: "italic" }}>&ldquo;{q.quote}&rdquo;</div>
                      </div>
                    ))}
                  </div>
                )}
                <DialogFooter>
                  <OutlineCta onClick={() => setEvidenceOpen(false)}>Close</OutlineCta>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </div>,
  );
}
