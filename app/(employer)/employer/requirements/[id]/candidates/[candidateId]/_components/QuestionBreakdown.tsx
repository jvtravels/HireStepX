"use client";

import { useId, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "cn";
import type { EvidenceQuestion } from "@/employer/EmployerDataContext";
import { Badge } from "@/employer/_atoms";
import type { Candidate } from "@/employer/mockData";
import { InfoTip, Panel } from "@/employer/_panelParts";
import { ItemRequest, type RequestUi } from "./RequestPopover";
import { DIFFICULTY_LABEL, cleanQuestionText, dedupeQuestions, LENGTH_LABEL, PROVENANCE, VERDICT_LABEL, VERDICT_TONE, summarizeQuestions } from "./helpers";

const STAR_LETTERS = [
  { key: "S", name: "Situation" },
  { key: "T", name: "Task" },
  { key: "A", name: "Action" },
  { key: "R", name: "Result" },
] as const;

function StarMarks({ star }: { star: NonNullable<EvidenceQuestion["star"]> }) {
  const missing = STAR_LETTERS.filter((l) => !star[l.key]).map((l) => l.name);
  return (
    <span className="inline-flex items-center gap-1">
      <span className="sr-only">{missing.length === 0 ? "Covers all four STAR parts" : `Missing STAR parts: ${missing.join(", ")}`}</span>
      {STAR_LETTERS.map((l) => (
        <span
          key={l.key}
          aria-hidden="true"
          title={`${l.name}: ${star[l.key] ? "covered" : "missing"}`}
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-md border text-[12px] font-semibold",
            star[l.key] ? "border-hx-indigo-100 bg-hx-indigo-100 text-hx-indigo" : "border-hx-line text-hx-ink-soft/70",
          )}
        >
          {l.key}
        </span>
      ))}
    </span>
  );
}

function QuestionRow({ q, n, candidate, requestUi }: { q: EvidenceQuestion; n: number; candidate: Candidate; requestUi: RequestUi }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const hasDetail = !!(q.answerText || q.explanation);

  const head = (
    <div className="grid min-w-0 gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span aria-hidden="true" className="mt-px w-5 shrink-0 text-[12px] font-semibold text-hx-ink-soft tabular-nums">{n}</span>
          <p className="m-0 min-w-0 text-[13px] leading-snug font-medium text-hx-coal [overflow-wrap:anywhere]">{cleanQuestionText(q.question)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={VERDICT_TONE[q.verdict]}>{VERDICT_LABEL[q.verdict]}</Badge>
          <span className="w-8 text-right text-[13px] font-semibold text-hx-coal tabular-nums">{q.score}</span>
          {hasDetail && <ChevronDownIcon size={16} aria-hidden="true" className={cn("shrink-0 text-hx-ink-soft transition-transform duration-200 ease-out motion-reduce:transition-none", open && "rotate-180")} />}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-7.5 text-[12px] text-hx-ink-soft">
        {q.difficulty && <span>{DIFFICULTY_LABEL[q.difficulty]} question</span>}
        {q.star && q.difficulty !== "warmup" && <StarMarks star={q.star} />}
        {q.length && <span>{LENGTH_LABEL[q.length.verdict]}, {q.length.wordCount} {q.length.wordCount === 1 ? "word" : "words"}</span>}
      </div>
    </div>
  );

  return (
    <li className="border-t border-hx-line first:border-t-0">
      {hasDetail ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="-mx-2 w-[calc(100%+1rem)] cursor-pointer rounded-lg border-0 bg-transparent px-2 py-3.5 text-left transition-colors duration-150 hover:bg-hx-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo motion-reduce:transition-none pointer-coarse:py-4"
        >
          {head}
        </button>
      ) : (
        <div className="py-3.5">{head}</div>
      )}
      {(q.verdict === "weak" || q.verdict === "partial" || q.verdict === "skipped") && (
        <div className="pb-3 pl-7.5">
          <ItemRequest
            candidate={candidate}
            ui={requestUi}
            label="Ask them to retake this"
            preset={{ kind: "practice", topic: cleanQuestionText(q.question).slice(0, 120) }}
          />
        </div>
      )}
      {hasDetail && open && (
        <div id={bodyId} className="grid gap-3 pb-4 pl-7.5">
          {q.answerText && (
            <div className="grid gap-1">
              <h4 className="m-0 text-[12px] font-semibold text-hx-ink-soft">Their answer</h4>
              <p className="m-0 max-w-[75ch] text-[13px] leading-relaxed whitespace-pre-line text-hx-coal [overflow-wrap:anywhere]">{q.answerText}</p>
            </div>
          )}
          {q.explanation && (
            <div className="grid gap-1">
              <h4 className="m-0 text-[12px] font-semibold text-hx-ink-soft">How it was graded</h4>
              <p className="m-0 max-w-[75ch] text-[13px] leading-relaxed text-hx-ink-soft [overflow-wrap:anywhere]">{q.explanation}</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function QuestionBreakdown({ questions, candidate, requestUi }: { questions: EvidenceQuestion[]; candidate: Candidate; requestUi: RequestUi }) {
  const list = dedupeQuestions(questions);
  const summary = summarizeQuestions(list);
  return (
    <Panel
      id="questions-heading"
      title="Answer by answer"
      action={<InfoTip label="How answers are graded">{PROVENANCE}. Scores are out of 100 and shown for the most recent completed interview.</InfoTip>}
    >
      {summary && (
        <p className="m-0 mb-1 text-[13px] text-hx-ink-soft">
          <span className="font-semibold text-hx-coal tabular-nums">{summary.count}</span> answered, averaging <span className="font-semibold text-hx-coal tabular-nums">{summary.avg}</span>.{" "}
          {summary.strong} strong or complete{summary.weak > 0 ? `, ${summary.weak} weak` : ""}
          {summary.starCounted > 0 ? `. ${summary.fullStar} of ${summary.starCounted} cover all four STAR parts` : ""}.
        </p>
      )}
      <ol aria-label="Interview questions" className="m-0 list-none p-0">
        {list.map((q, i) => (
          <QuestionRow key={`${q.idx}-${i}`} q={q} n={i + 1} candidate={candidate} requestUi={requestUi} />
        ))}
      </ol>
    </Panel>
  );
}
