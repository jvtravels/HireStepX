"use client";
import type { ReactNode } from "react";
import { homeCss } from "./homeCss";
import { authCss } from "./Auth";
import { useStagingHost } from "./stagingHost";
import { Home2Nav } from "./Chrome";

const skinCss = `
.hx.hx-auth-skin { background: var(--wash); min-height: 100dvh; display: flex; flex-direction: column; }
.hx-auth-skin .hx-au { flex: 1; }
.hx-auth-skin .hx-au { display: flex; flex-direction: column; height: auto; background: transparent; }
.hx-auth-skin .hx-au-l { flex: 1; padding: 24px 40px; display: flex; flex-direction: column; background: transparent; }
.hx-auth-skin .hx-au-main { margin: auto; align-self: center; width: 100%; max-width: 920px; padding: 44px 56px 40px; background: var(--white); border: 1px solid var(--line); border-radius: 20px; box-shadow: 0 1px 2px oklch(0.2 0.03 280 / 0.04), 0 24px 48px -24px oklch(0.4 0.1 280 / 0.14); }
.hx-auth-skin .hx-au-l::after { content: ""; flex: 0 0 64px; }
.hx-auth-skin .hx-au-main > div { background: transparent !important; min-height: 0 !important; padding: 0 !important; }
.hx-auth-skin .hsx-login-topbar { display: none !important; }
.hx-auth-skin .hx-au-main > div > main { padding: 0 !important; }
.hx-auth-skin .hx-au-main > div > footer { padding: 20px 0 0 !important; }
.hx-auth-skin .hx-au-main h1 { font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif !important; font-size: 34px !important; line-height: 1.1 !important; font-weight: 500 !important; letter-spacing: -0.025em !important; white-space: normal !important; color: var(--ink) !important; text-wrap: balance; }
.hx-auth-skin .hx-au-main [class*="-hero"], .hx-auth-skin .hx-au-main h1 { text-align: center !important; }
.hx-auth-skin .hx-au-main [class*="-hero"] { margin-bottom: 24px !important; }
.hx-auth-skin .hx-au-main [class*="-subtitle"] { text-align: center !important; font-size: 16px !important; margin-top: 12px !important; color: var(--ink-2) !important; }
.hx-auth-skin .hx-au-main h1 em { font-style: normal !important; color: inherit !important; }
.hx-auth-skin .hx-au-main input:not([type="checkbox"]) { min-height: 46px; border-radius: 10px !important; background: var(--white) !important; font-size: 15px; }
.hx-auth-skin .hx-au-main input:not([type="checkbox"]):focus { outline: none; border-color: var(--btn) !important; box-shadow: 0 0 0 3px oklch(0.359 0.135 278.697 / 0.14) !important; }
.hx-auth-skin .hsx-login-google { border-radius: 10px !important; min-height: 46px; }
.hx-auth-skin .hsx-login-cta { border-radius: 99px !important; min-height: 48px; background: var(--btn) !important; }
.hx-auth-skin .hx-au-main > div { max-width: 600px; margin: 0 auto; }
.hx-auth-skin .hx-au-main :is(label, span, a, p, li, button) { font-size: 14px !important; line-height: 1.5; }
.hx-auth-skin .hx-au-main input:not([type="checkbox"]) { font-size: 16px !important; }
.hx-auth-skin .hx-au-main .hsx-login-google, .hx-auth-skin .hx-au-main .hsx-login-cta, .hx-auth-skin .hx-au-main button[type="submit"] { font-size: 16px !important; }
.hx-auth-skin .hx-au-main main [class*="-subtitle"] { font-size: 16px !important; }
.hx-auth-skin .hx-au-main footer, .hx-auth-skin .hx-au-main footer * { font-size: 13px !important; }
@media (max-width: 600px) {
  .hx.hx-auth-skin { background: var(--white); }
  .hx-auth-skin .hx-au-l { padding: 20px; }
  .hx-auth-skin .hx-au-main { padding: 24px 0; border: 0; border-radius: 0; box-shadow: none; }
  .hx-auth-skin .hx-au-l::after { flex-basis: 0; }
  .hx-auth-skin .hx-au-main h1 { font-size: 30px !important; }
}
`;

export function AuthSkin({ children }: { children: ReactNode }) {
  const staging = useStagingHost();
  if (!staging) return <>{children}</>;
  return (
    <div className="hx hx-auth-skin">
      <style>{homeCss}</style>
      <style>{authCss}</style>
      <style>{skinCss}</style>
      <Home2Nav />
      <div className="hx-au">
        <div className="hx-au-l">
          <div className="hx-au-main">{children}</div>
        </div>
      </div>
    </div>
  );
}
