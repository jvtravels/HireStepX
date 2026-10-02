import type { Metadata } from "next";
import dynamic from "next/dynamic";
import LoadingScreen from "@/_LoadingScreen";

export const metadata: Metadata = {
  title: "Jobs | HireStepX",
  description: "See every employer match from the HireStepX talent roster.",
};

// Mirror the /dashboard pattern: DashboardJobs is a heavy client surface,
// so load it dynamically. This fallback (not the route's loading.tsx) is
// what renders on a hard reload / direct navigation, so it uses the same
// shared LoadingScreen. Keeps the chunk off the auth-gated critical path and
// lets the component's own client boundary mount predictably.
// DashboardJobs already has "use client", so the server renders a
// lightweight fallback and the real component hydrates client-side.
const DashboardJobs = dynamic(() => import("@/DashboardJobs"), {
  loading: () => <LoadingScreen />,
});

export default function Page() {
  return <DashboardJobs />;
}
