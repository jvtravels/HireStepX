"use client";
import type { ReactNode } from "react";
import { homeCss } from "./homeCss";
import { authCss, Scene } from "./Auth";
import { useStagingHost } from "./Chrome";

const skinCss = `
.hx.hx-auth-skin { background: var(--white); min-height: 100dvh; }
.hx-auth-skin .hx-au { height: 100dvh; min-height: 640px; }
.hx-auth-skin .hx-au-l { overflow-y: auto; }
.hx-auth-skin .hx-au-main { max-width: 420px; padding: 24px 0 40px; }
.hx-auth-skin .hx-au-main > div { background: transparent !important; min-height: 0 !important; padding: 0 !important; }
.hx-auth-skin .hsx-login-topbar { display: none !important; }
.hx-auth-skin .hx-au-main h1 { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif !important; font-size: 40px !important; line-height: 1.1 !important; font-weight: 500 !important; letter-spacing: -0.025em !important; white-space: normal !important; color: var(--ink) !important; text-wrap: balance; }
.hx-auth-skin .hx-au-main [class*="-hero"], .hx-auth-skin .hx-au-main h1 { text-align: left !important; }
.hx-auth-skin .hx-au-main [class*="-hero"] { margin-bottom: 24px !important; }
.hx-auth-skin .hx-au-main [class*="-subtitle"] { text-align: left !important; font-size: 16px !important; margin-top: 12px !important; color: var(--ink-2) !important; }
.hx-auth-skin .hx-au-main h1 em { font-style: normal !important; color: inherit !important; }
.hx-auth-skin .hx-au-main input:not([type="checkbox"]) { min-height: 46px; border-radius: 10px !important; background: var(--white) !important; font-size: 15px; }
.hx-auth-skin .hx-au-main input:not([type="checkbox"]):focus { outline: none; border-color: var(--btn) !important; box-shadow: 0 0 0 3px oklch(0.359 0.135 278.697 / 0.14) !important; }
.hx-auth-skin .hsx-login-google { border-radius: 10px !important; min-height: 46px; }
.hx-auth-skin .hsx-login-cta { border-radius: 99px !important; min-height: 48px; background: var(--btn) !important; }
@media (max-width: 900px) {
  .hx-auth-skin .hx-au { grid-template-columns: 1fr; height: auto; min-height: 100dvh; }
  .hx-auth-skin .hx-au-r { display: none; }
  .hx-auth-skin .hx-au-l { padding: 20px; }
  .hx-auth-skin .hx-au-main h1 { font-size: 32px !important; }
}
`;

export function AuthSkin({ children, top, headline, sub, talent = true }: { children: ReactNode; top: ReactNode; headline: ReactNode; sub: string; talent?: boolean }) {
  const staging = useStagingHost();
  if (!staging) return <>{children}</>;
  return (
    <div className="hx hx-auth-skin">
      <style>{homeCss}</style>
      <style>{authCss}</style>
      <style>{skinCss}</style>
      <div className="hx-au">
        <div className="hx-au-l">
          <div className="hx-au-top">
            <a data-no-underline className="hx-logo" href="/"><img src="/wordmark.png" alt="HireStepX" /></a>
            <span>{top}</span>
          </div>
          <div className="hx-au-main">{children}</div>
        </div>
        <div className="hx-au-r">
          <div className="hx-au-panel">
            <Scene talent={talent} />
            <h2>{headline}</h2>
            <p>{sub}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
