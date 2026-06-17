import type { Metadata } from "next";
import dynamic from "next/dynamic";

export const metadata: Metadata = {
  title: "Sessions | HireStepX",
  description:
    "View your past interview practice sessions and feedback.",
};

// Mirror the /dashboard pattern: SessionHistoryRoute is a heavy client
// surface, so load it dynamically with its own loading skeleton instead of
// relying on the route-level loading.tsx Suspense boundary. Keeps the chunk
// off the auth-gated critical path (better LCP/FCP) and lets the component's
// own client boundary mount predictably. SessionHistoryRoute already has
// "use client", so the server renders a lightweight skeleton and the real
// component hydrates on the client.
const SessionHistoryRoute = dynamic(() => import("@/SessionHistoryRoute"), {
  loading: () => (
    <div style={{ padding: 24, background: "#FAF7F0", minHeight: "100vh", fontFamily: "var(--font-ui, system-ui, sans-serif)" }}>
      <div style={{ width: 200, height: 28, background: "#F4EFE3", borderRadius: 6, marginBottom: 24 }} />
      <div style={{ display: "grid", gap: 12 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 96, background: "#F4EFE3", borderRadius: 12 }} />
        ))}
      </div>
    </div>
  ),
});

export default function Page() {
  return <SessionHistoryRoute />;
}
