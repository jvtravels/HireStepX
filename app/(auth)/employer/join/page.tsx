import type { Metadata } from "next";
import { Suspense } from "react";
import JoinTeam from "@/employer/JoinTeam";

export const metadata: Metadata = {
  title: "Join your team | HireStepX",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <JoinTeam />
    </Suspense>
  );
}
