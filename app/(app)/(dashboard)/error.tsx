"use client";

import AppErrorState from "@/AppErrorState";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AppErrorState error={error} reset={reset} />;
}
