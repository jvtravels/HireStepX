"use client";

import type { ReactNode } from "react";
import { CalendarIcon, FileTextIcon } from "lucide-react";
import { clockTime, dayLabel, type ThreadMessage } from "./helpers";

export interface RailFact {
  label: string;
  value: ReactNode;
}

interface ContextRailProps {
  facts: RailFact[];
  interviewAt: string | null;
  messages: ThreadMessage[];
  onOpenAttachment: (messageId: string) => void;
  /** Side-specific actions, e.g. the employer's evidence shortcut. */
  children?: ReactNode;
}

export default function ContextRail({ facts, interviewAt, messages, onOpenAttachment, children }: ContextRailProps) {
  const files = messages.filter((m) => m.attachmentPath);
  return (
    <div className="flex flex-col gap-5 p-4">
      <section aria-labelledby="rail-details">
        <h3 id="rail-details" className="m-0 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Details</h3>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[13px]">
          {facts.map((f) => (
            <div key={f.label} className="contents">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="m-0 min-w-0 text-right font-medium text-foreground [overflow-wrap:anywhere]">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {interviewAt && (
        <section aria-labelledby="rail-interview" className="rounded-lg border border-border bg-muted/40 p-3">
          <h3 id="rail-interview" className="m-0 mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <CalendarIcon aria-hidden="true" className="size-3.5" /> Interview
          </h3>
          <p className="m-0 text-sm font-medium text-foreground">
            {dayLabel(interviewAt)}, {clockTime(interviewAt)}
          </p>
        </section>
      )}

      {children}

      <section aria-labelledby="rail-files">
        <h3 id="rail-files" className="m-0 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Shared files{files.length > 0 ? ` (${files.length})` : ""}
        </h3>
        {files.length === 0 ? (
          <p className="m-0 text-[13px] text-muted-foreground">Files shared in this conversation will appear here.</p>
        ) : (
          <ul role="list" className="m-0 flex list-none flex-col gap-1 p-0">
            {files.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onOpenAttachment(m.id)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-muted pointer-coarse:min-h-11"
                >
                  <FileTextIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">{m.attachmentName || "Attachment"}</span>
                    <span className="block text-[11px] text-muted-foreground">{dayLabel(m.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
