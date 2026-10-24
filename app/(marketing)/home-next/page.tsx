import type { Metadata } from "next";
import Homepage2 from "@/home2/Homepage";
import { JsonLd, ORGANIZATION, WEBSITE } from "@/home2/jsonld";

export const metadata: Metadata = {
  title: "HireStepX: AI Mock Interviews for Indian Job Seekers",
  description: "Practise spoken interviews with an AI interviewer, get a scored STAR report and a coached model answer. Pay once in INR, no subscription.",
  alternates: { canonical: "/" },
};

export default function Page() {
  return (
    <>
      <JsonLd data={[ORGANIZATION, WEBSITE]} />
      <Homepage2 />
    </>
  );
}
