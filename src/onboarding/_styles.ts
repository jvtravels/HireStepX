/* HireStepX — Onboarding scoped CSS (production).
   Layered on top of AUTH_STYLES (which is injected by each onboarding view).
   Defines: stagger, hover/focus, drop-zone, shimmer, status fade, avatar
   pop-in, check scale-in, responsive collapse rules. Mirrors the canvas. */

export const ONBOARDING_STYLES = `
  @keyframes hsx-onb-fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes hsx-onb-pop-in {
    0%   { opacity: 0; transform: scale(0.85); }
    60%  { opacity: 1; transform: scale(1.04); }
    100% { transform: scale(1); }
  }
  @keyframes hsx-onb-shimmer {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(120%); }
  }
  @keyframes hsx-onb-check {
    from { opacity: 0; transform: scale(0.5); }
    to   { opacity: 1; transform: scale(1); }
  }

  /* Vertical stack with consistent 16px spacing between every row. */
  .hsx-onb-stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .hsx-onb-stack > * {
    animation: hsx-onb-fade-up 460ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .hsx-onb-stack > *:nth-child(1) { animation-delay: 0ms; }
  .hsx-onb-stack > *:nth-child(2) { animation-delay: 60ms; }
  .hsx-onb-stack > *:nth-child(3) { animation-delay: 120ms; }
  .hsx-onb-stack > *:nth-child(4) { animation-delay: 180ms; }
  .hsx-onb-stack > *:nth-child(5) { animation-delay: 240ms; }
  .hsx-onb-stack > *:nth-child(6) { animation-delay: 300ms; }
  .hsx-onb-stack > *:nth-child(7) { animation-delay: 360ms; }
  .hsx-onb-stack > *:nth-child(n+8) { animation-delay: 420ms; }

  .hsx-onb-track {
    transition: background 140ms ease, transform 140ms cubic-bezier(0.16, 1, 0.3, 1);
    border-radius: 8px;
    margin: 0 -8px;
    padding: 6px 8px !important;
  }
  .hsx-onb-track:hover { background: #F4EFE3; }
  .hsx-onb-track:active { transform: scale(0.99); }
  .hsx-onb-track:focus-visible {
    outline: 2px solid #312E81;
    outline-offset: 2px;
    background: #F4EFE3;
  }
  .hsx-onb-track > span:first-child { transition: background 140ms ease, border-color 140ms ease, transform 140ms cubic-bezier(0.16, 1, 0.3, 1); }
  .hsx-onb-track:active > span:first-child { transform: scale(0.92); }
  .hsx-onb-check {
    animation: hsx-onb-check 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .hsx-onb-avatar {
    animation: hsx-onb-pop-in 360ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .hsx-onb-drop:focus-within {
    outline: 2px solid #312E81;
    outline-offset: 4px;
  }

  .hsx-onb-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%);
    width: 40%;
    animation: hsx-onb-shimmer 1500ms linear infinite;
    pointer-events: none;
  }

  .hsx-onb-status {
    animation: hsx-onb-fade-up 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @media (prefers-reduced-motion: reduce) {
    .hsx-onb-stack > *,
    .hsx-onb-avatar,
    .hsx-onb-check,
    .hsx-onb-status,
    .hsx-onb-track,
    .hsx-onb-track:active > span:first-child {
      animation: none !important;
      transition: none !important;
      transform: none !important;
    }
    .hsx-onb-shimmer { display: none; }
  }

  /* Responsive — collapse multi-col grids progressively. */
  @media (max-width: 1100px) {
    .hsx-onb-body-grid {
      grid-template-columns: repeat(2, 1fr) !important;
    }
  }
  @media (max-width: 900px) {
    .hsx-onb-hero-row,
    .hsx-onb-body-grid {
      grid-template-columns: 1fr !important;
    }
  }
  @media (max-width: 540px) {
    .hsx-onb-score-gauge { grid-template-columns: 1fr !important; justify-items: center; text-align: center; }
  }
`;
