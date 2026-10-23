import type { Metadata } from "next";
import { Ads } from "@/home2/Ads";
import { isSyntheticHeavySalaryPage } from "@/salaryQuality";
import { notFound } from "next/navigation";
import { SalaryTemplate } from "@/home2/SeoTemplates";
import { salaryProps } from "@/home2/seoData";
import { generateMetadata as prodMetadata } from "../../salary/[company]/page";
import { buildSalaryPageModel } from "../../salary/[company]/_jsonld";

export const revalidate = 2592000;

export async function generateMetadata(props: { params: Promise<{ company: string }> }): Promise<Metadata> {
  return { ...(await prodMetadata(props)), robots: "noindex, nofollow" };
}

export default async function Page({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const props = salaryProps(company);
  if (!props) notFound();
  const { jsonLdScripts } = buildSalaryPageModel(company)!;
  return (
    <>
      {jsonLdScripts.map((html, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={html} />
      ))}
      <Ads thin={isSyntheticHeavySalaryPage(company)} />
      <SalaryTemplate {...props} />
    </>
  );
}
