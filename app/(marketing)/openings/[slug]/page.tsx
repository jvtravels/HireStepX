import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpeningDetailPage } from "@/marketing-v2/OpeningsPages";
import { fetchLiveOpenings } from "../../../../server-handlers/_public-openings-fetch";
import { findOpeningBySlug } from "../../../../server-handlers/_public-openings-helpers";

export const revalidate = 300;
const BASE = "https://hirestepx.com";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const o = findOpeningBySlug(await fetchLiveOpenings(), slug);
  if (!o) return { title: "Role not found | HireStepX", robots: { index: false, follow: false } };
  const title = `${o.title}: Hiring on HireStepX | Practise for this Role`;
  return {
    title,
    description: o.summary,
    alternates: { canonical: `/openings/${o.slug}` },
    openGraph: { title: o.title, description: o.summary, url: `${BASE}/openings/${o.slug}`, type: "website", siteName: "HireStepX", locale: "en_IN" },
    twitter: { card: "summary_large_image", title: o.title, description: o.summary },
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const o = findOpeningBySlug(await fetchLiveOpenings(), slug);
  if (!o) notFound();
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}/` },
      { "@type": "ListItem", position: 2, name: "Open roles", item: `${BASE}/openings` },
      { "@type": "ListItem", position: 3, name: o.title, item: `${BASE}/openings/${o.slug}` },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />
      <OpeningDetailPage opening={o} url={`${BASE}/openings/${o.slug}`} />
    </>
  );
}
