import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourcesPage } from "@/home2/Resources";
import { buildResourceItems } from "@/home2/resourcesBuild";

const KIND_META: Record<string, { path: string; title: string; description: string }> = {
  guide: { path: "/blog", title: "Interview Prep Blog: Guides for Indian Job Seekers | HireStepX", description: "Long-form guides on answering, structuring and rehearsing interviews. Written for Indian job seekers, with examples you can practice out loud." },
  question: { path: "/questions", title: "Interview Questions by Company, with Answers | HireStepX", description: "Real interview questions asked at top Indian companies, why interviewers ask them and how to answer without rambling. Practice them with AI." },
  salary: { path: "/salary", title: "Salary Guides for India by Company and Level | HireStepX", description: "What roles actually pay in India, by company and level. Use real ranges to negotiate your offer with confidence instead of guesses." },
  company: { path: "/resources/company", title: "Company Interview Guides | HireStepX", description: "What each company's interview loop looks like, which rounds to expect and how to prepare for every stage, from screening to final." },
  city: { path: "/resources/city", title: "City Interview Playbooks for India | HireStepX", description: "Hiring markets and interview prep by city. See what employers in each city look for and how to prepare for local interview styles." },
  topic: { path: "/resources/topic", title: "Interview Prep by Topic | HireStepX", description: "Prep by topic, from freshers and students to career switchers. Pick your situation and start with guides written for it." },
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
