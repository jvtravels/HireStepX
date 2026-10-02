import type { Metadata } from "next";
import dynamic from "next/dynamic";
import LoadingScreen from "@/_LoadingScreen";

export const metadata: Metadata = {
  title: "Your Profile | HireStepX",
  description:
    "Upload and manage your resume for personalized interview practice.",
};

// Mirror the /dashboard pattern: ResumeV2 is a heavy client surface, so
// load it dynamically. This fallback (not the route's loading.tsx) is
// what renders on a hard reload / direct navigation, so it uses the same
// shared LoadingScreen. Keeps the chunk off the auth-gated critical path and
// lets the component's own client boundary mount predictably.
// ResumeV2 already has "use client", so the server renders a lightweight
// fallback and the real component hydrates client-side.
const ResumeV2 = dynamic(() => import("@/ResumeV2"), {
  loading: () => <LoadingScreen />,
});

export default function Page() {
  return <ResumeV2 />;
}
