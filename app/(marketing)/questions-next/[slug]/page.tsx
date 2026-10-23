import type { Metadata } from "next";
import { Ads } from "@/home2/Ads";
import { isThinDuplicateQuestionsPage } from "../../questions/[slug]/_jsonld";
import { notFound } from "next/navigation";
import { QuestionSetTemplate } from "@/home2/SeoTemplates";
import { questionsModel } from "@/home2/seoData";
import { generateMetadata as prodMetadata } from "../../questions/[slug]/page";

export const revalidate = 2592000;

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return { ...(await prodMetadata(props)), robots: "noindex, nofollow" };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const model = questionsModel(slug);
  if (!model) notFound();
  return (
    <>
      {model.jsonLdScripts.map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <Ads thin={isThinDuplicateQuestionsPage(slug)} />
      <QuestionSetTemplate model={model} />
    </>
  );
}
