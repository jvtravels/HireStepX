import type { Metadata } from "next";
import { CandidatesPage } from "@/home2/Candidates";

export const metadata: Metadata = {
  title: "HireStepX for candidates",
  description: "Practise spoken interviews with an AI interviewer, get a scored STAR report and a coached model answer.",
  alternates: { canonical: "/candidates" },
};

export default function Page() {
  return <CandidatesPage />;
}
