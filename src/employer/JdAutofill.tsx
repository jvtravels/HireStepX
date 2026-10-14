"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { ArrowRightIcon, CheckCheckIcon, CheckIcon, CircleAlertIcon, ClipboardIcon, LoaderCircleIcon, SparklesIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { captureClientEvent } from "../posthogClient";
import { PrimaryCta } from "./_atoms";
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

type Mode = "upload" | "paste";

const BASELINE = initialDraft(undefined);
const PASTED_LABEL = "Pasted job description";
const SECTION_LABEL = "Import from a job description";

const hairline = `color-mix(in oklch, ${t.line} 100%, ${t.white})`;
const wash = `radial-gradient(120% 140% at 0% 0%, color-mix(in oklch, ${t.indigo100} 55%, ${t.white}) 0%, ${t.white} 55%)`;

const card: CSSProperties = {
  background: t.white, border: `1px solid ${hairline}`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 16,
};
const cardIdle: CSSProperties = { ...card, background: wash };
const cardDrag: CSSProperties = { ...card, background: wash, borderColor: t.indigo };
const head: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 };
const doneHead: CSSProperties = { ...head, flexWrap: "nowrap" };
const headLeft: CSSProperties = { display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "1 1 260px" };
const sparkTile: CSSProperties = {
  width: 36, height: 36, borderRadius: 10, background: t.white, border: `1px solid ${hairline}`,
  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};
const headText: CSSProperties = { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 };
const title: CSSProperties = { fontFamily: f.sans, fontSize: textSize.md, fontWeight: 600, color: t.coal, margin: 0, letterSpacing: "-0.01em" };
const sub: CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint, margin: 0, lineHeight: 1.45 };
const tabs: CSSProperties = { display: "inline-flex", gap: 2, padding: 3, borderRadius: 10, background: t.creamSoft, border: `1px solid ${hairline}` };
const tabBase: CSSProperties = {
  fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, padding: "5px 12px", borderRadius: 7, border: 0, cursor: "pointer", transition: "background-color 150ms, color 150ms",
};
const tabOn: CSSProperties = { ...tabBase, background: t.white, color: t.coal, outline: `1px solid ${hairline}` };
const tabOff: CSSProperties = { ...tabBase, background: "transparent", color: t.inkFaint };
const dropzoneBase: CSSProperties = {
  width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "22px 16px", borderRadius: 12,
  border: `1px dashed ${t.inkFaintWeak}`, cursor: "pointer", transition: "border-color 150ms, background-color 150ms", textAlign: "center",
};
const dropzone: CSSProperties = { ...dropzoneBase, background: `color-mix(in oklch, ${t.creamSoft} 70%, ${t.white})` };
const dropzoneHot: CSSProperties = { ...dropzoneBase, background: t.indigo100, borderColor: t.indigo, borderStyle: "solid" };
const dropIcon: CSSProperties = { ...sparkTile, width: 40, height: 40, borderRadius: 12 };
const dropTitle: CSSProperties = { fontFamily: f.sans, fontSize: textSize.base, color: t.coal, fontWeight: 500 };
const dropLink: CSSProperties = { color: t.indigo, fontWeight: 600 };
const chipRow: CSSProperties = { display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 6 };
const chip: CSSProperties = {
  fontFamily: f.mono, fontSize: textSize.xs, fontWeight: 500, color: t.inkFaint, padding: "2px 7px", borderRadius: 6, background: t.white, border: `1px solid ${hairline}`,
};
const chipNote: CSSProperties = { fontFamily: f.sans, fontSize: textSize.xs, color: t.inkFaint, marginLeft: 4 };
const textarea: CSSProperties = {
  width: "100%", minHeight: 150, resize: "vertical", padding: "12px 14px", borderRadius: 12, border: `1px solid ${t.line}`,
  fontFamily: f.sans, fontSize: textSize.base, lineHeight: 1.55, color: t.coal, background: t.white, boxSizing: "border-box",
};
const pasteBox: CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };
const pasteFoot: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 };
const hintText: CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint, margin: 0 };
const errorBox: CSSProperties = {
  display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, background: t.error100, border: `1px solid ${t.errorLine}`,
  fontFamily: f.sans, fontSize: textSize.base, color: t.errorInk, lineHeight: 1.45, margin: 0,
};
const hidden: CSSProperties = { display: "none" };

