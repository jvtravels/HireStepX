import type { Metadata } from "next";
import DashboardAnalytics from "@/DashboardAnalytics";
import ReadinessIndex from "@/readinessIndex/ReadinessIndex";

export const metadata: Metadata = {
  title: "Analytics | HireStepX",
  description:
    "Track your interview practice performance and improvement over time.",
};

// The server-computed Readiness Index is the live analytics surface. It is
// on by default; set NEXT_PUBLIC_READINESS_INDEX_V2=0 to fall back to the
// legacy DashboardAnalytics for one release without a code change.
const READINESS_V2 = process.env.NEXT_PUBLIC_READINESS_INDEX_V2 !== "0";

export default function Page() {
  return READINESS_V2 ? <ReadinessIndex /> : <DashboardAnalytics />;
}
