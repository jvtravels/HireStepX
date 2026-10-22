import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { DashboardRouteSkeleton } from "@/routeSkeletons";

export const metadata: Metadata = {
  title: "Dashboard | HireStepX",
  description:
    "Your interview practice dashboard. Track progress and start new sessions.",
};

// DashboardHome is a 1500-line client component. Loading it dynamically keeps
// it out of the critical path for auth-gated navigation, letting the route
// show a fallback while the chunk streams in. This directly improves LCP +
// FCP for /dashboard (currently the worst-RES route at 68). Next 16
// disallows `ssr: false` in Server Components. DashboardHome already has
// `"use client"`, so SSR of the shell produces a lightweight fallback and
// the real component hydrates on the client without a wasted server render.
// This fallback (not the route's loading.tsx) is what renders on a hard
// reload / direct navigation, so it's shaped like the dashboard's own
// card-grid layout instead of a generic spinner/blob.
const DashboardHome = dynamic(() => import("@/DashboardHome"), {
  loading: () => <DashboardRouteSkeleton />,
});

export default function Page() {
  return <DashboardHome />;
}
