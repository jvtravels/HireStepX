"use client";

/* Candidate-side Messages tab — chat + file sharing with employers who've
   unlocked your contact details (see supabase-migrations/
   0027-employer-candidate-messaging.sql). Presentation lives in
   src/messaging (shared with the employer inbox); this file owns the
   candidate data flow. Deep-links via ?matchId=... (JobDetailModal's
   "Message employer" button navigates here with it).

   Polling-based like every other live surface in this app (no Supabase
   Realtime anywhere in the codebase) — NotificationBell's 60s poll is the
   baseline idiom; this uses a shorter interval since a thread being
   actively read benefits more from freshness. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircleIcon, MessagesSquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessagesRouteSkeleton } from "@/routeSkeletons";
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
import { useToast } from "./Toast";
import EmployerActionsMenu, { EmployerResponseBadge } from "./EmployerActionsMenu";
import { readStoredResponse, type EmployerResponse } from "./employerActions";
import { playUiSound } from "./uiSounds";
import { usePolling } from "./usePolling";
import { useMaxWidth } from "./hooks/useMaxWidth";
import MessagingLayout, { useRailState } from "./messaging/MessagingLayout";
import ConversationList from "./messaging/ConversationList";
import ThreadHeader from "./messaging/ThreadHeader";
import ThreadLog from "./messaging/ThreadLog";
import Composer from "./messaging/Composer";
import ContextRail from "./messaging/ContextRail";
import StatusPill from "./messaging/StatusPill";
import {
  CANDIDATE_QUICK_REPLIES,
  filterInbox,
  sortInbox,
  statusTone,
  useFavorites,
  type InboxFilter,
  type InboxItem,
} from "./messaging/helpers";

const LIST_POLL_MS = 15000;
const THREAD_POLL_MS = 6000;

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
  const [resolvedMatchId, setResolvedMatchId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [query, setQuery] = useState("");
  const { favorites, toggle: toggleFavorite } = useFavorites("candidate");
  const railState = useRailState();
  const [responses, setResponses] = useState<Record<string, EmployerResponse | null>>({});

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

  /* Backs off on consecutive failures (a fixed-interval poll that keeps
     firing through a 429 would never let the rate-limit window go idle) and
     pauses entirely while the tab is hidden — see usePolling. */
  usePolling(loadConversations, LIST_POLL_MS);

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
    setResolvedMatchId(matchId);
    return !!result;
  }, []);

  useEffect(() => {
    if (!activeMatchId) {
      setMessages([]);
      setContext(null);
    }
  }, [activeMatchId]);

  usePolling(
    (first) => loadThread(activeMatchId as string, first),
    THREAD_POLL_MS,
    { restartKey: activeMatchId, enabled: !!activeMatchId, maxBackoffMs: 60_000 },
  );

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

  const handleAttach = async (file: File) => {
    if (!activeMatchId) return;
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

  const shell = (body: React.ReactNode) => (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background">{body}</div>
  );

  if (conversations === null && !listError) {
    return shell(<MessagesRouteSkeleton />);
  }

  if (listError) {
    return shell(
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16" role="alert">
        <AlertCircleIcon aria-hidden="true" className="size-6 text-muted-foreground" />
        <p className="m-0 text-sm font-semibold text-foreground">Couldn&apos;t load your messages</p>
        <Button variant="outline" className="pointer-coarse:h-11 px-4" onClick={loadConversations}>Retry</Button>
      </div>,
    );
  }

  const realList = conversations ?? [];
  // A thread opened via "Message employer" has no conversations row until the
  // first message is sent, so it isn't in the inbox list yet — build a
  // placeholder entry from the thread context so the composer still opens.
  const pendingConversation: ConversationSummary | null =
    activeMatchId && context && !realList.some((c) => c.matchId === activeMatchId)
      ? {
          matchId: activeMatchId,
          conversationId: "",
          role: "candidate",
          counterpartName: context.companyName,
          companyName: context.companyName,
          roleTitle: context.roleTitle,
          lastMessageAt: null,
          unread: false,
          candidateStatus: context.candidateStatus,
          matchScore: context.matchScore,
        }
      : null;
  const list = pendingConversation ? [pendingConversation, ...realList] : realList;
  const active = list.find((c) => c.matchId === activeMatchId) ?? null;
  const activeResponse: EmployerResponse | null = active
    ? (active.matchId in responses ? responses[active.matchId] : readStoredResponse(active.matchId))
    : null;

  if (list.length === 0 && activeMatchId && resolvedMatchId !== activeMatchId) {
    return shell(<MessagesRouteSkeleton />);
  }

  if (list.length === 0) {
    return shell(
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-6 py-14 text-center">
        <MessagesSquareIcon aria-hidden="true" className="size-7 text-muted-foreground" />
        <p className="m-0 text-sm font-semibold text-foreground">No conversations yet</p>
        <p className="m-0 max-w-sm text-[13px] leading-normal text-muted-foreground">
          Once an employer unlocks your contact details and sends a message, it&apos;ll show up here.
        </p>
      </div>,
    );
  }

  // The candidate's counterpart is always the hiring company, never a person.
  const items: InboxItem[] = list.map((c) => ({
    matchId: c.matchId,
    name: c.companyName,
    masked: false,
    roleTitle: c.roleTitle,
    lastMessageAt: c.lastMessageAt,
    unread: c.unread,
    statusLabel: STATUS_LABEL[c.candidateStatus] || c.candidateStatus,
    statusTone: statusTone(c.candidateStatus),
  }));
  const visible = sortInbox(filterInbox(items, filter, query, favorites));
  const unreadCount = items.filter((i) => i.unread).length;
  const companyName = active ? context?.companyName || active.companyName : "";
  const statusLabel = active ? STATUS_LABEL[active.candidateStatus] || active.candidateStatus : "";

  const thread = active ? (
    <>
      <ThreadHeader
        name={companyName}
        masked={false}
        subtitle={active.roleTitle}
        badges={
          <>
            <StatusPill label={statusLabel} tone={statusTone(active.candidateStatus)} />
            <EmployerResponseBadge response={activeResponse} />
          </>
        }
        actions={
          <EmployerActionsMenu
            matchId={active.matchId}
            employerLabel={companyName}
            response={activeResponse}
            onResponseChange={(value) => setResponses((prev) => ({ ...prev, [active.matchId]: value }))}
            onRemoved={() => {
              setConversations((prev) => prev?.filter((c) => c.matchId !== active.matchId) ?? prev);
              backToList();
            }}
            onToast={(msg, kind) => toast(msg, kind)}
          />
        }
        favorite={favorites.has(active.matchId)}
        onToggleFavorite={() => toggleFavorite(active.matchId)}
        onBack={isNarrow ? backToList : undefined}
        railOpen={railState.open}
        onToggleRail={() => railState.setOpen(!railState.open)}
      />
      <ThreadLog
        messages={messages}
        viewerRole="candidate"
        selfName={context?.candidateName || "Me"}
        otherName={companyName}
        otherMasked={false}
        loading={threadLoading}
        error={false}
        scrollRef={scrollRef}
        announcement={{ n: 0, text: "" }}
        emptyHint={`Say hello to ${companyName}.`}
        onRetry={() => activeMatchId && loadThread(activeMatchId, true)}
        onOpenAttachment={openAttachment}
      />
      <Composer
        counterpartName={companyName}
        masked={false}
        draft={draft}
        onDraftChange={setDraft}
        onSend={handleSend}
        onAttach={handleAttach}
        sending={sending}
        attaching={attaching}
        block={null}
        error={null}
        onDismissError={() => {}}
        quickReplies={CANDIDATE_QUICK_REPLIES}
      />
    </>
  ) : null;

  return shell(
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
          refreshFailed={false}
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
              { label: "Company", value: companyName },
              { label: "Role", value: active.roleTitle },
              { label: "Status", value: statusLabel },
            ]}
            interviewAt={context?.interviewScheduledAt ?? null}
            messages={messages}
            onOpenAttachment={openAttachment}
          />
        ) : null
      }
      railState={railState}
      narrow={isNarrow}
      hasActive={!!active}
      placeholder="Select a conversation"
    />,
  );
}
