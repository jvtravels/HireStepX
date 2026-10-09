"use client";

/* Single "Filters" trigger + popover with checkbox sections and a staged
   Apply — the candidate-side counterpart of the employer jobs page's
   AdvancedFiltersPopover. Nothing re-filters the table until the user
   commits with "Apply filter". */

import { useState } from "react";
import { SlidersHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { dur, ease } from "@/_motion";

export interface FilterSection {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

export type FilterSelection = Record<string, string[]>;

export function countActiveFilters(selection: FilterSelection): number {
  return Object.values(selection).filter((v) => v.length > 0).length;
}

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: f.sans, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em",
  textTransform: "uppercase", color: t.inkFaint, marginBottom: 10,
};

export function FiltersPanel({
  sections,
  value,
  onApply,
}: {
  sections: FilterSection[];
  value: FilterSelection;
  onApply: (next: FilterSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterSelection>(value);
  const activeCount = countActiveFilters(value);
  const visible = sections.filter((s) => s.options.length > 0);

  const toggle = (key: string, optionValue: string) => {
    setDraft((d) => {
      const current = d[key] ?? [];
      return { ...d, [key]: current.includes(optionValue) ? current.filter((v) => v !== optionValue) : [...current, optionValue] };
    });
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setDraft(value); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          style={{ borderRadius: 8, height: 36, gap: 8, background: t.white, color: t.coal, fontFamily: f.sans, fontSize: 13, fontWeight: 500, flexShrink: 0, transition: `background ${dur.instant} ${ease.snap}` }}
          onMouseEnter={(e) => { e.currentTarget.style.background = t.rowTint; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = t.white; }}
        >
          <SlidersHorizontalIcon size={14} aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18,
                borderRadius: 9, background: t.indigo, color: t.white, fontFamily: f.sans, fontSize: 12, fontWeight: 600, padding: "0 5px",
              }}
            >
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={16} className="gap-0" style={{ width: 320, padding: 0 }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${t.line}` }}>
          <span style={{ fontFamily: f.sans, fontSize: 16, fontWeight: 700, color: t.coal }}>Filters</span>
        </div>
        <ScrollArea style={{ height: "min(520px, calc(100vh - 220px))", minHeight: 0, overflow: "hidden" }}>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {visible.map((section, i) => (
              <div key={section.key} style={{ display: "contents" }}>
                {i > 0 && <Separator />}
                <div>
                  <div style={sectionLabelStyle}>{section.label}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {section.options.map((o) => (
                      <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: 13, color: t.coal, cursor: "pointer" }}>
                        <Checkbox checked={(draft[section.key] ?? []).includes(o.value)} onCheckedChange={() => toggle(section.key, o.value)} />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div style={{ display: "flex", gap: 8, padding: "14px 16px", borderTop: `1px solid ${t.line}` }}>
          <Button type="button" variant="outline" className="flex-1" onClick={() => setDraft({})}>
            Reset
          </Button>
          <Button type="button" className="flex-1" onClick={() => { onApply(draft); setOpen(false); }}>
            Apply filter
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
