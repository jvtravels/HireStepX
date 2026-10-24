export const homeCss = `
@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } }
::view-transition-old(root), ::view-transition-new(root) { animation-duration: .16s; }
.hx-nav { view-transition-name: hx-nav; }
@font-face { font-family: 'Bricolage Grotesque'; src: url('/fonts/bricolage-500.woff2') format('woff2'); font-weight: 500; font-display: swap; }
@font-face { font-family: 'Bricolage Grotesque'; src: url('/fonts/bricolage-600.woff2') format('woff2'); font-weight: 600; font-display: swap; }
@font-face { font-family: 'Bricolage Grotesque'; src: url('/fonts/bricolage-700.woff2') format('woff2'); font-weight: 700; font-display: swap; }
.hx {
  --paper: oklch(1 0 0);
  --wash: oklch(0.972 0.008 285);
  --line: oklch(0.915 0.012 285);
  --line-2: oklch(0.85 0.018 285);
  --ink: oklch(0.2 0.03 280);
  --ink-2: oklch(0.43 0.03 280);
  --ink-3: oklch(0.5 0.03 280);
  --btn: oklch(0.359 0.135 278.697);
  --btn-hover: oklch(0.257 0.086 281.288);
  --accent: oklch(0.62 0.19 38);
  --accent-ink: oklch(0.5 0.17 38);
  --accent-tint: oklch(0.96 0.03 48);
  --white: oklch(1 0 0);
  font-family: var(--font-ui), ui-sans-serif, system-ui, sans-serif;
  background: var(--paper); color: var(--ink); font-size: 16px; line-height: 1.5;
  -webkit-font-smoothing: antialiased; font-variant-numeric: tabular-nums; width: 100%; container-type: inline-size; overflow: clip;
}
.hx *, .hx *::before, .hx *::after { box-sizing: border-box; }
.hx :where(a) { color: inherit; text-decoration: none; }
.hx .hx-btn, .hx .hx-btn:hover, .hx .hx-btn:focus, .hx .hx-ghost, .hx .hx-ghost:hover, .hx .hx-logo, .hx .hx-links a, .hx .hx-links a:hover, .hx .hx-foot a, .hx .hx-foot a:hover { text-decoration: none; }
.hx :where(h1, h2, h3, p, ul, ol, dl, dd) { margin: 0; }
.hx a:focus-visible, .hx button:focus-visible, .hx summary:focus-visible { outline: 2px solid var(--btn); outline-offset: 3px; border-radius: 6px; }
.hx-wrap { max-width: 1240px; margin: 0 auto; padding: 0 40px; }

.hx-nav { position: sticky; top: 0; z-index: 40; background: oklch(1 0 0); border-bottom: 1px solid var(--line); }
.hx-nav-in { display: flex; align-items: center; justify-content: space-between; height: 64px; }
.hx-logo img { height: 24px; width: auto; display: block; }
.hx-links { display: flex; gap: 32px; font-size: 15px; color: var(--ink-2); }
.hx-links a:hover { color: var(--ink); }
.hx-nav-cta { display: flex; align-items: center; gap: 8px; }
.hx-burger { display: none; width: 44px; height: 44px; margin-right: -10px; border: 0; background: none; color: var(--ink); border-radius: 10px; cursor: pointer; place-items: center; }
.hx-burger:focus-visible { outline: 2px solid var(--btn); outline-offset: 2px; }
.hx-menu { display: none; }
.hx-bsvg path { transform-box: view-box; transform-origin: 12px 12px; transition: transform .3s cubic-bezier(.22,1,.36,1), opacity .2s; }
.hx-bsvg.on .hx-b1 { transform: translateY(5px) rotate(45deg); }
.hx-bsvg.on .hx-b2 { opacity: 0; transform: scaleX(.2); }
.hx-bsvg.on .hx-b3 { transform: translateY(-5px) rotate(-45deg); }
@media (prefers-reduced-motion: reduce) { .hx-bsvg path { transition: none; } }
.hx-ghost { font-size: 15px; color: var(--ink-2); padding: 10px 12px; }

.hx-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 20px; border-radius: 10px; font-size: 15px; font-weight: 500; background: var(--btn); color: var(--white); transition: background .15s, box-shadow .15s; box-shadow: 0 1px 2px oklch(0.257 0.086 281.288 / 0.2); }
.hx-btn:hover { background: var(--btn-hover); }
.hx-btn.sm { min-height: 38px; padding: 0 16px; font-size: 15px; }
.hx-btn.lg { min-height: 54px; padding: 0 28px; font-size: 16px; border-radius: 12px; }
.hx-btn.alt { background: var(--white); color: var(--ink); border: 1px solid var(--line-2); box-shadow: none; }
.hx-btn.alt:hover { background: var(--wash); border-color: var(--ink-3); }
.hx-btn.light { background: var(--white); color: var(--btn); box-shadow: none; }
.hx-btn.light:hover { background: var(--wash); }
.hx-btn.ghosty { background: transparent; color: var(--white); border: 1px solid oklch(0.995 0.004 285 / 0.45); box-shadow: none; }
.hx-btn.ghosty:hover { background: oklch(0.995 0.004 285 / 0.12); }
.hx-btn svg { width: 14px; height: 14px; }
.hx-btn:active, .hx-fix:active { transform: translateY(1px); }

.hx-kicker::before { content: ''; display: inline-block; width: 11px; height: 11px; margin-right: 8px; vertical-align: -1px; background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath fill='%236b6a8c' d='M0 0h2.6L6 3.4 9.4 0H12L7.3 4.7 6 3.4 4.7 4.7zM0 12h2.6L6 8.6 9.4 12H12L7.3 7.3 6 8.6 4.7 7.3z'/%3E%3C/svg%3E") no-repeat center / contain; }
.hx-kicker { font-family: var(--font-mono), ui-monospace, monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-3); }
.hx-q { padding-bottom: 20px; margin-bottom: 20px; border-bottom: 1px solid var(--line); }
.hx-panel .hx-q p { margin-top: 8px; font-size: 20px; line-height: 1.35; font-weight: 500; letter-spacing: -0.01em; color: var(--ink); }
.hx-h1 { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; font-size: 64px; line-height: 1.04; letter-spacing: -0.03em; font-weight: 600; margin-top: 96px; text-align: center; text-wrap: balance; }
.hx-lede { margin: 12px auto 0; font-size: 16px; line-height: 1.5; color: var(--ink-2); max-width: 60ch; text-align: center; text-wrap: pretty; }
.hx-cta { display: flex; justify-content: center; gap: 12px; margin-top: 36px; flex-wrap: wrap; }
.hx-h2 { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; font-size: 40px; line-height: 1.08; letter-spacing: -0.03em; font-weight: 600; text-wrap: balance; }
.hx-h1 b, .hx-h2 b { font-weight: inherit; letter-spacing: inherit; }
.hx-h2.hx-wide { max-width: 16ch; }

.hx-stage { margin-top: 64px; padding: 40px 48px 32px; border-radius: 28px; border: 1px solid var(--line); background: linear-gradient(135deg, oklch(0.945 0.04 55) 0%, oklch(0.95 0.035 320) 50%, oklch(0.935 0.045 285) 100%); }
.hx-stage-cool { margin-top: 48px; padding: 48px; background: linear-gradient(135deg, oklch(0.935 0.045 285) 0%, oklch(0.95 0.035 320) 55%, oklch(0.945 0.04 55) 100%); }
.hx-stage-warm { margin-top: 48px; padding: 48px; background: linear-gradient(135deg, oklch(0.945 0.04 55) 0%, oklch(0.95 0.035 320) 50%, oklch(0.935 0.045 285) 100%); }
.hx-stage-cap { text-align: center; font-size: 15px; color: var(--ink); margin-bottom: 28px; }
.hx-stage-cap b { font-weight: 600; }
.hx-doors { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: stretch; }
.hx-door { display: flex; flex-direction: column; gap: 14px; }
.hx-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--line); border-radius: 16px; background: var(--white); box-shadow: 0 1px 2px oklch(0.2 0.03 280 / 0.04), 0 8px 16px -4px oklch(0.2 0.03 280 / 0.05); transition: box-shadow .2s cubic-bezier(0.16, 1, 0.3, 1); }
.hx-panel p { font-size: 15px; }
.hx-panel [class*="bubble"], .hx-panel [class*="Bubble"] { font-size: 15px; line-height: 1.5; }
.hx-record { margin-top: 12px; padding: 14px 16px; border-radius: 10px; background: var(--wash); display: grid; gap: 6px; }
.hx-record p { color: var(--ink); font-size: 15px; line-height: 1.5; }
.hx-score { display: grid; grid-template-columns: auto 1fr; gap: 24px; align-items: center; margin-top: auto; padding-top: 20px; border-top: 1px solid var(--line); }
.hx-score svg { width: 160px; height: auto; }
.hx-star { list-style: none; padding: 0; margin: 0; display: grid; }
.hx-star li { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 500; padding: 9px 0; border-bottom: 1px solid var(--line); }
.hx-star li:last-child { border-bottom: 0; }
.hx-star i { width: 8px; height: 8px; border-radius: 50%; background: var(--ink-3); }
.hx-star span { margin-left: auto; font-size: 13px; font-weight: 400; color: var(--ink-3); }
.hx-star .miss { color: var(--ink); }
.hx-star .miss i { background: var(--accent); }
.hx-star .miss span { color: var(--accent-ink); }
.hx-fix { min-height: 36px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--btn); background: var(--btn); color: var(--white); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; transition: background .15s; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.hx-ah { display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 20px; border-bottom: 1px solid var(--line); background: var(--wash); font-size: 13px; font-weight: 500; color: var(--ink); }
.hx-ah i { width: 3px; height: 3px; border-radius: 50%; background: var(--ink-3); }
.hx-ah span:nth-of-type(2) { color: var(--ink-2); font-weight: 400; }
.hx-ah em { margin-left: auto; font-style: normal; font-family: var(--font-mono), ui-monospace, monospace; font-size: 12px; font-weight: 400; color: var(--ink-3); }
.hx-ab { flex: 1; padding: 20px; display: flex; flex-direction: column; }
.hx-af { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 20px; border-top: 1px solid var(--line); background: var(--wash); font-size: 13px; color: var(--ink-2); }
.hx-panel .hx-qt { font-size: 18px; line-height: 1.35; font-weight: 500; letter-spacing: -0.01em; color: var(--ink); margin-bottom: 16px; }
.hx-fix:hover { background: var(--btn-hover); }
.hx-note { margin-top: 16px; font-size: 14px !important; color: var(--ink-3); }

.hx-hero { padding-bottom: 96px; }

.hx-h2.hx-wide { margin-top: 14px; }
.hx-wave { display: grid; gap: 14px; justify-items: center; }
.hx-rec { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-2); background: var(--white); border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px; }
.hx-rec i { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
.hx-wave div { display: flex; align-items: center; gap: 4px; height: 40px; }
.hx-wave b { width: 4px; border-radius: 2px; background: var(--ink-3); display: block; }
.hx-mini-score { display: flex; align-items: center; gap: 14px; }
.hx-mini-score ul { list-style: none; padding: 0; display: flex; gap: 6px; }
.hx-mini-score li { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; font-size: 13px; font-weight: 500; background: var(--white); border: 1px solid var(--line); color: var(--ink-2); }
.hx-mini-score li.miss { background: var(--accent-tint); border-color: var(--accent); color: var(--accent-ink); }
.hx-toggle-row { display: flex; align-items: center; gap: 14px; background: var(--white); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; font-size: 15px; }
.hx-mini-unlock { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; width: 100%; background: var(--white); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
.hx-mini-unlock > :first-child { white-space: nowrap; min-width: 0; }
.hx-fakebtn { white-space: nowrap; display: inline-flex; align-items: center; min-height: 34px; padding: 0 12px; border-radius: 8px; background: var(--btn); color: var(--white); font-size: 14px; font-weight: 500; }

.hx-sec { padding: 112px 0; }
.hx-tint { background: var(--wash); }
.hx-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 40px; }
.hx-head .hx-h2 { margin-top: 14px; max-width: 18ch; }
.hx-head-cta { display: flex; gap: 12px; flex: none; }
.hx-points { list-style: none; padding: 0; margin-top: 48px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; color: var(--ink-2); font-size: 16px; }
.hx-points b { display: block; color: var(--ink); font-weight: 500; font-size: 18px; letter-spacing: -0.01em; margin-bottom: 6px; }

.hx-wgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; pointer-events: none; }
.hx-w { background: var(--white); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 1px 2px oklch(0.2 0.03 280 / 0.04), 0 8px 16px -4px oklch(0.2 0.03 280 / 0.05); }
.hx-w .hx-ab { display: flex; flex-direction: column; gap: 12px; align-items: stretch; }
.hx-w .hx-ab > .hx-chips, .hx-w .hx-ab > .hx-fakebtn { align-self: flex-start; }

.hx-w-wide { grid-column: 1 / -1; }
.hx-w { transition: box-shadow .2s cubic-bezier(0.16, 1, 0.3, 1); }
.hx-egrid { display: grid; grid-template-columns: 5fr 7fr; gap: 16px; pointer-events: none; }
.hx-ecol { display: grid; gap: 16px; grid-template-rows: auto 1fr; }
.hx-evq { margin-top: 4px; padding: 14px 16px; border-radius: 10px; background: var(--wash); display: grid; gap: 6px; }
.hx-evq p { font-size: 15px; line-height: 1.5; color: var(--ink); }
.hx-wl { font-family: var(--font-mono), ui-monospace, monospace; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-3); }
.hx-wq { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; font-size: 20px; line-height: 1.35; letter-spacing: -0.015em; font-weight: 500; }
.hx-wt { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; font-size: 28px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; }
.hx-wm { font-size: 15px; color: var(--ink-2); }
.hx-wstrike { font-size: 15px; color: var(--ink-3); text-decoration: line-through; }
.hx-bars { list-style: none; padding: 0; margin: 0; display: grid; }
.hx-bars li { display: grid; grid-template-columns: 160px 1fr 32px 110px; gap: 16px; align-items: center; font-size: 15px; font-weight: 500; padding: 12px 0; border-bottom: 1px solid var(--line); }
.hx-bars li:first-child { padding-top: 0; }
.hx-bars li:last-child { border-bottom: 0; padding-bottom: 0; }
.hx-bars-sm { margin-top: 16px; }
.hx-bars-sm li { grid-template-columns: 96px 1fr 28px; padding: 8px 0; border-bottom: 0; }
.hx-bars b { font-family: var(--font-mono), ui-monospace, monospace; font-weight: 500; font-size: 13px; text-align: right; }
.hx-bars em { font-style: normal; font-weight: 400; font-size: 13px; color: var(--ink-3); text-align: right; }
.hx-bar { height: 8px; border-radius: 4px; background: var(--wash); }
.hx-bar i { display: block; height: 100%; border-radius: 4px; background: var(--btn); transition: width .6s cubic-bezier(0.22, 1, 0.36, 1); }
.hx-mrows { list-style: none; padding: 0; margin: 0; display: grid; }
.hx-mrows li { display: flex; gap: 14px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--line); }
.hx-mrows li:first-child { padding-top: 0; }
.hx-mrows p { font-size: 14px; color: var(--ink-2); margin-top: 2px; }

.hx-pt { margin-top: 14px; }
.hx-tr { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 80px; align-items: start; }
.hx-tr-l { position: sticky; top: 112px; }
.hx-mini-cap { margin: 18px 0 0; font-family: var(--font-mono), ui-monospace, monospace; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.hx-tr-l .hx-h2 { font-size: 36px; }
.hx-priv-stage { margin-top: 40px; padding: 28px; border-radius: 24px; border: 1px solid var(--line); background: linear-gradient(135deg, oklch(0.945 0.04 55) 0%, oklch(0.95 0.035 320) 50%, oklch(0.935 0.045 285) 100%); }
.hx-gdot { display: none; width: 10px; height: 10px; border-radius: 50%; margin-right: 10px; background: linear-gradient(135deg, oklch(0.78 0.12 55), oklch(0.72 0.12 320), oklch(0.62 0.14 285)); vertical-align: 1px; }
.hx-fi[data-open="true"] .hx-gdot { display: inline-block; }
.hx-priv-lab { display: inline-flex; align-items: center; font-size: 14px; font-weight: 500; }
.hx-priv-lab .hx-gdot { display: inline-block; flex: none; }
.hx-pv-row { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-top: 1px solid var(--line); }
.hx-pv-row:first-of-type { border-top: 0; padding-top: 14px; }
.hx-pv-row b { display: block; font-size: 15px; font-weight: 500; }
.hx-pv-row div span { display: block; color: var(--ink-2); font-size: 14px; }
.hx-bars-svg { width: 48px; height: 20px; flex: none; fill: var(--ink-3); opacity: .55; }
.hx-pv-doc { width: 48px; flex: none; display: grid; gap: 4px; justify-items: start; }
.hx-pv-doc i { height: 3px; border-radius: 2px; background: var(--btn); width: 100%; opacity: .8; }
.hx-pv-doc i:nth-child(2) { width: 80%; } .hx-pv-doc i:nth-child(3) { width: 55%; }
.hx-pv-tag { margin-left: auto; font-style: normal; font-size: 12px; font-weight: 500; padding: 3px 10px; border-radius: 99px; background: var(--wash); color: var(--btn); }
.hx-pv-tag.gone { color: var(--ink-2); text-decoration: line-through; }
.hx-pv-steps { list-style: none; margin: 0; padding: 14px 0 0; display: grid; gap: 14px; }
.hx-pv-steps li { position: relative; padding-left: 26px; }
.hx-pv-steps li::before { content: ""; position: absolute; left: 0; top: 6px; width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--btn); background: var(--white); }
.hx-pv-steps li:last-child::before { background: var(--btn); }
.hx-pv-steps li:not(:last-child)::after { content: ""; position: absolute; left: 4px; top: 20px; bottom: -14px; width: 2px; background: var(--line-2); }
.hx-pv-steps b { display: block; font-size: 15px; font-weight: 500; }
.hx-pv-steps span { color: var(--ink-2); font-size: 14px; }
.hx-pv-score { margin-top: 14px; }
.hx-pv-score strong { margin-left: auto; font-family: var(--font-mono), ui-monospace, monospace; font-size: 22px; font-weight: 500; color: var(--btn); }
.hx-pv-opt { all: unset; box-sizing: border-box; cursor: pointer; padding: 7px 14px; border-radius: 99px; font-size: 14px; border: 1px solid var(--line-2); color: var(--ink-2); }
.hx-pv-opt[aria-pressed="true"] { background: var(--btn); border-color: var(--btn); color: var(--white); }
.hx-pv-opt:focus-visible { outline: 2px solid var(--btn) !important; outline-offset: 2px; border-color: var(--btn); }
.hx-pv-note .hx-pv-tag { margin-left: 6px; }
.hx-vis-open { font-weight: 500; color: var(--btn); }
.hx-pv-note { margin: 14px 0 0; font-size: 14px; color: var(--ink-2); }
.hx-pv-row + .hx-pv-note { margin-top: 4px; }
.hx-priv-top { display: flex; justify-content: space-between; align-items: center; gap: 16px; font-size: 15px; font-weight: 500; }
.hx-priv-body { margin-top: 20px; animation: hx-rise 380ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.hx-priv-body .hx-mini-cap { margin: 0 0 10px; color: var(--ink-2); }
.hx-priv-card { background: var(--white); border-radius: 16px; padding: 18px; min-height: 132px; }
.hx-priv-off { display: grid; place-items: center; text-align: center; background: transparent; border: 1px dashed var(--ink-3); color: var(--ink-2); font-size: 14px; }
.hx-priv-card .hx-vis-lock { margin-top: 14px; padding-top: 14px; }
.hx-sw { all: unset; box-sizing: border-box; flex: none; display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px 12px 4px 4px; border-radius: 99px; background: var(--white); border: 1px solid var(--line-2); }
.hx-sw i { width: 34px; height: 20px; border-radius: 99px; background: var(--line-2); position: relative; transition: background .3s; }
.hx-sw i::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--white); transition: transform .35s cubic-bezier(0.22, 1, 0.36, 1); }
.hx-sw em { font-style: normal; font-size: 13px; font-weight: 500; min-width: 22px; }
.hx-sw[aria-checked="true"] i { background: var(--btn); }
.hx-sw[aria-checked="true"] i::after { transform: translateX(14px); }
.hx-sw:focus-visible { outline: 2px solid var(--btn) !important; outline-offset: 2px; border-color: var(--btn); }
.hx-vis-body { margin-top: 16px; animation: hx-rise 380ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.hx-vis-row { display: flex; align-items: center; gap: 14px; }
.hx-vis-row b { display: block; font-size: 15px; font-weight: 500; }
.hx-vis-row div span { display: block; color: var(--ink-2); font-size: 14px; }
.hx-vis-row strong { margin-left: auto; font-family: var(--font-mono), ui-monospace, monospace; font-size: 22px; font-weight: 500; color: var(--btn); }
.hx-vis-av { width: 42px; height: 42px; border-radius: 50%; background: var(--wash); display: grid; place-items: center; flex: none; font-family: var(--font-mono), ui-monospace, monospace; font-size: 13px; color: var(--ink-2); }
.hx-vis-lock { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line-2); }
.hx-vis-lock span { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 99px; font-size: 12px; color: var(--ink-3); background: repeating-linear-gradient(135deg, var(--wash) 0 6px, var(--white) 6px 12px); border: 1px solid var(--line-2); }
.hx-vis-lock svg { width: 13px; height: 13px; }
.hx-vis-empty { display: grid; place-items: center; min-height: 96px; border: 1px dashed var(--line-2); border-radius: 12px; padding: 0 20px; text-align: center; color: var(--ink-3); font-size: 14px; }
.hx .hx 
.hx-faq { border-top: 1px solid var(--line-2); }
.hx-fi { border-bottom: 1px solid var(--line-2); }
.hx-ft { flex: 1; }
.hx-fq { all: unset; box-sizing: border-box; width: 100%; cursor: pointer; display: flex; align-items: center; gap: 16px; padding: 24px 0; font-size: 20px; font-weight: 500; letter-spacing: -0.01em; color: var(--ink); }
.hx-fq:hover { color: var(--ink-2); }
.hx-fq:focus-visible { outline: 2px solid var(--btn) !important; outline-offset: 4px; border-radius: 6px; box-shadow: none !important; color: var(--btn); }
.hx-fchev { display: inline-flex; color: var(--ink-3); transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1); }
.hx-fchev svg { width: 20px; height: 20px; }
.hx-fchev path { vector-effect: non-scaling-stroke; }
.hx-fi[data-open="true"] .hx-fchev { transform: rotate(45deg); color: var(--ink); }
.hx-fp { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 220ms cubic-bezier(0.22, 1, 0.36, 1); }
.hx-fi[data-open="true"] .hx-fp { grid-template-rows: 1fr; transition-duration: 340ms; }
.hx-fp > div { overflow: hidden; opacity: 0; filter: blur(2px); transition: opacity 220ms cubic-bezier(0.22, 1, 0.36, 1), filter 220ms cubic-bezier(0.22, 1, 0.36, 1); }
.hx-fi[data-open="true"] .hx-fp > div { opacity: 1; filter: blur(0); transition-duration: 340ms; }
@media (scripting: none) { .hx-fp { grid-template-rows: 1fr; } .hx-fp > div { opacity: 1; filter: none; } }
.hx-fp p { padding: 0 56px 28px 0; color: var(--ink-2); max-width: 60ch; }
@keyframes hx-rise { from { transform: translateY(8px); filter: blur(4px); opacity: 0; } to { transform: none; filter: blur(0); opacity: 1; } }
p.hx-swap, div.hx-swap { display: block; }
@keyframes hx-draw { to { stroke-dashoffset: 0; } }
@keyframes hx-pop { from { transform: rotate(-24deg) translateY(2px); filter: blur(3px); opacity: 0; } to { transform: none; filter: blur(0); opacity: 1; } }
.hx-ck { display: inline-flex; animation: hx-pop 320ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.hx-ck svg { width: 16px; height: 16px; overflow: visible; }
.hx-ck path { stroke-dasharray: 16; stroke-dashoffset: 16; animation: hx-draw 360ms cubic-bezier(0.22, 1, 0.36, 1) 90ms forwards; }
.hx-arr { overflow: visible; }
.hx-arr-c { transform: translateX(0); transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1); }
.hx-arr-a { transform-box: view-box; transform-origin: 10px 8px; vector-effect: non-scaling-stroke; transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1); }
.hx-btn:hover .hx-arr-c { transform: translateX(3px); transition-duration: 180ms; }
.hx-btn:hover .hx-arr-a { transition-duration: 180ms; }
.hx-btn:hover .hx-arr-t { transform: rotate(14deg); }
.hx-btn:hover .hx-arr-b { transform: rotate(-14deg); }
@media (prefers-reduced-motion: reduce) {
  .hx-sw i, .hx-vis, .hx-vis-body { transition: none !important; animation: none !important; }
  .hx-fchev, .hx-fp, .hx-fp > div, .hx-arr-c, .hx-arr-a { transition: none !important; }
  .hx-swap, .hx-ck, .hx-ck path { animation: none !important; stroke-dashoffset: 0; }
}

.hx-closing { padding-bottom: 0; }
.hx-footwrap { padding-top: 72px; padding-bottom: 48px; }
.hx-foot-rights { font-size: 14px !important; max-width: 40ch !important; }
.hx .hx-foot-rights a { color: var(--btn); font-weight: 500; }
.hx-end { text-align: center; padding: 96px 40px 72px; border-radius: 28px; border: 1px solid var(--line); background: radial-gradient(120% 90% at 0% 0%, oklch(0.945 0.04 55) 0%, transparent 55%), radial-gradient(120% 90% at 100% 100%, oklch(0.935 0.045 285) 0%, transparent 55%), oklch(0.95 0.035 320 / 0.6); }
.hx-end .hx-h2 { font-size: 36px; margin-top: 14px; }
.hx-end p { margin: 12px auto 0; font-size: 16px; max-width: 44ch; color: var(--ink-2); text-wrap: balance; }
.hx-end .hx-cta { margin-top: 36px; }
.hx-endnote { list-style: none; padding: 0; margin: 32px 0 0; display: flex; justify-content: center; gap: 28px; flex-wrap: wrap; font-size: 14px; color: var(--ink-2); }
.hx-endnote li { display: inline-flex; align-items: center; gap: 8px; }
.hx-endnote li::before { content: ''; width: 14px; height: 14px; background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%232f2a78' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3.5 8.5l3 3 6-7'/%3E%3C/svg%3E") center / contain no-repeat; }
.hx-foot { margin-top: 0; padding: 0 0 8px; display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 48px; color: var(--ink-3); font-size: 14px; }
.hx-foot .hx-logo img { height: 34px; }
.hx-foot-brand p { margin-top: 14px; color: var(--ink-2); font-size: 15px; max-width: 30ch; }
.hx-social { display: flex; gap: 8px; }
.hx .hx-social a { width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid var(--line-2); border-radius: 999px; color: var(--ink-2); transition: color .2s, border-color .2s; }
.hx .hx-social a:hover { color: var(--btn); border-color: var(--btn); }
.hx .hx-social a:focus-visible { outline: 2px solid var(--btn); outline-offset: 2px; }
.hx-foot-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; }
.hx-foot-cols div { display: grid; gap: 12px; align-content: start; }
.hx-foot-cols h3 { font-family: var(--font-mono), ui-monospace, monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-3); margin-bottom: 4px; }
.hx-foot-cols a { color: var(--ink); font-size: 15px; }
.hx-foot-cols a:hover, .hx-foot-btn:hover { color: var(--btn); }
.hx-foot-btn { appearance: none; border: 0; background: none; padding: 0; font: inherit; font-size: 15px; color: var(--ink); text-align: left; cursor: pointer; }
.hx-foot-bar { grid-column: 1 / -1; padding-top: 24px; border-top: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 16px; }

.hx-emp-row { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
.hx-emp-main { flex: 1 1 240px; min-width: 0; }
.hx-emp-meta { font-size: 14px !important; color: var(--ink-3); margin: 4px 0 0; }
.hx-emp-ev { font-size: 15px !important; color: var(--ink-2); margin: 12px 0 14px; max-width: 60ch; }
.hx-emp-tags { display: flex; flex-wrap: wrap; gap: 6px; }

@container (max-width: 900px) {
  .hx-wrap { padding: 0 20px; }
  .hx-links, .hx-nav-cta { display: none; }
  .hx-burger { display: grid; }
  .hx-menu { display: block; position: absolute; left: 0; right: 0; top: 100%; padding: 8px 20px 20px; background: var(--white); border-bottom: 1px solid var(--line); box-shadow: 0 20px 24px -20px oklch(0.2 0.03 280 / 0.2); }
  .hx-menu::after { content: ""; position: absolute; left: 0; right: 0; top: 100%; height: 100vh; background: oklch(0.2 0.03 280 / 0.28); }
  .hx-menu nav { display: grid; }
  .hx-menu nav a { padding: 14px 0; font-size: 17px; color: var(--ink); border-bottom: 1px solid var(--line); }
  .hx-menu nav a[aria-current="page"] { color: var(--btn); font-weight: 500; }
  .hx-menu-cta { display: grid; gap: 10px; margin-top: 16px; }
    .hx-h1 { font-size: 34px; margin-top: 20px; }
    .hx-cta { flex-direction: column; align-items: stretch; }
  .hx-cta .hx-btn { width: 100%; }
  .hx-fix { width: 100%; justify-content: center; }
  .hx-lede { font-size: 15px; }
  .hx-h2, .hx-end .hx-h2 { font-size: 28px; }
  .hx-stage, .hx-stage-cool, .hx-stage-warm { padding: 16px; margin-top: 40px; border-radius: 20px; }
  .hx-doors { grid-template-columns: 1fr; gap: 20px; }
  .hx-ab { padding: 16px; }
  .hx-af { flex-direction: column; align-items: flex-start; gap: 10px; }
  .hx-score { grid-template-columns: 1fr; justify-items: center; }
  .hx-score .hx-star { width: 100%; }
  .hx-score { grid-template-columns: 1fr; justify-items: center; }
  .hx-sec { padding: 64px 0; }
  .hx-hero { padding-bottom: 56px; }
  .hx-head { flex-direction: column; align-items: flex-start; gap: 24px; }
  .hx-points { grid-template-columns: 1fr; gap: 28px; }
  .hx-wgrid, .hx-egrid { grid-template-columns: 1fr; }
  .hx-wt { font-size: 32px; }
  .hx-wq { font-size: 20px; }
  .hx-bars li { grid-template-columns: 1fr 28px; row-gap: 8px; }
  .hx-bars li .hx-bar { grid-column: 1 / -1; order: 3; }
  .hx-bars em { display: none; }
  .hx-end { padding: 56px 20px; }
  .hx-foot { grid-template-columns: 1fr; gap: 32px; }
  .hx-foot-cols { grid-template-columns: repeat(2, 1fr); }
  .hx-tr { grid-template-columns: 1fr; gap: 40px; }
    .hx-tr-l .hx-h2 { font-size: 28px; }
  .hx-fp p { padding-right: 0; }
  .hx-tr-l { position: static; }
  .hx-head-cta { flex-wrap: wrap; }
  .hx-priv-stage { padding: 16px; margin-top: 28px; }
  .hx-end { padding: 64px 24px 48px; }
  .hx-end .hx-h2 { font-size: 28px; }
}


/* ── Product surfaces ── */
.hx-prog { list-style: none; padding: 0; margin: 0; display: flex; gap: 6px; }
.hx-prog li { flex: 1; height: 4px; border-radius: 2px; background: var(--line); }
.hx-prog li.done { background: var(--ink-3); }
.hx-prog li.now { background: var(--btn); }
.hx-rec-on { margin-top: 12px; padding: 14px 16px; border-radius: 10px; background: var(--white); border: 1px solid var(--line); display: grid; gap: 8px; }
.hx-rec-on p { font-size: 13px; line-height: 1.6; color: var(--ink); }
.hx-stage-hero { padding: 48px 48px 0; height: 640px; overflow: hidden; position: relative; }
html:has(.hx-tiltwrap) { overflow-x: clip; }
.hx-tiltwrap { perspective: 1600px; margin-top: 64px; }
.hx-tilt { --t: 0; margin-top: 0; transform-origin: 50% 0; transform: rotateX(calc(var(--t) * 24deg)) scale(calc(1 - var(--t) * 0.05)); will-change: transform; }
.hx-depth { background-size: 170% 170%; background-position: calc(var(--p, 0.5) * 100%) calc(var(--p, 0.5) * 100%); }
.hx-depth .hx-win { translate: 0 calc(var(--p, 0.5) * -44px); }
.hx-depth .hx-float { translate: 0 calc(var(--p, 0.5) * -76px + 38px); }
.hx-stage-crop { padding: 48px 48px 0; height: 560px; overflow: hidden; position: relative; }
.hx-hs { position: relative; }
.hx-num { font-family: var(--font-mono), ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.hx-win { background: var(--white); border: 1px solid var(--line); border-bottom: 0; border-radius: 16px 16px 0 0; box-shadow: 0 1px 2px oklch(0.2 0.03 280 / 0.04), 0 24px 48px -16px oklch(0.4 0.1 285 / 0.12); overflow: hidden; min-height: 620px; }
.hx-win .hx-ah { font-size: 13px; font-weight: 500; color: var(--ink-2); }
.hx-win .hx-ah span:nth-of-type(2) { color: var(--ink-2); font-weight: 400; }
.hx-dots { display: inline-flex; gap: 6px; }
.hx-dots i { width: 9px; height: 9px; border-radius: 50%; background: var(--line-2); }
.hx-ah kbd { font-family: var(--font-mono), ui-monospace, monospace; font-size: 12px; padding: 2px 6px; border: 1px solid var(--line-2); border-radius: 6px; background: var(--white); color: var(--ink-2); }
.hx-split { min-height: 560px; display: grid; grid-template-columns: 1.15fr 1fr; }
.hx-pane { padding: 24px 28px; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.hx-pane-r { background: var(--wash); border-left: 1px solid var(--line); }
.hx-pl { display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono), ui-monospace, monospace; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-3); }
.hx-pl em { font-style: normal; letter-spacing: 0; text-transform: none; font-variant-numeric: tabular-nums; }
.hx-pq { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; font-size: 26px; line-height: 1.2; font-weight: 500; letter-spacing: -0.015em; color: var(--ink); text-wrap: balance; }
.hx-tx { font-size: 14px; line-height: 1.65; color: var(--ink); background: var(--wash); border: 1px solid var(--line); border-radius: 12px; padding: 16px; }
.hx-tx-lg { font-size: 15px; background: var(--white); }
.hx-ts { font-family: var(--font-mono), ui-monospace, monospace; font-size: 12px; color: var(--ink-3); margin-right: 8px; font-variant-numeric: tabular-nums; }
.hx-tx mark { background: transparent; color: inherit; box-shadow: inset 0 -2px 0 var(--accent); }
.hx-tx ins { text-decoration: none; background: oklch(0.935 0.045 285 / 0.7); border-radius: 4px; padding: 1px 3px; animation: hx-rise 340ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.hx-miss { display: inline-block; font-size: 12px; font-weight: 500; line-height: 1; padding: 4px 8px; border: 1px dashed var(--accent); border-radius: 6px; color: var(--accent-ink); background: var(--accent-tint); vertical-align: 1px; margin-left: 2px; }
.hx-sr { list-style: none; padding: 0; margin: 0; display: flex; gap: 8px; }
.hx-sr li { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-2); border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; background: var(--white); }
.hx-sr li b { font-family: var(--font-mono), ui-monospace, monospace; font-weight: 500; color: var(--ink); }
.hx-sr li.miss { border-color: var(--accent); background: var(--accent-tint); color: var(--accent-ink); }
.hx-sr-col { flex-direction: column; gap: 6px; width: 100%; }
.hx-sr-col li { justify-content: flex-start; }
.hx-sr-col li span { margin-left: auto; color: var(--ink-3); }
.hx-sr-col li.miss span { color: var(--accent-ink); }
.hx-pane .hx-fix, .hx-rep-r .hx-fix { align-self: flex-start; margin-top: 4px; }
.hx-rk { list-style: none; padding: 0; margin: 0; position: relative; }
.hx-rk li { position: absolute; inset: 0 0 auto 0; height: 52px; display: grid; grid-template-columns: 20px minmax(0, auto) 1fr auto; align-items: center; gap: 10px; padding: 0 12px; background: var(--white); border: 1px solid var(--line); border-radius: 10px; transition: transform .5s cubic-bezier(0.22, 1, 0.36, 1), box-shadow .2s; font-size: 13px; }
.hx-rk li em { font-style: normal; color: var(--ink-3); font-size: 12px; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hx-rk li.hx-me { box-shadow: 0 0 0 1px var(--btn); border-color: var(--btn); }
.hx-n { font-family: var(--font-mono), ui-monospace, monospace; font-size: 12px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.hx-rk-lg { flex: 1; margin: 20px 28px 0 0; }
.hx-rk-lg li { display: block; padding: 0; }
.hx-rk-lg li button { all: unset; box-sizing: border-box; cursor: pointer; width: 100%; height: 100%; display: grid; grid-template-columns: 20px minmax(0, auto) 1fr auto; align-items: center; gap: 10px; padding: 0 12px; }
.hx-rk-lg li.hx-sel { border-color: var(--btn); box-shadow: 0 0 0 1px var(--btn); }
.hx-float { position: absolute; z-index: 2; background: var(--white); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; display: grid; gap: 8px; font-size: 13px; box-shadow: 0 1px 2px oklch(0.3 0.08 285 / 0.05), 0 12px 24px -10px oklch(0.4 0.1 285 / 0.14); }
.hx-float > span:first-child { font-family: var(--font-mono), ui-monospace, monospace; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-3); }
.hx-fl-a { left: 16px; top: 408px; width: 176px; transform: rotate(-1.2deg); }
.hx-fl-a b { font-size: 36px; line-height: 1; font-weight: 500; letter-spacing: -0.02em; }
.hx-fl-a i { height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; }
.hx-fl-a u { display: block; height: 100%; background: var(--btn); transition: width .7s cubic-bezier(0.22, 1, 0.36, 1); }
.hx-fl-b { right: 16px; top: 392px; width: 240px; transform: rotate(1deg); }
.hx-fl-b .hx-fakebtn, .hx-fl-c .hx-fakebtn { justify-self: start; border: 0; font-family: inherit; cursor: pointer; }
.hx-fl-b .hx-who { min-height: 38px; align-content: center; }
.hx-fl-c .hx-fl-row { align-items: center; gap: 12px; }
.hx-float { box-shadow: 0 1px 2px oklch(0.3 0.08 285 / 0.05), 0 12px 24px -10px oklch(0.4 0.1 285 / 0.14); }
.hx-samp { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-mono), ui-monospace, monospace; font-size: 12px; letter-spacing: 0.02em; color: var(--ink-2); padding: 3px 9px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); }
.hx-samp i { width: 6px; height: 6px; border-radius: 50%; background: var(--btn); }
.hx-rk li.hx-hit { animation: hx-hit 900ms cubic-bezier(0.22, 1, 0.36, 1) 1; }
.hx-hit .hx-chipw { display: inline-flex; animation: hx-chip 700ms cubic-bezier(0.22, 1, 0.36, 1) 1; }
@keyframes hx-hit { 0% { box-shadow: 0 0 0 1px var(--btn), 0 0 0 0 oklch(0.55 0.15 280 / 0.35); background: oklch(0.96 0.03 285); } 60% { box-shadow: 0 0 0 1px var(--btn), 0 0 0 10px oklch(0.55 0.15 280 / 0); background: oklch(0.975 0.02 285); } 100% { box-shadow: 0 0 0 1px var(--btn), 0 0 0 10px oklch(0.55 0.15 280 / 0); background: var(--white); } }
@keyframes hx-chip { 0% { transform: scale(1); } 35% { transform: scale(1.18); } 100% { transform: scale(1); } }
.hx-who-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.hx-av { width: 24px; height: 24px; border-radius: 50%; flex: none; display: block; object-fit: cover; box-shadow: 0 0 0 1px var(--line); transition: filter .4s cubic-bezier(0.22, 1, 0.36, 1); }
.hx-fl-b .hx-av { width: 32px; height: 32px; }
.hx-float > .hx-who-row { font-family: inherit; font-size: 14px; letter-spacing: 0; text-transform: none; color: var(--ink); }
.hx-gain { color: var(--ink-2); }
.hx-real { font-size: 14px; font-weight: 600; animation: hx-rise 340ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.hx-fakebtn:hover { background: var(--btn-hover); }
.hx-fakebtn.alt:hover { background: var(--wash); }
.hx-fakebtn[aria-pressed="true"]:not(.alt) { background: var(--btn-hover); }
.hx-rec { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-2); padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); }
.hx-rec i { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
.hx-rec:hover { border-color: var(--line-2); }
.hx-rec:focus-visible, .hx-sq button:focus-visible { outline: 2px solid var(--btn); outline-offset: 2px; }
.hx-sd[data-rec="true"] .hx-wv b { animation: hx-wv .9s ease-in-out infinite alternate; animation-delay: var(--d); }
.hx-sq li { padding: 0; }
.hx-sq button { all: unset; box-sizing: border-box; width: 100%; height: 100%; display: grid; place-items: center; cursor: pointer; border-radius: 8px; }
.hx-sq li:has(button:hover) { border-color: var(--line-2); }
.hx-fl-c { right: 24px; top: 84px; width: 280px; }
.hx-fl-c p { font-size: 14px; line-height: 1.5; color: var(--ink); }
.hx-fl-c .hx-num { color: var(--ink-2); font-size: 12px; }
.hx-fl-d { right: 24px; top: 84px; width: 300px; }
.hx-fl-d p { font-size: 14px; line-height: 1.5; color: var(--ink); min-height: 63px; }
.hx-fl-row { display: flex; gap: 8px; flex-wrap: wrap; }
.hx-fl-d .hx-fakebtn { border: 0; font-family: inherit; cursor: pointer; }
.hx-fakebtn.alt { background: var(--white); color: var(--ink); box-shadow: inset 0 0 0 1px var(--line-2); }
.hx-fakebtn.alt[aria-pressed="true"] { box-shadow: inset 0 0 0 1px var(--btn); }
.hx-rep { min-height: 560px; display: grid; grid-template-columns: 240px 1fr; }
.hx-rep-l { padding: 28px 24px; border-right: 1px solid var(--line); background: var(--wash); display: flex; flex-direction: column; align-items: center; gap: 20px; }
.hx-rep-l svg { width: 160px; height: auto; }
.hx-rep-r { padding: 24px 28px; display: flex; flex-direction: column; gap: 16px; min-width: 0; padding-right: 336px; }
.hx-rep-r .hx-bars { margin-top: 8px; }
.hx-inbox { min-height: 560px; display: grid; grid-template-columns: 220px 320px 1fr; }
.hx-side { padding: 24px; background: var(--wash); border-right: 1px solid var(--line); display: flex; flex-direction: column; gap: 14px; }
.hx-side > b { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; font-size: 24px; font-weight: 600; letter-spacing: -0.02em; }
.hx-pl-gap { margin-top: 12px; }
.hx-inbox .hx-rk-lg { margin: 20px 0 0 20px; align-self: start; }
.hx-evd { margin: 20px 28px 0 28px; padding: 0 0 0 28px; border-left: 1px solid var(--line); display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.hx-evq { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; font-size: 20px; line-height: 1.25; font-weight: 600; letter-spacing: -0.015em; color: var(--ink); }
.hx-cmp { display: grid; gap: 12px; }
.hx-cmp[data-two="true"] { grid-template-columns: 1fr 1fr; }
.hx-cmp blockquote { margin: 0; background: var(--white); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; display: grid; gap: 10px; align-content: start; }
.hx-cmp p { font-size: 15px; line-height: 1.5; color: var(--ink); }
.hx-evh { display: flex; align-items: center; justify-content: space-between; font-family: var(--font-mono), ui-monospace, monospace; font-size: 12px; color: var(--ink-3); }
.hx-evt { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.hx-evt li { font-size: 12px; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--line); color: var(--ink-2); background: var(--wash); }
.hx-evt li.good { color: oklch(0.38 0.09 155); background: oklch(0.96 0.04 155); border-color: oklch(0.9 0.05 155); }
.hx-evt li.gap { color: var(--accent-ink); background: var(--accent-tint); border-color: transparent; }
.hx-evd .hx-fl-row { margin-top: 2px; }
.hx-evd .hx-fakebtn { border: 0; font-family: inherit; cursor: pointer; }
.hx-evd .hx-fakebtn.alt { border: 1px solid var(--line-2); }
.hx-reply { font-size: 13px; color: var(--ink); background: var(--white); border: 1px solid var(--line); border-radius: 12px; padding: 8px 12px; align-self: stretch; }

.hx-rv .hx-ri { transition: opacity .6s cubic-bezier(0.22, 1, 0.36, 1), transform .6s cubic-bezier(0.22, 1, 0.36, 1); transition-delay: calc(var(--i, 0) * 90ms); }
@media (scripting: enabled) { .hx-rv:not(.on) .hx-ri { opacity: 0; transform: translateY(16px); } }

.hx-sd { width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
.hx-rec i { animation: none; }
.hx-wv { display: flex; align-items: center; gap: 4px; height: 40px; }
.hx-wv b { width: 4px; border-radius: 2px; background: var(--ink-3); display: block; transform-origin: center; }
@keyframes hx-wv { from { transform: scaleY(1); } to { transform: scaleY(0.35); } }
.hx-sc { display: flex; align-items: center; gap: 10px; }
.hx-sc .hx-num { font-size: 12px; color: var(--ink-3); }
.hx-sq { list-style: none; padding: 0; margin: 0; display: flex; gap: 6px; }
.hx-sq li { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; font-size: 13px; font-weight: 500; background: var(--white); border: 1px solid var(--line); color: var(--ink-2); }
.hx-sq li.miss { background: var(--accent-tint); border-color: var(--accent); color: var(--accent-ink); }
.hx-tg { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 12px; background: var(--white); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; font-size: 13px; color: var(--ink); }
.hx-tg:focus-visible, .hx-fix:focus-visible, .hx-fakebtn:focus-visible, .hx-rk-lg li button:focus-visible { outline: 2px solid var(--btn); outline-offset: 2px; }
.hx-tg .hx-switch { flex: none; position: relative; width: 36px; height: 20px; border-radius: 99px; background: var(--line-2); transition: background .35s; }
.hx-tg .hx-switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: var(--white); }
.hx-sq li { transition: background .3s, border-color .3s, color .3s; }
.hx-sq li[data-on="true"] { background: oklch(0.96 0.05 155); border-color: oklch(0.8 0.1 155); color: oklch(0.4 0.1 155); }
.hx-dm { list-style: none; padding: 0; margin: 0; display: grid; gap: 4px; width: 100%; max-width: 260px; }
.hx-dm button { all: unset; box-sizing: border-box; width: 100%; display: grid; grid-template-columns: 72px 1fr; align-items: center; gap: 10px; padding: 3px 0; cursor: pointer; font-size: 12px; color: var(--ink-2); border-radius: 6px; }
.hx-dm button:focus-visible { outline: 2px solid var(--btn); outline-offset: 2px; }
.hx-dm i { display: block; height: 6px; border-radius: 999px; background: var(--wash); overflow: hidden; }
.hx-dm u { display: block; height: 100%; width: 0; border-radius: 999px; background: oklch(0.7 0.13 155); transition: width .6s cubic-bezier(0.22, 1, 0.36, 1), background .3s; }
.hx-dm li[data-on="true"] u { width: 100%; }
.hx-dm li.miss u { width: 38%; background: var(--accent); }
.hx-dm li.miss button { color: var(--accent-ink); }
.hx-tg .hx-switch.on { background: var(--btn); }
.hx-tg .hx-switch::after { right: auto; left: 3px; transition: transform .25s cubic-bezier(0.22, 1, 0.36, 1); }
.hx-tg .hx-switch.on::after { transform: translateX(16px); }
.hx-uk { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; background: var(--white); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; font-size: 13px; }
.hx-uk .hx-fakebtn { border: 0; font-family: inherit; cursor: pointer; min-height: 30px; }
.hx-who { display: grid; gap: 2px; animation: hx-rise 340ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.hx-who .hx-num { font-size: 12px; color: var(--ink-3); }

@container (max-width: 900px) {
  .hx-tiltwrap { margin-top: 40px; }
  .hx-tilt { transform: none; }
  .hx-stage-hero, .hx-stage-crop { height: auto; padding: 16px 16px 0; }
  .hx-win { min-height: 0; }
  .hx-split, .hx-rep, .hx-inbox { grid-template-columns: 1fr; }
  .hx-pane { padding: 20px; }
  .hx-pane-r, .hx-rep-l, .hx-side { border-left: 0; border-right: 0; border-top: 1px solid var(--line); }
  .hx-rep-l { flex-direction: row; justify-content: space-between; flex-wrap: wrap; }
  .hx-rep-r { padding: 20px; }
  .hx-sr { flex-wrap: wrap; }
  .hx-pq { font-size: 22px; }
  .hx-rk { margin: 0; }
  .hx-rk li { grid-template-columns: 20px minmax(0, 1fr) auto; }
  .hx-rk li em { display: none; }
  .hx-rk-lg, .hx-inbox .hx-rk-lg { margin: 16px 20px; }
  .hx-evd { margin: 8px 20px 20px; padding: 16px 0 0; border-left: 0; border-top: 1px solid var(--line); }
  .hx-cmp[data-two="true"] { grid-template-columns: 1fr; }
  .hx-rk-lg li button { grid-template-columns: 20px minmax(0, 1fr) auto; }
  .hx-rk-lg li button em { display: none; }
  .hx-depth .hx-win, .hx-depth .hx-float { translate: none; }
  .hx-float { position: static; margin: 0 16px 16px; width: auto; transform: none; }
  .hx-fl-a { display: none; }
  .hx-prog { display: none; }
  .hx-fl-b { display: none; }
  .hx-hs { padding-bottom: 0; }
  .hx-stage-hero .hx-win, .hx-stage-crop .hx-win { border-radius: 16px; border-bottom: 1px solid var(--line); margin-bottom: 16px; }
}

@media (prefers-reduced-motion: reduce) {
  .hx-rv .hx-ri, .hx-rk li, .hx-fl-a u, .hx-fl-b { transition: none; }
  .hx-tx ins, .hx-who { animation: none; }
}

.hx-how { margin-top: 56px; display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 7fr); gap: 56px; align-items: center; }
.hx-how-list { list-style: none; margin: 0; padding: 0; position: relative; }
.hx-how-list li { position: relative; padding: 4px 0; }
.hx-how-list button { all: unset; box-sizing: border-box; display: flex; align-items: baseline; gap: 14px; width: 100%; padding: 14px 0; cursor: pointer; border-radius: 8px; }
.hx-how-list button:focus-visible { outline: 2px solid var(--btn); outline-offset: 2px; }
.hx-how-list b { font-family: var(--font-mono), ui-monospace, monospace; font-weight: 500; font-size: 13px; color: var(--ink-3); }
.hx-how-list button span { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; font-size: 26px; font-weight: 500; letter-spacing: -0.012em; color: var(--ink-3); transition: color .4s; }
.hx-how-list button:hover span { color: var(--ink-2); }
.hx-how-list li[data-state="now"] button span { color: var(--ink); }
.hx-how-d { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .5s cubic-bezier(0.22, 1, 0.36, 1); }
.hx-how-d > div { overflow: hidden; }
.hx-how-d p { margin: 0; padding: 0 0 18px 33px; color: var(--ink-2); font-size: 17px; max-width: 38ch; }
.hx-how-list li[data-state="now"] .hx-how-d { grid-template-rows: 1fr; }
.hx-how-list li::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--line); }
.hx-how-pg { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: var(--btn); transform-origin: left; animation: hx-how-pg linear both; z-index: 1; }
@keyframes hx-how-pg { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.hx-how-vis { margin-top: 0; min-height: 440px; padding: 32px; display: grid; place-items: center; }
.hx-how-in { width: 100%; display: grid; place-items: center; zoom: 1.7; animation: hx-how-in .5s cubic-bezier(0.22, 1, 0.36, 1) both; }
@keyframes hx-how-in { from { opacity: 0; transform: translateY(12px); } }
@media (max-width: 900px) {
  .hx-how { grid-template-columns: 1fr; gap: 24px; margin-top: 40px; }
  .hx-how-list button span { font-size: 22px; }
  .hx-how-d p { font-size: 16px; }
  .hx-how-vis { min-height: 280px; padding: 16px; }
  .hx-how-in { zoom: 1; }
}
@media (prefers-reduced-motion: reduce) { .hx-how-in, .hx-how-pg { animation: none; } .hx-how-d { transition: none; } }
/* ── UI generation overlay (transitions.dev), tuned to the site's indigo ── */
:root { --gen-line: oklch(0.62 0.1 278); --gen-strong: oklch(0.359 0.135 278.697); --gen-ink: oklch(0.45 0.12 278 / 0.35); --gen-surface: #fff; --gen-dot: 2.1px; --gen-font: var(--font-mono), ui-monospace, monospace; }
.t-gen { position: absolute; z-index: 2147483000; pointer-events: none; }
.t-gen-svg { position: absolute; left: 0; top: 0; overflow: visible; }
.t-gen-dot { fill: var(--gen-ink); }
.t-gen-dot.is-lit { fill: var(--gen-strong); }
.t-gen-wireframe { stroke-width: var(--gen-dot); }
.t-gen-wire { fill: none; stroke: var(--gen-line); stroke-linecap: round; stroke-linejoin: round; }
.t-gen-guide { fill: none; stroke: var(--gen-line); stroke-width: 1.6; stroke-linecap: round; }
.t-gen-guide--dashed, .t-gen-guide--scan { stroke-dasharray: 0 5; }
.t-gen-head, .t-gen-flyer { fill: var(--gen-strong); }
.t-gen-handle { fill: var(--gen-surface); stroke: var(--gen-strong); stroke-width: 1; }
.t-gen-reticle { fill: none; stroke: var(--gen-strong); stroke-width: 1.2; stroke-linecap: round; }
.t-gen-glow-stop { stop-color: var(--gen-line); }
.t-gen-label { font-family: var(--gen-font); font-size: 9px; fill: var(--gen-line); letter-spacing: 0.02em; }
.t-gen-label--small { font-size: 7.5px; fill: var(--gen-strong); }
.t-gen-label--tag { font-size: 7.5px; fill: var(--gen-strong); letter-spacing: 0.05em; text-transform: uppercase; }
.t-gen-label { display: none; }
@media (prefers-reduced-motion: reduce) { .t-gen { display: none; } }

@media (scripting: enabled) and (prefers-reduced-motion: no-preference) {
  [data-sk="pending"] { opacity: 0; }
  html:not([data-hx-hyd]) [data-sk="pending"] { animation: hx-sk-failsafe 0s 5s forwards; }
}
@keyframes hx-sk-failsafe { to { opacity: 1; } }
@media (pointer: coarse) {
  .hx .hx-foot a, .hx .hx-foot-rights a { display: inline-flex; align-items: center; min-height: 44px; }
  .hx .hx-btn.sm, .hx .lb-tab, .hx .prc-seg button, .hx .lb-more { min-height: 44px; }
}
`;

