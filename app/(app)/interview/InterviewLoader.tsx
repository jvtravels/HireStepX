"use client";
import dynamic from "next/dynamic";
import LoadingScreen from "@/_LoadingScreen";

const Interview = dynamic(() => import("@/Interview"), {
  ssr: false,
  loading: () => <LoadingScreen message="Connecting to AI interviewer…" />,
});

export default function InterviewLoader() {
  return <Interview />;
}
