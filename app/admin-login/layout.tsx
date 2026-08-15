import type { Metadata } from "next";
import AnalyticsNonce from "../AnalyticsNonce";

export const metadata: Metadata = {
  title: "Admin login | HireStepX",
  robots: { index: false, follow: false },
};

/* Sibling to /admin, not nested under it, so it doesn't inherit
   app/admin/layout.tsx's <AnalyticsNonce />. Without a headers() read
   somewhere in its render tree this page is eligible for static
   generation, which bakes its inline scripts with no nonce at build
   time — permanently mismatched against the live per-request nonce
   proxy.ts puts on the CSP response header. */
export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnalyticsNonce />
      {children}
    </>
  );
}
