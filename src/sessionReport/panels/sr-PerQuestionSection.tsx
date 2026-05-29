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
import { t, f, shadows, radius } from "../tokens";
import type { Question } from "../types";
import { SectionEyebrow } from "./sr-JumpNav";
import { QuestionDetail } from "./sr-QuestionDetail";

const BAND_META: Record<Question["band"], { label: string; color: string }> = {
  weak:     { label: "Weak",     color: t.error },
  partial:  { label: "Partial",  color: t.copper },
  complete: { label: "Complete", color: t.success },
  strong:   { label: "Strong",   color: t.success },
};

export function PerQuestionSection({ questions }: { questions: Question[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const PRIMARY_COUNT = 3;
  const [showAll, setShowAll] = useState<boolean>(questions.length <= PRIMARY_COUNT);
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
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: radius.shell,
        padding: 0,
        boxShadow: shadows.card,
        overflow: "hidden",
        scrollMarginTop: 72,
      }}
    >
      <div style={{ padding: "24px 28px 0" }}>
        <SectionEyebrow num="04" label="Question by question" />
      </div>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          padding: "0 28px 16px",
        }}
      >
        <h2 id="ir-questions-heading" style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, margin: 0, letterSpacing: "-0.01em" }}>
          Per-Question Review <span style={{ color: t.inkFaint, fontSize: 16, marginLeft: 6 }}>({questions.length})</span>
        </h2>
        {showAll ? (
          <button
            type="button"
            onClick={() => setOpenIdx(null)}
            style={{ background: "transparent", border: "none", color: t.indigo, fontFamily: f.sans, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
          >
            Collapse all
          </button>
        ) : null}
      </header>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {visible.map((q, idx) => {
          const open = openIdx === idx;
          const band = BAND_META[q.band];
          const panelId = `ir-q-panel-${q.index}`;
          return (
            <li key={q.index} style={{ borderTop: `1px solid ${t.line}` }}>
              <button
                type="button"
                className="ir-q-card-trigger"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIdx(open ? null : idx)}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: radius.lg,
                    background: open ? t.indigo : t.creamSoft,
                    color: open ? t.cream : t.coal,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: f.mono,
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {q.index}
                </span>
                <span className="ir-q-trigger-text" style={{ flex: 1, fontFamily: f.sans, fontSize: 14, color: t.coal, fontWeight: open ? 600 : 500 }}>
                  {q.text}
                </span>
                {q.frequencyPct !== undefined && q.frequencyPct >= 70 && (
                  <span
                    className="ir-q-meta-pill high-freq ir-q-trigger-band"
                    title={q.frequencyNote ?? `${q.frequencyPct}% of rounds`}
                  >
                    {q.frequencyPct}% asked
                  </span>
                )}
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
                <span
                  className="ir-q-trigger-band"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "3px 10px",
                    borderRadius: radius.pill,
                    background: band.color === t.error ? t.errorTint : band.color === t.copper ? t.copperAccent : t.successTint,
                    color: band.color,
                    fontFamily: f.sans,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {band.label}
                </span>
                <span style={{ fontFamily: f.mono, fontSize: 13, color: t.coal, fontWeight: 600, minWidth: 60, textAlign: "right" }}>
                  {q.score} <span style={{ color: t.inkFaint, fontWeight: 400 }}>/100</span>
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
              </button>
              <div id={panelId} role="region" hidden={!open}>
                {open && <QuestionDetail q={q} />}
              </div>
            </li>
          );
        })}
      </ul>
      {hiddenCount > 0 && (
        <div
          style={{
            borderTop: `1px solid ${t.line}`,
            padding: "14px 28px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            className="ir-cta-ghost"
            onClick={handleExpandAll}
            aria-label={`Show ${hiddenCount} more question${hiddenCount === 1 ? "" : "s"}`}
          >
            Show {hiddenCount} more question{hiddenCount === 1 ? "" : "s"}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}
