import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocPage, LegalHubPage } from "@/home2/Legal";
import { LEGAL_META, LEGAL_SLUGS } from "@/home2/legalDocs";

type Props = { params: Promise<{ slug?: string[] }> };

export function generateStaticParams() {
  return [{ slug: [] }, ...LEGAL_SLUGS.map((s) => ({ slug: [s] }))];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = LEGAL_META.find((d) => d.slug === slug?.[0]);
  return {
    title: doc ? `${doc.title} | HireStepX` : "Legal and trust | HireStepX",
    robots: "noindex, nofollow",
    alternates: { canonical: doc ? `/${doc.slug}` : "/legal" },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (!slug || slug.length === 0) return <LegalHubPage />;
  if (slug.length > 1 || !LEGAL_SLUGS.includes(slug[0])) notFound();
  return <LegalDocPage slug={slug[0]} />;
}
