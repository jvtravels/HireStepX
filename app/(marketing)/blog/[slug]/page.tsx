import type { Metadata } from "next";
import BlogPage from "@/BlogPage";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

function formatSlug(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const title = formatSlug(slug);
  return {
    title: `${title} | HireStepX Blog`,
    description: `Read "${title}" on the HireStepX blog: interview tips, career advice, and job search strategies for Indian candidates.`,
    /* Per-slug canonical prevents duplicate-content signals if the
     * same post is reachable via tracked / query-stringed URLs. */
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: `${title} | HireStepX Blog`,
      url: `https://hirestepx.com/blog/${slug}`,
      type: "article",
    },
  };
}

// Each blog post — CDN cached, daily revalidate.
export const dynamic = "force-static";
export const revalidate = 86400;
// Incrementally statically generate slugs on first visit (ISR fallback).
export const dynamicParams = true;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = formatSlug(slug);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(
          breadcrumb([
            { name: "Blog", path: "/blog" },
            { name: title, path: `/blog/${slug}` },
          ]),
        )}
      />
      <BlogPage />
    </>
  );
}
