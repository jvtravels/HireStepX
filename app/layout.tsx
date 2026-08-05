import type { Metadata, Viewport } from "next";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "../src/index.css";

/* ── Google Fonts via next/font ──
 *
 * Each font has:
 *   - display: "swap" so FCP never blocks on font download
 *   - adjustFontFallback: auto — Next.js generates a size-adjusted fallback
 *     which removes the CLS spike when the real font loads
 *   - preload: true for the two critical (UI + display) fonts; JetBrains Mono
 *     (used only in the Hero metrics + occasional badges) is preload:false
 *     to cut a parallel font download off the critical path.
 */
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
  preload: true,
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-mono",
  display: "swap",
  preload: false,  // Non-critical — used only in metrics/badges below the fold
  fallback: ["SF Mono", "Consolas", "Menlo", "monospace"],
});

/* ── Satoshi — self-hosted via next/font/local ──
 * Previously loaded from Fontshare CDN (render-blocking, third-party, no
 * size-adjusted fallback → CLS). Self-hosting eliminates the CDN dependency,
 * enables preload, and gives next/font the adjustFontFallback CLS fix.
 * WOFF2 files in public/fonts/ (~25KB each × 3 weights = 75KB total). */
const satoshi = localFont({
  src: [
    { path: "../public/fonts/satoshi-400.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/satoshi-500.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/satoshi-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-ui",
  display: "swap",
  preload: true,
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
  adjustFontFallback: "Arial",
});

/* ── SEO Metadata ── */
export const metadata: Metadata = {
  title: "HireStepX: AI-Powered Mock Interview Platform",
  description:
    "Practice mock interviews with AI interviewers. Get real-time feedback, STAR analysis, and personalized coaching. 2 free sessions, no credit card required.",
  keywords:
    "mock interview, AI interview practice, interview preparation, STAR method, behavioral interview, technical interview, panel interview, campus placement, HR round, salary negotiation, India",
  authors: [{ name: "HireStepX" }],
  /* Only the production deployment is indexable. Preview/staging deploys
     (VERCEL_ENV "preview"/"development") return noindex so staging URLs
     never compete with hirestepx.com in search or leak pre-release copy
     into SERPs. This is the load-bearing signal — a <meta name="robots">
     noindex deters indexing even for URLs a crawler already discovered,
     which robots.txt alone does not. */
  robots:
    process.env.VERCEL_ENV === "production"
      ? "index, follow"
      : "noindex, nofollow",
  metadataBase: new URL("https://hirestepx.com"),
  /* Canonical only. No hreflang languages map until /hi/* actually exists —
   * pointing multiple locales at the same URL is a duplicate-content
   * signal Google may penalise. Re-add `languages: { "en-IN": "/", "hi-IN":
   * "/hi", "x-default": "/" }` the day Hindi routes ship. */
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.json",
  icons: [{ url: "/favicon.svg?v=2", type: "image/svg+xml" }],
  openGraph: {
    type: "website",
    url: "https://hirestepx.com/",
    title: "HireStepX: AI Mock Interview Practice",
    description:
      "Practice mock interviews with AI. Get scored on STAR structure, communication, and technical depth. 2 free sessions.",
    // Image is auto-picked up from app/opengraph-image.tsx (dynamic 1200x630).
    // Sub-routes can still override by exporting openGraph.images from their
    // own generateMetadata (or by dropping a sibling opengraph-image.tsx).
    siteName: "HireStepX",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "HireStepX: AI Mock Interview Practice",
    description:
      "Practice mock interviews with AI. Get scored on STAR structure, communication, and technical depth.",
    // Same as openGraph: auto-picked up from app/twitter-image.tsx if present,
    // otherwise falls back to the opengraph-image.
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HireStepX",
    // Absolute path — Next's Metadata API accepts string | string[] here.
    // We reuse the 192 SVG; iOS rasterises from the device's preferred size.
    startupImage: ["/favicon.svg"],
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "HireStepX",
    "apple-touch-icon": "/favicon.svg",
    // Google Search Console ownership verification.
    // Set NEXT_PUBLIC_GSC_VERIFICATION in Vercel env vars after verifying
    // the property in GSC (HTML tag method). Redeploy once set.
    ...(process.env.NEXT_PUBLIC_GSC_VERIFICATION
      ? { "google-site-verification": process.env.NEXT_PUBLIC_GSC_VERIFICATION }
      : {}),
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF7F0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,   // Allow pinch-zoom up to 5x (WCAG 2.1 SC 1.4.4)
  userScalable: true,
  viewportFit: "cover",
  // Resize layout when the mobile virtual keyboard opens so inputs stay
  // visible instead of being hidden behind the keyboard. Without this,
  // Chrome/Safari default to overlaying the keyboard on top of the
  // content, which pushes forms out of view mid-typing.
  interactiveWidget: "resizes-content",
};

/* ── Client helpers (extracted to keep layout a server component) ── */
import { ServiceWorkerRegistrar } from "./ServiceWorkerRegistrar";
import { OfflineBanner } from "./OfflineBanner";
import CookieConsent from "./CookieConsent";
import ConsentGatedAnalytics from "./ConsentGatedAnalytics";
import { RouteFocusManager } from "./RouteFocusManager";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/*
          Critical-path preconnects only. Supabase is hit on every auth-gated
          page load. Removed Cartesia + Deepgram preconnects from the root —
          they were costing an extra TCP+TLS handshake on every page load
          but only the /interview route actually uses those services. We now
          preconnect from Interview.tsx with useEffect-injected links.
        */}
        {/* Satoshi is self-hosted via next/font/local (public/fonts/satoshi-*.woff2).
            The CDN preconnects and stylesheet link are no longer needed. */}
        <meta name="google-adsense-account" content="ca-pub-7810403590527236" />
        <link rel="preconnect" href="https://esluwqkqoofmquqdevap.supabase.co" crossOrigin="anonymous" />
        {/* dns-prefetch (not preconnect) for LLM/TTS/STT origins — only
            /interview needs a live TCP connection. Prefetch cuts the first-lookup
            latency when the user eventually starts a session without burning a
            TCP+TLS handshake on every page that never reaches the interview. */}
        <link rel="dns-prefetch" href="https://api.groq.com" />
        <link rel="dns-prefetch" href="https://api.sarvam.ai" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://us.i.posthog.com" />
      </head>
      <body className={`bg-[#FAF7F0] text-[#0E0C08] ${satoshi.variable}`}>
        <a href="#main-content" className="skip-to-content">Skip to main content</a>
        {/* Route change announcer for screen readers */}
        <div
          id="route-announcer"
          role="status"
          aria-live="assertive"
          aria-atomic="true"
          className="sr-only"
        />

        <OfflineBanner />

        <RouteFocusManager />
        <div id="main-content" tabIndex={-1} style={{ outline: "none" }}>
          {children}
        </div>

        <ServiceWorkerRegistrar />
        <CookieConsent />
        <ConsentGatedAnalytics />
      </body>
    </html>
  );
}
