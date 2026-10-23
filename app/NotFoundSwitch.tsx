"use client";
import type { ReactNode } from "react";
import { NotFoundPage } from "@/home2/ErrorPages";
import { useStagingHost } from "@/home2/Chrome";

export default function NotFoundSwitch({ children }: { children: ReactNode }) {
  const staging = useStagingHost();
  return staging ? <NotFoundPage /> : <>{children}</>;
}
