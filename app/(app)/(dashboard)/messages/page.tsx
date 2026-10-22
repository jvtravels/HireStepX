import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { MessagesRouteSkeleton } from "@/routeSkeletons";

export const metadata: Metadata = {
  title: "Messages | HireStepX",
  description: "Chat with employers who've unlocked your contact details.",
};

// This fallback (not the route's loading.tsx) is what renders on a hard
// reload / direct navigation, so it's shaped like the two-pane
// conversation-list + thread layout instead of a generic blob.
const MessagesV2 = dynamic(() => import("@/MessagesV2"), {
  loading: () => <MessagesRouteSkeleton />,
});

export default function Page() {
  return <MessagesV2 />;
}
