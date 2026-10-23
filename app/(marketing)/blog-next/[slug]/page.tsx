import type { Metadata } from "next";
import { Ads } from "@/home2/Ads";
import { isThinBlogPost } from "@/blogQuality";
import { notFound } from "next/navigation";
import { ArticleTemplate } from "@/home2/SeoTemplates";
import { articlePost, articleProps } from "@/home2/seoData";
import { generateMetadata as prodMetadata } from "../../blog/[slug]/page";
import { buildBlogJsonLd } from "../../blog/[slug]/_jsonld";

export const revalidate = 2592000;

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return { ...(await prodMetadata(props)), robots: "noindex, nofollow" };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = articlePost(slug);
  if (!post) notFound();
  return (
    <>
      {buildBlogJsonLd(slug).map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <Ads thin={isThinBlogPost(slug)} />
      <ArticleTemplate {...articleProps(post)} />
    </>
  );
}
