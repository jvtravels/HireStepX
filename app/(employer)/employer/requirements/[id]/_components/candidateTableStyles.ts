import type { CSSProperties } from "react";
import { tokens as t, fonts as f, shadows, textSize } from "@/auth/_tokens";

/* Base body-cell style: textSize.base, same secondary-text convention as the
   Jobs and Sessions tables. */
export const tdStyle: CSSProperties = {
  fontFamily: f.sans,
  fontSize: textSize.base,
  color: t.coal,
  verticalAlign: "middle",
};

/* SortableHead renders its own 20px horizontal padding on the sort button, so
   body cells under a sortable column match it or the header text sits 12px
   off from the data below it. */
export const tdSortableStyle: CSSProperties = { ...tdStyle, padding: "0 20px" };

export const HEADER_CELL_STYLE: CSSProperties = {
  fontFamily: f.sans,
  fontSize: textSize.base,
  fontWeight: 600,
  color: t.inkSoft,
};

/* Row hover/selected and link hover are CSS, not JS handlers, so keyboard
   focus and touch get the same states and nothing re-renders on mouse move.

   Below 768px the table reflows to stacked cards (thead hidden, each row a
   wrapping flex box with per-cell labels). Pure CSS so row state and dialogs
   stay in one component; a mobile-only sort control replaces the hidden
   column headers. Coarse pointers get a 44px checkbox hit area. */
export const CAND_TABLE_CSS = `
.rq-row:hover, .rq-row[data-selected] { background: ${t.rowTint} !important; }
.rq-link:hover { text-decoration: underline !important; }
.rq-link:focus-visible { outline: 2px solid ${t.indigo}; outline-offset: 2px; border-radius: 4px; }
@media (pointer: coarse) {
  .rq-chk::after { inset: -14px !important; }
}
@media (max-width: 767px) {
  .cand-shell { border: 0 !important; background: transparent !important; box-shadow: none !important; overflow: visible !important; flex: 0 0 auto !important; min-height: auto !important; }
  .cand-scroll { overflow: visible !important; flex: 0 0 auto !important; min-height: auto !important; }
  .cand-shell > div:last-child { background: ${t.white}; border: 1px solid ${t.line}; border-radius: 16px; box-shadow: ${shadows.card}; }
  .cand-table { min-width: 0 !important; }
  .cand-table, .cand-table tbody { display: block; width: 100%; }
  .cand-thead { display: none !important; }
  .cand-tr { display: flex !important; flex-wrap: wrap; align-items: center; gap: 10px 16px; height: auto !important; margin-bottom: 12px; padding: 16px; background: ${t.white}; border: 1px solid ${t.line} !important; border-radius: 16px; box-shadow: ${shadows.card}; }
  .cand-td { display: block; white-space: normal !important; width: auto !important; max-width: none !important; padding: 0 !important; height: auto !important; flex: 0 1 auto; order: 3; font-size: ${textSize.base}px; }
  .cand-td[data-label]::before { content: attr(data-label); display: block; font-size: ${textSize.sm}px; color: ${t.inkFaint}; margin-bottom: 2px; }
  .cand-td-chk { order: 0; flex: 0 0 auto; }
  .cand-td-name { order: 1; flex: 1 1 140px !important; min-width: 0; }
  .cand-td-act { order: 2; flex: 0 0 auto; }
  .cand-td-skills { flex: 1 1 100%; padding-top: 10px !important; border-top: 1px solid ${t.line}; }
}
`;
