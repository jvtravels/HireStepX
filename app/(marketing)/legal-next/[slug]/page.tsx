import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocPage } from "@/home2/LegalCanvas";
import { LEGAL_META, LEGAL_SLUGS } from "@/home2/legalDocs";

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = LEGAL_META.find((d) => d.slug === slug);
  return { title: `${doc?.title ?? "Legal"} | HireStepX`, alternates: { canonical: `/${slug}` } };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!LEGAL_SLUGS.includes(slug)) notFound();
  return <LegalDocPage slug={slug} />;
}
