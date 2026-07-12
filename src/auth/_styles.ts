/* HireStepX — Auth / Styles
   The auth-screen CSS extracted from inline <style>{`...`}</style>.
   Includes: webfont fallback, animations, microinteractions,
   responsive breakpoints, prefers-reduced-motion. */

export const AUTH_STYLES = `
  /* Webfont fallback — only loads if the host page hasn't already.
     Instrument Serif + JetBrains Mono: kept here as a guard for any
     standalone render path. Satoshi is loaded globally via layout.tsx
     <link rel="stylesheet"> so its @import is omitted here to avoid a
     redundant CDN fetch on every auth page load. */
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');

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

  /* Compact desktop / 13–14" laptops (≤1280px) — tighten vertical
     rhythm so the hero + form fit comfortably in one screen without
     scrolling. The hero font and paddings drop a notch; the form
     stays readable. */
  @media (max-width: 1280px) {
    .hsx-login-topbar { padding: 22px 36px !important; }
    .hsx-login-main   { padding: clamp(16px, 3vh, 36px) 24px !important; }
    .hsx-login-hero h1 { font-size: clamp(2rem, 5vw, 3.25rem) !important; }
    .hsx-login-hero   { margin-bottom: 24px !important; }
    .hsx-login-subtitle { margin-top: 12px !important; font-size: 15px !important; }
    .hsx-login-google,
    .hsx-login-cta    { padding: 12px 16px !important; }
    .hsx-login-divider { margin: 14px 0 !important; }
    .hsx-login-form-fields { gap: 14px !important; }
  }

  /* Mobile (≤640px) — single column, shrunk paddings, lighter chrome */
  @media (max-width: 640px) {
    .hsx-login-topbar { padding: 20px 20px !important; gap: 12px !important; }
    /* Vertically center the content block within main. The form +
       hero pair is shorter than the viewport, so this distributes
       empty space evenly above and below for a balanced layout. */
    .hsx-login-main   {
      justify-content: center !important;
      padding: 28px 20px 32px !important;
    }
    .hsx-login-form   { max-width: 100% !important; }
    /* Hero → form gap on mobile — generous enough that hero reads as
       its own block, tight enough that they still feel related. */
    .hsx-login-hero   { margin-bottom: 36px !important; }
    .hsx-login-footer { padding: 24px 20px 32px !important; font-size: 11px !important; }
    .hsx-login-signup-prompt { font-size: 13px !important; }
    .hsx-login-subtitle { font-size: 14px !important; margin-top: 12px !important; margin-bottom: 0 !important; line-height: 1.45 !important; }
    .hsx-login-form-fields { gap: 14px !important; }
    .hsx-login-divider { margin: 14px 0 !important; }
    .hsx-login-google,
    .hsx-login-cta { padding: 13px 16px !important; font-size: 14px !important; }
    .hsx-login-field-input { font-size: 16px !important; padding: 10px 14px !important; }
    .hsx-login-field-input.has-slot { padding-right: 40px !important; }
    .hsx-login-field-input::placeholder { font-size: 14px !important; }
    .hsx-login-field-label { font-size: 13px !important; margin-bottom: 6px !important; font-weight: 500 !important; }
    .hsx-login-wordmark { font-size: 19px !important; }
    /* Meta row stays side-by-side. The label was shortened to
       "Stay signed in" so the row fits on a 375px viewport. */
    .hsx-login-meta-row {
      gap: 12px !important;
    }
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

  /* Short landscape desktop (≥901px wide, ≤780px tall — e.g. 1366×768).
     Without this the hero heading + full form overflows the fold and the
     primary CTA ends up hidden behind the cookie banner. Compact every
     vertical dimension so the form fits without scrolling. */
  @media (min-width: 901px) and (max-height: 780px) {
    .hsx-login-topbar   { padding: 14px 32px !important; }
    .hsx-login-main     { padding-top: 14px !important; padding-bottom: 14px !important; }
    .hsx-login-hero     { margin-bottom: 14px !important; }
    .hsx-login-hero h1  { font-size: clamp(1.5rem, 2.4vw, 1.875rem) !important; }
    .hsx-login-subtitle { font-size: 13px !important; margin-top: 6px !important; margin-bottom: 0 !important; }
    .hsx-login-divider  { margin: 10px 0 !important; }
    .hsx-login-form-fields { gap: 10px !important; }
    .hsx-login-google,
    .hsx-login-cta      { padding: 10px 16px !important; font-size: 14px !important; }
  }

  /* Tablet (≤960px) — modest tightening */
  @media (max-width: 960px) {
    .hsx-login-topbar { padding: 24px 32px !important; }
    .hsx-login-main   { padding: clamp(24px, 4vh, 48px) 24px !important; }
  }

  /* Portrait tablet (641–960px) — vertically centre the form so the dead
     zone distributes evenly above and below instead of pooling below the CTA. */
  @media (min-width: 641px) and (max-width: 960px) {
    .hsx-login-main { justify-content: center !important; }
  }
`;
