/* Screen chunks are code-split behind next/dynamic in each route's page.tsx,
   so on a hard load the browser only starts fetching them after auth restores
   and the page renders — a serial network hop. Starting the same import()
   early (while the session restores, or when a nav item is hovered) overlaps
   it with that work; the module system dedupes, so the page's own dynamic()
   resolves instantly from the already-loading chunk. */
const LOADERS: Record<string, () => Promise<unknown>> = {
  "/dashboard": () => import("./DashboardHome"),
  "/sessions": () => import("./SessionsV2"),
  "/jobs": () => import("./DashboardJobs"),
  "/messages": () => import("./MessagesV2"),
  "/referrals": () => import("./DashboardReferrals"),
  "/calendar": () => import("./DashboardCalendar"),
  "/resume": () => import("./ResumeV2"),
  "/settings": () => import("./DashboardSettings"),
  "/analytics": () => import("./DashboardAnalytics"),
};

const started = new Set<string>();

export function preloadRouteChunk(pathname: string | null | undefined): void {
  if (!pathname) return;
  const key = pathname.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  const load = LOADERS[key];
  if (!load || started.has(key)) return;
  started.add(key);
  load().catch(() => started.delete(key));
}