const loadingHead: CSSProperties = { display: "flex", alignItems: "center", gap: 12 };
const statusText: CSSProperties = { fontFamily: f.sans, fontSize: textSize.base, fontWeight: 500, color: t.coal, margin: 0 };
const skeletonStack: CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };
const bar = (width: string): CSSProperties => ({ height: 10, width, borderRadius: 6, background: t.creamSoft });

const fileTile: CSSProperties = {
  ...sparkTile, width: 40, height: 40, background: t.creamSoft, fontFamily: f.mono, fontSize: textSize.xs, fontWeight: 600, color: t.inkFaint, letterSpacing: "0.02em",
};
const fileBlock: CSSProperties = { display: "flex", alignItems: "center", gap: 12, minWidth: 0 };
const fileText: CSSProperties = { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 };
const fileName: CSSProperties = {
  fontFamily: f.sans, fontSize: textSize.base, fontWeight: 600, color: t.coal, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const fileMeta: CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint, display: "flex", alignItems: "center", gap: 5 };
const quietButton: CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, color: t.inkFaint };
const meter: CSSProperties = { display: "flex", height: 4, borderRadius: 999, overflow: "hidden", background: t.warning100 };
const meterFill = (pct: number): CSSProperties => ({ width: `${pct}%`, background: t.success, borderRadius: 999 });
const reviewHead: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const reviewTitle: CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, color: t.coal, margin: 0, display: "flex", alignItems: "center", gap: 8 };
const countPill: CSSProperties = {
  fontFamily: f.sans, fontSize: textSize.xs, fontWeight: 600, minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: t.warning100, color: t.warningInk,
};
const acceptAll: CSSProperties = { ...quietButton, color: t.indigo };
const itemList: CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" };
const itemRow: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0" };
const itemRowDivided: CSSProperties = { ...itemRow, borderTop: `1px solid ${hairline}` };
const itemMain: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, flex: "1 1 240px", minWidth: 0 };
const labelRow: CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const labelText: CSSProperties = { fontFamily: f.sans, fontSize: textSize.xs, fontWeight: 600, color: t.inkFaint, textTransform: "uppercase", letterSpacing: "0.04em" };
const lowBadge: CSSProperties = {
  fontFamily: f.sans, fontSize: textSize.xs, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: t.warning100, color: t.warningInk, border: `1px solid ${t.warningLine}`,
};
const valueRow: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: textSize.md, lineHeight: 1.4 };
const newValue: CSSProperties = { color: t.coal, fontWeight: 600, overflowWrap: "anywhere", textDecoration: "none" };
const oldValue: CSSProperties = { color: t.inkFaint, textDecoration: "line-through", textDecorationColor: t.inkFaintWeak, overflowWrap: "anywhere" };
const reasonStyle: CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint };

function fileBadge(label: string): string | null {
  const dot = label.lastIndexOf(".");
  const ext = dot > 0 ? label.slice(dot + 1) : "";
  return ext.length > 0 && ext.length <= 4 ? ext.toUpperCase() : null;
}

