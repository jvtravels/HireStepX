import { describe, it, expect } from "vitest";
import { isAllowedOnGate } from "../middlewareGate";

/**
 * Regression guard for the pre-launch gate. The gate rewrites every
 * non-allowed path to `/`. Before this fix, root-level static + SEO/PWA assets
 * were NOT allowlisted, so they served the homepage HTML instead of their real
 * payload — breaking the PWA manifest, robots.txt, sitemap.xml, favicons, the
 * service worker, and OG/Twitter share images on the live (gated) site.
 */
describe("isAllowedOnGate", () => {
  it("allows marketing + legal pages", () => {
    for (const p of ["/", "/blog", "/terms", "/privacy", "/refund"]) {
      expect(isAllowedOnGate(p)).toBe(true);
    }
  });

  it("allows API, Next internals, and shared views by prefix", () => {
    for (const p of ["/api/waitlist-signup", "/_next/static/x.js", "/blog/post-1", "/page/foo", "/profile/abc", "/report/share/xyz"]) {
      expect(isAllowedOnGate(p)).toBe(true);
    }
  });

  it("allows root static + SEO/PWA assets that previously served HTML", () => {
    for (const p of [
      "/robots.txt", "/sitemap.xml", "/manifest.json", "/sw.js",
      "/favicon.ico", "/favicon.svg", "/icon-192.svg", "/icon-512.svg",
      "/logo.png", "/og-preview.png", "/og-preview.svg",
      "/opengraph-image", "/twitter-image",
    ]) {
      expect(isAllowedOnGate(p)).toBe(true);
    }
  });

  it("still seals the authenticated app + admin behind the gate", () => {
    for (const p of ["/dashboard", "/login", "/signup", "/interview", "/settings", "/admin", "/reset-password", "/onboarding"]) {
      expect(isAllowedOnGate(p)).toBe(false);
    }
  });

  it("does not allow an app route that merely contains an asset-like word", () => {
    expect(isAllowedOnGate("/dashboard/manifest")).toBe(false); // no extension → sealed
    expect(isAllowedOnGate("/interview/sw")).toBe(false);
  });
});
