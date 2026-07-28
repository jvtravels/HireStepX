/* global process, URL */
import { readFileSync } from "node:fs";

// Bare company slugs (e.g. /companies/flipkart) redirect to that company's
// first SEO page. Regenerate via scripts/generate-company-redirect-map.mjs
// whenever data/seo-pages.ts gains/reorders a company.
const companyRedirectMap = JSON.parse(
  readFileSync(new URL("./data/company-redirect-map.json", import.meta.url), "utf8"),
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable the behavioral v2 diagnostic-first report. The env-flag gate in
  // SessionReportView.tsx was a rollout safety valve during development —
  // the BehavioralFullReport component is production-ready and the canvas
  // design (interview-result-focus/Demos.tsx BehavioralStrongDemo) shows
  // it as THE behavioral report. Set here so Vercel picks it up without
  // requiring a separate env-var configuration step.
  env: {
    NEXT_PUBLIC_BEHAVIORAL_REPORT_V2: "true",
  },

  turbopack: {
    root: process.cwd(),
    resolveAlias: {
      canvas: "./lib/empty-canvas.js",
    },
  },

  // Ignore the canvas module that pdfjs-dist tries to require in Node.js
  serverExternalPackages: ["canvas"],

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
    }
    return config;
  },

  images: {
    remotePatterns: [
      { hostname: "images.unsplash.com" },
      // Scope to Supabase Storage only. The wildcard *.supabase.co covers every
      // subdomain of supabase.co including potential phishing subdomains — restrict
      // to just the Storage CDN hostname for our project. The hostname is always
      // <project-ref>.supabase.co for the REST API and storage.
      // TODO: further tighten to the exact project ref once it's available as an
      // env var (NEXT_PUBLIC_SUPABASE_URL → extract hostname, then use that directly).
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" },
    ],
  },

  async redirects() {
    return [
      // www → non-www 301. Vercel serves both by default; without this redirect
      // Google indexes www.hirestepx.com pages separately from hirestepx.com,
      // splitting PageRank across duplicate URLs even when canonical tags are correct.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.hirestepx.com" }],
        destination: "https://hirestepx.com/:path*",
        permanent: true,
      },
      // Old URL with wrong year that users bookmarked or linked; 2 GA4 hits/day.
      {
        source: "/blog/tcs-interview-questions-freshers-2025",
        destination: "/blog/tcs-interview-questions-freshers-2026",
        permanent: true,
      },
      // Legacy /page/<slug> URLs, retired in favour of the new-design marketing
      // routes. Moved here from app/(marketing)/page/[slug]/page.tsx: every page
      // under (marketing) inherits loading.tsx, which wraps it in a Suspense
      // boundary — Next starts streaming a 200 shell before a redirect() call
      // inside the page resolves, so crawlers only ever saw a client-side
      // meta-refresh, never a real 30x. A config-level redirect runs before
      // React rendering and always emits a genuine 308 + Location header.
      { source: "/page/about", destination: "/about", permanent: true },
      { source: "/page/contact", destination: "/contact", permanent: true },
      { source: "/page/help", destination: "/contact", permanent: true },
      { source: "/page/careers", destination: "/about", permanent: true },
      { source: "/page/privacy", destination: "/privacy", permanent: true },
      { source: "/page/terms", destination: "/terms", permanent: true },
      { source: "/page/refund", destination: "/refund", permanent: true },
      { source: "/page/pricing", destination: "/pricing", permanent: true },
      { source: "/page/:slug*", destination: "/", permanent: true },
      // Bare /companies/<company> URLs (e.g. /companies/flipkart), same
      // Suspense-streaming issue as /page/* above — moved to config so the
      // redirect is a real 308 instead of a client-side meta-refresh. The
      // in-page permanentRedirect() in companies/[slug]/page.tsx stays as a
      // fallback for any company added since this map was last generated.
      ...Object.entries(companyRedirectMap).map(([company, slug]) => ({
        source: `/companies/${company}`,
        destination: `/companies/${slug}`,
        permanent: true,
      })),
    ];
  },

  async headers() {
    // Content-Security-Policy is intentionally absent here.
    // It is generated per-request with a unique nonce in middleware.ts, which
    // injects `'nonce-{nonce}'` into script-src. A static CSP here would
    // conflict — the middleware-set response header always wins, making a
    // build-time CSP string dead weight. All other security headers are static
    // and safe to keep here.
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
