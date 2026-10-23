import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourcesPage } from "@/home2/Resources";
import { buildResourceItems } from "@/home2/resourcesBuild";

export const metadata: Metadata = { title: "Resources | HireStepX", robots: "noindex, nofollow", alternates: { canonical: "/resources" } };

const KINDS = ["guide", "question", "salary", "company", "city", "topic"] as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return KINDS.map((kind) => ({ kind }));
}

export default async function Page({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const k = KINDS.find((x) => x === kind);
  if (!k) notFound();
  return <ResourcesPage items={buildResourceItems()} initial={{ kinds: [k] }} />;
}
