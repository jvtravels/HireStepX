import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { SessionsRouteSkeleton } from "@/routeSkeletons";

export const metadata: Metadata = {
  title: "Sessions | HireStepX",
  description:
    "View your past interview practice sessions and feedback.",
};

// Mirror the /dashboard pattern: SessionsV2 is a heavy client surface, so
// load it dynamically. This fallback (not the route's loading.tsx) is what
// renders on a hard reload / direct navigation, so it's shaped like the
// sessions table (toolbar + rows) instead of a generic blob. Keeps the
// chunk off the auth-gated critical path (better LCP/FCP) and lets the
// component's own client boundary mount predictably. SessionsV2 already
// has "use client", so the server renders a lightweight fallback and the
// real component hydrates on the client.
const SessionsV2 = dynamic(() => import("@/SessionsV2"), {
  loading: () => <SessionsRouteSkeleton />,
});

export default function Page() {
  return <SessionsV2 />;
}
