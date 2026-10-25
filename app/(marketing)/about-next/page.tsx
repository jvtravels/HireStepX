import type { Metadata } from "next";
import { pageMeta } from "@/home2/pageMeta";
import { AboutPage } from "@/home2/About";
import { JsonLd, breadcrumbs } from "@/home2/jsonld";

export const metadata: Metadata = pageMeta({
  title: "About HireStepX: AI Mock Interviews, Built in Mumbai",
  description: "Made in Mumbai, India. HireStepX is an AI mock interview platform built for Indian candidates: speak, get scored, fix what matters.",
  path: "/about",
});

export default function Page() {
  return (
    <>
      <JsonLd data={breadcrumbs([["About", "/about"]])} />
      <AboutPage />
    </>
  );
}
