/* Session Report — scoped styles.
   Ported verbatim from `tempo/designs/canvases/interview-result/_styles.ts`.
   All selectors are prefixed with `.ir-` (interview-result) and applied
   only inside the view's root. The block is injected via
   `<style>{SESSION_REPORT_STYLES}</style>` at component-mount so the
   rest of the app (dark-luxury chrome) stays unaffected.

   Print rules + scoped overrides are appended at the end of this
   file so a single source of CSS truth ships with the report. */

export const SESSION_REPORT_STYLES = `
  .ir-row { display: flex; gap: 16px; flex-wrap: wrap; }
  .ir-tile-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }
  @media (max-width: 880px) {
    .ir-tile-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 480px) {
    .ir-tile-grid { grid-template-columns: 1fr; gap: 10px; }
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
    font-family: inherit; font-size: 13px; font-weight: 500; color: #5A5448;
    border-bottom: 2px solid transparent;
    transition: color 160ms, border-color 160ms;
  }
  .ir-tab-btn[aria-selected="true"] { color: #B45309; border-bottom-color: #B45309; }
  .ir-thumb-btn {
    background: transparent; border: 1px solid #EBE5D2; border-radius: 8px;
    padding: 6px 10px; cursor: pointer; color: #5A5448;
    transition: border-color 160ms, color 160ms, background 160ms;
  }
  .ir-thumb-btn:hover { border-color: #B45309; color: #B45309; }
  .ir-thumb-btn.active { background: #F4E5D8; border-color: #B45309; color: #B45309; }

  /* ─── Salary Negotiation full-report panels ───
     The salary-negotiation interview focus has its own dedicated
     surface: a multi-panel deep-dive that turns each negotiation
     skill into a measurable signal. Lives in NegotiationFullReport.tsx
     and renders only for sessions whose interviewType === salary-neg. */
  .nfr-section-band {
    display: flex; align-items: center; gap: 16px;
    padding: 18px 24px; border-radius: 12px;
    margin: 24px 0 18px; border: 1px solid #EBE5D2;
  }
  .nfr-grid-2up {
    display: grid; grid-template-columns: 1fr 1fr; gap: 18px;
  }
  .nfr-grid-3up {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
  }
  .nfr-panel {
    background: #FFFFFF; border: 1px solid #EBE5D2;
    border-radius: 14px; padding: 22px;
    box-shadow: 0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04);
  }
  /* ─── TL;DR (2026-05-26 editorial rework) ───
     Prior implementation: dark gradient card with a 4-up grid of
     26px mono numbers. Visually loud, semantically inverted (the
     verdict sentence is the useful payload, not the metrics) — and
     a textbook example of the "hero-metric template" banned by
     this project's design system.
     New shape: a pull-quote-grade serif verdict carries the visual
     weight, and the metrics sit beneath as a quiet 2-up label/value
     lockup divided by hairlines. Lives on cream like the rest of
     the report; the dark hero was a category-reflex outlier in an
     editorial surface. */
  .nfr-tldr {
    margin-bottom: 28px;
    border-top: 1px solid #B45309;
    border-bottom: 1px solid #EBE5D2;
    padding: 22px 0 26px;
  }
  .nfr-tldr-eyebrow {
    font-size: 10px; font-weight: 700; letter-spacing: 1.5px;
    text-transform: uppercase; font-family: 'JetBrains Mono', monospace;
    color: #B45309;
    margin-bottom: 14px;
  }
  .nfr-tldr-verdict {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 30px; line-height: 1.25; font-weight: 400;
    color: #0E0C08; letter-spacing: -0.4px;
    max-width: 760px;
    margin: 0 0 22px;
  }
  .nfr-tldr-evidence {
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 4px 32px;
  }
  .nfr-tldr-evidence-row {
    display: grid; grid-template-columns: minmax(140px, 1fr) auto;
    align-items: baseline; gap: 14px;
    padding: 12px 0;
    border-top: 1px solid #EBE5D2;
  }
  .nfr-tldr-evidence-label {
    font-size: 12px; color: #5A5448; line-height: 1.4;
  }
  .nfr-tldr-evidence-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 17px; font-weight: 700; letter-spacing: -0.2px;
    white-space: nowrap;
  }
  .nfr-tldr-evidence-hint {
    grid-column: 1 / -1;
    font-size: 11px; color: #888070; line-height: 1.4;
    margin-top: 2px;
  }
  .nfr-tldr-tone-good    { color: #15803D; }
  .nfr-tldr-tone-warn    { color: #B45309; }
  .nfr-tldr-tone-bad     { color: #B91C1C; }
  .nfr-tldr-tone-neutral { color: #0E0C08; }
  .nfr-time-pill {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 8px; background: #E5E2F2; color: #312E81;
    border-radius: 5px; font-family: 'JetBrains Mono', monospace;
    font-size: 11px; font-weight: 600;
    border: 1px solid #E5E2F2;
  }
  /* Screen-reader-only utility — visually hidden, available to
     assistive tech. Used to add "at ..." context to bare time-
     stamp pills so they don't read as bare numbers. */
  .sr-only {
    position: absolute !important;
    width: 1px !important; height: 1px !important;
    padding: 0 !important; margin: -1px !important;
    overflow: hidden !important; clip: rect(0,0,0,0) !important;
    white-space: nowrap !important; border: 0 !important;
  }
  /* Visible keyboard focus ring — applied to every actually-
     interactive surface in the report. Uses the indigo accent at
     2px to read at a glance on cream. */
  .nfr-anchor:focus-visible,
  .nfr-btn-primary:focus-visible,
  .nfr-btn-secondary:focus-visible {
    outline: 2px solid #312E81;
    outline-offset: 2px;
    border-radius: 6px;
  }
  .nfr-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .nfr-table th {
    padding: 11px 14px; font-size: 10px; font-weight: 700;
    letter-spacing: 0.8px; text-transform: uppercase;
    color: #5A5448; text-align: left; background: #F4EFE3;
  }
  .nfr-table td { padding: 11px 14px; font-size: 13px; color: #0E0C08; }
  .nfr-table tr { border-top: 1px solid #EBE5D2; }
  .nfr-table tr:first-child { border-top: none; }
  .nfr-mono { font-family: 'JetBrains Mono', monospace; }
  .nfr-pill {
    display: inline-block; padding: 3px 10px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.4px;
    border-radius: 6px; text-transform: uppercase;
  }
  .nfr-pill-good { background: #DCFCE7; color: #15803D; }
  .nfr-pill-bad  { background: #FEE2E2; color: #B91C1C; }
  .nfr-pill-warn { background: rgba(180,83,9,0.12); color: #B45309; }
  .nfr-pill-neutral { background: #F4EFE3; color: #0E0C08; }

  /* ─── Shared NFR primitives (2026-05-26 audit) ───
     Three shapes carry most repeated chrome across the 15 panels:
     info tiles (cream callouts), tone cards (event rows colored by
     good/warn/bad), and small mono uppercase eyebrow labels. The
     prior implementation rolled all three inline-styled at every
     call site AND used a 3px colored border-left as the tone accent
     — a side-stripe pattern the design system bans. These classes
     replace all three with full 1px tone-tinted borders + faint
     tone-tinted backgrounds + a leading dot for tone cards. */
  .nfr-info-tile {
    padding: 14px 16px;
    background: #F4EFE3;
    border: 1px solid #EBE5D2;
    border-radius: 10px;
    font-size: 13px;
    color: #5A5448;
    line-height: 1.55;
  }
  .nfr-info-tile-compact { padding: 10px 14px; font-size: 12px; }
  .nfr-info-tile-roomy   { padding: 16px 18px; }
  .nfr-tone-card {
    display: grid;
    grid-template-columns: auto 1fr auto;
    column-gap: 12px;
    align-items: center;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid;
    background: transparent;
  }
  .nfr-tone-card-good { border-color: rgba(21,128,61,0.30);  background: rgba(21,128,61,0.06); }
  .nfr-tone-card-warn { border-color: rgba(180,83,9,0.30);   background: rgba(180,83,9,0.06); }
  .nfr-tone-card-bad  { border-color: rgba(185,28,28,0.28);  background: rgba(185,28,28,0.05); }
  .nfr-tone-dot {
    width: 8px; height: 8px; border-radius: 999px;
    align-self: center; flex-shrink: 0;
  }
  .nfr-tone-dot-good { background: #15803D; }
  .nfr-tone-dot-warn { background: #B45309; }
  .nfr-tone-dot-bad  { background: #B91C1C; }
  .nfr-eyebrow {
    font-size: 10px; font-weight: 700; letter-spacing: 0.8px;
    text-transform: uppercase;
    font-family: 'JetBrains Mono', monospace;
    color: #5A5448;
  }
  .nfr-quote {
    padding: 12px 14px;
    background: #F4EFE3;
    border: 1px solid #EBE5D2;
    border-radius: 10px;
    font-size: 13px;
    color: #0E0C08;
    font-style: italic;
  }

  /* Vertical stack utility (2026-05-28). Eight panels were inlining
     the identical display:flex + flex-direction:column + gap:N
     three-property style object with N in {6,8,10,18}. The size
     variants map to the spacing scale in tokens.ts so a future
     tightening of the rhythm only touches one place. */
  .nfr-vstack    { display: flex; flex-direction: column; gap: 10px; }
  .nfr-vstack-sm { gap: 6px; }
  .nfr-vstack-md { gap: 8px; }
  .nfr-vstack-lg { gap: 14px; }
  .nfr-vstack-xl { gap: 18px; }

  /* Table-total row modifier (2026-05-28). Pairs with .nfr-table for
     the NPVMathPanel "today's rupees" highlighted final row — the
     prior implementation hand-rolled the cream wash + bold label +
     larger mono value inline. */
  .nfr-table-total td {
    background: #F4EFE3;
    font-weight: 700;
    color: #0E0C08;
  }
  .nfr-table-total .nfr-table-total-value {
    font-size: 16px;
    font-weight: 800;
  }

  .nfr-letter-actions {
    display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap;
  }
  .nfr-btn-primary {
    padding: 10px 18px; background: #312E81; color: #FFFFFF;
    border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
    cursor: pointer; font-family: inherit;
  }
  .nfr-btn-primary:hover { background: #1E1B4B; }
  .nfr-btn-secondary {
    padding: 10px 18px; background: transparent; color: #0E0C08;
    border: 1px solid #D6CDB5; border-radius: 8px;
    font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
  }
  .nfr-btn-secondary:hover { border-color: #312E81; color: #312E81; }
  .nfr-start-here {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 18px; margin-bottom: 16px;
    background: rgba(180,83,9,0.08); border: 1px solid rgba(180,83,9,0.20);
    border-radius: 10px; font-size: 13px; color: #0E0C08;
  }

  /* Mobile reflow for the negotiation panels — single column at <=768px,
     tighter padding at <=420px. Mirrors the production pattern used
     elsewhere in this file. */
  @media (max-width: 768px) {
    .nfr-grid-2up { grid-template-columns: 1fr !important; gap: 14px !important; }
    .nfr-grid-3up { grid-template-columns: 1fr !important; gap: 12px !important; }
    .nfr-panel { padding: 18px !important; border-radius: 12px !important; }
    .nfr-tldr { padding: 18px 0 20px !important; }
    .nfr-tldr-verdict { font-size: 24px !important; line-height: 1.3 !important; }
    .nfr-tldr-evidence { grid-template-columns: 1fr !important; gap: 0 !important; }
    .nfr-tldr-evidence-value { font-size: 15px !important; }
    .nfr-section-band { padding: 14px 16px !important; gap: 12px !important; }
    .nfr-table th, .nfr-table td { padding: 8px 10px !important; font-size: 12px !important; }
    .nfr-table th { font-size: 9px !important; }
    .nfr-table-wrap { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }
  }
  @media (max-width: 420px) {
    .nfr-tldr-verdict { font-size: 21px !important; }
    .nfr-letter-actions { flex-direction: column !important; }
    .nfr-btn-primary, .nfr-btn-secondary { width: 100% !important; }
    /* Phase rail is decorative at narrow widths — pill list below carries the same info more legibly */
    .nfr-phase-rail { display: none !important; }
  }

  /* ─── Mobile breakpoints ─── */
  /* The report is desktop-first; below 768px we collapse multi-column
     grids (hero, skills, per-question detail, next-steps) so dense
     content stops overflowing the viewport. The skill bars also
     reflow so the You/Avg labels stack above the row. */
  @media (max-width: 768px) {
    .ir-hero-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
    .ir-hero-grid > * { min-width: 0 !important; }
    .ir-jump-nav { margin-left: -16px !important; margin-right: -16px !important; }
    .ir-jump-nav-inner { padding: 0 16px !important; }
    .ir-skill-name { min-width: 0 !important; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ir-trend-strip { gap: 12px !important; padding: 12px 14px !important; }
    .ir-coach-notes-grid { grid-template-columns: 1fr !important; }
    .ir-bias-grid { grid-template-columns: 1fr !important; }
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
    /* Metrics strip stays horizontal but allows tighter wrap on phones. */
    .ir-pq-metrics-strip { gap: 12px !important; padding: 10px 12px !important; }
    .ir-next-steps-grid { grid-template-columns: 1fr !important; }
    .ir-q-trigger-band { display: none !important; }
    .ir-pill-bar { gap: 6px !important; }
  }
  @media (max-width: 420px) {
    .ir-skill-row {
      grid-template-columns: 1fr 42px 42px !important;
      column-gap: 6px !important;
    }
    .ir-cta-primary, .ir-cta-ghost { padding: 9px 12px !important; font-size: 12px !important; }
    .ir-pill { padding: 5px 10px !important; font-size: 11px !important; }
    .ir-tab-btn { margin-right: 12px !important; font-size: 12px !important; }
    .ir-trend-strip { padding: 10px 12px !important; gap: 10px !important; }
    .ir-thought-track { height: 22px !important; }
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
    padding: 5px 12px; cursor: pointer; color: #5A5448;
    font-family: inherit; font-size: 12px; font-weight: 500;
    transition: all 160ms ease;
  }
  .ir-feedback-tag:hover { border-color: #B45309; color: #B45309; }
  .ir-feedback-tag.active { background: #F4E5D8; border-color: #B45309; color: #B45309; }

  /* ─── Accessibility — focus rings + skip link ───
     Every interactive element gets a visible focus ring so keyboard
     users can see where they are. The :focus-visible variant only
     paints when the user is actually navigating with a keyboard
     (not on mouse click), so we don't pollute the visual on-click. */
  .ir-cta-primary:focus-visible,
  .ir-cta-ghost:focus-visible,
  .ir-tab-btn:focus-visible,
  .ir-thumb-btn:focus-visible,
  .ir-feedback-tag:focus-visible,
  .ir-q-card-trigger:focus-visible,
  .ir-jump-link:focus-visible {
    outline: 2px solid #312E81;
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(49, 46, 129, 0.15);
  }
  .ir-skip-link {
    position: absolute;
    left: -9999px;
    top: 8px;
    padding: 8px 16px;
    background: #312E81;
    color: #FAF7F0;
    text-decoration: none;
    border-radius: 8px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    z-index: 100;
  }
  .ir-skip-link:focus {
    left: 8px;
    outline: 2px solid #B45309;
    outline-offset: 2px;
  }

  /* ─── Reduced motion ───
     Users who set prefers-reduced-motion (system pref or
     vestibular-disorder accommodation) get all animations disabled.
     Static fills replace the bar-fill transitions; we don't suppress
     state changes, just kinetic transitions. */
  @media (prefers-reduced-motion: reduce) {
    .ir-skill-bar-fg,
    .ir-cta-primary,
    .ir-cta-ghost,
    .ir-tab-btn,
    .ir-thumb-btn,
    .ir-feedback-tag,
    .ir-jump-link {
      transition: none !important;
    }
    .ir-cta-primary:hover { transform: none !important; }
  }

  /* ─── Section navigation ───
     Sticky jump-to-section row at the top of <main>. Lets users
     skip directly to the section they care about — for power users
     reviewing their 5th report this beats scrolling past every
     section. Indigo underline on the active anchor. */
  .ir-jump-nav {
    position: sticky;
    top: 0;
    z-index: 10;
    background: rgba(250, 247, 240, 0.92);
    backdrop-filter: saturate(140%) blur(8px);
    -webkit-backdrop-filter: saturate(140%) blur(8px);
    border-bottom: 1px solid #EBE5D2;
    padding: 10px 0;
    margin: 0 -32px 16px;
  }
  .ir-jump-nav-inner {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding: 0 32px;
    scrollbar-width: none;
  }
  .ir-jump-nav-inner::-webkit-scrollbar { display: none; }
  .ir-jump-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    color: #5A5448;
    text-decoration: none;
    white-space: nowrap;
    transition: color 160ms, background 160ms;
  }
  .ir-jump-link:hover { color: #312E81; background: #E5E2F2; }
  .ir-jump-link-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #888070;
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  /* ─── Section eyebrow numbers ───
     Each section card has a small "01" / "02" / "03" eyebrow so the
     user has a sense of progression. Mono font, copper accent,
     tightly tracked. */
  .ir-section-eyebrow {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  .ir-section-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    color: #B45309;
    letter-spacing: 0.10em;
  }
  .ir-section-rule {
    flex: 1;
    height: 1px;
    background: #EBE5D2;
  }

  /* ─── Calibration banner ───
     Sits under the verdict pill. Single-line context for what
     "Hire" actually means at this company/level — turns the abstract
     verdict into a calibrated rubric users can defend. */
  .ir-calibration {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(49,46,129,0.05);
    border: 1px solid rgba(49,46,129,0.12);
    border-radius: 8px;
    font-family: 'Satoshi', sans-serif;
    font-size: 12px;
    color: #312E81;
    line-height: 1.4;
  }
  .ir-calibration-bands {
    color: #5A5448;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
  }

  /* ─── Score-confidence chip ───
     Conditional. Only fires when scoreConfidence isn't "high" so users
     understand the LLM is hedging on this particular session. Sits
     adjacent to the verdict pill, copper-tinted to read as caution. */
  .ir-confidence-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(180,83,9,0.08);
    color: #B45309;
    border: 1px dashed rgba(180,83,9,0.40);
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* ─── Trend strip ───
     One-line cross-session deltas between hero and core metrics.
     Renders only when priorSessionCount >= 3. Gives users a "are
     things getting better?" answer without scrolling. */
  .ir-trend-strip {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 14px 22px;
    background: linear-gradient(90deg, rgba(49,46,129,0.04), rgba(212,179,127,0.04));
    border: 1px solid #EBE5D2;
    border-radius: 12px;
    flex-wrap: wrap;
  }
  .ir-trend-eyebrow {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    color: #B45309;
    letter-spacing: 0.10em;
    text-transform: uppercase;
  }
  .ir-trend-item {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    font-family: 'Satoshi', sans-serif;
    font-size: 13px;
    color: #2A241B;
  }
  .ir-trend-item-label { color: #5A5448; font-size: 12px; }
  .ir-trend-delta-up   { color: #15803D; font-weight: 600; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
  .ir-trend-delta-down { color: #B91C1C; font-weight: 600; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
  .ir-trend-delta-flat { color: #888070; font-weight: 600; font-family: 'JetBrains Mono', monospace; font-size: 12px; }

  /* ─── Per-Q inline pills (frequency + length verdict) ─── */
  .ir-q-meta-pill {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    background: #FFFFFF;
    border: 1px solid #EBE5D2;
    color: #5A5448;
  }
  .ir-q-meta-pill.too-short  { color: #B91C1C; border-color: rgba(196,112,90,0.30); background: rgba(196,112,90,0.06); }
  .ir-q-meta-pill.too-long   { color: #B45309; border-color: rgba(180,83,9,0.30);  background: rgba(180,83,9,0.06); }
  .ir-q-meta-pill.just-right { color: #15803D; border-color: rgba(21,128,61,0.30); background: rgba(21,128,61,0.06); }
  .ir-q-meta-pill.high-freq  { color: #B45309; border-color: rgba(180,83,9,0.30);  background: rgba(180,83,9,0.06); }

  /* Red-flag inline badge (count, on the trigger row) */
  .ir-q-redflag-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(196,112,90,0.10);
    color: #B91C1C;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  /* Red-flag list inside the expanded panel (coach column) */
  .ir-redflag-list { list-style: none; padding: 0; margin: 0 0 8px; display: flex; flex-direction: column; gap: 6px; }
  .ir-redflag-item {
    display: flex; gap: 8px; align-items: flex-start;
    padding: 8px 10px;
    background: rgba(196,112,90,0.05);
    border-left: 2px solid #B91C1C;
    border-radius: 4px;
    font-family: 'Satoshi', sans-serif;
    font-size: 12px;
    line-height: 1.45;
    color: #2A241B;
  }
  .ir-redflag-item-title { color: #B91C1C; font-weight: 600; }
  .ir-redflag-item-quote { color: #5A5448; font-style: italic; display: block; margin-top: 2px; }

  /* Likely follow-up callout (coach column, weak/partial only) */
  .ir-likely-followup {
    margin-top: 8px;
    padding: 10px 12px;
    background: rgba(49,46,129,0.05);
    border: 1px solid rgba(49,46,129,0.15);
    border-radius: 8px;
    font-family: 'Satoshi', sans-serif;
    font-size: 12px;
    color: #312E81;
    line-height: 1.5;
  }
  .ir-likely-followup-eyebrow {
    display: block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 4px;
    color: #312E81;
  }

  /* What-makes-it-strong list (under exemplar tab) */
  .ir-strong-list { list-style: none; padding: 0; margin: 12px 0 0; display: flex; flex-direction: column; gap: 6px; }
  .ir-strong-list-item {
    display: flex; gap: 8px;
    font-family: 'Satoshi', sans-serif;
    font-size: 13px;
    color: #2A241B;
    line-height: 1.5;
  }
  .ir-strong-list-marker {
    flex-shrink: 0;
    margin-top: 6px;
    width: 5px; height: 5px;
    border-radius: 50%;
    background: #15803D;
  }

  /* ─── Coach's Notes section (cross-session aggregator) ─── */
  .ir-coach-notes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 14px;
  }
  .ir-coach-note-card {
    background: #FAF7F0;
    border: 1px solid #EBE5D2;
    border-left: 3px solid #B45309;
    border-radius: 10px;
    padding: 14px 16px;
  }
  .ir-coach-note-eyebrow {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: #B45309;
    margin-bottom: 6px;
  }
  .ir-coach-note-title {
    font-family: 'Instrument Serif', serif;
    font-size: 16px;
    color: #2A241B;
    line-height: 1.3;
    margin: 0 0 6px;
  }
  .ir-coach-note-body {
    font-family: 'Satoshi', sans-serif;
    font-size: 13px;
    color: #5A5448;
    line-height: 1.55;
    margin: 0;
  }
  .ir-coach-note-card.regression { border-left-color: #B91C1C; }
  .ir-coach-note-card.regression .ir-coach-note-eyebrow { color: #B91C1C; }
  .ir-coach-note-card.persistent { border-left-color: #B45309; }
  .ir-coach-note-card.story-reuse { border-left-color: #312E81; }
  .ir-coach-note-card.story-reuse .ir-coach-note-eyebrow { color: #312E81; }
  .ir-coach-note-card.blind-spot { border-left-color: #888070; }
  .ir-coach-note-card.blind-spot .ir-coach-note-eyebrow { color: #5A5448; }

  /* ─── Thought-bubble timeline (collapsed by default) ─── */
  .ir-thought-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 1px dashed #D6CDB5;
    border-radius: 8px;
    padding: 8px 14px;
    font-family: 'Satoshi', sans-serif;
    font-size: 12px;
    color: #5A5448;
    cursor: pointer;
    transition: border-color 160ms, color 160ms;
  }
  .ir-thought-toggle:hover { border-color: #312E81; color: #312E81; }
  .ir-thought-track {
    display: flex;
    height: 28px;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid #EBE5D2;
    margin-top: 12px;
  }
  .ir-thought-seg-engaged   { background: rgba(21,128,61,0.40); }
  .ir-thought-seg-drifting  { background: rgba(212,179,127,0.55); }
  .ir-thought-seg-concerned { background: rgba(196,112,90,0.50); }
  .ir-thought-legend {
    display: flex; gap: 18px; flex-wrap: wrap;
    margin-top: 10px;
    font-family: 'Satoshi', sans-serif;
    font-size: 11px;
    color: #5A5448;
  }
  .ir-thought-legend-swatch {
    display: inline-block;
    width: 12px; height: 12px;
    border-radius: 3px;
    margin-right: 6px;
    vertical-align: -2px;
  }

  /* ─── Anchor scroll spacing for inline jumps from wins/fixes ─── */
  .ir-q-anchor { scroll-margin-top: 80px; }

  /* ─── Bias / perception-optimizer panel ─── */
  .ir-bias-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
    margin-top: 14px;
  }
  .ir-bias-card {
    background: rgba(49,46,129,0.04);
    border: 1px solid rgba(49,46,129,0.12);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .ir-bias-card-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
  .ir-bias-count {
    font-family: 'JetBrains Mono', monospace;
    font-size: 18px; font-weight: 700; color: #312E81; line-height: 1;
  }
  .ir-bias-label {
    font-family: 'Satoshi', 'Inter', sans-serif;
    font-size: 13px; color: #2A241B; font-weight: 600;
  }
  .ir-bias-example {
    display: block;
    font-family: 'Satoshi', 'Inter', sans-serif;
    font-size: 11px; color: #5A5448; font-style: italic;
    margin: 4px 0 6px;
  }
  .ir-bias-tip {
    font-family: 'Satoshi', 'Inter', sans-serif;
    font-size: 12px; color: #312E81; line-height: 1.4;
  }

  /* ─── Trust + useful dual polls (footer) ─── */
  .ir-poll-row {
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    font-family: 'Satoshi', 'Inter', sans-serif;
    font-size: 12px; color: #5A5448;
  }
  .ir-poll-yes, .ir-poll-no {
    background: transparent;
    border: 1px solid #EBE5D2;
    border-radius: 999px;
    padding: 4px 12px;
    cursor: pointer;
    font-family: inherit; font-size: 12px; color: #5A5448;
    transition: all 160ms;
  }
  .ir-poll-yes:hover, .ir-poll-no:hover { border-color: #B45309; color: #B45309; }
  .ir-poll-yes.active, .ir-poll-no.active { background: #F4E5D8; border-color: #B45309; color: #B45309; font-weight: 600; }

  /* ─── Print styles ───
     PDF generation goes through window.print(). We hide chrome (jump
     nav, header buttons, sticky CTAs, footer thumbs) and force every
     expandable section open so the printed report is complete. */
  @media print {
    body { background: #FFFFFF !important; }
    .ir-jump-nav, .ir-skip-link, .ir-print-hide, .ir-thought-toggle,
    .ir-feedback-row, .ir-thumb-btn, .ir-cta-primary, .ir-cta-ghost,
    .ir-q-card-trigger svg:last-child {
      display: none !important;
    }
    .ir-q-card-trigger { pointer-events: none; }
    [role="region"][hidden] { display: block !important; }
    [hidden] { display: revert !important; }
    section { break-inside: avoid; page-break-inside: avoid; }
  }
`;
