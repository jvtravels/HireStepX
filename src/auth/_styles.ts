/* HireStepX — Auth / Styles
   The auth-screen CSS extracted from inline <style>{`...`}</style>.
   Includes: webfont fallback, animations, microinteractions,
   responsive breakpoints, prefers-reduced-motion. */

export const AUTH_STYLES = `
  /* Webfont fallback — only loads if the host page hasn't already.
     Production should self-host via @font-face declarations in styles.css
     and remove these @imports for ~80ms faster first paint. */
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
  @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap');

  /* ─── Animations ─── */
  @keyframes hsx-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes hsx-fade-up {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes hsx-shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-4px); }
    40%, 80% { transform: translateX(4px); }
  }
  @keyframes hsx-draw-check {
    from { stroke-dashoffset: 14; }
    to   { stroke-dashoffset: 0; }
  }
  /* Sentinel keyframe — fires animationstart event when browser autofills.
     Used by Field to detect autofill and mark the field as touched so
     per-field validation messages render correctly. */
  @keyframes hsx-autofill-start { from {} to {} }
  @keyframes hsx-autofill-cancel { from {} to {} }

  /* Safari / Chrome autofill — override the yellow background that breaks
     our cream + white surface palette. */
  .hsx-login-field-input:-webkit-autofill,
  .hsx-login-field-input:-webkit-autofill:hover,
  .hsx-login-field-input:-webkit-autofill:focus {
    -webkit-box-shadow: 0 0 0 1000px #FFFFFF inset !important;
    -webkit-text-fill-color: #0E0C08 !important;
    caret-color: #0E0C08;
    transition: background-color 9999s ease-in-out 0s;
    animation-name: hsx-autofill-start;
    animation-duration: 0.001s;
  }
  .hsx-login-field-input:not(:-webkit-autofill) {
    animation-name: hsx-autofill-cancel;
    animation-duration: 0.001s;
  }

  /* ─── Microinteractions ─── */

  /* Page entrance — single subtle reveal, not stage-magic */
  .hsx-login-form > * {
    animation: hsx-fade-up 480ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .hsx-login-form > *:nth-child(1) { animation-delay: 0ms; }
  .hsx-login-form > *:nth-child(2) { animation-delay: 60ms; }
  .hsx-login-form > *:nth-child(3) { animation-delay: 120ms; }
  .hsx-login-form > *:nth-child(4) { animation-delay: 180ms; }
  .hsx-login-form > *:nth-child(5) { animation-delay: 240ms; }
  .hsx-login-form > *:nth-child(6) { animation-delay: 300ms; }
  .hsx-login-form > *:nth-child(n+7) { animation-delay: 360ms; }

  /* Primary CTA — lift on hover, depress on press, slide arrow right */
  .hsx-login-cta {
    transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
                box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1),
                background 180ms ease;
  }
  .hsx-login-cta:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 1px 2px rgba(20,17,10,.14), 0 8px 20px -4px rgba(49,46,129,.35);
  }
  .hsx-login-cta:not(:disabled):active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(20,17,10,.18) inset;
  }
  .hsx-login-cta-arrow {
    transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .hsx-login-cta:not(:disabled):hover .hsx-login-cta-arrow {
    transform: translateX(3px);
  }

  /* Google button — soft tint on hover, mild lift */
  .hsx-login-google {
    transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
                box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1),
                background 180ms ease,
                border-color 180ms ease;
  }
  .hsx-login-google:hover {
    transform: translateY(-1px);
    background: #FFFFFF;
    border-color: #D6CDB5;
    box-shadow: 0 1px 0 rgba(20,17,10,.04), 0 6px 16px -8px rgba(20,17,10,.18);
  }
  .hsx-login-google:active { transform: translateY(0); }

  /* Indigo links — animated underline on hover */
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

  /* Subtle muted underline links (Terms / Privacy) — fade weight */
  .hsx-link-muted { transition: color 160ms ease; }
  .hsx-link-muted:hover { color: #0E0C08; }

  /* Eye toggle — fade-rotate on press */
  .hsx-eye-toggle {
    transition: color 140ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .hsx-eye-toggle:hover { color: #0E0C08; }
  .hsx-eye-toggle:active { transform: scale(0.92); }

  /* Checkmark draw-in */
  .hsx-check-path {
    stroke-dasharray: 14;
    animation: hsx-draw-check 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* Error banner — slide-in + tiny shake */
  .hsx-error-banner {
    animation:
      hsx-fade-up 280ms cubic-bezier(0.16, 1, 0.3, 1),
      hsx-shake 320ms cubic-bezier(0.36, 0.07, 0.19, 0.97) 280ms;
  }

  /* Per-field error message — soft fade-in */
  .hsx-field-error {
    animation: hsx-fade-up 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  /* Wordmark — italic X glows on hover */
  .hsx-wordmark-x {
    transition: color 220ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .hsx-wordmark:hover .hsx-wordmark-x {
    transform: translateY(-1px);
    color: #92400E;
  }

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  /* Print stylesheet — strip animations + cream background */
  @media print {
    body, .hsx-login-form { background: #FFFFFF !important; }
    .hsx-login-cta, .hsx-login-google { box-shadow: none !important; }
    *, *::before, *::after {
      animation: none !important;
      transition: none !important;
    }
  }

  /* High-contrast mode — use system colors so focus rings remain visible */
  @media (forced-colors: active) {
    .hsx-login-cta:focus-visible,
    .hsx-login-google:focus-visible,
    .hsx-login-field-input:focus {
      outline: 2px solid CanvasText !important;
      outline-offset: 2px;
    }
  }

  /* ─── Responsive ─── */

  /* Hero responsive wrap — desktop forces single line via white-space:nowrap;
     below 900px the headline can no longer fit, so allow wrapping again with
     text-wrap:balance for clean line breaks. */
  @media (max-width: 900px) {
    .hsx-login-hero h1 {
      white-space: normal !important;
      text-wrap: balance;
    }
  }

  /* Very narrow viewports — clamp the hero font further so it never overflows
     even at the clamp() floor. */
  @media (max-width: 480px) {
    .hsx-login-hero h1 {
      font-size: clamp(1.875rem, 8vw, 2.5rem) !important;
    }
  }

  /* Tablet (≤960px) — modest tightening */
  @media (max-width: 960px) {
    .hsx-login-topbar { padding: 24px 32px !important; }
    .hsx-login-main   { padding: clamp(24px, 4vh, 48px) 24px !important; }
  }

  /* Mobile (≤640px) — single column, shrunk paddings, lighter chrome */
  @media (max-width: 640px) {
    .hsx-login-topbar { padding: 20px 20px !important; gap: 12px !important; }
    .hsx-login-main   { padding: clamp(20px, 3vh, 36px) 20px !important; }
    .hsx-login-form   { max-width: 100% !important; }
    .hsx-login-footer { padding: 24px 20px 32px !important; font-size: 11px !important; }
    .hsx-login-signup-prompt { font-size: 13px !important; }
    .hsx-login-subtitle { font-size: 14px !important; margin-top: 14px !important; margin-bottom: 32px !important; line-height: 1.45 !important; }
    .hsx-login-form-fields { gap: 14px !important; }
    .hsx-login-divider { margin: 16px 0 !important; }
    .hsx-login-google,
    .hsx-login-cta { padding: 13px 16px !important; font-size: 14px !important; }
    .hsx-login-field-input { font-size: 14.5px !important; padding: 10px 14px !important; }
    .hsx-login-field-input.has-slot { padding-right: 40px !important; }
    .hsx-login-field-input::placeholder { font-size: 14px !important; }
    .hsx-login-field-label { font-size: 13px !important; margin-bottom: 6px !important; font-weight: 500 !important; }
    .hsx-login-wordmark { font-size: 19px !important; }
    .hsx-login-meta-row { flex-wrap: wrap !important; gap: 10px !important; }
  }

  /* Small phone (≤420px) */
  @media (max-width: 420px) {
    .hsx-login-signup-text { display: none; }
    .hsx-login-form-fields { gap: 12px !important; }
  }

  /* Short viewports (e.g. landscape phones) */
  @media (max-height: 720px) and (max-width: 900px) {
    .hsx-login-main { padding-top: 12px !important; padding-bottom: 16px !important; }
    .hsx-login-subtitle { margin-bottom: 20px !important; }
    .hsx-login-footer { padding: 12px 20px 16px !important; }
  }
`;
