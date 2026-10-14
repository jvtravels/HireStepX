"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { captureClientEvent } from "../posthogClient";
import { OutlineCta, PrimaryCta } from "./_atoms";
import { initialDraft } from "./_requirementFormHelpers";
import type { RequirementDraft } from "./_requirementPayload";
import type { JdFieldKey, JdParseResponse } from "../../data/jd-extraction";
import { JD_MAX_TEXT_CHARS, JD_MIN_TEXT_CHARS } from "../../data/jd-extraction";
import {
  JD_ACCEPT, draftSignature, planImport, readJdFile, requestJdParse, snapshotFor,
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
  | { kind: "done" };

interface UndoStep { label: string; prev: Partial<RequirementDraft>; keys: JdFieldKey[] }

const BASELINE = initialDraft(undefined);

const card: CSSProperties = {
  border: `1px solid ${t.line}`, background: t.info100, borderRadius: 12, padding: "16px 18px",
  display: "flex", flexDirection: "column", gap: 12,
};
const title: CSSProperties = { fontFamily: f.sans, fontSize: textSize.md, fontWeight: 600, color: t.coal, margin: 0 };
const body: CSSProperties = { fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint, margin: 0, lineHeight: 1.5 };
const row: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" };
const textarea: CSSProperties = {
  width: "100%", minHeight: 140, resize: "vertical", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.line}`,
  fontFamily: f.sans, fontSize: textSize.base, color: t.coal, background: t.white, boxSizing: "border-box",
};

const statusText: CSSProperties = { ...body, color: t.coal };
const warningList: CSSProperties = { ...body, margin: 0, paddingLeft: 18 };
const itemList: CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 };
const itemCard: CSSProperties = { background: t.white, border: `1px solid ${t.line}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 };
const itemHead: CSSProperties = { ...row, justifyContent: "space-between" };
const labelRow: CSSProperties = { ...row, gap: 8 };
const labelText: CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, color: t.coal };
const filledText: CSSProperties = { ...labelText, color: t.successInk };
const valueText: CSSProperties = { fontFamily: f.sans, fontSize: textSize.base, color: t.coal, overflowWrap: "anywhere" };
const evidenceText: CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint, overflowWrap: "anywhere" };
const reasonStyle: CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, color: t.warningInk };
const hidden: CSSProperties = { display: "none" };
const pasteBox: CSSProperties = { display: "flex", flexDirection: "column", gap: 8 };
const hintText: CSSProperties = { ...body, fontSize: textSize.sm };
const errorText: CSSProperties = { ...body, color: t.errorInk };

const CONFIDENCE_LABEL = { high: "Clear", medium: "Likely", low: "Check this" } as const;

function badge(confidence: ReviewItem["confidence"]): CSSProperties {
  const bad = confidence === "low";
  return {
    fontFamily: f.sans, fontSize: textSize.xs, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
    background: bad ? t.warning100 : t.white, color: bad ? t.warningInk : t.neutralInk,
    border: `1px solid ${bad ? t.warningLine : t.line}`,
  };
}

function reasonText(item: ReviewItem): string {
  return item.reason === "already-filled"
    ? "Your form already has a value here, so it was left alone."
    : "We were not sure about this one, so it was not filled in.";
}

