import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Instrument_Serif } from "next/font/google";
import localFont from "next/font/local";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
  preload: true,
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const geistMono = localFont({
  src: [
    { path: "../../public/fonts/geist-mono-var.woff2", weight: "400 700", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
  preload: false,  // Non-critical — used only in metrics/badges below the fold
  fallback: ["SF Mono", "Consolas", "Menlo", "monospace"],
});

const geistSans = localFont({
  src: [
    { path: "../../public/fonts/geist-sans-var.woff2", weight: "400 700", style: "normal" },
  ],
  variable: "--font-ui",
  display: "swap",
  preload: true,
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
  adjustFontFallback: "Arial",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${geistMono.variable}`}>
      <head />
      <body className={`bg-background text-foreground ${geistSans.variable}`}>{children}</body>
    </html>
  );
}
