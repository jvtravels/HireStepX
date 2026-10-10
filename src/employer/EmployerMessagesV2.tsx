"use client";

/* Employer-side Messages inbox — mirrors ../MessagesV2.tsx (candidate side)
   but goes through EmployerDataContext for all reads/writes, matching the
   established employer data-layer convention instead of a direct-fetch
   module. Reachable via the header MessagesBell (AppShellFrame.tsx) and
   deep-links via ?matchId=... the same way the candidate page does. */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMaxWidth } from "../hooks/useMaxWidth";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircleIcon, MessagesSquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { useToast } from "../Toast";
import { playUiSound } from "../uiSounds";
import { OutlineCta, PrimaryCta, Pill, ScoreChip } from "./_atoms";
import { MaskedIdentity, isMaskedName } from "./_atoms2";
import InterviewInviteDialog, { canInviteToInterview, statusErrorCopy, type InviteResult, type InviteValues } from "./InterviewInviteDialog";
import type { CandidateStatus } from "./mockData";
import MessagingLayout, { useRailState } from "../messaging/MessagingLayout";
import ConversationList from "../messaging/ConversationList";
import ThreadHeader from "../messaging/ThreadHeader";
import ThreadLog from "../messaging/ThreadLog";
import Composer, { ATTACHMENT_MAX_BYTES, type ComposerBlock } from "../messaging/Composer";
import ContextRail from "../messaging/ContextRail";
import StatusPill from "../messaging/StatusPill";
import {
  EMPLOYER_QUICK_REPLIES,
  filterInbox,
  sortInbox,
  statusTone,
  useFavorites,
  type InboxFilter,
  type InboxItem,
} from "../messaging/helpers";

const LIST_POLL_MS = 15000;
const THREAD_POLL_MS = 6000;

const STATUS_LABEL: Record<string, string> = {
  shortlisted: "Shortlisted",
  interview_invited: "Interview invited",
  interviewing: "Interviewing",
  hired: "Hired",
  rejected: "Rejected",
  not_a_fit: "Not a fit",
  no_response: "No response",
};

function DialogError({ children, unlock }: { children: React.ReactNode; unlock: boolean }) {
  return (
    <p role="alert" style={{ margin: 0, padding: "8px 10px", borderRadius: 8, background: t.error100, border: `1px solid ${t.errorLine}`, color: t.errorInk, fontFamily: f.sans, fontSize: 13, lineHeight: 1.5 }}>
      {children}{" "}
      {unlock && <Link href="/employer/requirements" style={{ color: t.errorInk, fontWeight: 600, textDecoration: "underline" }}>Go to shortlists</Link>}
    </p>
  );
}

