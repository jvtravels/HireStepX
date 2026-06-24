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
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            // Note: 'unsafe-eval' was removed from script-src. Razorpay's
            // current checkout SDK does not require eval(); the directive
            // was a holdover. 'unsafe-inline' is still required by
            // Razorpay + inline analytics bootstrap and is the next thing
            // to harden via nonce / hash if/when we move to a strict CSP.
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' blob: https://checkout.razorpay.com https://*.razorpay.com https://va.vercel-scripts.com https://*.vercel-scripts.com; script-src-elem 'self' 'unsafe-inline' blob: https://checkout.razorpay.com https://*.razorpay.com https://va.vercel-scripts.com https://*.vercel-scripts.com https://us-assets.i.posthog.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.razorpay.com https://api.fontshare.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.razorpay.com https://api.fontshare.com; font-src 'self' https://fonts.gstatic.com https://api.fontshare.com https://cdn.fontshare.com; img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co https://*.razorpay.com https://cdn.simpleicons.org; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.groq.com https://generativelanguage.googleapis.com https://www.googleapis.com https://accounts.google.com https://oauth2.googleapis.com https://*.razorpay.com https://lumberjack.razorpay.com https://*.upstash.io https://vitals.vercel-insights.com https://va.vercel-scripts.com wss://api.cartesia.ai https://api.cartesia.ai wss://api.deepgram.com https://api.deepgram.com wss://api.sarvam.ai https://api.sarvam.ai https://*.tts.speech.microsoft.com https://api.resend.com https://*.sentry.io https://us.i.posthog.com https://us-assets.i.posthog.com https://*.i.posthog.com https://api.pwnedpasswords.com; frame-src https://api.razorpay.com https://checkout.razorpay.com; media-src 'self' blob: data:; worker-src 'self' blob:; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
