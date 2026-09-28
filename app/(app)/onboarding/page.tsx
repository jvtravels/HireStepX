import type { Metadata } from "next";
import dynamic from "next/dynamic";
import LoadingScreen from "@/_LoadingScreen";

export const metadata: Metadata = {
  title: "Get Started | HireStepX",
  description: "Set up your profile for personalized interview practice.",
};

/**
 * Onboarding is ~1400 lines and imports the full resume parser + AI profile
 * analysis pipeline. Dynamic import lets the route's HTML shell paint first,
 * while the heavy JS streams in behind the fallback below — this fallback
 * (not the route's loading.tsx) is what renders on a hard reload / direct
 * navigation, so it uses the same shared LoadingScreen. This directly
 * improves the /onboarding RES (currently 82, 224 samples) — it's the
 * second-most-hit route after landing.
 */
const Onboarding = dynamic(() => import("@/Onboarding"), {
  loading: () => <LoadingScreen />,
});

export default function Page() {
  return <Onboarding />;
}
