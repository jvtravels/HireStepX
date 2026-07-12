import type { Metadata } from "next";
import BlogPage from "@/BlogPage";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

export const metadata: Metadata = {
  title: "Interview Preparation Blog India 2026 — TCS, Google, Flipkart & More | HireStepX",
  description:
    "Company-specific interview guides for Indian job seekers. TCS NQT, Google behavioral, Flipkart system design, Amazon Leadership Principles, campus placement tips, and salary negotiation — all written for 2026 India.",
  keywords: [
    "interview preparation blog India",
    "TCS interview guide 2026",
    "Google interview questions India",
    "campus placement tips India",
    "fresher interview tips 2026",
    "behavioral interview India",
  ].join(", "),
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    title: "Interview Preparation Blog India 2026 | HireStepX",
    description: "Guides for TCS, Google, Flipkart, Amazon, Deloitte and more. 2026 India job market.",
    url: "https://hirestepx.com/blog",
    siteName: "HireStepX",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Interview Preparation Blog India 2026 | HireStepX",
    description: "Company-specific interview guides for Indian candidates. TCS, Google, Flipkart, Amazon, and 20+ more.",
  },
};

// Blog index — static CDN cache, 1-hour revalidate so new posts go live fast.
export const dynamic = "force-static";
export const revalidate = 3600;

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(breadcrumb([{ name: "Blog", path: "/blog" }]))}
      />
      <BlogPage />
    </>
  );
}
