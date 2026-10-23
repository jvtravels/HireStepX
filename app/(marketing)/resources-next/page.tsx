import type { Metadata } from "next";
import { ResourcesPage } from "@/home2/Resources";
import { buildResourceItems } from "@/home2/resourcesBuild";

export const metadata: Metadata = { title: "Resources | HireStepX", robots: "noindex, nofollow", alternates: { canonical: "/resources" } };

const KINDS = ["guide", "question", "salary", "company", "city", "topic"] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const k = KINDS.find((x) => x === kind);
  return <ResourcesPage items={buildResourceItems()} initial={k ? { kinds: [k] } : {}} />;
}
