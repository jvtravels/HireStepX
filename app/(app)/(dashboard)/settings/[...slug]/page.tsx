import type { Metadata } from "next";
import AppNotFound from "@/AppNotFound";

export const metadata: Metadata = { title: "Page not found | HireStepX", robots: "noindex" };

export default function Page() {
  return <AppNotFound />;
}
