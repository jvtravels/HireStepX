"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { ArrowRightIcon, CheckCheckIcon, CheckIcon, ChevronDownIcon, CircleAlertIcon, ClipboardIcon, FileTextIcon, LoaderCircleIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { captureClientEvent } from "../posthogClient";
import { PrimaryCta } from "./_atoms";
import { initialDraft } from "./_requirementFormHelpers";
import type { RequirementDraft } from "./_requirementPayload";
import type { JdFieldKey, JdParseResponse } from "../../data/jd-extraction";
import { JD_MAX_TEXT_CHARS, JD_MIN_TEXT_CHARS } from "../../data/jd-extraction";
import {
  JD_ACCEPT, draftDisplay, draftSignature, flashJdFields, planImport, readJdFile, requestJdParse, resetPatch,
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
const MODES: readonly Mode[] = ["upload", "paste"];

const BASELINE = initialDraft(undefined);
const PASTED_LABEL = "Pasted job description";
const SECTION_LABEL = "Import from a job description";

const hairline = `color-mix(in oklch, ${t.line} 100%, ${t.white})`;
const wash = `radial-gradient(120% 220% at 0% 0%, color-mix(in oklch, ${t.indigo100} 55%, ${t.white}) 0%, ${t.white} 60%)`;

const shell: CSSProperties = { background: wash, border: `1px solid ${hairline}`, borderRadius: 14, padding: "10px 12px" };
const shellDone: CSSProperties = { ...shell, background: t.white };
const shellDrag: CSSProperties = { ...shell, borderColor: t.indigo };
const row: CSSProperties = { display: "flex", alignItems: "center", gap: 12 };
const toggle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, flex: "1 1 0", minWidth: 0, padding: 0, margin: 0, border: 0, background: "transparent",
  textAlign: "left", cursor: "pointer", borderRadius: 10, font: "inherit", color: "inherit",
};
const toggleStatic: CSSProperties = { ...toggle, cursor: "default" };
const sparkTile: CSSProperties = {
  width: 36, height: 36, borderRadius: 10, background: t.white, border: `1px solid ${hairline}`,
  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};
const textCol: CSSProperties = { display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 0" };
const titleLine: CSSProperties = { display: "flex", alignItems: "center", gap: 8, minWidth: 0 };
const title: CSSProperties = { fontFamily: f.sans, fontSize: textSize.md, fontWeight: 600, color: t.coal, letterSpacing: "-0.01em", lineHeight: 1.3 };
const sub: CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const actions: CSSProperties = { display: "flex", alignItems: "center", gap: 6, flexShrink: 0 };
const body: CSSProperties = { display: "flex", flexDirection: "column", gap: 12, marginTop: 10, paddingTop: 12, borderTop: `1px solid ${hairline}` };
const tabs: CSSProperties = {
  position: "relative", alignSelf: "flex-start", display: "inline-grid", gridTemplateColumns: "1fr 1fr", padding: 3, borderRadius: 10, background: t.creamSoft, border: `1px solid ${hairline}`,
};
const tabThumb: CSSProperties = {
  position: "absolute", top: 3, bottom: 3, left: 3, width: "calc((100% - 6px) / 2)", borderRadius: 7, background: t.white, outline: `1px solid ${hairline}`, pointerEvents: "none",
};
const tabBase: CSSProperties = {
  position: "relative", fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, padding: "5px 14px", borderRadius: 7, border: 0, background: "transparent", cursor: "pointer", transition: "color 200ms",
};
const tabOn: CSSProperties = { ...tabBase, color: t.coal };
const tabOff: CSSProperties = { ...tabBase, color: t.inkFaint };
const dropzoneBase: CSSProperties = {
  width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 16px", borderRadius: 12,
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

const statusText: CSSProperties = { fontFamily: f.sans, fontSize: textSize.base, fontWeight: 500, color: t.coal, margin: 0 };

const fileTile: CSSProperties = {
  ...sparkTile, background: t.creamSoft, fontFamily: f.mono, fontSize: textSize.xs, fontWeight: 600, color: t.inkFaint, letterSpacing: "0.02em",
};
const fileName: CSSProperties = {
  fontFamily: f.sans, fontSize: textSize.base, fontWeight: 600, color: t.coal, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
};
const fileMeta: CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint, display: "flex", alignItems: "center", gap: 5 };
const quietButton: CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, color: t.inkFaint };
const reviewPill: CSSProperties = {
  fontFamily: f.sans, fontSize: textSize.xs, fontWeight: 600, padding: "1px 8px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0,
  background: t.warning100, color: t.warningInk, border: `1px solid ${t.warningLine}`,
};
const acceptAll: CSSProperties = { ...quietButton, color: t.indigo };
const listHead: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const itemList: CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" };
const itemRow: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 8px", margin: "0 -8px", borderRadius: 10 };
const itemCell: CSSProperties = { minHeight: 0 };
const itemRowDivided: CSSProperties = { ...itemRow, borderRadius: 0, borderTop: `1px solid ${hairline}` };
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

