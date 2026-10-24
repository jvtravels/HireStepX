export const pagesCss = `
.pg-hero { padding: 72px 0 96px; }
.pg-stage { padding: 40px; border-radius: 28px; border: 1px solid var(--line); background: linear-gradient(135deg, oklch(0.945 0.04 55) 0%, oklch(0.95 0.035 320) 50%, oklch(0.935 0.045 285) 100%); }
.pg-stage.cool { background: linear-gradient(135deg, oklch(0.935 0.045 285) 0%, oklch(0.95 0.035 320) 55%, oklch(0.945 0.04 55) 100%); }
.pg-stage.wide { padding: 48px; }

.pg-win { background: var(--white); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; box-shadow: 0 1px 2px oklch(0.2 0.03 280 / 0.04), 0 24px 48px -16px oklch(0.4 0.1 285 / 0.12); }
.pg-body { padding: 22px 24px; display: flex; flex-direction: column; gap: 16px; }
.pg-live { display: flex; align-items: center; gap: 14px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--wash); }
.pg-live .hx-wv { flex: 1; justify-content: space-between; }
.pg-live .hx-wv b { animation: hx-wv .9s ease-in-out infinite alternate; animation-delay: var(--d); }
.pg-live .hx-num { font-size: 13px; color: var(--ink-2); }
.pg-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex: none; }
.pg-ctl { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-top: 14px; border-top: 1px solid var(--line); font-size: 13px; color: var(--ink-3); }

.pg-field { display: grid; gap: 6px; }
.pg-field > span { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-3); }
.pg-input { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 0 14px; border: 1px solid var(--line-2); border-radius: 10px; background: var(--white); font-size: 15px; color: var(--ink); }
.pg-input em { font-style: normal; font-size: 13px; color: var(--ink-3); }
.pg-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pg-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.pg-tag { display: inline-flex; padding: 4px 10px; border-radius: 99px; border: 1px solid var(--line); background: var(--wash); font-size: 12px; color: var(--ink-2); }
.pg-tag.on { background: oklch(0.935 0.045 285 / 0.7); border-color: transparent; color: var(--btn); }
.pg-file .hx-pv-doc { width: 28px; }

.pg-sec { padding: 88px 0; }
.hx-hero { padding-bottom: 56px; }
.hx-closing { padding-top: 88px; }
.jr-l .hx-h2 { margin-top: 14px; font-size: 32px; }
.pg-flow.jr { max-width: 1120px; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 64px; align-items: start; }
.pg-steps button:not(.on) { padding-top: 10px; padding-bottom: 10px; }
.pg-steps button:not(.on):hover { background: none; }
.pg-steps button:not(.on) b { color: var(--ink-3); font-weight: 500; }
.pg-steps button:not(.on):hover b { color: var(--ink); }
.sx-v, .sx-v { background: none; border: 0; padding: 0; min-height: 0; }
.pg-row.flip { grid-template-columns: minmax(0, 7fr) minmax(0, 4fr); }
.pg-row.flip .pg-copy { order: 2; }
.pg-copy .hx-h2 { margin-top: 14px; font-size: 32px; }
.pg-copy > p { margin-top: 20px; font-size: 18px; color: var(--ink-2); max-width: 44ch; text-wrap: pretty; }
.pg-list { list-style: none; padding: 0; margin: 24px 0 0; display: grid; gap: 10px; font-size: 15px; color: var(--ink); }
.pg-list li { display: flex; gap: 10px; align-items: baseline; }
.pg-list li::before { content: ''; flex: none; width: 14px; height: 14px; transform: translateY(2px); background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%232f2a78' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3.5 8.5l3 3 6-7'/%3E%3C/svg%3E") center / contain no-repeat; }

.pg-ans > div.better { background: oklch(0.975 0.02 285); border-color: oklch(0.88 0.04 285); }

.pg-decay em.due { color: var(--accent-ink); font-weight: 500; }
.pg-fade i.due { background: var(--accent); }

.pg-band { background: var(--wash); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.pg-seen .off { border-style: dashed; background: transparent; color: var(--ink-2); font-size: 15px; align-content: center; text-align: center; }

.pg-who { display: flex; align-items: center; gap: 12px; }
.pg-who b { display: block; font-size: 15px; font-weight: 600; }
.pg-who span { font-size: 13px; color: var(--ink-3); }
.pg-who .hx-av { width: 40px; height: 40px; }
.pg-who .sc { margin-left: auto; }
.pg-lockrow { display: grid; gap: 8px; }
.pg-lockrow span { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--line-2); background: repeating-linear-gradient(135deg, var(--wash) 0 6px, var(--white) 6px 12px); font-size: 14px; color: var(--ink-3); }
.pg-lockrow svg { width: 14px; height: 14px; }
.pg-lockrow.open span { background: var(--white); border-style: solid; color: var(--ink); justify-content: space-between; }
.pg-lockrow.open em { font-style: normal; color: var(--ink-3); font-size: 12px; }

.pg-mini { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.pg-mini li { display: grid; grid-template-columns: 96px 1fr 28px; gap: 12px; align-items: center; font-size: 13px; color: var(--ink-2); }
.pg-mini b { font-family: 'Geist Mono', ui-monospace, monospace; font-weight: 500; font-size: 13px; text-align: right; color: var(--ink); }

.pg-matches .hx-av { width: 28px; height: 28px; }
.pg-matches li.first { border-color: var(--btn); box-shadow: 0 0 0 1px var(--btn); }

.pg-msg { display: grid; gap: 8px; }
.pg-msg p { font-size: 14px; padding: 10px 14px; border-radius: 14px; max-width: 80%; }
.pg-msg .me { background: var(--btn); color: var(--white); justify-self: end; border-bottom-right-radius: 4px; }
.pg-msg .them { background: var(--wash); border: 1px solid var(--line); border-bottom-left-radius: 4px; }
.pg-btnrow .hx-fakebtn.alt { box-shadow: inset 0 0 0 1px var(--line-2); }
.pg-press { border: 0; font-family: inherit; cursor: pointer; min-height: 40px; padding: 0 16px; }
@media (prefers-reduced-motion: reduce) { .pg-faq summary i { transition: none; } }
.pg-tbl th, .pg-tbl td { padding: 18px 22px; border-bottom: 1px solid var(--line); vertical-align: top; font-size: 15px; font-weight: 400; }
.pg-tbl tbody tr:last-child > * { border-bottom: 0; }
.pg-tbl tbody th { width: 180px; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-3); }
.pg-chip { display: inline-flex; padding: 3px 10px; border-radius: 99px; background: oklch(0.935 0.045 285 / 0.7); color: var(--btn); font-size: 13px; font-weight: 500; }
.pg-none { color: var(--ink-3); }
.pg-status li.on { background: var(--btn); border-color: var(--btn); color: var(--white); font-weight: 500; }
.pg-sec { scroll-margin-top: 72px; }
.hx-rv .pg-matches li, .hx-rv .pg-after > * { transition: opacity .5s cubic-bezier(0.22, 1, 0.36, 1), transform .5s cubic-bezier(0.22, 1, 0.36, 1); transition-delay: calc(var(--k, 0) * 90ms + 350ms); }
.hx-rv:not(.on) .pg-matches li, .hx-rv:not(.on) .pg-after > :not(h4) { opacity: 0; transform: translateY(8px); }
@media (prefers-reduced-motion: reduce) { .hx-rv .pg-matches li, .hx-rv .pg-after > * { transition: none; } }



.pg-bar i { transition: width .9s cubic-bezier(0.22, 1, 0.36, 1) .5s; }
.hx-rv:not(.on):not(.ft-p) .pg-bar i { width: 0 !important; }
@media (prefers-reduced-motion: reduce) { .pg-bar i, .pg-steps::after { transition: none; } }
@keyframes pg-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }



.pg-tbl { width: 100%; max-width: 1040px; margin: 0 auto; border-collapse: separate; border-spacing: 0; background: var(--white); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; text-align: left; table-layout: fixed; }
.pg-tbl thead td, .pg-tbl thead th { background: var(--wash); }
.pg-tbl thead td { width: 180px; }
.pg-tl { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-3); }
.pg-ch { display: flex; align-items: center; gap: 14px; }
.pg-ch .hx-av { width: 44px; height: 44px; }
.pg-ch b { display: block; font-size: 16px; font-weight: 600; }
.pg-ch small { display: block; margin-top: 2px; font-size: 13px; font-weight: 400; color: var(--ink-3); }
.pg-mt { display: flex; align-items: center; gap: 10px; }
.pg-lead { font-style: normal; font-size: 12px; font-weight: 500; color: var(--btn); }
.pg-fit { display: grid; gap: 8px; margin-top: 14px; }
.pg-fit > span { display: grid; grid-template-columns: 64px minmax(0, 1fr) 40px; align-items: center; gap: 12px; }
.pg-fit small { font-size: 13px; color: var(--ink-3); }
.pg-fit b { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 13px; font-weight: 500; text-align: right; }
.pg-bar { display: block; height: 6px; border-radius: 99px; background: var(--wash); overflow: hidden; }
.pg-bar i { display: block; height: 100%; border-radius: 99px; background: var(--line-2); }
.pg-bar i.lead { background: var(--btn); }
.pg-nm { display: flex; align-items: baseline; gap: 12px; margin-bottom: 10px; }
.pg-nm b { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 24px; font-weight: 500; }
.pg-nm small { font-size: 13px; color: var(--ink-3); }
.pg-tbl td > .pg-nm:last-child { margin-bottom: 0; }

.pg-flow .pg-win { box-shadow: 0 1px 2px oklch(0.2 0.03 280 / 0.04), 0 24px 48px -16px oklch(0.4 0.1 285 / 0.14); }
.pg-steps button.on { background: var(--white); border-color: var(--line); }
.pg-steps button.on i { background: var(--btn); color: var(--white); }
.pg-status-b button.on { background: var(--btn); border-color: var(--btn); color: var(--white); font-weight: 500; }

.pg-pr { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 72px; align-items: center; }
.pg-pr .hx-h2 { margin-top: 12px; }

.hv-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.hv-list { list-style: none; margin: 0; padding: 0; position: relative; }
.hv-list li { position: absolute; left: 0; right: 0; top: 0; height: 52px; display: grid; grid-template-columns: 20px 28px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--white); font-size: 14px; transition: transform .6s cubic-bezier(0.22, 1, 0.36, 1), border-color .3s, box-shadow .3s; animation: hv-fade .5s both; animation-delay: calc(var(--k, 0) * 100ms + 500ms); }
.hv-list li.first { border-color: var(--btn); box-shadow: 0 0 0 1px var(--btn); }
.hv-list li > span:first-child { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; color: var(--ink-3); }
.hv-list .hx-av { width: 28px; height: 28px; }
.hv-list b { font-weight: 600; }
.hv-list em { display: block; font-style: normal; font-size: 13px; color: var(--ink-3); }
@keyframes hv-fade { from { opacity: 0; } to { opacity: 1; } }
.jr { align-items: start; max-width: 1080px; }
@keyframes jr-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.pg-lockrow.open span { animation: jr-in .4s cubic-bezier(0.22, 1, 0.36, 1) both; }
.pg-lockrow.open span:nth-child(2) { animation-delay: 70ms; }
.pg-lockrow.open span:nth-child(3) { animation-delay: 140ms; }
.pg-lockrow.open span:nth-child(4) { animation-delay: 210ms; }
.pg-steps .pr { position: absolute; left: 58px; right: 16px; bottom: 8px; height: 2px; border-radius: 2px; background: var(--line); overflow: hidden; }
.pg-steps .pr::after { content: ''; display: block; height: 100%; background: var(--btn); transform-origin: left; animation: jr-pr var(--dwell, 7000ms) linear both; }
@keyframes jr-pr { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes jr-pulse { 50% { opacity: .25; } }
@media (prefers-reduced-motion: reduce) { .hv-list li, .jr-stage > *, .pg-lockrow.open span, .jr-wait i, .pg-steps .pr::after { animation: none; } .hv-list li { transition: none; } }


.pg-stage.plain { background: none; border: 0; padding: 0; }
.fl-open { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.fl-open li { display: grid; grid-template-columns: 96px minmax(0, 1fr) 44px; align-items: center; gap: 10px; font-size: 14px; }
.fl-open li i { height: 6px; border-radius: 3px; background: var(--line); position: relative; overflow: hidden; }
.fl-open li i::after { content: ''; position: absolute; inset: 0 auto 0 0; width: var(--w); background: var(--btn); border-radius: 3px; }
.fl-open .fl-plain { grid-template-columns: 1fr auto; padding-top: 12px; border-top: 1px solid var(--line); }
.fl-open .fl-plain + .fl-plain { padding-top: 0; border-top: 0; }
.fl-open .fl-plain span { color: var(--ink-2); }
.pg-hero-stage { max-width: none; margin-top: 40px; padding: 20px; border-radius: 24px; }
.hc { background: var(--white); border: 1px solid var(--line-2); border-radius: 20px; overflow: hidden; text-align: left; }
.hc-body { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 7fr); background: var(--white); }
.hc-log { height: 264px; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 14px; scrollbar-width: none; -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 22px, #000 calc(100% - 22px), transparent 100%); mask-image: linear-gradient(to bottom, transparent 0, #000 22px, #000 calc(100% - 22px), transparent 100%); }
.hc-res { border-left: 1px solid var(--line); background: var(--wash); padding: 24px; min-width: 0; display: flex; flex-direction: column; }
.hc-res > div { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.hc-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.hc-top > span { font-size: 13px; color: var(--ink-3); }
.hc-skills { display: flex; flex-wrap: wrap; gap: 6px; }
.hc-wait { margin: 0; font-size: 15px; color: var(--ink-3); }
.hc-log::-webkit-scrollbar { display: none; }
.hc-m { display: flex; align-items: flex-start; gap: 10px; animation: hc-in .5s cubic-bezier(0.22, 1, 0.36, 1) both; }
.hc-m.you { justify-content: flex-end; }
.hc-b { min-width: 0; max-width: 92%; padding: 10px 14px; border-radius: 18px; font-size: 15px; line-height: 1.45; }
.hc-m.you .hc-b { background: color-mix(in oklab, var(--btn) 10%, white); color: var(--ink); border-bottom-right-radius: 6px; }
.hc-m.us .hc-b { background: transparent; padding-left: 0; padding-right: 0; color: var(--ink-2, var(--ink)); border-top-left-radius: 6px; }
.hc-x { flex: none; width: 30px; height: 30px; border-radius: 50%; background: color-mix(in oklab, var(--btn) 12%, white); display: grid; place-items: center; font-weight: 700; font-size: 15px; color: var(--btn); }
.hc-log > .hc-m:first-child { margin-top: auto; }
.hc-caret::after { content: ""; display: inline-block; width: 2px; height: 1em; margin-left: 2px; vertical-align: -2px; background: currentColor; animation: hc-blink 1s steps(1) infinite; }
.hc-dots { display: flex; gap: 5px; align-items: center; height: 24px; padding-top: 12px; padding-bottom: 12px; box-sizing: content-box; }
.hc-dots span { width: 7px; height: 7px; border-radius: 50%; background: var(--ink-3); animation: hc-dot 1.1s ease-in-out infinite; }
.hc-dots span:nth-child(2) { animation-delay: .15s; }
.hc-dots span:nth-child(3) { animation-delay: .3s; }
.hc-list { list-style: none; margin: 16px 0 0; padding: 0; display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); grid-template-rows: repeat(3, 1fr); gap: 10px 12px; flex: 1; }
.hc-list li.top { grid-row: 1 / span 3; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 4px; padding: 20px; border-color: var(--btn); }
.hc-list li.top > span { order: -2; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--btn); }
.hc-list li.top .hx-av { order: -1; width: 48px; height: 48px; margin-bottom: 6px; }
.hc-list li.top b { font-size: 18px; }
.hc-list li.top > :last-child { margin-top: 10px; transform: scale(1.25); transform-origin: left center; }
.hc-list li { display: grid; grid-template-columns: 14px 32px minmax(0, 1fr) 44px; column-gap: 10px; align-items: center; padding: 10px 12px; background: var(--white); border: 1px solid var(--line); border-radius: 12px; animation: hc-in .5s cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: calc(var(--i, 0) * 120ms + 150ms); }
.hc-list li > span { font-size: 14px; color: var(--ink-3); }
.hc-list b { display: block; font-size: 15px; font-weight: 600; }
.hc-list em { display: block; font-style: normal; font-size: 14px; color: var(--ink-3); }
.hc-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 68px; padding: 14px 24px; border-top: 1px solid var(--line); }
.hc-hint { margin-right: 4px; font-size: 13px; color: var(--ink-3); }
.hc-chip { font: inherit; font-size: 15px; padding: 10px 16px; border-radius: 99px; border: 1px solid var(--line-2); background: var(--white); color: var(--ink); cursor: pointer; transition: background .2s, border-color .2s, transform .15s; }
.hc-chip:hover { background: var(--wash); border-color: var(--btn); }
.hc-chip:active { transform: scale(0.97); }
.hc-chip:focus-visible { outline: 2px solid var(--btn); outline-offset: 2px; }
@keyframes hc-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes hc-blink { 50% { opacity: 0; } }
@keyframes hc-dot { 0%, 60%, 100% { opacity: .3; transform: none; } 30% { opacity: 1; transform: translateY(-3px); } }
.hx-h1 b, .hx-h2 b, .pg-h1 b { color: inherit; }
.nm { min-width: 0; }
.nm b { display: block; font-size: 15px; font-weight: 600; }
.nm em { display: block; font-style: normal; font-size: 13px; color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.rs { max-width: 1080px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 88px; align-items: center; }
.rs-l p { margin: 20px 0 0; max-width: 34ch; font-size: 18px; color: var(--ink-2); text-wrap: pretty; }
.rs-list .hx-av { width: 36px; height: 36px; filter: grayscale(1); opacity: .7; transition: filter .5s, opacity .5s; }
.rs-list.scored .hx-av { filter: none; opacity: 1; }
.rs-list .bar { display: block; height: 6px; border-radius: 99px; background: var(--wash); overflow: hidden; }
.rs-list .bar i { display: block; height: 100%; border-radius: 99px; background: var(--btn); transition: width .8s cubic-bezier(0.22, 1, 0.36, 1) .3s; }
.rs-list .sc { text-align: right; }
.rs-list .none { font-size: 12px; color: var(--ink-3); white-space: nowrap; }


.pg-head .hx-kicker { display: block; margin-bottom: 18px; }
.jr .pg-win { box-shadow: none; }

@media (prefers-reduced-motion: reduce) { .rs-list li, .rs-list .bar i, .hc-m, .hc-list li { animation: none; } }


/* ── Anchored sections: text column + visual panel on one grid ── */
.sx { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 56px; align-items: stretch; }
.sx-t .hx-h2 { margin: 18px 0 0; }
.sx-v { margin: 0; padding: 32px; border: 1px solid var(--line-2); border-radius: 24px; background: var(--wash); display: flex; flex-direction: column; justify-content: center; min-height: 340px; }
.sx-v { border: 0; background: none; padding: 0; min-height: 0; }

.hx-hero:has(.pg-hero-stage) { padding-bottom: 64px; }
.hx-hero:has(.pg-hero-stage) .hx-h1 { font-size: 52px; margin-top: 56px; max-width: 26ch; margin-left: auto; margin-right: auto; text-wrap: balance; }
.hx-hero:has(.pg-hero-stage) .hx-lede { margin-top: 12px; max-width: 64ch; font-size: 16px; }
.hx-hero:has(.pg-hero-stage) .hx-cta { margin-top: 24px; }

.hx-hero:has(.pg-hero-stage) { min-height: calc(100svh - 65px); display: flex; flex-direction: column; padding-bottom: 40px; }
.hx-hero:has(.pg-hero-stage) > .hx-wrap { flex: 1; width: 100%; min-width: 0; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; }
.hx-hero:has(.pg-hero-stage) .hx-h1 { margin-top: clamp(56px, 10svh, 112px); }
.pg-hero-stage { margin-top: clamp(48px, 7svh, 80px); }
.pg-hero-stage .hc-log { height: 330px; }
.pg-hero-stage .hc-res > div { justify-content: center; }
@media (max-width: 900px) {
  .hx-hero:has(.pg-hero-stage) { min-height: 0; }
  .pg-hero-stage .hc-log { height: 264px; }
}
@keyframes pg-faq-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .pg-faq details[open] > p { animation: none; } .rs-btn:active, .jr-chip:active { transform: none; } }
.jr-track.pin { height: 360vh; padding: 0; }
.jr-track.pin > .hx-wrap { position: sticky; top: 0; min-height: 100vh; display: flex; align-items: center; padding-top: 72px; box-sizing: border-box; }
.jr-track.pin .pg-flow.jr { width: 100%; }
.jr-track.pin .jr-l { position: static; }
/* ── Employers page ── */
.em-head { max-width: 780px; margin: 0 0 48px; }
.em-head .hx-h2 { margin-top: 14px; font-size: 36px; text-wrap: balance; }
.em-head p { margin: 10px 0 0; max-width: 52ch; font-size: 16px; line-height: 1.5; color: var(--ink-2); }

.hs-tabs { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 24px; margin-bottom: 20px; }
.hs-tab { background: none; border: 0; padding: 0; text-align: left; cursor: pointer; font: inherit; color: var(--ink-3); transition: color .2s; }
.hs-tab:hover, .hs-tab.on { color: var(--ink); }
.hs-tab:focus-visible { outline: 2px solid var(--btn); outline-offset: 6px; border-radius: 4px; }
.hs-bar { display: block; height: 3px; border-radius: 3px; background: var(--line); overflow: hidden; }
.hs-bar i { display: block; height: 100%; background: var(--btn); transform: scaleX(0); transform-origin: left; }
.hs-tab.done .hs-bar i { transform: none; }
.hs-tab.on .hs-bar i { animation: hs-fill linear forwards; }
.hs-t { display: block; margin-top: 14px; font-size: 17px; font-weight: 500; letter-spacing: -0.01em; }
.hs-stage { height: 520px; display: grid; place-items: center; padding: 32px; border: 1px solid var(--line); border-radius: 20px; background: linear-gradient(135deg, oklch(0.945 0.04 55) 0%, oklch(0.95 0.035 320) 50%, oklch(0.935 0.045 285) 100%); overflow: hidden; }
.hs-scene { width: 100%; display: flex; justify-content: center; }
.hs-scene .pg-win { width: min(100%, 520px); }
.hs-scene.wide .pg-win { width: min(100%, 760px); }
.hs-cap { width: fit-content; max-width: 100%; margin: 20px auto 0; padding: 12px 22px; border-radius: 99px; background: var(--ink); color: var(--white); font-size: 15px; line-height: 1.4; text-align: center; animation: hs-in .5s cubic-bezier(0.22, 1, 0.36, 1) both; }
.hs.paused *, .hs.paused *::after { animation-play-state: paused !important; }

.hs-in { animation: hs-in .5s cubic-bezier(0.22, 1, 0.36, 1) var(--d, 0s) both; }
.hs-pop { animation: hs-pop .4s cubic-bezier(0.22, 1, 0.36, 1) var(--d, 0s) both; }
.hs-type { display: inline-block; white-space: nowrap; animation: hs-type 1.1s steps(16) var(--d, 0s) both; }
.hs-press { animation: hs-press .3s ease var(--d, 0s) both, hs-out .3s ease calc(var(--d, 0s) + .6s) forwards; }
.hs-gone { animation: hs-out .3s ease var(--d, 0s) forwards; }
.hs-press.hs-gone { animation: hs-press .3s ease var(--d, 0s) both, hs-out .3s ease calc(var(--d, 0s) + .6s) forwards; }
.hs-swap { display: grid; }
.hs-swap > * { grid-area: 1 / 1; }
.hs-act { align-items: center; justify-items: start; min-height: 36px; }
.hs-ok { font-size: 14px; font-weight: 500; color: var(--btn); }
.hs-h { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 15px; }
.hs-count { padding: 4px 10px; border-radius: 99px; background: oklch(0.935 0.045 285 / 0.7); color: var(--btn); font-size: 12px; font-weight: 500; }
.hs-note { margin: 0; font-size: 14px; color: var(--ink-3); }
.hs-bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.hs-bars li { display: grid; grid-template-columns: 96px minmax(0, 1fr) 28px; gap: 12px; align-items: center; font-size: 14px; color: var(--ink-2); }
.hs-bars i { height: 6px; border-radius: 3px; background: var(--line); position: relative; overflow: hidden; }
.hs-bars i::after { content: ''; position: absolute; inset: 0; width: var(--w); background: var(--btn); border-radius: 3px; transform-origin: left; animation: hs-grow .9s cubic-bezier(0.22, 1, 0.36, 1) var(--d, 0s) both; }
.hs-bars b { font-family: 'Geist Mono', ui-monospace, monospace; font-weight: 500; font-size: 13px; color: var(--ink); text-align: right; }
.hs-rank { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.hs-rank li { display: grid; grid-template-columns: 16px 32px minmax(0, 1fr) auto auto; gap: 12px; align-items: center; height: 56px; padding: 0 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--white); font-size: 15px; animation: hs-slide 1s cubic-bezier(0.65, 0, 0.35, 1) var(--d, 0s) both; }
.hs-rank li > span { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; color: var(--ink-3); }
.hs-rank b { font-weight: 600; }
.hs-rank em { font-style: normal; font-size: 12px; font-weight: 500; color: var(--btn); }
.hs-two { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
.hs-col { display: grid; gap: 22px; align-content: start; min-width: 0; }
.hs-col .hs-bars li { grid-template-columns: 104px minmax(0, 1fr) 26px; }
@keyframes hs-fill { from { transform: scaleX(0); } to { transform: none; } }
@keyframes hs-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes hs-pop { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: none; } }
@keyframes hs-type { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes hs-grow { from { transform: scaleX(0); } to { transform: none; } }
@keyframes hs-press { 50% { transform: scale(.94); } }
@keyframes hs-out { to { opacity: 0; visibility: hidden; } }
@keyframes hs-slide { from { transform: translateY(var(--from, 0px)); } to { transform: none; } }
@keyframes hs-side { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .hs *, .hs *::after { animation: none !important; }
  .hs-tab.on .hs-bar i { transform: none; }
  .hs-gone { display: none; }
}

.wy { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 20px; align-items: start; }
.wy-tag { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-3); }
.wy-tag.on { color: var(--btn); }
.wy-claim { padding: 28px; border: 1px dashed var(--line-2); border-radius: 20px; display: grid; align-content: start; gap: 18px; }
.wy-claim ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 14px; font-size: 22px; line-height: 1.3; color: var(--ink-3); }
.wy-claim p { margin: 0; font-size: 14px; color: var(--ink-3); }
.wy-proof { padding: 28px; border: 1px solid var(--line-2); border-radius: 20px; background: var(--white); display: grid; gap: 20px; align-content: start; }
.wy-top { display: flex; justify-content: space-between; align-items: center; }
.wy-diff { margin-top: 64px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px; }
.wy-diff h3 { margin: 0; padding-top: 20px; border-top: 1.5px solid var(--btn); font-size: 28px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; color: var(--ink); }
.wy-sample { font-size: 12px; padding: 3px 10px; border: 1px solid var(--line-2); border-radius: 99px; color: var(--ink-3); }
.wy-who { display: flex; align-items: center; gap: 12px; }
.wy-id { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--wash); border: 1px solid var(--line); font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; color: var(--ink-3); }
.wy-who div { display: grid; flex: 1; min-width: 0; }
.wy-who span { font-size: 13px; color: var(--ink-3); }
.wy-q { margin: 0; font-size: 28px; line-height: 1.4; font-weight: 500; letter-spacing: -0.01em; color: var(--ink); text-wrap: pretty; }
.wy-q mark { background: oklch(0.93 0.07 285); color: var(--ink); padding: 0 4px; border-radius: 4px; }
.wy-skill { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 18px; border-top: 1px solid var(--line-2); font-size: 14px; color: var(--ink-2); }

.pl { list-style: none; margin: 0; padding: 6px 22px; }
.pl li { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 14px 0; border-bottom: 1px solid var(--line); }
.pl li:last-child { border-bottom: 0; }
.pl b { font-size: 15px; font-weight: 600; }


.pc { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 72px; align-items: start; }
.pc-l { display: grid; gap: 32px; align-self: center; }
.pl-grp h3 { margin: 0; padding-bottom: 14px; display: flex; justify-content: space-between; align-items: baseline; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-3); border-bottom: 1.5px solid var(--ink); }
.pl-grp.paid h3 span:last-child { color: var(--btn); }
.pl-grp ul { margin: 0; padding: 0; list-style: none; }
.pl-grp li { display: flex; align-items: center; gap: 14px; padding: 16px 0; border-bottom: 1px solid var(--line-2); font-size: 17px; color: var(--ink); }
.pl-grp li > i { flex: none; width: 16px; height: 16px; background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%232f2a78' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3.5 8.5l3 3 6-7'/%3E%3C/svg%3E") center / contain no-repeat; }
.pl-grp li > svg { flex: none; width: 16px; height: 16px; color: var(--ink-3); }
.pl-grp li em { margin-left: auto; font-style: normal; font-size: 14px; color: var(--ink-3); }
.pl-grp.paid.open li > svg, .pl-grp.paid.open li em { color: var(--btn); }
.pl-grp li.key { font-weight: 500; }
.pl-price { display: flex; align-items: center; gap: 20px; padding: 22px 0; border-bottom: 1px solid var(--line-2); }
.pl-price b { font-size: 64px; font-weight: 600; letter-spacing: -0.035em; line-height: 1; color: var(--btn); }
.pl-price p { margin: 0; font-size: 15px; line-height: 1.5; color: var(--ink-2); }
.pl-price a { color: var(--btn); font-weight: 500; white-space: nowrap; }
.pc-stage { padding: 24px; }
.pf { padding: 24px; display: grid; gap: 20px; }
.pf-head { display: flex; align-items: center; gap: 16px; }
.pf-id { display: grid; gap: 6px; min-width: 0; }
.pf-id b { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
.pf-id > span:not(.pf-lock) { font-size: 14px; color: var(--ink-3); }
.pf-lock, .pf-contact { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--line-2); background: repeating-linear-gradient(135deg, var(--wash) 0 6px, var(--white) 6px 12px); font-size: 14px; color: var(--ink-3); }
.pf-lock { width: fit-content; }
.pf-lock svg, .pf-contact svg { width: 14px; height: 14px; }
.pf-contact.open { background: var(--white); color: var(--ink); animation: jr-in .4s cubic-bezier(0.22, 1, 0.36, 1) both; }
.pf-ready { margin-left: auto; text-align: right; display: grid; gap: 2px; }
.pf-ready small { font-size: 12px; color: var(--ink-3); }
.pf-ready b { font-size: 16px; font-weight: 600; }
.pf h4 { margin: 4px 0 -6px; font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-3); font-family: 'Geist Mono', ui-monospace, monospace; }
.pf-facts { margin: 0; display: grid; gap: 10px; padding-top: 16px; border-top: 1px solid var(--line); }
.pf-facts div { display: flex; justify-content: space-between; font-size: 14px; }
.pf-facts dt { color: var(--ink-2); }
.pf-facts dd { margin: 0; font-weight: 600; }
.pc-ctl { margin: 0; padding: 14px 24px 18px; }
.ft-head { padding-bottom: 24px; position: relative; z-index: 2; }
.ft { height: calc(100svh + 640px + 1600px); position: relative; margin-top: calc(-1 * (100svh - 48px - min(620px, 100svh - 48px)) / 2 - 24px); }
.ft-stick { position: sticky; top: 0; height: 100svh; padding: 24px; background: var(--white); box-sizing: border-box; display: grid; place-items: center; }
.ft-stage { --e: 0; position: relative; width: calc(min(1160px, 100% - 80px) * (1 - var(--e)) + 100% * var(--e)); height: calc(min(620px, 100%) * (1 - var(--e)) + 100% * var(--e)); border-radius: calc(44px - 12px * var(--e)); overflow: hidden; display: grid; place-items: center; background: oklch(0.945 0.04 55); }
.ft-bg { position: absolute; inset: 0; }
.ft-bg i { position: absolute; inset: 0; }
.ft-bg i:nth-child(1) { background: radial-gradient(60% 70% at 12% 18%, oklch(0.90 0.09 55) 0%, transparent 70%), radial-gradient(55% 65% at 88% 12%, oklch(0.88 0.10 330) 0%, transparent 70%), radial-gradient(60% 70% at 80% 95%, oklch(0.88 0.09 285) 0%, transparent 70%), radial-gradient(50% 60% at 10% 90%, oklch(0.91 0.08 20) 0%, transparent 70%), oklch(0.95 0.04 320); }
.ft-bg i:nth-child(2) { background: radial-gradient(60% 70% at 12% 18%, oklch(0.88 0.10 330) 0%, transparent 70%), radial-gradient(55% 65% at 88% 12%, oklch(0.89 0.08 285) 0%, transparent 70%), radial-gradient(60% 70% at 80% 95%, oklch(0.88 0.08 240) 0%, transparent 70%), radial-gradient(50% 60% at 10% 90%, oklch(0.92 0.07 55) 0%, transparent 70%), oklch(0.95 0.03 290); }
.ft-bg i:nth-child(3) { background: radial-gradient(60% 70% at 12% 18%, oklch(0.88 0.09 235) 0%, transparent 70%), radial-gradient(55% 65% at 88% 12%, oklch(0.89 0.09 295) 0%, transparent 70%), radial-gradient(60% 70% at 80% 95%, oklch(0.91 0.08 55) 0%, transparent 70%), radial-gradient(50% 60% at 10% 90%, oklch(0.89 0.09 330) 0%, transparent 70%), oklch(0.95 0.03 280); }
.ft-bg i:nth-child(4) { background: radial-gradient(60% 70% at 12% 18%, oklch(0.91 0.08 55) 0%, transparent 70%), radial-gradient(55% 65% at 88% 12%, oklch(0.89 0.09 20) 0%, transparent 70%), radial-gradient(60% 70% at 80% 95%, oklch(0.88 0.09 285) 0%, transparent 70%), radial-gradient(50% 60% at 10% 90%, oklch(0.88 0.09 330) 0%, transparent 70%), oklch(0.95 0.04 40); }
.ft-in { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; width: 100%; padding: 0 calc(40px / var(--fit, 1)); box-sizing: border-box; zoom: var(--fit, 1); }
.ft-tabs { position: relative; z-index: 1; display: flex; gap: 12px; }
.ft-tabs button { width: 60px; height: 60px; border-radius: 20px; border: 4px solid var(--white); background: oklch(0.93 0.01 285); color: var(--ink-3); display: grid; place-items: center; cursor: pointer; padding: 0; transition: background .3s, color .3s; }
.ft-tabs button:hover { color: var(--ink); }
.ft-tabs button.on { background: var(--btn); color: var(--white); }
.ft-tabs button:focus-visible { outline: 2px solid var(--btn); outline-offset: 3px; }
.ft-notch { position: absolute; left: 0; top: 100%; width: 24px; height: 20px; margin: -2px 0 0 18px; background: var(--white); transform: translateX(calc(var(--k, 0) * 72px)); transition: transform .45s cubic-bezier(0.22, 1, 0.36, 1); }
.ft-notch::before, .ft-notch::after { content: ""; position: absolute; bottom: 0; width: 12px; height: 12px; }
.ft-notch::before { right: 100%; background: radial-gradient(circle at 0 0, transparent 11.5px, var(--white) 12px); }
.ft-notch::after { left: 100%; background: radial-gradient(circle at 100% 0, transparent 11.5px, var(--white) 12px); }
.ft-card { position: relative; z-index: 1; display: grid; width: 100%; max-width: calc(1060px + (1 - var(--fit, 1)) * 2000px); margin-top: 14px; background: var(--white); border-radius: 28px; padding: 28px 44px; box-sizing: border-box; }
.ft-p { grid-area: 1 / 1; display: grid; pointer-events: none; grid-template-columns: minmax(0, 4fr) minmax(0, 7fr); gap: 40px; align-items: center; will-change: opacity, transform; }
.ft-p.act { pointer-events: auto; }
.ft-vis { transition: opacity .35s ease; }
@container (min-width: 901px) { .ft-p:not(.on) .ft-vis { opacity: 0; } .ft-p:not(.on) .pg-bar i { width: 0 !important; } }
.ft-name { display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--btn); }
.ft-p .hx-h2 { max-width: none; text-wrap: balance; margin-top: 14px; font-size: 32px; }
.ft-vis { min-width: 0; padding: 14px; border-radius: 20px; background: var(--wash); border: 1px solid var(--line); display: grid; align-items: center; }
.ft-vis .pg-win { box-shadow: none; }
.ft-vis .pg-tbl th, .ft-vis .pg-tbl td { padding: 6px 12px; }
.ft-vis .pg-ch b { white-space: nowrap; font-size: 14px; }
.ft-vis .pg-ch small { white-space: nowrap; }
.ft-chat { padding-top: 8px; }
.ft-p.on .pl li, .ft-p.on .pg-msg p { animation: hc-in .5s cubic-bezier(0.22, 1, 0.36, 1) both; }
.ft-p.on .fl-open li i::after { transform-origin: left; animation: ft-grow .9s cubic-bezier(0.22, 1, 0.36, 1) .3s both; }
.ft-p.on .fl-open li:nth-child(2) i::after { animation-delay: .45s; }
.ft-p.on .fl-open li:nth-child(3) i::after { animation-delay: .6s; }
@keyframes ft-grow { from { transform: scaleX(0); } }
.ft-p.on .pl li:nth-child(2) { animation-delay: .1s; }
.ft-p.on .pl li:nth-child(3) { animation-delay: .2s; }
.ft-p.on .pg-msg p:nth-child(1) { animation-delay: .35s; }
.ft-p.on .pg-msg p:nth-child(2) { animation-delay: .6s; }
@media (prefers-reduced-motion: reduce) { .ft-p.on .pl li, .ft-p.on .pg-msg p, .ft-p.on .fl-open li i::after { animation: none; } }

@container (max-width: 900px) {
  .hx-hero:has(.pg-hero-stage) .hx-h1 { font-size: 34px; margin-top: 20px; }
  .hx-hero:has(.pg-hero-stage) .hx-lede { font-size: 16px; }
  .hx-hero:has(.pg-hero-stage) { padding-bottom: 40px; }
    .hc-body { grid-template-columns: minmax(0, 1fr); }
  .hc-log { height: auto; min-height: 120px; max-height: 210px; padding: 16px; gap: 12px; }
  .hc-list { grid-template-columns: minmax(0, 1fr); gap: 6px; margin-top: 12px; }
  .hc-list { grid-auto-rows: auto; }
  .hc-res { border-left: 0; border-top: 1px solid var(--line); padding: 16px; }
  .pg-hero-stage { padding: 12px; margin-top: 32px; }
  .hc-b { max-width: 92%; font-size: 16px; padding: 10px 14px; }
  .hc-list li { grid-template-columns: 14px 28px minmax(0, 1fr) 44px; column-gap: 10px; padding: 6px 10px; }
  .hc-list li .hx-av { width: 28px; height: 28px; }
  .hc-list { grid-template-rows: none; }
  .hc-list li.top { grid-row: auto; display: grid; grid-template-columns: 56px 28px minmax(0, 1fr) 44px; padding: 8px 10px; gap: 0; column-gap: 10px; align-items: center; }
  .hc-list li.top > span { order: 0; font-size: 12px; }
  .hc-list li.top .hx-av { order: 0; width: 28px; height: 28px; margin: 0; }
  .hc-list li.top b { font-size: 15px; }
  .hc-list li.top > :last-child { margin: 0; transform: none; }
  .hc-foot { padding: 12px 16px; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 40px), transparent); mask-image: linear-gradient(to right, #000 calc(100% - 40px), transparent); }
  .hc-foot::-webkit-scrollbar { display: none; }
  .hc-hint, .hc-chip { flex: none; white-space: nowrap; }
  .em-head { margin-bottom: 28px; }
  .em-head .hx-h2 { font-size: 26px; }
  .em-head p { font-size: 15px; }
  .hs-tabs { display: flex; overflow-x: auto; gap: 20px; scrollbar-width: none; }
  .hs-tab { flex: none; min-width: 112px; }
  .hs-stage { height: auto; min-height: 440px; padding: 16px; }
  .hs-two { grid-template-columns: 1fr; gap: 18px; }
  .hs-cap { border-radius: 16px; }
  .wy, .wy-diff { grid-template-columns: 1fr; }
  .wy-diff { gap: 28px; margin-top: 40px; }
  .wy-q { font-size: 20px; }
  .wy-claim, .wy-proof { padding: 22px; }
  .pc { grid-template-columns: 1fr; gap: 36px; }
  .pc-r { order: -1; }
  .pl-price b { font-size: 52px; }
  .pc-ctl { padding: 14px 16px 16px; flex-direction: column; align-items: flex-start; }
  .pg-flow.jr .pg-steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(44px, 1fr)); gap: 6px; }
  .pg-flow.jr .pg-steps li:not(:has(.on)) { grid-row: 1; }
  .pg-flow.jr .pg-steps li:has(.on) { grid-row: 2; grid-column: 1 / -1; }
  .pg-flow.jr .pg-steps button:not(.on) { grid-template-columns: 28px; justify-content: center; padding: 8px 0; }
  .pg-flow.jr .pg-steps button:not(.on) span { display: none; }
  .jr-stage { min-height: 0; }
  .pg-steps em { display: none; }
  .pg-steps button.on em { display: block; }
  .pg-steps .pr { left: 16px; }
  .pg-flow { grid-template-columns: 1fr; gap: 20px; }
  .pg-steps::before, .pg-steps::after { display: none; }
  .pg-pr { grid-template-columns: 1fr; gap: 36px; }

  .pg-hero { padding: 32px 0 56px; }
  .pg-hero-in, .pg-row, .pg-row.flip { grid-template-columns: 1fr; gap: 36px; }
  .pg-row.flip .pg-copy { order: 0; }
  .pg-h1 { font-size: 34px; }
  .pg-lede { font-size: 15px; }
  .pg-cta { flex-direction: column; align-items: stretch; }
  .pg-cta .hx-btn { width: 100%; }
  .pg-stage, .pg-stage.wide { padding: 16px; border-radius: 20px; }
  .pg-sec { padding: 48px 0; }
  .hx-closing { padding-top: 48px; }
  .jr-l { position: static; }
  .jr-l .hx-h2 { font-size: 28px; }
  .jr-hint { margin-bottom: 20px; }
  .jr-stage { min-height: 0; }
  .pg-flow.jr { grid-template-columns: 1fr; gap: 20px; }
  .pg-copy .hx-h2 { font-size: 28px; }
  .pg-copy > p { font-size: 16px; }
  .pg-body { padding: 18px; }
  .pg-q { font-size: 20px; }
  .pg-two { grid-template-columns: 1fr; }
  .pg-tbl th, .pg-tbl td { padding: 14px 12px; font-size: 14px; }
  .pg-tbl tbody th { font-size: 12px; }
  .pg-tbl thead td { width: 72px; }
  .pg-tbl th, .pg-tbl td { min-width: 0; overflow-wrap: anywhere; }
  .pg-tbl thead th .hx-av, .pg-ch .hx-av { width: 32px; height: 32px; }
  .pg-ch b { font-size: 14px; }
  .pg-fit > span { grid-template-columns: minmax(0, 1fr) 34px; }
  .pg-mt { flex-wrap: wrap; }
  .pg-tags { gap: 4px; }
    .pg-decay li { grid-template-columns: 1fr auto; row-gap: 8px; }
  .pg-decay li .pg-fade { grid-column: 1 / -1; order: 3; }
  .pg-price { grid-template-columns: 1fr; gap: 32px; }
  .pg-rows li { padding: 20px 0; }
  .pg-rows b { font-size: 20px; }
  .pg-rows strong { font-size: 26px; }
  .rs { grid-template-columns: 1fr; gap: 36px; }
  .rs-list li { grid-template-columns: 32px minmax(0, 1fr) 60px; }
  .rs-list .bar { display: none; }
  .pg-head { flex-direction: column; align-items: flex-start; gap: 10px; margin-bottom: 28px; }
  .sx, .fl-sx { grid-template-columns: 1fr; gap: 24px; }
  .fl-body { grid-template-columns: 1fr; gap: 24px; padding: 16px; }
  .fl-sx .sx-t { order: -1; }
  .sx-v { padding: 0; }

  .ft { height: auto; margin-top: 0; }
  .ft-stick { position: static; height: auto; padding: 0 16px; display: block; }
  .ft-stage { width: auto; height: auto; overflow: visible; background: none; display: block; }
  .ft-bg, .ft-tabs { display: none; }
  .ft-in { display: block; padding: 0; }
  .ft-card { display: grid; gap: 20px; width: 100%; max-width: none; margin: 0; padding: 0; background: none; }
  .ft-p { pointer-events: auto; grid-area: auto; grid-template-columns: minmax(0, 1fr); gap: 20px; opacity: 1 !important; transform: none !important; padding: 24px 20px; background: var(--white); border: 1px solid var(--line); border-radius: 20px; }
  .ft-p .hx-h2 { font-size: 28px; }
  .ft-vis { padding: 12px; }
  .ft-vis .hv-list li { grid-template-columns: 28px minmax(0, 1fr) auto; }
  .ft-vis .hv-list li > span:first-child { display: none; }
  .ft-vis .hv-list li > div { min-width: 0; }
  .ft-vis .hv-list li b, .ft-vis .hv-list li em { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
}
.hx-id { display: grid; place-items: center; width: var(--s, 24px); height: var(--s, 24px); background: var(--wash); font-family: 'Geist Mono', ui-monospace, monospace; font-size: calc(var(--s, 24px) * 0.34); color: var(--ink-3); }
.hs-people { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.hs-people > span { display: block; }
.hs-people .hs-note { margin-left: 8px; }
.hs-bars li.none > span, .hs-bars li.none > b { color: var(--ink-3); }
.hs-bars li.none i::after { display: none; }
.hs-scene .pg-win { width: min(100%, 640px); }
.hs-scene.wide .pg-win { width: min(100%, 820px); }

.pc-l { gap: 16px; }
.pc-l .pl-grp { padding: 28px; border-radius: 24px; background: var(--white); border: 1px solid var(--line); }
.pc-l .pl-grp h3 { display: inline-flex; padding: 5px 12px; margin-bottom: 18px; border: 0; border-radius: 99px; background: var(--wash); color: var(--btn); }
.pc-l .pl-grp ul { display: grid; gap: 4px; }
.pc-l .pl-grp li { padding: 10px 0; border: 0; font-size: 16px; }
.pc-l .pl-grp li > i { width: 22px; height: 22px; border-radius: 50%; background-color: oklch(0.94 0.04 278); background-size: 12px; }
.pc-l .pl-grp.paid { background: linear-gradient(145deg, oklch(0.42 0.14 278) 0%, oklch(0.32 0.13 282) 100%); border-color: transparent; color: var(--white); }
.pc-l .pl-grp.paid h3 { background: oklch(1 0 0 / 0.14); color: var(--white); }
.pc-l .pl-grp.paid h3 span { color: var(--white); }
.pc-l .pl-price { align-items: flex-start; }
.pc-l .pl-price { padding: 0 0 20px; border: 0; }
.pc-l .pl-price b { color: var(--white); font-size: 72px; }
.pc-l .pl-price p { color: oklch(1 0 0 / 0.78); }
.pc-l .pl-price a { color: var(--white); text-decoration: underline; text-underline-offset: 3px; }
.pc-l .pl-grp.paid ul { gap: 8px; }
.pc-l .pl-grp.paid li { padding: 12px 16px; border-radius: 12px; background: oklch(1 0 0 / 0.1); color: var(--white); font-size: 15px; }
.pc-l .pl-grp.paid li > svg, .pc-l .pl-grp.paid li em { color: oklch(1 0 0 / 0.72); }
.pc-l .pl-grp.paid.open li > svg, .pc-l .pl-grp.paid.open li em { color: var(--white); }

.wy { padding: 24px; border-radius: 28px; border: 1px solid var(--line); background: linear-gradient(135deg, oklch(0.945 0.04 55) 0%, oklch(0.95 0.035 320) 50%, oklch(0.935 0.045 285) 100%); align-items: stretch; gap: 16px; }
.wy-claim { background: oklch(1 0 0 / 0.55); border: 1px dashed var(--line-2); align-content: space-between; gap: 24px; }
.wy-claim ul { font-size: 20px; gap: 12px; }
.wy-claim li { padding: 14px 16px; border-radius: 12px; background: oklch(1 0 0 / 0.7); border: 1px solid var(--line); }
.wy-claim p { font-size: 14px; }
.wy-proof { box-shadow: 0 1px 2px oklch(0.2 0.03 280 / 0.04), 0 16px 40px -20px oklch(0.2 0.03 280 / 0.2); border-color: var(--line); }
.wy-q { font-size: 24px; }
.wy-diff { counter-reset: d; gap: 16px; margin-top: 24px; }
.wy-diff h3 { counter-increment: d; padding: 24px; border: 1px solid var(--line); border-radius: 20px; background: var(--white); font-size: 22px; display: grid; gap: 28px; align-content: space-between; }
.wy-diff h3::before { content: "0" counter(d); font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.06em; color: var(--btn); }
@media (max-width: 900px) { .wy-diff { grid-template-columns: 1fr; } .wy-q { font-size: 20px; } .wy { padding: 12px; } }
.pc-l .pl-grp li { font-weight: 400; }
.pc-l .pl-price { padding-bottom: 0; }
.hs-t { display: flex; align-items: center; gap: 8px; }
.hs-t svg { flex: none; color: var(--ink-3); }
.hs-tab.on .hs-t svg, .hs-tab.done .hs-t svg { color: var(--btn); }
.wy-diff h3::before { display: none; }
.wy-diff h3 svg { width: 44px; height: 44px; padding: 11px; box-sizing: border-box; border-radius: 12px; background: var(--wash); border: 1px solid var(--line); color: var(--btn); }
.em-head.ctr { margin-left: auto; margin-right: auto; text-align: center; }
.em-head.ctr p { margin-left: auto; margin-right: auto; }
.em-head.ctr .hx-h2 { text-wrap: balance; }
.hs-scene .pg-win, .hs-scene.wide .pg-win { width: min(100%, 780px); }
.hs-scene .pg-body { min-height: 300px; justify-content: center; gap: 14px; }
.hs-bars { gap: 18px; }
.hs-bars li, .hs-col .hs-bars li { grid-template-columns: 116px minmax(0, 1fr) 28px; white-space: nowrap; }
.hs-people { display: grid; grid-template-columns: repeat(4, auto) 1fr; gap: 10px; margin-top: 8px; }
.hs-people > span { display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px 4px 4px; border: 1px solid var(--line); border-radius: 99px; background: var(--white); font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; color: var(--ink-2); }
.hs-people .hs-note { grid-column: 1 / -1; margin: 6px 0 0; }
.hs-scene .pg-lockrow.open em { font-size: 15px; font-weight: 500; color: var(--ink); }
.hs-scene .pg-lockrow span { padding: 12px 14px; font-size: 15px; }
@media (max-width: 900px) { .hs-people { grid-template-columns: repeat(2, auto); } .hs-scene .pg-body { min-height: 0; } }
.hx-links { gap: 4px; position: relative; }
.hx-links a { padding: 7px 14px; border-radius: 99px; transition: color .2s, background-color .2s; }
.hx-links a { position: relative; }
.hx-links a[aria-current="page"] { color: var(--ink); font-weight: 500; }
.hx-links .hx-x { position: absolute; left: 0; bottom: -4px; width: 9px; height: 9px; opacity: 0; pointer-events: none; will-change: transform; background: var(--accent); -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M1.8 1.8l6.4 6.4M8.2 1.8L1.8 8.2' stroke='%23000' stroke-width='2.2' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M1.8 1.8l6.4 6.4M8.2 1.8L1.8 8.2' stroke='%23000' stroke-width='2.2' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat; }
@media (max-width: 900px) { .hx-links { gap: 0; } }
.hs-act, .hs-rank li.hs-sel { position: relative; }
.hs-cur { position: absolute; left: 52px; top: 16px; z-index: 3; display: flex; align-items: flex-start; color: var(--accent); pointer-events: none; opacity: 0; animation: hs-cur 2.2s cubic-bezier(0.22, 1, 0.36, 1) var(--d, 0s) both; filter: drop-shadow(0 2px 4px oklch(0.3 0.05 50 / 0.3)); }
.hs-cur em { margin: 16px 0 0 -3px; padding: 2px 8px; border-radius: 99px; background: var(--accent); color: var(--white); font-style: normal; font-size: 12px; font-weight: 500; line-height: 1.4; }
.hs-rank li.hs-sel .hs-cur { left: 150px; top: 28px; }
.hs-rank li.hs-sel { animation: hs-slide 1s cubic-bezier(0.65, 0, 0.35, 1) var(--d, 0s) both, hs-sel .5s ease 3.4s both; }
@keyframes hs-cur {
  0% { opacity: 0; transform: translate(260px, -70px); }
  12% { opacity: 1; }
  45% { opacity: 1; transform: translate(0, 0) scale(1); }
  52% { transform: translate(0, 0) scale(0.82); }
  60% { transform: translate(0, 0) scale(1); }
  85% { opacity: 1; transform: translate(0, 0); }
  100% { opacity: 0; transform: translate(14px, 8px); }
}
@keyframes hs-sel { to { border-color: var(--btn); box-shadow: 0 0 0 3px oklch(0.935 0.045 285 / 0.9); } }
@media (prefers-reduced-motion: reduce) { .hs-cur { display: none; } }
.hs-sum { margin: 0; padding: 12px 14px; border-radius: 12px; background: var(--wash); border: 1px solid var(--line); font-size: 14px; line-height: 1.5; color: var(--ink-2); text-align: left; }
.hs-sum b { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 12px; font-weight: 500; color: var(--btn); }

/* ── Candidates page ── */
.cd-star { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.cd-star li { min-width: 32px; padding: 0 10px; height: 32px; border-radius: 8px; display: grid; place-items: center; white-space: nowrap; box-sizing: border-box; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; font-weight: 500; background: var(--white); border: 1px solid var(--btn); color: var(--btn); }
.cd-star li.miss { border: 1px dashed var(--accent); color: var(--accent-ink, var(--accent)); background: transparent; }
.cd-add { background: color-mix(in oklab, var(--btn) 22%, white); color: var(--ink); border-radius: 4px; padding: 1px 0; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.cd .hc-top > span { font-size: 13px; color: var(--ink-3); }
.cd-cmp ul.no li { color: var(--ink-3); }
.cd-cmp ul.no li::before { background: var(--ink-3); }
@media (prefers-reduced-motion: reduce) { .cd-res, .cd-lines li { animation: none; } }

/* candidates: rewrite story, aim, memory, trust */
@keyframes rwpop { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.tg { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 6fr); gap: 56px; align-items: start; }
.tg h3 { margin: 0 0 12px; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.tg-ctl .hv-chips { margin-bottom: 28px; }

.mm { padding: 28px; border-radius: 20px; border: 1px solid var(--line); background: var(--wash); }
.mm-key i, .mm-bars i.a { background: var(--line-2); }
.mm-key i.b, .mm-bars i.b { background: var(--btn); }

.tr { padding: 56px 0; }

@container (max-width: 900px) {
  .rw-grid, .tg { grid-template-columns: 1fr; gap: 28px; }
  .tg-out { padding: 20px; }
  .tg-out ol { font-size: 16px; }
  .mm { padding: 18px; }
  .mm-cols { gap: 6px; }
  .mm-bars { height: 140px; }
  .tr-row { grid-template-columns: 1fr; gap: 28px; }
}
@media (prefers-reduced-motion: reduce) { .rw-step, .rw-meter i, .mm-bars i { transition: none; } .rw-score b, .tg-out { animation: none; } }

/* candidates: composition, built on the shared tokens and frames */
.vr { background: var(--white); border-radius: 18px; overflow: hidden; display: flex; flex-direction: column; }
.vr-wave.still i { animation: none; transform: scaleY(.18); opacity: .3; }
@keyframes vr-wave { 0%, 100% { transform: scaleY(.2); } 50% { transform: scaleY(1); } }
.vr-met.on { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .vr-wave i, .vr-live i { animation: none; } }
.vr-ready.ok .vr-ready-top b { color: var(--btn); }
.vr-ready.ok > i b { background: var(--btn); }
.cx-hero { padding: 72px 0 88px; }
.cx-hero-in { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 56px; align-items: center; }
.cx-h1 { margin: 16px 0 0; font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 52px; line-height: 1.06; letter-spacing: -0.03em; font-weight: 600; text-wrap: balance; }
.cx-h1 b { font-weight: inherit; }
.cx-lede { margin: 12px 0 0; font-size: 16px; line-height: 1.5; color: var(--ink-2); max-width: 46ch; text-wrap: pretty; }
.cx-cta { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; margin-top: 32px; }
.cx-facts { list-style: none; display: flex; gap: 28px; flex-wrap: wrap; margin: 36px 0 0; padding: 22px 0 0; border-top: 1px solid var(--line); font-size: 14px; color: var(--ink-2); }
.cx-facts b { font-size: 20px; font-weight: 600; color: var(--ink); margin-right: 6px; letter-spacing: -0.02em; }
.hx-stage.cx-demo { margin-top: 0; padding: 28px; }
@container (max-width: 900px) {
  .cx-hero { padding: 32px 0 56px; }
  .cx-hero-in { grid-template-columns: 1fr; gap: 32px; }
  .cx-h1 { font-size: 34px; }
  .cx-facts { display: grid; grid-template-columns: repeat(3, auto); justify-content: space-between; gap: 12px; margin-top: 28px; font-size: 13px; }
  .cx-facts li { display: flex; flex-direction: column; gap: 2px; }
  .cx-facts b { margin-right: 0; }
  .vr-top { gap: 10px; padding: 12px 14px; flex-wrap: nowrap; }
  .vr-top > span:nth-child(2) { display: none; }
  .cx-lede { font-size: 15px; }
  .hx-stage.cx-demo { padding: 12px; }
  .cx-cta { flex-direction: column; align-items: stretch; gap: 14px; }
  .cx-cta .hx-btn { width: 100%; }
}

/* candidates: journey sections */
.cb { position: relative; display: block; height: 8px; border-radius: 999px; background: var(--line); }
.cb b { display: block; height: 100%; border-radius: 999px; background: var(--btn); }
.cb.low b { background: var(--accent); }
.cb u { position: absolute; top: -3px; bottom: -3px; width: 1px; background: var(--ink-3); }
.rd { display: grid; gap: 28px; }
.rv { width: 100%; }
.rv small { font-family: 'Geist Mono', monospace; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.rv-hr-grid li.bad { background: var(--accent-tint); border-color: var(--accent); }
.rv-hr-grid li.bad em, .rv-hr-grid li.bad small { color: var(--accent-ink); }
.rv-hr-grid li.bad i b { background: var(--accent); }
.rv-beh-doc li.bad { background: color-mix(in oklab, var(--btn) 14%, white); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--btn) 45%, white); }
.rv-beh-doc li.bad svg { color: var(--accent-ink); }
.rv-tech-bars i.low b { background: var(--accent); }
.rv-tech-chat .q { background: var(--wash); border-top-left-radius: 4px; }
.rv-tech-chat .me { align-self: flex-end; background: var(--btn); color: #fff; border-top-right-radius: 4px; }
.rv-pay-line span.up, .rv-pay-line span.dn { }
.rv-pay-line span.bad::after { background: var(--accent); }
.rv-pay-line span.bad b { color: var(--accent-ink); }
.rv-camp li.ok span { color: var(--btn); }
.rv-camp li.bad { border: 1.5px dashed var(--accent); background: var(--accent-tint); }
.rv-camp li.bad span { color: var(--accent-ink); }

.rd-cap { display: flex; align-items: flex-start; justify-content: space-between; gap: 32px; width: 100%; max-width: 1040px; margin: 24px auto 0; box-sizing: border-box; }
.rd-cap p { margin: 0; max-width: 60ch; font-family: inherit; font-size: 17px; line-height: 1.5; letter-spacing: 0; font-weight: 500; color: var(--ink); text-wrap: pretty; }
.rd-cap p b { font-weight: 600; }
.rd-gate { display: flex; align-items: flex-start; gap: 8px; max-width: 60ch; margin-top: 8px; font-size: 15px; line-height: 1.5; color: var(--ink-3); }
.rd-gate svg { flex: none; margin-top: 4px; }
.rd-ico, .ri-ico, .dv-ico, .gp-ico, .pf-ico { flex: none; display: inline-grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: var(--accent-tint); color: var(--btn); }
.ri { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 32px; align-items: center; }
.ri-main.hx-stage { margin: 0; padding: 28px; }
@container (max-width: 900px) { .dv-pow { flex-wrap: wrap; gap: 12px 16px; } }
.hx-rv .cb b, .hx-rv .ri-track i { transition: width 1s cubic-bezier(0.22, 1, 0.36, 1) .25s; }
.hx-rv:not(.on) .cb b, .hx-rv:not(.on) .ri-track i { width: 0 !important; }
@media (prefers-reduced-motion: reduce) { .hx-rv .cb b, .hx-rv .ri-track i { transition: none; } }
.cx-dark .hx-end { background: radial-gradient(90% 120% at 15% 0%, oklch(0.34 0.12 285) 0%, transparent 60%), oklch(0.22 0.06 285); border-color: oklch(0.3 0.06 285); }
.cx-dark .hx-end .hx-kicker { color: oklch(0.82 0.08 285); }
.cx-dark .hx-end .hx-h2 { color: oklch(0.97 0.01 285); }
.cx-dark .hx-end .hx-h2 b { color: oklch(0.86 0.1 285); }
.cx-dark .hx-end p, .cx-dark .hx-endnote { color: oklch(0.85 0.02 285); }
.cx-dark .hx-endnote li::before { filter: invert(1) brightness(1.6); }
.cx-dark .hx-btn:not(.alt) { background: var(--white); color: oklch(0.22 0.06 285); }
.cx-dark .hx-btn.alt { background: transparent; color: oklch(0.97 0.01 285); border-color: oklch(0.5 0.06 285); }
.cx-dark .hx-btn.alt:hover { background: oklch(0.3 0.07 285); }
.vs { max-width: 1040px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1.15fr; gap: 20px; align-items: stretch; }
.dg { max-width: 940px; margin: 0 auto; }
.dg ul { list-style: none; margin: 0; padding: 0; border: 1px solid var(--line); border-radius: 20px; background: var(--paper); overflow: hidden; }
.dg li { display: grid; grid-template-columns: 40px minmax(0, 1fr) 200px minmax(0, 200px); gap: 20px; align-items: center; padding: 20px 24px; border-top: 1px solid var(--line); }
.dg li:first-child { border-top: 0; }
.dg-track .zone { position: absolute; top: 0; bottom: 0; border-radius: 99px; background: color-mix(in oklab, var(--btn) 14%, white); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--btn) 45%, white); }
.dg-track .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; background: var(--btn); opacity: .35; }
.hx-rv .hw li, .hx-rv .vs-col li, .hx-rv .dg li, .hx-rv .pf-list li, .hx-rv .pf-ev li { transition: opacity .6s cubic-bezier(0.22, 1, 0.36, 1), transform .6s cubic-bezier(0.22, 1, 0.36, 1); transition-delay: calc(var(--i, 0) * 110ms + 150ms); }
.hx-rv:not(.on) .hw li, .hx-rv:not(.on) .vs-col li, .hx-rv:not(.on) .dg li, .hx-rv:not(.on) .pf-list li, .hx-rv:not(.on) .pf-ev li { opacity: 0; transform: translateY(14px); }
.hx-rv .dg-track u { transition: left 1s cubic-bezier(0.22, 1, 0.36, 1) .4s; }
.hx-rv:not(.on) .dg-track u { left: 0 !important; }
.pf-list { position: relative; }
.pf-list::before { content: ""; position: absolute; left: 19px; top: 20px; bottom: 20px; border-left: 2px solid var(--line); }
.pf-ico { position: relative; background: var(--paper); }
@media (prefers-reduced-motion: reduce) {
  .hx-rv .hw li, .hx-rv .vs-col li, .hx-rv .dg li, .hx-rv .pf-list li, .hx-rv .pf-ev li, .hx-rv .dg-track u { transition: none; }
}
.gp { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0; background: var(--paper); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
.pf { display: grid; grid-template-columns: minmax(0, 6fr) minmax(0, 5fr); gap: 40px; align-items: center; }
.pf-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 22px; }
.pf-list li { display: flex; gap: 16px; align-items: flex-start; }
.pf-list h3 { margin: 0; font-size: 17px; font-weight: 600; }
.pf-list p { margin: 4px 0 0; font-size: 15px; color: var(--ink-2); line-height: 1.5; }
.pf-card.hx-stage { margin: 0; padding: 24px; }
.pf-in { background: var(--paper); border: 1px solid var(--line); border-radius: 16px; padding: 26px; }
.pf-in h3 { margin: 12px 0 0; font-family: 'Bricolage Grotesque', 'Geist', sans-serif; font-size: 26px; font-weight: 600; letter-spacing: -0.02em; }
.pf-meta { margin: 4px 0 0; color: var(--ink-3); font-size: 14px; }
.pf-ev { list-style: none; margin: 20px 0 0; padding: 0; }
.pf-ev li { display: flex; align-items: center; gap: 10px; padding: 11px 0; border-top: 1px solid var(--line); font-size: 15px; }
.pf-ev li svg { color: var(--btn); }
.pf-ev li em { margin-left: auto; font-style: normal; font-size: 12px; font-family: 'Geist Mono', monospace; color: var(--btn); }
.pf-ev li.no svg, .pf-ev li.no em { color: var(--ink-3); }
.pf-lock { display: flex; align-items: center; gap: 8px; margin: 16px 0 0; font-size: 13px; color: var(--ink-3); }
@container (max-width: 900px) {
  .rd-tabs { flex-wrap: nowrap; overflow-x: auto; justify-content: flex-start; gap: 22px; scrollbar-width: none; -webkit-mask-image: linear-gradient(90deg, #000 85%, transparent); mask-image: linear-gradient(90deg, #000 85%, transparent); padding-right: 40px; }
  .rd-tab { flex: none; font-size: 16px; }
  .rd-stage { padding: 16px; min-height: 0; }
  .rv-hr-grid { grid-template-columns: 1fr 1fr; }
  .rv-beh, .rv-tech { grid-template-columns: 1fr; }
  .rv-beh-doc li { grid-template-columns: 18px 1fr; }
  .rv-beh-doc li span { grid-column: 2; }
  .rv-tech-bars li { grid-template-columns: 80px 1fr 52px; }
  .rv-pay-big b { font-size: 56px; }
  .rv-pay-line { margin: 32px 16px 0; }
  .rv-camp ol { grid-template-columns: 1fr; }
  .rv-camp li { min-height: 0; }
  .rd-cap { flex-direction: column; gap: 18px; }
  .rd-cap p { font-size: 16px; }
  .ri, .dv, .pf { grid-template-columns: 1fr; gap: 24px; }
  .ri-main.hx-stage, .pf-card.hx-stage { padding: 12px; }
  .ri-card, .pf-in { padding: 20px; }
  .ri-num strong { font-size: 56px; }
  .ri-pillars li { grid-template-columns: 40px 1fr 36px; }
  .ri-pillars li .cb { grid-column: 2 / -1; grid-row: 2; }
  .vs { grid-template-columns: 1fr; }
  .dg li { grid-template-columns: 40px minmax(0, 1fr); row-gap: 12px; }
  .dg-v, .dg-g { grid-column: 2; }
  .gp { grid-template-columns: 1fr; }
  .gp-col { border-right: 0; border-bottom: 1px solid var(--line); }
  .gp-col:last-child { border-bottom: 0; }
}
.pf-cta { margin: 40px 0 0; text-align: center; }

/* ── Candidates page rules: one spacing, type and radius scale ──
   Space: 8 / 16 / 24 / 32 / 48 / 64 / 96. Radius: 24 surface, 12 inner, pill.
   Type: h1 56, h2 44, h3 22, body 16, small 14, kicker 12. Gradient stage = product UI only. */
.cx-hero { padding: 72px 0 96px; }
.cx-hero-in, .rw-grid, .pf { gap: 64px; }
.pg-sec { padding: 96px 0; }
.hx-closing { padding-top: 96px; }
.em-head, .em-head.ctr { margin: 0 auto 64px; max-width: 720px; text-align: center; }
.em-head .hx-h2, .rw .hx-h2 { margin-top: 16px; font-size: 36px; line-height: 1.1; letter-spacing: -0.03em; font-weight: 600; }
.em-head p { margin: 10px auto 0; max-width: 48ch; font-size: 16px; line-height: 1.5; color: var(--ink-2); }
.cx-h1 { font-size: 52px; line-height: 1.06; }
.cx-lede { margin-top: 12px; font-size: 16px; line-height: 1.5; }
.cx-cta { margin-top: 32px; }
.cx-facts { margin-top: 32px; }
.hw b, .pf-list h3, .rw-step h3, .pf-in h3, .pp-price b + span { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; }
.hw b, .pf-list h3, .rw-step h3, .pf-in h3 { font-size: 22px; line-height: 1.2; font-weight: 600; letter-spacing: -0.02em; }
.hw p, .pf-list p, .rw-step p { font-size: 16px; line-height: 1.55; color: var(--ink-2); }
.rw-step p, .pf-list p, .hw p { margin-top: 8px; }
.pf-list { gap: 32px; }
.pf-list li { gap: 16px; }
.pf-list::before { display: none; }
.pf-ico { border: 1px solid var(--line); border-radius: 12px; }
.pf { align-items: stretch; }
.pf-list { align-content: center; }
.hx-stage, .pg-stage, .rw-pane.hx-stage-warm, .pf-card.hx-stage { border-radius: 24px; }
.hx-win, .pg-win { border-radius: 12px 12px 0 0; }
.pg-win { border-radius: 12px; }
.pf-in, .vr-say { border-radius: 12px; }
.hx-end { border-radius: 24px; }
.pf-cta { margin-top: 48px; }
@container (max-width: 900px) {
  .cx-hero { padding: 40px 0 64px; }
  .cx-hero-in, .rw-grid, .pf { gap: 40px; }
  .pg-sec, .hx-closing { padding-top: 64px; padding-bottom: 64px; }
  .em-head, .em-head.ctr { margin-bottom: 40px; }
  .em-head .hx-h2, .rw .hx-h2 { font-size: 28px; }
  .cx-h1 { font-size: 34px; }
}
.cx-close .hx-end { padding: 64px 40px 52px; border-radius: 24px; }
.cx-close .hx-end .hx-h2 { margin-top: 12px; font-size: 36px; line-height: 1.1; }
.cx-close .hx-end p { margin-top: 12px; font-size: 16px; }
@container (max-width: 900px) { .cx-close .hx-end { padding: 48px 24px; } .cx-close .hx-end .hx-h2 { font-size: 28px; } }

/* ── How it works (tabbed stage) ── */
.hi { width: 100%; }
.hi-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
.hi-tab { position: relative; display: grid; grid-template-columns: 32px 1fr; column-gap: 16px; row-gap: 8px; align-content: start; text-align: left; padding: 0 0 24px; border: 0; background: none; color: var(--ink); cursor: pointer; font: inherit; opacity: .55; transition: opacity .25s; }
.hi-tab.on, .hi-tab:hover { opacity: 1; }
.hi-tab:focus-visible { outline: 2px solid var(--btn); outline-offset: 6px; border-radius: 12px; }
.hi-num { grid-row: 1; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-size: 14px; font-weight: 600; background: var(--wash); color: var(--ink-2); border: 1px solid var(--line); transition: background .25s, color .25s; }
.hi-tab.on .hi-num { background: var(--btn); border-color: var(--btn); color: var(--white); }
.hi-tab b { grid-column: 2; font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 22px; line-height: 1.2; font-weight: 600; letter-spacing: -0.02em; align-self: center; }
.hi-d { grid-column: 2; font-size: 16px; line-height: 1.55; color: var(--ink-2); }
.hi-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; border-radius: 99px; background: var(--line); overflow: hidden; }
.hi-bar u { display: block; height: 100%; background: var(--btn); border-radius: inherit; text-decoration: none; transform-origin: left; }
.hi-bar u.run { animation: hi-fill 7s linear forwards; }
.hi-bar u.full { width: 100%; }
@keyframes hi-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.hi-stage { margin-top: 32px; padding: 32px; border-radius: 24px; }
.hi-stage .pg-win { max-width: 560px; margin: 0 auto; }
.hi-p { min-height: 260px; padding: 32px; display: flex; flex-direction: column; justify-content: center; gap: 24px; animation: hi-in .35s cubic-bezier(.22,1,.36,1); }
@keyframes hi-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.hi-q { margin: 0; font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 22px; line-height: 1.3; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); }
.hi-hint { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--ink-3); }
.hi-wave { display: flex; align-items: center; justify-content: center; gap: 5px; height: 40px; }
.hi-wave i { width: 5px; border-radius: 3px; background: var(--btn); animation: hx-wv .9s ease-in-out infinite alternate; animation-delay: var(--d); }
.hi-sc { display: flex; align-items: center; justify-content: center; gap: 32px; color: var(--ink-3); }
.hi-sc div { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.hi-sc small { font-size: 14px; color: var(--ink-3); }
.hi-sc b { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 56px; line-height: 1; font-weight: 600; letter-spacing: -0.035em; color: var(--ink-3); }
.hi-sc b.up { color: var(--btn); }
.hi-tips, .hi-vis { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.hi-tips li { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-radius: 12px; background: var(--wash); font-size: 16px; color: var(--ink-2); }
.hi-tips svg { color: var(--btn); flex: none; }
.hi-vis li { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 16px; border-radius: 12px; background: var(--wash); font-size: 16px; color: var(--ink); }
.hi-vis em { font-style: normal; font-size: 14px; color: var(--ink-3); text-align: right; }
.hi-vis em.on { color: var(--btn); font-weight: 600; }

/* ── See it in action (click-through fixes) ── */
.ia-grid { display: grid; grid-template-columns: minmax(0, 6fr) minmax(0, 5fr); gap: 48px; align-items: center; }
.ia-stage { margin: 0; padding: 32px; border-radius: 24px; }
.ia-card { padding: 24px; display: grid; gap: 16px; }
.ia-q { margin: 0; font-size: 14px; color: var(--ink-3); }
.ia-a { margin: 0; font-size: 18px; line-height: 1.6; color: var(--ink); min-height: 8em; text-wrap: pretty; }
.ia-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; }
.ia-score { display: flex; align-items: baseline; gap: 8px; }
.ia-score b { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 56px; line-height: 1; font-weight: 600; letter-spacing: -0.035em; color: var(--btn); font-variant-numeric: tabular-nums; }
.ia-score span { font-size: 14px; color: var(--ink-3); white-space: nowrap; }
.ia-meter { height: 6px; border-radius: 99px; background: var(--wash); overflow: hidden; }
.ia-meter i { display: block; height: 100%; background: var(--btn); border-radius: inherit; transition: width .6s cubic-bezier(.22,1,.36,1); }
.ia-fixes ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; }
.ia-fix { width: 100%; display: grid; grid-template-columns: 32px 1fr auto; gap: 16px; align-items: start; text-align: left; padding: 24px; border-radius: 24px; border: 1px solid var(--line); background: var(--white); color: var(--ink); cursor: pointer; font: inherit; transition: border-color .25s, background .25s; }
.ia-fix:hover { border-color: color-mix(in oklab, var(--btn) 40%, white); }
.ia-fix:focus-visible { outline: 2px solid var(--btn); outline-offset: 3px; }
.ia-fix.done { background: color-mix(in oklab, var(--btn) 5%, white); border-color: color-mix(in oklab, var(--btn) 22%, white); }
.ia-n { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-size: 14px; font-weight: 600; background: var(--wash); color: var(--ink-2); border: 1px solid var(--line); transition: background .25s, color .25s; }
.ia-fix.done .ia-n { background: var(--btn); border-color: var(--btn); color: var(--white); }
.ia-t { display: grid; gap: 8px; }
.ia-t b { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 22px; line-height: 1.2; font-weight: 600; letter-spacing: -0.02em; }
.ia-t span { font-size: 16px; line-height: 1.55; color: var(--ink-2); }
.ia-fix em { font-style: normal; font-size: 14px; font-weight: 600; padding: 4px 12px; border-radius: 99px; background: var(--wash); color: var(--ink-3); transition: background .25s, color .25s; }
.ia-fix.done em { background: var(--btn); color: var(--white); }
.ia-hint { margin: 0 0 16px; font-size: 14px; color: var(--ink-3); }
.ia-reset { margin-top: 16px; padding: 8px 0; border: 0; background: none; font: inherit; font-size: 14px; color: var(--ink-3); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.ia-reset:hover { color: var(--ink); }
@media (prefers-reduced-motion: reduce) { .hi-wave i, .hi-p { animation: none; } .ia-meter i { transition: none; } }
@container (max-width: 900px) {
  .hi-tabs { grid-template-columns: 1fr; gap: 0; }
  .hi-tab { padding: 16px 0; }
  .hi-d { display: none; }
  .hi-tab.on .hi-d { display: block; }
  .hi-stage, .ia-stage { padding: 16px; margin-top: 24px; }
  .hi-p { padding: 24px 16px; min-height: 200px; }
  .hi-sc b, .ia-score b { font-size: 44px; }
  .ia-grid { grid-template-columns: 1fr; gap: 24px; }
  .ia-a { font-size: 16px; min-height: 9.5em; }
  .ia-fix { padding: 16px; gap: 12px; }
}

/* ── Pricing (slide-to-plan receipt) ── */
.pq { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; align-items: stretch; }
.pq-card { display: flex; flex-direction: column; gap: 16px; padding: 32px; border-radius: 24px; background: var(--white); border: 1px solid var(--line); }
.pq .pq-card.feat { margin: 0; background: linear-gradient(135deg, oklch(0.945 0.04 55) 0%, oklch(0.95 0.035 320) 50%, oklch(0.935 0.045 285) 100%); padding: 32px; border-radius: 24px; border-color: transparent; }
.pq-name { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.pq-name i { font-style: normal; padding: 4px 12px; border-radius: 99px; background: var(--white); color: var(--btn); letter-spacing: .04em; }
.pq-price { margin: 0; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.pq-price b { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 56px; line-height: 1; font-weight: 600; letter-spacing: -0.035em; color: var(--ink); }
.pq-price span { font-size: 16px; color: var(--ink-2); }
.pq-sess { margin: 0; font-size: 16px; font-weight: 600; color: var(--ink); }
.pq-note { margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: var(--ink-2); flex: 1; }
.pq-card .hx-btn { justify-content: center; }
.pq-foot { margin: 32px 0 0; text-align: center; font-size: 14px; }
.pq-foot a { color: var(--ink-3); text-decoration: underline; text-underline-offset: 3px; }
.pq-foot a:hover { color: var(--ink); }
@container (max-width: 900px) {
  .pq { grid-template-columns: 1fr; }
  .pq .pq-card, .pq .pq-card.feat { padding: 24px; }
  .pq-price b { font-size: 44px; }
}

/* ── Hero: voice orb ── */
.vo { display: grid; justify-items: center; gap: 24px; }
.vo-q { display: flex; align-items: center; gap: 12px; max-width: 100%; padding: 12px 20px 12px 12px; border-radius: 24px; background: var(--white); box-shadow: 0 8px 24px color-mix(in oklab, var(--btn) 10%, transparent); }
.vo-q p { margin: 0; font-size: 16px; line-height: 1.35; font-weight: 500; color: var(--ink); }
.vo-qx { flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; font-size: 15px; color: var(--btn); background: color-mix(in oklab, var(--btn) 12%, white); }
.vo-orb { position: relative; width: 176px; height: 176px; }
.vo-orb svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible; }
.vo-track { fill: none; stroke: color-mix(in oklab, var(--btn) 14%, white); stroke-width: 8; }
.vo-arc { fill: none; stroke: #d4452f; stroke-width: 8; stroke-linecap: round; stroke-dasharray: 477.5; stroke-dashoffset: 477.5; transition: stroke-dashoffset 1.1s cubic-bezier(.22, 1, .36, 1), stroke .4s; }
.vo-orb.ok .vo-arc { stroke: var(--btn); }
.vo-pass { stroke: var(--ink); stroke-width: 3; stroke-linecap: round; }
.vo-ripple { position: absolute; inset: 22px; border-radius: 50%; border: 2px solid var(--btn); opacity: 0; animation: vo-ripple 2s ease-out infinite; }
.vo-orb.done .vo-ripple { display: none; }
@keyframes vo-ripple { 0% { transform: scale(1); opacity: .35; } 100% { transform: scale(1.35); opacity: 0; } }
.vo-core { position: absolute; inset: 22px; border-radius: 50%; background: var(--white); box-shadow: 0 8px 32px color-mix(in oklab, var(--btn) 16%, transparent); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--btn); }
.vo-core b { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 48px; line-height: 1; font-weight: 600; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; color: #a2321f; }
.vo-orb.ok .vo-core b { color: var(--btn); }
.vo-core span { font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); }
.vo-cap { margin: 0; width: 100%; min-height: 116px; padding: 16px 20px; border-radius: 12px; background: var(--white); font-size: 17px; line-height: 1.55; color: var(--ink); text-align: center; }
.vo-fill { background: #fbe3dc; color: #a2321f; border-radius: 4px; padding: 0 3px; box-shadow: inset 0 -2px 0 #d4452f; animation: vo-pop .35s cubic-bezier(.22, 1, .36, 1); display: inline-block; margin-right: .3em; }
@keyframes vo-pop { 0% { transform: translateY(-8px) scale(1.15); } 100% { transform: none; } }
.vo-row { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px 16px; width: 100%; }
.vo-chip { padding: 6px 12px; border-radius: 99px; font-size: 14px; font-weight: 600; background: var(--white); color: var(--ink-2); }
.vo-chip.warn { background: #fbe3dc; color: #a2321f; }
.vo-tip { font-size: 14px; color: var(--ink-2); }
@media (prefers-reduced-motion: reduce) { .vo-ripple, .vo-fill { animation: none; } }
@container (max-width: 900px) { .vo-orb { width: 152px; height: 152px; } .vo-core b { font-size: 40px; } .vo-cap { font-size: 16px; min-height: 140px; } }
`;
