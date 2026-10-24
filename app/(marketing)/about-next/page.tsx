import type { Metadata } from "next";
import { AboutPage } from "@/home2/About";
import { JsonLd, breadcrumbs } from "@/home2/jsonld";

export const metadata: Metadata = { title: "About Us: Built in Mumbai | HireStepX", description: "Made in Mumbai, India. HireStepX is an AI mock interview platform built for Indian candidates: speak, get scored, fix what matters.", alternates: { canonical: "/about" } };

export default function Page() {
  return (
    <>
      <JsonLd data={breadcrumbs([["About", "/about"]])} />
      <AboutPage />
    </>
  );
}
