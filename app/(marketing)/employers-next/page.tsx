import type { Metadata } from "next";
import { EmployersPage } from "@/home2/Pages";

export const metadata: Metadata = {
  title: "Hire Interview-Ready Candidates | HireStepX",
  description: "See how candidates actually perform in interviews before you spend time on them. Scored evidence, side-by-side comparison, pay only to unlock.",
  alternates: { canonical: "/employers" },
};

export default function Page() {
  return <EmployersPage />;
}
