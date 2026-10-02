import type { Metadata } from "next";
import dynamic from "next/dynamic";
import LoadingScreen from "@/_LoadingScreen";

export const metadata: Metadata = {
  title: "Analytics | HireStepX",
  description:
    "Track your interview practice performance and improvement over time.",
};

// The server-computed Readiness Index is the live analytics surface. It is
// on by default; set NEXT_PUBLIC_READINESS_INDEX_V2=0 to fall back to the
// legacy DashboardAnalytics for one release without a code change.
const READINESS_V2 = process.env.NEXT_PUBLIC_READINESS_INDEX_V2 !== "0";

// Mirror the /dashboard pattern: both analytics surfaces are heavy client
// components, so load them dynamically. This fallback (not the route's
// loading.tsx) is what renders on a hard reload / direct navigation, so it
// uses the same shared LoadingScreen. Keeps the chunk off the auth-gated
// critical path and lets each component's own client boundary mount
// predictably. Both already have "use client", so the server renders a
// lightweight fallback and the real component hydrates client-side.
const ReadinessIndex = dynamic(() => import("@/readinessIndex/ReadinessIndex"), {
  loading: () => <LoadingScreen />,
});
const DashboardAnalytics = dynamic(() => import("@/DashboardAnalytics"), {
  loading: () => <LoadingScreen />,
});

export default function Page() {
  return READINESS_V2 ? <ReadinessIndex /> : <DashboardAnalytics />;
}
