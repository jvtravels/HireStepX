"use client";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";

const NotFoundPage = dynamic(() => import("@/home2/ErrorPages").then((m) => m.NotFoundPage), { ssr: false });

export default function NotFoundSwitch({ children: _children }: { children: ReactNode }) {
  return <NotFoundPage />;
}
