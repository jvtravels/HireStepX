import type { Metadata } from "next";
import { ResourcesPage } from "@/home2/Resources";
import { buildResourceItems } from "@/home2/resourcesBuild";

export const metadata: Metadata = { title: "Resources | HireStepX", robots: "noindex, nofollow", alternates: { canonical: "/resources" } };

export default function Page() {
  return <ResourcesPage items={buildResourceItems()} initial={{}} />;
}
