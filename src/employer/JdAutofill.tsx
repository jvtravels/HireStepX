"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { CheckIcon, FileTextIcon, LoaderCircleIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { captureClientEvent } from "../posthogClient";
import { OutlineCta, PrimaryCta } from "./_atoms";
import { initialDraft } from "./_requirementFormHelpers";
import type { RequirementDraft } from "./_requirementPayload";
import type { JdFieldKey, JdParseResponse } from "../../data/jd-extraction";
import { JD_MAX_TEXT_CHARS, JD_MIN_TEXT_CHARS } from "../../data/jd-extraction";
import {
  JD_ACCEPT, draftDisplay, draftSignature, planImport, readJdFile, requestJdParse, resetPatch,
  type ImportPlan, type ReviewItem,
} from "./_jdAutofillHelpers";

interface Props {
  draft: RequirementDraft;
  applyPatch: (patch: Partial<RequirementDraft>) => void;
  /** Field -> what the form showed right after import; the form compares it on submit. */
  importedRef: { current: Record<string, string> };
}

type Phase =
  | { kind: "idle" }
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string; limitReached: boolean }
  | { kind: "done"; sourceLabel: string };

const BASELINE = initialDraft(undefined);

const hairline = `color-mix(in oklch, ${t.inkFaintWeak} 35%, ${t.white})`;
const dashLine = `color-mix(in oklch, ${t.inkFaintWeak} 65%, ${t.white})`;
const cardBase: CSSProperties = {
  background: t.white, borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12,
};
const cardIdle: CSSProperties = { ...cardBase, border: `1px dashed ${dashLine}` };
const cardDrag: CSSProperties = { ...cardIdle, background: t.creamSoft, borderColor: t.indigo };
const cardDone: CSSProperties = { ...cardBase, border: `1px solid ${hairline}`, gap: 0 };
const title: CSSProperties = { fontFamily: f.sans, fontSize: textSize.md, fontWeight: 600, color: t.coal, margin: 0 };
const body: CSSProperties = { fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint, margin: 0, lineHeight: 1.5 };
const row: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" };
const textarea: CSSProperties = {
  width: "100%", minHeight: 140, resize: "vertical", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.line}`,
  fontFamily: f.sans, fontSize: textSize.base, color: t.coal, background: t.white, boxSizing: "border-box",
};

const loadingRow: CSSProperties = { ...row, gap: 8 };
const statusText: CSSProperties = { ...body, color: t.coal };
const headRow: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const fileBlock: CSSProperties = { display: "flex", alignItems: "center", gap: 12, minWidth: 0 };
const fileTile: CSSProperties = {
  width: 36, height: 36, borderRadius: 8, background: t.creamSoft, border: `1px solid ${hairline}`,
  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};
const fileText: CSSProperties = { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 };
const fileName: CSSProperties = {
  fontFamily: f.sans, fontSize: textSize.base, fontWeight: 600, color: t.coal, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const fileMeta: CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint, display: "flex", alignItems: "center", gap: 5 };
const quietButton: CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, color: t.inkFaint };
const reviewBox: CSSProperties = { marginTop: 16, borderTop: `1px solid ${hairline}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 4 };
const reviewHead: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const reviewTitle: CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, color: t.coal, margin: 0 };
const reviewCount: CSSProperties = { color: t.inkFaint, fontWeight: 400 };
const itemList: CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" };
const itemRow: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "12px 0" };
const itemRowDivided: CSSProperties = { ...itemRow, borderTop: `1px solid ${hairline}` };
const itemMain: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, flex: "1 1 240px", minWidth: 0 };
const labelRow: CSSProperties = { ...row, gap: 8 };
const labelText: CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, color: t.coal };
const compareRow: CSSProperties = { display: "flex", gap: 10, alignItems: "baseline" };
const compareKey: CSSProperties = { fontFamily: f.sans, fontSize: textSize.xs, color: t.inkFaint, width: 76, flexShrink: 0 };
const compareNew: CSSProperties = { fontFamily: f.sans, fontSize: textSize.base, color: t.coal, overflowWrap: "anywhere" };
const compareOld: CSSProperties = { ...compareNew, color: t.inkFaint };
const reasonStyle: CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint };
const PASTED_LABEL = "Pasted job description";
const hidden: CSSProperties = { display: "none" };
const pasteBox: CSSProperties = { display: "flex", flexDirection: "column", gap: 8 };
const hintText: CSSProperties = { ...body, fontSize: textSize.sm };
const errorText: CSSProperties = { ...body, color: t.errorInk };

