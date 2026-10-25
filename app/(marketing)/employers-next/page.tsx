import type { Metadata } from "next";
import { EmployersPage } from "@/home2/Pages";
import { JsonLd, breadcrumbs } from "@/home2/jsonld";

export const metadata: Metadata = {
  title: "Hire Interview-Ready Candidates | HireStepX",
  description: "See how candidates actually perform in interviews before you spend time on them. Scored evidence, side-by-side comparison, pay only to unlock.",
  alternates: { canonical: "/employers" },
  openGraph: {
    type: "website",
    url: "https://hirestepx.com/employers",
    title: "Hire Interview-Ready Candidates | HireStepX",
    description: "Read scored interview answers and compare candidates side by side. Reading is free. You pay only to reach someone.",
    siteName: "HireStepX",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hire Interview-Ready Candidates | HireStepX",
    description: "Read scored interview answers and compare candidates side by side. Reading is free. You pay only to reach someone.",
  },
};

export default function Page() {
  return (
    <>
      <JsonLd data={breadcrumbs([["For employers", "/employers"]])} />
      <EmployersPage />
    </>
  );
}
