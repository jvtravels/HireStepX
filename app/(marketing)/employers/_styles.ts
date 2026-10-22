import { tokens as t, fonts as f } from "@/auth/_tokens";

/* Class-based styles for /employers (namespaced .emp-*). Class rules rather
   than inline styles so the layout can collapse to one column on phones and
   the type and spacing can use clamp(). */
export const employersCSS = `
  .emp-page { background: ${t.cream}; min-height: 60vh; font-family: ${f.sans}; color: ${t.coal}; }
  .emp-hero { max-width: 880px; margin: 0 auto; padding: clamp(48px, 10vw, 96px) 24px clamp(40px, 6vw, 64px); text-align: center; }
  .emp-eyebrow { display: inline-flex; font-family: ${f.mono}; font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; color: ${t.copper}; font-weight: 600; margin-bottom: 16px; }
  .emp-h1 { font-family: ${f.serif}; font-size: clamp(30px, 7vw, 44px); color: ${t.coal}; margin: 0 0 16px; line-height: 1.15; font-weight: 400; }
  .emp-lede { font-size: clamp(15px, 2.4vw, 17px); color: ${t.inkSoft}; max-width: 620px; margin: 0 auto 32px; line-height: 1.6; }
  .emp-actions { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
  .emp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 12px 26px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; }
  .emp-btn-primary { background: ${t.indigo}; color: ${t.white}; }
  .emp-btn-ghost { background: ${t.white}; color: ${t.coal}; border: 1px solid ${t.lineStrong}; }
  .emp-btn:focus-visible, .emp-link:focus-visible, .emp-faq summary:focus-visible { outline: 2px solid ${t.indigo}; outline-offset: 2px; }
  .emp-fine { font-size: 13px; color: ${t.inkFaint}; margin: 14px auto 0; max-width: 560px; line-height: 1.55; }
  .emp-link { color: inherit; text-decoration: underline; }

  .emp-wrap { max-width: 960px; margin: 0 auto; padding: 0 24px clamp(48px, 8vw, 80px); }
  .emp-h2 { font-family: ${f.serif}; font-size: clamp(24px, 4.5vw, 32px); font-weight: 400; margin: 0 0 8px; line-height: 1.2; color: ${t.coal}; }
  .emp-sub { font-size: 15px; color: ${t.inkSoft}; line-height: 1.6; margin: 0 0 24px; max-width: 640px; }
  .emp-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .emp-grid2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; align-items: start; }
  .emp-card { background: ${t.white}; border: 1px solid ${t.line}; border-radius: 16px; padding: 24px; }
  .emp-card h3 { font-size: 15px; font-weight: 700; margin: 0 0 8px; color: ${t.coal}; }
  .emp-card p { font-size: 13.5px; color: ${t.inkSoft}; line-height: 1.6; margin: 0; }
  .emp-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
  .emp-list li { font-size: 13.5px; color: ${t.inkSoft}; line-height: 1.5; padding-left: 18px; position: relative; }
  .emp-list li::before { content: ""; position: absolute; left: 2px; top: 8px; width: 6px; height: 6px; border-radius: 50%; background: ${t.copper}; }
  .emp-list-locked li::before { background: ${t.inkFaintWeak}; }
  .emp-h3 { font-size: 13px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: ${t.coal}; margin: 0 0 10px; }
  .emp-split { display: grid; gap: 24px; }

  .emp-sample { border: 1px dashed ${t.copperBorder}; background: ${t.copperWash}; border-radius: 16px; padding: 20px; }
  .emp-badge { display: inline-block; font-family: ${f.mono}; font-size: 10.5px; letter-spacing: 1px; text-transform: uppercase; font-weight: 600; color: ${t.copperDark}; background: ${t.copper100}; border-radius: 999px; padding: 3px 10px; }
  .emp-sample-note { font-size: 12px; color: ${t.inkFaint}; margin: 8px 0 14px; line-height: 1.5; }
  .emp-sample-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .emp-sample-name { font-size: 15px; font-weight: 700; color: ${t.coal}; }
  .emp-sample-role { font-size: 13px; color: ${t.inkSoft}; }
  .emp-score { font-family: ${f.serif}; font-size: 30px; line-height: 1; color: ${t.copperDark}; }
  .emp-score small { font-family: ${f.sans}; font-size: 11px; color: ${t.inkFaint}; display: block; text-align: right; }
  .emp-bars { display: grid; gap: 8px; margin: 14px 0; }
  .emp-bar { display: grid; grid-template-columns: 64px 1fr 28px; align-items: center; gap: 10px; font-size: 12px; color: ${t.inkSoft}; }
  .emp-bar-track { height: 6px; border-radius: 999px; background: ${t.line}; overflow: hidden; }
  .emp-bar-fill { display: block; height: 100%; background: ${t.copper}; border-radius: 999px; }
  .emp-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; padding: 0; list-style: none; }
  .emp-chips li { font-size: 12px; background: ${t.white}; border: 1px solid ${t.line}; border-radius: 999px; padding: 3px 10px; color: ${t.coal}; }
  .emp-quote { font-size: 13px; color: ${t.inkSoft}; line-height: 1.55; margin: 0 0 12px; font-style: italic; }
  .emp-locked-row { display: flex; justify-content: space-between; gap: 12px; font-size: 12.5px; padding: 8px 0; border-top: 1px solid ${t.line}; color: ${t.inkSoft}; }
  .emp-locked-row b { color: ${t.coal}; font-weight: 600; }

  .emp-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; counter-reset: step; list-style: none; margin: 0; padding: 0; }
  .emp-step { background: ${t.white}; border: 1px solid ${t.line}; border-radius: 16px; padding: 24px; }
  .emp-step::before { counter-increment: step; content: counter(step); display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; border-radius: 50%; background: ${t.copper100}; color: ${t.copperDark}; font-weight: 700; font-size: 13px; margin-bottom: 12px; }
  .emp-step h3 { font-size: 15px; font-weight: 700; margin: 0 0 8px; }
  .emp-step p { font-size: 13.5px; color: ${t.inkSoft}; line-height: 1.6; margin: 0; }
  .emp-caveat { font-size: 13px; color: ${t.inkFaint}; margin: 16px 0 0; line-height: 1.55; max-width: 640px; }

  .emp-price { font-family: ${f.serif}; font-size: 32px; line-height: 1.1; color: ${t.coal}; margin: 4px 0 6px; }
  .emp-price small { font-family: ${f.sans}; font-size: 13px; color: ${t.inkFaint}; }
  .emp-billing { display: grid; gap: 10px; margin-top: 20px; }
  .emp-billing p { font-size: 13.5px; color: ${t.inkSoft}; line-height: 1.6; margin: 0; max-width: 720px; }
  .emp-billing strong { color: ${t.coal}; }

  .emp-faq { border-top: 1px solid ${t.line}; }
  .emp-faq details { border-bottom: 1px solid ${t.line}; }
  .emp-faq summary { cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 16px; min-height: 48px; padding: 14px 0; font-size: 15px; font-weight: 600; color: ${t.coal}; }
  .emp-faq summary::-webkit-details-marker { display: none; }
  .emp-faq summary::after { content: "+"; font-size: 20px; color: ${t.copper}; transition: transform 0.18s ease; flex-shrink: 0; }
  .emp-faq details[open] summary::after { transform: rotate(45deg); }
  .emp-faq details p { font-size: 14px; color: ${t.inkSoft}; line-height: 1.65; margin: 0 0 16px; max-width: 720px; }

  @media (max-width: 880px) {
    .mv2-mobile-cta { display: flex !important; }
  }
  @media (max-width: 720px) {
    .emp-grid3, .emp-grid2, .emp-steps { grid-template-columns: 1fr; gap: 16px; }
    .emp-actions { flex-direction: column; align-items: stretch; }
    .emp-wrap { padding-left: 16px; padding-right: 16px; }
    .emp-hero { padding-left: 16px; padding-right: 16px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .emp-faq summary::after { transition: none; }
  }
`;