export default function EmployerMessagesV2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const mobile = useMaxWidth(768);
  const { listConversations, fetchMessages, uploadMessageAttachment, flagMessage, fetchCandidateEvidence, fetchMessageAttachmentUrl, companyName, suspended, sendMessageResult, updateCandidateStatusResult } = useEmployerData();

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
  const [composerError, setComposerError] = useState<string | null>(null);
  const [unlockBlocked, setUnlockBlocked] = useState(false);
  const [threadError, setThreadError] = useState(false);
  const [announcement, setAnnouncement] = useState({ n: 0, text: "" });
  const scrollRef = useRef<HTMLDivElement>(null);
  const threadHeadingRef = useRef<HTMLDivElement>(null);
  const activeMatchRef = useRef<string | null>(activeMatchId);
  const restoreFocusRef = useRef<string | null>(null);

  const [evidence, setEvidence] = useState<CandidateEvidence | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const [filter, setFilter] = useState<InboxFilter>("all");
  const [query, setQuery] = useState("");
  const { favorites, toggle: toggleFavorite } = useFavorites("employer");
  const railState = useRailState();

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

  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  const loadThread = useCallback(async (matchId: string, showSpinner: boolean) => {
    if (showSpinner) setThreadLoading(true);
    const result = await fetchMessages(matchId);
    // A slow response for a thread the user has already left must not overwrite the current one.
    if (activeMatchRef.current !== matchId) return !!result;
    if (result) {
      const seen = seenMessageIdsRef.current;
      if (showSpinner) seen.clear();
      else if (result.messages.some((m) => m.senderRole !== "employer" && m.senderRole !== "system" && !seen.has(m.id))) {
        playUiSound("receive");
        setAnnouncement((a) => ({ n: a.n + 1, text: `New message from ${result.context?.candidateName ?? "the candidate"}` }));
      }
      for (const m of result.messages) seen.add(m.id);
      setMessages(result.messages);
      setContext(result.context);
    }
    setThreadError(!result);
    if (showSpinner) setThreadLoading(false);
    return !!result;
  }, [fetchMessages]);

  useEffect(() => {
    activeMatchRef.current = activeMatchId;
    setMessages([]);
    setContext(null);
    setThreadError(false);
    setComposerError(null);
    setUnlockBlocked(false);
    setAnnouncement({ n: 0, text: "" });
    if (!activeMatchId) return;
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

  // Once the thread's name is no longer the masked placeholder the candidate has been unlocked, so lift the block.
  const threadCandidateName = context?.candidateName;
  useEffect(() => {
    if (threadCandidateName && !isMaskedName(threadCandidateName)) setUnlockBlocked(false);
  }, [threadCandidateName]);

  const selectConversation = (matchId: string) => {
    setActiveMatchId(matchId);
    router.replace(`/employer/messages?matchId=${matchId}`);
    if (mobile) requestAnimationFrame(() => threadHeadingRef.current?.focus());
  };

  const backToList = () => {
    restoreFocusRef.current = activeMatchId;
    setActiveMatchId(null);
    router.replace("/employer/messages");
  };

  // After the mobile "Back" button swaps panes, put focus on the row the user came from.
  useEffect(() => {
    if (activeMatchId || !restoreFocusRef.current) return;
    const id = restoreFocusRef.current;
    restoreFocusRef.current = null;
    requestAnimationFrame(() => document.getElementById(`conv-${id}`)?.focus());
  }, [activeMatchId]);

  /* 402 becomes a persistent composer block (with an unlock CTA); anything else is a recoverable inline error. */
  const handleSendFailure = (err: { error: string; status?: number; code?: string }) => {
    if (err.code === "unlock_required" || err.status === 402) {
      setUnlockBlocked(true);
      return;
    }
    setComposerError(err.status === 403 || err.code === "suspended" ? "Your account is suspended. Contact support to restore access." : err.error || "Couldn't send message — please try again.");
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !activeMatchId || sending || attaching) return;
    setSending(true);
    setComposerError(null);
    const sent = await sendMessageResult(activeMatchId, { body: text });
    setSending(false);
    if (!sent.ok) {
      handleSendFailure(sent.error);
      return;
    }
    playUiSound("send");
    setDraft("");
    loadThread(activeMatchId, false);
    loadConversations();
  };

  const handleAttach = async (file: File) => {
    if (!activeMatchId) return;
    setComposerError(null);
    if (file.size > ATTACHMENT_MAX_BYTES) {
      setComposerError(`"${file.name}" is too large — attachments can be 8 MB at most.`);
      return;
    }
    setAttaching(true);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    }).catch(() => "");
    if (!dataUrl) {
      setAttaching(false);
      setComposerError(`Couldn't read "${file.name}". Try a different file.`);
      return;
    }
    const fileBase64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const uploaded = await uploadMessageAttachment(activeMatchId, { fileName: file.name, contentType: file.type, fileBase64 });
    if ("error" in uploaded) {
      setAttaching(false);
      setComposerError(uploaded.error || `Couldn't upload "${file.name}" — please try again.`);
      return;
    }
    const sent = await sendMessageResult(activeMatchId, {
      attachmentPath: uploaded.attachmentPath,
      attachmentName: uploaded.attachmentName,
      attachmentMime: uploaded.attachmentMime,
    });
    setAttaching(false);
    if (!sent.ok) {
      if (sent.error.code === "unlock_required" || sent.error.status === 402) handleSendFailure(sent.error);
      else setComposerError(`"${file.name}" uploaded but wasn't sent. ${sent.error.error || "Please try again."}`);
      return;
    }
    playUiSound("send");
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

  const handleSendInvite = async ({ note, scheduledAt }: InviteValues): Promise<InviteResult> => {
    if (!activeMatchId) return { ok: false };
    const res = await updateCandidateStatusResult(activeMatchId, {
      candidateStatus: "interview_invited",
      note,
      interviewScheduledAt: scheduledAt,
    });
    if (!res.ok) return { ok: false, message: statusErrorCopy(res.error) };
    toast("Interview invite sent", "success");
    loadThread(activeMatchId, false);
    loadConversations();
    return { ok: true };
  };

  const handleReject = async () => {
    if (!activeMatchId) return;
    setRejectSubmitting(true);
    setRejectError(null);
    const res = await updateCandidateStatusResult(activeMatchId, { candidateStatus: "rejected", note: rejectNote.trim() || undefined });
    setRejectSubmitting(false);
    if (!res.ok) {
      setRejectError(statusErrorCopy(res.error));
      return;
    }
    toast("Candidate marked as rejected", "success");
    setRejectOpen(false);
    setRejectNote("");
    loadThread(activeMatchId, false);
    loadConversations();
  };

  const list = conversations ?? [];
  const active = list.find((c) => c.matchId === activeMatchId) ?? null;
  const unreadCount = list.filter((c) => c.unread).length;

  const shell = (body: React.ReactNode) => (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-background">
      {suspended && (
        <div role="status" className="border-b border-red-300 bg-red-50 px-4 py-2.5 text-[13px] leading-normal text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          <strong>Your account is suspended.</strong> Conversations are read-only until access is restored. Contact support for help.
        </div>
      )}
      {body}
    </div>
  );

  if (conversations === null && !listError) {
    return shell(
      <div className="flex min-h-0 flex-1">
        <LoadingScreen fullScreen={false} message="Loading your conversations…" />
      </div>,
    );
  }

  if (conversations === null) {
    return shell(
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center" role="alert">
        <AlertCircleIcon aria-hidden="true" className="size-6 text-muted-foreground" />
        <p className="m-0 text-sm font-semibold text-foreground">Couldn&apos;t load your messages</p>
        <p className="m-0 text-[13px] text-muted-foreground">Check your connection and try again.</p>
        <Button variant="outline" size="lg" className="pointer-coarse:h-11 px-4" onClick={loadConversations}>Retry</Button>
      </div>,
    );
  }

  if (list.length === 0) {
    return shell(
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-6 py-14 text-center">
        <MessagesSquareIcon aria-hidden="true" className="size-7 text-muted-foreground" />
        <p className="m-0 text-sm font-semibold text-foreground">No conversations yet</p>
        <p className="m-0 max-w-sm text-[13px] leading-normal text-muted-foreground">
          Once you unlock a candidate and send a message, it&apos;ll show up here.
        </p>
        <Button asChild size="lg" className="pointer-coarse:h-11 px-4">
          <Link href="/employer/requirements">Review your shortlists</Link>
        </Button>
      </div>,
    );
  }

  const items: InboxItem[] = list.map((c) => ({
    matchId: c.matchId,
    name: c.counterpartName,
    masked: isMaskedName(c.counterpartName),
    roleTitle: c.roleTitle,
    lastMessageAt: c.lastMessageAt,
    unread: c.unread,
    statusLabel: STATUS_LABEL[c.candidateStatus] || c.candidateStatus,
    statusTone: statusTone(c.candidateStatus),
  }));
  const visible = sortInbox(filterInbox(items, filter, query, favorites));

  const activeName = active ? active.counterpartName : "";
  const activeMasked = active ? isMaskedName(context?.candidateName ?? active.counterpartName) : false;
  const composerBlock: ComposerBlock = suspended ? "suspended" : unlockBlocked ? "unlock" : null;
  const suspendedTitle = suspended ? "Unavailable while your account is suspended" : undefined;

  const thread = active ? (
    <>
      <ThreadHeader
        name={activeName}
        masked={activeMasked}
        title={<MaskedIdentity as="h2" name={activeName} masked={activeMasked} nameStyle={{ fontSize: 15 }} />}
        subtitle={`${active.roleTitle}${context?.companyName ? ` · ${context.companyName}` : ""}`}
        headingRef={threadHeadingRef}
        badges={
          <>
            <StatusPill label={STATUS_LABEL[active.candidateStatus] || active.candidateStatus} tone={statusTone(active.candidateStatus)} />
            {active.matchScore != null && <ScoreChip score={active.matchScore} />}
          </>
        }
        actions={
          <>
            {canInviteToInterview(active.candidateStatus as CandidateStatus) && (
              <PrimaryCta size="sm" disabled={suspended} title={suspendedTitle} onClick={() => setInviteOpen(true)}>
                Send Interview Invite
              </PrimaryCta>
            )}
            {!["hired", "rejected", "not_a_fit"].includes(active.candidateStatus) && (
              <OutlineCta size="sm" disabled={suspended} title={suspendedTitle} onClick={() => { setRejectError(null); setRejectOpen(true); }}>
                Reject
              </OutlineCta>
            )}
          </>
        }
        favorite={favorites.has(active.matchId)}
        onToggleFavorite={() => toggleFavorite(active.matchId)}
        onBack={mobile ? backToList : undefined}
        railOpen={railState.open}
        onToggleRail={() => railState.setOpen(!railState.open)}
      />
      <ThreadLog
        messages={messages}
        viewerRole="employer"
        selfName={companyName || "Me"}
        otherName={activeName}
        otherMasked={isMaskedName(activeName)}
        loading={threadLoading}
        error={threadError}
        scrollRef={scrollRef}
        announcement={announcement}
        emptyHint="Say hello to start the conversation."
        onRetry={() => activeMatchId && loadThread(activeMatchId, true)}
        onOpenAttachment={openAttachment}
        onReport={setFlagMessageId}
      />
      <Composer
        counterpartName={activeName}
        masked={activeMasked}
        draft={draft}
        onDraftChange={setDraft}
        onSend={handleSend}
        onAttach={handleAttach}
        sending={sending}
        attaching={attaching}
        block={composerBlock}
        error={composerError}
        onDismissError={() => setComposerError(null)}
        quickReplies={EMPLOYER_QUICK_REPLIES}
      />

    </>
  ) : null;

  return shell(
    <>
      {listError && <span role="status" className="sr-only">Couldn&apos;t refresh conversations. Retrying.</span>}
      <MessagingLayout
        list={
          <ConversationList
            title="Messages"
            items={visible}
            total={items.length}
            activeMatchId={activeMatchId}
            favorites={favorites}
            filter={filter}
            query={query}
            unreadCount={unreadCount}
            refreshFailed={listError}
            onFilterChange={setFilter}
            onQueryChange={setQuery}
            onSelect={selectConversation}
            onToggleFavorite={toggleFavorite}
            onRetry={loadConversations}
          />
        }
        thread={thread}
        rail={
          active ? (
            <ContextRail
              facts={[
                { label: "Candidate", value: <MaskedIdentity name={activeName} masked={activeMasked} nameStyle={{ fontSize: 13 }} /> },
                { label: "Role", value: active.roleTitle },
                { label: "Status", value: STATUS_LABEL[active.candidateStatus] || active.candidateStatus },
                ...(active.matchScore != null ? [{ label: "Match", value: <ScoreChip score={active.matchScore} /> }] : []),
              ]}
              interviewAt={context?.interviewScheduledAt ?? null}
              messages={messages}
              onOpenAttachment={openAttachment}
            >
              {evidence && evidence.skills.length > 0 && (
                <OutlineCta size="sm" onClick={() => setEvidenceOpen(true)}>View evidence</OutlineCta>
              )}
            </ContextRail>
          ) : null
        }
        railState={railState}
        narrow={mobile}
        hasActive={!!active}
        placeholder={activeMatchId ? "That conversation isn't available. Pick another from the list." : "Select a conversation"}
      />
      {active && (
        <>
            <InterviewInviteDialog
              open={inviteOpen}
              onOpenChange={setInviteOpen}
              displayName={activeName}
              requirementTitle={active.roleTitle}
              onSubmit={handleSendInvite}
            />

            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reject this candidate?</DialogTitle>
                  <DialogDescription>Marks {activeName} as rejected for {active.roleTitle}. This can&apos;t be undone from here.</DialogDescription>
                </DialogHeader>
                <div style={{ display: "grid", gap: 8, padding: "4px 0" }}>
                  <Label htmlFor="msg-reject-note">Reason (optional)</Label>
                  <Textarea id="msg-reject-note" rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Anything you want on record about this decision…" />
                  {rejectError && <DialogError unlock={rejectError.startsWith("Unlock")}>{rejectError}</DialogError>}
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
                  <DialogDescription>{activeName}&apos;s most recent mock-interview performance.</DialogDescription>
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
    </>,
  );
}
