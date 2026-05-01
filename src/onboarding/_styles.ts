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
    .hsx-onb-state-enter,
    .hsx-onb-track:active > span:first-child {
      animation: none !important;
      transition: none !important;
      transform: none !important;
    }
    .hsx-onb-shimmer { display: none; }
  }

  /* Cell wrapper used by the bento grid. Stretches to fill the
     row so the SectionCard inside (height: 100%) matches the
     tallest sibling — eliminates voids at the bottom of shorter
     content. */
  .hsx-onb-cell { display: flex; flex-direction: column; }

  /* Smooth state-to-state transitions: each onboarding state
     (empty / loading / ready) fades + slides up gently so the
     540px → 1360px content shift between empty and ready feels
     considered, not jarring. Honours prefers-reduced-motion via
     the existing media-query block below. */
  .hsx-onb-state-enter {
    animation: hsx-onb-fade-up 360ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  /* Mobile single-column fix: when the bento collapses below 900px,
     the score card no longer needs height: 100% (no row to stretch
     against), so we reset it to auto. Without this reset, the
     marginTop: auto on the CTA pair tries to push to a non-existent
     bottom and can leave odd whitespace inside the card on tall
     mobile viewports. */
  @media (max-width: 900px) {
    .hsx-onb-hero-row > section.hsx-onb-score-shell {
      height: auto !important;
    }
  }

  /* Primary CTA inside the score card. Inline styles can't drive
     :hover, so the hover/active/focus rules live here. Subtle lift
     + slight darken — keeps the button feeling responsive without
     becoming busy. */
  .hsx-onb-cta-primary:not(:disabled):hover {
    background: #1e1b4b !important;     /* indigo-deep */
    transform: translateY(-1px);
    box-shadow: 0 4px 14px -4px rgba(20, 17, 10, 0.35);
  }
  .hsx-onb-cta-primary:not(:disabled):active {
    transform: translateY(0);
  }
  .hsx-onb-cta-primary:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(180, 83, 9, 0.32);
  }

  /* CTA pair (Start mock interview + Dashboard) inside the score
     card — at <520px the side-by-side layout wraps awkwardly. Stack
     vertically so each button gets full width. */
  @media (max-width: 520px) {
    .hsx-onb-cta-pair {
      flex-direction: column !important;
    }
    .hsx-onb-cta-pair > button {
      width: 100% !important;
      flex: 0 0 auto !important;
    }
  }

  /* Responsive — collapse the 12-col bento progressively. At
     each breakpoint we override the inline gridColumn spans so
     cards land in sensible row groupings rather than stacking
     to single column too early. */
  @media (max-width: 1100px) {
    .hsx-onb-body-grid > .hsx-onb-cell { grid-column: span 6 !important; }
    .hsx-onb-body-grid > .hsx-onb-cell:last-child { grid-column: span 12 !important; }
  }
  @media (max-width: 900px) {
    .hsx-onb-hero-row { grid-template-columns: 1fr !important; }
    .hsx-onb-body-grid > .hsx-onb-cell { grid-column: span 12 !important; }
  }
  @media (max-width: 540px) {
    .hsx-onb-score-gauge { grid-template-columns: 1fr !important; justify-items: center; text-align: center; }
  }

  /* ───── MOBILE RESPONSIVENESS ─────
     Production audit found cramped padding + over-sized chrome
     on narrow viewports. These rules keep the desktop comp
     intact and only kick in on phones. */

  /* Tablets and below — start tightening padding. */
  @media (max-width: 720px) {
    /* Outer content wrapper from Onboarding.tsx */
    .ob-content-area {
      padding-left: 20px !important;
      padding-right: 20px !important;
      padding-top: 24px !important;
      padding-bottom: 28px !important;
    }
    /* TopBar gets less side padding so the wordmark + avatar fit
       comfortably. */
    .hsx-login-topbar {
      padding: 22px 24px !important;
      gap: 12px !important;
    }
  }

  /* Phones — full mobile mode. */
  @media (max-width: 540px) {
    .ob-content-area {
      padding-left: 14px !important;
      padding-right: 14px !important;
      padding-top: 12px !important;
      padding-bottom: 24px !important;
    }
    .hsx-login-topbar {
      padding: 14px 16px !important;
      gap: 8px !important;
    }
    /* Hide stepper text labels — keep numbers + connectors so
       the user still sees progress without blowing up the
       header width. */
    .hsx-onb-stepper-label {
      display: none !important;
    }
    /* Hide the avatar's user-name text — the circle alone is
       enough on mobile and freed-up space prevents wordmark
       collision. */
    .hsx-onb-account-name {
      display: none !important;
    }
    /* Hide breadcrumbs / muted topbar text on small screens. */
    .hsx-onb-stepper-arrow {
      display: none !important;
    }
    /* Hero serif — drop minimum so 32px doesn't feel huge at
       375px width. clamp(1.625rem, 5vw, 3.5rem) gives a true
       mobile-respectful 26px floor. */
    .hsx-onb-hero h1 {
      font-size: clamp(1.625rem, 6.5vw, 2.5rem) !important;
    }
    /* Drop-zone padding — slightly tighter, keep it tappable. */
    .hsx-onb-drop {
      padding: 28px 18px !important;
    }
    /* Score-card body padding — extra breathing room costs
       precious viewport on phones. */
    .hsx-onb-score-shell {
      padding: 16px !important;
    }
    /* Cards inside the body grid — match. */
    .hsx-onb-body-grid section {
      padding: 14px !important;
    }
  }

  /* Very narrow (folded phones, 360px). Type drops further so
     the headline doesn't wrap awkwardly. */
  @media (max-width: 380px) {
    .hsx-onb-hero h1 {
      font-size: 1.5rem !important;
    }
  }
`;
