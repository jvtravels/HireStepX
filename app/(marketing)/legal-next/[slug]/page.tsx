import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMeta } from "@/home2/pageMeta";
import { LegalDocPage } from "@/home2/LegalCanvas";
import { LEGAL_META, LEGAL_SLUGS } from "@/home2/legalDocs";
import { JsonLd, breadcrumbs } from "@/home2/jsonld";

const LEGAL_SEO: Record<string, { title: string; description: string }> = {
  privacy: { title: "Privacy Policy and Your DPDP Rights | HireStepX", description: "What HireStepX collects, who it is shared with, how cookies work, your rights under India's DPDP Act and how to reach the Grievance Officer." },
  terms: { title: "Terms of Service: Rules, Payments and Liability | HireStepX", description: "The rules for using HireStepX, including payments, acceptable use, how to raise a complaint and where our liability ends." },
  refund: { title: "Refund Policy: When Credits Are Refunded | HireStepX", description: "When unused session credits are refunded, how to ask for a refund and which purchases are not refundable." },
};

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = LEGAL_META.find((d) => d.slug === slug);
  const seo = LEGAL_SEO[slug];
  return pageMeta({ title: seo?.title ?? `${doc?.title ?? "Legal"} | HireStepX`, description: seo?.description ?? doc?.blurb ?? "HireStepX legal policies.", path: `/${slug}` });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!LEGAL_SLUGS.includes(slug)) notFound();
  const doc = LEGAL_META.find((d) => d.slug === slug);
  return (
    <>
      <JsonLd data={breadcrumbs([[doc?.title ?? "Legal", `/${slug}`]])} />
      <LegalDocPage slug={slug} />
    </>
  );
}
