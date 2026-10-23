import type { Metadata } from "next";
import { ContactPage } from "@/home2/Contact";

export const metadata: Metadata = { title: "Contact HireStepX", description: "Questions, feedback or partnership ideas? Write to the HireStepX team and we will reply within one working day.", alternates: { canonical: "/contact" } };

export default function Page() {
  return <ContactPage />;
}
