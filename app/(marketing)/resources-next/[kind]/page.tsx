import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourcesPage } from "@/home2/Resources";
import { buildResourceItems } from "@/home2/resourcesBuild";

const KIND_META: Record<string, { path: string; title: string; description: string }> = {
  guide: { path: "/blog", title: "Interview prep blog | HireStepX", description: "Long-form guides on answering, structuring and rehearsing interviews." },
  question: { path: "/questions", title: "Interview questions by company | HireStepX", description: "Real interview questions asked at top Indian companies, with how to answer them." },
  salary: { path: "/salary", title: "Salary guides | HireStepX", description: "What roles actually pay in India, by company and level." },
  company: { path: "/resources/company", title: "Company interview guides | HireStepX", description: "What each company's interview loop looks like and how to prepare." },
  city: { path: "/resources/city", title: "City interview playbooks | HireStepX", description: "Hiring markets and interview prep by city." },
  topic: { path: "/resources/topic", title: "Interview topics | HireStepX", description: "Prep by topic: from students to career switchers." },
};

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }): Promise<Metadata> {
  const m = KIND_META[(await params).kind];
  return m ? { title: m.title, description: m.description, alternates: { canonical: m.path } } : {};
}

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
