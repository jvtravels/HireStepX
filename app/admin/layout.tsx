import type { Metadata } from "next";
import AnalyticsNonce from "../AnalyticsNonce";

export const metadata: Metadata = {
  title: "Admin | HireStepX",
  description: "Admin dashboard for HireStepX.",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnalyticsNonce />
      {children}
    </>
  );
}
