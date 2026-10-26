"use client";

import { useEffect } from "react";
import ConsentGatedTelemetry from "./ConsentGatedTelemetry";
import { captureClientEvent } from "../src/posthogClient";

const CTA_PATHS = ["/signup", "/login", "/pricing", "/contact", "/employers", "/candidates", "/employer/requirements/new"];

/* Marketing-route counterpart — no live per-request nonce (marketing pages are
   static/ISR, so there's no headers() call to mint one; proxy.ts allows the
   inline GA init for these routes via 'unsafe-inline' + a host allowlist).
   All gating logic lives in ConsentGatedTelemetry. The click listener only
   records which funnel link was used; captureClientEvent drops it without consent. */
export default function MarketingAnalytics() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!el) return;
      const href = el.getAttribute("href") || "";
      const path = href.split(/[?#]/)[0];
      if (!CTA_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return;
      captureClientEvent("marketing_cta_click", {
        href: path,
        label: (el.textContent || "").trim().slice(0, 40),
        from: window.location.pathname,
      });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return <ConsentGatedTelemetry />;
}
