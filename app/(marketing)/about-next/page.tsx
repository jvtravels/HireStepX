import type { Metadata } from "next";
import { AboutPage } from "@/home2/About";

export const metadata: Metadata = { title: "About HireStepX", robots: "noindex, nofollow", alternates: { canonical: "/about" } };

export default function Page() {
  return <AboutPage />;
}
