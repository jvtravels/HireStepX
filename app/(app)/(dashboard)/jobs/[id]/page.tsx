import type { Metadata } from "next";
import JobDetailPage from "@/JobDetailPage";

export const metadata: Metadata = {
  title: "Job Details | HireStepX",
  description: "Full role details for an employer match.",
};

export default function Page() {
  return <JobDetailPage />;
}
