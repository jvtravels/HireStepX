"use client";

import { useState, type CSSProperties } from "react";
import { SlidersHorizontalIcon } from "lucide-react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CONTACT_FILTER_OPTIONS, type ContactFilter } from "./candidateTableModel";

const sectionLabelStyle: CSSProperties = {
  fontFamily: f.sans,
  fontSize: textSize.sm,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: t.inkFaint,
  marginBottom: 10,
};

const optionStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minHeight: 32,
  fontFamily: f.sans,
  fontSize: textSize.base,
  color: t.coal,
  cursor: "pointer",
};

/** Staged Reset/Apply filter popover, same shell as the Jobs table filters. */
export default function CandidatesFilters({
  contactFilter,
  onContactFilterChange,
  locationFilter,
  onLocationFilterChange,
  locationOptions,
  activeCount,
}: {
  contactFilter: ContactFilter;
  onContactFilterChange: (v: ContactFilter) => void;
  locationFilter: string;
  onLocationFilterChange: (v: string) => void;
  locationOptions: string[];
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [draftContact, setDraftContact] = useState(contactFilter);
  const [draftLocation, setDraftLocation] = useState(locationFilter);

  const apply = () => {
    onContactFilterChange(draftContact);
    onLocationFilterChange(draftLocation);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDraftContact(contactFilter);
          setDraftLocation(locationFilter);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={activeCount > 0 ? `Filters, ${activeCount} active` : "Filters"}
          className="pointer-coarse:h-11"
          style={{ borderRadius: 8, height: 36, gap: 8, background: t.white, color: t.coal, fontFamily: f.sans, fontSize: textSize.base, fontWeight: 500, flexShrink: 0 }}
        >
          <SlidersHorizontalIcon size={13} aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span
              aria-hidden="true"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, borderRadius: 9, background: t.indigo, color: t.white, fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, padding: "0 5px" }}
            >
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={16} className="gap-0" style={{ width: "min(280px, calc(100vw - 32px))", padding: 0 }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${t.line}` }}>
          <span style={{ fontFamily: f.sans, fontSize: textSize.lg, fontWeight: 700, color: t.coal }}>Filters</span>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, maxHeight: "50vh", overflowY: "auto" }}>
          <div>
            <div id="filter-contact-label" style={sectionLabelStyle}>Contact</div>
            <RadioGroup aria-labelledby="filter-contact-label" value={draftContact} onValueChange={(v) => setDraftContact(v as ContactFilter)}>
              {CONTACT_FILTER_OPTIONS.map((o) => (
                <label key={o.value} className="pointer-coarse:min-h-11" style={optionStyle}>
                  <RadioGroupItem value={o.value} />
                  {o.label}
                </label>
              ))}
            </RadioGroup>
          </div>
          {locationOptions.length > 1 && (
            <div>
              <div id="filter-location-label" style={sectionLabelStyle}>Location</div>
              <RadioGroup aria-labelledby="filter-location-label" value={draftLocation} onValueChange={setDraftLocation}>
                {[{ value: "all", label: "All locations" }, ...locationOptions.map((loc) => ({ value: loc, label: loc }))].map((o) => (
                  <label key={o.value} className="pointer-coarse:min-h-11" style={optionStyle}>
                    <RadioGroupItem value={o.value} />
                    {o.label}
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, padding: "14px 16px", borderTop: `1px solid ${t.line}` }}>
          <Button
            type="button"
            variant="outline"
            className="flex-1 pointer-coarse:h-11"
            onClick={() => {
              setDraftContact("all");
              setDraftLocation("all");
            }}
          >
            Reset
          </Button>
          <Button type="button" className="flex-1 pointer-coarse:h-11" onClick={apply}>
            Apply filter
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
