import type { Metadata } from "next";
import SharedReportView from "@/SharedReportView";

export const dynamic = "force-dynamic";
/* Node.js runtime (default) — was "edge" but the bundle crossed Vercel's
 * 1 MB edge-function limit after SharedReportView's transitive imports
 * grew. The page is a thin shell that defers data fetching to the
 * client-side call to /api/share-report, so edge latency wasn't load-
 * bearing. Move back to edge once the bundle is trimmed. */

export const metadata: Metadata = {
  title: "Interview Report | HireStepX",
  description: "Mock interview performance report shared from HireStepX.",
  robots: { index: false, follow: false }, // public link but not indexable
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedReportView token={token} />;
}
