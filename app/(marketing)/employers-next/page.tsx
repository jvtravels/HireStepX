import type { Metadata } from "next";
import { EmployersPage } from "@/home2/Pages";

export const metadata: Metadata = {
  title: "HireStepX for companies",
  robots: "noindex, nofollow",
  alternates: { canonical: "/employers" },
};

export default function Page() {
  return <EmployersPage />;
}
