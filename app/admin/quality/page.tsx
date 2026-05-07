"use client";
import dynamic from "next/dynamic";

const AdminQualityDashboard = dynamic(() => import("@/AdminQualityDashboard"), { ssr: false });

export default function Page() {
  return <AdminQualityDashboard />;
}
