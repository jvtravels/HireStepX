import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthSkin } from "@/home2/AuthSkin";
import JoinTeam, { JoinTopLink } from "@/employer/JoinTeam";

export const metadata: Metadata = {
  title: "Join your team | HireStepX",
  description: "Accept your invitation and join your team on HireStepX.",
  robots: { index: false, follow: false },
  // Never sends the token to a third party, but still lets our own API see an Origin/Referer.
  referrer: "same-origin",
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
