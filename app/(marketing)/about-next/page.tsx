import type { Metadata } from "next";
import { AboutPage } from "@/home2/About";
import { buildAboutJsonLd } from "../about/_jsonld";

export const metadata: Metadata = {
  title: "About HireStepX | AI Mock Interview Platform",
  description:
    "HireStepX is an AI mock interview platform built in Mumbai. Practice out loud, get honest scored feedback and walk into the real interview less nervous.",
  robots: "noindex, nofollow",
  alternates: { canonical: "/about" },
};

export default function Page() {
  return (
    <>
      {buildAboutJsonLd().map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <AboutPage />
    </>
  );
}
