import type { Metadata } from "next";
import ResumeV2 from "@/ResumeV2";

export const metadata: Metadata = {
  title: "Your Profile | HireStepX",
  description:
    "Upload and manage your resume for personalized interview practice.",
};

export default function Page() {
  return <ResumeV2 />;
}
