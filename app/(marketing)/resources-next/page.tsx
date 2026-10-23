import type { Metadata } from "next";
import { ResourcesPage } from "@/home2/Resources";

export const metadata: Metadata = {
  title: "HireStepX resources",
  robots: "noindex, nofollow",
  alternates: { canonical: "/resources" },
};

export default function Page() {
  return <ResourcesPage />;
}
