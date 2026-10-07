import type { Metadata } from "next";
import dynamic from "next/dynamic";
import LoadingScreen from "@/_LoadingScreen";

export const metadata: Metadata = {
  title: "Messages | HireStepX",
  description: "Chat with employers who've unlocked your contact details.",
};

const MessagesV2 = dynamic(() => import("@/MessagesV2"), {
  loading: () => <LoadingScreen />,
});

export default function Page() {
  return <MessagesV2 />;
}
