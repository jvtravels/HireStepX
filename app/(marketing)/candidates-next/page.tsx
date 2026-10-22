import type { Metadata } from "next";
import { CandidatesPage } from "@/home2/Candidates";

export const metadata: Metadata = {
  title: "HireStepX for candidates",
  robots: "noindex, nofollow",
  alternates: { canonical: "/" },
};

export default function Page() {
  return <CandidatesPage />;
}
