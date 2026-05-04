/* Interview-result canvas — local styles.
   Selectors used inside InterviewResult.tsx; consolidated here so the
   storyboard component stays focused on structure + content. */

export const INTERVIEW_RESULT_STYLES = `
  .ir-row { display: flex; gap: 16px; flex-wrap: wrap; }
  .ir-tile-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }
  @media (max-width: 880px) {
    .ir-tile-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  .ir-skill-bar-wrap { position: relative; height: 8px; border-radius: 99px; overflow: visible; }
  .ir-skill-bar-bg { position: absolute; inset: 0; border-radius: 99px; }
  .ir-skill-bar-fg {
    position: absolute; left: 0; top: 0; bottom: 0;
    border-radius: 99px;
    transition: width 600ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .ir-skill-bar-marker {
    position: absolute; top: -3px; height: 14px; width: 2px;
    background: rgba(110, 103, 89, 0.45); border-radius: 1px;
  }
  .ir-q-card-trigger {
    width: 100%; background: transparent; border: none; cursor: pointer;
    padding: 14px 18px; display: flex; align-items: center; gap: 12px;
    text-align: left; font-family: inherit; color: inherit;
  }
  .ir-q-card-trigger:hover { background: rgba(180, 83, 9, 0.04); }
  .ir-highlight-filler { background: rgba(212, 179, 127, 0.30); padding: 1px 3px; border-radius: 3px; }
  .ir-highlight-hedge  { background: rgba(110, 103, 89, 0.18); padding: 1px 3px; border-radius: 3px; }
  .ir-highlight-quant  { background: rgba(21, 128, 61, 0.18); padding: 1px 3px; border-radius: 3px; color: #15803D; font-weight: 600; }
  .ir-highlight-first  { background: rgba(49, 46, 129, 0.10); padding: 1px 3px; border-radius: 3px; color: #312E81; }
  .ir-cta-primary {
    background: #312E81; color: #FAF7F0; border: 1px solid transparent;
    padding: 10px 18px; border-radius: 10px; font-weight: 600; font-size: 13px;
    cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
    transition: background 160ms ease, transform 160ms ease;
  }
  .ir-cta-primary:hover { background: #1E1B4B; transform: translateY(-1px); }
  .ir-cta-ghost {
    background: transparent; color: #312E81; border: 1px solid #EBE5D2;
    padding: 10px 18px; border-radius: 10px; font-weight: 500; font-size: 13px;
    cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
    transition: border-color 160ms ease, background 160ms ease;
  }
  .ir-cta-ghost:hover { border-color: #D6CDB5; background: rgba(255,255,255,0.6); }
  .ir-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 12px; border-radius: 999px;
    background: #FFFFFF; border: 1px solid #EBE5D2;
    font-size: 12px; font-weight: 500;
  }
  .ir-tab-btn {
    background: transparent; border: none; cursor: pointer;
    padding: 8px 0; margin-right: 18px;
    font-family: inherit; font-size: 13px; font-weight: 500; color: #6E6759;
    border-bottom: 2px solid transparent;
    transition: color 160ms, border-color 160ms;
  }
  .ir-tab-btn[aria-selected="true"] { color: #312E81; border-bottom-color: #312E81; }
  .ir-thumb-btn {
    background: transparent; border: 1px solid #EBE5D2; border-radius: 8px;
    padding: 6px 10px; cursor: pointer; color: #6E6759;
    transition: border-color 160ms, color 160ms, background 160ms;
  }
  .ir-thumb-btn:hover { border-color: #B45309; color: #B45309; }
  .ir-thumb-btn.active { background: #F4E5D8; border-color: #B45309; color: #B45309; }

  /* ─── Mobile breakpoints ─── */
  /* The report is desktop-first; below 768px we collapse multi-column
     grids (hero, skills, per-question detail, next-steps) so dense
     content stops overflowing the viewport. The skill bars also
     reflow so the You/Avg labels stack above the row. */
  @media (max-width: 768px) {
    .ir-hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
    .ir-strengths-improvements { grid-template-columns: 1fr !important; gap: 18px !important; }
    .ir-skills-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
    .ir-skill-row {
      grid-template-columns: 1fr 50px 50px !important;
      grid-template-areas:
        "name name name"
        "bar bar bar"
        ".  score delta" !important;
      row-gap: 6px !important;
    }
    .ir-skill-row .ir-skill-name { grid-area: name; }
    .ir-skill-row .ir-skill-bar-wrap { grid-area: bar; }
    .ir-skill-row .ir-skill-score { grid-area: score; }
    .ir-skill-row .ir-skill-delta { grid-area: delta; }
    .ir-pq-detail-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
    .ir-next-steps-grid { grid-template-columns: 1fr !important; }
    .ir-q-trigger-band { display: none !important; }
    .ir-pill-bar { gap: 6px !important; }
  }

  /* ─── Sparkline ─── */
  .ir-spark { vertical-align: middle; }
  .ir-spark-line { stroke: #312E81; stroke-width: 1.5; fill: none; }
  .ir-spark-area { fill: rgba(49, 46, 129, 0.10); }
  .ir-spark-dot { fill: #312E81; }
  .ir-spark-dot-current { fill: #B45309; r: 2.5; }

  /* ─── Feedback survey expansion ─── */
  .ir-feedback-row { display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .ir-feedback-tag {
    background: transparent; border: 1px solid #EBE5D2; border-radius: 999px;
    padding: 5px 12px; cursor: pointer; color: #6E6759;
    font-family: inherit; font-size: 12px; font-weight: 500;
    transition: all 160ms ease;
  }
  .ir-feedback-tag:hover { border-color: #B45309; color: #B45309; }
  .ir-feedback-tag.active { background: #F4E5D8; border-color: #B45309; color: #B45309; }
`;
