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
import { MessageSquareIcon } from "lucide-react";
import { tokens as T, fonts as F } from "./auth/_tokens";
import { groupConversationsByCounterpart } from "./conversationGrouping";

/* ─── Messages bell ───────────────────────────────────────────────────────
 * Rendered in AppShellFrame's header next to NotificationBell, on both the
 * candidate and employer shells. Each shell supplies its own
 * fetchConversations + basePath (candidate -> /messages, employer ->
 * /employer/messages) since the two sides use different data-layer
 * conventions (direct fetch vs EmployerDataContext) — this component stays
 * generic over the shape both already return from GET /api/messages.
 * No unread/read-tracking exists in the schema (conversation_messages has
 * no read_at column — basic text chat, per product scope), so this is a
 * quick-access list, not a notification feed: no badge count. */

export interface ConversationSummary {
  matchId: string;
  conversationId: string;
  role: "employer" | "candidate";
  counterpartName: string;
  roleTitle: string;
  lastMessageAt: string | null;
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

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Messages"
          className="p-2 h-auto"
          style={{ position: "relative", flexShrink: 0 }}
        >
          <MessageSquareIcon size={16} aria-hidden="true" style={{ color: T.coal }} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" style={{ width: 340, padding: 0 }}>
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
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {conversations.length === 0 ? (
            <p style={{ margin: 0, padding: "24px 12px", textAlign: "center", fontFamily: F.sans, fontSize: 13, color: T.inkSoft }}>
              No conversations yet.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.counterpartName}>
                <p style={{
                  margin: 0, padding: "8px 12px 2px", fontFamily: F.sans, fontSize: 10.5, fontWeight: 700,
                  color: T.inkSoft, textTransform: "uppercase", letterSpacing: "0.04em",
                }}>
                  {group.counterpartName}
                </p>
                {group.conversations.map((c) => (
                  <button
                    key={c.conversationId}
                    type="button"
                    onClick={() => handleItemClick(c)}
                    style={{
                      display: "block", width: "100%", textAlign: "left", cursor: "pointer",
                      border: "none", borderBottom: `1px solid ${T.line}`, background: "transparent",
                      padding: "8px 12px 8px 20px",
                    }}
                  >
                    <p style={{ margin: 0, fontFamily: F.sans, fontSize: 12.5, fontWeight: 600, color: T.coal, lineHeight: 1.4 }}>
                      {c.roleTitle}
                    </p>
                    {c.lastMessageAt && (
                      <p style={{ margin: "3px 0 0", fontFamily: F.sans, fontSize: 11, color: T.inkSoft }}>
                        {timeAgo(c.lastMessageAt)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
