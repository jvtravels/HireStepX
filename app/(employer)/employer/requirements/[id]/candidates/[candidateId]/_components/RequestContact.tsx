"use client";

import { useId, useState } from "react";
import { CheckIcon, PlusIcon } from "lucide-react";
import { cn } from "cn";
import type { Candidate } from "@/employer/mockData";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { useToast } from "@/Toast";

const OPTIONS = [
  { key: "phone", label: "Phone number" },
  { key: "email", label: "Email address" },
  { key: "linkedin", label: "LinkedIn profile" },
  { key: "portfolio", label: "Portfolio or GitHub" },
] as const;
type FieldKey = (typeof OPTIONS)[number]["key"];

function missingFields(candidate: Candidate): FieldKey[] {
  const have: Record<FieldKey, boolean> = {
    phone: !!candidate.contact?.phone,
    email: !!candidate.contact?.email,
    linkedin: !!candidate.resume?.linkedin,
    portfolio: (candidate.portfolioLinks?.length ?? 0) > 0,
  };
  return OPTIONS.filter((o) => !have[o.key]).map((o) => o.key);
}

export function RequestContact({ candidate, disabled, disabledReason }: { candidate: Candidate; disabled: boolean; disabledReason: string | null }) {
  const { requestCandidateContact } = useEmployerData();
  const { toast } = useToast();
  const baseId = useId();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<FieldKey[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const missing = missingFields(candidate);

  const onOpenChange = (next: boolean) => {
    if (next) setSelected(missing);
    setOpen(next);
  };

  const toggle = (key: FieldKey, on: boolean) => setSelected((cur) => (on ? [...cur, key] : cur.filter((k) => k !== key)));

  const send = async () => {
    if (selected.length === 0 || sending) return;
    setSending(true);
    const res = await requestCandidateContact(candidate.id, selected);
    setSending(false);
    if (res.ok) {
      setSent(true);
      setOpen(false);
      toast("Request sent. They'll be asked to add these details.", "success");
    } else {
      toast(res.error.error, "error");
    }
  };

  const label = sent ? "Request sent" : "Send request";

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={disabled ? (disabledReason ?? undefined) : "Ask the candidate to add contact details"}
          className={cn(
            "inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium border-hx-line bg-white text-hx-ink-soft transition-colors hover:bg-hx-indigo-100 hover:text-hx-indigo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:h-11 pointer-coarse:px-4",
            sent && "text-hx-indigo",
          )}
        >
          {sent ? <CheckIcon size={14} aria-hidden="true" /> : <PlusIcon size={14} aria-hidden="true" />}
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-3 p-4">
        <div>
          <h3 className="m-0 text-[14px] font-semibold text-hx-coal">Request details</h3>
          <p className="m-0 mt-1 text-[13px] leading-snug text-hx-ink-soft">
            We'll tell the candidate you'd like these and ask them to upload an updated resume or add them to their profile.
          </p>
        </div>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {OPTIONS.map((o) => {
            const id = `${baseId}-${o.key}`;
            const isMissing = missing.includes(o.key);
            return (
              <li key={o.key} className="flex min-h-9 items-center gap-2.5 pointer-coarse:min-h-11">
                <Checkbox id={id} checked={selected.includes(o.key)} onCheckedChange={(v) => toggle(o.key, v === true)} />
                <label htmlFor={id} className="flex flex-1 cursor-pointer items-baseline justify-between gap-2 text-[13px] text-hx-coal">
                  {o.label}
                  {!isMissing && <span className="text-[12px] text-hx-ink-soft">Already shared</span>}
                </label>
              </li>
            );
          })}
        </ul>
        <Button type="button" onClick={() => void send()} disabled={selected.length === 0 || sending} className="pointer-coarse:h-11">
          {sending ? "Sending…" : "Send request"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
