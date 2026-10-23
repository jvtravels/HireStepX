import type { Metadata } from "next";
import Signup from "@/auth/Signup";

export const metadata: Metadata = {
  title: "Sign Up | HireStepX",
  description:
    "Create your free HireStepX account and start practicing interviews today.",
  /* /questions/[slug] pages link here with ?source=questions-seo&company=...
     &focus=...&role=... for attribution — one distinct URL per company/focus/
     role combination. Without a canonical, Google indexes each variant as its
     own thin, near-duplicate page instead of consolidating signal onto /signup. */
  alternates: { canonical: "/signup" },
};

export default function Page() {
  return <Signup />;
}
