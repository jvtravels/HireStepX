"use client";

import { useEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MessageSquareIcon, MessagesSquareIcon } from "lucide-react";
import { tokens as T, fonts as F } from "./auth/_tokens";
import { groupConversationsByCounterpart } from "./conversationGrouping";
import CountBadge from "./CountBadge";

/* ─── Messages bell ───────────────────────────────────────────────────────
 * Rendered in AppShellFrame's header next to NotificationBell, on both the
 * candidate and employer shells. Each shell supplies its own
 * fetchConversations + basePath (candidate -> /messages, employer ->
 * /employer/messages) since the two sides use different data-layer
 * conventions (direct fetch vs EmployerDataContext) — this component stays
 * generic over the shape both already return from GET /api/messages.
 * `unread` is computed server-side (conversations.employer_last_read_at /
 * candidate_last_read_at vs last_message_at) in messages.ts. */

export interface ConversationSummary {
  matchId: string;
  conversationId: string;
  role: "employer" | "candidate";
  counterpartName: string;
  roleTitle: string;
  lastMessageAt: string | null;
  unread?: boolean;
  candidateStatus?: string;
  matchScore?: number | null;
}

const POLL_MS = 60_000;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function MessagesBell({
  onNavigate,
  fetchConversations,
  basePath,
}: {
  onNavigate: (path: string) => void;
  fetchConversations: () => Promise<ConversationSummary[] | null>;
  basePath: string;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [open, setOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const result = await fetchConversations();
    if (result) setConversations(result);
  }

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleItemClick(c: ConversationSummary) {
    setOpen(false);
    onNavigate(`${basePath}?matchId=${encodeURIComponent(c.matchId)}`);
  }

  const groups = groupConversationsByCounterpart(conversations);
  const unreadCount = conversations.filter((c) => c.unread).length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={unreadCount > 0 ? `Messages (${unreadCount} unread)` : "Messages"}
          className="p-2 h-auto"
          style={{ position: "relative", flexShrink: 0 }}
        >
          <MessageSquareIcon size={16} aria-hidden="true" style={{ color: T.coal }} />
          <CountBadge count={unreadCount} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" style={{ width: "min(340px, calc(100vw - 24px))", padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px" }}>
          <DropdownMenuLabel className="p-0 font-normal" style={{ fontFamily: F.sans, fontSize: 13.5, fontWeight: 600, color: T.coal }}>
            Messages
          </DropdownMenuLabel>
          <button
            type="button"
            onClick={() => { setOpen(false); onNavigate(basePath); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: T.indigo }}
          >
            View all
          </button>
        </div>
        <DropdownMenuSeparator className="m-0" />
        <nav style={{ maxHeight: 360, overflowY: "auto" }} aria-label="Conversations">
          {conversations.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "28px 16px", textAlign: "center" }}>
              <MessagesSquareIcon size={22} color={T.inkFaint} aria-hidden="true" />
              <p style={{ margin: 0, fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: T.coal }}>No conversations yet</p>
              <p style={{ margin: 0, fontFamily: F.sans, fontSize: 12, color: T.inkFaint, lineHeight: 1.4 }}>
                New messages will show up here.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.counterpartName}>
                <p aria-hidden="true" style={{
                  margin: 0, padding: "8px 12px 2px", fontFamily: F.sans, fontSize: 10.5, fontWeight: 700,
                  color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.04em",
                }}>
                  {group.counterpartName}
                </p>
                <div role="list" aria-label={group.counterpartName}>
                  {group.conversations.map((c) => (
                    <div key={c.conversationId} role="listitem">
                      <button
                        type="button"
                        onClick={() => handleItemClick(c)}
                        style={{
                          display: "block", width: "100%", textAlign: "left", cursor: "pointer",
                          border: "none", borderBottom: `1px solid ${T.line}`, background: c.unread ? T.pageBg : "transparent",
                          padding: "8px 12px 8px 20px",
                        }}
                      >
                        <p style={{ margin: 0, fontFamily: F.sans, fontSize: 12.5, fontWeight: 600, color: T.coal, lineHeight: 1.4, display: "flex", alignItems: "center", gap: 6 }}>
                          {c.unread && (
                            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: T.indigo, flexShrink: 0 }} />
                          )}
                          {c.roleTitle}
                        </p>
                        {c.lastMessageAt && (
                          <p style={{ margin: "3px 0 0", fontFamily: F.sans, fontSize: 11, color: T.inkSoft }}>
                            {timeAgo(c.lastMessageAt)}
                          </p>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </nav>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
