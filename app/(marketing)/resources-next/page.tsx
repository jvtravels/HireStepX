import type { Metadata } from "next";
import { ResourcesPage } from "@/home2/Resources";
import { buildResourceItems } from "@/home2/resourcesBuild";

export const metadata: Metadata = { title: "Interview resources | HireStepX", description: "Guides, company interview questions, salary data and city playbooks for Indian job seekers.", alternates: { canonical: "/resources" } };

export default function Page() {
  return <ResourcesPage items={buildResourceItems()} initial={{}} />;
}
