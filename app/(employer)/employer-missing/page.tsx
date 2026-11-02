import { notFound } from "next/navigation";

// proxy.ts rewrites unknown /employer/* addresses here. This segment has no
// loading.tsx, so notFound() can still set a real 404 status before the first
// byte is sent (under /employer the skeleton streams first and the status stays 200).
export const dynamic = "force-dynamic";

export default function EmployerMissing() {
  notFound();
}
