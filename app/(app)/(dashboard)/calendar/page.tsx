import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { CalendarRouteSkeleton } from "@/routeSkeletons";

export const metadata: Metadata = {
  title: "Calendar | HireStepX",
  description:
    "Schedule and view your upcoming interview practice sessions.",
};

// Mirror the /dashboard pattern: DashboardCalendar is a heavy client surface,
// so load it dynamically. This fallback (not the route's loading.tsx) is
// what renders on a hard reload / direct navigation, so it's shaped like
// the hero-card + month-grid layout instead of a generic blob. Keeps the
// chunk off the auth-gated critical path and lets the component's own
// client boundary mount predictably. DashboardCalendar already has
// "use client", so the server renders a lightweight fallback and the real
// component hydrates client-side.
const DashboardCalendar = dynamic(() => import("@/DashboardCalendar"), {
  loading: () => <CalendarRouteSkeleton />,
});

export default function Page() {
  return <DashboardCalendar />;
}
