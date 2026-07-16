"use client";
import dynamic from "next/dynamic";

// Client-only wrapper so the Server Component page can export metadata while
// still code-splitting the TTS/STT/audio chain away from the app shell.
const Interview = dynamic(() => import("@/Interview"), { ssr: false });

export default function InterviewLoader() {
  return <Interview />;
}
