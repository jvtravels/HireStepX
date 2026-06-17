import type { Metadata } from "next";
import dynamic from "next/dynamic";

export const metadata: Metadata = {
  title: "Settings | HireStepX",
  description: "Manage your HireStepX account settings.",
};

// Mirror the /dashboard pattern: DashboardSettings is a heavy client surface,
// so load it dynamically with its own loading skeleton instead of relying on
// the route-level loading.tsx Suspense boundary. Keeps the chunk off the
// auth-gated critical path and lets the component's own client boundary mount
// predictably. DashboardSettings already has "use client", so the server
// renders a lightweight skeleton and the real component hydrates client-side.
const DashboardSettings = dynamic(() => import("@/DashboardSettings"), {
  loading: () => (
    <div style={{ padding: 24, background: "#FAF7F0", minHeight: "100vh", fontFamily: "var(--font-ui, system-ui, sans-serif)" }}>
      <div style={{ width: 200, height: 28, background: "#F4EFE3", borderRadius: 6, marginBottom: 24 }} />
      <div style={{ display: "grid", gap: 12 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 120, background: "#F4EFE3", borderRadius: 12 }} />
        ))}
      </div>
    </div>
  ),
});

export default function Page() {
  return <DashboardSettings />;
}
