"use client";

import { CheckIcon, SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EmployerResponse } from "../employerActions";

const PICKED = {
  interested: "border-hx-success-ink/30 bg-hx-success-100 text-hx-success-ink hover:bg-hx-success-100",
  declined: "border-hx-line bg-hx-soft text-hx-coal hover:bg-hx-soft",
} as const;

/* The candidate's one decision about a match, always one tap away. It lives in
   the header on wide screens and in a sticky bar on narrow ones. */
export default function ResponseActions({ response, canRespond, onRespond, showMessage, onMessage, menu, fill }: {
  response: EmployerResponse | null;
  canRespond: boolean;
  onRespond: (next: EmployerResponse) => void;
  showMessage: boolean;
  onMessage: () => void;
  menu: React.ReactNode;
  fill?: boolean;
}) {
  const choices: { value: EmployerResponse; label: string }[] = [
    { value: "interested", label: "Interested" },
    { value: "declined", label: "Not interested" },
  ];
  return (
    <div className={`flex items-center gap-2 ${fill ? "w-full" : "shrink-0"}`}>
      {canRespond && (
        <div role="group" aria-label="Your response" className={`flex gap-2 ${fill ? "min-w-0 flex-1" : ""}`}>
          {choices.map((c) => (
            <Button
              key={c.value}
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={response === c.value}
              onClick={() => onRespond(c.value)}
              className={`${fill ? "flex-1" : ""} ${response === c.value ? PICKED[c.value] : ""}`}
            >
              {response === c.value && c.value === "interested" && <CheckIcon size={13} aria-hidden="true" />}
              {c.label}
            </Button>
          ))}
        </div>
      )}
      {showMessage && (
        <Button size="sm" onClick={onMessage} className="flex items-center gap-1.5">
          <SendIcon size={13} aria-hidden="true" /> {fill ? "Message" : "Message employer"}
        </Button>
      )}
      {menu}
    </div>
  );
}
