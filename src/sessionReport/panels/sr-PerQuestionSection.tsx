/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Progressive-disclosure list of question cards. Imports QuestionDetail.
 * Includes BAND_META (used to color the per-card band pill).
 * Pure presentation.
 *
 * Intentionally bare list container — not a SrSectionShell card. The
 * outer <section> uses padding: 0 so each per-question row can run
 * edge-to-edge under its own borderTop separator; the section is a
 * list-of-rows shell, not the standard card-with-28px-padding shape
 * the shell encodes. */

import { useState } from "react";
import { t, f, radius, size } from "../tokens";
import type { Question } from "../types";
import { StatusPill, type Tone } from "./_primitives";
import { QuestionDetail } from "./sr-QuestionDetail";
import { Button } from "@/components/ui/button";

const BAND_META: Record<Question["band"], { label: string; tone: Tone }> = {
  weak:     { label: "Weak",     tone: "bad" },
  partial:  { label: "Partial",  tone: "warn" },
  complete: { label: "Complete", tone: "good" },
  strong:   { label: "Strong",   tone: "good" },
};

export function PerQuestionSection({ questions, onTryQuestionAgain }: { questions: Question[]; onTryQuestionAgain?: (questionIdx: number) => void }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const PRIMARY_COUNT = 3;
  /* R-7 (2026-07-10, live staging — Senior Product Designer @ Lollypop Design
   * Studio): a negotiation runs as a handful of turns, and every turn is
   * load-bearing (anchor, counter, close) — collapsing to the first 3 hid the
   * close and read as "the report is truncating my negotiation". Short sessions
   * (≤ AUTO_EXPAND_MAX turns) open fully; only long Q&A interviews keep the
   * top-3 progressive disclosure. */
  const AUTO_EXPAND_MAX = 6;
  const [showAll, setShowAll] = useState<boolean>(questions.length <= AUTO_EXPAND_MAX);
  const visible = showAll ? questions : questions.slice(0, PRIMARY_COUNT);
  const hiddenCount = questions.length - visible.length;
  const handleExpandAll = () => {
    setShowAll(true);
    setOpenIdx(null);
  };
  return (
    <section
      id="ir-section-questions"
      aria-labelledby="ir-questions-heading"
      style={{
        border: `1px solid ${t.line}`,
        borderRadius: radius.bar,
        overflow: "hidden",
        scrollMarginTop: 72,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          padding: "14px 18px",
        }}
      >
        <h2 id="ir-questions-heading" style={{ fontFamily: f.sans, fontSize: size.xl, fontWeight: 600, color: t.coal, margin: 0, letterSpacing: "-0.01em" }}>
          Your answers <span style={{ color: t.inkSoft, fontSize: size.base, fontWeight: 400, marginLeft: 6 }}>{questions.length} {questions.length === 1 ? "question" : "questions"}</span>
        </h2>
        {showAll ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => setOpenIdx(null)}
            style={{ color: t.inkSoft, fontFamily: f.sans, height: "auto" }}
          >
            Collapse all
          </Button>
        ) : null}
      </header>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {visible.map((q, idx) => {
          const open = openIdx === idx;
          const band = BAND_META[q.band];
          const panelId = `ir-q-panel-${q.index}`;
          return (
            <li key={q.index} style={{ borderTop: `1px solid ${t.line}` }}>
              <Button
                type="button"
                variant="ghost"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIdx(open ? null : idx)}
                style={{
                  width: "100%",
                  height: "auto",
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  justifyContent: "flex-start",
                  textAlign: "left",
                  fontFamily: "inherit",
                  color: "inherit",
                  borderRadius: 0,
                  minWidth: 0,
                  whiteSpace: "normal",
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: radius.lg,
                    background: open ? t.coal : t.creamSoft,
                    color: open ? t.white : t.coal,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: f.sans,
                    fontSize: size.base,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {q.index}
                </span>
                <span className="ir-q-trigger-text" style={{ flex: 1, minWidth: 0, whiteSpace: "normal", overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: open ? "unset" : 3, WebkitBoxOrient: "vertical", overflow: "hidden", fontFamily: f.sans, fontSize: size.md, color: t.coal, fontWeight: open ? 600 : 500 }}>
                  {q.text}
                </span>
                {q.lengthVerdict && q.lengthVerdict !== "justRight" && (
                  <span
                    className={`ir-q-meta-pill ${q.lengthVerdict === "tooShort" ? "too-short" : "too-long"} ir-q-trigger-band`}
                  >
                    {q.lengthVerdict === "tooShort" ? "Too short" : "Too long"}
                  </span>
                )}
                {q.redFlags && q.redFlags.length > 0 && (
                  <span
                    className="ir-q-redflag-badge ir-q-trigger-band"
                    aria-label={`${q.redFlags.length} red flag${q.redFlags.length === 1 ? "" : "s"}`}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    {q.redFlags.length} flag{q.redFlags.length === 1 ? "" : "s"}
                  </span>
                )}
                <StatusPill tone={band.tone}>{band.label}</StatusPill>
                <span style={{ fontFamily: f.sans, fontSize: size.base, color: t.coal, fontWeight: 600, minWidth: 60, textAlign: "right" }}>
                  {/* S6-B4 — a row with no genuine per-turn score (reconstructed
                      negotiation exchange) shows a neutral "—", never a
                      misleading 0/100 or a fabricated per-turn number. */}
                  {q.scoreUnavailable ? (
                    <span style={{ color: t.inkFaint, fontWeight: 400 }} aria-label="No per-turn score">—</span>
                  ) : (
                    <>
                      {q.score}<span style={{ color: t.inkFaint, fontWeight: 400 }}>/100</span>
                    </>
                  )}
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={t.inkSoft}
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms ease", flexShrink: 0 }}
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </Button>
              <div id={panelId} role="region" hidden={!open}>
                {open && <QuestionDetail q={q} onTryQuestionAgain={onTryQuestionAgain} />}
              </div>
            </li>
          );
        })}
      </ul>
      {hiddenCount > 0 && (
        <div
          style={{
            borderTop: `1px solid ${t.line}`,
            padding: "14px 18px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
          }}
        >
          <p style={{ margin: 0, fontSize: size.sm, color: t.inkFaint }}>
            Showing {visible.length} of {questions.length} questions
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={handleExpandAll}
            aria-label={`Show all ${questions.length} questions (${hiddenCount} more)`}
          >
            Show {hiddenCount} more question{hiddenCount === 1 ? "" : "s"}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </Button>
        </div>
      )}
    </section>
  );
}
