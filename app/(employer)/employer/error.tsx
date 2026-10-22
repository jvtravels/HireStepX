"use client";

import { useEffect } from "react";
import { captureClientEvent } from "@/posthogClient";
import { ErrorPanel, OutlineLink } from "@/employer/_consoleParts";

/* Segment-level boundary: it renders inside the employer shell, so nav, skip
   link and the account menu stay usable while the failed page is replaced.
   Only the digest is reported — never the message, which can echo user data. */
export default function EmployerError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    captureClientEvent("employer_route_error", { digest: error.digest ?? null });
  }, [error]);

  return (
    <ErrorPanel
      title="Something went wrong"
      message="This page hit an unexpected problem. Your data is safe. Try again, or head back to your overview."
      onRetry={retry}
      action={<OutlineLink href="/employer">Back to overview</OutlineLink>}
    />
  );
}