export default function JdAutofill({ draft, applyPatch, importedRef }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [cached, setCached] = useState(false);
  const [history, setHistory] = useState<UndoStep[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => () => abortRef.current?.abort(), []);

  const remember = useCallback((keys: JdFieldKey[], draftAfter: RequirementDraft) => {
    for (const k of keys) importedRef.current[k] = draftSignature(k, draftAfter);
  }, [importedRef]);

  const run = useCallback(async (getText: () => Promise<string>, source: "file" | "paste") => {
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
      const current = draftRef.current;
      const plan: ImportPlan = planImport(data.fields, current, BASELINE);
      const applied = plan.items.filter((i) => i.status === "applied");
      if (applied.length > 0) {
        const after = { ...current, ...plan.applyNow };
        setHistory((h) => [...h, { label: "import", prev: snapshotFor(current, plan.applyNow), keys: applied.map((i) => i.key) }]);
        applyPatch(plan.applyNow);
        remember(applied.map((i) => i.key), after);
      }
      setItems(plan.items);
      setWarnings(data.warnings);
      setCached(data.cached);
      captureClientEvent("jd_import_result", {
        source, ok: true, llm: data.llm, cached: data.cached,
        applied: applied.length, suggested: plan.items.length - applied.length,
      });
      setPhase({ kind: "done" });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      const message = err instanceof Error && err.message ? err.message : "Could not read that. Try pasting the text instead.";
      captureClientEvent("jd_import_result", { source, ok: false, readError: true });
      setPhase({ kind: "error", message, limitReached: false });
    }
  }, [applyPatch, remember]);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    void run(() => readJdFile(file), "file");
    if (fileRef.current) fileRef.current.value = "";
  };

  const onPaste = () => {
    const text = pasted;
    void run(async () => text, "paste");
  };

  const applySuggestion = (item: ReviewItem) => {
    const current = draftRef.current;
    const prev = snapshotFor(current, item.patch);
    applyPatch(item.patch);
    remember([item.key], { ...current, ...item.patch });
    setHistory((h) => [...h, { label: item.label, prev, keys: [item.key] }]);
    setItems((list) => list.map((i) => (i.key === item.key ? { ...i, status: "applied", reason: undefined } : i)));
    captureClientEvent("jd_import_field_applied", { field: item.key, confidence: item.confidence });
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    applyPatch(last.prev);
    for (const k of last.keys) delete importedRef.current[k];
    setHistory((h) => h.slice(0, -1));
    setItems((list) => list.map((i) => (last.keys.includes(i.key) ? { ...i, status: "suggested", reason: i.reason ?? "already-filled" } : i)));
    captureClientEvent("jd_import_undo", { fields: last.keys.length });
  };

  const reset = () => {
    setPhase({ kind: "idle" });
    setItems([]);
    setWarnings([]);
    setPasted("");
    setPasteOpen(false);
  };

  const appliedCount = items.filter((i) => i.status === "applied").length;
  const suggestedCount = items.length - appliedCount;
  const canRead = pasted.trim().length >= JD_MIN_TEXT_CHARS;

  if (phase.kind === "loading") {
    return (
      <section aria-label="Import from a job description" style={card}>
        <p role="status" style={statusText}>{phase.message}</p>
      </section>
    );
  }

  if (phase.kind === "done") {
    return (
      <section aria-label="Import from a job description" style={card}>
        <h2 style={title}>Imported from your job description</h2>
        <p role="status" style={body}>
          {appliedCount === 0 && suggestedCount === 0
            ? "We could not find any details to fill in."
            : `${appliedCount} filled in${suggestedCount > 0 ? `, ${suggestedCount} for you to check` : ""}. Nothing is saved until you post the job.`}
          {cached ? " (Same text as a recent import.)" : ""}
        </p>
        {warnings.length > 0 && (
          <ul style={warningList}>
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        )}
        {items.length > 0 && (
          <ul style={itemList}>
            {items.map((item) => (
              <li key={item.key} style={itemCard}>
                <div style={itemHead}>
                  <div style={labelRow}>
                    <span style={labelText}>{item.label}</span>
                    <span style={badge(item.confidence)}>{CONFIDENCE_LABEL[item.confidence]}</span>
                  </div>
                  {item.status === "applied" ? (
                    <span style={filledText}>Filled in</span>
                  ) : (
                    <OutlineCta size="sm" onClick={() => applySuggestion(item)} ariaLabel={`Use suggested ${item.label}`}>Use this</OutlineCta>
                  )}
                </div>
                <div style={valueText}>{item.display}</div>
                {item.evidence && item.key !== "description" && (
                  <div style={evidenceText}>From your text: “{item.evidence}”</div>
                )}
                {item.status === "suggested" && <div style={reasonStyle}>{reasonText(item)}</div>}
              </li>
            ))}
          </ul>
        )}
        <div style={row}>
          <OutlineCta size="sm" onClick={undo} disabled={history.length === 0}>Undo last change</OutlineCta>
          <OutlineCta size="sm" onClick={reset}>Import another</OutlineCta>
          <OutlineCta size="sm" onClick={reset}>Close</OutlineCta>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Import from a job description" style={card}>
      <h2 style={title}>Have a job description already?</h2>
      <p style={body}>
        Upload it or paste it and we will fill in what we can find. You review everything before posting, and you can undo.
      </p>
      <div style={row}>
        <input
          ref={fileRef}
          type="file"
          accept={JD_ACCEPT}
          style={hidden}
          aria-label="Upload a job description file"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <PrimaryCta size="sm" onClick={() => fileRef.current?.click()}>Upload PDF, DOCX or TXT</PrimaryCta>
        <OutlineCta size="sm" onClick={() => setPasteOpen((v) => !v)}>{pasteOpen ? "Hide paste box" : "Paste text instead"}</OutlineCta>
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
