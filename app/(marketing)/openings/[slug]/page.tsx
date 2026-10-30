import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMeta } from "@/home2/pageMeta";
import { JsonLd, breadcrumbs } from "@/home2/jsonld";
import { OpeningDetailPage } from "@/home2/Openings";
import { fetchLiveOpenings } from "../../../../server-handlers/_public-openings-fetch";
import { findOpeningBySlug } from "../../../../server-handlers/_public-openings-helpers";

export const revalidate = 300;
const BASE = "https://hirestepx.com";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const o = findOpeningBySlug(await fetchLiveOpenings(), slug);
  if (!o) return { title: "Role not found | HireStepX", robots: { index: false, follow: false } };
  return pageMeta({
    title: `${o.title}: Hiring on HireStepX | Practise for this Role`,
    description: o.summary,
    path: `/openings/${o.slug}`,
    ogTitle: o.title,
  });
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const o = findOpeningBySlug(await fetchLiveOpenings(), slug);
  if (!o) notFound();
  return (
    <>
      <JsonLd data={breadcrumbs([["Open roles", "/openings"], [o.title, `/openings/${o.slug}`]])} />
      <OpeningDetailPage opening={o} url={`${BASE}/openings/${o.slug}`} />
    </>
  );
}
