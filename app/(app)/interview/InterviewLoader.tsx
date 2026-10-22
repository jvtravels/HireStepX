"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import LoadingScreen from "@/_LoadingScreen";
import RedirectNotice from "@/RedirectNotice";
import { useAuth } from "@/AuthContext";
import { hasInterviewStartIntent } from "@/interviewStartIntent";

const Interview = dynamic(() => import("@/Interview"), {
  ssr: false,
  loading: () => <LoadingScreen message="Connecting to AI interviewer…" />,
});

type Gate = "checking" | "ok" | "missing";

export default function InterviewLoader() {
  const { user } = useAuth();
  const [gate, setGate] = useState<Gate>("checking");

  // Runs once, before the engine mounts: the engine deletes stale drafts on
  // mount, so this check has to see storage first.
  useEffect(() => {
    setGate((g) => (g !== "checking" ? g : hasInterviewStartIntent(window.location.search, (k) => localStorage.getItem(k), user?.id) ? "ok" : "missing"));
  }, [user?.id]);

  if (gate === "checking") return <LoadingScreen message="Connecting to AI interviewer…" />;
  if (gate === "missing") {
    return (
      <RedirectNotice
        to="/dashboard"
        title="No interview in progress"
        message="Start a practice session from your dashboard. Taking you there now."
      />
    );
  }
  return <Interview />;
}
