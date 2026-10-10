"use client";

import { useId, useState } from "react";
import { SlidersHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { EMPTY_RANGE, type NumberRange } from "./jobsHelpers";

const legendStyle: React.CSSProperties = {
  fontFamily: f.sans, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em",
  textTransform: "uppercase", color: t.inkSoft, marginBottom: 10, padding: 0,
};

function CheckboxGroup({ legend, options, value, onChange }: { legend: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const baseId = useId();
  return (
    <fieldset style={{ border: "none", margin: 0, padding: 0, minWidth: 0 }}>
      <legend style={legendStyle}>{legend}</legend>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {options.map((o, i) => {
          const id = `${baseId}-${i}`;
          return (
            <label
              key={o}
              htmlFor={id}
              className="pointer-coarse:min-h-11"
              style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 28, fontFamily: f.sans, fontSize: 14, color: t.coal, cursor: "pointer" }}
            >
              <Checkbox
                id={id}
                checked={value.includes(o)}
                onCheckedChange={() => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o])}
              />
              {o}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function SelectField({ legend, allLabel, options, value, onChange }: { legend: string; allLabel: string; options: string[]; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} style={{ ...legendStyle, display: "block" }}>{legend}</label>
      <Select value={value || "__all"} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
        <SelectTrigger
          id={id}
          className="w-full border-border pointer-coarse:h-11"
          style={{ height: 36, borderRadius: 8, background: t.white, color: t.coal, fontFamily: f.sans, fontSize: 14, fontWeight: 500 }}
        >
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* Min/max numeric pair. Both inputs carry their own accessible name, since a
   bare "Min" / "Max" placeholder is not one. */
function RangeField({ legend, unit, value, onChange }: { legend: string; unit: string; value: NumberRange; onChange: (v: NumberRange) => void }) {
  return (
    <fieldset style={{ border: "none", margin: 0, padding: 0, minWidth: 0 }}>
      <legend style={legendStyle}>{legend}</legend>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={value.min}
          onChange={(e) => onChange({ ...value, min: e.target.value })}
          placeholder="Min"
          aria-label={`Minimum ${unit}`}
          className="pointer-coarse:h-11"
          style={{ height: 36 }}
        />
        <span aria-hidden="true" style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, flexShrink: 0 }}>to</span>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={value.max}
          onChange={(e) => onChange({ ...value, max: e.target.value })}
          placeholder="Max"
          aria-label={`Maximum ${unit}`}
          className="pointer-coarse:h-11"
          style={{ height: 36 }}
        />
      </div>
    </fieldset>
  );
}

/* Single "Filters" trigger replacing the old row of six separate pills —
   everything lives in one popover with a staged Apply, so nothing re-filters
   the table until the employer commits. Local to this page since no other
   screen shares this exact filter set. */
export default function AdvancedFiltersPopover({
  stageOptions, stage, onStageChange,
  jobTypeOptions, jobType, onJobTypeChange,
  dueOptions, due, onDueChange,
  locationOptions, location, onLocationChange,
  departmentOptions, department, onDepartmentChange,
  experience, onExperienceChange,
  salary, onSalaryChange,
  activeCount,
}: {
  stageOptions: string[];
  stage: string[];
  onStageChange: (v: string[]) => void;
  jobTypeOptions: string[];
  jobType: string[];
  onJobTypeChange: (v: string[]) => void;
  dueOptions: string[];
  due: string[];
  onDueChange: (v: string[]) => void;
  locationOptions: string[];
  location: string;
  onLocationChange: (v: string) => void;
  departmentOptions: string[];
  department: string;
  onDepartmentChange: (v: string) => void;
  experience: NumberRange;
  onExperienceChange: (v: NumberRange) => void;
  salary: NumberRange;
  onSalaryChange: (v: NumberRange) => void;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [draftStage, setDraftStage] = useState(stage);
  const [draftJobType, setDraftJobType] = useState(jobType);
  const [draftDue, setDraftDue] = useState(due);
  const [draftLocation, setDraftLocation] = useState(location);
  const [draftDepartment, setDraftDepartment] = useState(department);
  const [draftExperience, setDraftExperience] = useState<NumberRange>(experience);
  const [draftSalary, setDraftSalary] = useState<NumberRange>(salary);

  const seedDraft = () => {
    setDraftStage(stage);
    setDraftJobType(jobType);
    setDraftDue(due);
    setDraftLocation(location);
    setDraftDepartment(department);
    setDraftExperience(experience);
    setDraftSalary(salary);
  };

  const handleReset = () => {
    setDraftStage([]);
    setDraftJobType([]);
    setDraftDue([]);
    setDraftLocation("");
    setDraftDepartment("");
    setDraftExperience(EMPTY_RANGE);
    setDraftSalary(EMPTY_RANGE);
  };

  const handleApply = () => {
    onStageChange(draftStage);
    onJobTypeChange(draftJobType);
    onDueChange(draftDue);
    onLocationChange(draftLocation);
    onDepartmentChange(draftDepartment);
    onExperienceChange(draftExperience);
    onSalaryChange(draftSalary);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) seedDraft(); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="pointer-coarse:h-11"
          style={{ borderRadius: 8, height: 36, gap: 8, background: t.white, color: t.coal, fontFamily: f.sans, fontSize: 14, fontWeight: 500, flexShrink: 0 }}
        >
          <SlidersHorizontalIcon size={14} aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <>
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18,
                  borderRadius: 9, background: t.indigo, color: t.white, fontFamily: f.sans, fontSize: 12, fontWeight: 600, padding: "0 5px",
                }}
              >
                {activeCount}
              </span>
              <span className="sr-only">({activeCount} active)</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={16} className="gap-0" aria-label="Advanced filters" style={{ width: "min(320px, calc(100vw - 32px))", padding: 0 }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${t.line}` }}>
          <span aria-hidden="true" style={{ fontFamily: f.sans, fontSize: 16, fontWeight: 700, color: t.coal }}>Advanced filters</span>
        </div>
        <ScrollArea style={{ height: "min(720px, calc(100vh - 160px))", minHeight: 0, overflow: "hidden" }}>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            <CheckboxGroup legend="Stage" options={stageOptions} value={draftStage} onChange={setDraftStage} />
            <Separator />
            <CheckboxGroup legend="Job type" options={jobTypeOptions} value={draftJobType} onChange={setDraftJobType} />
            <Separator />
            <CheckboxGroup legend="Due date" options={dueOptions} value={draftDue} onChange={setDraftDue} />
            <Separator />
            <SelectField legend="Location" allLabel="All locations" options={locationOptions} value={draftLocation} onChange={setDraftLocation} />
            {departmentOptions.length > 0 && (
              <SelectField legend="Department" allLabel="All departments" options={departmentOptions} value={draftDepartment} onChange={setDraftDepartment} />
            )}
            <Separator />
            <RangeField legend="Experience required (years)" unit="years of experience" value={draftExperience} onChange={setDraftExperience} />
            <Separator />
            <RangeField legend="Salary (LPA)" unit="salary in LPA" value={draftSalary} onChange={setDraftSalary} />
          </div>
        </ScrollArea>
        <div style={{ display: "flex", gap: 8, padding: "14px 16px", borderTop: `1px solid ${t.line}` }}>
          <Button type="button" variant="outline" className="flex-1 pointer-coarse:h-11" onClick={handleReset}>
            Reset
          </Button>
          <Button type="button" className="flex-1 pointer-coarse:h-11" onClick={handleApply}>
            Apply filter
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
