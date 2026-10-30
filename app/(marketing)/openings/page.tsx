import type { Metadata } from "next";
import { pageMeta } from "@/home2/pageMeta";
import { JsonLd, breadcrumbs } from "@/home2/jsonld";
import { OpeningsIndexPage } from "@/home2/Openings";
import { fetchLiveOpenings } from "../../../server-handlers/_public-openings-fetch";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const openings = await fetchLiveOpenings();
  return {
    ...pageMeta({
      title: "Open Roles Hiring on HireStepX | Practise, Then Get Seen",
      description:
        "Roles from employers hiring through HireStepX, listed without company names. Practise an AI mock interview for the role you want; employers read your scored answers.",
      path: "/openings",
    }),
    // An empty list is a thin page: keep it out of the index until a role is live.
    robots: openings.length === 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function Page() {
  return (
    <>
      <JsonLd data={breadcrumbs([["Open roles", "/openings"]])} />
      <OpeningsIndexPage openings={await fetchLiveOpenings()} />
    </>
  );
}
