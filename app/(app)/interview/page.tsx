import type { Metadata } from "next";
import InterviewLoader from "./InterviewLoader";

export const metadata: Metadata = {
  title: "Interview | HireStepX",
  description: "AI-powered mock interview session.",
};

export default function Page() {
  return <InterviewLoader />;
}
