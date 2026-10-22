import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { SettingsRouteSkeleton } from "@/routeSkeletons";

export const metadata: Metadata = {
  title: "Settings | HireStepX",
  description: "Manage your HireStepX account settings.",
};

// Mirror the /dashboard pattern: DashboardSettings is a heavy client surface,
// so load it dynamically. This fallback (not the route's loading.tsx) is
// what renders on a hard reload / direct navigation, so it's shaped like
// the stacked settings sections instead of a generic blob. Keeps the
// chunk off the auth-gated critical path and lets the component's own
// client boundary mount predictably. DashboardSettings already has
// "use client", so the server renders a lightweight fallback and the real
// component hydrates client-side.
const DashboardSettings = dynamic(() => import("@/DashboardSettings"), {
  loading: () => <SettingsRouteSkeleton />,
});

export default function Page() {
  return <DashboardSettings />;
}
