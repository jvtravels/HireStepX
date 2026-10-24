"use client";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { useStagingHost } from "@/home2/stagingHost";

const NotFoundPage = dynamic(() => import("@/home2/ErrorPages").then((m) => m.NotFoundPage), { ssr: false });

export default function NotFoundSwitch({ children }: { children: ReactNode }) {
  const staging = useStagingHost();
  return staging ? <NotFoundPage /> : <>{children}</>;
}
