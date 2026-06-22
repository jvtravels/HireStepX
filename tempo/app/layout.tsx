import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${jetbrainsMono.variable}`}>
      <head />
      <body className={"bg-[#FAF7F0] text-[#0E0C08]"}>{children}</body>
    </html>
  );
}
