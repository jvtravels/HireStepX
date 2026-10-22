import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { ReferralsRouteSkeleton } from "@/routeSkeletons";

export const metadata: Metadata = {
  title: "Referrals | HireStepX",
  description: "Invite friends to HireStepX and earn a free session for every friend who joins.",
};

// /referral (singular) is the public marketing page, so the signed-in screen
// lives at /referrals.
const DashboardReferrals = dynamic(() => import("@/DashboardReferrals"), {
  loading: () => <ReferralsRouteSkeleton />,
});

export default function Page() {
  return <DashboardReferrals />;
}
