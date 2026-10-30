import type { Metadata } from "next";
import { OpeningsIndexPage } from "@/marketing-v2/OpeningsPages";
import { fetchLiveOpenings } from "../../../server-handlers/_public-openings-fetch";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const openings = await fetchLiveOpenings();
  return {
    title: "Open Roles Hiring on HireStepX | Practise, Then Get Seen",
    description:
      "Roles from employers hiring through HireStepX, listed without company names. Practise an AI mock interview for the role you want; employers read your scored answers.",
    alternates: { canonical: "/openings" },
    // An empty list is a thin page: keep it out of the index until a role is live.
    robots: openings.length === 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function Page() {
  return <OpeningsIndexPage openings={await fetchLiveOpenings()} />;
}
