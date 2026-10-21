"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { PlusIcon } from "lucide-react";
import { cn } from "cn";
import type { Candidate } from "@/employer/mockData";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  DOCUMENT_TOPICS,
  REQUEST_KINDS,
  REQUEST_KIND_LABEL,
  REQUEST_NOTE_MAX,
  REQUEST_TOPIC_MAX,
  type CreateRequestBody,
  type RequestKind,
} from "@/employer/_candidateRequestTypes";
import { useToast } from "@/Toast";
import { ROUNDS, roundKeyForTopic } from "@/focusRounds";
import { isFocusComingSoon } from "@/setupFocus";
import type { CandidateRequestsState } from "./useCandidateRequests";

const CONTACT_OPTIONS = [
  { key: "phone", label: "Phone number" },
  { key: "email", label: "Email address" },
  { key: "linkedin", label: "LinkedIn profile" },
  { key: "portfolio", label: "Portfolio or GitHub" },
] as const;
type ContactKey = (typeof CONTACT_OPTIONS)[number]["key"];

function missingContact(candidate: Candidate): ContactKey[] {
  const have: Record<ContactKey, boolean> = {
    phone: !!candidate.contact?.phone,
    email: !!candidate.contact?.email,
    linkedin: !!candidate.resume?.linkedin,
    portfolio: (candidate.portfolioLinks?.length ?? 0) > 0,
  };
  return CONTACT_OPTIONS.filter((o) => !have[o.key]).map((o) => o.key);
}

const PRACTICE_ROUNDS = ROUNDS.map((r) => r.label).filter((l) => !isFocusComingSoon(l));
const isRoundTopic = (t: string) => roundKeyForTopic(t) !== null;

export interface RequestPreset {
  kind: RequestKind;
  topic?: string;
  note?: string;
}

const KIND_HINT: Record<RequestKind, string> = {
  contact: "Ask them to add details to their profile.",
  document: "A certificate, project, work sample or proof.",
  practice: "Ask them to retake a practice question.",
  clarification: "Ask about something on the resume.",
};

const NOTE_LABEL: Record<RequestKind, string> = {
  contact: "",
  document: "Note (optional)",
  practice: "Note (optional)",
  clarification: "Your question",
};

