/* HireStepX — Dashboard canvas / styles
   Token-aware factory. Dashboard.tsx calls getDashboardStyles(tokens)
   once at module init and injects the result. */

import { tokens } from "../design-system/_tokens";

export function getDashboardStyles(t: typeof tokens) {
  return `
  @keyframes hsx-db-fade-up {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .hsx-db-stage > * { animation: hsx-db-fade-up 480ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  .hsx-db-stage > *:nth-child(1) { animation-delay:   0ms; }
  .hsx-db-stage > *:nth-child(2) { animation-delay:  60ms; }
  .hsx-db-stage > *:nth-child(3) { animation-delay: 120ms; }
  .hsx-db-stage > *:nth-child(4) { animation-delay: 180ms; }
  .hsx-db-stage > *:nth-child(5) { animation-delay: 240ms; }
  .hsx-db-stage > *:nth-child(n+6) { animation-delay: 300ms; }

  @keyframes hsx-db-accent-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .hsx-db-hero em { animation: hsx-db-accent-in 600ms 120ms cubic-bezier(.2,.7,.2,1) both; }

  @keyframes hsx-db-flame {
    0%, 100% { transform: scale(1)    rotate(-2deg); }
    50%      { transform: scale(1.06) rotate(2deg); }
  }
  .hsx-db-flame { animation: hsx-db-flame 2.4s ease-in-out 3; transform-origin: 50% 80%; }

  .hsx-db-card {
    transition: box-shadow 240ms cubic-bezier(.16,1,.3,1),
                border-color 200ms ease,
                transform 240ms cubic-bezier(.16,1,.3,1);
  }
  .hsx-db-card[data-interactive="true"]:hover {
    box-shadow: 0 1px 0 rgba(20,17,10,.04), 0 2px 6px rgba(20,17,10,.06), 0 24px 56px -20px rgba(20,17,10,.18);
    transform: translateY(-1px);
  }

  .hsx-db-link { position: relative; transition: color 160ms ease; }
  .hsx-db-link::after {
    content: '';
    position: absolute; left: 0; right: 0; bottom: -2px;
    height: 1px; background: currentColor;
    transform: scaleX(0); transform-origin: left center;
    transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .hsx-db-link:hover::after { transform: scaleX(1); }

  .hsx-db-nav { transition: background 180ms ease, color 180ms ease; }
  .hsx-db-nav:hover { background: rgba(180, 83, 9, 0.04); }
  .hsx-db-nav[data-active="true"] {
    background: rgba(180, 83, 9, 0.10);
    color: ${t.copper};
  }

  /* Focus-visible rings — single rule covers all interactive primitives. */
  .hsx-db-nav:focus-visible,
  .hsx-db-cta:focus-visible,
  .hsx-db-cta-outline:focus-visible,
  .hsx-db-icon-btn:focus-visible,
  .hsx-db-period-btn:focus-visible {
    outline: 2px solid ${t.indigo};
    outline-offset: 2px;
  }
  .hsx-db-link:focus-visible {
    outline: 2px solid ${t.indigo};
    outline-offset: 3px;
    border-radius: 2px;
  }

  @keyframes hsx-db-ring-bloom {
    from { stroke-dashoffset: 999; opacity: 0.6; }
    to   { stroke-dashoffset: var(--ring-target, 0); opacity: 1; }
  }
  .hsx-db-ring--bloom { animation: hsx-db-ring-bloom 1.4s 200ms cubic-bezier(.16,1,.3,1) both; }

  .hsx-db-score-strong { background: ${t.success100}; color: ${t.success}; }
  .hsx-db-score-mid    { background: ${t.copperSoft}; color: ${t.copper}; }
  .hsx-db-score-soft   { background: rgba(110, 103, 89, 0.08); color: ${t.inkSoft}; }

  .hsx-db-cta {
    transition: background 180ms ease, transform 180ms cubic-bezier(.16,1,.3,1), box-shadow 180ms ease;
  }
  .hsx-db-cta:hover {
    background: ${t.indigoDeep};
    transform: translateY(-1px);
    box-shadow: 0 1px 2px rgba(20,17,10,.16), 0 6px 18px -4px rgba(49,46,129,.30);
  }
  .hsx-db-cta:active { transform: translateY(0); }

  .hsx-db-cta-outline { transition: background 160ms ease, border-color 160ms ease; }
  .hsx-db-cta-outline:hover {
    background: rgba(180,83,9,0.05);
    border-color: rgba(180,83,9,0.30);
  }

  /* Shimmer for skeleton loading */
  @keyframes hsx-db-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .hsx-db-shimmer {
    animation: hsx-db-shimmer 1.6s linear infinite;
  }

  /* Session row hover-quick-actions reveal */
  .hsx-db-session-row {
    position: relative;
    transition: background 160ms ease;
  }
  .hsx-db-session-row:hover {
    background: rgba(180, 83, 9, 0.04);
    border-radius: 8px;
  }
  .hsx-db-session-actions {
    opacity: 0;
    transition: opacity 200ms ease;
  }
  .hsx-db-session-row:hover .hsx-db-session-actions,
  .hsx-db-session-row:focus-within .hsx-db-session-actions {
    opacity: 1;
  }

  @keyframes hsx-db-count-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .hsx-db-count { animation: hsx-db-count-in 600ms 200ms cubic-bezier(.16,1,.3,1) both; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  /* Responsive collapse — right rail moves under main column at 1240,
     rather than disappearing. At 920 the sidebar collapses to a
     top-bar menu trigger handled by .hsx-db-menu-trigger. */
  @media (max-width: 1240px) {
    .hsx-db-grid { grid-template-columns: 240px minmax(0, 1fr) !important; }
    .hsx-db-rail {
      grid-column: 1 / -1 !important;
      padding: 0 32px 48px 32px !important;
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 16px !important;
    }
  }
  @media (max-width: 920px) {
    .hsx-db-grid { grid-template-columns: 1fr !important; }
    .hsx-db-sidebar { display: none !important; }
    .hsx-db-menu-trigger { display: inline-flex !important; }
    .hsx-db-topbar { padding: 18px 24px !important; }
    .hsx-db-stage  { padding: 18px 24px 32px !important; gap: 18px !important; }
    .hsx-db-hero-h1 { font-size: 42px !important; }
    .hsx-db-kpi-row { grid-template-columns: 1fr !important; }
    .hsx-db-rail   { grid-template-columns: 1fr !important; padding: 0 24px 32px !important; }
  }
`;
}
