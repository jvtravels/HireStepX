"use client";
import { usePathname } from "next/navigation";
import LoadingScreen from "@/_LoadingScreen";
import { routeSkeletonFor } from "@/routeSkeletons";

// One loading boundary covers every dashboard route, so pick the skeleton
// shaped like the destination screen from the pathname.
export default function DashboardLoading() {
  const pathname = usePathname();
  return routeSkeletonFor(pathname) ?? <LoadingScreen />;
}
