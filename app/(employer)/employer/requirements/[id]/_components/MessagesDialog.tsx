"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { FlagIcon, PaperclipIcon, SendIcon } from "lucide-react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useEmployerData, type ConversationMessage } from "@/employer/EmployerDataContext";
import { OutlineCta, PrimaryCta } from "@/employer/_atoms";
import { IdentityHiddenBadge, InlineNotice } from "@/employer/_requirementAtoms";
import { failureMessage, getMessages, postFlagMessage, postMessage } from "@/employer/_requirementCalls";

const MESSAGE_POLL_MS = 6000;
const MAX_ATTACHMENT_BYTES = 8_000_000;

/** Employer side of the employer<->candidate chat. Polls while open (same
    idiom as NotificationBell, no Realtime infra) and refetches right after a
    send so the sender sees their own message immediately. Every failure is
    shown inline next to the composer, with the HTTP status mapped to copy
    (402 unlock required, 403 suspended, 409 declined, 429 rate limit). */
export default function MessagesDialog({
  matchId,
  displayName,
  unlocked,
  suspended,
  onClose,
}: {
  matchId: string | null;
  displayName: string;
  unlocked: boolean;
  suspended: boolean;
  onClose: () => void;
}) {
  const { uploadMessageAttachment } = useEmployerData();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportResult, setReportResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (id: string, initial: boolean) => {
    if (initial) {
      setLoading(true);
      setLoadError(null);
    }
    const res = await getMessages(id);
    if (res.ok) {
      setMessages(res.data.messages);
      setLoadError(null);
    } else if (initial) {
      setLoadError(failureMessage("message", res));
    }
    if (initial) setLoading(false);
  }, []);

  useEffect(() => {
    if (!matchId) return;
    setMessages([]);
    setDraft("");
    setSendError(null);
    setReportingId(null);
    setReportResult(null);
    load(matchId, true);
    const interval = setInterval(() => load(matchId, false), MESSAGE_POLL_MS);
    return () => clearInterval(interval);
  }, [matchId, load]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const composerOff = suspended || sending || attaching;

  const handleSend = async () => {
    const text = draft.trim();
    if (!matchId || !text || composerOff) return;
    setSending(true);
    setSendError(null);
    const res = await postMessage(matchId, { body: text });
    setSending(false);
    if (!res.ok) {
      setSendError(failureMessage("message", res));
      return;
    }
    setDraft("");
    load(matchId, false);
  };

  const handleAttach = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !matchId || suspended) return;
    setSendError(null);
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setSendError("That file is too large. The limit is 8 MB.");
      return;
    }
    setAttaching(true);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    }).catch(() => null);
    if (!dataUrl) {
      setAttaching(false);
      setSendError("Couldn't read that file. Try a different one.");
      return;
    }
    const uploaded = await uploadMessageAttachment(matchId, {
      fileName: file.name,
      contentType: file.type,
      fileBase64: dataUrl.slice(dataUrl.indexOf(",") + 1),
    });
    if ("error" in uploaded) {
      setAttaching(false);
      setSendError(uploaded.error);
      return;
    }
    const res = await postMessage(matchId, {
      attachmentPath: uploaded.attachmentPath,
      attachmentName: uploaded.attachmentName,
      attachmentMime: uploaded.attachmentMime,
    });
    setAttaching(false);
    if (!res.ok) {
      setSendError(`The file uploaded but wasn't sent. ${failureMessage("message", res)}`);
      return;
    }
    load(matchId, false);
  };

  const submitReport = async () => {
    const reason = reportReason.trim();
    if (!reportingId || !reason) return;
    setReportBusy(true);
    const res = await postFlagMessage(reportingId, reason);
    setReportBusy(false);
    if (!res.ok) {
      setReportResult({ tone: "error", text: failureMessage("message", res) });
      return;
    }
    setReportResult({ tone: "success", text: "Thanks. We've flagged that message for review." });
    setReportingId(null);
    setReportReason("");
    if (matchId) load(matchId, false);
  };

  const description = unlocked
    ? "Chat stays on HireStepX. Messages that share contact details are flagged for review."
    : "You can message this candidate because they said they're interested. Their name and contact details stay hidden until you unlock them.";

  return (
    <Dialog open={matchId != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent style={{ maxWidth: 480 }} aria-describedby="messages-dialog-desc">
        <DialogHeader>
          <DialogTitle>Message {displayName}</DialogTitle>
          <DialogDescription id="messages-dialog-desc">{description}</DialogDescription>
          {!unlocked && (
            <div>
              <IdentityHiddenBadge compact />
            </div>
          )}
        </DialogHeader>

        <div
          ref={listRef}
          role="log"
          aria-live="polite"
          aria-label={`Conversation with ${displayName}`}
          aria-busy={loading}
          // Scrollable region must be keyboard-focusable (axe scrollable-region-focusable).
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto", padding: "4px 2px", outlineColor: t.indigo }}
        >
          {loading && (
            <>
              <Skeleton aria-hidden="true" style={{ height: 40, width: "60%" }} />
              <Skeleton aria-hidden="true" style={{ height: 40, width: "45%", alignSelf: "flex-end" }} />
            </>
          )}
          {!loading && !loadError && messages.length === 0 && (
            <p style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint, margin: 0 }}>No messages yet. Say hello below.</p>
          )}
          {messages.map((m) => {
            const mine = m.senderRole === "employer";
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: mine ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  background: mine ? t.indigo100 : t.creamSoft,
                  borderRadius: 10,
                  padding: "8px 10px",
                  overflowWrap: "anywhere",
                }}
              >
                <span className="sr-only">{mine ? "You" : displayName}: </span>
                {m.body && <div style={{ fontFamily: f.sans, fontSize: textSize.md, color: t.coal, whiteSpace: "pre-wrap" }}>{m.body}</div>}
                {m.attachmentPath && (
                  <div style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.indigoDeep, marginTop: m.body ? 4 : 0 }}>
                    <PaperclipIcon size={12} style={{ display: "inline", marginRight: 4 }} aria-hidden="true" />
                    {m.attachmentName || "Attachment"}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  <time dateTime={m.createdAt} style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint }}>
                    {new Date(m.createdAt).toLocaleString()}
                  </time>
                  {m.flagged && <Badge variant="destructive">Flagged</Badge>}
                  {!mine && !m.flagged && (
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => {
                        setReportingId(m.id);
                        setReportResult(null);
                      }}
                      aria-label={`Report this message from ${displayName}`}
                      className="pointer-coarse:min-h-11"
                      style={{ fontSize: textSize.sm, height: "auto", padding: 0, color: t.inkFaint, display: "flex", alignItems: "center", gap: 2 }}
                    >
                      <FlagIcon size={11} aria-hidden="true" /> Report
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {loadError && (
          <InlineNotice
            tone="error"
            title="Couldn't load this conversation"
            action={matchId ? <OutlineCta size="sm" onClick={() => load(matchId, true)}>Try again</OutlineCta> : undefined}
          >
            {loadError}
          </InlineNotice>
        )}

        {reportingId && (
          <div style={{ display: "grid", gap: 8, padding: 12, border: `1px solid ${t.line}`, borderRadius: 12, background: t.creamSoft }}>
            <Label htmlFor="report-reason">Why are you reporting this message?</Label>
            <Textarea
              id="report-reason"
              rows={2}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Inappropriate, spam, off-platform contact…"
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <OutlineCta
                size="sm"
                onClick={() => {
                  setReportingId(null);
                  setReportReason("");
                }}
                disabled={reportBusy}
              >
                Cancel
              </OutlineCta>
              <PrimaryCta size="sm" onClick={submitReport} loading={reportBusy} disabled={!reportReason.trim()}>
                Submit report
              </PrimaryCta>
            </div>
          </div>
        )}
        {reportResult && <InlineNotice tone={reportResult.tone}>{reportResult.text}</InlineNotice>}

        <DialogFooter style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          {suspended && (
            <InlineNotice tone="warning" live={false}>
              Messaging is turned off while your employer account is suspended.
            </InlineNotice>
          )}
          {sendError && <InlineNotice tone="error">{sendError}</InlineNotice>}
          <Label htmlFor="message-draft" className="sr-only">
            Message to {displayName}
          </Label>
          <Textarea
            id="message-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message…"
            rows={2}
            disabled={suspended}
            aria-describedby="message-draft-hint"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <span id="message-draft-hint" className="sr-only">
            Press Enter to send, Shift and Enter for a new line.
          </span>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <input
                id="message-attachment"
                type="file"
                onChange={handleAttach}
                disabled={suspended || attaching || sending}
                className="peer sr-only"
              />
              <label
                htmlFor="message-attachment"
                className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-50 pointer-coarse:min-h-11"
                style={{ cursor: suspended || attaching ? "default" : "pointer", fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft, outlineColor: t.indigo }}
              >
                <PaperclipIcon size={14} aria-hidden="true" /> {attaching ? "Uploading…" : "Attach file (8 MB max)"}
              </label>
            </div>
            <PrimaryCta size="sm" icon={<SendIcon size={13} aria-hidden="true" />} onClick={handleSend} loading={sending} disabled={composerOff || !draft.trim()}>
              {sending ? "Sending…" : "Send"}
            </PrimaryCta>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
