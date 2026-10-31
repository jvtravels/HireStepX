import type { Metadata } from "next";

/* Private console: never indexable, and no canonical pointing at the marketing
   home page (the root layout sets both for public pages). */
export const metadata: Metadata = {
  title: { default: "Employer console · HireStepX", template: "%s · HireStepX" },
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function EmployerSectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
