import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthSkin } from "@/home2/AuthSkin";
import JoinTeam, { JoinTopLink } from "@/employer/JoinTeam";

export const metadata: Metadata = {
  title: "Join your team | HireStepX",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return (
    <AuthSkin top={<Suspense fallback={null}><JoinTopLink /></Suspense>}>
      <Suspense fallback={null}>
        <JoinTeam />
      </Suspense>
    </AuthSkin>
  );
}