const lowBadge: CSSProperties = {
  fontFamily: f.sans, fontSize: textSize.xs, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
  background: t.warning100, color: t.warningInk, border: `1px solid ${t.warningLine}`,
};

export default function JdAutofill({ draft, applyPatch, importedRef }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => () => abortRef.current?.abort(), []);

  const remember = useCallback((keys: JdFieldKey[], draftAfter: RequirementDraft) => {
    for (const k of keys) importedRef.current[k] = draftSignature(k, draftAfter);
  }, [importedRef]);

  const run = useCallback(async (getText: () => Promise<string>, source: "file" | "paste", sourceLabel: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    captureClientEvent("jd_import_started", { source });
    try {
      setPhase({ kind: "loading", message: source === "file" ? "Reading your file…" : "Reading the job description…" });
      const text = await getText();
      if (ctrl.signal.aborted) return;
      setPhase({ kind: "loading", message: "Picking out the details…" });
      const out = await requestJdParse(text, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (!out.ok) {
        captureClientEvent("jd_import_result", { source, ok: false, limitReached: out.limitReached });
        setPhase({ kind: "error", message: out.error, limitReached: out.limitReached });
        return;
      }
      const data: JdParseResponse = out.data;
      const before = draftRef.current;
      const reset = resetPatch(importedRef.current, before, BASELINE);
      const current = { ...before, ...reset.patch };
      const plan: ImportPlan = planImport(data.fields, current, BASELINE);
      const applied = plan.items.filter((i) => i.status === "applied");
      for (const k of reset.keys) delete importedRef.current[k];
      applyPatch({ ...reset.patch, ...plan.applyNow });
      remember(applied.map((i) => i.key), { ...current, ...plan.applyNow });
      setItems(plan.items);
      captureClientEvent("jd_import_result", {
        source, ok: true, llm: data.llm, cached: data.cached,
        applied: applied.length, suggested: plan.items.length - applied.length,
      });
      setPhase({ kind: "done", sourceLabel });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      const message = err instanceof Error && err.message ? err.message : "Could not read that. Try pasting the text instead.";
      captureClientEvent("jd_import_result", { source, ok: false, readError: true });
      setPhase({ kind: "error", message, limitReached: false });
    }
  }, [applyPatch, remember, importedRef]);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    void run(() => readJdFile(file), "file", file.name);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onPaste = () => {
    const text = pasted;
    void run(async () => text, "paste", PASTED_LABEL);
  };

  const applySuggestion = (item: ReviewItem) => {
    const current = draftRef.current;
    applyPatch(item.patch);
    remember([item.key], { ...current, ...item.patch });
    setItems((list) => list.map((i) => (i.key === item.key ? { ...i, status: "applied", reason: undefined } : i)));
    captureClientEvent("jd_import_field_applied", { field: item.key, confidence: item.confidence });
  };

  const applyAll = (list: ReviewItem[]) => {
    const current = draftRef.current;
    const patch = list.reduce<Partial<RequirementDraft>>((acc, i) => ({ ...acc, ...i.patch }), {});
    applyPatch(patch);
    remember(list.map((i) => i.key), { ...current, ...patch });
    const keys = new Set(list.map((i) => i.key));
    setItems((all) => all.map((i) => (keys.has(i.key) ? { ...i, status: "applied", reason: undefined } : i)));
    for (const i of list) captureClientEvent("jd_import_field_applied", { field: i.key, confidence: i.confidence, bulk: true });
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!dragging) setDragging(true);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onFile(e.dataTransfer.files[0]);
  };

  const reset = () => {
    setPhase({ kind: "idle" });
    setItems([]);
    setPasted("");
    setPasteOpen(false);
  };

  const appliedCount = items.filter((i) => i.status === "applied").length;
  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept={JD_ACCEPT}
      style={hidden}
      aria-label="Upload a job description file"
      onChange={(e) => onFile(e.target.files?.[0])}
    />
  );
  const canRead = pasted.trim().length >= JD_MIN_TEXT_CHARS;

  if (phase.kind === "loading") {
    return (
      <section aria-label="Import from a job description" style={cardIdle}>
        <div style={loadingRow}>
          <LoaderCircleIcon size={16} color={t.inkFaint} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <p role="status" style={statusText}>{phase.message}</p>
        </div>
      </section>
    );
  }

  if (phase.kind === "done") {
    const pending = items.filter((i) => i.status === "suggested");
    const replaceFile = phase.sourceLabel !== PASTED_LABEL;
    const nothingFound = appliedCount === 0 && pending.length === 0;
    const meta = nothingFound
      ? "No details found to fill in"
      : appliedCount === 0
        ? "Nothing filled in yet. Review below."
        : `${appliedCount} ${appliedCount === 1 ? "field" : "fields"} filled in below`;
    return (
      <section aria-label="Import from a job description" style={cardDone}>
        {fileInput}
        <div style={headRow}>
          <div style={fileBlock}>
            <span style={fileTile} aria-hidden="true"><FileTextIcon size={18} color={t.inkFaint} /></span>
            <div role="status" style={fileText}>
              <span style={fileName} title={phase.sourceLabel}>{phase.sourceLabel}</span>
              <span style={fileMeta}>
                {!nothingFound && <CheckIcon size={14} color={t.successInk} aria-hidden="true" />}
                {meta}
              </span>
            </div>
          </div>
          <Button type="button" variant="ghost" className="h-9 px-3 pointer-coarse:h-11" style={quietButton} onClick={replaceFile ? () => fileRef.current?.click() : reset}>
            Replace
          </Button>
        </div>
        {pending.length > 0 && (
          <div style={reviewBox}>
            <div style={reviewHead}>
              <h3 style={reviewTitle}>Needs your review <span style={reviewCount}>({pending.length})</span></h3>
              {pending.length > 1 && (
                <Button type="button" variant="ghost" className="h-8 px-2 pointer-coarse:h-11" style={quietButton} onClick={() => applyAll(pending)}>
                  Use all
                </Button>
              )}
            </div>
            <ul style={itemList}>
              {pending.map((item, index) => {
                const inForm = item.reason === "already-filled" ? draftDisplay(item.key, draft) : "";
                return (
                  <li key={item.key} style={index === 0 ? itemRow : itemRowDivided}>
                    <div style={itemMain}>
                      <div style={labelRow}>
                        <span style={labelText}>{item.label}</span>
                        {item.confidence === "low" && <span style={lowBadge}>Check this</span>}
                      </div>
                      <div style={compareRow}>
                        <span style={compareKey}>Suggested</span>
                        <span style={compareNew}>{item.display}</span>
                      </div>
                      {inForm && (
                        <div style={compareRow}>
                          <span style={compareKey}>In your form</span>
                          <span style={compareOld}>{inForm}</span>
                        </div>
                      )}
                      {item.reason === "low-confidence" && <div style={reasonStyle}>We were not sure about this one, so it was not filled in.</div>}
                    </div>
                    <OutlineCta size="sm" onClick={() => applySuggestion(item)} ariaLabel={`Use suggested ${item.label}`}>Use this</OutlineCta>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      aria-label="Import from a job description"
      style={dragging ? cardDrag : cardIdle}
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <h2 style={title}>Have a job description already?</h2>
      <p style={body}>
        Drop a file here or upload it, and we will fill in what we can find. You review everything before posting.
      </p>
      <div style={row}>
        {fileInput}
        <OutlineCta size="sm" icon={<UploadIcon size={15} aria-hidden="true" />} onClick={() => fileRef.current?.click()}>Upload PDF, DOCX or TXT</OutlineCta>
        <Button type="button" variant="ghost" className="h-9 px-3 pointer-coarse:h-11" style={quietButton} onClick={() => setPasteOpen((v) => !v)}>
          {pasteOpen ? "Hide paste box" : "Paste text instead"}
        </Button>
      </div>
      {pasteOpen && (
        <div style={pasteBox}>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value.slice(0, JD_MAX_TEXT_CHARS))}
            placeholder="Paste the job description here"
            aria-label="Job description text"
            style={textarea}
          />
          <div style={row}>
            <PrimaryCta size="sm" onClick={onPaste} disabled={!canRead}>Read it</PrimaryCta>
            {!canRead && pasted.length > 0 && <span style={hintText}>Paste a bit more, the full job description works best.</span>}
          </div>
        </div>
      )}
      {phase.kind === "error" && (
        <p role="alert" style={errorText}>
          {phase.message}
        </p>
      )}
    </section>
  );
}
