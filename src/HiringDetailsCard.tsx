"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "./AuthContext";
import { isAiResume } from "./resumeParser";
import { HIRING_FACT_MAX, NOTICE_PERIOD_OPTIONS, WORK_MODE_OPTIONS, factsChanged, readHiringFacts, withHiringFacts } from "./hiringFacts";

export default function HiringDetailsCard({ showToast }: { showToast: (msg: string) => void }) {
  const { user, updateUser } = useAuth();
  const resume = user?.resumeData;
  const saved = readHiringFacts(resume);
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  if (!isAiResume(resume)) return null;

  const set = (key: "noticePeriod" | "currentCtc" | "expectedCtc", value: string) => setDraft((d) => ({ ...d, [key]: value.slice(0, HIRING_FACT_MAX) }));
  const dirty = factsChanged(draft, saved);

  const save = async (next = draft, message = "Hiring details saved") => {
    setSaving(true);
    try {
      await updateUser({ resumeData: withHiringFacts(resume, { ...next, availabilityConfirmedAt: new Date().toISOString() }) });
      showToast(message);
    } catch {
      showToast("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4">
      <p className="m-0 text-[13px] leading-normal text-hx-ink-soft">
        Employers ask for these first. Share them here once and every employer who unlocks your profile sees them, so recruiters
        skip the screening call. Leave a field empty to keep it private. Nothing is shared with a company you have not been matched with.
      </p>
      <div className="grid gap-3 min-[640px]:grid-cols-3">
        <div>
          <label htmlFor="hf-notice" className="mb-1 block text-[12px] font-medium text-hx-coal">Notice period</label>
          <Input id="hf-notice" list="hf-notice-options" value={draft.noticePeriod} onChange={(e) => set("noticePeriod", e.target.value)} placeholder="30 days" className="h-9" />
          <datalist id="hf-notice-options">{NOTICE_PERIOD_OPTIONS.map((o) => <option key={o} value={o} />)}</datalist>
        </div>
        <div>
          <label htmlFor="hf-current" className="mb-1 block text-[12px] font-medium text-hx-coal">Current CTC</label>
          <Input id="hf-current" value={draft.currentCtc} onChange={(e) => set("currentCtc", e.target.value)} placeholder="18 LPA" className="h-9" />
        </div>
        <div>
          <label htmlFor="hf-expected" className="mb-1 block text-[12px] font-medium text-hx-coal">Expected CTC</label>
          <Input id="hf-expected" value={draft.expectedCtc} onChange={(e) => set("expectedCtc", e.target.value)} placeholder="24 LPA" className="h-9" />
        </div>
      </div>
      <div className="grid gap-3 min-[640px]:grid-cols-3">
        <div>
          <label htmlFor="hf-workmode" className="mb-1 block text-[12px] font-medium text-hx-coal">Preferred way of working</label>
          <select
            id="hf-workmode"
            value={draft.workModePref}
            onChange={(e) => setDraft((d) => ({ ...d, workModePref: e.target.value as typeof d.workModePref }))}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-[13px]"
          >
            <option value="">No preference</option>
            {WORK_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-hx-ink-soft min-[640px]:mt-5">
          <input type="checkbox" checked={draft.openToRelocate} onChange={(e) => setDraft((d) => ({ ...d, openToRelocate: e.target.checked }))} />
          Open to relocating
        </label>
      </div>
      <label className="flex items-start gap-2 text-[13px] leading-snug text-hx-ink-soft">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={draft.shareCtcBand && !!draft.expectedCtc.trim()}
          disabled={!draft.expectedCtc.trim()}
          onChange={(e) => setDraft((d) => ({ ...d, shareCtcBand: e.target.checked }))}
        />
        <span>
          Show an approximate expected CTC range (for example 22 to 27 LPA) before an employer unlocks my profile. The exact figure is
          still shared only after an unlock.
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save details"}</Button>
        <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void save(saved, "Availability confirmed")}>
          I'm still looking
        </Button>
        <span className="text-[12px] text-hx-ink-soft">{saved.availabilityConfirmedAt ? `Last confirmed ${new Date(saved.availabilityConfirmedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "Employers see when you last confirmed."}</span>
      </div>
    </div>
  );
}
