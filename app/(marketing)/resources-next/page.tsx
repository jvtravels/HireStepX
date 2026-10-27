import type { Metadata } from "next";
import { pageMeta } from "@/home2/pageMeta";
import { ResourcesPage } from "@/home2/Resources";
import { buildResourceItems } from "@/home2/resourcesBuild";
import { JsonLd, breadcrumbs } from "@/home2/jsonld";

export const metadata: Metadata = pageMeta({
  title: "Interview Resources: Guides, Questions, Salaries | HireStepX",
  description: "Guides, company interview questions, salary data and city playbooks for Indian job seekers. Search the library and prepare for your next interview.",
  path: "/resources",
});

export default function Page() {
  return (
    <>
      <JsonLd data={breadcrumbs([["Resources", "/resources"]])} />
      <ResourcesPage items={buildResourceItems()} initial={{}} />
    </>
  );
}
