import type { Metadata } from "next";
import dynamic from "next/dynamic";

export const metadata: Metadata = {
  title: "Get Started | HireStepX",
  description: "Set up your profile for personalized interview practice.",
};

/**
 * Onboarding is ~1400 lines and imports the full resume parser + AI profile
 * analysis pipeline. Dynamic import lets the route's HTML shell paint first,
 * while the heavy JS streams in behind the minimal skeleton below. This
 * directly improves the /onboarding RES (currently 82, 224 samples) —
 * it's the second-most-hit route after landing.
 */
const Onboarding = dynamic(() => import("@/Onboarding"), {
  loading: () => (
    <div style={{ minHeight: "100vh", background: "#FAF7F0", padding: "80px 24px", fontFamily: "var(--font-ui, system-ui, sans-serif)" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ width: 160, height: 14, background: "#F4EFE3", borderRadius: 4, marginBottom: 16 }} />
        <div style={{ width: 380, height: 36, background: "#F4EFE3", borderRadius: 6, marginBottom: 12 }} />
        <div style={{ width: 520, height: 16, background: "#F4EFE3", borderRadius: 4, marginBottom: 40 }} />
        <div style={{ height: 320, background: "#F4EFE3", borderRadius: 14 }} />
      </div>
    </div>
  ),
});

export default function Page() {
  return <Onboarding />;
}