const EASE = "ease-[cubic-bezier(0.25,1,0.5,1)]";
const LEAVE_MS = 220;
const ENTER_STAGGER = ["", "[animation-delay:40ms]", "[animation-delay:80ms]", "[animation-delay:120ms]"];

// Keeps content mounted while it animates out. `settled` lets the clip lift once open so focus rings are not cut off.
function usePresence(on: boolean) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (on) {
      setMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      const done = setTimeout(() => setSettled(true), LEAVE_MS + 40);
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
        clearTimeout(done);
      };
    }
    setShown(false);
    setSettled(false);
    const gone = setTimeout(() => setMounted(false), LEAVE_MS);
    return () => clearTimeout(gone);
  }, [on]);
  return { mounted, shown, settled };
}

function fileBadge(label: string): string | null {
  const dot = label.lastIndexOf(".");
  const ext = dot > 0 ? label.slice(dot + 1) : "";
  return ext.length > 0 && ext.length <= 4 ? ext.toUpperCase() : null;
}

export default function JdAutofill({ draft, applyPatch, importedRef }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [mode, setMode] = useState<Mode>("upload");
  const [open, setOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<ReadonlySet<JdFieldKey>>(new Set());
  const leaveTimers = useRef<number[]>([]);
  const lastPanel = useRef<ReactNode>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const focusAfter = useRef<"status" | "toggle" | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const bodyId = useId();

  useEffect(() => {
    const timers = leaveTimers.current;
    return () => {
      abortRef.current?.abort();
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

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
        setOpen(true);
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
      flashJdFields(applied.map((i) => i.key));
      setItems(plan.items);
      captureClientEvent("jd_import_result", {
        source, ok: true, llm: data.llm, cached: data.cached,
        applied: applied.length, suggested: plan.items.length - applied.length,
      });
      setPhase({ kind: "done", sourceLabel });
      setOpen(plan.items.length > applied.length);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      const message = err instanceof Error && err.message ? err.message : "Could not read that. Try pasting the text instead.";
      captureClientEvent("jd_import_result", { source, ok: false, readError: true });
      setPhase({ kind: "error", message, limitReached: false });
      setOpen(true);
    }
  }, [applyPatch, remember, importedRef]);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    void run(() => readJdFile(file), "file", file.name);
    if (fileRef.current) fileRef.current.value = "";
  };
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;

  const onPaste = () => {
    const text = pasted;
    void run(async () => text, "paste", PASTED_LABEL);
  };

  const pending = items.filter((i) => i.status === "suggested");
  const confident = pending.filter((i) => i.confidence !== "low");

  const focusUseButton = (key: JdFieldKey) => {
    sectionRef.current?.querySelector<HTMLElement>(`[data-jd-use="${key}"]`)?.focus();
  };

  const applySuggestion = (item: ReviewItem) => {
    const current = draftRef.current;
    applyPatch(item.patch);
    remember([item.key], { ...current, ...item.patch });
    setItems((list) => list.map((i) => (i.key === item.key ? { ...i, status: "applied", reason: undefined } : i)));
    flashJdFields([item.key]);
    const rest = pending.filter((i) => i.key !== item.key);
    const at = pending.findIndex((i) => i.key === item.key);
    const next = rest[Math.min(at, rest.length - 1)];
    if (next) focusUseButton(next.key);
    else focusAfter.current = "status";
    setLeaving((set) => new Set(set).add(item.key));
    leaveTimers.current.push(window.setTimeout(() => {
      setLeaving((set) => {
        const next = new Set(set);
        next.delete(item.key);
        return next;
      });
    }, LEAVE_MS));
    captureClientEvent("jd_import_field_applied", { field: item.key, confidence: item.confidence });
  };

  const applyAll = (list: ReviewItem[]) => {
    const current = draftRef.current;
    const patch = list.reduce<Partial<RequirementDraft>>((acc, i) => ({ ...acc, ...i.patch }), {});
    applyPatch(patch);
    remember(list.map((i) => i.key), { ...current, ...patch });
    const keys = new Set(list.map((i) => i.key));
    setItems((all) => all.map((i) => (keys.has(i.key) ? { ...i, status: "applied", reason: undefined } : i)));
    flashJdFields(list.map((i) => i.key));
    const rest = pending.find((i) => !keys.has(i.key));
    if (rest) focusUseButton(rest.key);
    else focusAfter.current = "status";
    for (const i of list) captureClientEvent("jd_import_field_applied", { field: i.key, confidence: i.confidence, bulk: true });
  };

  // A file dropped anywhere on the page imports; text drags are left alone.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      onFileRef.current(e.dataTransfer?.files[0]);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);

  const cancel = () => {
    abortRef.current?.abort();
    focusAfter.current = "toggle";
    setPhase({ kind: "idle" });
  };

  const reset = () => {
    setPhase({ kind: "idle" });
    setItems([]);
    setPasted("");
    setMode("upload");
    setOpen(false);
  };

  const rows = items.filter((i) => i.status === "suggested" || leaving.has(i.key));
  const appliedCount = items.length - pending.length;
  const idleLike = phase.kind === "idle" || phase.kind === "error";
  const canToggle = idleLike || (phase.kind === "done" && pending.length > 0);
  const expanded = canToggle && open;
  const canRead = pasted.trim().length >= JD_MIN_TEXT_CHARS;

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (e.key !== "Escape" || !(active === document.body || sectionRef.current?.contains(active))) return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  useEffect(() => {
    const want = focusAfter.current;
    if (!want) return;
    const el = want === "status" ? statusRef.current : toggleRef.current;
    if (!el) return;
    focusAfter.current = null;
    el.focus();
  }, [phase, items]);

  const { mounted, shown, settled } = usePresence(expanded);

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
  const chevron = (
    <ChevronDownIcon
      size={16}
      color={t.inkFaint}
      aria-hidden="true"
      className={`shrink-0 transition-transform duration-200 ${EASE} motion-reduce:transition-none ${open ? "rotate-180 group-hover/toggle:-translate-y-0.5" : "group-hover/toggle:translate-y-0.5"}`}
    />
  );
  const toggleProps = {
    ref: toggleRef,
    type: "button" as const,
    style: toggle,
    className: "group/toggle",
    "aria-expanded": open,
    "aria-controls": open ? bodyId : undefined,
    onClick: () => setOpen((o) => !o),
  };

  const headerClass = "animate-in fade-in-0 duration-200 motion-reduce:animate-none";
  const headerKey = phase.kind === "error" ? "idle" : phase.kind;

  let header: ReactNode;
  if (phase.kind === "loading") {
    header = (
      <div key={headerKey} style={row} className={headerClass}>
        <span style={sparkTile} aria-hidden="true">
          <LoaderCircleIcon size={18} color={t.indigo} className="animate-spin motion-reduce:animate-none" />
        </span>
        <p key={phase.message} role="status" style={statusText} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">{phase.message}</p>
        <Button type="button" variant="ghost" className="ml-auto h-9 px-3 pointer-coarse:h-11" style={quietButton} onClick={cancel}>Cancel</Button>
      </div>
    );
  } else if (phase.kind === "done") {
    const replaceFile = phase.sourceLabel !== PASTED_LABEL;
    const nothingFound = items.length === 0;
    const badge = replaceFile ? fileBadge(phase.sourceLabel) : null;
    const meta = nothingFound
      ? "No details found to fill in"
      : appliedCount === 0
        ? "Nothing filled in yet. Review below."
        : `${appliedCount} ${appliedCount === 1 ? "field" : "fields"} filled in below`;
    const left = (
      <>
        <span style={fileTile} aria-hidden="true">{badge ?? <ClipboardIcon size={18} color={t.inkFaint} />}</span>
        <span style={textCol}>
          <span style={titleLine}>
            <span style={fileName} title={phase.sourceLabel}>{phase.sourceLabel}</span>
            {pending.length > 0 && <span style={reviewPill}>{pending.length} to review</span>}
            {canToggle && chevron}
          </span>
          <span ref={statusRef} tabIndex={-1} role="status" style={fileMeta}>
            {!nothingFound && <CheckIcon size={14} color={t.successInk} aria-hidden="true" className="animate-in zoom-in-50 duration-300 motion-reduce:animate-none" />}
            {meta}
          </span>
        </span>
      </>
    );
    header = (
      <div key={headerKey} style={row} className={headerClass}>
        {canToggle ? <button {...toggleProps}>{left}</button> : <div style={toggleStatic}>{left}</div>}
        <Button
          type="button"
          variant="ghost"
          className="h-9 px-3 pointer-coarse:h-11"
          style={quietButton}
          onClick={replaceFile ? () => fileRef.current?.click() : () => { reset(); setMode("paste"); setOpen(true); }}
        >
          Replace
        </Button>
      </div>
    );
  } else {
    header = (
      <div key={headerKey} style={row} className={headerClass}>
        <button {...toggleProps}>
          <span style={sparkTile} aria-hidden="true">
            <FileTextIcon size={18} color={t.indigo} />
          </span>
          <span style={textCol}>
            <span style={titleLine}>
              <span style={title}>{dragging ? "Drop to import" : "Start from a job description"}</span>
              {chevron}
            </span>
            <span style={sub} className="hidden sm:block">
              {dragging ? "Release to read your file" : "We fill in what we find. You review everything before posting."}
            </span>
          </span>
        </button>
        {!open && (
          <div style={actions}>
            <Button type="button" variant="outline" className="h-9 gap-1.5 px-3 pointer-coarse:h-11" onClick={() => fileRef.current?.click()}>
              <UploadIcon size={14} aria-hidden="true" />
              Upload
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="hidden h-9 gap-1.5 px-3 pointer-coarse:h-11 sm:inline-flex"
              style={quietButton}
              onClick={() => { setMode("paste"); setOpen(true); }}
            >
              <ClipboardIcon size={14} aria-hidden="true" />
              Paste
            </Button>
          </div>
        )}
      </div>
    );
  }

  const onTabKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const at = MODES.indexOf(mode);
    let to = -1;
    if (e.key === "ArrowRight") to = (at + 1) % MODES.length;
    else if (e.key === "ArrowLeft") to = (at + MODES.length - 1) % MODES.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = MODES.length - 1;
    if (to < 0) return;
    e.preventDefault();
    setMode(MODES[to]);
    document.getElementById(`${bodyId}-tab-${MODES[to]}`)?.focus();
  };

  let panel: ReactNode = null;
  if (expanded && idleLike) {
    panel = (
      <>
        <div style={tabs} role="tablist" aria-label="Import method">
          <span
            aria-hidden="true"
            style={tabThumb}
            className={`transition-transform duration-200 ${EASE} motion-reduce:transition-none ${mode === "upload" ? "translate-x-0" : "translate-x-full"}`}
          />
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              id={`${bodyId}-tab-${m}`}
              aria-selected={mode === m}
              aria-controls={`${bodyId}-panel`}
              tabIndex={mode === m ? 0 : -1}
              style={mode === m ? tabOn : tabOff}
              className="hover:text-[var(--foreground)]!"
              onClick={() => setMode(m)}
              onKeyDown={onTabKey}
            >
              {m === "upload" ? "Upload" : "Paste"}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`${bodyId}-panel`} aria-labelledby={`${bodyId}-tab-${mode}`}>
        {mode === "upload" ? (
          <button
            type="button"
            style={dragging ? dropzoneHot : dropzone}
            className={`group/drop hover:border-[var(--btn-primary)]! hover:bg-[color-mix(in_oklch,var(--btn-primary)_5%,white)]! ${EASE}`}
            onClick={() => fileRef.current?.click()}
          >
            <span style={dropIcon} aria-hidden="true">
              <UploadIcon size={18} color={t.coal} />
            </span>
            <span style={dropTitle}>{dragging ? "Drop to import" : <>Drop a file here, or <span style={dropLink} className="group-hover/drop:underline underline-offset-2">browse</span></>}</span>
            <span style={chipRow}>
              <span style={chip}>PDF</span>
              <span style={chip}>DOCX</span>
              <span style={chip}>TXT</span>
              <span style={chipNote}>up to 5 MB</span>
            </span>
          </button>
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
        </div>
        <p style={hintText} className="sm:hidden">We fill in what we find. You review everything before posting.</p>
        {phase.kind === "error" && (
          <p role="alert" style={errorBox}>
            <CircleAlertIcon size={16} aria-hidden="true" className="mt-px shrink-0" />
            <span>{phase.message}</span>
          </p>
        )}
      </>
    );
  } else if (expanded && phase.kind === "done") {
    panel = (
      <>
        {pending.length > 1 && (
          <div style={listHead}>
            <p style={hintText}>Suggestions from your job description</p>
            {confident.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                className="h-8 gap-1.5 px-2 pointer-coarse:h-11"
                style={acceptAll}
                aria-label={confident.length === pending.length ? "Use all suggestions" : `Use the ${confident.length} confident suggestions`}
                onClick={() => applyAll(confident)}
              >
                <CheckCheckIcon size={14} aria-hidden="true" />
                {confident.length === pending.length ? "Use all" : `Use ${confident.length} confident`}
              </Button>
            )}
          </div>
        )}
        <ul style={itemList}>
          {rows.map((item, index) => {
            const inForm = item.reason === "already-filled" ? draftDisplay(item.key, draft) : "";
            const leavingNow = leaving.has(item.key);
            return (
              <li
                key={item.key}
                className={`grid transition-[grid-template-rows,opacity] duration-200 ${EASE} motion-reduce:transition-none ${
                  leavingNow ? "pointer-events-none grid-rows-[0fr] overflow-hidden opacity-0" : `animate-in fade-in-0 slide-in-from-top-1 fill-mode-backwards motion-reduce:animate-none grid-rows-[1fr] opacity-100 ${ENTER_STAGGER[Math.min(index, ENTER_STAGGER.length - 1)]}`
                }`}
              >
              <div style={itemCell}>
              <div style={index === 0 ? itemRow : itemRowDivided}>
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
                  data-jd-use={item.key}
                  aria-label={`Use suggested ${item.label}`}
                  disabled={leavingNow}
                >
                  <CheckIcon size={14} aria-hidden="true" className={leavingNow ? "animate-in zoom-in-50 duration-200" : undefined} />
                  {leavingNow ? "Added" : "Use this"}
                </Button>
              </div>
              </div>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  const shellStyle = dragging ? shellDrag : phase.kind === "done" ? shellDone : shell;
  if (panel) lastPanel.current = panel;
  const bodyContent = panel ?? lastPanel.current;
  const sectionClass = `transition-[border-color] duration-200 ${EASE} motion-reduce:transition-none ${idleLike && !open && !dragging ? "hover:border-[color-mix(in_oklch,var(--btn-primary)_35%,white)]!" : ""}`;

  return (
    <section ref={sectionRef} aria-label={SECTION_LABEL} style={shellStyle} className={sectionClass}>
      {fileInput}
      {header}
      {mounted && (
        <div
          inert={!shown}
          className={`grid transition-[grid-template-rows,opacity] duration-200 ${EASE} motion-reduce:transition-none ${shown ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className={`min-h-0 ${settled ? "" : "overflow-hidden"}`}>
            <div id={bodyId} style={body}>{bodyContent}</div>
          </div>
        </div>
      )}
    </section>
  );
}
