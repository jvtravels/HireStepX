import type { Metadata } from "next";
import { AboutPage } from "@/home2/About";

export const metadata: Metadata = { title: "About HireStepX", description: "Made in Mumbai, India. HireStepX is an AI mock interview platform built for Indian candidates: speak, get scored, fix what matters.", alternates: { canonical: "/about" } };

export default function Page() {
  return <AboutPage />;
}
