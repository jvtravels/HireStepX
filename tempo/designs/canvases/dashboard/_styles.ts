/* HireStepX — Dashboard canvas / styles
   Animation + microinteractions + responsive tuning. Mirrors the
   pattern used by interview/_styles.ts. Injected once at top of the
   composition. */

export const DASHBOARD_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
  @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap');

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
    from { opacity: 0; transform: translateY(4px); letter-spacing: -0.01em; }
    to   { opacity: 1; transform: translateY(0);   letter-spacing: -0.02em; }
  }
  .hsx-db-hero em { animation: hsx-db-accent-in 600ms 120ms cubic-bezier(.2,.7,.2,1) both; }

  @keyframes hsx-db-flame {
    0%, 100% { transform: scale(1)    rotate(-2deg); opacity: 0.96; }
    50%      { transform: scale(1.06) rotate(2deg);  opacity: 1;    }
  }
  .hsx-db-flame { animation: hsx-db-flame 2.4s ease-in-out infinite; transform-origin: 50% 80%; }

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
    color: #B45309;
  }

  @keyframes hsx-db-ring-bloom {
    from { stroke-dashoffset: 999; opacity: 0.6; }
    to   { stroke-dashoffset: var(--ring-target, 0); opacity: 1; }
  }
  .hsx-db-ring--bloom { animation: hsx-db-ring-bloom 1.4s 200ms cubic-bezier(.16,1,.3,1) both; }

  .hsx-db-score-strong { background: #DCFCE7; color: #15803D; }
  .hsx-db-score-mid    { background: rgba(180, 83, 9, 0.12); color: #B45309; }
  .hsx-db-score-soft   { background: rgba(110, 103, 89, 0.08); color: #6E6759; }

  .hsx-db-cta {
    transition: background 180ms ease, transform 180ms cubic-bezier(.16,1,.3,1), box-shadow 180ms ease;
  }
  .hsx-db-cta:hover {
    background: #1E1B4B;
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
  .hsx-db-session-row:hover .hsx-db-session-actions {
    opacity: 1;
  }

  /* Number count-up — subtle fade-in for KPI values on first paint */
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

  @media (max-width: 1240px) {
    .hsx-db-grid { grid-template-columns: 240px 1fr !important; }
    .hsx-db-rail { display: none !important; }
    .hsx-db-main { padding-right: 32px !important; }
  }
  @media (max-width: 920px) {
    .hsx-db-grid { grid-template-columns: 1fr !important; }
    .hsx-db-sidebar { display: none !important; }
    .hsx-db-topbar { padding: 18px 24px !important; }
    .hsx-db-stage  { padding: 18px 24px 32px !important; gap: 18px !important; }
    .hsx-db-hero-h1 { font-size: 36px !important; }
    .hsx-db-kpi-row { grid-template-columns: 1fr !important; }
  }
`;
