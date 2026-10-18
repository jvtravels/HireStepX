import { tokens as t, textSize } from "@/auth/_tokens";

/* Row hover is CSS, not JS handlers, so keyboard focus and touch get
   the same states and nothing re-renders on mouse move.

   Below 768px the table reflows to stacked cards (thead hidden, each row a
   wrapping flex box with per-cell labels). Pure CSS so row state and dialogs
   stay in one component; a mobile-only sort control replaces the hidden
   column headers. */
export const CAND_TABLE_CSS = `
.rq-row { transition: background-color 150ms cubic-bezier(0.25, 1, 0.5, 1); }
.rq-row:hover { background: ${t.rowTint} !important; }
.rq-row[data-selected="true"] { background: ${t.rowTint}; }
.rq-row[data-active="true"] { outline: 2px solid ${t.indigo}; outline-offset: -2px; }
.rq-link:hover { text-decoration: underline !important; }
.rq-link:focus-visible { outline: 2px solid ${t.indigo}; outline-offset: 2px; border-radius: 4px; }
@media (prefers-reduced-motion: reduce) { .rq-row { transition: none; } }
@media (min-width: 768px) {
  .cand-td-act, .cand-th-act { position: sticky; right: 0; z-index: 1; background: ${t.white}; box-shadow: inset 1px 0 0 ${t.line}; }
  .cand-th-act { background: ${t.rowTint}; }
  .rq-row:hover .cand-td-act { background: ${t.rowTint}; }
}
/* Sticky column headers need the table to be wide enough to never scroll sideways: a horizontal scroll
   box would also become the vertical scroll parent and the header would stop following the page. */
@media (min-width: 1240px) {
  .cand-thead th { position: sticky; top: var(--cand-sticky-top, 0px); z-index: 2; background: ${t.rowTint}; box-shadow: inset 0 -1px 0 ${t.line}; }
  .cand-thead .cand-th-act { z-index: 3; box-shadow: inset 1px 0 0 ${t.line}, inset 0 -1px 0 ${t.line}; }
}
@media (max-width: 767px) {
  .cand-shell { border: 0 !important; background: transparent !important; overflow: visible !important; flex: 0 0 auto !important; min-height: auto !important; }
  .cand-scroll { overflow: visible !important; flex: 0 0 auto !important; min-height: auto !important; }
  .cand-shell > div:last-child { background: ${t.white}; border: 1px solid ${t.line}; border-radius: 16px; }
  .cand-table { min-width: 0 !important; }
  .cand-table, .cand-table tbody { display: block; width: 100%; }
  .cand-thead { display: none !important; }
  .cand-tr { display: flex !important; flex-wrap: wrap; align-items: center; gap: 10px 16px; height: auto !important; margin-bottom: 12px; padding: 16px; background: ${t.white}; border: 1px solid ${t.line} !important; border-radius: 16px; }
  .cand-td { display: block; white-space: normal !important; width: auto !important; max-width: none !important; padding: 0 !important; height: auto !important; flex: 0 1 auto; order: 3; font-size: ${textSize.base}px; }
  .cand-td[data-label]::before { content: attr(data-label); display: block; font-size: ${textSize.sm}px; color: ${t.inkFaint}; margin-bottom: 2px; }
  .cand-td[data-label] { align-self: flex-start; }
  .cand-td-name { order: 1; flex: 1 1 140px !important; min-width: 0; }
  .cand-td-act { order: 2; flex: 0 0 auto; margin-left: auto; }
  .cand-td-fit { flex: 1 1 100%; padding-top: 10px !important; border-top: 1px solid ${t.line}; }
}
`;