export default function JdAutofill({ draft, applyPatch, importedRef }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [mode, setMode] = useState<Mode>("upload");
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
    setMode("upload");
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
      <section aria-label={SECTION_LABEL} style={cardIdle}>
        <div style={loadingHead}>
          <span style={sparkTile} aria-hidden="true">
            <LoaderCircleIcon size={18} color={t.indigo} className="animate-spin motion-reduce:animate-none" />
          </span>
          <p role="status" style={statusText}>{phase.message}</p>
        </div>
        <div style={skeletonStack} aria-hidden="true">
          <div style={bar("72%")} className="animate-pulse motion-reduce:animate-none" />
          <div style={bar("54%")} className="animate-pulse motion-reduce:animate-none" />
          <div style={bar("63%")} className="animate-pulse motion-reduce:animate-none" />
        </div>
      </section>
    );
  }

  if (phase.kind === "done") {
    const pending = items.filter((i) => i.status === "suggested");
    const replaceFile = phase.sourceLabel !== PASTED_LABEL;
    const nothingFound = appliedCount === 0 && pending.length === 0;
    const total = appliedCount + pending.length;
    const badge = replaceFile ? fileBadge(phase.sourceLabel) : null;
    const meta = nothingFound
      ? "No details found to fill in"
      : appliedCount === 0
        ? "Nothing filled in yet. Review below."
        : `${appliedCount} ${appliedCount === 1 ? "field" : "fields"} filled in below`;
    return (
      <section aria-label={SECTION_LABEL} style={card}>
        {fileInput}
        <div style={doneHead}>
          <div style={fileBlock}>
            <span style={fileTile} aria-hidden="true">
              {badge ?? <ClipboardIcon size={18} color={t.inkFaint} />}
            </span>
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
        {total > 0 && (
          <div style={meter} aria-hidden="true">
            <div style={meterFill((appliedCount / total) * 100)} />
          </div>
        )}
        {pending.length > 0 && (
          <div>
            <div style={reviewHead}>
              <h3 style={reviewTitle}>Needs your review <span style={countPill}>{pending.length}</span></h3>
              {pending.length > 1 && (
                <Button type="button" variant="ghost" className="h-8 gap-1.5 px-2 pointer-coarse:h-11" style={acceptAll} onClick={() => applyAll(pending)}>
                  <CheckCheckIcon size={14} aria-hidden="true" />
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
                      <div style={valueRow}>
                        {inForm && (
                          <>
                            <del style={oldValue}>{inForm}</del>
                            <ArrowRightIcon size={14} color={t.inkFaintWeak} aria-hidden="true" />
                          </>
                        )}
                        <ins style={newValue}>{item.display}</ins>
                      </div>
                      {item.reason === "low-confidence" && <div style={reasonStyle}>We were not sure about this one, so it was not filled in.</div>}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 gap-1.5 px-3 pointer-coarse:h-11"
                      onClick={() => applySuggestion(item)}
                      aria-label={`Use suggested ${item.label}`}
                    >
                      <CheckIcon size={14} aria-hidden="true" />
                      Use this
                    </Button>
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
      aria-label={SECTION_LABEL}
      style={dragging ? cardDrag : cardIdle}
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div style={head}>
        <div style={headLeft}>
          <span style={sparkTile} aria-hidden="true"><SparklesIcon size={18} color={t.indigo} /></span>
          <div style={headText}>
            <h2 style={title}>Start from a job description</h2>
            <p style={sub}>We fill in what we find. You review everything before posting.</p>
          </div>
        </div>
        <div style={tabs} role="tablist" aria-label="Import method">
          <button type="button" role="tab" aria-selected={mode === "upload"} style={mode === "upload" ? tabOn : tabOff} onClick={() => setMode("upload")}>Upload</button>
          <button type="button" role="tab" aria-selected={mode === "paste"} style={mode === "paste" ? tabOn : tabOff} onClick={() => setMode("paste")}>Paste</button>
        </div>
      </div>
      {mode === "upload" ? (
        <>
          {fileInput}
          <button
            type="button"
            style={dragging ? dropzoneHot : dropzone}
            className="hover:border-[var(--btn-primary)]"
            onClick={() => fileRef.current?.click()}
          >
            <span style={dropIcon} aria-hidden="true"><UploadIcon size={18} color={t.coal} /></span>
            <span style={dropTitle}>{dragging ? "Drop to import" : <>Drop a file here, or <span style={dropLink}>browse</span></>}</span>
            <span style={chipRow}>
              <span style={chip}>PDF</span>
              <span style={chip}>DOCX</span>
              <span style={chip}>TXT</span>
              <span style={chipNote}>up to 5 MB</span>
            </span>
          </button>
        </>
      ) : (
        <div style={pasteBox}>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value.slice(0, JD_MAX_TEXT_CHARS))}
            placeholder="Paste the job description here"
            aria-label="Job description text"
            style={textarea}
          />
          <div style={pasteFoot}>
            <p style={hintText}>
              {!canRead && pasted.length > 0
                ? "Paste a bit more, the full job description works best."
                : `${pasted.length.toLocaleString("en-IN")} / ${JD_MAX_TEXT_CHARS.toLocaleString("en-IN")} characters`}
            </p>
            <PrimaryCta size="sm" onClick={onPaste} disabled={!canRead}>Read it</PrimaryCta>
          </div>
        </div>
      )}
      {phase.kind === "error" && (
        <p role="alert" style={errorBox}>
          <CircleAlertIcon size={16} aria-hidden="true" className="mt-px shrink-0" />
          <span>{phase.message}</span>
        </p>
      )}
    </section>
  );
}
