import type { Metadata } from "next";
import { ContactPage } from "@/home2/Contact";

export const metadata: Metadata = { title: "Contact HireStepX", robots: "noindex, nofollow", alternates: { canonical: "/contact" } };

export default function Page() {
  return <ContactPage />;
}
