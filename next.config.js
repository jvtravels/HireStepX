/* global process */
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
