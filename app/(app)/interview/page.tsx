import type { Metadata } from "next";
import dynamic from "next/dynamic";

// Interview.tsx pulls in TTS/STT/audio chains — split it out of the
// initial bundle so the interview route doesn't bloat the app shell.
const Interview = dynamic(() => import("@/Interview"), { ssr: false });

export const metadata: Metadata = {
  title: "Interview | HireStepX",
  description: "AI-powered mock interview session.",
};

export default function Page() {
  return <Interview />;
}
