/* HireStepX — Interview canvas / styles
   CSS for visualizer animations, microinteractions, and responsive
   tuning. Mirrors the auth canvas pattern (one inline <style> tag
   injected at the top of the page composition). */

export const INTERVIEW_STYLES = `
  /* Webfont fallback — only loads if host page hasn't already. */
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
  @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap');

  /* ─── Page entrance ─── */
  @keyframes hsx-fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .hsx-iv-stage > * {
    animation: hsx-fade-up 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .hsx-iv-stage > *:nth-child(1) { animation-delay: 0ms;  }
  .hsx-iv-stage > *:nth-child(2) { animation-delay: 60ms; }
  .hsx-iv-stage > *:nth-child(3) { animation-delay: 140ms;}
  .hsx-iv-stage > *:nth-child(4) { animation-delay: 240ms;}
  .hsx-iv-stage > *:nth-child(5) { animation-delay: 320ms;}
  .hsx-iv-stage > *:nth-child(n+6) { animation-delay: 380ms;}

  /* ─── Visualizer base ─── */
  .hsx-viz {
    display: inline-block;
    position: relative;
    transform-origin: 50% 50%;
    will-change: transform, opacity, filter;
  }
  .hsx-viz svg { display: block; }

  /* idle — barely-there breath, dots quiet */
  @keyframes hsx-viz-breath {
    0%, 100% { transform: scale(1);    opacity: 0.95; }
    50%      { transform: scale(1.012); opacity: 1;    }
  }
  .hsx-viz-idle { animation: hsx-viz-breath 5.6s ease-in-out infinite; }

  /* ai-speaking — gentle outward pulse synced to ~speech cadence */
  @keyframes hsx-viz-speak {
    0%   { transform: scale(1);     filter: brightness(1); }
    35%  { transform: scale(1.06);  filter: brightness(1.06); }
    70%  { transform: scale(0.99);  filter: brightness(0.99); }
    100% { transform: scale(1);     filter: brightness(1); }
  }
  .hsx-viz-ai-speaking {
    animation: hsx-viz-speak 2.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
  }

  /* ai-thinking — slow swirl ripple + faint rotate */
  @keyframes hsx-viz-think {
    0%   { transform: rotate(0deg)   scale(1);    opacity: 0.85; }
    50%  { transform: rotate(180deg) scale(1.02); opacity: 1;    }
    100% { transform: rotate(360deg) scale(1);    opacity: 0.85; }
  }
  .hsx-viz-ai-thinking {
    animation: hsx-viz-think 7.2s linear infinite;
  }

  /* user-speaking — faster, tighter pulse — feels like mic energy */
  @keyframes hsx-viz-listen {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.045); }
  }
  .hsx-viz-user-speaking {
    animation: hsx-viz-listen 1.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
  }

  /* warning — slow heartbeat-ish, signals attention without alarm */
  @keyframes hsx-viz-warn {
    0%, 100% { opacity: 0.85; }
    50%      { opacity: 1; }
  }
  .hsx-viz-warning {
    animation: hsx-viz-warn 1.8s ease-in-out infinite;
  }

  /* Halo — sits behind the visualizer, color-tinted per state */
  .hsx-viz-halo {
    position: absolute; inset: -28px;
    border-radius: 999px;
    pointer-events: none;
    transition: background 360ms ease, opacity 360ms ease;
  }
  .hsx-viz-halo--idle       { background: radial-gradient(closest-side, rgba(110,103,89,0.06), transparent 70%); }
  .hsx-viz-halo--ai-speaking{ background: radial-gradient(closest-side, rgba(14,12,8,0.08),  transparent 70%); }
  .hsx-viz-halo--ai-thinking{ background: radial-gradient(closest-side, rgba(180,83,9,0.10), transparent 70%); }
  .hsx-viz-halo--user-speaking{ background: radial-gradient(closest-side, rgba(49,46,129,0.14), transparent 70%); }
  .hsx-viz-halo--warning    { background: radial-gradient(closest-side, rgba(161,98,7,0.12),  transparent 70%); }

  /* Voice rings — concentric radar pulses for user-speaking state.
     Drawn as absolutely-positioned bordered circles that scale + fade. */
  @keyframes hsx-ring-pulse {
    0%   { transform: scale(0.92); opacity: 0.55; }
    100% { transform: scale(1.45); opacity: 0;    }
  }
  .hsx-iv-ring {
    position: absolute; inset: 0;
    border-radius: 999px;
    border: 1px solid rgba(49,46,129,0.35);
    pointer-events: none;
    animation: hsx-ring-pulse 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite;
  }
  .hsx-iv-ring--delay { animation-delay: 1.2s; }

  /* ─── Indigo links — animated underline on hover ─── */
  .hsx-link-indigo {
    position: relative;
    transition: color 160ms ease;
  }
  .hsx-link-indigo::after {
    content: '';
    position: absolute;
    left: 0; right: 0; bottom: -2px;
    height: 1px;
    background: currentColor;
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .hsx-link-indigo:hover::after { transform: scaleX(1); }

  /* End-button — copper hover wash, never red */
  .hsx-iv-endbtn { transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease; }
  .hsx-iv-endbtn:hover {
    background: rgba(180,83,9,0.06);
    border-color: rgba(180,83,9,0.35);
  }
  .hsx-iv-endbtn:active { transform: translateY(1px); }

  /* Persona name — italic copper accent inside name when AI */
  .hsx-iv-persona-x { color: #B45309; font-style: italic; }

  /* Caption track — fixed line height so it doesn't reflow on token arrival */
  .hsx-iv-caption {
    min-height: 1.5em;
    transition: opacity 200ms ease;
  }

  /* Type-mode textarea — calm focus ring, no jumpy resize */
  .hsx-iv-type {
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }
  .hsx-iv-type:focus {
    outline: none;
    border-color: #312E81;
    box-shadow: 0 0 0 4px rgba(49,46,129,0.14);
  }

  /* ─── Spinner (Reconnecting screen) ─── */
  @keyframes hsx-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .hsx-spin { animation: hsx-spin 900ms linear infinite; transform-origin: 50% 50%; }

  /* ─── Caret blink in transcript ─── */
  @keyframes hsx-blink { 50% { opacity: 0; } }

  /* ─── Save toast — slide in from bottom-left, then dwell ─── */
  @keyframes hsx-toast-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .hsx-iv-toast { animation: hsx-toast-in 280ms cubic-bezier(0.16, 1, 0.3, 1) both; }

  /* End-confirm overlay backdrop fade */
  @keyframes hsx-overlay-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes hsx-card-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .hsx-iv-overlay { animation: hsx-overlay-in 200ms ease both; }
  .hsx-iv-overlay-card { animation: hsx-card-in 280ms cubic-bezier(0.16, 1, 0.3, 1) both; }

  /* Push-to-talk button — soft glow when active */
  .hsx-iv-keycap[data-state="active"] {
    box-shadow: 0 0 0 6px rgba(49,46,129,0.10), 0 6px 22px -6px rgba(49,46,129,0.45);
  }

  /* ─── Reduced motion ─── */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  /* ─── Responsive ─── */
  @media (max-width: 960px) {
    .hsx-iv-topbar { padding: 22px 28px !important; }
    .hsx-iv-footer { padding: 18px 28px !important; }
    .hsx-iv-stage  { padding: 24px 28px !important; gap: 28px !important; }
  }
  @media (max-width: 640px) {
    .hsx-iv-topbar { padding: 16px 18px !important; }
    .hsx-iv-footer { padding: 14px 18px !important; }
    .hsx-iv-stage  { padding: 20px 18px 28px !important; gap: 22px !important; }
    .hsx-iv-meta-mobile-hide { display: none !important; }
  }
`;
