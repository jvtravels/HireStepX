"use client";

/* Shared dropdown-backed filter chip — used by the sessions table
   (SessionsV2.tsx) and the employer requirement detail candidates table
   so every filter control in the app shares one look and behavior
   instead of each screen hand-rolling its own near-identical copy. */

import { ChevronDownIcon } from "lucide-react";
import { tokens as T, fonts as F } from "@/auth/_tokens";
import { dur, ease } from "@/_motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function FilterPill<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: Array<{ value: V; label: string }>;
  onChange: (value: V) => void;
}) {
  // An empty string is the "no filter applied" sentinel some callers use
  // (vs. Sessions' literal "All" option) — treat it as unset rather than
  // matching an { value: "", label: "All" } entry, so the pill reads as
  // its bare label instead of "Location: All".
  const active = value ? options.find((o) => o.value === value) : undefined;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          style={{ borderRadius: 8, height: 36, gap: 8, background: T.white, color: T.coal, fontFamily: F.sans, fontSize: 13, fontWeight: 500, flexShrink: 0, transition: `background ${dur.instant} ${ease.snap}` }}
          onMouseEnter={(e) => { e.currentTarget.style.background = T.rowTint; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = T.white; }}
        >
          {active ? `${label}: ${active.label}` : label}
          <ChevronDownIcon size={12} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as V)}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
