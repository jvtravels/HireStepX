import type { Metadata } from "next";
import { pageMeta } from "@/home2/pageMeta";
import { EmployersPage } from "@/home2/Pages";
import { JsonLd, breadcrumbs } from "@/home2/jsonld";

export const metadata: Metadata = pageMeta({
  title: "Hire Interview-Ready Candidates | HireStepX",
  description: "See how candidates actually perform in interviews before you spend time on them. Scored evidence, side-by-side comparison, pay only to unlock.",
  path: "/employers",
  ogDescription: "Read scored interview answers and compare candidates side by side. Reading is free. You pay only to reach someone.",
});

export default function Page() {
  return (
    <>
      <JsonLd data={breadcrumbs([["For employers", "/employers"]])} />
      <EmployersPage />
    </>
  );
}
