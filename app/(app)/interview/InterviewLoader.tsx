"use client";
import dynamic from "next/dynamic";

const Interview = dynamic(() => import("@/Interview"), {
  ssr: false,
  loading: () => (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100dvh", gap: 16,
      background: "#FAF7F0", fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        width: 32, height: 32, border: "2.5px solid #EBE5D2",
        borderTopColor: "#B45309", borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{ fontSize: 14, color: "#6E6759" }}>Connecting to AI interviewer…</span>
    </div>
  ),
});

export default function InterviewLoader() {
  return <Interview />;
}
