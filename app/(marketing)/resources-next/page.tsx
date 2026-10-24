import type { Metadata } from "next";
import { ResourcesPage } from "@/home2/Resources";
import { buildResourceItems } from "@/home2/resourcesBuild";

export const metadata: Metadata = { title: "Interview Resources: Guides, Questions and Salaries | HireStepX", description: "Guides, company interview questions, salary data and city playbooks for Indian job seekers. Search the library and prepare for your next interview.", alternates: { canonical: "/resources" } };

export default function Page() {
  return <ResourcesPage items={buildResourceItems()} initial={{}} />;
}
