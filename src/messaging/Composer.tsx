"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { LockIcon, PaperclipIcon, SendIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";

export const ATTACHMENT_MAX_BYTES = 8_000_000;

export type ComposerBlock = "unlock" | "suspended" | null;

interface ComposerProps {
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
  quickReplies: string[];
}

export default function Composer({
  counterpartName, masked, draft, onDraftChange, onSend, onAttach, sending, attaching, block, error, onDismissError, quickReplies,
}: ComposerProps) {
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const disabled = block !== null;
  const busy = sending || attaching;
  const blockId = `${uid}-block`;
  const hintId = `${uid}-hint`;

  const insertReply = (text: string) => {
    onDraftChange(draft.trim() ? `${draft.replace(/\s+$/, "")}\n${text}` : text);
    setRepliesOpen(false);
    requestAnimationFrame(() => textRef.current?.focus());
  };

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {block === "unlock" && (
        <div id={blockId} role="alert" className="flex flex-wrap items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-[13px] leading-normal text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <LockIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1 basis-56">
            <strong className="block">Unlock this candidate to send messages</strong>
            You can&apos;t message {counterpartName} until you unlock their profile. Your draft is kept.
          </div>
          <Button asChild size="lg" className="pointer-coarse:h-11 px-4">
            <Link href="/employer/requirements">Unlock a candidate</Link>
          </Button>
        </div>
      )}
      {block === "suspended" && (
        <div id={blockId} role="status" className="flex items-start gap-2.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-[13px] leading-normal text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          <LockIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <strong className="block">Messaging is turned off</strong>
            Your account is suspended, so this conversation is read-only. Contact support to restore access.
          </div>
        </div>
      )}
      {error && !disabled && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          <span className="min-w-0 flex-1 basis-48">{error}</span>
          <Button type="button" variant="ghost" size="sm" className="pointer-coarse:h-11" onClick={onDismissError}>Dismiss</Button>
        </div>
      )}
      {!disabled && masked && (
        <p className="m-0 text-xs text-muted-foreground">This candidate isn&apos;t unlocked yet. If sending fails, unlock them first.</p>
      )}

      <div className="rounded-xl border border-input bg-background transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 has-[textarea:disabled]:bg-muted/50">
        <label htmlFor={`${uid}-text`} className="sr-only">Message to {counterpartName}</label>
        <textarea
          ref={textRef}
          id={`${uid}-text`}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder={disabled ? "Messaging unavailable" : `Message ${counterpartName}`}
          rows={2}
          disabled={disabled}
          aria-describedby={disabled ? blockId : hintId}
          className="block max-h-48 min-h-16 w-full resize-none rounded-t-xl border-0 bg-transparent px-3 pt-2.5 pb-1 text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
          onKeyDown={(e) => {
            // isComposing: Enter confirms an IME candidate (Hindi/Tamil/etc.), it must not send.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (!busy && !disabled && draft.trim()) onSend();
            }
          }}
        />
        <div className="flex items-center gap-1 px-2 pb-2">
          <input
            ref={fileRef}
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
            variant="ghost"
            size="sm"
            disabled={disabled || attaching}
            aria-label="Attach a file, 8 MB maximum"
            title="Attach a file (max 8 MB)"
            onClick={() => fileRef.current?.click()}
            className="gap-1.5 text-muted-foreground pointer-coarse:h-11"
          >
            {attaching ? <Spinner className="size-4" /> : <PaperclipIcon aria-hidden="true" className="size-4" />}
            <span className="hidden sm:inline">{attaching ? "Uploading…" : "Attach"}</span>
          </Button>
          <Popover open={repliesOpen} onOpenChange={setRepliesOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="sm" disabled={disabled} className="gap-1.5 text-muted-foreground pointer-coarse:h-11">
                <SparklesIcon aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Quick replies</span>
                <span className="sr-only sm:hidden">Quick replies</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-1">
              <p className="m-0 px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">Insert a template, then edit before sending</p>
              <ul role="list" className="m-0 list-none p-0">
                {quickReplies.map((text) => (
                  <li key={text}>
                    <button
                      type="button"
                      onClick={() => insertReply(text)}
                      className="w-full rounded-md px-2 py-2 text-left text-[13px] leading-snug text-foreground hover:bg-muted pointer-coarse:min-h-11"
                    >
                      {text}
                    </button>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
          <span id={hintId} className="ml-auto hidden px-2 text-[11px] text-muted-foreground md:inline">
            <kbd className="font-sans font-semibold">Enter</kbd> to send · <kbd className="font-sans font-semibold">Shift+Enter</kbd> new line
          </span>
          <Button
            type="button"
            size="sm"
            onClick={onSend}
            disabled={disabled || busy || !draft.trim()}
            className="ml-auto gap-1.5 px-3 md:ml-0 pointer-coarse:h-11"
          >
            <SendIcon aria-hidden="true" className="size-4" /> {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
      <span role="status" className="sr-only">{sending ? "Sending message" : attaching ? "Uploading attachment" : ""}</span>
    </div>
  );
}
