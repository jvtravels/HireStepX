"use client";

/* Composer for EmployerMessagesV2 — split out so the inbox shell stays small.
   Owns the textarea, the attach affordance and every "can't send" explanation
   (unlock required / suspended / transient error), so the disabled state is
   always paired with a visible reason and, where one exists, a way forward. */

import Link from "next/link";
import { useId, useRef } from "react";
import { LockIcon, PaperclipIcon, SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { tokens as t, fonts as f } from "../auth/_tokens";

export const ATTACHMENT_MAX_BYTES = 8_000_000;

export type ComposerBlock = "unlock" | "suspended" | null;

export interface MessageComposerProps {
  counterpartName: string;
  masked: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  onAttach: (file: File) => void;
  sending: boolean;
  attaching: boolean;
  block: ComposerBlock;
  /** Inline, recoverable error from the last send/attach attempt. */
  error: string | null;
  onDismissError: () => void;
  mobile: boolean;
}

const noticeBase = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  flexWrap: "wrap",
  padding: "10px 12px",
  borderRadius: 10,
  fontFamily: f.sans,
  fontSize: 13,
  lineHeight: 1.5,
} as const;

export default function MessageComposer({
  counterpartName,
  masked,
  draft,
  onDraftChange,
  onSend,
  onAttach,
  sending,
  attaching,
  block,
  error,
  onDismissError,
  mobile,
}: MessageComposerProps) {
  const uid = useId();
  const textId = `${uid}-text`;
  const hintId = `${uid}-hint`;
  const blockId = `${uid}-block`;
  const fileRef = useRef<HTMLInputElement>(null);
  const disabled = block !== null;
  const busy = sending || attaching;

  return (
    <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.line}`, display: "flex", flexDirection: "column", gap: 8 }}>
      {block === "unlock" && (
        <div id={blockId} role="alert" style={{ ...noticeBase, background: t.warning100, border: `1px solid ${t.warningLine}`, color: t.warningInk }}>
          <LockIcon size={16} aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <strong style={{ display: "block" }}>Unlock this candidate to send messages</strong>
            You can&apos;t message {counterpartName} until you unlock their profile. Your draft is kept.
          </div>
          <Button asChild size="lg" className="pointer-coarse:h-11 px-4">
            <Link href="/employer/requirements">Unlock a candidate</Link>
          </Button>
        </div>
      )}
      {block === "suspended" && (
        <div id={blockId} role="status" style={{ ...noticeBase, background: t.error100, border: `1px solid ${t.errorLine}`, color: t.errorInk }}>
          <LockIcon size={16} aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block" }}>Messaging is turned off</strong>
            Your account is suspended, so this conversation is read-only. Contact support to restore access.
          </div>
        </div>
      )}
      {error && !disabled && (
        <div role="alert" style={{ ...noticeBase, background: t.error100, border: `1px solid ${t.errorLine}`, color: t.errorInk, alignItems: "center" }}>
          <span style={{ flex: "1 1 200px", minWidth: 0 }}>{error}</span>
          <Button type="button" variant="ghost" size="lg" className="pointer-coarse:h-11" onClick={onDismissError}>
            Dismiss
          </Button>
        </div>
      )}
      {!disabled && masked && (
        <p style={{ margin: 0, fontFamily: f.sans, fontSize: 12.5, color: t.neutralInk }}>
          This candidate isn&apos;t unlocked yet. If sending fails, unlock them first.
        </p>
      )}

      <Label htmlFor={textId} className="sr-only">
        Message to {counterpartName}
      </Label>
      <Textarea
        id={textId}
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        placeholder={disabled ? "Messaging unavailable" : "Write a message…"}
        rows={2}
        disabled={disabled}
        aria-describedby={disabled ? blockId : hintId}
        style={mobile ? { fontSize: 16 } : undefined}
        onKeyDown={(e) => {
          // isComposing: Enter confirms an IME candidate (Hindi/Tamil/etc.), it must not send.
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (!busy && draft.trim()) onSend();
          }
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <input
              ref={fileRef}
              id={`${uid}-file`}
              type="file"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              disabled={disabled || attaching}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onAttach(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="pointer-coarse:h-11"
              disabled={disabled || attaching}
              aria-describedby={`${uid}-attach-hint`}
              onClick={() => fileRef.current?.click()}
            >
              <PaperclipIcon aria-hidden="true" /> {attaching ? "Uploading…" : "Attach file"}
            </Button>
            <span id={`${uid}-attach-hint`} style={{ fontFamily: f.sans, fontSize: 12, color: t.neutralInk }}>
              Max 8 MB
            </span>
          </div>
          <span id={hintId} style={{ fontFamily: f.sans, fontSize: 12, color: t.neutralInk }}>
            Press <kbd style={{ fontFamily: "inherit", fontWeight: 600 }}>Enter</kbd> to send,{" "}
            <kbd style={{ fontFamily: "inherit", fontWeight: 600 }}>Shift+Enter</kbd> for a new line.
          </span>
        </div>
        <Button size="lg" className="gap-2 pointer-coarse:h-11 px-4" onClick={onSend} disabled={disabled || busy || !draft.trim()}>
          <SendIcon aria-hidden="true" /> {sending ? "Sending…" : "Send"}
        </Button>
      </div>
      <span role="status" className="sr-only">
        {sending ? "Sending message" : attaching ? "Uploading attachment" : ""}
      </span>
    </div>
  );
}
