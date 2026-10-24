import type { Metadata } from "next";
import { CandidatesPage } from "@/home2/Candidates";
import { JsonLd, breadcrumbs } from "@/home2/jsonld";

export const metadata: Metadata = {
  title: "AI Mock Interviews for Candidates | HireStepX",
  description: "Practise spoken interviews with an AI interviewer, get a scored STAR report and a coached model answer, and build proof recruiters can see.",
  alternates: { canonical: "/candidates" },
};

export default function Page() {
  return (
    <>
      <JsonLd data={breadcrumbs([["For candidates", "/candidates"]])} />
      <CandidatesPage />
    </>
  );
}
