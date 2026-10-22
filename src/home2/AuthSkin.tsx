"use client";
import type { ReactNode } from "react";
import { homeCss } from "./homeCss";
import { Home2Nav, useStagingHost } from "./Chrome";

const skinCss = `
.hx-auth { background: oklch(0.972 0.008 285); min-height: 100dvh; }
.hx-auth-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); min-height: calc(100dvh - 72px); }
.hx-auth-side { position: sticky; top: 72px; align-self: start; height: calc(100dvh - 72px); padding: 64px 56px; display: flex; flex-direction: column; justify-content: center; gap: 28px; background: oklch(0.257 0.086 281.288); color: oklch(0.97 0.01 285); }
.hx-auth-side h2 { margin: 0; font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: clamp(28px, 3vw, 40px); line-height: 1.08; letter-spacing: -0.025em; font-weight: 600; text-wrap: balance; max-width: 16ch; }
.hx-auth-card { background: oklch(0.31 0.1 280); border: 1px solid oklch(0.45 0.08 280); border-radius: 18px; padding: 22px; display: grid; gap: 14px; max-width: 420px; }
.hx-auth-card q { font-size: 15px; line-height: 1.5; quotes: none; color: oklch(0.9 0.02 285); }
.hx-auth-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.hx-auth-row b { font-size: 44px; line-height: 1; font-weight: 600; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.hx-auth-row span { font-size: 13px; color: oklch(0.8 0.03 285); }
.hx-auth-bar { height: 6px; border-radius: 99px; background: oklch(0.42 0.08 280); overflow: hidden; }
.hx-auth-bar i { display: block; height: 100%; width: 91%; background: oklch(0.82 0.12 60); border-radius: inherit; }
.hx-auth-side ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; font-size: 15px; color: oklch(0.88 0.02 285); }
.hx-auth-main > div { background: transparent !important; min-height: calc(100dvh - 72px) !important; }
.hx-auth-main .hsx-login-topbar { display: none !important; }
.hx-auth-main h1 { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif !important; font-size: clamp(2rem, 3.4vw, 2.75rem) !important; line-height: 1.08 !important; font-weight: 600 !important; letter-spacing: -0.025em !important; white-space: normal !important; color: oklch(0.2 0.03 280) !important; text-wrap: balance; }
.hx-auth-main h1 em { font-style: normal !important; color: oklch(0.359 0.135 278.697) !important; }
.hx-auth-main input:not([type="checkbox"]) { background: oklch(1 0 0) !important; }
@media (max-width: 900px) {
  .hx-auth-grid { grid-template-columns: 1fr; }
  .hx-auth-side { display: none; }
}
`;

export function AuthSkin({ children }: { children: ReactNode }) {
  const staging = useStagingHost();
  if (!staging) return <>{children}</>;
  return (
    <div className="hx hx-auth">
      <style>{homeCss}</style>
      <style>{skinCss}</style>
      <Home2Nav />
      <div className="hx-auth-grid">
        <aside className="hx-auth-side" aria-hidden="true">
          <h2>Say it out loud before it counts.</h2>
          <div className="hx-auth-card">
            <q>I worked on our checkout page and cut load time from 3.4s to 1.9s.</q>
            <div className="hx-auth-row"><b>91</b><span>STAR score after coaching</span></div>
            <div className="hx-auth-bar"><i /></div>
          </div>
          <ul>
            <li>2 free sessions, no card needed</li>
            <li>Pay with UPI when you want more</li>
            <li>Delete your data any time</li>
          </ul>
        </aside>
        <div className="hx-auth-main">{children}</div>
      </div>
    </div>
  );
}
