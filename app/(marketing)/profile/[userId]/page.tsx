import type { Metadata } from "next";
import PublicProfile from "@/PublicProfile";

export const metadata: Metadata = {
  title: "User Profile | HireStepX",
  description: "View interview practice profile on HireStepX.",
  robots: "noindex",
};

export default function Page() {
  return <PublicProfile />;
}