export function RequestPopover({
  candidate,
  state,
  disabled,
  disabledReason,
  preset,
  align = "start",
  children,
}: {
  candidate: Candidate;
  state: CandidateRequestsState;
  disabled: boolean;
  disabledReason: string | null;
  preset?: RequestPreset;
  align?: "start" | "end";
  children: ReactNode;
}) {
  const baseId = useId();
  const { toast } = useToast();
  const missing = missingContact(candidate);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<RequestKind>(preset?.kind ?? (missing.length > 0 ? "contact" : "document"));
  const [fields, setFields] = useState<ContactKey[]>(missing);
  const [topic, setTopic] = useState(preset?.topic ?? "");
  const [note, setNote] = useState(preset?.note ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setKind(preset?.kind ?? (missing.length > 0 ? "contact" : "document"));
    setFields(missing);
    setTopic(preset?.topic ?? "");
    setNote(preset?.note ?? "");
    setError(null);
  };

  const onOpenChange = (next: boolean) => {
    if (next) reset();
    setOpen(next);
  };

  const body: CreateRequestBody =
    kind === "contact"
      ? { kind, fields }
      : { kind, ...(topic.trim() ? { topic: topic.trim() } : {}), ...(note.trim() ? { note: note.trim() } : {}) };
  const duplicate = state.findPending(kind, kind === "contact" ? null : topic.trim() || null);
  const ready =
    kind === "contact" ? fields.length > 0
    : kind === "clarification" ? note.trim().length > 0
    : topic.trim().length > 0;

  const send = async () => {
    if (!ready || sending || duplicate) return;
    setSending(true);
    setError(null);
    const res = await state.create(body);
    setSending(false);
    if (res.ok) {
      setOpen(false);
      toast("Request sent. You will see their reply here.", "success");
    } else {
      setError(res.error.error);
    }
  };

  const lockedNote = !candidate.unlocked
    ? "They see this without your company name. Keep phone numbers, emails and links out of the text."
    : "They are notified and the request also appears in your message thread.";

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={disabled} title={disabled ? (disabledReason ?? undefined) : undefined}>
        {children}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[22rem] max-w-[calc(100vw-2rem)] gap-3 p-4">
        <div>
          <h3 className="m-0 text-[13px] font-semibold text-hx-coal">{preset ? REQUEST_KIND_LABEL[preset.kind] : "Request from candidate"}</h3>
          <p className="m-0 mt-1 text-[13px] leading-snug text-hx-ink-soft">{lockedNote}</p>
        </div>

        {!preset && (
          <div role="radiogroup" aria-label="What to request" className="grid grid-cols-2 gap-1.5">
            {REQUEST_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => {
                  setKind(k);
                  setError(null);
                }}
                className={cn(
                  "cursor-pointer rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11",
                  kind === k ? "border-hx-coal bg-hx-soft" : "border-hx-line bg-white hover:bg-hx-soft",
                )}
              >
                <span className="block text-[13px] font-medium text-hx-coal">{REQUEST_KIND_LABEL[k]}</span>
                <span className="block text-[12px] leading-tight text-hx-ink-soft">{KIND_HINT[k]}</span>
              </button>
            ))}
          </div>
        )}

        {kind === "contact" && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {CONTACT_OPTIONS.map((o) => {
              const id = `${baseId}-${o.key}`;
              return (
                <li key={o.key} className="flex min-h-9 items-center gap-2.5 pointer-coarse:min-h-11">
                  <Checkbox id={id} checked={fields.includes(o.key)} onCheckedChange={(v) => setFields((cur) => (v === true ? [...cur, o.key] : cur.filter((k) => k !== o.key)))} />
                  <label htmlFor={id} className="flex flex-1 cursor-pointer items-baseline justify-between gap-2 text-[13px] text-hx-coal">
                    {o.label}
                    {!missing.includes(o.key) && <span className="text-[12px] text-hx-ink-soft">Already shared</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {kind === "document" && (
          <div className="grid gap-2">
            {!preset?.topic && (
              <div role="group" aria-label="Document type" className="flex flex-wrap gap-1.5">
                {DOCUMENT_TOPICS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={topic === d}
                    onClick={() => setTopic(topic === d ? "" : d)}
                    className={cn(
                      "cursor-pointer rounded-full border px-2.5 py-1 text-[12px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11",
                      topic === d ? "border-hx-coal bg-hx-coal text-white" : "border-hx-line bg-white text-hx-coal hover:bg-hx-soft",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value.slice(0, REQUEST_TOPIC_MAX))}
              aria-label="What you would like to see"
              placeholder="Or describe what you would like to see"
              readOnly={!!preset?.topic}
            />
          </div>
        )}

        {kind === "practice" && (
          <div className="grid gap-2">
            {!preset?.topic && (
              <div role="group" aria-label="Interview round" className="flex flex-wrap gap-1.5">
                {PRACTICE_ROUNDS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={topic === r}
                    onClick={() => setTopic(topic === r ? "" : r)}
                    className={cn(
                      "cursor-pointer rounded-full border px-2.5 py-1 text-[12px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11",
                      topic === r ? "border-hx-coal bg-hx-coal text-white" : "border-hx-line bg-white text-hx-coal hover:bg-hx-soft",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value.slice(0, REQUEST_TOPIC_MAX))}
              aria-label="Skill or question to practise"
              placeholder="Or name a skill, e.g. System design"
              readOnly={!!preset?.topic}
            />
            {isRoundTopic(topic) && (
              <p className="m-0 text-[12px] leading-snug text-hx-ink-soft">
                Their result for this round comes to you automatically once they finish the session.
              </p>
            )}
          </div>
        )}

        {kind !== "contact" && (
          <label className="grid gap-1 text-[12px] font-medium text-hx-ink-soft">
            {NOTE_LABEL[kind]}
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, REQUEST_NOTE_MAX))}
              rows={3}
              className="text-[13px] font-normal"
            />
          </label>
        )}

        {duplicate && <p role="status" className="m-0 text-[12px] text-hx-ink-soft">You already asked for this and are waiting on the candidate.</p>}
        {error && <p role="alert" className="m-0 text-[12px] text-hx-error-ink">{error}</p>}
        <Button type="button" onClick={() => void send()} disabled={!ready || sending || !!duplicate} className="pointer-coarse:h-11">
          {sending ? "Sending…" : "Send request"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/** Header trigger: the one general entry point. */
export function RequestButton({ pendingCount, ...triggerProps }: { pendingCount: number } & ComponentProps<"button">) {
  return (
    <button
      {...triggerProps}
      type="button"
      className="inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-hx-line bg-white px-2.5 text-[12px] font-medium text-hx-ink-soft transition-colors hover:bg-hx-indigo-100 hover:text-hx-indigo focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:h-11 pointer-coarse:px-4"
    >
      <PlusIcon size={14} aria-hidden="true" />
      Request
      {pendingCount > 0 && <span className="tabular-nums text-hx-ink-soft">({pendingCount} waiting)</span>}
    </button>
  );
}

/** Small per-item trigger used beside a missing skill, weak answer or concern. */
export function InlineRequestTrigger({ label, requested, ...triggerProps }: { label: string; requested: boolean } & ComponentProps<"button">) {
  return (
    <button
      {...triggerProps}
      type="button"
      className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-medium text-hx-indigo underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11"
    >
      {requested ? "Requested" : label}
    </button>
  );
}

export interface RequestUi {
  state: CandidateRequestsState;
  disabled: boolean;
  disabledReason: string | null;
}

/** Per-item "Ask for proof" control; shows "Requested" once a matching request is pending. */
export function ItemRequest({ candidate, ui, preset, label }: { candidate: Candidate; ui: RequestUi; preset: RequestPreset; label: string }) {
  if (!ui.state.available) return null;
  const requested = !!ui.state.findPending(preset.kind, preset.topic ?? null);
  return (
    <RequestPopover candidate={candidate} state={ui.state} disabled={ui.disabled || requested} disabledReason={ui.disabledReason} preset={preset} align="start">
      <InlineRequestTrigger label={label} requested={requested} />
    </RequestPopover>
  );
}
